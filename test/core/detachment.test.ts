import { describe, expect, it } from "vitest"
import { CANDIDATE_THRESHOLD, DetachmentDetector } from "../../src/core/detect/detachment.ts"
import { buildSnapshot, type NodeSpec } from "../support/build-snapshot.ts"
import { instanceInfo } from "../support/instances.ts"

const detector = new DetachmentDetector()

const card = (id: string, type: NodeSpec["type"], name: string, extra: Partial<NodeSpec> = {}): NodeSpec => ({
  id,
  type,
  name,
  props: { width: 200, height: 80 },
  children: [
    { id: `${id}-icon`, type: "VECTOR", name: "Icon" },
    { id: `${id}-label`, type: "TEXT", name: "Label" },
  ],
  ...extra,
})

const withPage = (children: readonly NodeSpec[]) =>
  buildSnapshot({
    pages: [{ id: "page", type: "PAGE", name: "Product", children }],
    components: [{ key: "k-card", name: "Card", remote: false, nodeId: "main" }],
  })

describe("DetachmentDetector", () => {
  it("flags a frame that clones a component's structure and keeps its name", () => {
    const findings = detector.detect(
      withPage([card("main", "COMPONENT", "Card", { componentKey: "k-card" }), card("loose", "FRAME", "Card")]),
    )

    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      category: "detachment",
      confidence: "candidate",
      subjectId: "loose",
      expected: "an instance of Card",
    })
  })

  it("never claims certainty, because the platform records nothing to be certain about", () => {
    const findings = detector.detect(
      withPage([card("main", "COMPONENT", "Card", { componentKey: "k-card" }), card("loose", "FRAME", "Card")]),
    )
    expect(findings[0]?.confidence).toBe("candidate")
    expect(findings[0]?.note).toMatch(/can be wrong/)
  })

  it("says nothing about a frame that shares a name and nothing else", () => {
    const unrelated: NodeSpec = {
      id: "loose",
      type: "FRAME",
      name: "Card",
      props: { width: 900, height: 900 },
      children: [
        { id: "a", type: "FRAME", name: "a", children: [{ id: "b", type: "FRAME", name: "b" }] },
        { id: "c", type: "RECTANGLE", name: "c" },
        { id: "d", type: "ELLIPSE", name: "d" },
      ],
    }
    expect(detector.detect(withPage([card("main", "COMPONENT", "Card", { componentKey: "k-card" }), unrelated]))).toEqual(
      [],
    )
  })

  it("says nothing about a real instance, which has not been detached at all", () => {
    const snapshot = withPage([
      card("main", "COMPONENT", "Card", { componentKey: "k-card" }),
      card("use", "INSTANCE", "Card", { instance: instanceInfo("main", [], "k-card") }),
    ])
    expect(detector.detect(snapshot)).toEqual([])
  })

  it("says nothing about the layers inside an instance, which mirror the component by construction", () => {
    const snapshot = withPage([
      card("main", "COMPONENT", "Card", { componentKey: "k-card" }),
      {
        id: "use",
        type: "INSTANCE",
        name: "Card",
        instance: instanceInfo("main", [], "k-card"),
        children: [card("use-inner", "FRAME", "Card")],
      },
    ])
    expect(detector.detect(snapshot)).toEqual([])
  })

  it("ignores a frame too small to be evidence of anything", () => {
    const tiny: NodeSpec = { id: "loose", type: "FRAME", name: "Card", props: { width: 200, height: 80 } }
    expect(detector.detect(withPage([card("main", "COMPONENT", "Card", { componentKey: "k-card" }), tiny]))).toEqual([])
  })

  it("does not match a component against a frame it lives inside", () => {
    const snapshot = withPage([
      {
        id: "loose",
        type: "FRAME",
        name: "Card",
        props: { width: 200, height: 80 },
        children: [card("main", "COMPONENT", "Card", { componentKey: "k-card" })],
      },
    ])
    expect(detector.detect(snapshot)).toEqual([])
  })

  it("says nothing when the file holds no components to compare against", () => {
    expect(detector.detect(withPage([card("loose", "FRAME", "Card")]))).toEqual([])
  })

  it("scores an untouched clone that kept its name at the top of the range", () => {
    const findings = detector.detect(
      withPage([card("main", "COMPONENT", "Card", { componentKey: "k-card" }), card("loose", "FRAME", "Card")]),
    )
    expect(findings[0]?.note).toContain("at 1.00")
  })

  // The cost of requiring a name. On a real file, structure alone produced 126
  // candidates and not one of them was right, so this case was traded away
  // deliberately. It is recorded in docs/known-misses.md rather than implied.
  it("cannot find a clone that was renamed, however exactly it matches", () => {
    const findings = detector.detect(
      withPage([card("main", "COMPONENT", "Card", { componentKey: "k-card" }), card("loose", "FRAME", "Untitled")]),
    )
    expect(findings).toEqual([])
  })

  it("puts the threshold above a name-only coincidence and below an edited clone", () => {
    expect(CANDIDATE_THRESHOLD).toBeGreaterThan(0.35)
    expect(CANDIDATE_THRESHOLD).toBeLessThan(0.65)
  })
})
