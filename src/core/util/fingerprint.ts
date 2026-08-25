import type { DocumentSnapshot, NodeId, NodeType, SnapshotNode } from "../model/snapshot.ts"
import { children, walk } from "./tree.ts"

export interface Fingerprint {
  readonly shape: string
  readonly depth: number
  readonly nodeCount: number
  readonly width: number
  readonly height: number
}

export function fingerprint(snapshot: DocumentSnapshot, rootId: NodeId): Fingerprint | null {
  const root = snapshot.nodes[rootId]
  if (!root) return null

  let nodeCount = 0
  for (const _ of walk(snapshot, rootId)) nodeCount += 1

  return {
    shape: fnv1a(encodeShape(snapshot, root)),
    depth: measureDepth(snapshot, root),
    nodeCount,
    width: root.props.width ?? 0,
    height: root.props.height ?? 0,
  }
}

export function similarity(a: Fingerprint, b: Fingerprint): number {
  const shapeScore = a.shape === b.shape ? 1 : 0
  const sizeScore = ratio(a.width, b.width) * ratio(a.height, b.height)
  const countScore = ratio(a.nodeCount, b.nodeCount)
  return 0.6 * shapeScore + 0.2 * sizeScore + 0.2 * countScore
}

// A detached instance is a FRAME and the component it came from is a
// COMPONENT, so a shape that recorded a container's own type could never match
// the one pair this exists to match. Containers collapse to a single token.
// Leaves keep their type, because a vector standing where a text used to be is
// a real structural difference.
const CONTAINERS: ReadonlySet<NodeType> = new Set<NodeType>([
  "FRAME",
  "GROUP",
  "SECTION",
  "COMPONENT",
  "COMPONENT_SET",
  "INSTANCE",
])

function shapeToken(type: NodeType): string {
  return CONTAINERS.has(type) ? "CONTAINER" : type
}

function encodeShape(snapshot: DocumentSnapshot, node: SnapshotNode): string {
  const kids = children(snapshot, node)
  if (kids.length === 0) return `${shapeToken(node.type)}(0)`
  const encodedKids = kids.map((kid) => encodeShape(snapshot, kid)).join(",")
  return `${shapeToken(node.type)}(${kids.length})[${encodedKids}]`
}

function measureDepth(snapshot: DocumentSnapshot, node: SnapshotNode): number {
  const kids = children(snapshot, node)
  if (kids.length === 0) return 0
  let max = 0
  for (const kid of kids) {
    const d = measureDepth(snapshot, kid)
    if (d > max) max = d
  }
  return 1 + max
}

function ratio(a: number, b: number): number {
  if (a === 0 && b === 0) return 1
  const max = Math.max(a, b)
  if (max === 0) return 1
  return Math.min(a, b) / max
}

// 32-bit FNV-1a hash implemented without node builtins so it runs in browser sandboxes.
function fnv1a(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}
