import { buildFixture } from "./build.ts"
import type { PluginMessage, UiMessage } from "./messages.ts"

// A development tool, not part of the published plugin. It writes two pages of
// deliberate drift into the open file, and hands back the labels describing
// what it wrote.

const post = (message: PluginMessage): void => figma.ui.postMessage(message)

figma.showUI(__html__, { width: 460, height: 520, themeColors: true })

figma.ui.onmessage = async (message: UiMessage) => {
  if (message.type === "close") figma.closePlugin()
  if (message.type !== "build") return

  try {
    const result = await buildFixture()
    post({ type: "built", labels: result.labels, log: result.log })
  } catch (error) {
    post({ type: "failed", message: error instanceof Error ? error.message : String(error) })
  }
}

post({ type: "ready" })
