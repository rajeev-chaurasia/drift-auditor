import { describe, expect, it } from "vitest"
import { describePaint, paintListsEqual, paintsEqual, toHex } from "../../src/core/util/paint.ts"
import type { PaintRef } from "../../src/core/model/snapshot.ts"

const solid = (hex: string, opacity = 1): PaintRef => ({
  kind: "solid",
  hex,
  opacity,
  visible: true,
  variableId: null,
})

describe("toHex", () => {
  it("converts Figma's zero to one channels", () => {
    expect(toHex({ r: 0, g: 0, b: 0 })).toBe("#000000")
    expect(toHex({ r: 1, g: 1, b: 1 })).toBe("#FFFFFF")
    expect(toHex({ r: 0.2, g: 0.4, b: 0.6 })).toBe("#336699")
  })

  it("clamps values outside the range rather than producing nonsense", () => {
    expect(toHex({ r: -1, g: 2, b: 0.5 })).toBe("#00FF80")
  })
})

describe("paintsEqual", () => {
  it("ignores float noise that a JSON round trip introduces", () => {
    expect(paintsEqual(solid("#FF0000", 0.5), solid("#FF0000", 0.50001))).toBe(true)
  })

  it("separates colours a person would call different", () => {
    expect(paintsEqual(solid("#FF0000"), solid("#FF0001"))).toBe(false)
    expect(paintsEqual(solid("#FF0000", 1), solid("#FF0000", 0.5))).toBe(false)
  })

  it("treats a hidden paint as different from a shown one", () => {
    expect(paintsEqual(solid("#FF0000"), { ...solid("#FF0000"), visible: false })).toBe(false)
  })

  it("compares gradients by their serialised stops", () => {
    const a: PaintRef = { kind: "gradient", gradient: "LINEAR #FFF #000", visible: true }
    const b: PaintRef = { kind: "gradient", gradient: "LINEAR #FFF #111", visible: true }
    expect(paintsEqual(a, a)).toBe(true)
    expect(paintsEqual(a, b)).toBe(false)
  })
})

describe("paintListsEqual", () => {
  it("is order sensitive, because stacking order is visible", () => {
    expect(paintListsEqual([solid("#FFF"), solid("#000")], [solid("#000"), solid("#FFF")])).toBe(false)
    expect(paintListsEqual([solid("#FFF")], [solid("#FFF")])).toBe(true)
    expect(paintListsEqual([], [])).toBe(true)
  })
})

describe("describePaint", () => {
  it("mentions opacity only when it is not full", () => {
    expect(describePaint(solid("#FF0000"))).toBe("#FF0000")
    expect(describePaint(solid("#FF0000", 0.5))).toBe("#FF0000 at 50%")
  })
})
