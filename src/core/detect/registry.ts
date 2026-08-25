import type { Finding } from "../model/finding.ts"
import type { DocumentSnapshot } from "../model/snapshot.ts"
import type { Detector } from "./detector.ts"
import { DetachmentDetector } from "./detachment.ts"
import { OverrideDriftDetector } from "./override-drift.ts"
import { TokenDriftDetector } from "./token-drift.ts"

/** The one place a category is registered. Adding one is a file and a line. */
export const DETECTORS: readonly Detector[] = [
  new OverrideDriftDetector(),
  new TokenDriftDetector(),
  // Last, and never gated on. Its findings are inferred rather than answered
  // by the API, so they are worth zero in the score and are reported apart.
  new DetachmentDetector(),
]

/**
 * Every finding, in a fixed order.
 *
 * The order is sorted rather than incidental because two runs over the same
 * snapshot have to produce byte identical output, or the published artifact
 * cannot be diffed against a fresh run of it.
 */
export function detectAll(snapshot: DocumentSnapshot, detectors: readonly Detector[] = DETECTORS): Finding[] {
  return detectors
    .flatMap((detector) => detector.detect(snapshot))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}
