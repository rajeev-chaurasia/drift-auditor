import type { LabelSet } from "../../../src/core/accuracy/labels.ts"
import {
  ALARM,
  BRAND,
  CARD_BG,
  COMPONENTS_PAGE,
  FONT,
  ORANGE,
  Recorder,
  SCRATCH_GREEN,
  USAGE_PAGE,
  boundSolid,
  label,
  rectangle,
  solid,
} from "./parts.ts"

/**
 * Builds a Figma file with known drift in it, and writes down what it built.
 *
 * The labels come from this file rather than from what the auditor reports,
 * which is the property that makes recall mean anything. Nothing here reads a
 * detector, and the two only meet when the evidence validator runs.
 *
 * What Figma computes is what gets measured. This code asks for a text
 * override and Figma decides what lands in `overrides`, what
 * `componentPropertyReferences` says, and whether an override survives being
 * set back. Those are the answers the audit is checked against, not this
 * file's opinion of them.
 */
export interface BuildResult {
  readonly labels: LabelSet
  readonly log: Recorder["log"]
}

export async function buildFixture(): Promise<BuildResult> {
  await figma.loadFontAsync(FONT)

  const recorder = new Recorder()

  const components = figma.createPage()
  components.name = COMPONENTS_PAGE
  const usage = figma.createPage()
  usage.name = USAGE_PAGE

  const collection = figma.variables.createVariableCollection("Tokens")
  const brand = figma.variables.createVariable("colour/brand", collection, "COLOR")
  brand.setValueForMode(collection.modes[0]!.modeId, { ...boundValue(BRAND) })

  const scratch = figma.createPaintStyle()
  scratch.name = "Scratch/Green"
  scratch.paints = [solid(SCRATCH_GREEN)]

  const bodyStyle = figma.createTextStyle()
  bodyStyle.name = "Type/Body"
  bodyStyle.fontName = FONT
  bodyStyle.fontSize = 14

  const card = buildCard(components, brand, recorder)
  const button = buildButton(components, brand, recorder)

  await buildCardUsages(usage, card, recorder)
  await buildButtonUsages(usage, button, recorder)
  await buildSwatches(usage, brand, scratch, recorder)
  await buildTypography(usage, collection, bodyStyle, recorder)
  await buildDetachment(usage, card, recorder)

  figma.currentPage = usage

  return {
    labels: {
      snapshot: "snapshot.json",
      split: "held-out",
      notes:
        "Built by tools/fixture-builder. Cases involving a published library are absent, " +
        "because publishing a library needs a paid Figma plan. See docs/known-misses.md.",
      cases: recorder.cases,
    },
    log: recorder.log,
  }
}

function boundValue(hex: string): RGB {
  const value = parseInt(hex.slice(1), 16)
  return { r: ((value >> 16) & 255) / 255, g: ((value >> 8) & 255) / 255, b: (value & 255) / 255 }
}

/** No auto layout anywhere, so that hiding or resizing a child cannot reflow its parent into an override nobody asked for. */
function buildCard(page: PageNode, brand: Variable, recorder: Recorder): ComponentNode {
  const card = figma.createComponent()
  card.name = "Card"
  page.appendChild(card)
  card.resize(240, 120)
  card.x = 0
  card.y = 0
  card.cornerRadius = 8
  card.fills = [solid(CARD_BG)]

  const title = label("Title", "Card title", 16)
  const body = label("Body", "Body copy", 14)
  const accent = rectangle("Accent", 40, 4, [boundSolid(BRAND, brand)])

  card.appendChild(title)
  card.appendChild(body)
  card.appendChild(accent)
  title.x = 16
  title.y = 16
  body.x = 16
  body.y = 52
  accent.x = 16
  accent.y = 96

  recorder.expect({
    page: COMPONENTS_PAGE,
    path: "Card",
    field: "fills[0]",
    category: "token-drift",
    why: "the component types its background white instead of binding a variable, and every instance inherits it",
  })
  for (const layer of ["Title", "Body"]) {
    recorder.expect({
      page: COMPONENTS_PAGE,
      path: `Card / ${layer}`,
      field: "typography",
      category: "typography-drift",
      why: "type set by hand in the component, following no style and no variable",
    })
  }

  return card
}

