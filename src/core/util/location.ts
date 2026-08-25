import type { FindingLocation } from "../model/finding.ts"
import type { ComponentKey, DocumentSnapshot, NodeId } from "../model/snapshot.ts"
import { namePath, pageOf } from "./tree.ts"

export interface Owner {
  readonly id: NodeId
  readonly name: string
  readonly componentKey?: ComponentKey
  readonly componentName?: string
}

/** Where a finding is, phrased so a reader can walk to it in the layers panel. */
export function locate(snapshot: DocumentSnapshot, nodeId: NodeId, owner?: Owner): FindingLocation {
  const page = pageOf(snapshot, nodeId)

  return {
    pageId: page?.id ?? "",
    pageName: page?.name ?? "unknown page",
    path: page ? namePath(snapshot, page.id, nodeId) : (snapshot.nodes[nodeId]?.name ?? nodeId),
    ownerId: owner?.id ?? null,
    ownerName: owner?.name ?? null,
    ...(owner?.componentKey !== undefined && { componentKey: owner.componentKey }),
    ...(owner?.componentName !== undefined && { componentName: owner.componentName }),
  }
}
