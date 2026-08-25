import { describe, expect, it } from "vitest"
import { TypographyDriftDetector } from "../../src/core/detect/typography-drift.ts"
import type { Typography, VariableRecord } from "../../src/core/model/snapshot.ts"
import { buildSnapshot, type NodeSpec } from "../support/build-snapshot.ts"
import { instanceInfo } from "../support/instances.ts"

const detector = new TypographyDriftDetector()

const fontVar: VariableRecord = {
  id: "V:1",
  key: "vk-size",
  name: "type/size",
  resolvedType: "FLOAT",
  collectionId: "C:1",
  remote: true,
}

const page = (children: readonly NodeSpec[]) =>
  buildSnapshot({
    pages: [{ id: "page", type: "PAGE", name: "Product", children }],
    variables: [fontVar],
    styles: [
      { id: "S:pub", key: "k1", name: "Typography/Body", type: "TEXT", remote: true },
      { id: "S:loc", key: "k2", name: "Scratch/Small", type: "TEXT", remote: false },
    ],
  })

describe("TypographyDriftDetector", () => {
  it("flags typography typed in by hand", () => {
    const findings = detector.detect(
      page([
        {
          id: "label",
          type: "TEXT",
          props: { typography: { fontFamily: "Inter", fontStyle: "Regular", fontSize: 14, lineHeight: "20px" } },
        },
      ]),
    )
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      category: "typography-drift",
      field: "typography",
      actual: "Inter Regular 14px/20px",
      subjectId: "label",
      blastRadius: 1,
    })
    expect(findings[0]?.note).toBeUndefined()
  })

  it("says nothing when the layer points at a published style", () => {
    const snapshot = page([
      {
        id: "label",
        type: "TEXT",
        props: { typography: { fontFamily: "Inter", fontSize: 14 }, styles: { text: "S:pub" } },
      },
    ])
    expect(detector.detect(snapshot)).toEqual([])
  })

  // Requiring the style to be published reported 10,466 correct text layers on
  // a real file, for the single reason that the file was not itself a library.
  it("says nothing when the layer points at a local style, which is still a decision to follow something", () => {
    const snapshot = page([
      {
        id: "label",
        type: "TEXT",
        props: { typography: { fontFamily: "Inter", fontSize: 14 }, styles: { text: "S:loc" } },
      },
    ])
    expect(detector.detect(snapshot)).toEqual([])
  })

  it("still flags a text style id that resolves to nothing", () => {
    const snapshot = page([
      {
        id: "label",
        type: "TEXT",
        props: { typography: { fontFamily: "Inter", fontSize: 14 }, styles: { text: "S:gone" } },
      },
    ])
    expect(detector.detect(snapshot)).toHaveLength(1)
  })

  it("says nothing when every typography property is bound to a variable", () => {
    const snapshot = page([
      {
        id: "label",
        type: "TEXT",
        props: {
          typography: { fontSize: 14 },
          boundVariables: { fontSize: "V:1" },
        },
      },
    ])
    expect(detector.detect(snapshot)).toEqual([])
  })

  it("flags when only some properties are bound, listing loose ones in note", () => {
    const findings = detector.detect(
      page([
        {
          id: "label",
          type: "TEXT",
          props: {
            typography: { fontFamily: "Inter", fontSize: 14 },
            boundVariables: { fontSize: "V:1" },
          },
        },
      ]),
    )
    expect(findings).toHaveLength(1)
    expect(findings[0]?.note).toBe("unbound: fontFamily")
  })

  it("skips a text layer with no typography props", () => {
    const snapshot = page([{ id: "label", type: "TEXT", props: {} }])
    expect(detector.detect(snapshot)).toEqual([])
  })

  it("skips a text layer with mixed values", () => {
    const snapshot = page([
      {
        id: "label",
        type: "TEXT",
        props: { typography: { fontFamily: "Inter", fontSize: "mixed" } },
      },
    ])
    expect(detector.detect(snapshot)).toEqual([])
  })
})

describe("attribution to the component", () => {
  const withInstances = (instanceTypo: Typography) =>
    page([
      {
        id: "main",
        type: "COMPONENT",
        name: "Card",
        componentKey: "k-card",
        children: [
          {
            id: "main-label",
            type: "TEXT",
            name: "Title",
            props: { typography: { fontFamily: "Inter", fontSize: 14 } },
          },
        ],
      },
      {
        id: "use-1",
        type: "INSTANCE",
        name: "Card",
        instance: instanceInfo("main", []),
        children: [
          {
            id: "use-1-label",
            type: "TEXT",
            name: "Title",
            props: { typography: instanceTypo },
          },
        ],
      },
      {
        id: "use-2",
        type: "INSTANCE",
        name: "Card",
        instance: instanceInfo("main", []),
        children: [
          {
            id: "use-2-label",
            type: "TEXT",
            name: "Title",
            props: { typography: instanceTypo },
          },
        ],
      },
    ])

  it("reports a component's untokenised typography once, not once per instance", () => {
    const findings = detector.detect(withInstances({ fontFamily: "Inter", fontSize: 14 }))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.subjectId).toBe("main-label")
  })

  it("carries how many instances the component reaches", () => {
    expect(detector.detect(withInstances({ fontFamily: "Inter", fontSize: 14 }))[0]?.blastRadius).toBe(2)
  })

  it("still reports an instance that changed its typography away from the component", () => {
    const findings = detector.detect(withInstances({ fontFamily: "Inter", fontSize: 20 }))
    expect(findings.map((finding) => finding.subjectId).sort()).toEqual(["main-label", "use-1-label", "use-2-label"])
    expect(findings.filter((finding) => finding.subjectId === "use-1-label")[0]?.blastRadius).toBe(1)
  })

  it("names the component a finding sits inside", () => {
    const snapshot = page([
      {
        id: "main",
        type: "COMPONENT",
        name: "Card",
        componentKey: "k-card",
        children: [{ id: "inner-text", type: "TEXT", name: "Title", props: { typography: { fontSize: 16 } } }],
      },
    ])
    expect(detector.detect(snapshot)[0]?.location.ownerId).toBe("main")
  })
})