interface Button {
  readonly node: ComponentNode
  readonly propertyId: string
}

function buildButton(page: PageNode, brand: Variable, recorder: Recorder): Button {
  const node = figma.createComponent()
  node.name = "Button"
  page.appendChild(node)
  node.resize(120, 40)
  node.x = 320
  node.y = 0
  node.cornerRadius = 8
  node.fills = [boundSolid(BRAND, brand)]

  const text = label("Label", "Submit", 14)
  node.appendChild(text)
  text.x = 16
  text.y = 10
  text.resize(88, 20)

  // Returns the name with a unique suffix, which is what both the reference on
  // the child and setProperties on an instance have to use.
  const propertyId = node.addComponentProperty("Label", "TEXT", "Submit")
  text.componentPropertyReferences = { characters: propertyId }

  recorder.expect({
    page: COMPONENTS_PAGE,
    path: "Button / Label",
    field: "typography",
    category: "typography-drift",
    why: "the same, in the other component",
  })

  return { node, propertyId }
}

async function buildCardUsages(page: PageNode, card: ComponentNode, recorder: Recorder): Promise<void> {
  const place = (instance: InstanceNode, name: string, y: number): void => {
    page.appendChild(instance)
    instance.name = name
    instance.x = 0
    instance.y = y
  }

  await recorder.step("Card drifted", () => {
    const instance = card.createInstance()
    place(instance, "Card drifted", 0)
    instance.fills = [solid(ALARM)]
    ;(instance.children[0] as TextNode).characters = "Changed title"
    ;(instance.children[1] as TextNode).fontSize = 18
    instance.children[2]!.visible = false

    recorder.expect({
      page: USAGE_PAGE,
      path: "Card drifted",
      field: "fills",
      category: "override-drift",
      why: "the background was repainted on this instance only",
    })
    recorder.expect({
      page: USAGE_PAGE,
      path: "Card drifted",
      field: "fills[0]",
      category: "token-drift",
      why: "and the colour it was repainted with is in no collection",
    })
    recorder.expect({
      page: USAGE_PAGE,
      path: "Card drifted / Title",
      field: "characters",
      category: "override-drift",
      why: "the title was retyped rather than set through a property",
    })
    recorder.expect({
      page: USAGE_PAGE,
      path: "Card drifted / Body",
      field: "fontSize",
      category: "override-drift",
      why: "the body type size was nudged away from the component",
    })
    recorder.expect({
      page: USAGE_PAGE,
      path: "Card drifted / Body",
      field: "typography",
      category: "typography-drift",
      why: "and once it differs from the component, the instance owns the untokenised type itself",
    })
    recorder.expect({
      page: USAGE_PAGE,
      path: "Card drifted / Accent",
      field: "visible",
      category: "override-drift",
      why: "the accent bar was hidden on this instance only",
    })
  })

  // No labels. Figma may or may not keep reporting the override once the value
  // is back, and whichever it does is worth knowing: if it clears the override
  // then the detector's rule for this is unnecessary and should be deleted.
  await recorder.step("Card reverted", () => {
    const instance = card.createInstance()
    place(instance, "Card reverted", 160)
    const title = instance.children[0] as TextNode
    title.characters = "Temporarily changed"
    title.characters = "Card title"
  })

  await recorder.step("Card untouched", () => {
    place(card.createInstance(), "Card untouched", 320)
  })

  // `locked` is editor state. No labels, and reporting it would be a defect.
  await recorder.step("Card locked", () => {
    const instance = card.createInstance()
    place(instance, "Card locked", 480)
    instance.children[2]!.locked = true
  })
}

