# 0001, a pure core over a snapshot

## Status

Accepted, and enforced by `script/check-layering.ts`.

## Context

The obvious way to write this plugin is to walk the document and emit findings
as you go. It is less code, it needs no intermediate model, and it is what
every plugin in this category does.

It also makes the output impossible to check. A finding produced inside a live
traversal can only be reproduced by someone with the file open, the same
library permissions, and the same version of the plugin. That is a demo, not
evidence, and the whole reason this project exists is to make a drift number
falsifiable rather than asserted.

## Decision

The detection logic never touches the Figma API.

Everything under `src/core/` is plain TypeScript over a `DocumentSnapshot`, a
serialisable model of the file. `src/figma/` is the only code allowed to call
the Plugin API, and its single job is to produce a snapshot. The rule is
enforced by a script that fails the build if a core file references the `figma`
global or an ambient plugin type, rather than by anyone remembering it.

`bin/audit.ts` runs the same core from a terminal over a snapshot file, so the
core has two frontends from the first day rather than one with a second bolted
on later.

## Consequences

The good:

- A fixture is a committed JSON file, so the accuracy tests need no Figma and
  no network, and they run in a normal CI container.
- Anyone can rerun an audit that this repository published and get the same
  findings, which is the difference between evidence and a screenshot.
- If the plugin and the terminal ever disagree about one file, that is a real
  bug with a real signal, rather than something nobody would notice.

The cost:

- The snapshot has to carry every property any detector might want, so adding a
  category can mean widening the model and re-recording fixtures.
- Anything the model does not capture is invisible to every detector, forever,
  and the model is now the place where coverage is actually decided.
- A large file is materialised twice, once as nodes and once as JSON. No limit
  is enforced. See [known-misses.md](../known-misses.md).
