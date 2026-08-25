# Methodology

What this plugin counts as drift, and why each rule is the way it is. Anything
here that is not yet implemented is marked as such rather than described in the
present tense.

## The snapshot

An audit runs against a `DocumentSnapshot`, never against the live document.
The snapshot holds the identity, structure and audited properties of every
node, plus the styles, variables and components they refer to. It is plain
JSON.

This is the load-bearing decision. A finding that came out of a live traversal
can only be reproduced by whoever has the file open. A finding that came out of
a snapshot can be reproduced by anyone holding the snapshot, which is what
turns an audit into evidence.

### What the traversal does

`figma.loadAllPagesAsync()` first, which dynamic page loading requires before
any document-wide search. Then every page, depth first, in document order.

`skipInvisibleInstanceChildren` is **off** by default. It is Figma's own escape
hatch for large files and it is a real speedup, but an invisible layer can
still carry an override, and a scan that quietly skipped them would report a
better score than the file deserves. The flag is recorded in
`capture.skipInvisibleInstanceChildren`, because two scans taken under
different settings are not comparable and nothing in the findings would say so.

### What it admits it could not do

`capture.incomplete` lists every region the reader could not fully resolve:

- `remote-baseline-unreadable`, an instance whose main component lives in a
  library this file cannot read. There is no baseline to diff against.
- `mixed-value`, a property that differs across a node's own text ranges, so
  there is no single value to compare.
- `read-failed`, anything that threw.

Findings derived from these are reported with the gap stated rather than
dropped. Dropping a finding that cannot be priced would improve the score for
the wrong reason, which is the exact failure this project exists to avoid.

### Normalisation

Colours are stored as uppercase hex, so a colour comparison is a string
comparison. Opacity is compared to four decimal places, because Figma stores
it as a float and a value that has been through JSON is not bit identical to
the one it came from.

Paints carry their kind in the type: `solid`, `gradient`, `image`, `video`,
`unsupported`. Only `solid` can have a variable bound to it, so the one
distinction the token detector depends on is carried by the model rather than
rediscovered at every call site.

## Instance override drift

Figma's `InstanceNode.overrides` reports which fields were overridden but not
what they were overridden to, and it excludes overrides inherited from a parent
instance. So the detector resolves each overridden node, addresses the matching
node in the main component by **position** rather than by id, since an instance
and its component share a structure but share no ids, and diffs the actual
values.

### The four rules that keep false positives at zero

Each of these is a real thing Figma reports as an override that is not drift,
and each has a test naming it.

1. **A field a component property drives was configured, not drifted.** A
   component author who exposes a text property is asking for it to be set, and
   Figma records setting it exactly as it records a manual edit. The layer
   carries `componentPropertyReferences` naming the property, and any override
   of a referenced field is skipped.
2. **An override set back to the component's value is not drift.** Figma keeps
   reporting a field as overridden after it has been returned to its original
   value. The override is real, the drift is not.
3. **Editor and prototyping state is not drift.** The full list, with a reason
   for each, is `IGNORED_FIELDS` in `src/core/detect/fields.ts`. Position
   fields are in it because auto layout rewrites them on every reflow, which is
   a real gap and is recorded in [known-misses.md](known-misses.md).
4. **A structural mismatch produces no baseline rather than a wrong one.** When
   the layer at the matching position in the component is a different type, the
   two structures have diverged and the match is not trustworthy. The finding
   is reported without a before-value.

### Fields it reports but does not model

Figma names roughly a hundred overridable fields. The snapshot models the ones
an audit acts on. When an override names a field outside that set, the finding
is still reported, with both values null and a note saying so. Dropping it
would make the file look cleaner than it is, which is the failure this project
exists to avoid.

## Measuring it

A detector is scored against a label set: drift cases somebody put into a Figma
file deliberately, written down from the file rather than from detector output.
A label set derived from what the detector found can only confirm what it
already found, and measures nothing about recall.

Labels address a layer by page and layer path, not by node id, so they can be
written before the detector has ever been run. A label that resolves to no
layer, or to more than one, fails the run rather than being skipped.

### The negative control

`src/core/accuracy/blunt-control.ts` holds one deliberately naive detector per
category. Neither is a strawman. Each is the obvious implementation somebody
writes after an afternoon with the API, and each fails exactly on the rules
above.

`BluntControlDetector` reports everything in `InstanceNode.overrides`.
`BluntTokenControlDetector` reports every solid paint with no variable on it.

Both run through the identical harness against the identical labels. On the
hand authored fixture:

