import type { PaintRef } from "../model/snapshot"

export interface Rgb {
  readonly r: number
  readonly g: number
  readonly b: number
}

const channel = (value: number): string =>
  Math.round(Math.min(1, Math.max(0, value)) * 255)
    .toString(16)
    .padStart(2, "0")

export function toHex(color: Rgb): string {
  return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`.toUpperCase()
}

/**
 * Whether two paints are the same to a person looking at the file. Opacity is
 * compared at four decimals because Figma stores it as a float and a value
 * that round trips through JSON is not bit identical to the one it came from.
 */
export function paintsEqual(a: PaintRef, b: PaintRef): boolean {
  if (a.kind !== b.kind) return false
  if (a.visible !== b.visible) return false

  if (a.kind === "solid" && b.kind === "solid") {
    return a.hex === b.hex && Math.abs(a.opacity - b.opacity) < 1e-4
  }
  if (a.kind === "gradient" && b.kind === "gradient") return a.gradient === b.gradient
  if (a.kind === "unsupported" && b.kind === "unsupported") return a.paintType === b.paintType

  return true
}

export function paintListsEqual(a: readonly PaintRef[], b: readonly PaintRef[]): boolean {
  return a.length === b.length && a.every((paint, index) => paintsEqual(paint, b[index] as PaintRef))
}

export function describePaint(paint: PaintRef): string {
  switch (paint.kind) {
    case "solid":
      return paint.opacity < 1 ? `${paint.hex} at ${Math.round(paint.opacity * 100)}%` : paint.hex
    case "gradient":
      return paint.gradient
    case "image":
      return "image"
    case "video":
      return "video"
    default:
      return paint.paintType.toLowerCase()
  }
}

export function describePaints(paints: readonly PaintRef[] | undefined): string {
  if (!paints || paints.length === 0) return "none"
  return paints.map(describePaint).join(", ")
}
