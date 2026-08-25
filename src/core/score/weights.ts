import type { Category, FieldClass } from "../model/finding.ts"

/**
 * The whole severity model, in one table, with a reason for every number.
 *
 * These are not fitted. Nothing was tuned until the output looked right, and
 * the two ratios published next to the score exist precisely so that a reader
 * who disagrees with this table can ignore it entirely and still check the
 * result. Changing a number here changes every published score, which is why
 * the evidence validator recomputes from this file rather than trusting a
 * total somebody wrote down.
 */
export const WEIGHT_MODEL_VERSION = 1

export const CATEGORY_WEIGHTS: Readonly<Record<Category, number>> = {
  // Both cost the same to live with. One is a layer that no longer follows its
  // component, the other is a value that follows nothing at all.
  "override-drift": 1,
  "token-drift": 1,
  "typography-drift": 1,
  // Never reaches the score. Detachment is inferred rather than answered by
  // the API, and a probabilistic finding has no business moving a number that
  // is presented as exact. It is kept here so the table is complete.
  detachment: 0,
}

/**
 * How much a class of change costs the system, not how much it costs to click.
 *
 * The top of the scale is the things a design system exists to control
 * centrally, where every instance of the drift is a place a future rebrand has
 * to be found by hand. The bottom is copy, which is usually deliberate and
 * cheap to reconcile.
 */
export const FIELD_CLASS_WEIGHTS: Readonly<Record<FieldClass, number>> = {
  colour: 3,
  typography: 3,
  // Pointing a layer at a different style is a systemic decision, not a nudge.
  "style-binding": 3,
  geometry: 2,
  layout: 2,
  visibility: 2,
  // A retyped label is usually the copy being right, not the system being
  // wrong. It is still reported, it just does not dominate the total.
  content: 1,
  other: 1,
}

/**
 * Exposure counts, but not linearly.
 *
 * A hardcoded colour in a component used sixty four times is worse than the
 * same colour used once, because it is sixty four places a rebrand has to
 * reach. It is not sixty four times worse, because fixing it is still one
 * edit. Doubling the reach adds a constant, which is the shape that says both
 * of those things at once.
 */
export function blastRadiusFactor(blastRadius: number): number {
  return 1 + Math.log2(Math.max(1, blastRadius))
}
