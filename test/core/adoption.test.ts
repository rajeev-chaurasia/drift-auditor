import { describe, expect, it } from "vitest"
import { libraryAdoption } from "../../src/core/report/adoption.ts"
import { buildSnapshot } from "../support/build-snapshot.ts"

const styles = [
  { id: "S:pub", key: "k1", name: "Brand/Primary", type: "PAINT" as const, remote: true },
  { id: "S:loc", key: "k2", name: "Scratch/Grey", type: "PAINT" as const, remote: false },
  { id: "S:text", key: "k3", name: "Type/Body", type: "TEXT" as const, remote: false },
]

describe("libraryAdoption", () => {
  it("counts a reference per slot, not per layer", () => {
    const snapshot = buildSnapshot({
      pages: [
        {
          id: "page",
          type: "PAGE",
          children: [{ id: "box", type: "RECTANGLE", props: { styles: { fill: "S:pub", stroke: "S:loc" } } }],
        },
      ],
      styles,
    })

    expect(libraryAdoption(snapshot)).toEqual({ referenced: 2, published: 1, rate: 0.5 })
  })

  it("counts text styles alongside paint styles", () => {
    const snapshot = buildSnapshot({
      pages: [
        {
          id: "page",
          type: "PAGE",
          children: [{ id: "label", type: "TEXT", props: { styles: { text: "S:text" } } }],
        },
      ],
      styles,
    })

    expect(libraryAdoption(snapshot)).toMatchObject({ referenced: 1, published: 0, rate: 0 })
  })

  it("ignores a reference to a style that is not in the file", () => {
    const snapshot = buildSnapshot({
      pages: [
        { id: "page", type: "PAGE", children: [{ id: "box", type: "RECTANGLE", props: { styles: { fill: "S:gone" } } }] },
      ],
      styles,
    })

    expect(libraryAdoption(snapshot).referenced).toBe(0)
  })

  it("calls a file that references nothing zero rather than everything", () => {
    expect(libraryAdoption(buildSnapshot({ pages: [{ id: "page", type: "PAGE" }] })).rate).toBe(0)
  })
})
