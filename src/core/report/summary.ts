import type { DocumentSnapshot, NodeType } from "../model/snapshot.ts"
import { walkAll } from "../util/tree.ts"

export interface SnapshotSummary {
  readonly pages: number
  readonly nodes: number
  readonly byType: Readonly<Record<string, number>>
  readonly components: number
  readonly localComponents: number
  readonly remoteComponents: number
  readonly instances: number
  readonly instancesWithoutBaseline: number
  readonly styles: number
  readonly remoteStyles: number
  readonly variables: number
  readonly incomplete: number
}

/**
 * The counts a person can check by hand against Figma's own layers panel.
 * This is what makes the traversal falsifiable before any detector runs on it.
 */
export function summarise(snapshot: DocumentSnapshot): SnapshotSummary {
  const byType: Record<string, number> = {}
  let nodes = 0
  let instances = 0
  let instancesWithoutBaseline = 0

  for (const node of walkAll(snapshot)) {
    nodes += 1
    byType[node.type] = (byType[node.type] ?? 0) + 1

    if (node.type === "INSTANCE") {
      instances += 1
      if (node.instance && !node.instance.baselineAvailable) instancesWithoutBaseline += 1
    }
  }

  const components = Object.values(snapshot.components)
  const styles = Object.values(snapshot.styles)

  return {
    pages: snapshot.pageIds.length,
    nodes,
    byType,
    components: components.length,
    localComponents: components.filter((component) => !component.remote).length,
    remoteComponents: components.filter((component) => component.remote).length,
    instances,
    instancesWithoutBaseline,
    styles: styles.length,
    remoteStyles: styles.filter((style) => style.remote).length,
    variables: Object.keys(snapshot.variables).length,
    incomplete: snapshot.capture.incomplete.length,
  }
}

export function countOfType(summary: SnapshotSummary, type: NodeType): number {
  return summary.byType[type] ?? 0
}
