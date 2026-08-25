/**
 * Enough of the Figma plugin API to run the snapshot reader against.
 *
 * The reader is the only code in this repository that cannot be tested through
 * a committed fixture, because its whole job is to turn the live API into one.
 * Left untested it would be the single place where a wrong answer produces a
 * plausible snapshot and every number downstream inherits the mistake, which
 * is exactly the failure the rest of the design rules out.
 */

export const MIXED = Symbol("figma.mixed")

export interface FakeNode {
  id: string
  type: string
  name: string
  visible?: boolean
  children?: FakeNode[]
  key?: string
  remote?: boolean
  width?: number
  height?: number
  opacity?: number
  fills?: unknown
  strokes?: unknown
  fillStyleId?: string | symbol
  textStyleId?: string | symbol
  cornerRadius?: number | symbol
  characters?: string
  fontName?: unknown
  fontSize?: number | symbol
  lineHeight?: unknown
  letterSpacing?: unknown
  textCase?: string | symbol
  textDecoration?: string | symbol
  boundVariables?: Record<string, unknown>
  componentPropertyReferences?: Record<string, string> | null
  overrides?: Array<{ id: string; overriddenFields: string[] }>
  componentProperties?: Record<string, { value: unknown }>
  mainComponent?: FakeNode | null
  mainComponentThrows?: boolean
}

export interface FakeStyle {
  id: string
  key: string
  name: string
  type: string
  remote: boolean
}

export interface FakeVariable {
  id: string
  key: string
  name: string
  resolvedType: string
  variableCollectionId: string
  remote: boolean
}

export interface FakeDocument {
  name: string
  pages: FakeNode[]
  styles?: FakeStyle[]
  variables?: FakeVariable[]
}

/** Text nodes need every property the reader reads, or it throws on a real file. */
export function text(id: string, name: string, characters: string, extra: Partial<FakeNode> = {}): FakeNode {
  return {
    id,
    type: "TEXT",
    name,
    visible: true,
    characters,
    fontName: { family: "Inter", style: "Regular" },
    fontSize: 14,
    lineHeight: { unit: "PIXELS", value: 20 },
    letterSpacing: { unit: "PIXELS", value: 0 },
    textCase: "ORIGINAL",
    textDecoration: "NONE",
    ...extra,
  }
}

export function solid(hex: string, boundVariableId?: string) {
  const value = parseInt(hex.slice(1), 16)
  return {
    type: "SOLID",
    visible: true,
    opacity: 1,
    color: { r: ((value >> 16) & 255) / 255, g: ((value >> 8) & 255) / 255, b: (value & 255) / 255 },
    ...(boundVariableId && { boundVariables: { color: { type: "VARIABLE_ALIAS", id: boundVariableId } } }),
  }
}

/** Installs the fake as the `figma` global and returns a function that removes it. */
export function installFigma(document: FakeDocument): () => void {
  const styles = new Map((document.styles ?? []).map((style) => [style.id, style]))
  const variables = new Map((document.variables ?? []).map((variable) => [variable.id, variable]))

  const api = {
    mixed: MIXED,
    skipInvisibleInstanceChildren: false,
    root: { id: "0:0", name: document.name, children: document.pages },
    loadAllPagesAsync: async () => undefined,
    getStyleByIdAsync: async (id: string) => styles.get(id) ?? null,
    variables: {
      getVariableByIdAsync: async (id: string) => variables.get(id) ?? null,
    },
  }

  const previous = (globalThis as Record<string, unknown>).figma
  ;(globalThis as Record<string, unknown>).figma = api

  // The reader calls getMainComponentAsync on instances, which a plain object
  // literal in a test cannot carry without this wiring.
  const wire = (node: FakeNode): void => {
    if (node.type === "INSTANCE") {
      const instance = node as FakeNode & { getMainComponentAsync?: () => Promise<FakeNode | null> }
      instance.getMainComponentAsync = async () => {
        if (node.mainComponentThrows) throw new Error("library not reachable")
        return node.mainComponent ?? null
      }
      node.overrides ??= []
      node.componentProperties ??= {}
    }
    for (const child of node.children ?? []) wire(child)
  }
  for (const page of document.pages) wire(page)

  return () => {
    ;(globalThis as Record<string, unknown>).figma = previous
  }
}
