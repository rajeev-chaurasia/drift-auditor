import type { Category, Finding } from "../model/finding.ts"
import { blastRadiusFactor, CATEGORY_WEIGHTS, FIELD_CLASS_WEIGHTS, WEIGHT_MODEL_VERSION } from "./weights.ts"

export interface DriftScore {
  readonly modelVersion: number
  readonly total: number
  readonly byCategory: Readonly<Record<string, number>>
  /** Findings left out of the total because they are inferred rather than answered. */
  readonly excludedCandidates: number
}

/** One finding's contribution. Pure, so the validator can recompute every total. */
export function severity(finding: Finding): number {
  if (finding.confidence !== "exact") return 0

  const value =
    CATEGORY_WEIGHTS[finding.category] *
    FIELD_CLASS_WEIGHTS[finding.fieldClass] *
    blastRadiusFactor(finding.blastRadius)

  return round(value)
}

export function scoreFindings(findings: readonly Finding[]): DriftScore {
  const byCategory: Record<Category | string, number> = {}
  let total = 0
  let excludedCandidates = 0

  for (const finding of findings) {
    if (finding.confidence !== "exact") {
      excludedCandidates += 1
      continue
    }

    const value = severity(finding)
    byCategory[finding.category] = round((byCategory[finding.category] ?? 0) + value)
    total = round(total + value)
  }

  return { modelVersion: WEIGHT_MODEL_VERSION, total, byCategory, excludedCandidates }
}

// Two places is enough to read, and few enough that a total survives a JSON
// round trip unchanged, which the evidence validator depends on.
const round = (value: number): number => Math.round(value * 100) / 100
