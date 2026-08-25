import type { VariableId, VariableRecord } from "../../core/model/snapshot.ts"

export class VariableResolver {
  private readonly records = new Map<VariableId, VariableRecord>()
  private readonly misses = new Set<VariableId>()

  async note(id: string | undefined): Promise<VariableId | undefined> {
    if (!id) return undefined
    if (this.records.has(id)) return id
    if (this.misses.has(id)) return undefined

    const variable = await figma.variables.getVariableByIdAsync(id)
    if (!variable) {
      this.misses.add(id)
      return undefined
    }

    this.records.set(id, {
      id,
      key: variable.key,
      name: variable.name,
      resolvedType: variable.resolvedType,
      collectionId: variable.variableCollectionId,
      remote: variable.remote,
    })
    return id
  }

  collect(): Record<VariableId, VariableRecord> {
    return Object.fromEntries(this.records)
  }
}
