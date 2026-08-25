import { describe, expect, it } from "vitest"
import { toCsv } from "../../src/core/report/csv.ts"
import type { Finding } from "../../src/core/model/finding.ts"
import { severity } from "../../src/core/score/score.ts"

const finding = (over: Partial<Finding> = {}): Finding => ({
  id: "token-drift|n|fills[0]",
  category: "token-drift",
  confidence: "exact",
  fieldClass: "colour",
  field: "fills",
  subjectId: "n",
  subjectName: "Badge",
  location: { pageId: "p", pageName: "Product", path: "Card / Badge", ownerId: null, ownerName: null },
  expected: "a bound variable or a published style",
  actual: "#FF3B30",
  baselineAvailable: true,
  blastRadius: 4,
  ...over,
})

const rows = (csv: string) => csv.trimEnd().split("\n")

describe("toCsv", () => {
  it("writes a header even when there is nothing to report", () => {
    expect(rows(toCsv([]))).toHaveLength(1)
    expect(toCsv([]).startsWith("id,category")).toBe(true)
  })

  it("writes one row per finding, and carries the severity the model gives it", () => {
    const lines = rows(toCsv([finding()]))
    expect(lines).toHaveLength(2)

    const header = lines[0]!.split(",")
    const cells = lines[1]!.split(",")
    expect(cells[header.indexOf("actual")]).toBe("#FF3B30")
    expect(cells[header.indexOf("blastRadius")]).toBe("4")
    // colour weight 3, times the reach factor for four instances, which is 3.
    expect(cells[header.indexOf("severity")]).toBe(String(severity(finding())))
    expect(Number(cells[header.indexOf("severity")])).toBe(9)
  })

  it("quotes a layer name holding a comma, so the columns do not shift", () => {
    const csv = toCsv([finding({ subjectName: "Badge, small" })])
    expect(csv).toContain('"Badge, small"')
    expect(rows(csv)).toHaveLength(2)
  })

  it("doubles a quote inside a value rather than ending the field", () => {
    expect(toCsv([finding({ subjectName: 'The "hero"' })])).toContain('"The ""hero"""')
  })

  it("keeps a newline inside a value inside its quotes", () => {
    const csv = toCsv([finding({ actual: "line one\nline two" })])
    expect(csv).toContain('"line one\nline two"')
  })

  it("writes an empty cell for a missing value rather than the word null", () => {
    expect(toCsv([finding({ expected: null })])).not.toContain("null")
  })
})
