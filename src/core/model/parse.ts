import { SCHEMA_VERSION, type DocumentSnapshot, type NodeId, type SnapshotNode } from "./snapshot.ts"

export class SnapshotError extends Error {}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/**
 * Parses a snapshot and checks that it holds together as a tree.
 *
 * The integrity checks are not defensive programming. A snapshot is published
 * as evidence, so a file whose parent and child links disagree has either been
 * edited by hand or produced by a broken reader, and either way nothing
 * computed from it should be believed.
 */
export function parseSnapshot(value: unknown): DocumentSnapshot {
  if (!isRecord(value)) throw new SnapshotError("snapshot is not an object")

  if (value.schema !== SCHEMA_VERSION) {
    throw new SnapshotError(`snapshot schema ${String(value.schema)}, expected ${SCHEMA_VERSION}`)
  }

  for (const field of ["file", "capture", "nodes", "components", "styles", "variables"]) {
    if (!isRecord(value[field])) throw new SnapshotError(`snapshot field ${field} is missing or not an object`)
  }
  if (!Array.isArray(value.pageIds)) throw new SnapshotError("snapshot field pageIds is missing")

  const snapshot = value as unknown as DocumentSnapshot
  checkTree(snapshot)
  return snapshot
}

function checkTree(snapshot: DocumentSnapshot): void {
  const problems: string[] = []

  for (const pageId of snapshot.pageIds) {
    if (!snapshot.nodes[pageId]) problems.push(`page ${pageId} is not in nodes`)
  }

  for (const [id, node] of Object.entries(snapshot.nodes) as Array<[NodeId, SnapshotNode]>) {
    if (node.id !== id) problems.push(`node ${id} is filed under a different id, ${node.id}`)

    for (const childId of node.childIds) {
      const child = snapshot.nodes[childId]
      if (!child) {
        problems.push(`node ${id} claims a child ${childId} that is not in nodes`)
      } else if (child.parentId !== id) {
        problems.push(`node ${childId} is a child of ${id} but records its parent as ${String(child.parentId)}`)
      }
    }

    if (node.parentId !== null) {
      const parent = snapshot.nodes[node.parentId]
      if (!parent) problems.push(`node ${id} names a parent ${node.parentId} that is not in nodes`)
      else if (!parent.childIds.includes(id)) problems.push(`node ${id} is not among the children of ${node.parentId}`)
    }

    const instance = node.instance
    if (instance?.mainComponentNodeId && !snapshot.nodes[instance.mainComponentNodeId]) {
      problems.push(`instance ${id} names a main component node that is not in nodes`)
    }
  }

  if (problems.length > 0) {
    throw new SnapshotError(`snapshot is not internally consistent:\n  ${problems.slice(0, 10).join("\n  ")}`)
  }
}
