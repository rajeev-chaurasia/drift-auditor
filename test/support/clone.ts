export type DeepMutable<T> = T extends readonly (infer U)[]
  ? Array<DeepMutable<U>>
  : T extends object
    ? { -readonly [K in keyof T]: DeepMutable<T[K]> }
    : T

/**
 * A JSON round trip that hands back something a test can damage. Damaging a
 * snapshot on purpose is how the integrity checks are shown to work.
 */
export function mutableClone<T>(value: T): DeepMutable<T> {
  return JSON.parse(JSON.stringify(value)) as DeepMutable<T>
}
