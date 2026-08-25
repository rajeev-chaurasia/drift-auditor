import { readFileSync } from "node:fs"
import { globSync } from "node:fs"

// Everything under src/core is a plain TypeScript library over a serialisable
// snapshot. That is the property the whole evidence story rests on: detectors
// that never touch the Figma API can be run against a committed fixture, and
// against the same fixture on a machine with no Figma at all. It decays the
// first time someone reaches for a plugin global, so it is checked rather than
// trusted.
const FORBIDDEN: ReadonlyArray<readonly [string, RegExp]> = [
  ["the figma global", /(?<![\w$.])figma\s*\./],
  ["__html__", /(?<![\w$.])__html__\b/],
  ["an import from outside core", /from\s+["'][^"']*\/(figma|ui)\//],
  [
    "an ambient plugin type",
    /\b(BaseNode|SceneNode|DocumentNode|PageNode|FrameNode|TextNode|InstanceNode|ComponentNode|ComponentSetNode|BaseStyle|PaintStyle|TextStyle|Variable|VariableCollection|VariableAlias|Paint|SolidPaint|PluginAPI)\b/,
  ],
]

const files = globSync("src/core/**/*.ts")
const failures: string[] = []

for (const file of files) {
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, index) => {
      const trimmed = line.trimStart()
      if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return

      for (const [label, pattern] of FORBIDDEN) {
        if (pattern.test(line)) failures.push(`${file}:${index + 1}: reaches for ${label}: ${line.trim()}`)
      }
    })
}

if (failures.length === 0) {
  console.log(`layering ok, ${files.length} core files carry no plugin API`)
  process.exit(0)
}

console.error(failures.join("\n"))
console.error("\nThe core must stay plain TypeScript. Move plugin-dependent code into src/figma.")
process.exit(1)
