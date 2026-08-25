import type { DocumentSnapshot, NodeId, SnapshotNode } from "../model/snapshot.ts"
import type { Owner } from "../util/location.ts"
import { indexPath, resolveIndexPath, walkAll } from "../util/tree.ts"

/**
 * Working out who a finding belongs to, and how far it reaches.
 *
 * Every detector needs the same three answers, and they have to agree, or the
 * same layer gets charged twice under two categories. One implementation, used
 * by all of them.
 */

export function enclosingInstance(snapshot: DocumentSnapshot, node: SnapshotNode): SnapshotNode | null {
  return climb(snapshot, node, (current) => current.type === "INSTANCE" && current.instance !== undefined)
}

export function enclosingComponent(snapshot: DocumentSnapshot, node: SnapshotNode): SnapshotNode | null {
  return climb(snapshot, node, (current) => current.type === "COMPONENT")
}

/**
 * The layer inside the main component that this one mirrors.
 *
 * An instance and its component share a structure but share no node ids, so
 * position is the only address that means the same thing in both. When the
 * types at that position disagree the structures have diverged and the match
 * is not trustworthy, so this answers null. Every caller then reports without
 * a baseline rather than diffing against the wrong layer.
 */
export function baselineFor(
  snapshot: DocumentSnapshot,
  instance: SnapshotNode,
  subject: SnapshotNode,
): SnapshotNode | null {
  const mainId = instance.instance?.mainComponentNodeId
  if (!mainId) return null

  const path = indexPath(snapshot, instance.id, subject.id)
  if (!path) return null

  // The one type difference that is not divergence: an instance root is always
  // an INSTANCE and its baseline is always a COMPONENT.
  if (path.length === 0) return snapshot.nodes[mainId] ?? null

  const candidate = resolveIndexPath(snapshot, mainId, path)
  return candidate && candidate.type === subject.type ? candidate : null
}

/** The same, for a layer that may or may not sit inside an instance at all. */
export function inheritedBaseline(snapshot: DocumentSnapshot, node: SnapshotNode): SnapshotNode | null {
  const instance = enclosingInstance(snapshot, node)
  return instance ? baselineFor(snapshot, instance, node) : null
}

export function ownerOf(snapshot: DocumentSnapshot, node: SnapshotNode): Owner | undefined {
  const component = enclosingComponent(snapshot, node)
  if (!component?.componentKey) return undefined

  const record = snapshot.components[component.componentKey]
  return {
    id: component.id,
    name: component.name,
    componentKey: component.componentKey,
    ...(record && { componentName: record.name }),
  }
}

/** How many instances exist of each component, by the component's node id. */
export function instanceReach(snapshot: DocumentSnapshot): Map<NodeId, number> {
  const reach = new Map<NodeId, number>()

  for (const node of walkAll(snapshot)) {
    const mainId = node.type === "INSTANCE" ? node.instance?.mainComponentNodeId : null
    if (mainId) reach.set(mainId, (reach.get(mainId) ?? 0) + 1)
  }

  return reach
}

/**
 * One, unless the layer sits inside a component, in which case the finding
 * reaches every instance of it. A hardcoded colour in a component used ninety
 * times is a different problem from the same colour used once.
 */
export function blastRadius(
  snapshot: DocumentSnapshot,
  node: SnapshotNode,
  reach: Map<NodeId, number>,
): number {
  const component = enclosingComponent(snapshot, node)
  return component ? Math.max(1, reach.get(component.id) ?? 0) : 1
}

function climb(
  snapshot: DocumentSnapshot,
  node: SnapshotNode,
  matches: (node: SnapshotNode) => boolean,
): SnapshotNode | null {
  let current: SnapshotNode | undefined = node

  while (current) {
    if (matches(current)) return current
    current = current.parentId ? snapshot.nodes[current.parentId] : undefined
  }

  return null
}
