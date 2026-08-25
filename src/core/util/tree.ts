import type { DocumentSnapshot, NodeId, SnapshotNode } from "../model/snapshot.ts"

export function getNode(snapshot: DocumentSnapshot, id: NodeId): SnapshotNode | null {
  return snapshot.nodes[id] ?? null
}

export function requireNode(snapshot: DocumentSnapshot, id: NodeId): SnapshotNode {
  const node = snapshot.nodes[id]
  if (!node) throw new Error(`snapshot has no node ${id}`)
  return node
}

export function children(snapshot: DocumentSnapshot, node: SnapshotNode): SnapshotNode[] {
  return node.childIds.flatMap((id) => {
    const child = snapshot.nodes[id]
    return child ? [child] : []
  })
}

/** Depth first, the root included, in document order. */
export function* walk(snapshot: DocumentSnapshot, rootId: NodeId): Generator<SnapshotNode> {
  const root = snapshot.nodes[rootId]
  if (!root) return

  const stack: SnapshotNode[] = [root]
  while (stack.length > 0) {
    const node = stack.pop() as SnapshotNode
    yield node
    for (let i = node.childIds.length - 1; i >= 0; i -= 1) {
      const child = snapshot.nodes[node.childIds[i] as NodeId]
      if (child) stack.push(child)
    }
  }
}

export function* walkAll(snapshot: DocumentSnapshot): Generator<SnapshotNode> {
  for (const pageId of snapshot.pageIds) yield* walk(snapshot, pageId)
}

/**
 * Position of a descendant relative to an ancestor, as child indices.
 *
 * An instance and its main component share a structure but share no node ids,
 * so a position is the only address that means the same thing in both. Returns
 * null when the node is not under the ancestor at all.
 */
export function indexPath(snapshot: DocumentSnapshot, ancestorId: NodeId, nodeId: NodeId): number[] | null {
  const path: number[] = []
  let current = snapshot.nodes[nodeId]

  while (current && current.id !== ancestorId) {
    const parent = current.parentId ? snapshot.nodes[current.parentId] : undefined
    if (!parent) return null

    const index = parent.childIds.indexOf(current.id)
    if (index < 0) return null

    path.unshift(index)
    current = parent
  }

  return current ? path : null
}

export function resolveIndexPath(
  snapshot: DocumentSnapshot,
  rootId: NodeId,
  path: readonly number[],
): SnapshotNode | null {
  let current = snapshot.nodes[rootId]

  for (const index of path) {
    if (!current) return null
    const childId = current.childIds[index]
    current = childId ? snapshot.nodes[childId] : undefined
  }

  return current ?? null
}

/** A readable address for a finding, so a report can be acted on in Figma. */
export function namePath(snapshot: DocumentSnapshot, ancestorId: NodeId, nodeId: NodeId): string {
  const names: string[] = []
  let current = snapshot.nodes[nodeId]

  while (current && current.id !== ancestorId) {
    names.unshift(current.name)
    current = current.parentId ? snapshot.nodes[current.parentId] : undefined
  }

  return names.join(" / ")
}
