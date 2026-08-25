import type { DocumentSnapshot } from "../core/model/snapshot"
import type { PluginMessage, UiMessage } from "../figma/messages"
import { h, replace } from "./components/dom"
import { coverageNote, summaryTable } from "./components/summary-table"

const app = document.getElementById("app") as HTMLElement

const post = (message: UiMessage): void => parent.postMessage({ pluginMessage: message }, "*")

let recorded: { fileName: string; snapshot: DocumentSnapshot } | null = null

function scanButton(label: string, disabled: boolean): HTMLButtonElement {
  const button = h("button", disabled ? { disabled: "true" } : {}, label)
  button.onclick = () => post({ type: "scan" })
  return button
}

// A recorded snapshot is what makes an audit checkable by someone else, so
// exporting one is a first class action rather than a debug affordance.
function downloadButton(): HTMLButtonElement {
  const button = h("button", { class: "secondary" }, "Save snapshot")
  button.onclick = () => {
    if (!recorded) return
    const blob = new Blob([JSON.stringify(recorded.snapshot)], { type: "application/json" })
    const link = h("a", { download: `${recorded.fileName}.snapshot.json`, href: URL.createObjectURL(blob) })
    link.click()
    URL.revokeObjectURL(link.href)
  }
  return button
}

function renderIdle(): void {
  replace(
    app,
    h("h1", {}, "Drift Auditor"),
    h("p", { class: "muted" }, "Reads this file into a snapshot that can be audited and re-checked offline."),
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
  recorded = { fileName: message.fileName, snapshot: message.snapshot }

  replace(
    app,
    h("h1", {}, message.fileName),
    h("p", { class: "muted" }, `Read in ${message.snapshot.capture.durationMs} ms.`),
    summaryTable(message.summary),
    coverageNote(message.summary),
    h("div", { class: "row" }, scanButton("Scan again", false), downloadButton()),
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
