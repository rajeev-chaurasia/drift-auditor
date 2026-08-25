import { readFile, writeFile, mkdir } from "node:fs/promises"
import * as esbuild from "esbuild"

const watch = process.argv.includes("--watch")

// The auditor is what gets published. The fixture builder is a development
// tool that writes into a file, and shipping the two together would put a
// button that scribbles on your document inside a Community plugin.
const PLUGINS = [
  { main: "src/figma/main.ts", ui: "src/ui", uiEntry: "main.ts", out: "dist" },
  { main: "tools/fixture-builder/src/main.ts", ui: "tools/fixture-builder/src", uiEntry: "ui.ts", out: "tools/fixture-builder/dist" },
]

const shared = { bundle: true, target: "es2020", logLevel: "info" }

// Figma serves the panel from a srcdoc iframe, so nothing external resolves.
// The stylesheet and the script have to end up inside the one HTML file.
const inlineUi = (source, out) => ({
  name: "inline-ui",
  setup(build) {
    build.onEnd(async (result) => {
      if (result.errors.length > 0) return

      const [template, styles] = await Promise.all([
        readFile(`${source}/index.html`, "utf8"),
        readFile(`${source}/styles.css`, "utf8"),
      ])

      await mkdir(out, { recursive: true })
      await writeFile(
        `${out}/ui.html`,
        template
          .replace("<!-- styles -->", `<style>\n${styles}</style>`)
          .replace("<!-- script -->", `<script>\n${result.outputFiles[0].text}</script>`),
      )
    })
  },
})

const contexts = await Promise.all(
  PLUGINS.flatMap((plugin) => [
    esbuild.context({ ...shared, entryPoints: [plugin.main], outfile: `${plugin.out}/main.js`, format: "iife" }),
    esbuild.context({
      ...shared,
      entryPoints: [`${plugin.ui}/${plugin.uiEntry}`],
      format: "iife",
      write: false,
      outdir: plugin.out,
      plugins: [inlineUi(plugin.ui, plugin.out)],
    }),
  ]),
)

if (watch) {
  await Promise.all(contexts.map((context) => context.watch()))
} else {
  await Promise.all(contexts.map((context) => context.rebuild()))
  await Promise.all(contexts.map((context) => context.dispose()))
}
