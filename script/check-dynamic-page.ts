import { readFileSync } from "node:fs"
import { globSync } from "node:fs"

/**
 * Both plugins declare `"documentAccess": "dynamic-page"`, which Figma requires
 * of every new plugin. Under it a long list of synchronous APIs throws at
 * runtime, and TypeScript cannot see the difference: the typings still declare
 * `figma.currentPage` as writable and only mention the restriction in a comment.
 *
 * So this failure mode gets past the compiler, past the tests, and shows up as
 * a red line in a Figma panel with the file already half written. It is the
 * one class of bug in this repository that no fixture can catch, which is why
 * it is checked here instead.
 */
const FORBIDDEN: ReadonlyArray<readonly [string, RegExp, string]> = [
  ["figma.currentPage assignment", /figma\.currentPage\s*=[^=]/, "figma.setCurrentPageAsync(page)"],
  ["figma.getNodeById", /figma\.getNodeById\s*\(/, "figma.getNodeByIdAsync(id)"],
  ["figma.getStyleById", /figma\.getStyleById\s*\(/, "figma.getStyleByIdAsync(id)"],
  ["figma.getFileThumbnailNode", /figma\.getFileThumbnailNode\s*\(/, "figma.getFileThumbnailNodeAsync()"],
  [
    "a synchronous local style listing",
    /figma\.getLocal(Paint|Text|Effect|Grid)Styles\s*\(/,
    "the matching getLocal...StylesAsync()",
  ],
  [
    "a synchronous variable lookup",
    /figma\.variables\.get(VariableById|VariableCollectionById|LocalVariables|LocalVariableCollections)\s*\(/,
    "the matching ...Async() form",
  ],
  ["reading InstanceNode.mainComponent", /\.mainComponent\b(?!\s*=[^=])/, "await instance.getMainComponentAsync()"],
  ["reading ComponentNode.instances", /\.instances\b(?!\s*=[^=])/, "await component.getInstancesAsync()"],
  ["reading BaseStyle.consumers", /\.consumers\b(?!\s*=[^=])/, "await style.getStyleConsumersAsync()"],
  ["a style id assignment", /\.(fill|stroke|text|effect|grid)StyleId\s*=[^=]/, "the matching set...StyleIdAsync()"],
  ["setRangeFillStyleId", /\.setRangeFillStyleId\s*\(/, "setRangeFillStyleIdAsync()"],
  ["setRangeTextStyleId", /\.setRangeTextStyleId\s*\(/, "setRangeTextStyleIdAsync()"],
]

// Only the code that runs inside the plugin sandbox. The core never touches the
// API at all, which script/check-layering.ts is what enforces.
const ROOTS = ["src/figma/**/*.ts", "tools/**/src/**/*.ts"]

const files = ROOTS.flatMap((pattern) => globSync(pattern))
const failures: string[] = []

for (const file of files) {
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, index) => {
      const trimmed = line.trimStart()
      if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return

      for (const [label, pattern, replacement] of FORBIDDEN) {
        if (pattern.test(line)) {
          failures.push(`${file}:${index + 1}: ${label}, use ${replacement}\n    ${line.trim()}`)
        }
      }
    })
}

if (failures.length === 0) {
  console.log(`dynamic-page ok, ${files.length} sandbox files use no synchronous API`)
  process.exit(0)
}

console.error(failures.join("\n"))
console.error(
  `\n${failures.length} call(s) that throw under documentAccess: dynamic-page. ` +
    "TypeScript cannot catch these, which is why they are checked here.",
)
process.exit(1)
