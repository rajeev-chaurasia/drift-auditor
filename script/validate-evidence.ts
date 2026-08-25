import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { buildArtifact, checkInvariants, type EvidenceArtifact, type FixtureInput } from "../src/core/accuracy/evidence.ts"
import { parseLabels } from "../src/core/accuracy/labels.ts"
import { parseSnapshot } from "../src/core/model/parse.ts"

// Recomputes every published number from the fixtures they came from, and
// rejects an artifact that was edited by hand. Run with --record to write a
// new one.

const FIXTURES = "fixtures/recorded"
const RESULTS = "evidence/results"

const sha256 = (body: string): string => createHash("sha256").update(body).digest("hex")

function loadFixtures(): FixtureInput[] {
  if (!existsSync(FIXTURES)) return []

  return readdirSync(FIXTURES, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const snapshotBody = readFileSync(join(FIXTURES, entry.name, "snapshot.json"), "utf8")
      return {
        name: entry.name,
        snapshotSha256: sha256(snapshotBody),
        snapshot: parseSnapshot(JSON.parse(snapshotBody)),
        labels: parseLabels(JSON.parse(readFileSync(join(FIXTURES, entry.name, "labels.json"), "utf8"))),
      }
    })
    .sort((a, b) => (a.name < b.name ? -1 : 1))
}

function report(artifact: EvidenceArtifact): void {
  for (const fixture of artifact.fixtures) {
    console.log(`${fixture.name}, ${fixture.split}, ${fixture.labelledCases} labelled cases`)
    for (const result of [...fixture.results, ...fixture.candidateResults]) {
      const { precision, recall, truePositives, falsePositives, falseNegatives } = result.matrix
      const gated = fixture.results.includes(result) ? "" : "  (inferred, not gated on)"
      console.log(
        `  ${result.detector.padEnd(22)} precision ${precision.toFixed(2)}  recall ${recall.toFixed(2)}` +
          `  tp ${truePositives} fp ${falsePositives} fn ${falseNegatives}${gated}`,
      )
    }
  }
}

function record(artifact: EvidenceArtifact, stamp: string): void {
  const directory = join(RESULTS, stamp)
  mkdirSync(directory, { recursive: true })

  const body = `${JSON.stringify(artifact, null, 2)}\n`
  writeFileSync(join(directory, "accuracy.json"), body)

  // Hashes of the artifact and of every fixture it was computed from, so a
  // published number can be traced to the exact bytes behind it.
  const manifest = [
    `${sha256(body)}  accuracy.json`,
    ...artifact.fixtures.map((fixture) => `${fixture.snapshotSha256}  ${FIXTURES}/${fixture.name}/snapshot.json`),
  ]
  writeFileSync(join(directory, "manifest.sha256"), `${manifest.join("\n")}\n`)

  console.log(`wrote ${directory}`)
}

function verifyCommitted(fresh: EvidenceArtifact): string[] {
  if (!existsSync(RESULTS)) return []

  const runs = readdirSync(RESULTS, { withFileTypes: true }).filter((entry) => entry.isDirectory())
  const problems: string[] = []

  for (const run of runs) {
    const path = join(RESULTS, run.name, "accuracy.json")
    if (!existsSync(path)) {
      problems.push(`${run.name} has no accuracy.json`)
      continue
    }

    const committed = JSON.parse(readFileSync(path, "utf8")) as EvidenceArtifact
    if (JSON.stringify(committed) !== JSON.stringify(fresh)) {
      problems.push(
        `${run.name} does not match a fresh run over the same fixtures. ` +
          `Either the artifact was edited, or the detectors changed and it needs regenerating.`,
      )
    }

    const manifest = join(RESULTS, run.name, "manifest.sha256")
    if (!existsSync(manifest)) problems.push(`${run.name} has no manifest.sha256`)
    else if (!readFileSync(manifest, "utf8").includes(sha256(readFileSync(path, "utf8")))) {
      problems.push(`${run.name}: accuracy.json does not hash to what manifest.sha256 claims`)
    }
  }

  return problems
}

function main(argv: readonly string[]): number {
  const fixtures = loadFixtures()

  // Nothing has been recorded out of Figma yet. This is a stated state rather
  // than a pass: the README says the claim is unearned, and the moment a
  // fixture directory exists every check below becomes a hard gate.
  if (fixtures.length === 0) {
    console.log(`no fixtures under ${FIXTURES}, so nothing has been measured`)
    return 0
  }

  const artifact = buildArtifact(fixtures)
  report(artifact)

  const problems = [...checkInvariants(artifact)]

  const stamp = argv.find((arg) => arg.startsWith("--stamp="))?.slice("--stamp=".length)
  if (argv.includes("--record")) {
    if (problems.length > 0) {
      console.error(problems.join("\n"))
      console.error("\nrefusing to record an artifact that does not satisfy its own invariants")
      return 1
    }
    if (!stamp) {
      console.error("--record needs --stamp=<ISO8601 basic>, so a run directory is never named from the clock twice")
      return 2
    }
    record(artifact, stamp)
    return 0
  }

  problems.push(...verifyCommitted(artifact))

  if (problems.length === 0) {
    console.log(`\nevidence ok, ${artifact.fixtures.length} fixture(s)`)
    return 0
  }

  console.error(`\n${problems.join("\n")}`)
  return 1
}

process.exit(main(process.argv.slice(2)))
