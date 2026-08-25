import type { SnapshotSummary } from "../../core/report/summary.ts"
import { h } from "./dom.ts"

const ROWS: ReadonlyArray<readonly [string, (summary: SnapshotSummary) => number]> = [
  ["Pages", (s) => s.pages],
  ["Nodes", (s) => s.nodes],
  ["Components", (s) => s.components],
  ["Components from a library", (s) => s.remoteComponents],
  ["Component sets", (s) => s.byType.COMPONENT_SET ?? 0],
  ["Instances", (s) => s.instances],
  ["Text layers", (s) => s.byType.TEXT ?? 0],
  ["Styles", (s) => s.styles],
  ["Published styles", (s) => s.remoteStyles],
  ["Variables", (s) => s.variables],
]

export function summaryTable(summary: SnapshotSummary): HTMLElement {
  return h(
    "table",
    {},
    h("caption", {}, "What the scan found"),
    h(
      "tbody",
      {},
      ...ROWS.map(([label, read]) =>
        h("tr", {}, h("th", {}, label), h("td", { class: "value" }, String(read(summary)))),
      ),
    ),
  )
}

export function coverageNote(summary: SnapshotSummary): HTMLElement | null {
  if (summary.instancesWithoutBaseline === 0 && summary.incomplete === 0) return null

  return h(
    "p",
    { class: "note muted" },
    `${summary.instancesWithoutBaseline} instance(s) have no readable main component, and ` +
      `${summary.incomplete} region(s) could not be read in full. Findings from those are ` +
      `reported with the gap stated rather than dropped.`,
  )
}
