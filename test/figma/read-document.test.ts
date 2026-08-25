import { afterEach, describe, expect, it } from "vitest"
import { parseSnapshot } from "../../src/core/model/parse.ts"
import { readDocument } from "../../src/figma/snapshot/read-document.ts"
import { installFigma, MIXED, solid, text, type FakeDocument, type FakeNode } from "../support/fake-figma.ts"

let uninstall: (() => void) | null = null

afterEach(() => {
  uninstall?.()
  uninstall = null
})

async function read(document: FakeDocument) {
  uninstall = installFigma(document)
  return readDocument({ producer: "test" })
}

const button: FakeNode = {
  id: "1:1",
  type: "COMPONENT",
  name: "Button",
  key: "k-button",
  remote: false,
  visible: true,
  width: 120,
  height: 40,
  cornerRadius: 8,
  fills: [solid("#0D99FF")],
  children: [text("1:2", "Label", "Submit")],
}

const instanceOf = (id: string, main: FakeNode, extra: Partial<FakeNode> = {}): FakeNode => ({
  id,
  type: "INSTANCE",
  name: "Button",
  visible: true,
  width: 120,
  height: 40,
  cornerRadius: 8,
  fills: [solid("#0D99FF")],
  mainComponent: main,
  children: [text(`${id}-label`, "Label", "Submit")],
  ...extra,
})

describe("readDocument", () => {
  it("produces a snapshot that passes its own integrity checks", async () => {
    const snapshot = await read({ name: "Design", pages: [{ id: "0:1", type: "PAGE", name: "Product", children: [button] }] })
    expect(() => parseSnapshot(JSON.parse(JSON.stringify(snapshot)))).not.toThrow()
  })

  it("records every node, with the page as the root", async () => {
    const snapshot = await read({ name: "Design", pages: [{ id: "0:1", type: "PAGE", name: "Product", children: [button] }] })
    expect(snapshot.pageIds).toEqual(["0:1"])
    expect(Object.keys(snapshot.nodes).sort()).toEqual(["0:1", "1:1", "1:2"])
    expect(snapshot.nodes["1:1"]?.parentId).toBe("0:1")
  })

  it("normalises a colour to hex, so a comparison is a string comparison", async () => {
    const snapshot = await read({ name: "Design", pages: [{ id: "0:1", type: "PAGE", name: "Product", children: [button] }] })
    expect(snapshot.nodes["1:1"]?.props.fills?.[0]).toMatchObject({ kind: "solid", hex: "#0D99FF" })
  })

  it("registers a component under its key, with the node that backs it", async () => {
    const snapshot = await read({ name: "Design", pages: [{ id: "0:1", type: "PAGE", name: "Product", children: [button] }] })
    expect(snapshot.components["k-button"]).toMatchObject({ name: "Button", nodeId: "1:1", remote: false })
  })

  it("carries an instance's overrides through verbatim", async () => {
    const use = instanceOf("2:1", button, {
      overrides: [{ id: "2:1-label", overriddenFields: ["characters", "fontSize"] }],
    })
    const snapshot = await read({
      name: "Design",
      pages: [{ id: "0:1", type: "PAGE", name: "Product", children: [button, use] }],
    })

    expect(snapshot.nodes["2:1"]?.instance).toMatchObject({
      mainComponentKey: "k-button",
      mainComponentNodeId: "1:1",
      baselineAvailable: true,
      overrides: [{ nodeId: "2:1-label", fields: ["characters", "fontSize"] }],
    })
  })

  it("records which fields a component property drives", async () => {
    const use = instanceOf("2:1", button, {
      children: [text("2:1-label", "Label", "Buy", { componentPropertyReferences: { characters: "Label#1:0" } })],
    })
    const snapshot = await read({
      name: "Design",
      pages: [{ id: "0:1", type: "PAGE", name: "Product", children: [button, use] }],
    })

    expect(snapshot.nodes["2:1-label"]?.componentPropertyReferences).toEqual({ characters: "Label#1:0" })
  })

  it("resolves a style once and marks whether a library published it", async () => {
    const boxed: FakeNode = { id: "3:1", type: "RECTANGLE", name: "Box", visible: true, fills: [solid("#FFFFFF")], fillStyleId: "S:1" }
    const snapshot = await read({
      name: "Design",
      pages: [{ id: "0:1", type: "PAGE", name: "Product", children: [boxed] }],
      styles: [{ id: "S:1", key: "sk", name: "Brand/Primary", type: "PAINT", remote: true }],
    })

    expect(snapshot.nodes["3:1"]?.props.styles?.fill).toBe("S:1")
    expect(snapshot.styles["S:1"]).toMatchObject({ name: "Brand/Primary", remote: true })
  })

  it("resolves a variable bound to a paint", async () => {
    const boxed: FakeNode = { id: "3:1", type: "RECTANGLE", name: "Box", visible: true, fills: [solid("#0D99FF", "V:1")] }
    const snapshot = await read({
      name: "Design",
      pages: [{ id: "0:1", type: "PAGE", name: "Product", children: [boxed] }],
      variables: [
        { id: "V:1", key: "vk", name: "colour/brand", resolvedType: "COLOR", variableCollectionId: "C:1", remote: true },
      ],
    })

    expect(snapshot.nodes["3:1"]?.props.fills?.[0]).toMatchObject({ variableId: "V:1" })
    expect(snapshot.variables["V:1"]).toMatchObject({ name: "colour/brand" })
  })

  it("drops a style id that resolves to nothing rather than inventing a record", async () => {
    const boxed: FakeNode = { id: "3:1", type: "RECTANGLE", name: "Box", visible: true, fills: [solid("#FFFFFF")], fillStyleId: "S:gone" }
    const snapshot = await read({ name: "Design", pages: [{ id: "0:1", type: "PAGE", name: "Product", children: [boxed] }] })

    expect(snapshot.nodes["3:1"]?.props.styles).toBeUndefined()
    expect(snapshot.styles).toEqual({})
  })
})

