import { readFile, writeFile, mkdir } from "node:fs/promises"
import * as esbuild from "esbuild"

const watch = process.argv.includes("--watch")

const shared = {
  bundle: true,
  target: "es2020",
  logLevel: "info",
}

// Figma serves the panel from a srcdoc iframe, so nothing external resolves.
// The stylesheet and the script have to end up inside the one HTML file.
const inlineUi = {
  name: "inline-ui",
  setup(build) {
    build.onEnd(async (result) => {
      if (result.errors.length > 0) return

      const [template, styles] = await Promise.all([
        readFile("src/ui/index.html", "utf8"),
        readFile("src/ui/styles.css", "utf8"),
      ])
      const script = result.outputFiles[0].text

      await mkdir("dist", { recursive: true })
      await writeFile(
        "dist/ui.html",
        template
          .replace("<!-- styles -->", `<style>\n${styles}</style>`)
          .replace("<!-- script -->", `<script>\n${script}</script>`),
      )
    })
  },
}

const contexts = await Promise.all([
  esbuild.context({
    ...shared,
    entryPoints: ["src/figma/main.ts"],
    outfile: "dist/main.js",
    format: "iife",
  }),
  esbuild.context({
    ...shared,
    entryPoints: ["src/ui/main.ts"],
    format: "iife",
    write: false,
    outdir: "dist",
    plugins: [inlineUi],
  }),
])

if (watch) {
  await Promise.all(contexts.map((context) => context.watch()))
} else {
  await Promise.all(contexts.map((context) => context.rebuild()))
  await Promise.all(contexts.map((context) => context.dispose()))
}
