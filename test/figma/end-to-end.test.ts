import { afterEach, describe, expect, it } from "vitest"
import { parseSnapshot } from "../../src/core/model/parse.ts"
import { audit } from "../../src/core/report/audit.ts"
import { readDocument } from "../../src/figma/snapshot/read-document.ts"
import { installFigma, solid, text, type FakeNode } from "../support/fake-figma.ts"

let uninstall: (() => void) | null = null
afterEach(() => {
  uninstall?.()
  uninstall = null
})

const main: FakeNode = {
  id: "1:1",
  type: "COMPONENT",
  name: "Button",
  key: "k-button",
  remote: false,
  visible: true,
  width: 120,
  height: 40,
  fills: [solid("#0D99FF", "V:1")],
  children: [text("1:2", "Label", "Submit", { textStyleId: "S:1" })],
}

const drifted: FakeNode = {
  id: "2:1",
  type: "INSTANCE",
  name: "Button",
  visible: true,
  width: 120,
  height: 40,
  fills: [solid("#FF3B30")],
  mainComponent: main,
  overrides: [{ id: "2:1", overriddenFields: ["fills"] }, { id: "2:2", overriddenFields: ["characters"] }],
  children: [text("2:2", "Label", "Buy now", { textStyleId: "S:1" })],
}

const configured: FakeNode = {
  id: "3:1",
  type: "INSTANCE",
  name: "Button",
  visible: true,
  width: 120,
  height: 40,
  fills: [solid("#0D99FF", "V:1")],
  mainComponent: main,
  overrides: [{ id: "3:2", overriddenFields: ["characters"] }],
  children: [
    text("3:2", "Label", "Add", { textStyleId: "S:1", componentPropertyReferences: { characters: "Label#1:0" } }),
  ],
}

/**
 * The whole pipeline in one place: a live document read into a snapshot, the
 * snapshot serialised and parsed back, and the detectors run over the result.
 * Every other test exercises one half or the other.
 */
describe("a document read and then audited", () => {
  it("finds the drift and leaves the correct instance alone", async () => {
    uninstall = installFigma({
      name: "Design",
      pages: [{ id: "0:1", type: "PAGE", name: "Product", children: [main, drifted, configured] }],
      styles: [{ id: "S:1", key: "sk", name: "type/body", type: "TEXT", remote: true }],
      variables: [
        { id: "V:1", key: "vk", name: "colour/brand", resolvedType: "COLOR", variableCollectionId: "C:1", remote: true },
      ],
    })

    const recorded = await readDocument({ producer: "test" })
    const report = audit(parseSnapshot(JSON.parse(JSON.stringify(recorded))))

    const ids = report.findings.map((finding) => finding.id).sort()
    expect(ids).toEqual([
      "override-drift|2:1|fills",
      "override-drift|2:2|characters",
      "token-drift|2:1|fills[0]",
    ])
  })

  it("rates one of two instances as drifted, and one of three paints as untokenised", async () => {
    uninstall = installFigma({
      name: "Design",
      pages: [{ id: "0:1", type: "PAGE", name: "Product", children: [main, drifted, configured] }],
      variables: [
        { id: "V:1", key: "vk", name: "colour/brand", resolvedType: "COLOR", variableCollectionId: "C:1", remote: true },
      ],
    })

    const report = audit(await readDocument({ producer: "test" }))
    expect(report.rates.instancesConsidered).toBe(2)
    expect(report.rates.instancesDrifted).toBe(1)
    expect(report.rates.tokenCoverage).toMatchObject({ bindable: 3, tokenised: 2 })
  })

  it("gives the same answer whether the snapshot went through JSON or not", async () => {
    uninstall = installFigma({
      name: "Design",
      pages: [{ id: "0:1", type: "PAGE", name: "Product", children: [main, drifted, configured] }],
    })

    const recorded = await readDocument({ producer: "test" })
    const direct = audit(recorded)
    const roundTripped = audit(parseSnapshot(JSON.parse(JSON.stringify(recorded))))

    expect(JSON.stringify(roundTripped.findings)).toBe(JSON.stringify(direct.findings))
    expect(roundTripped.score).toEqual(direct.score)
  })
})