async function buildButtonUsages(page: PageNode, button: Button, recorder: Recorder): Promise<void> {
  // The single most likely false positive in the whole audit. Setting an
  // exposed property is using the design system correctly, and Figma records
  // it in `overrides` exactly as it records a manual edit.
  await recorder.step("Button configured", () => {
    const instance = button.node.createInstance()
    page.appendChild(instance)
    instance.name = "Button configured"
    instance.x = 320
    instance.y = 0
    instance.setProperties({ [button.propertyId]: "Add to basket" })
  })

  await recorder.step("Button untouched", () => {
    const instance = button.node.createInstance()
    page.appendChild(instance)
    instance.name = "Button untouched"
    instance.x = 320
    instance.y = 80
  })
}

async function buildSwatches(
  page: PageNode,
  brand: Variable,
  scratch: PaintStyle,
  recorder: Recorder,
): Promise<void> {
  const place = (node: SceneNode, y: number): void => {
    page.appendChild(node)
    node.x = 520
    node.y = y
  }

  await recorder.step("Tokenised swatch", () => {
    place(rectangle("Tokenised swatch", 80, 40, [boundSolid(BRAND, brand)]), 0)
  })

  await recorder.step("Scratch swatch", async () => {
    const node = rectangle("Scratch swatch", 80, 40, [solid(SCRATCH_GREEN)])
    place(node, 60)
    await node.setFillStyleIdAsync(scratch.id)

    recorder.expect({
      page: USAGE_PAGE,
      path: "Scratch swatch",
      field: "fills[0]",
      category: "token-drift",
      why: "it points at a local style, and a style nobody published is not a token",
    })
  })

  await recorder.step("Raw swatch", () => {
    place(rectangle("Raw swatch", 80, 40, [solid(ORANGE)]), 120)

    recorder.expect({
      page: USAGE_PAGE,
      path: "Raw swatch",
      field: "fills[0]",
      category: "token-drift",
      why: "a colour typed straight in, following nothing",
    })
  })

  // No label. A variable cannot be bound to a gradient, so reporting it would
  // be reporting the platform.
  await recorder.step("Gradient panel", () => {
    const gradient: GradientPaint = {
      type: "GRADIENT_LINEAR",
      gradientTransform: [
        [1, 0, 0],
        [0, 1, 0],
      ],
      gradientStops: [
        { position: 0, color: { ...boundValue(BRAND), a: 1 } },
        { position: 1, color: { ...boundValue(ALARM), a: 1 } },
      ],
    }
    place(rectangle("Gradient panel", 80, 40, [gradient]), 180)
  })

  // No label. A paint nobody can see has not drifted.
  await recorder.step("Hidden swatch", () => {
    place(rectangle("Hidden swatch", 80, 40, [solid(ORANGE, false)]), 240)
  })
}

/**
 * Typography, where a free Figma plan bites.
 *
 * Publishing a library needs a paid plan, so no style in this file can ever be
 * remote and the published-style path to compliance cannot be exercised here.
 * Binding a variable to every typographic property is the only compliant route
 * left, which is what the first case does.
 */
async function buildTypography(
  page: PageNode,
  collection: VariableCollection,
  bodyStyle: TextStyle,
  recorder: Recorder,
): Promise<void> {
  const mode = collection.modes[0]!.modeId

  const string = (name: string, value: string): Variable => {
    const variable = figma.variables.createVariable(name, collection, "STRING")
    variable.setValueForMode(mode, value)
    return variable
  }

  const number = (name: string, value: number): Variable => {
    const variable = figma.variables.createVariable(name, collection, "FLOAT")
    variable.setValueForMode(mode, value)
    return variable
  }

  const place = (node: SceneNode, y: number): void => {
    page.appendChild(node)
    node.x = 640
    node.y = y
  }

  // No label. Every property follows a variable, which is the only way to be
  // tokenised in a file that cannot publish a library.
  await recorder.step("Bound heading", () => {
    const node = label("Bound heading", "Bound heading", 24)
    place(node, 320)
    node.setBoundVariable("fontFamily", string("type/family", FONT.family))
    node.setBoundVariable("fontStyle", string("type/style", FONT.style))
    node.setBoundVariable("fontSize", number("type/heading-size", 24))
    node.setBoundVariable("lineHeight", number("type/heading-line", 32))
    node.setBoundVariable("letterSpacing", number("type/heading-tracking", 0))
  })

  await recorder.step("Half bound heading", () => {
    const node = label("Half bound heading", "Half bound", 24)
    place(node, 380)
    node.setBoundVariable("fontSize", number("type/subhead-size", 24))

    recorder.expect({
      page: USAGE_PAGE,
      path: "Half bound heading",
      field: "typography",
      category: "typography-drift",
      why: "one property follows a variable and the rest were typed in, which is not tokenised type",
    })
  })

  await recorder.step("Styled heading", async () => {
    const node = label("Styled heading", "Styled", 14)
    place(node, 440)
    await node.setTextStyleIdAsync(bodyStyle.id)

    recorder.expect({
      page: USAGE_PAGE,
      path: "Styled heading",
      field: "typography",
      category: "typography-drift",
      why: "it follows a local text style, and a style nobody published is not a token",
    })
  })
}

