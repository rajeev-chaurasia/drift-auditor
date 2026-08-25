import { findingId, type Finding } from "../model/finding.ts"
import type { DocumentSnapshot, NodeId, SnapshotNode } from "../model/snapshot.ts"
import { locate } from "../util/location.ts"
import { indexPath, resolveIndexPath, walkAll } from "../util/tree.ts"
import type { Detector } from "./detector.ts"
import { IGNORED_FIELDS, normaliseField, specFor } from "./fields.ts"

/**
 * Instances that no longer match the component they came from.
 *
 * Figma answers half of this itself. `InstanceNode.overrides` reports which
 * fields were overridden on which nodes, and it excludes overrides inherited
 * from an enclosing instance, so there is no double counting to undo. What it
 * does not report is what the field was overridden to, or what it was before,
 * and that difference is what a person needs in order to act. Producing it is
 * this detector's whole job.
 */
export class OverrideDriftDetector implements Detector {
  readonly category = "override-drift" as const

  detect(snapshot: DocumentSnapshot): Finding[] {
    const findings: Finding[] = []

    for (const node of walkAll(snapshot)) {
      if (node.type !== "INSTANCE" || !node.instance) continue
      findings.push(...this.forInstance(snapshot, node))
    }

    return findings
  }

  private forInstance(snapshot: DocumentSnapshot, instance: SnapshotNode): Finding[] {
    const info = instance.instance
    if (!info) return []

    const component = info.mainComponentKey ? snapshot.components[info.mainComponentKey] : undefined
    const owner = {
      id: instance.id,
      name: instance.name,
      ...(info.mainComponentKey !== null && { componentKey: info.mainComponentKey }),
      ...(component && { componentName: component.name }),
    }

    const findings: Finding[] = []
    const seen = new Set<string>()

    for (const override of info.overrides) {
      const subject = snapshot.nodes[override.nodeId]
      if (!subject) continue

      const baseline = this.baselineFor(snapshot, instance, subject)

      for (const rawField of override.fields) {
        if (IGNORED_FIELDS.has(rawField)) continue
        // A field a component property drives was configured, not drifted.
        if (subject.componentPropertyReferences?.[rawField]) continue

        const field = normaliseField(rawField)
        const id = findingId(this.category, subject.id, field)
        if (seen.has(id)) continue

        const finding = this.compare(snapshot, id, field, subject, baseline, owner)
        if (finding) {
          seen.add(id)
          findings.push(finding)
        }
      }
    }

    return findings
  }

  /**
   * The matching node inside the main component.
   *
   * An instance and its component share a structure but share no node ids, so
   * position is the only address that means the same thing in both. When the
   * types at that position disagree, the structures have diverged and the
   * match is not trustworthy, so the baseline is treated as absent. The
   * failure mode is a finding without a before-value, never a diff against the
   * wrong layer.
   */
  private baselineFor(
    snapshot: DocumentSnapshot,
    instance: SnapshotNode,
    subject: SnapshotNode,
  ): SnapshotNode | null {
    const mainId = instance.instance?.mainComponentNodeId
    if (!mainId) return null

    const path = indexPath(snapshot, instance.id, subject.id)
    if (!path) return null

    // The one type difference that is not divergence: an instance root is
    // always an INSTANCE and its baseline is always a COMPONENT.
    if (path.length === 0) return snapshot.nodes[mainId] ?? null

    const candidate = resolveIndexPath(snapshot, mainId, path)
    return candidate && candidate.type === subject.type ? candidate : null
  }

  private compare(
    snapshot: DocumentSnapshot,
    id: string,
    field: string,
    subject: SnapshotNode,
    baseline: SnapshotNode | null,
    owner: { id: NodeId; name: string; componentKey?: string; componentName?: string },
  ): Finding | null {
    const spec = specFor(field)
    const actual = spec.read ? spec.read(subject, snapshot) : null
    const expected = spec.read && baseline ? spec.read(baseline, snapshot) : null

    // Figma keeps reporting a field as overridden after it has been set back to
    // the component's value. The override is real, the drift is not, and
    // calling it drift would be a false positive by any reading a designer
    // would accept.
    if (spec.read && baseline && expected === actual) return null

    const note = !spec.read
      ? "Figma reports this field as overridden. This audit does not model its value."
      : !baseline
        ? "The main component could not be read, so there is no before-value."
        : undefined

    return {
      id,
      category: this.category,
      confidence: "exact",
      fieldClass: spec.fieldClass,
      field,
      subjectId: subject.id,
      subjectName: subject.name,
      location: locate(snapshot, subject.id, owner),
      expected,
      actual,
      baselineAvailable: baseline !== null,
      blastRadius: 1,
      ...(note && { note }),
    }
  }
}
