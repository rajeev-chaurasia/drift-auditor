import { findingId, type Finding } from "../model/finding.ts"
import { isBindablePaint, type DocumentSnapshot } from "../model/snapshot.ts"
import { locate } from "../util/location.ts"
import { describePaint } from "../util/paint.ts"
import { walkAll } from "../util/tree.ts"
import { blastRadius, inheritedBaseline, instanceReach, ownerOf } from "./attribution.ts"
import type { Detector } from "./detector.ts"
import { bindablePaints, isCompliant, type PaintCandidate } from "./paint-compliance.ts"

/**
 * Values typed in by hand where a published token already exists.
 *
 * A paint is compliant when a variable is bound to it, or when the layer
 * points at a style that came from a published library. Anything else is a
 * colour somebody typed, and it is the thing that makes a redesign expensive.
 *
 * Two rules do the work of keeping this honest, and both matter more than the
 * detection itself:
 *
 * Attribution. An instance that inherits a hardcoded fill unchanged from its
 * component is not the defect. The component is. Reporting it per instance
 * turns the drift score into a census of how often a component was used, which
 * is not a measure of anything. The finding is raised once, against the
 * component, carrying the number of instances it reaches.
 *
 * Bindability. Image and gradient paints are skipped, because the API cannot
 * bind a variable to them. Reporting them would be reporting the platform.
 */
export class TokenDriftDetector implements Detector {
  readonly category = "token-drift" as const

  detect(snapshot: DocumentSnapshot): Finding[] {
    const reach = instanceReach(snapshot)
    const findings: Finding[] = []
    const seen = new Set<string>()

    for (const node of walkAll(snapshot)) {
      for (const candidate of bindablePaints(node)) {
        if (isCompliant(snapshot, candidate)) continue
        // A layer inside an instance that matches its component is the
        // component's problem, and is reported there instead.
        if (inheritedUnchanged(snapshot, candidate)) continue

        const owner = ownerOf(snapshot, node)
        const id = findingId(this.category, node.id, `${candidate.surface}[${candidate.index}]`)
        if (seen.has(id)) continue
        seen.add(id)

        findings.push({
          id,
          category: this.category,
          confidence: "exact",
          fieldClass: "colour",
          field: candidate.surface,
          subjectId: node.id,
          subjectName: node.name,
          location: locate(snapshot, node.id, owner),
          expected: "a bound variable or a published style",
          actual: describePaint(candidate.paint),
          baselineAvailable: true,
          blastRadius: blastRadius(snapshot, node, reach),
        })
      }
    }

    return findings
  }
}

/** Whether this paint is the component's own colour, showing through unchanged. */
function inheritedUnchanged(snapshot: DocumentSnapshot, candidate: PaintCandidate): boolean {
  const baseline = inheritedBaseline(snapshot, candidate.node)
  const mirrored = baseline?.props[candidate.surface]?.[candidate.index]

  return mirrored !== undefined && isBindablePaint(mirrored) && mirrored.hex === candidate.paint.hex
}
