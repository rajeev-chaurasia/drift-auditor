import { describe, expect, it } from "vitest"
import { BluntControlDetector } from "../../src/core/accuracy/blunt-control.ts"
import { expectedFindingIds, LabelError, parseLabels } from "../../src/core/accuracy/labels.ts"
import { scoreAgainstLabels } from "../../src/core/accuracy/score.ts"
import type { Detector } from "../../src/core/detect/detector.ts"
import { OverrideDriftDetector } from "../../src/core/detect/override-drift.ts"
import { driftLabels, driftSnapshot } from "../support/drift-fixture.ts"

const expected = expectedFindingIds(driftSnapshot, driftLabels)

const score = (name: string, detector: Detector) =>
  scoreAgainstLabels(name, detector.detect(driftSnapshot), expected, ["override-drift"])

describe("the labels themselves", () => {
  it("resolve to a layer that exists, every one of them", () => {
    expect(expected.size).toBe(driftLabels.cases.length)
  })

  it("refuse to resolve when a label points at nothing", () => {
    expect(() =>
      expectedFindingIds(driftSnapshot, {
        ...driftLabels,
        cases: [{ ...driftLabels.cases[0]!, path: "Button ghost" }],
      }),
    ).toThrow(/no layer at/)
  })

  it("refuse a label set that is not shaped like one", () => {
    expect(() => parseLabels({ snapshot: "x", split: "guess", cases: [] })).toThrow(LabelError)
    expect(() => parseLabels({ snapshot: "x", split: "tuning", cases: [{ page: "p" }] })).toThrow(/missing path/)
  })
})

// The order matters. A gate that has never rejected anything is not a gate, so
// the control is asserted to fail before the detector is asserted to pass.
describe("the blunt control, which must fail", () => {
  const result = score("blunt-control", new BluntControlDetector())

  it("reports things nobody labelled", () => {
    expect(result.matrix.falsePositives).toBeGreaterThan(0)
    expect(result.matrix.precision).toBeLessThan(1)
  })

  it("calls a layer identical to its component drifted", () => {
    expect(result.spurious).toContain("override-drift|reverted-label|characters")
  })

  it("calls a component property that was set correctly a defect", () => {
    expect(result.spurious).toContain("override-drift|configured-label|characters")
  })

  it("reports editor state that no audit acts on", () => {
    expect(result.spurious).toContain("override-drift|reverted-icon|locked")
  })

  it("misses a real case, because it never groups the four corner fields", () => {
    expect(result.missed).toContain("override-drift|drifted|cornerRadius")
    expect(result.matrix.recall).toBeLessThan(1)
  })
})

describe("the override detector, against the same labels", () => {
  const result = score("override-drift", new OverrideDriftDetector())

  it("finds every labelled case", () => {
    expect(result.missed).toEqual([])
    expect(result.matrix.recall).toBe(1)
  })

  it("reports nothing that was not labelled", () => {
    expect(result.spurious).toEqual([])
    expect(result.matrix.precision).toBe(1)
  })

  it("beats the control on the same fixture, which is what makes the fixture worth using", () => {
    const blunt = score("blunt-control", new BluntControlDetector())
    expect(result.matrix.precision).toBeGreaterThan(blunt.matrix.precision)
    expect(result.matrix.recall).toBeGreaterThan(blunt.matrix.recall)
  })
})
