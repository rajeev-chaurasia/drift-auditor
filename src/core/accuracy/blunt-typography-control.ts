import type { Detector } from "../detect/detector.ts"
import { describeTypography } from "../detect/typography-drift.ts"
import { findingId, type Finding } from "../model/finding.ts"
import type { DocumentSnapshot } from "../model/snapshot.ts"
import { locate } from "../util/location.ts"
import { walkAll } from "../util/tree.ts"

/**
 * The negative control for typography drift.
 *
 * It is the obvious naive version: flag every TEXT node that has no styles.text
 * binding. It ignores whether a style was published or local, ignores variables
 * completely, skips attribution so every instance is charged separately, and
 * reports mixed-range layers as defects.
 */
export class BluntTypographyControlDetector implements Detector {
  readonly category = "typography-drift" as const

  detect(snapshot: DocumentSnapshot): Finding[] {
    const findings: Finding[] = []

    for (const node of walkAll(snapshot)) {
      if (node.type !== "TEXT") continue
      if (node.props.styles?.text) continue

      findings.push({
        id: findingId(this.category, node.id, "typography"),
        category: this.category,
        confidence: "exact",
        fieldClass: "typography",
        field: "typography",
        subjectId: node.id,
        subjectName: node.name,
        location: locate(snapshot, node.id),
        expected: "a text style",
        actual: node.props.typography ? describeTypography(node.props.typography) : null,
        baselineAvailable: true,
        blastRadius: 1,
      })
    }

    return findings
  }
}
