# MediAgent

An audit of a real product design file, the first one this plugin was pointed
at that was not built for it. 26,966 nodes, 549 instances, 104 components, 355
styles and 267 variables, none of them from a published library.

It is here because it changed three of the detection rules. What it found on
the first run, and what each of those was, is in the repository README under
"What a real file did to it".

## What is committed, and what that is worth

`findings.json` is the full report: every finding, the counts, the rates and
the score. `manifest.sha256` holds its hash, and the hash of the snapshot it
was computed from.

**The snapshot itself is not committed.** It carries the text content of 27,000
nodes from somebody's product file, and publishing that to make a number
checkable is a bad trade. The consequence is stated rather than glossed: the
numbers here are traceable, in that the snapshot hash proves which file
produced them, but they are **not independently recomputable** the way
`evidence/results/` is. Nobody can rerun this audit without the file.

Everything in `fixtures/recorded/` is recomputable, and every accuracy number
this project publishes comes from there. This directory is a field report, not
evidence of the same kind, and it is filed separately for that reason.

`npm run check:evidence` verifies that `findings.json` still hashes to what
`manifest.sha256` claims, so the artifact cannot be edited after the fact. It
cannot verify the findings themselves, for the reason above.

## Reproducing it

With the original file open in Figma: run Drift Auditor, press Scan file, then
Save findings. Compare to `findings.json`. The snapshot hash in
`manifest.sha256` identifies the exact recording this was computed from.
