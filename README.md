# drift-auditor

A Figma plugin that reports which instances have drifted from their component
and which layers hardcode a value that a design token already covers, built so
that every number it reports can be checked by someone who does not trust it.

> Every finding is recomputable offline from a committed snapshot of the file.
> On a fixture recorded from a real Figma file and hand labelled, the override
> and token detectors score 100% recall with zero false positives, and a blunt
> control detector run through the identical harness is proven to fail that bar.

Every plugin in this category answers "how healthy is your design system" with
a percentage and no way to check the percentage. The detection is the easy
half. What makes a drift number worth acting on is being able to hand someone
the raw findings, the file they came from, and the rules that produced them,
and have them arrive at the same number.

## The measured result

From `evidence/results/`, against `fixtures/recorded/drift-01`: a Figma file
built to drift on purpose, recorded by the plugin, and labelled from the file
rather than from anything the detectors reported.

| detector | category | precision | recall |
| --- | --- | ---: | ---: |
| override-drift | override drift | **1.00** | **1.00** |
| blunt control | override drift | 0.29 | 1.00 |
| token-drift | token drift | **1.00** | **1.00** |
| blunt control | token drift | 0.52 | 1.00 |
| typography-drift | typography drift | **1.00** | **1.00** |
| blunt control | typography drift | 0.50 | 0.91 |
| detachment | detachment | 1.00 | 0.50 |

The control rows are the point. Each is the implementation somebody writes
after an afternoon with the API: report everything Figma calls an override,
report every colour without a variable on it, report every text layer without a
style. They are not strawmen, and they run through the identical harness
against the identical labels. Without them the first column is three numbers
anybody could claim.

Detachment is the honest one. It finds a detached instance that was left alone
and misses one that was restructured afterwards, which is half of them. It is
a guess by construction, so it is worth zero in the score and gated on by
nothing. The arithmetic of the miss is in
[docs/known-misses.md](docs/known-misses.md).

Reproduce with `npm run check:evidence`, which recomputes every number above
from the fixture and fails if a committed artifact no longer matches.

## Status

| | |
| --- | --- |
| Traversal and snapshot recording | done |
| Snapshot integrity checks | done |
| Override, token and typography drift | done, measured above |
| Two negative controls per exact category | done, each proven to fail |
| Detachment candidates | done, measured, deliberately not gated on |
| Severity scoring and export | done |
| Published evidence artifact | one fixture, recorded and committed |
| A held-out fixture | not yet, see below |
| Figma Community listing | not started |

Two things the numbers above do not cover, both stated rather than implied.

**The fixture is generated.** `tools/fixture-builder` writes the drift into a
real Figma file, so the `overrides` arrays and property references it produces
are Figma's own. What it cannot contain is a case nobody thought to generate.
It is labelled `tuning` for that reason, and a hand broken file is the held-out
set that has not been recorded yet.

**Nothing in it is published.** Publishing a library needs a paid Figma plan,
so no style, component or variable in the fixture is `remote`, and the rules
that turn on that flag go unmeasured. See
[docs/known-misses.md](docs/known-misses.md).

## How it works

Three layers, one direction of dependency.

```
src/core/    plain TypeScript over a DocumentSnapshot. Never touches Figma.
   ^
src/figma/   the only code that calls the Plugin API. Produces snapshots.
src/ui/      the panel. Imports core types only.
bin/audit.ts the same core, run from a terminal over a snapshot file.
```

`script/check-layering.ts` fails the build if anything under `src/core/`
references the `figma` global or an ambient plugin type. That rule is the whole
reproducibility story: detectors that cannot reach the API can be run against a
committed fixture, on a machine with no Figma on it, by anyone.

The command line runner is not a convenience. It is a second frontend over the
same core, so if the plugin and the terminal ever disagree about one file, the
findings depend on the runtime rather than on the snapshot and the claim is
void.

A snapshot records what the traversal could not resolve, in
`capture.incomplete`. An instance whose main component lives in a library this
file cannot read has no baseline to be diffed against. Those are reported with
the gap stated rather than dropped, because dropping a finding that cannot be
priced would quietly improve the score.

## Running it

```
npm install
npm run build              # bundles both plugins
```

In the Figma desktop app, Plugins, Development, Import plugin from manifest,
and pick `manifest.json`. Run it, press Scan file, then Save snapshot to write
the recorded JSON to disk.

Over a saved snapshot, with no Figma involved:

```
npm run audit path/to/file.snapshot.json
npm run audit path/to/file.snapshot.json -- --json
```

Checks:

```
npm run check              # typecheck, prose, layering, tests, evidence
npm run check:evidence     # recompute every published number from its fixture
```

The plugin declares `networkAccess: { allowedDomains: ["none"] }`. It cannot
make a request, so the file never leaves the machine it is audited on.

## Documentation

- [docs/recording-a-fixture.md](docs/recording-a-fixture.md), the one part of this that needs Figma, and how to do it
- [docs/methodology.md](docs/methodology.md), what counts as drift and why
- [docs/non-goals.md](docs/non-goals.md), what this deliberately does not do
- [docs/known-misses.md](docs/known-misses.md), what it gets wrong, written to be useful to someone trying to break it
- [docs/adr/](docs/adr/), the decisions and what they cost

## Licence

MIT.
