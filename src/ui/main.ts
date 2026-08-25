import { postToPlugin, type PluginMessage } from "../figma/messages"

const app = document.getElementById("app") as HTMLElement

window.onmessage = (event: MessageEvent) => {
  const message = event.data.pluginMessage as PluginMessage | undefined
  if (message?.type === "ready") {
    app.innerHTML = '<p class="muted">Drift Auditor is loaded.</p>'
  }
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") postToPlugin({ type: "close" })
})
