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

`src/core/accuracy/blunt-control.ts` is a deliberately naive detector: take
everything in `InstanceNode.overrides` and report it. It is not a strawman, it
is the obvious implementation, and it fails on all four rules above.

It runs through the identical harness against the identical labels. On the hand
authored fixture it scores 0.33 precision and 0.83 recall, against 1.00 and
1.00 for the real detector. If the control ever scores as well as the detector,
the fixture has stopped telling them apart and the accuracy number it produces
is worthless, so that condition fails the run.

## Token drift

Not implemented yet. Planned rules:

A paint or text property is compliant if it resolves to a bound variable, or to
a style whose `remote` flag marks it as coming from a published library.

Two rules will do most of the work of keeping false positives at zero:

- **Attribute to the source, once.** An instance that inherits a hardcoded fill
  unchanged from its main component is not itself the defect. The finding
  belongs to the component, reported once, with a blast radius equal to its
  instance count. Without this rule the drift score is an instance census.
- **Skip what cannot be bound.** Image and gradient paints are excluded,
  because the API cannot bind a variable to them. Flagging them would be
  flagging the platform.

## Detachment candidates

Not implemented yet. Planned rules, and the honesty constraints on them, are in
[non-goals.md](non-goals.md).
