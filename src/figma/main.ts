import { audit } from "../core/report/audit.ts"
import type { DocumentSnapshot } from "../core/model/snapshot.ts"
import type { PluginMessage, UiMessage } from "./messages.ts"
import { readDocument } from "./snapshot/read-document.ts"

const PRODUCER = "drift-auditor 0.1.0"

const post = (message: PluginMessage): void => figma.ui.postMessage(message)

// Kept on this side of the boundary until the panel asks for it.
let recorded: DocumentSnapshot | null = null

figma.showUI(__html__, { width: 520, height: 660, themeColors: true })

async function scan(): Promise<void> {
  post({ type: "scan-started" })

  try {
    const snapshot = await readDocument({
      producer: PRODUCER,
      onProgress: (nodesVisited) => post({ type: "scan-progress", nodesVisited }),
    })

    recorded = snapshot
    post({ type: "scan-complete", report: audit(snapshot) })
  } catch (error) {
    post({ type: "scan-failed", message: error instanceof Error ? error.message : String(error) })
  }
}

figma.ui.onmessage = (message: UiMessage) => {
  if (message.type === "close") figma.closePlugin()
  if (message.type === "scan") void scan()
  if (message.type === "save-snapshot" && recorded) {
    post({ type: "snapshot", fileName: recorded.file.name, snapshot: recorded })
  }
}

post({ type: "ready" })
