#!/usr/bin/env node
import { readFileSync } from "node:fs"
import { parseSnapshot, SnapshotError } from "../src/core/model/parse.ts"
import { audit } from "../src/core/report/audit.ts"
import { toCsv } from "../src/core/report/csv.ts"
import type { Finding } from "../src/core/model/finding.ts"

// The same core the plugin runs, behind a second frontend. If these two ever
// disagree about one file, the findings depend on the runtime rather than on
// the snapshot, and the reproducibility claim is void.

const USAGE = "usage: npm run audit <snapshot.json> [--json] [--csv] [--limit N]"

function describe(finding: Finding): string {
  const where = `${finding.location.pageName} / ${finding.location.path}`
  if (finding.category === "detachment") {
    return `  ${finding.field}  ${where}\n      looks like ${finding.expected}, inferred and can be wrong`
  }
  if (finding.category === "token-drift") {
    const reach = finding.blastRadius > 1 ? `, reaching ${finding.blastRadius} instances` : ""
    return `  ${finding.field}  ${where}\n      ${finding.actual} is not a token${reach}`
  }
  if (finding.expected === null && finding.actual === null) return `  ${finding.field}  ${where}`
  if (finding.expected === null) return `  ${finding.field}  ${where}\n      is ${finding.actual}, baseline unknown`
  return `  ${finding.field}  ${where}\n      was ${finding.expected}, is ${finding.actual}`
}

function main(argv: readonly string[]): number {
  const path = argv.find((arg) => !arg.startsWith("--"))
  const asJson = argv.includes("--json")
  const limitFlag = argv.indexOf("--limit")
  const limit = limitFlag >= 0 ? Number(argv[limitFlag + 1]) : 25

  if (!path) {
    console.error(USAGE)
    return 2
  }

  let report
  try {
    report = audit(parseSnapshot(JSON.parse(readFileSync(path, "utf8"))))
  } catch (error) {
    console.error(error instanceof SnapshotError ? error.message : `could not read ${path}: ${String(error)}`)
    return 1
  }

  if (argv.includes("--csv")) {
    process.stdout.write(toCsv(report.findings))
    return 0
  }

  if (asJson) {
    console.log(JSON.stringify(report, null, 2))
    return 0
  }

  const { summary, counts, rates } = report
  console.log(`${report.file}, recorded ${report.capture.recordedAt} by ${report.capture.producer}`)
  console.log(
    `  ${summary.pages} pages, ${summary.nodes} nodes, ${summary.components} components, ` +
      `${summary.instances} instances`,
  )
  console.log(`  ${summary.styles} styles (${summary.remoteStyles} published), ${summary.variables} variables`)
  const coverage = rates.tokenCoverage
  console.log("")
  console.log(`${counts.total} findings`)
  console.log(
    `  ${rates.instancesDrifted} of ${rates.instancesConsidered} instances have drifted, ` +
      `${(rates.overrideRate * 100).toFixed(1)}%`,
  )
  console.log(
    `  ${coverage.tokenised} of ${coverage.bindable} bindable paints resolve to a token, ` +
      `${(coverage.coverage * 100).toFixed(1)}%`,
  )

  console.log(`  drift score ${report.score.total}, weight model ${report.score.modelVersion}`)

  for (const [category, total] of Object.entries(counts.byCategory).sort()) {
    const weight = report.score.byCategory[category] ?? 0
    const note = weight === 0 && total > 0 ? "inferred, worth nothing in the score" : `${weight} severity`
    console.log(`  ${category}: ${total} findings, ${note}`)
  }

  if (counts.withoutBaseline > 0) {
    console.log(`  ${counts.withoutBaseline} findings have no readable baseline to compare against`)
  }

  if (report.findings.length > 0) {
    console.log("")
    for (const finding of report.findings.slice(0, limit)) console.log(describe(finding))
    if (report.findings.length > limit) {
      console.log(`  and ${report.findings.length - limit} more, pass --json for all of them`)
    }
  }

  return 0
}

process.exit(main(process.argv.slice(2)))
