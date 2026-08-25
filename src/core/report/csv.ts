import type { Finding } from "../model/finding.ts"
import { severity } from "../score/score.ts"

const COLUMNS = [
  "id",
  "category",
  "confidence",
  "fieldClass",
  "field",
  "page",
  "path",
  "layer",
  "component",
  "expected",
  "actual",
  "baselineAvailable",
  "blastRadius",
  "severity",
  "note",
] as const

/**
 * RFC 4180 quoting, and nothing clever.
 *
 * Layer names arrive from a Figma file and can hold commas, quotes and
 * newlines. A value that begins with an equals sign is a formula to some
 * spreadsheets, and this does not mangle it to prevent that, because the
 * export has to agree with the JSON beside it. See docs/known-misses.md.
 */
function cell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function row(finding: Finding): string {
  return [
    finding.id,
    finding.category,
    finding.confidence,
    finding.fieldClass,
    finding.field,
    finding.location.pageName,
    finding.location.path,
    finding.subjectName,
    finding.location.componentName ?? "",
    finding.expected,
    finding.actual,
    finding.baselineAvailable,
    finding.blastRadius,
    severity(finding),
    finding.note ?? "",
  ]
    .map(cell)
    .join(",")
}

export function toCsv(findings: readonly Finding[]): string {
  return [COLUMNS.join(","), ...findings.map(row)].join("\n") + "\n"
}
