import type { AuditReport } from "../core/report/audit.ts"
import { toCsv } from "../core/report/csv.ts"
import type { PluginMessage, UiMessage } from "../figma/messages.ts"
import { h, replace } from "./components/dom.ts"
import { filterBar, findingsList, type Filter } from "./components/findings-list.ts"
import { stats } from "./components/stats.ts"
import { coverageNote, summaryTable } from "./components/summary-table.ts"

const SHOWN = 60

const app = document.getElementById("app") as HTMLElement

const post = (message: UiMessage): void => parent.postMessage({ pluginMessage: message }, "*")

let recorded: AuditReport | null = null
let filter: Filter = "all"

function scanButton(label: string, disabled: boolean): HTMLButtonElement {
  const button = h("button", disabled ? { disabled: "true" } : {}, label)
  button.onclick = () => post({ type: "scan" })
  return button
}

// Saving is a first class action rather than a debug affordance: a recorded
// snapshot is what lets somebody else recompute the same findings.
function download(name: string, body: string, type: string): void {
  const link = h("a", { download: name, href: URL.createObjectURL(new Blob([body], { type })) })
  link.click()
  URL.revokeObjectURL(link.href)
}

function saveButton(label: string, onclick: () => void): HTMLButtonElement {
  const button = h("button", { class: "secondary" }, label)
  button.onclick = onclick
  return button
}

function renderIdle(): void {
  replace(
    app,
    h("h1", {}, "Drift Auditor"),
    h("p", { class: "muted" }, "Reads this file into a snapshot, then reports how far it has drifted from itself."),
    h("div", { class: "row" }, scanButton("Scan file", false)),
  )
}

function renderScanning(nodesVisited: number): void {
  replace(
    app,
    h("h1", {}, "Drift Auditor"),
    h("p", { class: "muted" }, `Reading the document, ${nodesVisited} layers so far.`),
    h("div", { class: "row" }, scanButton("Scanning", true)),
  )
}

function renderResult(): void {
  if (!recorded) return
  const report = recorded
  const file = report.file

  replace(
    app,
    h("h1", {}, file),
    stats(report),
    h(
      "div",
      { class: "row" },
      scanButton("Scan again", false),
      saveButton("Save findings", () =>
        download(`${file}.findings.json`, JSON.stringify(report, null, 2), "application/json"),
      ),
      saveButton("Save CSV", () => download(`${file}.findings.csv`, toCsv(report.findings), "text/csv")),
      saveButton("Save snapshot", () => post({ type: "save-snapshot" })),
    ),
    filterBar(report.findings, filter, (next) => {
      filter = next
      renderResult()
    }),
    h("div", { class: "scroll" }, findingsList(report.findings, filter, SHOWN)),
    summaryTable(report.summary),
    coverageNote(report.summary),
  )
}

function renderFailure(reason: string): void {
  replace(
    app,
    h("h1", {}, "Drift Auditor"),
    h("p", { class: "danger" }, `The scan stopped: ${reason}`),
    h("div", { class: "row" }, scanButton("Try again", false)),
  )
}

window.onmessage = (event: MessageEvent) => {
  const message = event.data.pluginMessage as PluginMessage | undefined
  if (!message) return

  switch (message.type) {
    case "ready":
      return renderIdle()
    case "scan-started":
      return renderScanning(0)
    case "scan-progress":
      return renderScanning(message.nodesVisited)
    case "scan-complete":
      recorded = message.report
      filter = "all"
      return renderResult()
    case "snapshot":
      return download(
        `${message.fileName}.snapshot.json`,
        JSON.stringify(message.snapshot, null, 2),
        "application/json",
      )
    case "scan-failed":
      return renderFailure(message.message)
  }
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") post({ type: "close" })
})
