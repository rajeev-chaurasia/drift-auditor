import { OverrideDriftDetector } from "../detect/override-drift.ts"
import { TokenDriftDetector } from "../detect/token-drift.ts"
import type { Detector } from "../detect/detector.ts"
import type { Category } from "../model/finding.ts"
import type { DocumentSnapshot } from "../model/snapshot.ts"
import { WEIGHT_MODEL_VERSION } from "../score/weights.ts"
import { BluntControlDetector, BluntTokenControlDetector } from "./blunt-control.ts"
import { expectedFindingIds, type LabelSet } from "./labels.ts"
import { scoreAgainstLabels, type AccuracyResult } from "./score.ts"

interface Pairing {
  readonly category: Category
  readonly detector: Detector
  readonly control: Detector
}

/**
 * Each detector next to the naive implementation it has to beat.
 *
 * Pairing them here rather than in the script means the control can never be
 * quietly dropped from a run: there is one list, and the evidence is generated
 * from it.
 */
const PAIRINGS: readonly Pairing[] = [
  {
    category: "override-drift",
    detector: new OverrideDriftDetector(),
    control: new BluntControlDetector(),
  },
  {
    category: "token-drift",
    detector: new TokenDriftDetector(),
    control: new BluntTokenControlDetector(),
  },
]

export interface FixtureInput {
  readonly name: string
  readonly snapshotSha256: string
  readonly snapshot: DocumentSnapshot
  readonly labels: LabelSet
}

export interface FixtureResult {
  readonly name: string
  readonly snapshotSha256: string
  readonly split: LabelSet["split"]
  readonly labelledCases: number
  readonly results: readonly AccuracyResult[]
}

export interface EvidenceArtifact {
  readonly weightModelVersion: number
  readonly fixtures: readonly FixtureResult[]
}

export function evaluateFixture(input: FixtureInput): FixtureResult {
  const results = PAIRINGS.flatMap(({ category, detector, control }) => {
    const expected = expectedFindingIds(input.snapshot, input.labels, [category])
    return [
      scoreAgainstLabels(detector.category, detector.detect(input.snapshot), expected, [category]),
      scoreAgainstLabels(`blunt:${category}`, control.detect(input.snapshot), expected, [category]),
    ]
  })

  return {
    name: input.name,
    snapshotSha256: input.snapshotSha256,
    split: input.labels.split,
    labelledCases: input.labels.cases.length,
    results,
  }
}

export function buildArtifact(inputs: readonly FixtureInput[]): EvidenceArtifact {
  return {
    weightModelVersion: WEIGHT_MODEL_VERSION,
    fixtures: [...inputs].sort((a, b) => (a.name < b.name ? -1 : 1)).map(evaluateFixture),
  }
}

/**
 * The invariants the published numbers have to satisfy. Returns every problem
 * rather than the first, because a run that fails three ways should say so.
 */
export function checkInvariants(artifact: EvidenceArtifact): string[] {
  const problems: string[] = []

  for (const fixture of artifact.fixtures) {
    for (const { category, detector } of PAIRINGS) {
      const real = fixture.results.find((result) => result.detector === detector.category)
      const control = fixture.results.find((result) => result.detector === `blunt:${category}`)

      if (!real || !control) {
        problems.push(`${fixture.name}: ${category} was not evaluated against its control`)
        continue
      }

      if (real.matrix.recall !== 1) {
        problems.push(`${fixture.name}: ${category} recall is ${real.matrix.recall}, missed ${real.missed.join(", ")}`)
      }
      if (real.matrix.precision !== 1) {
        problems.push(
          `${fixture.name}: ${category} precision is ${real.matrix.precision}, reported ${real.spurious.join(", ")}`,
        )
      }

      // The point of the control. If it ever keeps up, the fixture has stopped
      // telling a real detector from a naive one, and the numbers above mean
      // nothing.
      const beaten = control.matrix.precision < real.matrix.precision || control.matrix.recall < real.matrix.recall
      if (!beaten) {
        problems.push(
          `${fixture.name}: the blunt control matched ${category} ` +
            `(precision ${control.matrix.precision}, recall ${control.matrix.recall}). ` +
            `The fixture no longer discriminates, so its accuracy number is worthless.`,
        )
      }
    }
  }

  return problems
}