describe("what the reader admits it could not do", () => {
  it("records a mixed value instead of quietly comparing nothing", async () => {
    const mixedText = text("4:1", "Body", "Hello", { fills: MIXED })
    const snapshot = await read({ name: "Design", pages: [{ id: "0:1", type: "PAGE", name: "Product", children: [mixedText] }] })

    expect(snapshot.capture.incomplete).toContainEqual(
      expect.objectContaining({ nodeId: "4:1", reason: "mixed-value" }),
    )
    expect(snapshot.nodes["4:1"]?.props.fills?.[0]).toMatchObject({ kind: "unsupported", paintType: "MIXED" })
  })

  it("records a mixed font size as mixed rather than as a number", async () => {
    const mixedText = text("4:1", "Body", "Hello", { fontSize: MIXED })
    const snapshot = await read({ name: "Design", pages: [{ id: "0:1", type: "PAGE", name: "Product", children: [mixedText] }] })
    expect(snapshot.nodes["4:1"]?.props.typography?.fontSize).toBe("mixed")
  })

  it("reports an instance whose library component cannot be read, without dropping it", async () => {
    const orphan = instanceOf("2:1", button, { mainComponent: null })
    const snapshot = await read({ name: "Design", pages: [{ id: "0:1", type: "PAGE", name: "Product", children: [orphan] }] })

    expect(snapshot.nodes["2:1"]?.instance).toMatchObject({ baselineAvailable: false, mainComponentNodeId: null })
    expect(snapshot.capture.incomplete).toContainEqual(
      expect.objectContaining({ nodeId: "2:1", reason: "remote-baseline-unreadable" }),
    )
  })

  it("survives a main component lookup that throws", async () => {
    const orphan = instanceOf("2:1", button, { mainComponentThrows: true })
    const snapshot = await read({ name: "Design", pages: [{ id: "0:1", type: "PAGE", name: "Product", children: [orphan] }] })
    expect(snapshot.nodes["2:1"]?.instance?.baselineAvailable).toBe(false)
  })

  it("pulls in a library component that is not on any page, so overrides have a baseline", async () => {
    const remote: FakeNode = { ...button, id: "9:1", key: "k-remote", remote: true, children: [text("9:2", "Label", "Submit")] }
    const use = instanceOf("2:1", remote, { overrides: [{ id: "2:1-label", overriddenFields: ["characters"] }] })
    const snapshot = await read({ name: "Design", pages: [{ id: "0:1", type: "PAGE", name: "Product", children: [use] }] })

    expect(snapshot.nodes["9:1"]).toBeDefined()
    expect(snapshot.nodes["2:1"]?.instance?.baselineAvailable).toBe(true)
    expect(snapshot.components["k-remote"]).toMatchObject({ remote: true, nodeId: "9:1" })
  })

  it("records what the traversal was configured to skip, because it changes the counts", async () => {
    uninstall = installFigma({ name: "Design", pages: [{ id: "0:1", type: "PAGE", name: "Product", children: [button] }] })
    const snapshot = await readDocument({ producer: "test", skipInvisibleInstanceChildren: true })
    expect(snapshot.capture.skipInvisibleInstanceChildren).toBe(true)
  })
})
