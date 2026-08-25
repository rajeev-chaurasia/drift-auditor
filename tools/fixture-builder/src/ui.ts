import type { PluginMessage, UiMessage } from "./messages.ts"

const app = document.getElementById("app") as HTMLElement

const post = (message: UiMessage): void => parent.postMessage({ pluginMessage: message }, "*")

function element(tag: string, className: string, text: string): HTMLElement {
  const node = document.createElement(tag)
  if (className) node.className = className
  node.textContent = text
  return node
}

function render(...children: Node[]): void {
  app.replaceChildren(...children)
}

function buildButton(text: string, disabled: boolean): HTMLButtonElement {
  const button = document.createElement("button")
  button.textContent = text
  button.disabled = disabled
  button.onclick = () => post({ type: "build" })
  return button
}

function renderIdle(): void {
  const row = document.createElement("div")
  row.className = "row"
  row.append(buildButton("Build fixture", false))

  render(
    element("h1", "", "Drift Fixture Builder"),
    element(
      "p",
      "muted",
      "Adds two pages, Components and Usage, holding deliberate drift. It only adds. Nothing already in this file is touched.",
    ),
    row,
  )
}

function renderBuilt(message: Extract<PluginMessage, { type: "built" }>): void {
  const steps = document.createElement("ol")
  for (const entry of message.log) {
    steps.append(element("li", entry.failed ? "failed" : "", entry.failed ? `${entry.step}: ${entry.detail}` : entry.step))
  }

  const save = document.createElement("button")
  save.className = "secondary"
  save.textContent = "Save labels.json"
  save.onclick = () => {
    const body = `${JSON.stringify(message.labels, null, 2)}\n`
    const link = document.createElement("a")
    link.download = "labels.json"
    link.href = URL.createObjectURL(new Blob([body], { type: "application/json" }))
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const row = document.createElement("div")
  row.className = "row"
  row.append(save, buildButton("Build again", false))

  const failed = message.log.filter((entry) => entry.failed).length

  render(
    element("h1", "", "Built"),
    element(
      "p",
      failed > 0 ? "danger" : "muted",
      failed > 0
        ? `${failed} case(s) failed. Undo everything, fix the cause, and build again: a step that stopped part way can leave drift in the file that no label describes.`
        : `${message.labels.cases.length} labelled cases across ${message.log.length} steps.`,
    ),
    row,
    element(
      "p",
      "muted",
      "Save labels.json next to the snapshot, then run the auditor on this file and press Save snapshot.",
    ),
    steps,
  )
}

window.onmessage = (event: MessageEvent) => {
  const message = event.data.pluginMessage as PluginMessage | undefined
  if (!message) return

  if (message.type === "ready") renderIdle()
  if (message.type === "built") renderBuilt(message)
  if (message.type === "failed") {
    render(element("h1", "", "Drift Fixture Builder"), element("p", "danger", message.message))
  }
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") post({ type: "close" })
})
