import type { Detector } from "../detect/detector.ts"
import { findingId, type Finding } from "../model/finding.ts"
import type { DocumentSnapshot } from "../model/snapshot.ts"
import { locate } from "../util/location.ts"
import { walkAll } from "../util/tree.ts"

/**
 * The negative control. This is not a product detector and it is not
 * registered.
 *
 * A passing accuracy gate proves nothing until the gate is shown to reject
 * something. This is the implementation somebody writes when they read the
 * Figma docs for an afternoon: take everything in `InstanceNode.overrides` and
 * report it. It is not a strawman, it is the obvious approach, and it is what
 * most plugins in this category actually do.
 *
 * It is wrong in four specific ways, and each one corresponds to a rule the
 * real detector carries:
 *
 *   1. It reports a field a component property drives, so using a design
 *      system as intended shows up as a defect.
 *   2. It reports an override that was set back to the component's value, so a
 *      layer identical to its component is called drifted.
 *   3. It reports editor and prototyping state that no audit acts on.
 *   4. It never reads a baseline, so no finding carries a before-value.
 *
 * If this ever scores as well as the real detector on a fixture, the fixture
 * has stopped discriminating between them and the accuracy number it produces
 * is worthless. The evidence validator fails the run when that happens.
 */
export class BluntControlDetector implements Detector {
  readonly category = "override-drift" as const

  detect(snapshot: DocumentSnapshot): Finding[] {
    const findings: Finding[] = []

    for (const node of walkAll(snapshot)) {
      if (node.type !== "INSTANCE" || !node.instance) continue

      for (const override of node.instance.overrides) {
        const subject = snapshot.nodes[override.nodeId]
        if (!subject) continue

        for (const field of override.fields) {
          findings.push({
            id: findingId(this.category, subject.id, field),
            category: this.category,
            confidence: "exact",
            fieldClass: "other",
            field,
            subjectId: subject.id,
            subjectName: subject.name,
            location: locate(snapshot, subject.id, { id: node.id, name: node.name }),
            expected: null,
            actual: null,
            baselineAvailable: false,
            blastRadius: 1,
          })
        }
      }
    }

    return findings
  }
}

/**
 * The same idea for tokens: every solid colour without a variable on it is
 * drift.
 *
 * It is wrong in three ways, each matching a rule the real detector carries:
 *
 *   1. It never looks at styles, so a layer correctly using a published
 *      library style is reported.
 *   2. It never attributes to the source, so a component's hardcoded colour is
 *      reported once per instance instead of once, which turns the score into
 *      a census of how often that component was used.
 *   3. It reports paints nothing could be bound to and paints that are hidden,
 *      so it flags the platform and the invisible along with the real cases.
 */
export class BluntTokenControlDetector implements Detector {
  readonly category = "token-drift" as const

  detect(snapshot: DocumentSnapshot): Finding[] {
    const findings: Finding[] = []

    for (const node of walkAll(snapshot)) {
      for (const surface of ["fills", "strokes"] as const) {
        const paints = node.props[surface] ?? []

        for (const [index, paint] of paints.entries()) {
          if (paint.kind === "solid" && paint.variableId) continue

          findings.push({
            id: findingId(this.category, node.id, `${surface}[${index}]`),
            category: this.category,
            confidence: "exact",
            fieldClass: "colour",
            field: surface,
            subjectId: node.id,
            subjectName: node.name,
            location: locate(snapshot, node.id),
            expected: "a bound variable",
            actual: paint.kind === "solid" ? paint.hex : paint.kind,
            baselineAvailable: true,
            blastRadius: 1,
          })
        }
      }
    }

    return findings
  }
}
