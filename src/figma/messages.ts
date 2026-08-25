// The only channel between the sandbox and the panel. Both sides import these
// types, so a message shape can never drift between them.

export type UiMessage = { type: "close" }

export type PluginMessage = { type: "ready" }

export function postToUi(message: PluginMessage): void {
  figma.ui.postMessage(message)
}

export function postToPlugin(message: UiMessage): void {
  parent.postMessage({ pluginMessage: message }, "*")
}
