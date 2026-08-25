import { describe, expect, it } from "vitest"
import { indexPath, namePath, pageOf, resolveIndexPath, walk, walkAll } from "../../src/core/util/tree.ts"
import { buildSnapshot } from "../support/build-snapshot.ts"

const snapshot = buildSnapshot({
  pages: [
    {
      id: "page",
      type: "PAGE",
      children: [
        {
          id: "card",
          type: "FRAME",
          children: [
            { id: "icon", type: "VECTOR" },
            { id: "body", type: "FRAME", children: [{ id: "title", type: "TEXT", name: "Title" }] },
          ],
        },
      ],
    },
  ],
})

describe("walk", () => {
  it("yields the root first and then children in document order", () => {
    expect([...walk(snapshot, "card")].map((n) => n.id)).toEqual(["card", "icon", "body", "title"])
  })

  it("yields nothing for an id the snapshot does not hold", () => {
    expect([...walk(snapshot, "missing")]).toEqual([])
  })

  it("covers every page from walkAll", () => {
    expect([...walkAll(snapshot)]).toHaveLength(5)
  })
})

describe("indexPath", () => {
  it("addresses a descendant by position", () => {
    expect(indexPath(snapshot, "card", "title")).toEqual([1, 0])
  })

  it("is empty for the ancestor itself", () => {
    expect(indexPath(snapshot, "card", "card")).toEqual([])
  })

  it("is null when the node is not under the ancestor", () => {
    expect(indexPath(snapshot, "body", "icon")).toBeNull()
  })

  it("round trips through resolveIndexPath", () => {
    const path = indexPath(snapshot, "card", "title") as number[]
    expect(resolveIndexPath(snapshot, "card", path)?.id).toBe("title")
  })
})

describe("resolveIndexPath", () => {
  it("is null when a position does not exist in the target tree", () => {
    expect(resolveIndexPath(snapshot, "card", [9])).toBeNull()
    expect(resolveIndexPath(snapshot, "card", [1, 0, 0])).toBeNull()
  })
})

describe("namePath", () => {
  it("reads as a layer path a person can follow in Figma", () => {
    expect(namePath(snapshot, "card", "title")).toBe("body / Title")
  })
})

describe("pageOf", () => {
  it("climbs to the page a layer sits on", () => {
    expect(pageOf(snapshot, "title")?.id).toBe("page")
    expect(pageOf(snapshot, "page")?.id).toBe("page")
  })

  it("is null when the chain of parents does not reach a page", () => {
    expect(pageOf(snapshot, "missing")).toBeNull()
  })
})
