import { describe, expect, it } from "vitest"
import { TokenDriftDetector } from "../../src/core/detect/token-drift.ts"
import type { PaintRef, VariableRecord } from "../../src/core/model/snapshot.ts"
import { buildSnapshot, type NodeSpec } from "../support/build-snapshot.ts"
import { instanceInfo, solidFill } from "../support/instances.ts"

const detector = new TokenDriftDetector()

const brand: VariableRecord = {
  id: "V:1",
  key: "vk-brand",
  name: "colour/brand",
  resolvedType: "COLOR",
  collectionId: "C:1",
  remote: true,
}

const bound = (hex: string): PaintRef[] => [
  { kind: "solid", hex, opacity: 1, visible: true, variableId: "V:1" },
]

const page = (children: readonly NodeSpec[]) =>
  buildSnapshot({
    pages: [{ id: "page", type: "PAGE", name: "Product", children }],
    variables: [brand],
    styles: [
      { id: "S:pub", key: "k1", name: "Brand/Primary", type: "PAINT", remote: true },
      { id: "S:loc", key: "k2", name: "Scratch/Blue", type: "PAINT", remote: false },
    ],
  })

describe("TokenDriftDetector", () => {
  it("flags a colour typed in by hand", () => {
    const findings = detector.detect(page([{ id: "box", type: "RECTANGLE", props: { fills: solidFill("#FF3B30") } }]))
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      category: "token-drift",
      field: "fills",
      actual: "#FF3B30",
      subjectId: "box",
      blastRadius: 1,
    })
  })

  it("says nothing when a variable is bound to the paint", () => {
    expect(detector.detect(page([{ id: "box", type: "RECTANGLE", props: { fills: bound("#FF3B30") } }]))).toEqual([])
  })

  it("says nothing when the layer points at a published style", () => {
    const snapshot = page([
      { id: "box", type: "RECTANGLE", props: { fills: solidFill("#FF3B30"), styles: { fill: "S:pub" } } },
    ])
    expect(detector.detect(snapshot)).toEqual([])
  })

  // A local style is the design system of a file that is not itself a library,
  // which most files are not. Requiring the style to be published reported
  // 10,466 correct layers on a real file. See docs/known-misses.md.
  it("says nothing when the layer points at a local style, which is still a decision to follow something", () => {
    const snapshot = page([
      { id: "box", type: "RECTANGLE", props: { fills: solidFill("#FF3B30"), styles: { fill: "S:loc" } } },
    ])
    expect(detector.detect(snapshot)).toEqual([])
  })

  it("still flags a style id that resolves to nothing, which follows nothing at all", () => {
    const snapshot = page([
      { id: "box", type: "RECTANGLE", props: { fills: solidFill("#FF3B30"), styles: { fill: "S:gone" } } },
    ])
    expect(detector.detect(snapshot)).toHaveLength(1)
  })

  it("skips paints no variable can be bound to", () => {
    const snapshot = page([
      {
        id: "hero",
        type: "RECTANGLE",
        props: {
          fills: [
            { kind: "image", visible: true },
            { kind: "gradient", gradient: "GRADIENT_LINEAR #FFF@0.000", visible: true },
          ],
        },
      },
    ])
    expect(detector.detect(snapshot)).toEqual([])
  })

  it("skips a hidden paint, which is not on screen to drift", () => {
    const snapshot = page([
      {
        id: "box",
        type: "RECTANGLE",
        props: { fills: [{ kind: "solid", hex: "#FF3B30", opacity: 1, visible: false, variableId: null }] },
      },
    ])
    expect(detector.detect(snapshot)).toEqual([])
  })

  it("checks strokes as well as fills, and reports them apart", () => {
    const snapshot = page([
      { id: "box", type: "RECTANGLE", props: { fills: solidFill("#FF3B30"), strokes: solidFill("#00FF00") } },
    ])
    const fields = detector.detect(snapshot).map((finding) => finding.field)
    expect(fields.sort()).toEqual(["fills", "strokes"])
  })
})

describe("attribution to the component", () => {
  const withInstances = (instanceFill: PaintRef[]) =>
    page([
      {
        id: "main",
        type: "COMPONENT",
        name: "Chip",
        componentKey: "k-main",
        props: { fills: solidFill("#FF3B30") },
      },
      { id: "use-1", type: "INSTANCE", name: "Chip", props: { fills: instanceFill }, instance: instanceInfo("main", []) },
      { id: "use-2", type: "INSTANCE", name: "Chip", props: { fills: instanceFill }, instance: instanceInfo("main", []) },
    ])

  it("reports a component's hardcoded colour once, not once per instance", () => {
    const findings = detector.detect(withInstances(solidFill("#FF3B30")))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.subjectId).toBe("main")
  })

  it("carries how many instances the component reaches", () => {
    expect(detector.detect(withInstances(solidFill("#FF3B30")))[0]?.blastRadius).toBe(2)
  })

  it("still reports an instance that hardcoded a different colour of its own", () => {
    const findings = detector.detect(withInstances(solidFill("#0000FF")))
    expect(findings.map((finding) => finding.subjectId).sort()).toEqual(["main", "use-1", "use-2"])
    expect(findings.filter((finding) => finding.subjectId === "use-1")[0]?.blastRadius).toBe(1)
  })

  it("names the component a finding sits inside", () => {
    const snapshot = page([
      {
        id: "main",
        type: "COMPONENT",
        name: "Chip",
        componentKey: "k-main",
        children: [{ id: "inner", type: "RECTANGLE", name: "Bg", props: { fills: solidFill("#FF3B30") } }],
      },
    ])
    expect(detector.detect(snapshot)[0]?.location.ownerId).toBe("main")
  })
})
