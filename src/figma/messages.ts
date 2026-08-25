import type { DocumentSnapshot } from "../core/model/snapshot.ts"
import type { AuditReport } from "../core/report/audit.ts"

// The only channel between the sandbox and the panel. Both sides import these
// types, so a message shape cannot drift between them.

export type UiMessage = { type: "close" } | { type: "scan" } | { type: "save-snapshot" }

export type PluginMessage =
  | { type: "ready" }
  | { type: "scan-started" }
  | { type: "scan-progress"; nodesVisited: number }
  | { type: "scan-complete"; report: AuditReport }
  // Sent only when the panel asks. A snapshot of a large file is the biggest
  // object either side holds, and structured cloning it across the boundary on
  // every scan would cost that for a button nobody may press.
  | { type: "snapshot"; fileName: string; snapshot: DocumentSnapshot }
  | { type: "scan-failed"; message: string }
