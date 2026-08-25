import type { DocumentSnapshot } from "../model/snapshot.ts"
import { walkAll } from "../util/tree.ts"

export interface LibraryAdoption {
  /** Style references across the file, counted per layer and per slot. */
  readonly referenced: number
  /** Of those, the ones resolving to a style that lives in another file. */
  readonly published: number
  readonly rate: number
}

/**
 * How much of what this file follows comes from somewhere else.
 *
 * This used to be folded into the drift rules: a layer was only tokenised if
 * its style was `remote`. That conflated two different questions and reported
 * a well organised file as almost entirely broken, because a file that is not
 * itself a published library has no remote styles at all.
 *
 * They are separated now. Following a style is tokenisation. Whether that
 * style came from a library is adoption, which is worth knowing and is worth
 * no severity, because a single file design system is a legitimate thing to
 * have and not a defect.
 */
export function libraryAdoption(snapshot: DocumentSnapshot): LibraryAdoption {
  let referenced = 0
  let published = 0

  for (const node of walkAll(snapshot)) {
    const styles = node.props.styles
    if (!styles) continue

    for (const id of [styles.fill, styles.stroke, styles.text, styles.effect]) {
      if (!id) continue
      const style = snapshot.styles[id]
      if (!style) continue

      referenced += 1
      if (style.remote) published += 1
    }
  }

  return {
    referenced,
    published,
    // A file referencing no styles has adopted nothing rather than everything.
    rate: referenced === 0 ? 0 : Math.round((published / referenced) * 10000) / 10000,
  }
}
