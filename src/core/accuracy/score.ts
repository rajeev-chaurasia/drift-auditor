import type { Category, Finding } from "../model/finding.ts"

export interface ConfusionMatrix {
  readonly truePositives: number
  readonly falsePositives: number
  readonly falseNegatives: number
  readonly precision: number
  readonly recall: number
}

export interface AccuracyResult {
  readonly detector: string
  readonly categories: readonly Category[]
  readonly matrix: ConfusionMatrix
  /** Labelled cases nothing reported. These are the misses that matter. */
  readonly missed: readonly string[]
  /** Reported findings nothing labelled. */
  readonly spurious: readonly string[]
}

/**
 * A detector's findings against the cases somebody put in the file on purpose.
 *
 * Only the labelled categories are scored. Running a token detector against a
 * label set that describes override drift would count every correct token
 * finding as a false positive, which is a property of the comparison rather
 * than of the detector.
 */
export function scoreAgainstLabels(
  detector: string,
  findings: readonly Finding[],
  expected: ReadonlySet<string>,
  categories: readonly Category[],
): AccuracyResult {
  const scope = new Set(categories)
  const reported = new Set(findings.filter((finding) => scope.has(finding.category)).map((finding) => finding.id))

  const missed = [...expected].filter((id) => !reported.has(id)).sort()
  const spurious = [...reported].filter((id) => !expected.has(id)).sort()
  const truePositives = reported.size - spurious.length

  return {
    detector,
    categories,
    matrix: {
      truePositives,
      falsePositives: spurious.length,
      falseNegatives: missed.length,
      // An empty result against an empty label set is perfect rather than
      // undefined, so a fixture with no cases in a category does not fail.
      precision: reported.size === 0 ? 1 : ratio(truePositives, reported.size),
      recall: expected.size === 0 ? 1 : ratio(truePositives, expected.size),
    },
    missed,
    spurious,
  }
}

const ratio = (part: number, whole: number): number => Math.round((part / whole) * 10000) / 10000
