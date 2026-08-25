import { describe, expect, it } from "vitest"
import { SnapshotError, parseSnapshot } from "../../src/core/model/parse.ts"
import { SCHEMA_VERSION } from "../../src/core/model/snapshot.ts"
import { buildSnapshot } from "../support/build-snapshot.ts"
import { mutableClone } from "../support/clone.ts"

const valid = buildSnapshot({
  pages: [{ id: "page", type: "PAGE", children: [{ id: "card", type: "FRAME" }] }],
})

describe("parseSnapshot", () => {
  it("accepts a snapshot that survives a JSON round trip", () => {
    expect(parseSnapshot(mutableClone(valid)).pageIds).toEqual(["page"])
  })

  it("rejects anything that is not a snapshot", () => {
    expect(() => parseSnapshot(null)).toThrow(SnapshotError)
    expect(() => parseSnapshot([])).toThrow(SnapshotError)
    expect(() => parseSnapshot({ schema: SCHEMA_VERSION })).toThrow(/file is missing/)
  })

  it("rejects a schema it was not written against", () => {
    expect(() => parseSnapshot({ ...mutableClone(valid), schema: 99 })).toThrow(/schema 99/)
  })

  it("rejects a child link with no node behind it", () => {
    const broken = mutableClone(valid)
    broken.nodes.page = { ...broken.nodes.page!, childIds: ["ghost"] }
    expect(() => parseSnapshot(broken)).toThrow(/child ghost/)
  })

  it("rejects a parent and child that disagree, which is what hand editing looks like", () => {
    const broken = mutableClone(valid)
    broken.nodes.card = { ...broken.nodes.card!, parentId: null }
    expect(() => parseSnapshot(broken)).toThrow(/records its parent/)
  })

  it("rejects an instance pointing at a baseline that is not present", () => {
    const broken = mutableClone(valid)
    broken.nodes.card = {
      ...broken.nodes.card!,
      instance: {
        mainComponentKey: "k",
        mainComponentNodeId: "gone",
        baselineAvailable: true,
        overrides: [],
        componentProperties: {},
      },
    }
    expect(() => parseSnapshot(broken)).toThrow(/main component node/)
  })
})
