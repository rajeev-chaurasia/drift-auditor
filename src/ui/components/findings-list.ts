import type { Category, Finding } from "../../core/model/finding.ts"
import { severity } from "../../core/score/score.ts"
import { h } from "./dom.ts"

export type Filter = Category | "all"

const LABELS: Readonly<Record<Category, string>> = {
  "override-drift": "Instance drift",
  "token-drift": "Token drift",
  detachment: "Detached?",
}

function values(finding: Finding): HTMLElement {
  if (finding.category === "detachment") {
    return h("p", {}, h("span", { class: "muted" }, "looks like "), finding.expected ?? "")
  }
  if (finding.category === "token-drift") {
    return h(
      "p",
      {},
      finding.actual ?? "",
      h("span", { class: "muted" }, " is not a token"),
      finding.blastRadius > 1 ? h("span", { class: "muted" }, `, reaching ${finding.blastRadius} instances`) : "",
    )
  }
  if (finding.expected === null && finding.actual === null) {
    return h("p", { class: "muted" }, finding.note ?? "no value recorded")
  }
  if (finding.expected === null) {
    return h(
      "p",
      {},
      h("span", { class: "muted" }, "is "),
      finding.actual ?? "",
      h("span", { class: "muted" }, ", baseline unknown"),
    )
  }
  return h(
    "p",
    {},
    h("span", { class: "muted" }, "was "),
    finding.expected,
    h("span", { class: "muted" }, ", is "),
    finding.actual ?? "",
  )
}

function row(finding: Finding): HTMLElement {
  const weight = severity(finding)

  return h(
    "li",
    { class: finding.confidence === "exact" ? "finding" : "finding candidate" },
    h(
      "div",
      { class: "finding-head" },
      h("span", { class: "chip" }, finding.fieldClass),
      h("strong", {}, finding.field),
      weight > 0 ? h("span", { class: "muted weight" }, String(weight)) : h("span", { class: "muted weight" }, "guess"),
    ),
    h("p", { class: "muted" }, `${finding.location.pageName} / ${finding.location.path}`),
    values(finding),
  )
}

export function filterBar(
  findings: readonly Finding[],
  active: Filter,
  onChange: (filter: Filter) => void,
): HTMLElement {
  const counts = new Map<Filter, number>([["all", findings.length]])
  for (const finding of findings) counts.set(finding.category, (counts.get(finding.category) ?? 0) + 1)

  const button = (filter: Filter, label: string): HTMLElement | null => {
    const total = counts.get(filter) ?? 0
    if (filter !== "all" && total === 0) return null

    const element = h("button", { class: filter === active ? "filter on" : "filter" }, `${label} ${total}`)
    element.onclick = () => onChange(filter)
    return element
  }

  return h(
    "div",
    { class: "row filters" },
    button("all", "All"),
    button("override-drift", LABELS["override-drift"]),
    button("token-drift", LABELS["token-drift"]),
    button("detachment", LABELS.detachment),
  )
}

/**
 * Worst first. The report keeps its own order, sorted by id, because two
 * artifacts have to be diffable. What a person opening the panel wants is the
 * expensive thing at the top.
 */
export function findingsList(findings: readonly Finding[], filter: Filter, limit: number): HTMLElement {
  const shown = [...findings]
    .filter((finding) => filter === "all" || finding.category === filter)
    .sort((a, b) => severity(b) - severity(a))

  if (shown.length === 0) {
    return h("p", { class: "note muted" }, "Nothing found here against the components this file can read.")
  }

  return h(
    "ul",
    { class: "findings" },
    ...shown.slice(0, limit).map(row),
    shown.length > limit
      ? h("li", { class: "muted" }, `and ${shown.length - limit} more, saved in full by Save findings`)
      : null,
  )
}
