# Recording a fixture

Everything else in this repository runs without Figma. This does not. It is the
step that turns the accuracy numbers from a claim into a measurement, and it
takes about forty minutes.

The fixture is built in two passes. A plugin writes the mechanical cases,
because they are tedious and easy to get subtly wrong by hand. Then you break
the file yourself for fifteen minutes, because a generator can only contain the
cases somebody already thought of, and the cases nobody thought of are the ones
worth having.

## What a generated fixture is and is not

When the builder calls `setProperties`, **Figma** decides what lands in
`overrides`, what `componentPropertyReferences` says, and whether an override
survives being set back to its original value. Those answers are real, and they
are what the audit is measured against. The builder never reads a detector, so
the labels it writes are ground truth from the file rather than a copy of what
the auditor reported.

What it cannot give you is coverage of situations neither the builder nor the
detectors anticipated. That is what pass two is for.

## Before you start

Two things this fixture cannot cover on a free Figma plan, and it is worth
knowing that going in.

Publishing a library needs a paid plan. On the free Starter plan every
component, style and variable in your file is local, so `remote` is never true,
and three rules go unmeasured: an instance of a library component, a layer
using a published paint style, and a text layer using a published text style.
`docs/known-misses.md` records this. Nothing in the build works around it, and
no plugin can.

For typography this bites hardest, because binding a variable to every
typographic property becomes the only route to compliance the fixture can
demonstrate. `Bound heading` is that case.

Everything else gets measured.

## 1. Register both plugins

`manifest.json` ships with `"id": "REPLACE_AT_REGISTRATION"`. A real id is
assigned by Figma, not chosen.

In the Figma **desktop app**: Plugins, Development, New plugin, follow it
through once. Figma writes a manifest with an id in it. Copy that id into this
repository's `manifest.json` and commit it. Do the same for
`tools/fixture-builder/manifest.json`, which needs an id of its own.

Then, twice: Plugins, Development, Import plugin from manifest, and pick each
`manifest.json`.

    npm install
    npm run build      # builds both plugins
    npm run watch      # rebuilds on save while you work

## 2. Build the mechanical cases

Open a **new, empty** Figma file. Run **Drift Fixture Builder**, press Build
fixture.

It adds two pages, `Components` and `Usage`. It only adds. Nothing already in
the file is touched, which is why an empty file is the safe place to run it.

Read the step log it prints. If any step is red, undo everything (Cmd Z until
the pages are gone), fix the cause, and build again. A step that stopped part
way can leave drift in the file that no label describes, which would show up
later as a false positive that is really a fixture bug.

Press **Save labels.json**. Put it at `fixtures/recorded/<name>/labels.json`.

What it builds, and what it expects the auditor to say:

| case | should be reported |
| --- | --- |
| `Card` component, white typed in | yes, token drift, reaching every instance |
| `Card drifted`, repainted | yes, twice: an override and an untokenised colour |
| `Card drifted / Title`, retyped | yes |
| `Card drifted / Body`, resized type | yes |
| `Card drifted / Accent`, hidden | yes |
| `Card reverted`, retyped then set back | **no** |
| `Card untouched` | no |
| `Card locked`, a child locked | **no**, editor state |
| `Button configured`, text property set | **no**, this is correct use |
| `Button untouched` | no |
| `Card / Title` and `/ Body`, type set by hand | yes, typography drift |
| `Button / Label`, the same | yes |
| `Card drifted / Body`, type size changed | yes, twice: an override and untokenised type |
| `Bound heading`, every property bound to a variable | **no** |
| `Half bound heading`, only the size bound | yes, with a note naming the loose properties |
| `Styled heading`, local text style | yes, an unpublished style is not a token |
| `Tokenised swatch`, variable bound | no |
| `Scratch swatch`, local style | yes, an unpublished style is not a token |
| `Raw swatch`, colour typed in | yes |
| `Gradient panel` | **no**, nothing can be bound to a gradient |
| `Hidden swatch` | **no**, not on screen to drift |
| `Detached untouched / Card` | yes, a detachment candidate, and frozen white |
| `Detached edited / Card` | frozen white yes, detachment unknown |
| `Name collision / Card` | **no** detachment, it borrowed a name and nothing else |

The bold rows are the ones that matter most. Each is a plausible false positive
that a naive implementation produces and this one is supposed to refuse.

## 3. Break it yourself, fifteen minutes

Now do the things a generator would not think of. Work on the `Usage` page and
keep a note of every change as you make it, because you are about to write it
down as a label.

Worth doing, roughly in order of how much they are worth:

- **Drag an image into a rectangle.** Name it `Photo`. Expect no finding: a
  variable cannot be bound to an image fill.
- **Detach an instance and then really edit it**, the way you would if you were
  in a hurry. Move things, delete a layer, change the copy. This is the case
  the detachment threshold was guessed at rather than measured, so whatever it
  does here is the most interesting result in the run.
- **Nest an instance inside another component**, then override something on the
  inner one. Nested instances are where the position based matching between an
  instance and its component is most likely to break.
- **Swap a nested instance** for a different component with a different number
  of children. This is the case `docs/known-misses.md` flags as untested.
- **Change a stroke colour** rather than a fill. Strokes take the same path as
  fills and get much less attention.
- **Restyle one word inside a text layer**, leaving the rest alone. That makes
  Figma report the layer as mixed, and the audit should record it as incomplete
  rather than compare it.
- **Copy a component, edit the copy, and leave both.** Not drift by any rule
  here, and worth confirming it stays silent.
- Anything else you have actually seen go wrong in a real file. Those are worth
  more than anything on this list.

## 4. Label pass two, from the file

Open the `labels.json` the builder saved and add a case for each thing you did
in pass three. The format is in
[fixtures/recorded/README.md](../fixtures/recorded/README.md).

Write these **from your notes, before running the auditor**. This is the whole
discipline. Labels written from detector output can only confirm what the
detector already found, and say nothing about what it missed, which is the
number that matters.

If you genuinely do not know whether something should be reported, leave it out
and write it down as a question. An honest gap beats a guessed label.

## 5. Record the snapshot

Run **Drift Auditor** on the same file, press Scan file, press Save snapshot.
Put it at `fixtures/recorded/<name>/snapshot.json`.

Do not edit that file afterwards. Its hash goes into the evidence manifest and
`npm run check:evidence` rejects a run whose snapshot has been touched.

Write a short `fixtures/recorded/<name>/README.md` saying what the file is and
which cases came from which pass.

## 6. See where it stands

    npm run check:evidence

It prints precision and recall for each detector next to the blunt control it
has to beat, and fails if a detector is not perfect or if a control kept up.

**Expect it to fail the first time.** That is the point of the exercise. Each
failure is one of three things, and they are worth telling apart:

- a **false positive**, something reported that you did not label. Either the
  detector has a bug, or your label set is missing a case that is genuinely
  drift. Decide which before changing anything.
- a **false negative**, something you labelled that nothing reported. Usually a
  real detector bug. Sometimes a label whose path does not match the layer
  names in the file.
- a **label that resolves to no layer**, which fails loudly. The path is wrong,
  or the layer got renamed.

Fix the cause, not the symptom. Adjusting a label to match what the detector
happens to say is how a measurement quietly turns back into an assertion.

## 7. Publish the artifact

    node script/validate-evidence.ts --record --stamp=$(date -u +%Y%m%dT%H%M%SZ)

That writes `evidence/results/<stamp>/accuracy.json` and a `manifest.sha256`
beside it. Commit both. CI recomputes them from the fixtures on every run and
fails if they stop matching.

Then put the numbers in the README, and only numbers that appear in that
artifact.
