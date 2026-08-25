import { existsSync, readFileSync } from "node:fs"
import { IGNORED_FIELDS, isModelled, normaliseField } from "../src/core/detect/fields.ts"

const TYPINGS_PATH = "node_modules/@figma/plugin-typings/plugin-api.d.ts"

function group(fields: readonly string[], reason: string): Array<[string, string]> {
  return fields.map((field) => [field, reason])
}

export const REPORTED_WITHOUT_VALUE: ReadonlyMap<string, string> = new Map([
  ...group(
    [
      "connectorStart",
      "connectorEnd",
      "connectorLineType",
      "connectorStartStrokeCap",
      "connectorEndStrokeCap",
    ],
    "FigJam only, and this plugin runs in editorType figma",
  ),

  ...group(
    [
      "code",
      "codeLanguage",
      "authorVisible",
      "authorName",
      "textBackground",
      "embedData",
      "linkUnfurlData",
      "mediaData",
    ],
    "Widget, code block and sticky metadata specific to FigJam and widgets",
  ),

  ...group(
    [
      "pointCount",
      "vectorNetwork",
      "arcData",
      "innerRadius",
      "shapeType",
      "handleMirroring",
      "booleanOperation",
    ],
    "Vector network and shape geometry that cannot be reasonably diffed as scalar values",
  ),

  ...group(
    [
      "strokeAlign",
      "strokeCap",
      "strokeJoin",
      "strokeMiterLimit",
      "dashPattern",
    ],
    "Secondary stroke parameters that the audit reports without diffing sub-properties",
  ),

  ...group(
    [
      "leadingTrim",
      "paragraphIndent",
      "paragraphSpacing",
      "textWrapStyle",
      "listSpacing",
      "hangingPunctuation",
      "hangingList",
      "textAlignHorizontal",
      "textAlignVertical",
      "textAutoResize",
      "textTruncation",
      "maxLines",
      "openTypeFeatures",
      "text",
      "hyperlink",
    ],
    "Paragraph layout, alignment and OpenType text settings not modelled in the snapshot",
  ),

  ...group(
    [
      "minWidth",
      "maxWidth",
      "minHeight",
      "maxHeight",
    ],
    "Min and max sizing boundaries that are not currently captured in node props",
  ),

  ...group(
    [
      "blendMode",
      "isMask",
      "maskType",
      "clipsContent",
      "cornerSmoothing",
      "overflowDirection",
      "itemReverseZIndex",
    ],
    "Layer compositing, masking and rendering settings not tracked in snapshot props",
  ),

  ...group(
    [
      "effects",
      "backgrounds",
      "backgroundStyleId",
      "gridStyleId",
      "layoutGrids",
      "guides",
      "description",
    ],
    "Effects, grid styles, guide lines and descriptions that the snapshot reader does not model",
  ),

  ...group(
    [
      "layoutWrap",
      "counterAxisSpacing",
      "counterAxisSizingMode",
      "primaryAxisSizingMode",
      "counterAxisAlignContent",
      "gridAutoTracks",
      "gridItemsPositioning",
    ],
    "Advanced auto layout wrap, grid tracks and sizing modes not modelled in LayoutProps",
  ),

  ...group(
    [
      "overlayPositionType",
      "overlayBackgroundInteraction",
      "overlayBackground",
      "animationStyles",
      "animations",
      "manualKeyframeTracks",
    ],
    "Prototyping overlay interactions and animation keyframe tracks outside static design drift",
  ),
])

export type FieldBucket = "ignored" | "modelled" | "reported-without-value" | "unclassified"

export function classifyField(field: string): FieldBucket {
  if (IGNORED_FIELDS.has(field)) return "ignored"
  if (isModelled(normaliseField(field))) return "modelled"
  if (REPORTED_WITHOUT_VALUE.has(field)) return "reported-without-value"
  return "unclassified"
}

export function extractNodeChangeProperties(typingsPath: string = TYPINGS_PATH): string[] {
  if (!existsSync(typingsPath)) {
    throw new Error(`Typings file not found at ${typingsPath}. Run npm install to fetch typings.`)
  }

  const content = readFileSync(typingsPath, "utf8")
  const lines = content.split("\n")
  const startIdx = lines.findIndex((line) => line.trim() === "type NodeChangeProperty =")

  if (startIdx === -1) {
    throw new Error(`Could not find "type NodeChangeProperty =" in ${typingsPath}`)
  }

  const pattern = /^\s*\|\s*'([a-zA-Z]+)'\s*$/
  const fields: string[] = []

  for (let i = startIdx + 1; i < lines.length; i += 1) {
    const match = lines[i]?.match(pattern)
    if (!match) break
    fields.push(match[1] as string)
  }

  if (fields.length === 0) {
    throw new Error(`Found zero fields under NodeChangeProperty in ${typingsPath}`)
  }

  return fields
}

function main(): void {
  let fields: string[]
  try {
    fields = extractNodeChangeProperties()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }

  const buckets: Record<FieldBucket, string[]> = {
    ignored: [],
    modelled: [],
    "reported-without-value": [],
    unclassified: [],
  }

  for (const field of fields) {
    const bucket = classifyField(field)
    buckets[bucket].push(field)
  }

  console.log(`field coverage: ${fields.length} total fields in NodeChangeProperty`)
  console.log(`  modelled: ${buckets.modelled.length}`)
  console.log(`  ignored: ${buckets.ignored.length}`)
  console.log(`  reported without value: ${buckets["reported-without-value"].length}`)

  if (buckets.unclassified.length > 0) {
    console.error(`\n${buckets.unclassified.length} unclassified field(s) found:`)
    for (const field of buckets.unclassified) {
      console.error(`  - ${field}`)
    }
    console.error("\nClassify each field in script/check-field-coverage.ts or src/core/detect/fields.ts rather than widening allowlists blindly.")
    process.exit(1)
  }

  process.exit(0)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