async function buildDetachment(page: PageNode, card: ComponentNode, recorder: Recorder): Promise<void> {
  /** Wrappers carry no fill, so they add no paint of their own for the token detector to find. */
  const section = (name: string, y: number): FrameNode => {
    const frame = figma.createFrame()
    frame.name = name
    page.appendChild(frame)
    frame.resize(280, 160)
    frame.x = 700
    frame.y = y
    frame.fills = []
    frame.clipsContent = false
    return frame
  }

  await recorder.step("Detached untouched", () => {
    const frame = section("Detached untouched", 0)
    const instance = card.createInstance()
    frame.appendChild(instance)
    const detached = instance.detachInstance()
    detached.x = 20
    detached.y = 20

    recorder.expect({
      page: USAGE_PAGE,
      path: "Detached untouched / Card",
      field: "structure",
      category: "detachment",
      why: "an instance was detached and left alone, so both its shape and its name still match Card",
    })
    recorder.expect({
      page: USAGE_PAGE,
      path: "Detached untouched / Card",
      field: "fills[0]",
      category: "token-drift",
      why: "detaching froze the component's hardcoded white into a frame of its own",
    })
    for (const layer of ["Title", "Body"]) {
      recorder.expect({
        page: USAGE_PAGE,
        path: `Detached untouched / Card / ${layer}`,
        field: "typography",
        category: "typography-drift",
        why: "detaching froze the component's untokenised type here too, and no component owns it now",
      })
    }
  })

  // Structurally changed, so its shape no longer matches. Whether the name
  // alone carries it over the threshold is the thing this case measures.
  await recorder.step("Detached edited", () => {
    const frame = section("Detached edited", 200)
    const instance = card.createInstance()
    frame.appendChild(instance)
    const detached = instance.detachInstance()
    detached.x = 20
    detached.y = 20
    const extra = label("Footnote", "Terms apply", 11)
    detached.appendChild(extra)
    extra.x = 16
    extra.y = 104

    recorder.expect({
      page: USAGE_PAGE,
      path: "Detached edited / Card",
      field: "fills[0]",
      category: "token-drift",
      why: "the same frozen white, in a frame that was then edited",
    })
    for (const layer of ["Title", "Body", "Footnote"]) {
      recorder.expect({
        page: USAGE_PAGE,
        path: `Detached edited / Card / ${layer}`,
        field: "typography",
        category: "typography-drift",
        why: "frozen untokenised type, including the layer that was added afterwards",
      })
    }
  })

  // No detachment label. A frame that borrowed a name and nothing else is the
  // false positive the threshold exists to sit above.
  await recorder.step("Name collision", () => {
    const frame = section("Name collision", 400)
    const impostor = figma.createFrame()
    impostor.name = "Card"
    frame.appendChild(impostor)
    impostor.resize(600, 600)
    impostor.x = 20
    impostor.y = 20
    impostor.fills = []
    for (const [index, name] of ["One", "Two", "Three", "Four"].entries()) {
      const child = figma.createEllipse()
      child.name = name
      child.fills = []
      impostor.appendChild(child)
      child.x = index * 20
      child.y = 0
    }
  })
}
