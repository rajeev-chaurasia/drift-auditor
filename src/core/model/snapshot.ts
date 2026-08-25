// A Figma file reduced to the facts an audit needs, and nothing else.
//
// Everything downstream of this file is pure. That is deliberate: a finding
// produced from a snapshot can be reproduced by anyone holding the same
// snapshot, on a machine with no Figma on it. The plugin is one producer of
// these; a committed fixture is another.

export type NodeId = string
export type StyleId = string
export type VariableId = string
export type ComponentKey = string

export const SCHEMA_VERSION = 1

export interface DocumentSnapshot {
  readonly schema: number
  readonly file: FileMeta
  readonly capture: CaptureMeta
  readonly pageIds: readonly NodeId[]
  readonly nodes: Readonly<Record<NodeId, SnapshotNode>>
  readonly components: Readonly<Record<ComponentKey, ComponentRecord>>
  readonly styles: Readonly<Record<StyleId, StyleRecord>>
  readonly variables: Readonly<Record<VariableId, VariableRecord>>
}

export interface FileMeta {
  readonly name: string
  readonly rootId: NodeId
}

// What the traversal did, recorded because it changes what gets counted. A
// scan that skipped invisible instance children and one that did not are not
// comparable, and a reader cannot tell them apart from the findings alone.
export interface CaptureMeta {
  readonly recordedAt: string
  readonly producer: string
  readonly pagesLoaded: number
  readonly skipInvisibleInstanceChildren: boolean
  readonly nodesVisited: number
  readonly durationMs: number
  readonly incomplete: readonly Incompleteness[]
}

// Anything the reader could not resolve. Findings derived from an incomplete
// region are reported at reduced confidence rather than dropped, so this list
// is load-bearing rather than diagnostic.
export interface Incompleteness {
  readonly nodeId: NodeId
  readonly reason: "remote-baseline-unreadable" | "read-failed" | "mixed-value"
  readonly detail: string
}

export type NodeType =
  | "PAGE"
  | "FRAME"
  | "GROUP"
  | "SECTION"
  | "COMPONENT"
  | "COMPONENT_SET"
  | "INSTANCE"
  | "TEXT"
  | "RECTANGLE"
  | "ELLIPSE"
  | "LINE"
  | "POLYGON"
  | "STAR"
  | "VECTOR"
  | "BOOLEAN_OPERATION"
  | "SLICE"
  | "OTHER"

export interface SnapshotNode {
  readonly id: NodeId
  readonly name: string
  readonly type: NodeType
  readonly parentId: NodeId | null
  readonly childIds: readonly NodeId[]
  readonly visible: boolean
  readonly props: NodeProps
  readonly instance?: InstanceInfo
  readonly componentKey?: ComponentKey
  // Present on layers inside a component or instance that a component property
  // drives. Setting such a property is the sanctioned way to configure an
  // instance, and it shows up in overrides exactly like a manual edit does, so
  // this is what keeps intended configuration from being reported as drift.
  readonly componentPropertyReferences?: Readonly<Record<string, string>>
}

export interface InstanceInfo {
  readonly mainComponentKey: ComponentKey | null
  readonly mainComponentNodeId: NodeId | null
  // False when the main component lives in a library this file cannot read.
  // Override findings against such an instance carry no before-value.
  readonly baselineAvailable: boolean
  readonly overrides: readonly OverrideRecord[]
  readonly componentProperties: Readonly<Record<string, string>>
}

// Mirrors InstanceNode.overrides. Figma reports which fields were overridden
// but not what they were overridden to, and it excludes overrides inherited
// from a parent instance. Both facts drive the override detector.
export interface OverrideRecord {
  readonly nodeId: NodeId
  readonly fields: readonly string[]
}

export interface ComponentRecord {
  readonly key: ComponentKey
  readonly name: string
  readonly remote: boolean
  // Null when the component is remote and its subtree could not be read, which
  // is the only case where an override has no baseline to diff against.
  readonly nodeId: NodeId | null
}

export interface StyleRecord {
  readonly id: StyleId
  readonly key: string
  readonly name: string
  readonly type: "PAINT" | "TEXT" | "EFFECT" | "GRID"
  // A remote style came from a library that was published, which is the only
  // signal available for "this is a real design token".
  readonly remote: boolean
}

export interface VariableRecord {
  readonly id: VariableId
  readonly key: string
  readonly name: string
  readonly resolvedType: string
  readonly collectionId: string
  readonly remote: boolean
}

export interface NodeProps {
  readonly width?: number
  readonly height?: number
  readonly opacity?: number
  readonly rotation?: number
  readonly cornerRadius?: number | "mixed"
  readonly strokeWeight?: number | "mixed"
  readonly fills?: readonly PaintRef[]
  readonly strokes?: readonly PaintRef[]
  readonly characters?: string
  readonly typography?: Typography
  readonly layout?: LayoutProps
  readonly styles?: StyleBindings
  // Field name to variable, for everything bindable that is not a paint.
  // Paint bindings live on the paint itself, because that is where Figma
  // puts them.
  readonly boundVariables?: Readonly<Record<string, VariableId>>
}

// Normalised so a colour comparison is a string comparison, and so the one
// distinction the token detector depends on, whether a variable could have
// been bound at all, is carried by the type rather than rediscovered.
export type PaintRef =
  | {
      readonly kind: "solid"
      readonly hex: string
      readonly opacity: number
      readonly visible: boolean
      readonly variableId: VariableId | null
    }
  | { readonly kind: "gradient"; readonly gradient: string; readonly visible: boolean }
  | { readonly kind: "image"; readonly visible: boolean }
  | { readonly kind: "video"; readonly visible: boolean }
  | { readonly kind: "unsupported"; readonly paintType: string; readonly visible: boolean }

export const BINDABLE_PAINT_KINDS: readonly PaintRef["kind"][] = ["solid"]

export function isBindablePaint(paint: PaintRef): paint is Extract<PaintRef, { kind: "solid" }> {
  return paint.kind === "solid"
}

export interface Typography {
  readonly fontFamily?: string
  readonly fontStyle?: string
  readonly fontSize?: number | "mixed"
  readonly lineHeight?: string
  readonly letterSpacing?: string
  readonly textCase?: string
  readonly textDecoration?: string
}

export interface LayoutProps {
  readonly mode?: string
  readonly padding?: readonly [number, number, number, number]
  readonly itemSpacing?: number
  readonly primaryAxisAlign?: string
  readonly counterAxisAlign?: string
}

export interface StyleBindings {
  readonly fill?: StyleId
  readonly stroke?: StyleId
  readonly text?: StyleId
  readonly effect?: StyleId
}
