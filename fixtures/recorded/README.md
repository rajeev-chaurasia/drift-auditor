# Recorded fixtures

Each directory here is one Figma file, recorded and hand labelled. This is what
the accuracy numbers in the README are computed from, and
`script/validate-evidence.ts` recomputes them from these on every CI run.

    fixtures/recorded/<name>/
      snapshot.json   recorded by the plugin, never edited afterwards
      labels.json     the drift cases somebody put in the file on purpose
      README.md       what the file is, and why it was built this way

## How one gets made

[docs/recording-a-fixture.md](../../docs/recording-a-fixture.md) is the
walkthrough. In short: `tools/fixture-builder` writes the mechanical cases and
emits the labels for them, then a person breaks the file by hand for fifteen
minutes and labels that by hand too.

## Why these are recorded rather than written

A snapshot written by hand can only contain the layer shapes whoever wrote it
already thought of, which is the failure mode the accuracy numbers exist to
rule out. A fixture recorded out of Figma carries whatever Figma actually
produces, including the shapes nobody anticipated.

There is a hand authored fixture, in `test/support/drift-fixture.ts`. It proves
the harness works. It is deliberately not published as evidence.

## The labels format

```json
{
  "snapshot": "snapshot.json",
  "split": "held-out",
  "notes": "optional, why this file exists",
  "cases": [
    {
      "page": "Product",
      "path": "Button drifted / Label",
      "field": "characters",
      "category": "override-drift",
      "why": "the label was retyped rather than set through a property"
    }
  ]
}
```

`page` is the page name. `path` is the layer path from that page, with `/`
between names. `field` is the field the finding will name: an override field
such as `characters` or `fills`, or a paint slot such as `fills[0]` for token
drift. `category` is `override-drift`, `token-drift` or `detachment`.

A label that resolves to no layer, or to more than one, fails the run. It is
not skipped. A label set that has gone stale against its snapshot is worse than
no labels at all.

## The rule that makes the numbers mean anything

**Write the labels from the Figma file, not from what the detector reported.**

Open the file, walk what you deliberately broke, and write a case for each one.
Labels derived from detector output can only confirm what the detector already
found, and measure nothing about what it missed.

## Splits

`tuning` files are the ones thresholds may be chosen against. `held-out` files
are not, and the published precision and recall for the detachment category
come from held-out only. The two exact categories carry no thresholds, so the
split does not affect them.
