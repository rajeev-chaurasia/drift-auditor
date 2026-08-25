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

## Detachment finds half of them, and here is the arithmetic

Measured on `fixtures/recorded/drift-01`, recall 0.50 with precision 1.00.
Three frames, one component named `Card`:

| frame | shape | similarity | confidence | outcome |
| --- | --- | ---: | ---: | --- |
| detached, left alone | matches | 1.000 | **1.000** | found |
| detached, then a layer added | differs | 0.360 | **0.584** | missed |
| unrelated frame sharing the name | differs | 0.176 | **0.464** | correctly ignored |

`CANDIDATE_THRESHOLD` is 0.60, so the middle row missed by 0.016.

There is clear daylight between 0.584 and 0.464, so a threshold near 0.52 would
find all three correctly on this fixture. It has not been moved, because this
fixture is the `tuning` split and moving a threshold to fit the file you then
report on is not a measurement. The threshold moves when there is a held-out
file to report on, and both numbers get republished.

Past that, the category has a floor that no tuning reaches. The guess needs
either the component's shape or its name to survive. A frame that was detached,
renamed and restructured has neither, and nothing here will find it. Figma
stores no link, so there is a point past which the evidence is simply gone.

## Position and auto layout sizing changes inside an instance are not reported

`x`, `y` and `relativeTransform` are in `IGNORED_FIELDS`, and so are
`counterAxisSizingMode` and `primaryAxisSizingMode`, the hug and fill settings.

The sizing pair was added after measurement rather than on suspicion. On a real
26,966 node file they were 287 and 71 of 848 override findings, more than any
genuine defect in the file and 42% of the category. Figma reports them as
liberally as it reports position.

The cost is real and the same in both cases: a layer deliberately moved or
resized inside an instance is genuine drift, and this misses it.

## A detached instance that was renamed can never be found

Detachment requires the frame's name to match the component's. Structure alone
used to be enough, and on a real file that produced 126 candidates of which not
one shared a name with what it matched: generic wrappers named
`Background+Shadow` matching three node component variants named
`variant=2,:hover=true`. In a file built on a UI kit, half the frames are three
node boxes, so an identical shape carries almost no information.

Requiring the name took those 126 to zero. It also means somebody who detaches
and then renames is invisible to this, permanently. That is the trade, made
deliberately, on measured evidence.

## A token cannot be told apart from a swatch somebody saved once

Since [ADR 0003](adr/0003-following-a-local-style-is-following-something.md),
any style counts as tokenised. In a file with no library behind it, a carefully
maintained type ramp and a colour somebody saved once look identical to this,
because the API offers nothing that separates them there.

The previous rule pretended to recover that distinction using `remote` and did
not: it only marked every style in every non-library file as worthless. The
distinction is genuinely unavailable, and `libraryAdoption` reports the one
part of it that is measurable.

## The drift score cannot be compared between files

It is a total, not a rate, so a larger file scores higher for being larger. The
two ratios published beside it are the ones that compare. Nothing in the number
itself says so, which is the miss.

## A CSV cell beginning with an equals sign is a formula to some spreadsheets

The export quotes per RFC 4180 and does not mangle values to prevent this,
because the CSV has to agree with the JSON beside it. A Figma layer named
`=SUM(A1:A9)` will be evaluated by Excel on open. The JSON export is the one to
trust.

## The compiler cannot see the dynamic page restrictions

Both plugins declare `"documentAccess": "dynamic-page"`, which Figma requires of
every new plugin. Under it a long list of synchronous APIs throws at runtime,
and the typings still declare them normally: `figma.currentPage` is typed as
writable, with the restriction mentioned only in a doc comment.

So that class of mistake gets past the compiler, past the tests, and past a
fixture, and appears as a red line in a Figma panel with the file already half
written. It did exactly that once. `script/check-dynamic-page.ts` now greps the
sandbox code for the known offenders, which catches the ones on its list and
nothing else. A synchronous API nobody has thought to add to that list will
still get through.
