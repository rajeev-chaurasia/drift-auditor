import type { StyleId, StyleRecord } from "../../core/model/snapshot"

const STYLE_TYPES: Readonly<Record<string, StyleRecord["type"]>> = {
  PAINT: "PAINT",
  TEXT: "TEXT",
  EFFECT: "EFFECT",
  GRID: "GRID",
}

/**
 * Turns style ids into records, once each.
 *
 * A file resolves the same handful of styles thousands of times, and every
 * lookup is an await under dynamic page loading, so the cache is the
 * difference between a scan that finishes and one that does not.
 */
export class StyleResolver {
  private readonly records = new Map<StyleId, StyleRecord>()
  private readonly misses = new Set<StyleId>()

  async note(id: string | symbol | undefined): Promise<StyleId | undefined> {
    if (typeof id !== "string" || id === "") return undefined
    if (this.records.has(id)) return id
    if (this.misses.has(id)) return undefined

    const style = await figma.getStyleByIdAsync(id)
    if (!style) {
      this.misses.add(id)
      return undefined
    }

    this.records.set(id, {
      id,
      key: style.key,
      name: style.name,
      type: STYLE_TYPES[style.type] ?? "PAINT",
      // A remote style lives in another file, which is the only evidence the
      // API offers that it came from a published library.
      remote: style.remote,
    })
    return id
  }

  collect(): Record<StyleId, StyleRecord> {
    return Object.fromEntries(this.records)
  }
}
