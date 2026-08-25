import { toHex } from "../../core/util/paint.ts"
import type {
  Incompleteness,
  LayoutProps,
  NodeProps,
  NodeType,
  PaintRef,
  SnapshotNode,
  StyleBindings,
  Typography,
  VariableId,
} from "../../core/model/snapshot.ts"
import type { StyleResolver } from "./resolve-styles.ts"
import type { VariableResolver } from "./resolve-variables.ts"

export interface ReadContext {
  readonly styles: StyleResolver
  readonly variables: VariableResolver
  readonly incomplete: Incompleteness[]
}

const KNOWN_TYPES = new Set<string>([
  "PAGE",
  "FRAME",
  "GROUP",
  "SECTION",
  "COMPONENT",
  "COMPONENT_SET",
  "INSTANCE",
  "TEXT",
  "RECTANGLE",
  "ELLIPSE",
  "LINE",
  "POLYGON",
  "STAR",
  "VECTOR",
  "BOOLEAN_OPERATION",
  "SLICE",
])

function toNodeType(type: string): NodeType {
  return KNOWN_TYPES.has(type) ? (type as NodeType) : "OTHER"
}

function isMixed(value: unknown): boolean {
  return value === figma.mixed
}

function numberOrMixed(value: number | symbol | undefined): number | "mixed" | undefined {
  if (value === undefined) return undefined
  return isMixed(value) ? "mixed" : (value as number)
}

function describeLineHeight(value: LineHeight | symbol): string {
  if (isMixed(value)) return "mixed"
  const height = value as LineHeight
  if (height.unit === "AUTO") return "auto"
  return `${height.value}${height.unit === "PERCENT" ? "%" : "px"}`
}

function describeLetterSpacing(value: LetterSpacing | symbol): string {
  if (isMixed(value)) return "mixed"
  const spacing = value as LetterSpacing
  return `${spacing.value}${spacing.unit === "PERCENT" ? "%" : "px"}`
}

async function readPaint(paint: Paint, variables: VariableResolver): Promise<PaintRef> {
  const visible = paint.visible !== false

  switch (paint.type) {
    case "SOLID": {
      const bound = paint.boundVariables?.color
      const variableId = bound ? ((await variables.note(bound.id)) ?? null) : null
      return {
        kind: "solid",
        hex: toHex(paint.color),
        opacity: paint.opacity ?? 1,
        visible,
        variableId: variableId as VariableId | null,
      }
    }
    case "GRADIENT_LINEAR":
    case "GRADIENT_RADIAL":
    case "GRADIENT_ANGULAR":
    case "GRADIENT_DIAMOND": {
      const stops = paint.gradientStops
        .map((stop) => `${toHex(stop.color)}@${stop.position.toFixed(3)}`)
        .join(" ")
      return { kind: "gradient", gradient: `${paint.type} ${stops}`, visible }
    }
    case "IMAGE":
      return { kind: "image", visible }
    case "VIDEO":
      return { kind: "video", visible }
    default:
      return { kind: "unsupported", paintType: paint.type, visible }
  }
}

async function readPaints(
  value: readonly Paint[] | symbol | undefined,
  nodeId: string,
  context: ReadContext,
): Promise<readonly PaintRef[] | undefined> {
  if (value === undefined) return undefined

  // Mixed means the node's own paints differ across its text ranges. There is
  // no single value to compare, so it is carried as an unbindable paint and
  // recorded, rather than dropped into a silent gap in coverage.
  if (isMixed(value)) {
    context.incomplete.push({ nodeId, reason: "mixed-value", detail: "paints differ across ranges" })
    return [{ kind: "unsupported", paintType: "MIXED", visible: true }]
  }

  return Promise.all((value as readonly Paint[]).map((paint) => readPaint(paint, context.variables)))
}

async function readStyleBindings(node: SceneNode, context: ReadContext): Promise<StyleBindings | undefined> {
  const bindings: { -readonly [K in keyof StyleBindings]: StyleBindings[K] } = {}

  if ("fillStyleId" in node) {
    const id = await context.styles.note(node.fillStyleId as string | symbol)
    if (id) bindings.fill = id
  }
  if ("strokeStyleId" in node) {
    const id = await context.styles.note(node.strokeStyleId as string | symbol)
    if (id) bindings.stroke = id
  }
  if (node.type === "TEXT") {
    const id = await context.styles.note(node.textStyleId as string | symbol)
    if (id) bindings.text = id
  }
  if ("effectStyleId" in node) {
    const id = await context.styles.note(node.effectStyleId as string | symbol)
    if (id) bindings.effect = id
  }

  return Object.keys(bindings).length > 0 ? bindings : undefined
}

