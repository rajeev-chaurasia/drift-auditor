import { findingId, type Category } from "../model/finding.ts"
import type { DocumentSnapshot, NodeId } from "../model/snapshot.ts"
import { namePath, walk } from "../util/tree.ts"

/**
 * A drift case somebody put into a Figma file on purpose.
 *
 * Labels are addressed by layer path rather than by node id so that they can
 * be written from the file itself, before the detector has ever been run over
 * it. A label set derived from detector output can only ever confirm what the
 * detector already found, which measures nothing about recall.
 */
export interface LabelCase {
  readonly page: string
  readonly path: string
  readonly field: string
  readonly category: Category
  readonly why: string
}

export interface LabelSet {
  readonly snapshot: string
  readonly split: "tuning" | "held-out"
  readonly notes?: string
  readonly cases: readonly LabelCase[]
}

export class LabelError extends Error {}

export function parseLabels(value: unknown): LabelSet {
  const record = value as Partial<LabelSet> | null
  if (!record || typeof record !== "object") throw new LabelError("labels are not an object")
  if (typeof record.snapshot !== "string") throw new LabelError("labels are missing the snapshot they describe")
  if (record.split !== "tuning" && record.split !== "held-out") {
    throw new LabelError(`labels have split ${String(record.split)}, expected tuning or held-out`)
  }
  if (!Array.isArray(record.cases)) throw new LabelError("labels are missing cases")

  record.cases.forEach((entry, index) => {
    for (const field of ["page", "path", "field", "category", "why"] as const) {
      if (typeof entry?.[field] !== "string") throw new LabelError(`case ${index} is missing ${field}`)
    }
  })

  return record as LabelSet
}

const normalise = (path: string): string =>
  path
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/")

/**
 * Every layer in the file, addressed the way a label addresses it.
 *
 * A path that two layers share is rejected rather than resolved to the first
 * match, because a label that could mean either one is not a label.
 */
function index(snapshot: DocumentSnapshot): Map<string, NodeId | null> {
  const byPath = new Map<string, NodeId | null>()

  for (const pageId of snapshot.pageIds) {
    const page = snapshot.nodes[pageId]
    if (!page) continue

    for (const node of walk(snapshot, pageId)) {
      if (node.id === pageId) continue
      const key = `${normalise(page.name)}/${normalise(namePath(snapshot, pageId, node.id))}`
      byPath.set(key, byPath.has(key) ? null : node.id)
    }
  }

  return byPath
}

/**
 * Label cases turned into the finding ids they predict, for the categories
 * asked for. Throws on a label that points at nothing.
 *
 * Scoring one category against the labels for all of them would count every
 * correct finding in the other categories as a miss, which says nothing about
 * the detector under test.
 */
export function expectedFindingIds(
  snapshot: DocumentSnapshot,
  labels: LabelSet,
  categories?: readonly Category[],
): Set<string> {
  const scope = categories ? new Set(categories) : null
  const byPath = index(snapshot)
  const expected = new Set<string>()
  const problems: string[] = []

  for (const entry of labels.cases) {
    if (scope && !scope.has(entry.category)) continue

    const key = `${normalise(entry.page)}/${normalise(entry.path)}`
    const nodeId = byPath.get(key)

    if (nodeId === undefined) problems.push(`no layer at ${key}`)
    else if (nodeId === null) problems.push(`more than one layer at ${key}`)
    else expected.add(findingId(entry.category, nodeId, entry.field))
  }

  if (problems.length > 0) {
    throw new LabelError(`labels do not match the snapshot they describe:\n  ${problems.join("\n  ")}`)
  }

  return expected
}
