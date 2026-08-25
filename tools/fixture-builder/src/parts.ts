import type { Category } from "../../../src/core/model/finding.ts"

export const COMPONENTS_PAGE = "Components"
export const USAGE_PAGE = "Usage"

export const BRAND = "#0D99FF"
export const CARD_BG = "#FFFFFF"
export const ALARM = "#FF3B30"
export const SCRATCH_GREEN = "#34C759"
export const ORANGE = "#FF9500"

export const FONT: FontName = { family: "Inter", style: "Regular" }

export function rgb(hex: string): RGB {
  const value = parseInt(hex.slice(1), 16)
  return { r: ((value >> 16) & 255) / 255, g: ((value >> 8) & 255) / 255, b: (value & 255) / 255 }
}

export function solid(hex: string, visible = true): SolidPaint {
  return { type: "SOLID", color: rgb(hex), opacity: 1, visible }
}

export function boundSolid(hex: string, variable: Variable): SolidPaint {
  return figma.variables.setBoundVariableForPaint(solid(hex), "color", variable)
}

/**
 * A text layer whose name is set by hand.
 *
 * Figma renames a text layer to match its own content until somebody names it,
 * and every label in the fixture addresses layers by name. A layer that
 * renamed itself when the fixture overrode its text would leave the labels
 * pointing at nothing.
 */
export function label(name: string, characters: string, size: number): TextNode {
  const node = figma.createText()
  node.fontName = FONT
  node.characters = characters
  node.fontSize = size
  node.name = name
  node.textAutoResize = "NONE"
  node.resize(180, size * 1.6)
  return node
}

export function rectangle(name: string, width: number, height: number, fills: readonly Paint[]): RectangleNode {
  const node = figma.createRectangle()
  node.name = name
  node.resize(width, height)
  node.fills = [...fills]
  return node
}

export interface Case {
  readonly page: string
  readonly path: string
  readonly field: string
  readonly category: Category
  readonly why: string
}

export class Recorder {
  readonly cases: Case[] = []
  readonly log: Array<{ step: string; failed: boolean; detail?: string }> = []

  expect(entry: Case): void {
    this.cases.push(entry)
  }

  /**
   * Runs one case and keeps going if it throws.
   *
   * A fixture that half builds is worth far more than one that dies on the
   * first API surprise, because the log names which case failed and the rest
   * of the file is still usable.
   */
  async step(name: string, run: () => Promise<void> | void): Promise<void> {
    const before = this.cases.length

    try {
      await run()
      this.log.push({ step: name, failed: false })
    } catch (error) {
      // A step that threw part way may have left drift in the file that no
      // label describes. Dropping its labels keeps the label set honest about
      // what it knows, and the log says to undo and run again.
      this.cases.length = before
      this.log.push({ step: name, failed: true, detail: error instanceof Error ? error.message : String(error) })
    }
  }
}