// Paint bindings live on the paint, so only the scalar fields are read here.
// Taking both would report the same token twice and inflate coverage.
async function readScalarVariables(
  node: SceneNode,
  context: ReadContext,
): Promise<Record<string, VariableId> | undefined> {
  const bound = (node as { boundVariables?: Record<string, unknown> }).boundVariables
  if (!bound) return undefined

  const result: Record<string, VariableId> = {}
  for (const [field, value] of Object.entries(bound)) {
    const alias = value as { id?: string } | undefined
    if (!alias || typeof alias.id !== "string") continue
    const id = await context.variables.note(alias.id)
    if (id) result[field] = id
  }

  return Object.keys(result).length > 0 ? result : undefined
}

function readTypography(node: TextNode): Typography {
  const font = node.fontName
  const typography: { -readonly [K in keyof Typography]: Typography[K] } = {
    fontFamily: isMixed(font) ? "mixed" : (font as FontName).family,
    fontStyle: isMixed(font) ? "mixed" : (font as FontName).style,
    lineHeight: describeLineHeight(node.lineHeight),
    letterSpacing: describeLetterSpacing(node.letterSpacing),
    textCase: isMixed(node.textCase) ? "mixed" : (node.textCase as string),
    textDecoration: isMixed(node.textDecoration) ? "mixed" : (node.textDecoration as string),
  }

  const size = numberOrMixed(node.fontSize)
  if (size !== undefined) typography.fontSize = size

  return typography
}

function readLayout(node: SceneNode): LayoutProps | undefined {
  if (!("layoutMode" in node) || node.layoutMode === "NONE") return undefined

  return {
    mode: node.layoutMode,
    padding: [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft],
    itemSpacing: node.itemSpacing,
    primaryAxisAlign: node.primaryAxisAlignItems,
    counterAxisAlign: node.counterAxisAlignItems,
  }
}

async function readProps(node: SceneNode, context: ReadContext): Promise<NodeProps> {
  const props: { -readonly [K in keyof NodeProps]: NodeProps[K] } = {}

  if ("width" in node) props.width = Math.round(node.width * 100) / 100
  if ("height" in node) props.height = Math.round(node.height * 100) / 100
  if ("opacity" in node) props.opacity = node.opacity
  if ("rotation" in node) props.rotation = Math.round(node.rotation * 100) / 100

  const corner = "cornerRadius" in node ? numberOrMixed(node.cornerRadius) : undefined
  if (corner !== undefined) props.cornerRadius = corner

  const weight = "strokeWeight" in node ? numberOrMixed(node.strokeWeight) : undefined
  if (weight !== undefined) props.strokeWeight = weight

  if ("fills" in node) {
    const fills = await readPaints(node.fills as readonly Paint[] | symbol, node.id, context)
    if (fills) props.fills = fills
  }
  if ("strokes" in node) {
    const strokes = await readPaints(node.strokes as readonly Paint[] | symbol, node.id, context)
    if (strokes) props.strokes = strokes
  }

  if (node.type === "TEXT") {
    props.characters = node.characters
    props.typography = readTypography(node)
  }

  const layout = readLayout(node)
  if (layout) props.layout = layout

  const styles = await readStyleBindings(node, context)
  if (styles) props.styles = styles

  const boundVariables = await readScalarVariables(node, context)
  if (boundVariables) props.boundVariables = boundVariables

  return props
}

/** One Figma node as one snapshot node. Instance wiring is attached later. */
export async function readNode(
  node: SceneNode | PageNode,
  parentId: string | null,
  context: ReadContext,
): Promise<SnapshotNode> {
  const isPage = node.type === "PAGE"
  const childIds = "children" in node ? node.children.map((child) => child.id) : []

  const base = {
    id: node.id,
    name: node.name,
    type: toNodeType(node.type),
    parentId,
    childIds,
    visible: isPage ? true : (node as SceneNode).visible,
  }

  if (isPage) return { ...base, props: {} }

  const scene = node as SceneNode
  const props = await readProps(scene, context)

  return scene.type === "COMPONENT"
    ? { ...base, props, componentKey: scene.key }
    : { ...base, props }
}
