import type { InstanceInfo, OverrideRecord, PaintRef } from "../../src/core/model/snapshot.ts"

export function instanceInfo(
  mainComponentNodeId: string | null,
  overrides: readonly OverrideRecord[],
  componentKey = "k-main",
): InstanceInfo {
  return {
    mainComponentKey: componentKey,
    mainComponentNodeId,
    baselineAvailable: mainComponentNodeId !== null,
    overrides,
    componentProperties: {},
  }
}

export function solidFill(hex: string): PaintRef[] {
  return [{ kind: "solid", hex, opacity: 1, visible: true, variableId: null }]
}
