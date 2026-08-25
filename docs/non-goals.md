# Non-goals

Each of these is a real feature of a real design system tool, and each is
deliberately absent. The list is here so the absences read as decisions.

## Auto-fix

No re-attaching an instance, no rebinding a token, no writes of any kind. This
plugin reads. A write path needs an undo story and a trust story that a
read-only audit does not, and it would roughly double the surface without
making the drift number any more believable.

## Certainty about detachment

A detached instance becomes a plain frame. Figma stores nothing that links it
back to what it used to be, so no plugin can know. Detachment therefore ships
as an explicitly probabilistic category with its own published precision and
recall, measured on a fixture split the thresholds were never chosen against.
It is never folded into the exact categories, and it never contributes to the
headline accuracy number.

## Cross-file and team-wide audits

One file per run. A team sweep needs the REST API, a token and somewhere to run
it, and none of that is reachable from a Community plugin. The snapshot format
is the seam: recording several files and auditing them together is a script
somebody can write on top, without this plugin growing a server.

## Network access

`networkAccess: { allowedDomains: ["none"] }`. The plugin cannot make a
request. Design files are commercially sensitive and an audit tool that
uploads one has to be trusted rather than checked. This is a feature of the
design, not a gap in it.

## Effect, grid and layout-grid drift

Fills, strokes and typography are what design systems actually token and what
audits actually chase. The detector interface is one method, so adding a
category is a new file and one line in the registry. Adding it the day it is
needed costs less than carrying three unused ones.

## A severity model tuned to look good

The weights are a committed table with a written rationale, not numbers fitted
until the output felt right. Both raw ratios are published next to the score
precisely so a reader can ignore the weights entirely.

## A dashboard, a history, or a trend line

Drift over time needs somewhere to store yesterday's number, which means either
a backend or writing into the customer's file. The export exists so that a
design-ops team can keep that history in whatever they already use.
