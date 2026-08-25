import { describe, expect, it } from "vitest"
import { countOfType, summarise } from "../../src/core/report/summary.ts"
import { buildSnapshot } from "../support/build-snapshot.ts"

const snapshot = buildSnapshot({
  pages: [
    {
      id: "page-1",
      type: "PAGE",
      children: [
        { id: "button", type: "COMPONENT", componentKey: "key-button" },
        {
          id: "use-1",
          type: "INSTANCE",
          instance: {
            mainComponentKey: "key-button",
            mainComponentNodeId: "button",
            baselineAvailable: true,
            overrides: [],
            componentProperties: {},
          },
          children: [{ id: "use-1-label", type: "TEXT" }],
        },
        {
          id: "use-2",
          type: "INSTANCE",
          instance: {
            mainComponentKey: "key-remote",
            mainComponentNodeId: null,
            baselineAvailable: false,
            overrides: [],
            componentProperties: {},
          },
        },
      ],
    },
    { id: "page-2", type: "PAGE" },
  ],
  components: [
    { key: "key-button", name: "Button", remote: false, nodeId: "button" },
    { key: "key-remote", name: "Chip", remote: true, nodeId: null },
  ],
  styles: [
    { id: "S:1", key: "k1", name: "Brand/Primary", type: "PAINT", remote: true },
    { id: "S:2", key: "k2", name: "Local/Grey", type: "PAINT", remote: false },
  ],
  variables: [
    {
      id: "V:1",
      key: "vk",
      name: "color/primary",
      resolvedType: "COLOR",
      collectionId: "C:1",
      remote: true,
    },
  ],
})

describe("summarise", () => {
  it("counts what a person can count by hand in the layers panel", () => {
    const summary = summarise(snapshot)
    expect(summary.pages).toBe(2)
    expect(summary.nodes).toBe(6)
    expect(summary.instances).toBe(2)
    expect(countOfType(summary, "COMPONENT")).toBe(1)
    expect(countOfType(summary, "TEXT")).toBe(1)
  })

  it("separates components this file owns from ones a library published", () => {
    const summary = summarise(snapshot)
    expect(summary.localComponents).toBe(1)
    expect(summary.remoteComponents).toBe(1)
  })

  it("reports how many instances have no baseline to be diffed against", () => {
    expect(summarise(snapshot).instancesWithoutBaseline).toBe(1)
  })

  it("counts styles and variables, remote ones separately", () => {
    const summary = summarise(snapshot)
    expect(summary.styles).toBe(2)
    expect(summary.remoteStyles).toBe(1)
    expect(summary.variables).toBe(1)
  })
})
