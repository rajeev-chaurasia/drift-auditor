import type { Finding, Category } from "../model/finding.ts"
import type { DocumentSnapshot } from "../model/snapshot.ts"

/**
 * One category of drift.
 *
 * A detector is a pure function of a snapshot. It reads nothing else, holds no
 * state between runs, and cannot reach the network or the Figma API, so the
 * same snapshot always produces the same findings.
 */
export interface Detector {
  readonly category: Category
  detect(snapshot: DocumentSnapshot): Finding[]
}
