import { findingId, type Finding } from "../model/finding.ts"
import type { DocumentSnapshot, NodeId, SnapshotNode } from "../model/snapshot.ts"
import { fingerprint, similarity, type Fingerprint } from "../util/fingerprint.ts"
import { locate } from "../util/location.ts"
import { walkAll } from "../util/tree.ts"
import type { Detector } from "./detector.ts"

/**
 * Frames that look like they used to be instances.
 *
 * This is the only category here that is a guess, and it is a guess because
 * the platform leaves no answer. Detaching an instance turns it into an
 * ordinary frame and stores nothing that points back at what it was. There is
 * no API that can be asked. The best anything can do is notice that a frame
 * has the shape and the name of a component sitting in the same file.
 *
 * So every finding from this detector carries `confidence: "candidate"`, is
 * worth zero in the severity model, and is never counted in the accuracy
 * number the other two categories report. Presenting a guess with the same
 * weight as an answer the API gave directly would undo the point of the rest
 * of this repository.
 */

/**
 * The name has to match. Structure only ranks what is left.
 *
 * Structure alone was the original rule, and on a real file of 27,000 nodes it
 * produced 126 candidates of which not one shared a name with the component it
 * matched. They were generic wrappers, `Background+Shadow` thirty six times,
 * matching three node component variants named things like
 * `variant=2,:hover=true`. In a file built on a UI kit, half the frames are
 * three node boxes, so an identical shape is worth close to nothing.
 *
 * A name is the one piece of evidence that survives detaching, because Figma
 * leaves the component's name on the frame it makes. Requiring it costs the
 * case where somebody detached and then renamed, which is now unreachable and
 * recorded as such in docs/known-misses.md.
 */
const STRUCTURE_WEIGHT = 0.65
const NAME_WEIGHT = 0.35

/**
 * Measured, not guessed, but on the tuning fixture rather than a held out one.
 *
 * With the name required, an untouched clone scores 1.00, a clone that was
 * restructured afterwards scores 0.584, and an unrelated frame that merely
 * shares the name scores 0.464. The threshold sits between the last two, so
 * the restructured case is missed by 0.016. Moving it to fit the file it is
 * then reported on would not be a measurement, so it stays where it is until
 * there is a held out file. See docs/known-misses.md.
 */
export const CANDIDATE_THRESHOLD = 0.6

/** A leaf frame has the shape of everything, so it is evidence of nothing. */
const MINIMUM_NODES = 3

interface ComponentPrint {
  readonly node: SnapshotNode
  readonly print: Fingerprint
  readonly name: string
}

export class DetachmentDetector implements Detector {
  readonly category = "detachment" as const

  detect(snapshot: DocumentSnapshot): Finding[] {
    const components = componentPrints(snapshot)
    if (components.length === 0) return []

    const findings: Finding[] = []

    for (const node of walkAll(snapshot)) {
      if (!isCandidate(snapshot, node)) continue

      const print = fingerprint(snapshot, node.id)
      if (!print || print.nodeCount < MINIMUM_NODES) continue

      const match = bestMatch(snapshot, node, print, components)
      if (!match || match.confidence < CANDIDATE_THRESHOLD) continue

      findings.push({
        id: findingId(this.category, node.id, "structure"),
        category: this.category,
        confidence: "candidate",
        fieldClass: "other",
        field: "structure",
        subjectId: node.id,
        subjectName: node.name,
        location: locate(snapshot, node.id, {
          id: match.component.node.id,
          name: match.component.node.name,
          ...(match.component.node.componentKey !== undefined && {
            componentKey: match.component.node.componentKey,
          }),
          componentName: match.component.node.name,
        }),
        expected: `an instance of ${match.component.node.name}`,
        actual: "a plain frame",
        baselineAvailable: true,
        blastRadius: 1,
        note:
          `Structure and name resemble ${match.component.node.name} at ${match.confidence.toFixed(2)}. ` +
          `Figma records nothing about detachment, so this is inferred and can be wrong.`,
      })
    }

    return findings
  }
}

function componentPrints(snapshot: DocumentSnapshot): ComponentPrint[] {
  const prints: ComponentPrint[] = []

  for (const node of walkAll(snapshot)) {
    if (node.type !== "COMPONENT") continue
    const print = fingerprint(snapshot, node.id)
    if (print) prints.push({ node, print, name: normalise(node.name) })
  }

  return prints
}

/**
 * Anything inside an instance is excluded, because an instance mirrors its
 * component by construction and every layer in one would match. Components
 * themselves are excluded for the same reason.
 */
function isCandidate(snapshot: DocumentSnapshot, node: SnapshotNode): boolean {
  if (node.type !== "FRAME" && node.type !== "GROUP") return false

  let current: SnapshotNode | undefined = node
  while (current) {
    if (current.type === "INSTANCE" || current.type === "COMPONENT" || current.type === "COMPONENT_SET") return false
    current = current.parentId ? snapshot.nodes[current.parentId] : undefined
  }

  return true
}

interface Match {
  readonly component: ComponentPrint
  readonly confidence: number
}

function bestMatch(
  snapshot: DocumentSnapshot,
  node: SnapshotNode,
  print: Fingerprint,
  components: readonly ComponentPrint[],
): Match | null {
  const name = normalise(node.name)
  let best: Match | null = null

  for (const component of components) {
    if (isRelated(snapshot, node.id, component.node.id)) continue

    if (component.name !== name) continue

    const confidence = STRUCTURE_WEIGHT * similarity(print, component.print) + NAME_WEIGHT

    if (!best || confidence > best.confidence) best = { component, confidence }
  }

  return best
}

/** A frame cannot be a detached instance of a component it lives inside, or that lives inside it. */
function isRelated(snapshot: DocumentSnapshot, a: NodeId, b: NodeId): boolean {
  return contains(snapshot, a, b) || contains(snapshot, b, a)
}

function contains(snapshot: DocumentSnapshot, ancestorId: NodeId, nodeId: NodeId): boolean {
  let current = snapshot.nodes[nodeId]

  while (current) {
    if (current.id === ancestorId) return true
    current = current.parentId ? snapshot.nodes[current.parentId] : undefined
  }

  return false
}

// Figma appends a suffix when a name collides, and designers add spacing.
// Neither changes what the frame used to be.
function normalise(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ")
}
