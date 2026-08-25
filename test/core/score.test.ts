import { describe, expect, it } from "vitest"
import type { Finding } from "../../src/core/model/finding.ts"
import { scoreFindings, severity } from "../../src/core/score/score.ts"
import { blastRadiusFactor, FIELD_CLASS_WEIGHTS } from "../../src/core/score/weights.ts"

const finding = (over: Partial<Finding> = {}): Finding => ({
  id: "override-drift|n|fills",
  category: "override-drift",
  confidence: "exact",
  fieldClass: "colour",
  field: "fills",
  subjectId: "n",
  subjectName: "n",
  location: { pageId: "p", pageName: "Page", path: "n", ownerId: null, ownerName: null },
  expected: "#000000",
  actual: "#FFFFFF",
  baselineAvailable: true,
  blastRadius: 1,
  ...over,
})

describe("severity", () => {
  it("is the field class weight when nothing else is in play", () => {
    expect(severity(finding())).toBe(FIELD_CLASS_WEIGHTS.colour)
  })

  it("ranks a systemic class above copy", () => {
    expect(severity(finding({ fieldClass: "colour" }))).toBeGreaterThan(severity(finding({ fieldClass: "content" })))
  })

  it("grows with reach, but far more slowly than reach does", () => {
    const once = severity(finding({ blastRadius: 1 }))
    const many = severity(finding({ blastRadius: 64 }))
    expect(many).toBeGreaterThan(once)
    expect(many).toBeLessThan(once * 64)
    expect(many).toBe(Math.round(once * blastRadiusFactor(64) * 100) / 100)
  })

  it("treats a reach below one as one rather than going negative", () => {
    expect(severity(finding({ blastRadius: 0 }))).toBe(severity(finding({ blastRadius: 1 })))
  })

  it("is zero for anything inferred, so a guess cannot move an exact number", () => {
    expect(severity(finding({ confidence: "candidate", category: "detachment" }))).toBe(0)
  })
})

describe("scoreFindings", () => {
  it("totals the findings and splits them by category", () => {
    const score = scoreFindings([
      finding(),
      finding({ id: "b", category: "token-drift", fieldClass: "colour" }),
      finding({ id: "c", fieldClass: "content" }),
    ])
    expect(score.byCategory["override-drift"]).toBe(FIELD_CLASS_WEIGHTS.colour + FIELD_CLASS_WEIGHTS.content)
    expect(score.byCategory["token-drift"]).toBe(FIELD_CLASS_WEIGHTS.colour)
    expect(score.total).toBe(score.byCategory["override-drift"]! + score.byCategory["token-drift"]!)
  })

  it("counts candidates aside rather than folding them into the total", () => {
    const score = scoreFindings([finding(), finding({ id: "d", confidence: "candidate", category: "detachment" })])
    expect(score.excludedCandidates).toBe(1)
    expect(score.total).toBe(FIELD_CLASS_WEIGHTS.colour)
  })

  it("scores an empty file as zero", () => {
    expect(scoreFindings([]).total).toBe(0)
  })

  it("survives a JSON round trip without a total moving", () => {
    const score = scoreFindings([finding({ blastRadius: 7 }), finding({ id: "e", blastRadius: 3 })])
    expect(JSON.parse(JSON.stringify(score))).toEqual(score)
  })

  it("stamps the model version, so a score can be told apart from one under different weights", () => {
    expect(scoreFindings([]).modelVersion).toBeGreaterThan(0)
  })
})
