import type { DocumentSnapshot } from "../core/model/snapshot.ts"
import type { AuditReport } from "../core/report/audit.ts"
import type { PluginMessage, UiMessage } from "../figma/messages.ts"
import { h, replace } from "./components/dom.ts"
import { findingsList } from "./components/findings-list.ts"
import { coverageNote, summaryTable } from "./components/summary-table.ts"

const SHOWN = 50

const app = document.getElementById("app") as HTMLElement

const post = (message: UiMessage): void => parent.postMessage({ pluginMessage: message }, "*")

let recorded: { report: AuditReport; snapshot: DocumentSnapshot } | null = null

function scanButton(label: string, disabled: boolean): HTMLButtonElement {
  const button = h("button", disabled ? { disabled: "true" } : {}, label)
  button.onclick = () => post({ type: "scan" })
  return button
}

// Saving is a first class action rather than a debug affordance: a recorded
// snapshot is what lets somebody else recompute the same findings.
function saveButton(label: string, name: string, read: () => unknown): HTMLButtonElement {
  const button = h("button", { class: "secondary" }, label)
  button.onclick = () => {
    if (!recorded) return
    const blob = new Blob([JSON.stringify(read(), null, 2)], { type: "application/json" })
    const link = h("a", { download: name, href: URL.createObjectURL(blob) })
    link.click()
    URL.revokeObjectURL(link.href)
  }
  return button
}

function renderIdle(): void {
  replace(
    app,
    h("h1", {}, "Drift Auditor"),
    h("p", { class: "muted" }, "Reads this file into a snapshot, then reports how far its instances have drifted."),
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

function renderResult(message: Extract<PluginMessage, { type: "scan-complete" }>): void {
  const { report, snapshot } = message
  recorded = { report, snapshot }
  const file = report.file

  replace(
    app,
    h("h1", {}, file),
    h(
      "p",
      { class: "muted" },
      `${report.counts.total} findings across ${report.rates.instancesDrifted} of ` +
        `${report.rates.instancesConsidered} instances, ${(report.rates.overrideRate * 100).toFixed(1)}% drifted.`,
    ),
    h(
      "div",
      { class: "row" },
      scanButton("Scan again", false),
      saveButton("Save findings", `${file}.findings.json`, () => recorded?.report),
      saveButton("Save snapshot", `${file}.snapshot.json`, () => recorded?.snapshot),
    ),
    summaryTable(report.summary),
    coverageNote(report.summary),
    h("div", { class: "scroll" }, findingsList(report.findings, SHOWN)),
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
      return renderResult(message)
    case "scan-failed":
      return renderFailure(message.message)
  }
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") post({ type: "close" })
})
