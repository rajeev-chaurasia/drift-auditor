# Known misses

What this gets wrong, and what is still open. Written to be useful to someone
trying to break it.

## An instance of a library component may have no baseline

`getMainComponentAsync()` returns the main component of an instance, including
one that lives in a published library. Whether that component's **subtree** can
then be traversed from the consuming file has not been confirmed against a real
library instance. If it cannot, an override on such an instance is known to
exist but its before-value is unknowable, and the finding carries no diff.

The reader already handles this: it records `remote-baseline-unreadable` and
sets `baselineAvailable: false`, and the panel reports the count.

`test/figma/read-document.test.ts` covers both paths, but it covers them
against a fake plugin API written in this repository. That proves the reader
does the right thing when Figma answers a given way. It proves nothing about
which way Figma actually answers, because the fake was written to the
documentation rather than measured against a real library instance.

So what is still unknown is how large that count is on a real file that
consumes a library, which is most of the files worth auditing. Until that is
measured, treat the coverage of override drift on library-heavy files as
unknown. [recording-a-fixture.md](recording-a-fixture.md) lists it as a case
the first recorded file has to include.

## A text node with mixed properties has no single value to compare

Figma returns its `mixed` sentinel when a property differs across a text node's
own ranges. The snapshot records the fact and marks the node incomplete, but
mixed fills and mixed font sizes are simply not compared. A file that styles
text range by range will under-report.

## Position-based addressing assumes an instance mirrors its component

An instance and its main component are matched node for node by child index,
because they share a structure but share no node ids. That holds for ordinary
instances. It is not yet established what happens when a nested instance has
been swapped for a component with a different child count, which would shift
every index after it and could produce a diff against the wrong node.

The intended defence is to compare node type at each step and treat a mismatch
as an absent baseline rather than as a difference, so the failure mode is a
missing finding rather than a wrong one. It is not written yet.

## Style publication is inferred from `remote`, which is not quite the question

A style is treated as a real design token when `remote` is true, meaning it
lives in another file. A local style in an unpublished library file is
therefore counted as drift, and a style copied out of a library and edited
locally is counted correctly but for the wrong reason. There is no API that
answers "is this style published" directly from a consuming file.

## Nothing bounds the size of a snapshot

A large file produces a large JSON object, held entirely in memory in the
plugin sandbox and then serialised again to be saved. No limit is enforced and
no streaming is done. The failure mode on a very large file has not been
measured.

## A detached instance that was moved and rebuilt is invisible

The detachment guess needs either the component's shape or the component's
name to survive. A frame that was detached, renamed, and restructured has
neither, and nothing here will find it. That is not a bug to be fixed later.
It is the whole category: Figma stores no link, so there is a point past which
the evidence is simply gone.

## Position changes inside an instance are not reported

`x`, `y` and `relativeTransform` are in `IGNORED_FIELDS`, so a layer nudged
inside an instance produces no finding. Auto layout rewrites those fields on
every reflow and Figma reports them as overridden very liberally, so including
them would have flooded the output with noise. The cost is real: a hand-moved
layer inside an instance is genuine drift and this misses it.

## Typography is not checked against tokens

A text layer using no published text style is untokenised in exactly the sense
this audit reports for colours, and it is not reported. The snapshot already
carries what is needed. See [methodology.md](methodology.md).

## The drift score cannot be compared between files

It is a total, not a rate, so a larger file scores higher for being larger. The
two ratios published beside it are the ones that compare. Nothing in the number
itself says so, which is the miss.

## A CSV cell beginning with an equals sign is a formula to some spreadsheets

The export quotes per RFC 4180 and does not mangle values to prevent this,
because the CSV has to agree with the JSON beside it. A Figma layer named
`=SUM(A1:A9)` will be evaluated by Excel on open. The JSON export is the one to
trust.
