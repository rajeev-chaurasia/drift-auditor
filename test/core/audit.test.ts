import { describe, expect, it } from "vitest"
import { audit } from "../../src/core/report/audit.ts"
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
          children: [{ id: "main-label", type: "TEXT", props: { characters: "Submit" } }],
        },
        {
          id: "drifted",
          type: "INSTANCE",
          instance: instanceInfo("main", [{ nodeId: "drifted-label", fields: ["characters", "fills"] }]),
          children: [
            { id: "drifted-label", type: "TEXT", props: { characters: "Send", fills: solidFill("#FF0000") } },
          ],
        },
        {
          id: "clean",
          type: "INSTANCE",
          instance: instanceInfo("main", []),
          children: [{ id: "clean-label", type: "TEXT", props: { characters: "Submit" } }],
        },
      ],
    },
  ],
  components: [{ key: "k-main", name: "Button", remote: false, nodeId: "main" }],
})

describe("audit", () => {
  it("counts findings by category and by field class", () => {
    const report = audit(snapshot)
    expect(report.counts.byCategory["override-drift"]).toBe(2)
    expect(report.counts.byCategory["token-drift"]).toBe(1)
    expect(report.counts.byFieldClass.content).toBe(1)
    expect(report.counts.total).toBe(3)
  })

  it("rates drift per instance, not per finding, so one bad instance counts once", () => {
    const report = audit(snapshot)
    expect(report.rates.instancesConsidered).toBe(2)
    expect(report.rates.instancesDrifted).toBe(1)
    expect(report.rates.overrideRate).toBe(0.5)
  })

  it("survives a JSON round trip without any number moving", () => {
    const report = audit(snapshot)
    expect(JSON.parse(JSON.stringify(report))).toEqual(report)
  })

  it("produces byte identical output on a second run", () => {
    expect(JSON.stringify(audit(snapshot))).toBe(JSON.stringify(audit(snapshot)))
  })

  it("rates a file with no instances as zero rather than dividing by zero", () => {
    const empty = buildSnapshot({ pages: [{ id: "page", type: "PAGE" }] })
    expect(audit(empty).rates.overrideRate).toBe(0)
  })

  it("counts token coverage over the same paints the token findings come from", () => {
    const report = audit(snapshot)
    const tokenFindings = report.findings.filter((finding) => finding.category === "token-drift")
    expect(report.rates.tokenCoverage.bindable - report.rates.tokenCoverage.tokenised).toBe(tokenFindings.length)
    expect(report.rates.tokenCoverage.coverage).toBe(0)
  })

  it("calls a file with nothing bindable fully covered rather than undefined", () => {
    const empty = buildSnapshot({ pages: [{ id: "page", type: "PAGE" }] })
    expect(audit(empty).rates.tokenCoverage.coverage).toBe(1)
  })
})
