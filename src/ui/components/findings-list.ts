import type { Finding } from "../../core/model/finding.ts"
import { h } from "./dom.ts"

function values(finding: Finding): HTMLElement {
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
    return h("p", {}, h("span", { class: "muted" }, "is "), finding.actual ?? "", h("span", { class: "muted" }, ", baseline unknown"))
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
  return h(
    "li",
    { class: "finding" },
    h("div", { class: "finding-head" }, h("span", { class: "chip" }, finding.fieldClass), h("strong", {}, finding.field)),
    h("p", { class: "muted" }, `${finding.location.pageName} / ${finding.location.path}`),
    values(finding),
  )
}

export function findingsList(findings: readonly Finding[], limit: number): HTMLElement {
  if (findings.length === 0) {
    return h("p", { class: "note muted" }, "No drift found against the components this file can read.")
  }

  return h(
    "ul",
    { class: "findings" },
    ...findings.slice(0, limit).map(row),
    findings.length > limit
      ? h("li", { class: "muted" }, `and ${findings.length - limit} more, saved in full by Save findings`)
      : null,
  )
}
