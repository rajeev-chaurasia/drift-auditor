import type { DocumentSnapshot } from "../core/model/snapshot.ts"
import type { SnapshotSummary } from "../core/report/summary.ts"

// The only channel between the sandbox and the panel. Both sides import these
// types, so a message shape cannot drift between them.

export type UiMessage = { type: "close" } | { type: "scan" }

export type PluginMessage =
  | { type: "ready" }
  | { type: "scan-started" }
  | { type: "scan-progress"; nodesVisited: number }
  | { type: "scan-complete"; fileName: string; summary: SnapshotSummary; snapshot: DocumentSnapshot }
  | { type: "scan-failed"; message: string }
