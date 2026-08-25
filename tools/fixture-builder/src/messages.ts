import type { LabelSet } from "../../../src/core/accuracy/labels.ts"

export type UiMessage = { type: "build" } | { type: "close" }

export type PluginMessage =
  | { type: "ready" }
  | { type: "built"; labels: LabelSet; log: Array<{ step: string; failed: boolean; detail?: string }> }
  | { type: "failed"; message: string }
