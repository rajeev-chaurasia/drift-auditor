import { describe, expect, it } from "vitest"
import { OverrideDriftDetector } from "../../src/core/detect/override-drift.ts"
import { buildSnapshot, type NodeSpec } from "../support/build-snapshot.ts"
import { instanceInfo, solidFill } from "../support/instances.ts"

const detector = new OverrideDriftDetector()

/** A component with one text child, and an instance of it, side by side. */
function pair(options: {
  componentChild: NodeSpec
  instanceChild: NodeSpec
  overrides: ReadonlyArray<{ nodeId: string; fields: string[] }>
  instanceProps?: NodeSpec["props"]
}) {
  return buildSnapshot({
    pages: [
      {
        id: "page",
        type: "PAGE",
        children: [
          {
            id: "main",
            type: "COMPONENT",
            componentKey: "k-main",
            props: { fills: solidFill("#000000") },
            children: [options.componentChild],
          },
          {
            id: "use",
            type: "INSTANCE",
            props: options.instanceProps ?? { fills: solidFill("#000000") },
            instance: instanceInfo("main", options.overrides),
            children: [options.instanceChild],
          },
        ],
      },
    ],
    components: [{ key: "k-main", name: "Button", remote: false, nodeId: "main" }],
  })
}

describe("OverrideDriftDetector", () => {
  it("reports what a field was and what it became", () => {
    const snapshot = pair({
      componentChild: { id: "main-label", type: "TEXT", props: { characters: "Submit" } },
      instanceChild: { id: "use-label", type: "TEXT", props: { characters: "Send" } },
      overrides: [{ nodeId: "use-label", fields: ["characters"] }],
    })

    const findings = detector.detect(snapshot)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      field: "characters",
      fieldClass: "content",
      confidence: "exact",
      expected: "Submit",
      actual: "Send",
      baselineAvailable: true,
      subjectId: "use-label",
    })
    expect(findings[0]?.location.componentName).toBe("Button")
  })

  it("diffs a colour by its normalised value", () => {
    const snapshot = pair({
      componentChild: { id: "main-chip", type: "RECTANGLE", props: { fills: solidFill("#0D99FF") } },
      instanceChild: { id: "use-chip", type: "RECTANGLE", props: { fills: solidFill("#FF0000") } },
      overrides: [{ nodeId: "use-chip", fields: ["fills"] }],
    })

    expect(detector.detect(snapshot)[0]).toMatchObject({
      fieldClass: "colour",
      expected: "#0D99FF",
      actual: "#FF0000",
    })
  })

  it("says nothing when an override was set back to the component's value", () => {
    const snapshot = pair({
      componentChild: { id: "main-label", type: "TEXT", props: { characters: "Submit" } },
      instanceChild: { id: "use-label", type: "TEXT", props: { characters: "Submit" } },
      overrides: [{ nodeId: "use-label", fields: ["characters"] }],
    })

    expect(detector.detect(snapshot)).toEqual([])
  })

  it("says nothing when a component property drives the field", () => {
    const snapshot = pair({
      componentChild: { id: "main-label", type: "TEXT", props: { characters: "Submit" } },
      instanceChild: {
        id: "use-label",
        type: "TEXT",
        props: { characters: "Send" },
        componentPropertyReferences: { characters: "Label#1:0" },
      },
      overrides: [{ nodeId: "use-label", fields: ["characters"] }],
    })

    expect(detector.detect(snapshot)).toEqual([])
  })

  it("says nothing about editor state that no audit acts on", () => {
    const snapshot = pair({
      componentChild: { id: "main-label", type: "TEXT", props: { characters: "Submit" } },
      instanceChild: { id: "use-label", type: "TEXT", props: { characters: "Submit" } },
      overrides: [{ nodeId: "use-label", fields: ["locked", "expanded", "x", "y", "componentProperties"] }],
    })

    expect(detector.detect(snapshot)).toEqual([])
  })

  it("collapses the four corner fields into one row", () => {
    const snapshot = pair({
      componentChild: { id: "main-chip", type: "RECTANGLE", props: { cornerRadius: 4 } },
      instanceChild: { id: "use-chip", type: "RECTANGLE", props: { cornerRadius: 12 } },
      overrides: [
        { nodeId: "use-chip", fields: ["topLeftRadius", "topRightRadius", "bottomLeftRadius", "bottomRightRadius"] },
      ],
    })

    const findings = detector.detect(snapshot)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ field: "cornerRadius", expected: "4", actual: "12" })
  })

  it("reports a field it does not model, and says so rather than inventing a diff", () => {
    const snapshot = pair({
      componentChild: { id: "main-chip", type: "RECTANGLE" },
      instanceChild: { id: "use-chip", type: "RECTANGLE" },
      overrides: [{ nodeId: "use-chip", fields: ["effects"] }],
    })

    const findings = detector.detect(snapshot)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ field: "effects", fieldClass: "other", expected: null, actual: null })
    expect(findings[0]?.note).toMatch(/does not model/)
  })

  it("reports an override with no readable baseline, without a before-value", () => {
    const snapshot = buildSnapshot({
      pages: [
        {
          id: "page",
          type: "PAGE",
          children: [
            {
              id: "use",
              type: "INSTANCE",
              instance: instanceInfo(null, [{ nodeId: "use-label", fields: ["characters"] }], "k-library"),
              children: [{ id: "use-label", type: "TEXT", props: { characters: "Send" } }],
            },
          ],
        },
      ],
      components: [{ key: "k-library", name: "Chip", remote: true, nodeId: null }],
    })

    const findings = detector.detect(snapshot)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ expected: null, actual: "Send", baselineAvailable: false })
    expect(findings[0]?.note).toMatch(/no before-value/)
  })

  it("refuses to diff against a layer of a different type at the same position", () => {
    const snapshot = pair({
      componentChild: { id: "main-slot", type: "TEXT", props: { characters: "Submit" } },
      instanceChild: { id: "use-slot", type: "FRAME", props: { characters: "Send" } },
      overrides: [{ nodeId: "use-slot", fields: ["characters"] }],
    })

    const findings = detector.detect(snapshot)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ expected: null, baselineAvailable: false })
  })

  it("reports an override on the instance root itself", () => {
    const snapshot = pair({
      componentChild: { id: "main-label", type: "TEXT" },
      instanceChild: { id: "use-label", type: "TEXT" },
      instanceProps: { fills: solidFill("#FFFFFF") },
      overrides: [{ nodeId: "use", fields: ["fills"] }],
    })

    expect(detector.detect(snapshot)[0]).toMatchObject({
      subjectId: "use",
      expected: "#000000",
      actual: "#FFFFFF",
    })
  })

  it("ignores an override naming a node the snapshot does not hold", () => {
    const snapshot = pair({
      componentChild: { id: "main-label", type: "TEXT" },
      instanceChild: { id: "use-label", type: "TEXT" },
      overrides: [{ nodeId: "ghost", fields: ["characters"] }],
    })

    expect(detector.detect(snapshot)).toEqual([])
  })
})
