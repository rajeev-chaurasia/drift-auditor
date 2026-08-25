import { isBindablePaint, type DocumentSnapshot, type PaintRef, type SnapshotNode } from "../model/snapshot.ts"
import { walkAll } from "../util/tree.ts"

export type PaintSurface = "fills" | "strokes"

export interface PaintCandidate {
  readonly node: SnapshotNode
  readonly surface: PaintSurface
  readonly paint: Extract<PaintRef, { kind: "solid" }>
  readonly index: number
}

/**
 * Every paint a variable could have been bound to.
 *
 * Image and gradient paints are absent because the API cannot bind a variable
 * to them, and hidden paints are absent because they are not on screen to
 * drift. Both exclusions live here rather than in the detector so that the
 * coverage ratio and the findings are counted over exactly the same set. A
 * ratio whose denominator disagrees with the findings above it is worse than
 * no ratio.
 */
export function* bindablePaints(node: SnapshotNode): Generator<PaintCandidate> {
  for (const surface of ["fills", "strokes"] as const) {
    const paints = node.props[surface]
    if (!paints) continue

    for (const [index, paint] of paints.entries()) {
      if (!paint.visible) continue
      if (!isBindablePaint(paint)) continue
      yield { node, surface, paint, index }
    }
  }
}

/** Bound to a variable, or pointing at a style from a published library. */
export function isCompliant(snapshot: DocumentSnapshot, candidate: PaintCandidate): boolean {
  if (candidate.paint.variableId && snapshot.variables[candidate.paint.variableId]) return true

  const styles = candidate.node.props.styles
  const styleId = candidate.surface === "fills" ? styles?.fill : styles?.stroke
  if (!styleId) return false

  // `remote` means the style lives in another file, which is the only signal
  // the API offers that it came from a published library. See known-misses.
  return snapshot.styles[styleId]?.remote === true
}

export interface PaintCoverage {
  readonly bindable: number
  readonly tokenised: number
  readonly coverage: number
}

export function paintCoverage(snapshot: DocumentSnapshot): PaintCoverage {
  let bindable = 0
  let tokenised = 0

  for (const node of walkAll(snapshot)) {
    for (const candidate of bindablePaints(node)) {
      bindable += 1
      if (isCompliant(snapshot, candidate)) tokenised += 1
    }
  }

  return {
    bindable,
    tokenised,
    // A file with no bindable paints is fully covered rather than undefined.
    coverage: bindable === 0 ? 1 : Math.round((tokenised / bindable) * 10000) / 10000,
  }
}
