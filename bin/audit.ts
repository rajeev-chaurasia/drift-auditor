#!/usr/bin/env node
import { readFileSync } from "node:fs"
import { parseSnapshot, SnapshotError } from "../src/core/model/parse.ts"
import { summarise } from "../src/core/report/summary.ts"

// The same core the plugin runs, behind a second frontend. If these two ever
// disagree about one file, the detectors depend on the runtime rather than on
// the snapshot, and the whole reproducibility claim is void.

const USAGE = `usage: npm run audit <snapshot.json> [--json]`

function main(argv: readonly string[]): number {
  const paths = argv.filter((arg) => !arg.startsWith("--"))
  const asJson = argv.includes("--json")
  const path = paths[0]

  if (!path) {
    console.error(USAGE)
    return 2
  }

  let snapshot
  try {
    snapshot = parseSnapshot(JSON.parse(readFileSync(path, "utf8")))
  } catch (error) {
    console.error(error instanceof SnapshotError ? error.message : `could not read ${path}: ${String(error)}`)
    return 1
  }

  const summary = summarise(snapshot)

  if (asJson) {
    console.log(JSON.stringify({ file: snapshot.file.name, capture: snapshot.capture, summary }, null, 2))
    return 0
  }

  console.log(`${snapshot.file.name}, recorded ${snapshot.capture.recordedAt} by ${snapshot.capture.producer}`)
  console.log(
    `  ${summary.pages} pages, ${summary.nodes} nodes, ${summary.components} components, ` +
      `${summary.instances} instances`,
  )
  console.log(`  ${summary.styles} styles (${summary.remoteStyles} published), ${summary.variables} variables`)

  if (summary.instancesWithoutBaseline > 0) {
    console.log(`  ${summary.instancesWithoutBaseline} instances have no readable main component`)
  }
  if (summary.incomplete > 0) {
    console.log(`  ${summary.incomplete} regions were not read in full`)
  }

  return 0
}

process.exit(main(process.argv.slice(2)))
