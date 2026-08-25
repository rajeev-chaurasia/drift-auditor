import type { ComponentKey, NodeId } from "./snapshot.ts"

export type Category = "override-drift" | "token-drift" | "typography-drift" | "detachment"

/**
 * `exact` means the Figma API answered the question directly. `candidate`
 * means the finding is inferred and can be wrong, which is true of detachment
 * and of nothing else. The two are never mixed in a published accuracy number.
 */
export type Confidence = "exact" | "candidate"

export type FieldClass =
  | "content"
  | "colour"
  | "typography"
  | "geometry"
  | "layout"
  // Both `visible` and `opacity` live here, because the question they answer
  // is the same one: how much of this layer is on screen.
  | "visibility"
  | "style-binding"
  | "other"

export interface FindingLocation {
  readonly pageId: NodeId
  readonly pageName: string
  /** Layer path from the page, so a reader can walk to it in Figma. */
  readonly path: string
  readonly ownerId: NodeId | null
  readonly ownerName: string | null
  readonly componentKey?: ComponentKey
  readonly componentName?: string
}

export interface Finding {
  readonly id: string
  readonly category: Category
  readonly confidence: Confidence
  readonly fieldClass: FieldClass
  readonly field: string
  readonly subjectId: NodeId
  readonly subjectName: string
  readonly location: FindingLocation
  /** Null when there is no readable baseline, or when the value is not modelled. */
  readonly expected: string | null
  readonly actual: string | null
  readonly baselineAvailable: boolean
  /** How many instances this finding reaches. One unless it was attributed to a component. */
  readonly blastRadius: number
  readonly note?: string
}

// Readable rather than hashed, so a finding in a published artifact can be
// traced back to a layer by anyone reading the JSON.
export function findingId(category: Category, subjectId: NodeId, field: string): string {
  return `${category}|${subjectId}|${field}`
}
