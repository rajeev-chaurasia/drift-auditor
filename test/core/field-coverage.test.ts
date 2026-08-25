import { describe, expect, it } from "vitest"
import {
  classifyField,
  extractNodeChangeProperties,
  REPORTED_WITHOUT_VALUE,
} from "../../script/check-field-coverage.ts"
import { IGNORED_FIELDS, isModelled, normaliseField } from "../../src/core/detect/fields.ts"

describe("field coverage classification", () => {
  const fields = extractNodeChangeProperties()

  it("extracts non-empty list of fields from plugin typings", () => {
    expect(fields.length).toBeGreaterThan(100)
  })

  it("classifies every single NodeChangeProperty into an explicit bucket", () => {
    const unclassified = fields.filter((field) => classifyField(field) === "unclassified")
    expect(unclassified).toEqual([])
  })

  it("flags an unknown field as unclassified", () => {
    expect(classifyField("nonExistentField123")).toBe("unclassified")
  })

  it("correctly identifies modelled fields", () => {
    expect(classifyField("fills")).toBe("modelled")
    expect(classifyField("fontSize")).toBe("modelled")
    expect(classifyField("width")).toBe("modelled")
    expect(classifyField("topLeftRadius")).toBe("modelled")
  })

  it("correctly identifies ignored fields", () => {
    expect(classifyField("name")).toBe("ignored")
    expect(classifyField("x")).toBe("ignored")
    expect(classifyField("y")).toBe("ignored")
    expect(classifyField("locked")).toBe("ignored")
    expect(classifyField("componentProperties")).toBe("ignored")
  })

  it("provides an explicit reason for every unmodelled reported field", () => {
    for (const [field, reason] of REPORTED_WITHOUT_VALUE.entries()) {
      expect(typeof reason).toBe("string")
      expect(reason.trim().length).toBeGreaterThan(10)
      expect(IGNORED_FIELDS.has(field)).toBe(false)
      expect(isModelled(normaliseField(field))).toBe(false)
    }
  })
})
