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
              props: { characters: "Buy now", typography: { fontSize: 18 } },
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
  components: [{ key: "k-main", name: "Button", remote: false, nodeId: "main" }],
})

export const driftLabels: LabelSet = {
  snapshot: "hand-authored",
  split: "tuning",
  notes: "Written from the file, not from detector output.",
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
  ],
}
