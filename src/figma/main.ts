import { summarise } from "../core/report/summary"
import type { PluginMessage, UiMessage } from "./messages"
import { readDocument } from "./snapshot/read-document"

const PRODUCER = "drift-auditor 0.1.0"

const post = (message: PluginMessage): void => figma.ui.postMessage(message)

figma.showUI(__html__, { width: 480, height: 620, themeColors: true })

async function scan(): Promise<void> {
  post({ type: "scan-started" })

  try {
    const snapshot = await readDocument({
      producer: PRODUCER,
      onProgress: (nodesVisited) => post({ type: "scan-progress", nodesVisited }),
    })

    post({
      type: "scan-complete",
      fileName: snapshot.file.name,
      summary: summarise(snapshot),
      snapshot,
    })
  } catch (error) {
    post({ type: "scan-failed", message: error instanceof Error ? error.message : String(error) })
  }
}

figma.ui.onmessage = (message: UiMessage) => {
  if (message.type === "close") figma.closePlugin()
  if (message.type === "scan") void scan()
}

post({ type: "ready" })
