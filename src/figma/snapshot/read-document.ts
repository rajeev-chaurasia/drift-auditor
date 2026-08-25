import {
  SCHEMA_VERSION,
  type ComponentKey,
  type ComponentRecord,
  type DocumentSnapshot,
  type Incompleteness,
  type InstanceInfo,
  type NodeId,
  type OverrideRecord,
  type SnapshotNode,
} from "../../core/model/snapshot"
import { readNode, type ReadContext } from "./read-node"
import { StyleResolver } from "./resolve-styles"
import { VariableResolver } from "./resolve-variables"

export interface ReadOptions {
  readonly producer: string
  /**
   * Figma's own escape hatch for large files. It is off by default because an
   * invisible layer can still carry an override, and a scan that quietly drops
   * them would report a better score than the file deserves.
   */
  readonly skipInvisibleInstanceChildren?: boolean
  readonly onProgress?: (nodesVisited: number) => void
}

const PROGRESS_INTERVAL = 250

export async function readDocument(options: ReadOptions): Promise<DocumentSnapshot> {
  const startedAt = Date.now()
  const skipInvisible = options.skipInvisibleInstanceChildren ?? false
  figma.skipInvisibleInstanceChildren = skipInvisible

  // Required before any document wide traversal under dynamic page loading,
  // and the slowest single step on a large file.
  await figma.loadAllPagesAsync()

  const incomplete: Incompleteness[] = []
  const context: ReadContext = {
    styles: new StyleResolver(),
    variables: new VariableResolver(),
    incomplete,
  }

  const nodes: Record<NodeId, SnapshotNode> = {}
  const components = new Map<ComponentKey, ComponentRecord>()
  const pendingInstances: InstanceNode[] = []

  const report = () => options.onProgress?.(Object.keys(nodes).length)

  const capture = async (root: SceneNode | PageNode, rootParentId: NodeId | null): Promise<void> => {
    const stack: Array<{ node: SceneNode | PageNode; parentId: NodeId | null }> = [
      { node: root, parentId: rootParentId },
    ]

    while (stack.length > 0) {
      const { node, parentId } = stack.pop() as { node: SceneNode | PageNode; parentId: NodeId | null }
      if (nodes[node.id]) continue

      try {
        nodes[node.id] = await readNode(node, parentId, context)
      } catch (error) {
        incomplete.push({ nodeId: node.id, reason: "read-failed", detail: String(error) })
        continue
      }

      if (node.type === "INSTANCE") pendingInstances.push(node)
      if (node.type === "COMPONENT" && !components.has(node.key)) {
        components.set(node.key, { key: node.key, name: node.name, remote: node.remote, nodeId: node.id })
      }

      if ("children" in node) {
        for (const child of node.children) stack.push({ node: child, parentId: node.id })
      }

      if (Object.keys(nodes).length % PROGRESS_INTERVAL === 0) report()
    }
  }

  for (const page of figma.root.children) await capture(page, null)

  // Instances are resolved after the pages, because a main component that
  // lives in this file is already captured by then and only a library
  // component needs the extra read.
  while (pendingInstances.length > 0) {
    const instance = pendingInstances.shift() as InstanceNode
    const info = await readInstance(instance, nodes, components, incomplete, capture)
    const existing = nodes[instance.id]
    if (existing) nodes[instance.id] = { ...existing, instance: info }
  }

  report()

  return {
    schema: SCHEMA_VERSION,
    file: { name: figma.root.name, rootId: figma.root.id },
    capture: {
      recordedAt: new Date(startedAt).toISOString(),
      producer: options.producer,
      pagesLoaded: figma.root.children.length,
      skipInvisibleInstanceChildren: skipInvisible,
      nodesVisited: Object.keys(nodes).length,
      durationMs: Date.now() - startedAt,
      incomplete,
    },
    pageIds: figma.root.children.map((page) => page.id),
    nodes,
    components: Object.fromEntries(components),
    styles: context.styles.collect(),
    variables: context.variables.collect(),
  }
}

async function readInstance(
  instance: InstanceNode,
  nodes: Record<NodeId, SnapshotNode>,
  components: Map<ComponentKey, ComponentRecord>,
  incomplete: Incompleteness[],
  capture: (root: SceneNode, parentId: NodeId | null) => Promise<void>,
): Promise<InstanceInfo> {
  const overrides: OverrideRecord[] = instance.overrides.map((override) => ({
    nodeId: override.id,
    fields: [...override.overriddenFields],
  }))

  const componentProperties = Object.fromEntries(
    Object.entries(instance.componentProperties).map(([name, property]) => [name, String(property.value)]),
  )

  const main = await instance.getMainComponentAsync().catch(() => null)
  if (!main) {
    incomplete.push({
      nodeId: instance.id,
      reason: "remote-baseline-unreadable",
      detail: "the main component could not be read",
    })
    return {
      mainComponentKey: null,
      mainComponentNodeId: null,
      baselineAvailable: false,
      overrides,
      componentProperties,
    }
  }

  // A component from a published library is not part of this document, so it
  // has to be read on its own before an override has anything to diff against.
  if (!nodes[main.id]) {
    try {
      await capture(main, null)
    } catch (error) {
      incomplete.push({ nodeId: instance.id, reason: "remote-baseline-unreadable", detail: String(error) })
    }
  }

  const captured = Boolean(nodes[main.id])
  if (!components.has(main.key)) {
    components.set(main.key, {
      key: main.key,
      name: main.name,
      remote: main.remote,
      nodeId: captured ? main.id : null,
    })
  }

  if (!captured) {
    incomplete.push({
      nodeId: instance.id,
      reason: "remote-baseline-unreadable",
      detail: `main component ${main.name} is not readable from this file`,
    })
  }

  return {
    mainComponentKey: main.key,
    mainComponentNodeId: captured ? main.id : null,
    baselineAvailable: captured,
    overrides,
    componentProperties,
  }
}
