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

Not implemented yet. Planned rules:

Figma's `InstanceNode.overrides` reports which fields were overridden but not
what they were overridden to, and it excludes overrides inherited from a parent
instance. So the detector resolves each overridden node, addresses the matching
node in the main component by **position** rather than by id, since an instance
and its component share a structure but share no ids, and diffs the actual
values.

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
