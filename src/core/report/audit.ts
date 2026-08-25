import { paintCoverage, type PaintCoverage } from "../detect/paint-compliance.ts"
import { detectAll } from "../detect/registry.ts"
import type { Detector } from "../detect/detector.ts"
import type { Category, FieldClass, Finding } from "../model/finding.ts"
import type { CaptureMeta, DocumentSnapshot } from "../model/snapshot.ts"
import { walkAll } from "../util/tree.ts"
import { summarise, type SnapshotSummary } from "./summary.ts"

export interface AuditRates {
  /**
   * Instances carrying at least one drift finding, over instances that had a
   * readable baseline. Published next to the score because it can be
   * recomputed from the findings alone, without trusting a weight table.
   */
  readonly overrideRate: number
  readonly instancesConsidered: number
  readonly instancesDrifted: number
  /**
   * Paints resolving to a variable or a published style, over paints a
   * variable could have been bound to. Counted over exactly the set the token
   * findings are drawn from, so the two never disagree.
   */
  readonly tokenCoverage: PaintCoverage
}

export interface AuditCounts {
  readonly total: number
  readonly byCategory: Readonly<Record<string, number>>
  readonly byFieldClass: Readonly<Record<string, number>>
  readonly withoutBaseline: number
}

export interface AuditReport {
  readonly file: string
  readonly capture: CaptureMeta
  readonly summary: SnapshotSummary
  readonly counts: AuditCounts
  readonly rates: AuditRates
  readonly findings: readonly Finding[]
}

/** One snapshot in, one report out, with nothing read from anywhere else. */
export function audit(snapshot: DocumentSnapshot, detectors?: readonly Detector[]): AuditReport {
  const findings = detectAll(snapshot, detectors)

  return {
    file: snapshot.file.name,
    capture: snapshot.capture,
    summary: summarise(snapshot),
    counts: count(findings),
    rates: rates(snapshot, findings),
    findings,
  }
}

function count(findings: readonly Finding[]): AuditCounts {
  const byCategory: Record<Category | string, number> = {}
  const byFieldClass: Record<FieldClass | string, number> = {}
  let withoutBaseline = 0

  for (const finding of findings) {
    byCategory[finding.category] = (byCategory[finding.category] ?? 0) + 1
    byFieldClass[finding.fieldClass] = (byFieldClass[finding.fieldClass] ?? 0) + 1
    if (!finding.baselineAvailable) withoutBaseline += 1
  }

  return { total: findings.length, byCategory, byFieldClass, withoutBaseline }
}

function rates(snapshot: DocumentSnapshot, findings: readonly Finding[]): AuditRates {
  const drifted = new Set<string>()
  for (const finding of findings) {
    if (finding.category === "override-drift" && finding.location.ownerId) drifted.add(finding.location.ownerId)
  }

  let considered = 0
  for (const node of walkAll(snapshot)) {
    if (node.type === "INSTANCE" && node.instance) considered += 1
  }

  return {
    overrideRate: considered === 0 ? 0 : round(drifted.size / considered),
    instancesConsidered: considered,
    instancesDrifted: drifted.size,
    tokenCoverage: paintCoverage(snapshot),
  }
}

// Four places is enough to read and few enough that the value survives a JSON
// round trip unchanged, which the evidence validator depends on.
const round = (value: number): number => Math.round(value * 10000) / 10000
