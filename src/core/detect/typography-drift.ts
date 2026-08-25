import { findingId, type Finding } from "../model/finding.ts"
import type { DocumentSnapshot, SnapshotNode, Typography } from "../model/snapshot.ts"
import { locate } from "../util/location.ts"
import { walkAll } from "../util/tree.ts"
import { blastRadius, inheritedBaseline, instanceReach, ownerOf } from "./attribution.ts"
import type { Detector } from "./detector.ts"

const TYPOGRAPHY_KEYS = ["fontFamily", "fontStyle", "fontSize", "lineHeight", "letterSpacing"] as const

export class TypographyDriftDetector implements Detector {
  readonly category = "typography-drift" as const

  detect(snapshot: DocumentSnapshot): Finding[] {
    const reach = instanceReach(snapshot)
    const findings: Finding[] = []
    const seen = new Set<string>()

    for (const node of walkAll(snapshot)) {
      if (node.type !== "TEXT") continue

      const typo = node.props.typography
      if (!typo) continue

      // Per-range styling has no single value to compare, and is recorded in capture.incomplete instead.
      if (hasMixedValue(typo)) continue

      if (isCompliant(snapshot, node, typo)) continue

      // A layer inside an instance that matches its component is the component's problem to solve.
      const baseline = inheritedBaseline(snapshot, node)
      if (baseline && inheritedUnchanged(node, baseline)) continue

      const owner = ownerOf(snapshot, node)
      const id = findingId(this.category, node.id, "typography")
      if (seen.has(id)) continue
      seen.add(id)

      const note = describeLoose(node, typo)

      findings.push({
        id,
        category: this.category,
        confidence: "exact",
        fieldClass: "typography",
        field: "typography",
        subjectId: node.id,
        subjectName: node.name,
        location: locate(snapshot, node.id, owner),
        expected: "a published text style, or a variable bound to every property",
        actual: describeTypography(typo),
        baselineAvailable: true,
        blastRadius: blastRadius(snapshot, node, reach),
        ...(note !== undefined && { note }),
      })
    }

    return findings
  }
}

// Any text style counts, published or not. See the note on isCompliant in
// paint-compliance.ts for the real file that settled this.
function isCompliant(snapshot: DocumentSnapshot, node: SnapshotNode, typo: Typography): boolean {
  const textStyleId = node.props.styles?.text
  if (textStyleId && snapshot.styles[textStyleId]) return true

  const bound = node.props.boundVariables ?? {}
  for (const key of TYPOGRAPHY_KEYS) {
    if (typo[key] !== undefined && !bound[key]) return false
  }

  return true
}

function hasMixedValue(typo: Typography): boolean {
  return Object.values(typo).some((value) => value === "mixed")
}

function inheritedUnchanged(node: SnapshotNode, baseline: SnapshotNode): boolean {
  if (node.props.styles?.text !== baseline.props.styles?.text) return false
  return typographyEquals(node.props.typography, baseline.props.typography)
}

function typographyEquals(a?: Typography, b?: Typography): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return (
    a.fontFamily === b.fontFamily &&
    a.fontStyle === b.fontStyle &&
    a.fontSize === b.fontSize &&
    a.lineHeight === b.lineHeight &&
    a.letterSpacing === b.letterSpacing &&
    a.textCase === b.textCase &&
    a.textDecoration === b.textDecoration
  )
}

function describeLoose(node: SnapshotNode, typo: Typography): string | undefined {
  const bound = node.props.boundVariables ?? {}
  const loose: string[] = []
  let boundCount = 0

  for (const key of TYPOGRAPHY_KEYS) {
    if (typo[key] !== undefined) {
      if (bound[key]) {
        boundCount += 1
      } else {
        loose.push(key)
      }
    }
  }

  return boundCount > 0 && loose.length > 0 ? `unbound: ${loose.join(", ")}` : undefined
}

export function describeTypography(typo: Typography): string {
  const parts: string[] = []
  const font = [typo.fontFamily, typo.fontStyle].filter(Boolean).join(" ")
  if (font) parts.push(font)

  if (typo.fontSize !== undefined && typo.lineHeight !== undefined) {
    parts.push(`${typo.fontSize}px/${typo.lineHeight}`)
  } else if (typo.fontSize !== undefined) {
    parts.push(`${typo.fontSize}px`)
  } else if (typo.lineHeight !== undefined) {
    parts.push(typo.lineHeight)
  }

  if (typo.letterSpacing) parts.push(typo.letterSpacing)

  return parts.length > 0 ? parts.join(" ") : "unspecified typography"
}
