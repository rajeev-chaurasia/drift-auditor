# 0002, a score nobody has to trust

## Status

Accepted. The table is `src/core/score/weights.ts` and the evidence validator
recomputes every total from it.

## Context

A drift audit that reports "1,847 findings" is useless. Two hundred of those
are copy someone rewrote on purpose and four are a brand colour hardcoded into
a component used everywhere, and the count says nothing about which is which.
So a severity model is not optional.

It is also the softest thing in the repository. Every weight is a judgement,
and a judgement dressed up as a number is exactly what this project spends its
effort avoiding elsewhere. Worse, weights invite tuning: the temptation is to
adjust them until the output looks right on the file in front of you, at which
point the score measures the file it was fitted to and nothing else.

## Decision

Three things together, and none of them works alone.

**The weights live in one table with a written reason for each number.** Not a
constant scattered through a detector, not a magic number in a sort
comparator. `src/core/score/weights.ts` is the whole model, and every entry
carries the argument for its value in a comment next to it.

**Two raw ratios are published beside the score, and neither depends on the
table.** `overrideRate` is drifted instances over instances. `tokenCoverage` is
tokenised paints over bindable paints. Both recompute from `findings.json` with
arithmetic. A reader who thinks colour should not outrank copy can throw the
score away and still have two numbers that mean something.

**Reach is logarithmic, not linear.** A hardcoded colour in a component used
sixty four times is worse than the same colour used once, because it is sixty
four places a rebrand has to reach. It is not sixty four times worse, because
fixing it is still one edit. `1 + log2(reach)` says both of those at once.
Linear reach would let a single popular component dominate every other finding
in the file.

**An inferred finding is worth zero.** Detachment candidates carry
`confidence: "candidate"` and contribute nothing to the total. A guess with the
same weight as an answer the API gave directly would undo the distinction the
rest of the repository is built on.

The model carries a version number. A score computed under one set of weights
is not comparable to a score computed under another, and stamping the version
is cheaper than discovering that later.

## Consequences

The good:

- The validator recomputes every published total from the table, so a score in
  the README cannot drift from the code that produced it.
- Disagreeing with the model costs a reader nothing. The ratios survive.
- Changing a weight changes every published number and fails the evidence
  check until the artifact is regenerated, which is the correct amount of
  friction for changing what "severe" means.

The cost:

- The weights are still judgements. Writing down the argument for each one
  makes them arguable, not correct.
- Two files now have to move together to change a weight: the table and the
  committed artifact.
- The score is not comparable across files of different sizes. It is a total,
  not a rate, and a bigger file will score higher for being bigger. The two
  ratios are the ones to compare across files, which is stated here because
  nothing in the number itself says so.
