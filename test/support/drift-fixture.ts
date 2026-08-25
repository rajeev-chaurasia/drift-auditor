import type { LabelSet } from "../../src/core/accuracy/labels.ts"
import { buildSnapshot } from "./build-snapshot.ts"
import { instanceInfo, solidFill } from "./instances.ts"

/**
 * A hand authored file that carries every trap the override detector claims to
 * handle, next to drift it claims to catch.
 *
 * This is the harness proof, not the published accuracy number. The number in
 * the evidence artifact comes from a fixture recorded out of a real Figma
 * file, because a snapshot written by hand can only contain the node shapes
 * whoever wrote it already thought of.
 */
export const driftSnapshot = buildSnapshot({
  pages: [
    {
      id: "page",
      type: "PAGE",
      name: "Product",
      children: [
        {
          id: "main",
          type: "COMPONENT",
          name: "Button",
          componentKey: "k-main",
          props: { fills: solidFill("#0D99FF"), cornerRadius: 8, opacity: 1 },
          children: [
            {
              id: "main-label",
              type: "TEXT",
              name: "Label",
              props: { characters: "Submit", typography: { fontSize: 14 } },
            },
            { id: "main-icon", type: "VECTOR", name: "Icon", visible: true },
          ],
        },

        {
          id: "drifted",
          type: "INSTANCE",
          name: "Button drifted",
          props: { fills: solidFill("#FF3B30"), cornerRadius: 20, opacity: 1 },
          instance: instanceInfo("main", [
            { nodeId: "drifted", fields: ["fills", "topLeftRadius", "topRightRadius", "bottomLeftRadius"] },
            { nodeId: "drifted-label", fields: ["characters", "fontSize"] },
            { nodeId: "drifted-icon", fields: ["visible", "effects"] },
          ]),
          children: [
            {
              id: "drifted-label",
              type: "TEXT",
              name: "Label",
              props: { characters: "Buy now", typography: { fontSize: 18 }, fills: solidFill("#FFFFFF") },
            },
            { id: "drifted-icon", type: "VECTOR", name: "Icon", visible: false },
          ],
        },

        {
          id: "configured",
          type: "INSTANCE",
          name: "Button configured",
          props: { fills: solidFill("#0D99FF"), cornerRadius: 8, opacity: 1 },
          instance: instanceInfo("main", [
            { nodeId: "configured", fields: ["componentProperties"] },
            { nodeId: "configured-label", fields: ["characters"] },
          ]),
          children: [
            {
              id: "configured-label",
              type: "TEXT",
              name: "Label",
              props: { characters: "Add to basket", typography: { fontSize: 14 } },
              componentPropertyReferences: { characters: "Label#1:0" },
            },
            { id: "configured-icon", type: "VECTOR", name: "Icon", visible: true },
          ],
        },

        {
          id: "Chip",
          type: "COMPONENT",
          name: "Chip",
          componentKey: "k-chip",
          props: { fills: solidFill("#8E8E93") },
        },
        { id: "chip-1", type: "INSTANCE", name: "Chip one", props: { fills: solidFill("#8E8E93") }, instance: instanceInfo("Chip", [], "k-chip") },
        { id: "chip-2", type: "INSTANCE", name: "Chip two", props: { fills: solidFill("#8E8E93") }, instance: instanceInfo("Chip", [], "k-chip") },

        {
          id: "tokenised",
          type: "RECTANGLE",
          name: "Tokenised swatch",
          props: { fills: [{ kind: "solid", hex: "#0D99FF", opacity: 1, visible: true, variableId: "V:brand" }] },
        },
        {
          id: "published",
          type: "RECTANGLE",
          name: "Published swatch",
          props: { fills: solidFill("#0D99FF"), styles: { fill: "S:published" } },
        },
        {
          id: "scratch",
          type: "RECTANGLE",
          name: "Scratch swatch",
          props: { fills: solidFill("#34C759"), styles: { fill: "S:local" } },
        },
        {
          id: "photo",
          type: "RECTANGLE",
          name: "Photo",
          props: { fills: [{ kind: "image", visible: true }] },
        },
        {
          id: "hidden",
          type: "RECTANGLE",
          name: "Hidden swatch",
          props: { fills: [{ kind: "solid", hex: "#FF9500", opacity: 1, visible: false, variableId: null }] },
        },

        {
          id: "reverted",
          type: "INSTANCE",
          name: "Button reverted",
          props: { fills: solidFill("#0D99FF"), cornerRadius: 8, opacity: 1 },
          instance: instanceInfo("main", [
            { nodeId: "reverted-label", fields: ["characters"] },
            { nodeId: "reverted-icon", fields: ["locked", "expanded", "x", "y"] },
          ]),
          children: [
            {
              id: "reverted-label",
              type: "TEXT",
              name: "Label",
              props: { characters: "Submit", typography: { fontSize: 14 } },
            },
            { id: "reverted-icon", type: "VECTOR", name: "Icon", visible: true },
          ],
        },
      ],
    },
  ],
  components: [
    { key: "k-main", name: "Button", remote: false, nodeId: "main" },
    { key: "k-chip", name: "Chip", remote: false, nodeId: "Chip" },
  ],
  styles: [
    { id: "S:published", key: "sk-1", name: "Brand/Primary", type: "PAINT", remote: true },
    { id: "S:local", key: "sk-2", name: "Scratch/Green", type: "PAINT", remote: false },
  ],
  variables: [
    { id: "V:brand", key: "vk-1", name: "colour/brand", resolvedType: "COLOR", collectionId: "C:1", remote: true },
  ],
})

export const driftLabels: LabelSet = {
  snapshot: "hand-authored",
  split: "tuning",
  notes:
    "Written from the file, not from detector output. Scratch swatch is here unlabelled on purpose: " +
    "pointing at a local style is still a decision to follow something.",
  cases: [
    {
      page: "Product",
      path: "Button drifted",
      field: "fills",
      category: "override-drift",
      why: "the instance background was repainted by hand",
    },
    {
      page: "Product",
      path: "Button drifted",
      field: "cornerRadius",
      category: "override-drift",
      why: "three of four corners were rounded further, which is one change to a reader",
    },
    {
      page: "Product",
      path: "Button drifted / Label",
      field: "characters",
      category: "override-drift",
      why: "the label was retyped rather than set through a property",
    },
    {
      page: "Product",
      path: "Button drifted / Label",
      field: "fontSize",
      category: "override-drift",
      why: "the type size was nudged away from the component",
    },
    {
      page: "Product",
      path: "Button drifted / Icon",
      field: "visible",
      category: "override-drift",
      why: "the icon was hidden on this instance only",
    },
    {
      page: "Product",
      path: "Button drifted / Icon",
      field: "effects",
      category: "override-drift",
      why: "a shadow was added, a field this audit reports without modelling its value",
    },

    {
      page: "Product",
      path: "Button",
      field: "fills[0]",
      category: "token-drift",
      why: "the component types its brand blue directly instead of binding the variable that exists",
    },
    {
      page: "Product",
      path: "Button drifted",
      field: "fills[0]",
      category: "token-drift",
      why: "this instance was repainted with a colour that is in no collection",
    },
    {
      page: "Product",
      path: "Chip",
      field: "fills[0]",
      category: "token-drift",
      why: "the component itself hardcodes grey, so the defect is here and not in its two instances",
    },
    {
      page: "Product",
      path: "Button drifted / Label",
      field: "fills[0]",
      category: "token-drift",
      why: "the retyped label was also repainted by hand",
    },
  ],
}
