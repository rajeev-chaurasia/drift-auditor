import type { AuditReport } from "../../core/report/audit.ts"
import { h } from "./dom.ts"

function stat(value: string, label: string): HTMLElement {
  return h("div", { class: "stat" }, h("strong", {}, value), h("span", { class: "muted" }, label))
}

/**
 * The score first, then the two ratios it is derived from.
 *
 * The ratios are the honest numbers: a reader who disagrees with the weight
 * table can recompute both from the findings and ignore the score entirely.
 */
export function stats(report: AuditReport): HTMLElement {
  const { rates, counts, score } = report

  return h(
    "div",
    { class: "stats" },
    stat(String(score.total), "drift score"),
    stat(`${(rates.overrideRate * 100).toFixed(0)}%`, `of ${rates.instancesConsidered} instances drifted`),
    stat(
      `${(rates.tokenCoverage.coverage * 100).toFixed(0)}%`,
      `of ${rates.tokenCoverage.bindable} paints tokenised`,
    ),
    counts.candidates > 0 ? stat(String(counts.candidates), "detachment guesses") : null,
  )
}
