import { describe, expect, it } from "vitest"
import { fingerprint, similarity } from "../../src/core/util/fingerprint.ts"
import { buildSnapshot } from "../support/build-snapshot.ts"

describe("fingerprint", () => {
  it("returns null when rootId is not in the snapshot", () => {
    const snapshot = buildSnapshot({ pages: [] })
    expect(fingerprint(snapshot, "missing")).toBeNull()
  })

  it("gives the same shape hash for two identical trees", () => {
    const snapshot = buildSnapshot({
      pages: [
        {
          id: "page",
          type: "PAGE",
          children: [
            {
              id: "tree1",
              type: "FRAME",
              children: [
                { id: "v1", type: "VECTOR" },
                { id: "t1", type: "TEXT" },
              ],
            },
            {
              id: "tree2",
              type: "FRAME",
              children: [
                { id: "v2", type: "VECTOR" },
                { id: "t2", type: "TEXT" },
              ],
            },
          ],
        },
      ],
    })

    const fp1 = fingerprint(snapshot, "tree1")
    const fp2 = fingerprint(snapshot, "tree2")
    expect(fp1).not.toBeNull()
    expect(fp2).not.toBeNull()
    expect(fp1?.shape).toBe(fp2?.shape)
  })

  it("changes the shape hash when two children are reordered", () => {
    const snapshot = buildSnapshot({
      pages: [
        {
          id: "page",
          type: "PAGE",
          children: [
            {
              id: "ordered",
              type: "FRAME",
              children: [
                { id: "v1", type: "VECTOR" },
                { id: "t1", type: "TEXT" },
              ],
            },
            {
              id: "reordered",
              type: "FRAME",
              children: [
                { id: "t2", type: "TEXT" },
                { id: "v2", type: "VECTOR" },
              ],
            },
          ],
        },
      ],
    })

    const fp1 = fingerprint(snapshot, "ordered")
    const fp2 = fingerprint(snapshot, "reordered")
    expect(fp1?.shape).not.toBe(fp2?.shape)
  })

  it("changes the shape hash when a node type differs", () => {
    const snapshot = buildSnapshot({
      pages: [
        {
          id: "page",
          type: "PAGE",
          children: [
            {
              id: "tree1",
              type: "FRAME",
              children: [{ id: "v1", type: "VECTOR" }],
            },
            {
              id: "tree2",
              type: "FRAME",
              children: [{ id: "r1", type: "RECTANGLE" }],
            },
          ],
        },
      ],
    })

    const fp1 = fingerprint(snapshot, "tree1")
    const fp2 = fingerprint(snapshot, "tree2")
    expect(fp1?.shape).not.toBe(fp2?.shape)
  })

  it("computes depth and nodeCount correctly on a three level tree", () => {
    const snapshot = buildSnapshot({
      pages: [
        {
          id: "page",
          type: "PAGE",
          children: [
            {
              id: "root",
              type: "FRAME",
              props: { width: 300, height: 200 },
              children: [
                {
                  id: "branch",
                  type: "FRAME",
                  children: [
                    { id: "leaf1", type: "RECTANGLE" },
                    { id: "leaf2", type: "TEXT" },
                  ],
                },
                { id: "leaf3", type: "VECTOR" },
              ],
            },
          ],
        },
      ],
    })

    const fp = fingerprint(snapshot, "root")
    expect(fp).toEqual({
      shape: expect.any(String),
      depth: 2,
      nodeCount: 5,
      width: 300,
      height: 200,
    })
  })

  it("handles a single leaf node with depth zero and nodeCount one", () => {
    const snapshot = buildSnapshot({
      pages: [
        {
          id: "page",
          type: "PAGE",
          children: [{ id: "leaf", type: "RECTANGLE", props: { width: 50, height: 50 } }],
        },
      ],
    })

    const fp = fingerprint(snapshot, "leaf")
    expect(fp?.depth).toBe(0)
    expect(fp?.nodeCount).toBe(1)
    expect(fp?.width).toBe(50)
    expect(fp?.height).toBe(50)
  })
})

describe("similarity", () => {
  it("returns 1.0 for a fingerprint against itself", () => {
    const snapshot = buildSnapshot({
      pages: [
        {
          id: "page",
          type: "PAGE",
          children: [
            {
              id: "card",
              type: "FRAME",
              props: { width: 120, height: 80 },
              children: [{ id: "icon", type: "VECTOR" }],
            },
          ],
        },
      ],
    })

    const fp = fingerprint(snapshot, "card") as NonNullable<ReturnType<typeof fingerprint>>
    expect(similarity(fp, fp)).toBe(1.0)
  })

  it("returns below 0.6 when shapes differ", () => {
    const snapshot = buildSnapshot({
      pages: [
        {
          id: "page",
          type: "PAGE",
          children: [
            {
              id: "a",
              type: "FRAME",
              props: { width: 100, height: 100 },
              children: [{ id: "v1", type: "VECTOR" }],
            },
            {
              id: "b",
              type: "FRAME",
              props: { width: 100, height: 100 },
              children: [{ id: "t1", type: "TEXT" }],
            },
          ],
        },
      ],
    })

    const fpA = fingerprint(snapshot, "a") as NonNullable<ReturnType<typeof fingerprint>>
    const fpB = fingerprint(snapshot, "b") as NonNullable<ReturnType<typeof fingerprint>>
    expect(similarity(fpA, fpB)).toBeLessThan(0.6)
  })

  it("does not produce NaN or Infinity for zero sized nodes", () => {
    const snapshot = buildSnapshot({
      pages: [
        {
          id: "page",
          type: "PAGE",
          children: [
            { id: "zero1", type: "FRAME", props: { width: 0, height: 0 } },
            { id: "zero2", type: "FRAME", props: { width: 0, height: 0 } },
            { id: "sized", type: "FRAME", props: { width: 100, height: 100 } },
          ],
        },
      ],
    })

    const fpZero1 = fingerprint(snapshot, "zero1") as NonNullable<ReturnType<typeof fingerprint>>
    const fpZero2 = fingerprint(snapshot, "zero2") as NonNullable<ReturnType<typeof fingerprint>>
    const fpSized = fingerprint(snapshot, "sized") as NonNullable<ReturnType<typeof fingerprint>>

    const scoreBothZero = similarity(fpZero1, fpZero2)
    const scoreOneZero = similarity(fpZero1, fpSized)

    expect(Number.isFinite(scoreBothZero)).toBe(true)
    expect(Number.isFinite(scoreOneZero)).toBe(true)
    expect(scoreBothZero).toBe(1.0)
    expect(scoreOneZero).toBeGreaterThanOrEqual(0)
    expect(scoreOneZero).toBeLessThanOrEqual(1)
  })

  it("weights shape, dimensions, and node count according to formula", () => {
    const a = { shape: "a1b2c3d4", depth: 1, nodeCount: 2, width: 100, height: 50 }
    const b = { shape: "a1b2c3d4", depth: 1, nodeCount: 4, width: 50, height: 50 }

    // shapeScore: 1 (0.6)
    // sizeScore: (50/100) * (50/50) = 0.5 (0.2 * 0.5 = 0.1)
    // countScore: 2/4 = 0.5 (0.2 * 0.5 = 0.1)
    // total: 0.6 + 0.1 + 0.1 = 0.8
    expect(similarity(a, b)).toBeCloseTo(0.8)
  })
})
