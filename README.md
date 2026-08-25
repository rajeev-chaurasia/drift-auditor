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

## Status

The claim above is what this repository has to earn. It is not earned yet.

| | |
| --- | --- |
| Traversal and snapshot recording | done |
| Snapshot integrity checks | done |
| Override drift detection | done, not yet measured on a recorded fixture |
| Accuracy harness and negative control | done |
| Token drift detection | done, not yet measured on a recorded fixture |
| Detachment candidates | done, deliberately unmeasured, see below |
| Severity scoring and export | done |
| Published evidence artifact | validator done, nothing recorded to publish yet |
| Figma Community listing | not started |

Nothing in this README quotes a measured number yet, because none has been
measured against a real file. When one appears here it will be recomputable
from `evidence/results/`.

The accuracy harness does already run, against a fixture written by hand:

| detector | category | precision | recall |
| --- | --- | ---: | ---: |
| override-drift | override-drift | 1.00 | 1.00 |
| blunt-control | override-drift | 0.33 | 0.83 |
| token-drift | token-drift | 1.00 | 1.00 |
| blunt-token-control | token-drift | 0.42 | 1.00 |

The two control rows are the only reason the other two mean anything. Both
controls are plausible implementations, not strawmen, and both run through the
identical harness against the identical labels.

This is still not the published result. A snapshot written by hand can only
contain the layer shapes whoever wrote it already thought of, which is why the
artifact will come from a file recorded out of Figma instead.

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
npm run build              # bundles dist/main.js and dist/ui.html
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
