import { describe, expect, it } from "vitest"
import { DETECTORS, detectAll } from "../../src/core/detect/registry.ts"
import type { Detector } from "../../src/core/detect/detector.ts"
import { buildSnapshot } from "../support/build-snapshot.ts"
import { instanceInfo, solidFill } from "../support/instances.ts"

const snapshot = buildSnapshot({
  pages: [
    {
      id: "page",
      type: "PAGE",
      children: [
        {
          id: "main",
          type: "COMPONENT",
          componentKey: "k-main",
          children: [
            { id: "main-a", type: "TEXT", props: { characters: "A" } },
            { id: "main-b", type: "RECTANGLE", props: { fills: solidFill("#000000") } },
          ],
        },
        {
          id: "use",
          type: "INSTANCE",
          instance: instanceInfo("main", [
            { nodeId: "use-b", fields: ["fills"] },
            { nodeId: "use-a", fields: ["characters"] },
          ]),
          children: [
            { id: "use-a", type: "TEXT", props: { characters: "B" } },
            { id: "use-b", type: "RECTANGLE", props: { fills: solidFill("#FF0000") } },
          ],
        },
      ],
    },
  ],
  components: [{ key: "k-main", name: "Button", remote: false, nodeId: "main" }],
})

describe("detectAll", () => {
  it("returns the same order every run, so two artifacts can be diffed", () => {
    const first = detectAll(snapshot).map((finding) => finding.id)
    const second = detectAll(snapshot).map((finding) => finding.id)
    expect(first).toEqual(second)
    expect(first).toEqual([...first].sort())
  })

  it("gives every finding an id unique to its layer and field", () => {
    const ids = detectAll(snapshot).map((finding) => finding.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("runs whatever detectors it is handed, so a control can replace them", () => {
    const noop: Detector = { category: "token-drift", detect: () => [] }
    expect(detectAll(snapshot, [noop])).toEqual([])
  })

  it("registers one detector per category, with no duplicates", () => {
    const categories = DETECTORS.map((detector) => detector.category)
    expect(new Set(categories).size).toBe(categories.length)
  })
})
