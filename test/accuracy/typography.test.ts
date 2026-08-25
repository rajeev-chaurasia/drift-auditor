import { describe, expect, it } from "vitest"
import { BluntTypographyControlDetector } from "../../src/core/accuracy/blunt-typography-control.ts"
import { expectedFindingIds } from "../../src/core/accuracy/labels.ts"
import { scoreAgainstLabels } from "../../src/core/accuracy/score.ts"
import type { Detector } from "../../src/core/detect/detector.ts"
import { TypographyDriftDetector } from "../../src/core/detect/typography-drift.ts"
import { typographyLabels, typographySnapshot } from "../support/typography-fixture.ts"

const expected = expectedFindingIds(typographySnapshot, typographyLabels, ["typography-drift"])

const score = (name: string, detector: Detector) =>
  scoreAgainstLabels(
    name,
    detector.detect(typographySnapshot),
    expected,
    ["typography-drift"],
  )

// The order matters. A gate that has never rejected anything is not a gate, so
// the control is asserted to fail before the detector is asserted to pass.
describe("the blunt typography control, which must fail", () => {
  const result = score("blunt-typography-control", new BluntTypographyControlDetector())

  it("reports things nobody labelled", () => {
    expect(result.matrix.falsePositives).toBeGreaterThan(0)
    expect(result.matrix.precision).toBeLessThan(1)
  })

  it("reports a layer whose typography is fully bound to variables", () => {
    expect(result.spurious).toContain("typography-drift|all-bound-text|typography")
  })

  it("reports a layer with mixed typography", () => {
    expect(result.spurious).toContain("typography-drift|mixed-text|typography")
  })

  it("charges a component's untokenised typography to each of its instances", () => {
    expect(result.spurious).toContain("typography-drift|badge-1-label|typography")
    expect(result.spurious).toContain("typography-drift|badge-2-label|typography")
  })

  // It looks only at whether a style id is set, never at whether that id
  // resolves to anything, so a dangling reference reads as compliant to it.
  it("misses a layer whose text style does not exist", () => {
    expect(result.missed).toContain("typography-drift|orphan-style-text|typography")
  })
})

describe("the typography detector, against the same labels", () => {
  const result = score("typography-drift", new TypographyDriftDetector())

  it("finds every labelled case", () => {
    expect(result.missed).toEqual([])
    expect(result.matrix.recall).toBe(1)
  })

  it("reports nothing that was not labelled", () => {
    expect(result.spurious).toEqual([])
    expect(result.matrix.precision).toBe(1)
  })

  it("charges a component's typography once, with the reach it actually has", () => {
    const findings = new TypographyDriftDetector().detect(typographySnapshot)
    const badgeLabel = findings.find((finding) => finding.subjectId === "badge-label")
    expect(badgeLabel?.blastRadius).toBe(2)
  })

  it("beats the control on the same fixture", () => {
    const blunt = score("blunt-typography-control", new BluntTypographyControlDetector())
    expect(result.matrix.precision).toBeGreaterThan(blunt.matrix.precision)
    expect(result.matrix.recall).toBeGreaterThan(blunt.matrix.recall)
  })
})
