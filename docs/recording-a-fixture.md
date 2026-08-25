# Recording a fixture

What to do in Figma, once, to turn the accuracy numbers from a claim into a
measurement. Everything else in this repository runs without Figma. This does
not.

## 1. Register the plugin

`manifest.json` ships with `"id": "REPLACE_AT_REGISTRATION"`. A real id is
assigned by Figma, not chosen.

In the Figma desktop app: Plugins, Development, New plugin, follow it through
once. Figma writes a manifest with an id in it. Copy that id into this
repository's `manifest.json` and commit it. Then Plugins, Development, Import
plugin from manifest, and pick this repository's `manifest.json`.

`npm run watch` rebuilds on save while you work.

## 2. Build the file the audit will be measured against

A new Figma file. Build it so that you know, layer by layer, what is wrong with
it. Aim for at least twenty deliberate cases across the categories.

Worth including, because each one is a rule this audit claims to handle:

- an instance with a text override typed in by hand
- an instance with a colour override
- an instance resized, and one with its corner radius changed
- an instance with a layer hidden
- **a component with an exposed text property, set through the property panel.**
  This must not be reported. It is the single most likely false positive.
- **an override typed and then set back to the component's value.** Also must
  not be reported.
- a component that hardcodes a colour, used by several instances. Expect one
  finding on the component, not one per instance.
- a layer bound to a colour variable, and one using a published library style.
  Neither should be reported.
- a layer using a local, unpublished style. This should be reported.
- an image fill and a gradient fill. Neither should be reported.
- **an instance of a component from a published library.** This is the case
  nothing in this repository has measured yet. See
  [known-misses.md](known-misses.md).
- a detached instance, left alone
- a detached instance, then edited
- a frame that merely shares a component's name and has nothing else in common

## 3. Record it

Run the plugin, press Scan file, press Save snapshot. Put the result at
`fixtures/recorded/<name>/snapshot.json`.

Do not edit that file afterwards. Its hash goes in the evidence manifest, and
`npm run check:evidence` will reject a run whose snapshot has been touched.

## 4. Label it

Write `fixtures/recorded/<name>/labels.json` **from the Figma file**, from the
list of things you deliberately broke, before looking at what the plugin
reported. The format is in
[fixtures/recorded/README.md](../fixtures/recorded/README.md).

This is the step that makes the recall number mean something. Labels written
from detector output can only confirm what the detector already found.

## 5. See where it stands

    npm run check:evidence

It prints precision and recall per detector, next to the blunt control each one
has to beat, and fails if a detector is not perfect or if a control kept up.

Expect it to fail the first time. That is the point: every failure here is
either a real bug in a detector or a wrong label, and both are worth finding
before anything is published.

## 6. Publish the artifact

    node script/validate-evidence.ts --record --stamp=$(date -u +%Y%m%dT%H%M%SZ)

That writes `evidence/results/<stamp>/accuracy.json` and a `manifest.sha256`
beside it. Commit both. CI recomputes them from the fixtures on every run and
fails if they no longer match.

Then put the numbers in the README, and only numbers that appear in that
artifact.
