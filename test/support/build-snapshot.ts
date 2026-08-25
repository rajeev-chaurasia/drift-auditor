import {
  SCHEMA_VERSION,
  type ComponentRecord,
  type DocumentSnapshot,
  type NodeId,
  type NodeType,
  type SnapshotNode,
  type StyleRecord,
  type VariableRecord,
} from "../../src/core/model/snapshot.ts"

export interface NodeSpec extends Partial<Omit<SnapshotNode, "id" | "type" | "childIds">> {
  readonly id: NodeId
  readonly type: NodeType
  readonly children?: readonly NodeSpec[]
}

interface SnapshotSpec {
  readonly pages: readonly NodeSpec[]
  readonly components?: readonly ComponentRecord[]
  readonly styles?: readonly StyleRecord[]
  readonly variables?: readonly VariableRecord[]
}

/**
 * Builds a snapshot from a nested literal, wiring parentId and childIds so a
 * test can describe a tree the way it reads rather than the way it is stored.
 */
export function buildSnapshot(spec: SnapshotSpec): DocumentSnapshot {
  const nodes: Record<NodeId, SnapshotNode> = {}

  const add = (node: NodeSpec, parentId: NodeId | null): NodeId => {
    const children = node.children ?? []
    nodes[node.id] = {
      name: node.id,
      visible: true,
      props: {},
      ...node,
      parentId,
      childIds: children.map((child) => add(child, node.id)),
    }
    return node.id
  }

  const pageIds = spec.pages.map((page) => add(page, null))

  return {
    schema: SCHEMA_VERSION,
    file: { name: "test", rootId: "root" },
    capture: {
      recordedAt: "2026-01-01T00:00:00.000Z",
      producer: "test",
      pagesLoaded: pageIds.length,
      skipInvisibleInstanceChildren: false,
      nodesVisited: Object.keys(nodes).length,
      durationMs: 0,
      incomplete: [],
    },
    pageIds,
    nodes,
    components: Object.fromEntries((spec.components ?? []).map((c) => [c.key, c])),
    styles: Object.fromEntries((spec.styles ?? []).map((s) => [s.id, s])),
    variables: Object.fromEntries((spec.variables ?? []).map((v) => [v.id, v])),
  }
}