| detector | category | precision | recall |
| --- | --- | ---: | ---: |
| override-drift | override-drift | 1.00 | 1.00 |
| blunt-control | override-drift | 0.33 | 0.83 |
| token-drift | token-drift | 1.00 | 1.00 |
| blunt-token-control | token-drift | 0.42 | 1.00 |

The control's recall on tokens is 1.00, because reporting everything does find
everything. Precision is where it fails, and that is the column the gate reads.

If a control ever scores as well as the detector it stands in for, the fixture
has stopped telling them apart and the accuracy number it produces is
worthless. That condition fails the run.

## Token drift

A paint is compliant when a variable is bound to it, or when the layer points
at a style that exists in the file. Anything else is a colour somebody typed,
which is what makes a redesign expensive.

Compliance used to require the style to be published. A real file showed that
rule reporting 10,466 correct layers, and
[ADR 0003](adr/0003-following-a-local-style-is-following-something.md) records
why it was reversed. How much of what a file follows comes from a library is
reported separately as `libraryAdoption`, and carries no severity.

Three rules do most of the work of keeping false positives at zero.

**Attribute to the source, once.** An instance that inherits a hardcoded fill
unchanged from its main component is not itself the defect. The finding belongs
to the component, raised once, carrying `blastRadius`: the number of instances
it reaches. Without this rule the drift score is a census of how often a
component was used, which measures nothing about drift. An instance that
hardcoded a *different* colour of its own is still reported separately, because
that is a second decision.

**Skip what cannot be bound.** Image, video and gradient paints are excluded,
because the API cannot bind a variable to them. Flagging them would be flagging
the platform. Hidden paints are excluded because they are not on screen to
drift.

**Count coverage over the same set.** `rates.tokenCoverage` is tokenised paints
over bindable paints, and both the numerator and the denominator come from the
same generator the findings do, in `src/core/detect/paint-compliance.ts`. A
ratio whose denominator disagrees with the findings printed above it is worse
than no ratio.

### What this does not cover yet

Typography. A text layer with no `textStyleId` and no bound type variables is
untokenised in exactly the same sense, and is not currently reported. The
snapshot already carries what is needed. Recorded here rather than implied by
silence.

## Detachment candidates

This is the only category here that is a guess, and it is a guess because the
platform leaves no answer. Detaching an instance turns it into an ordinary
frame and records nothing pointing back at what it was. No API can be asked.
The best anything can do is notice that a frame has the shape and the name of a
component sitting in the same file.

So every finding from this detector carries `confidence: "candidate"`, is worth
zero in the severity model, is counted apart in the panel and the export, and
is excluded from the accuracy gate the other categories pass.

### How a candidate is scored

    the names must match, then
    confidence = 0.65 * structure + 0.35

`structure` comes from `similarity` in `src/core/util/fingerprint.ts`: a hash
of the subtree shape, plus how close the two are in size and in layer count.
Container types collapse to one token before hashing, because a detached frame
is a `FRAME` and the component it came from is a `COMPONENT`, and a hash that
recorded that difference could never match the one pair it exists to match.

The name is a gate, not a term. Structure alone was the original rule and it
produced 126 candidates on a real file, not one of which shared a name with
what it matched. Structure only ranks what the name has already let through.

Within that, structure is close to binary. It contributes 0.6 the moment the
shape hash matches and very little otherwise, so a frame that was detached and
then edited scores under 0.4 on it. The name is what survives editing, because
Figma leaves the component's name on the frame it makes.

That gives, on the arithmetic:

| case | confidence |
| --- | ---: |
| untouched clone that kept its name | 1.00 |
| clone that was renamed | unreachable, the name gate rejects it |
| edited frame that kept its name | about 0.60 |
| unrelated frame that happens to share a name | about 0.55 |

`CANDIDATE_THRESHOLD` is 0.60, between the last two.

### What is deliberately not compared

Anything inside an instance, and anything inside a component. An instance
mirrors its component by construction, so every layer in one would match. A
frame with fewer than three nodes is skipped as well: a leaf frame has the
shape of everything and is therefore evidence of nothing.

### What it actually scored

Precision 1.00, recall 0.50, on a recorded fixture. The predictions in the table
above turned out close: the untouched clone scored 1.000, the edited one 0.584
against a predicted 0.60, and the name collision 0.464 against a predicted 0.55.

The threshold has still never been fitted to data, and it stays where it is
until there is a held-out file to report on. The full arithmetic, and why the
obvious adjustment has not been made, is in
[known-misses.md](known-misses.md).
