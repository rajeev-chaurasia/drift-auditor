import type { FieldClass } from "../model/finding.ts"
import type { DocumentSnapshot, SnapshotNode } from "../model/snapshot.ts"
import { describePaints } from "../util/paint.ts"

export type FieldReader = (node: SnapshotNode, snapshot: DocumentSnapshot) => string | null

export interface FieldSpec {
  readonly fieldClass: FieldClass
  /** Absent when the snapshot does not carry the value. The override is still reported, without a diff. */
  readonly read?: FieldReader
}

/**
 * Overrides that are not drift, and the reason each one is here.
 *
 * `componentProperties` and its two companions are the sanctioned way to
 * configure an instance. A component author who exposes a text property is
 * asking for it to be set, and Figma records setting it as an override exactly
 * as it records a manual edit. Reporting these would flag correct use of a
 * design system as a defect, which is the opposite of the point.
 *
 * The position fields are excluded because auto layout rewrites them on every
 * reflow, so they carry almost no signal and a great deal of noise. That is a
 * real gap, recorded in docs/known-misses.md rather than hidden here.
 *
 * The rest are editor and prototyping state that no audit acts on.
 */
export const IGNORED_FIELDS: ReadonlySet<string> = new Set([
  "componentProperties",
  "componentPropertyDefinitions",
  "componentPropertyReferences",
  // Renaming an instance, or a layer inside one, is ordinary practice and
  // changes nothing anybody can see. Reporting it would put a finding against
  // every instance somebody bothered to name, which is most of them in a file
  // worth auditing.
  "name",
  "relativeTransform",
  "x",
  "y",
  "constraints",
  "layoutAlign",
  "layoutGrow",
  "layoutPositioning",
  "constrainProportions",
  // Auto layout hug and fill sizing. Figma reports these as liberally as it
  // reports position, and on a real file they were 358 of 848 override
  // findings, more than any real defect. Same trade as the position fields:
  // a genuine gap, recorded in docs/known-misses.md.
  "counterAxisSizingMode",
  "primaryAxisSizingMode",
  "parent",
  "type",
  "locked",
  "expanded",
  "autoRename",
  "pluginData",
  "exportSettings",
  "reactions",
  "prototypeStartNode",
  "prototypeBackgrounds",
  "flowStartingPoints",
  "widgetSyncedState",
  // Covered field by field by fontName, fontSize, fills and the rest.
  "styledTextSegments",
])

/** Figma reports each corner and each side separately. A reader wants one row. */
const ALIASES: Readonly<Record<string, string>> = {
  topLeftRadius: "cornerRadius",
  topRightRadius: "cornerRadius",
  bottomLeftRadius: "cornerRadius",
  bottomRightRadius: "cornerRadius",
  paddingLeft: "padding",
  paddingTop: "padding",
  paddingRight: "padding",
  paddingBottom: "padding",
  stokeTopWeight: "strokeWeight",
  strokeBottomWeight: "strokeWeight",
  strokeLeftWeight: "strokeWeight",
  strokeRightWeight: "strokeWeight",
}

export function normaliseField(field: string): string {
  return ALIASES[field] ?? field
}

const scalar =
  (read: (node: SnapshotNode) => unknown): FieldReader =>
  (node) => {
    const value = read(node)
    return value === undefined || value === null ? null : String(value)
  }

const styleName =
  (pick: (node: SnapshotNode) => string | undefined): FieldReader =>
  (node, snapshot) => {
    const id = pick(node)
    if (!id) return "none"
    const style = snapshot.styles[id]
    return style ? `${style.name}${style.remote ? "" : " (local)"}` : id
  }

const FIELDS: Readonly<Record<string, FieldSpec>> = {
  characters: { fieldClass: "content", read: scalar((node) => node.props.characters) },

  fills: { fieldClass: "colour", read: (node) => describePaints(node.props.fills) },
  strokes: { fieldClass: "colour", read: (node) => describePaints(node.props.strokes) },

  fillStyleId: { fieldClass: "style-binding", read: styleName((node) => node.props.styles?.fill) },
  strokeStyleId: { fieldClass: "style-binding", read: styleName((node) => node.props.styles?.stroke) },
  textStyleId: { fieldClass: "style-binding", read: styleName((node) => node.props.styles?.text) },
  effectStyleId: { fieldClass: "style-binding", read: styleName((node) => node.props.styles?.effect) },

  fontName: {
    fieldClass: "typography",
    read: (node) => {
      const type = node.props.typography
      if (!type) return null
      return `${type.fontFamily ?? "?"} ${type.fontStyle ?? "?"}`.trim()
    },
  },
  fontSize: { fieldClass: "typography", read: scalar((node) => node.props.typography?.fontSize) },
  lineHeight: { fieldClass: "typography", read: scalar((node) => node.props.typography?.lineHeight) },
  letterSpacing: { fieldClass: "typography", read: scalar((node) => node.props.typography?.letterSpacing) },
  textCase: { fieldClass: "typography", read: scalar((node) => node.props.typography?.textCase) },
  textDecoration: { fieldClass: "typography", read: scalar((node) => node.props.typography?.textDecoration) },

  width: { fieldClass: "geometry", read: scalar((node) => node.props.width) },
  height: { fieldClass: "geometry", read: scalar((node) => node.props.height) },
  cornerRadius: { fieldClass: "geometry", read: scalar((node) => node.props.cornerRadius) },
  strokeWeight: { fieldClass: "geometry", read: scalar((node) => node.props.strokeWeight) },
  rotation: { fieldClass: "geometry", read: scalar((node) => node.props.rotation) },

  visible: { fieldClass: "visibility", read: scalar((node) => node.visible) },
  opacity: { fieldClass: "visibility", read: scalar((node) => node.props.opacity) },

  layoutMode: { fieldClass: "layout", read: scalar((node) => node.props.layout?.mode) },
  padding: { fieldClass: "layout", read: scalar((node) => node.props.layout?.padding?.join(" ")) },
  itemSpacing: { fieldClass: "layout", read: scalar((node) => node.props.layout?.itemSpacing) },
  primaryAxisAlignItems: { fieldClass: "layout", read: scalar((node) => node.props.layout?.primaryAxisAlign) },
  counterAxisAlignItems: { fieldClass: "layout", read: scalar((node) => node.props.layout?.counterAxisAlign) },
}

const UNMODELLED: FieldSpec = { fieldClass: "other" }

export function specFor(field: string): FieldSpec {
  return FIELDS[field] ?? UNMODELLED
}

export function isModelled(field: string): boolean {
  return FIELDS[field] !== undefined
}
