import { describe, expect, it } from "vitest"
import { buildArtifact, checkInvariants, type EvidenceArtifact } from "../../src/core/accuracy/evidence.ts"
import type { LabelSet } from "../../src/core/accuracy/labels.ts"
import { driftLabels, driftSnapshot } from "../support/drift-fixture.ts"
import { mutableClone } from "../support/clone.ts"

const testLabels: LabelSet = {
  ...driftLabels,
  cases: [
    ...driftLabels.cases,
    {
      page: "Product",
      path: "Button / Label",
      field: "typography",
      category: "typography-drift",
      why: "component typography is unstyled",
    },
    {
      page: "Product",
      path: "Button drifted / Label",
      field: "typography",
      category: "typography-drift",
      why: "instance typography is unstyled and changed",
    },
  ],
}

const artifact = buildArtifact([
  { name: "hand-authored", snapshotSha256: "0".repeat(64), snapshot: driftSnapshot, labels: testLabels },
])

const damaged = (edit: (copy: EvidenceArtifact) => void): EvidenceArtifact => {
  const copy = mutableClone(artifact)
  edit(copy as unknown as EvidenceArtifact)
  return copy as unknown as EvidenceArtifact
}

const resultFor = (copy: EvidenceArtifact, detector: string) =>
  copy.fixtures[0]!.results.find((result) => result.detector === detector)!

describe("buildArtifact", () => {
  it("scores every detector next to the control it has to beat", () => {
    expect(artifact.fixtures[0]?.results.map((result) => result.detector).sort()).toEqual([
      "blunt:override-drift",
      "blunt:token-drift",
      "blunt:typography-drift",
      "override-drift",
      "token-drift",
      "typography-drift",
    ])
  })

  it("produces byte identical output on a second run", () => {
    const again = buildArtifact([
      { name: "hand-authored", snapshotSha256: "0".repeat(64), snapshot: driftSnapshot, labels: testLabels },
    ])
    expect(JSON.stringify(again)).toBe(JSON.stringify(artifact))
  })

  it("stamps the weight model, so a score cannot be compared across weight changes by accident", () => {
    expect(artifact.weightModelVersion).toBeGreaterThan(0)
  })
})

describe("checkInvariants", () => {
  it("passes a run where both detectors are perfect and both controls are not", () => {
    expect(checkInvariants(artifact)).toEqual([])
  })

  it("fails a run where a detector missed a labelled case", () => {
    const problems = checkInvariants(
      damaged((copy) => {
        const result = resultFor(copy, "override-drift")
        ;(result.matrix as { recall: number }).recall = 0.9
      }),
    )
    expect(problems.join(" ")).toMatch(/override-drift recall is 0.9/)
  })

  it("fails a run where a detector reported something nobody labelled", () => {
    const problems = checkInvariants(
      damaged((copy) => {
        const result = resultFor(copy, "token-drift")
        ;(result.matrix as { precision: number }).precision = 0.8
      }),
    )
    expect(problems.join(" ")).toMatch(/token-drift precision is 0.8/)
  })

  // The reason the control exists at all.
  it("fails a run where the blunt control kept up, because the fixture stopped discriminating", () => {
    const problems = checkInvariants(
      damaged((copy) => {
        const control = resultFor(copy, "blunt:override-drift")
        ;(control.matrix as { precision: number; recall: number }).precision = 1
        ;(control.matrix as { precision: number; recall: number }).recall = 1
      }),
    )
    expect(problems.join(" ")).toMatch(/no longer discriminates/)
  })

  it("fails a run where a category was never evaluated against its control", () => {
    const stripped = mutableClone(artifact)
    stripped.fixtures[0]!.results = stripped.fixtures[0]!.results.filter(
      (result) => result.detector !== "blunt:token-drift",
    )
    expect(checkInvariants(stripped as unknown as EvidenceArtifact).join(" ")).toMatch(
      /not evaluated against its control/,
    )
  })
})
