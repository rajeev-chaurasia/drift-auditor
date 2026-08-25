import type { LabelSet } from "../../src/core/accuracy/labels.ts"
import { buildSnapshot } from "./build-snapshot.ts"
import { instanceInfo } from "./instances.ts"

/**
 * A hand authored file that carries every typography compliance case,
 * next to the traps a blunt detector fails on.
 */
export const typographySnapshot = buildSnapshot({
  pages: [
    {
      id: "page",
      type: "PAGE",
      name: "Typography",
      children: [
        {
          id: "published-text",
          type: "TEXT",
          name: "Published text",
          props: {
            characters: "Header",
            typography: { fontFamily: "Inter", fontStyle: "Bold", fontSize: 24, lineHeight: "32px" },
            styles: { text: "S:text-pub" },
          },
        },
        {
          id: "local-text",
          type: "TEXT",
          name: "Local text",
          props: {
            characters: "Subhead",
            typography: { fontFamily: "Inter", fontStyle: "Regular", fontSize: 16, lineHeight: "24px" },
            styles: { text: "S:text-loc" },
          },
        },
        {
          id: "orphan-style-text",
          type: "TEXT",
          name: "Orphan style text",
          props: {
            characters: "Dangling",
            typography: { fontFamily: "Inter", fontStyle: "Regular", fontSize: 16, lineHeight: "24px" },
            styles: { text: "S:gone" },
          },
        },
        {
          id: "all-bound-text",
          type: "TEXT",
          name: "All bound text",
          props: {
            characters: "Body",
            typography: { fontFamily: "Inter", fontSize: 14 },
            boundVariables: { fontFamily: "V:font-family", fontSize: "V:font-size" },
          },
        },
        {
          id: "partial-bound-text",
          type: "TEXT",
          name: "Partial bound text",
          props: {
            characters: "Caption",
            typography: { fontFamily: "Inter", fontSize: 12 },
            boundVariables: { fontSize: "V:font-size" },
          },
        },
        {
          id: "unbound-text",
          type: "TEXT",
          name: "Unbound text",
          props: {
            characters: "Raw text",
            typography: { fontFamily: "Inter", fontStyle: "Regular", fontSize: 14, lineHeight: "20px" },
          },
        },
        {
          id: "mixed-text",
          type: "TEXT",
          name: "Mixed text",
          props: {
            characters: "Mixed sizes",
            typography: { fontFamily: "Inter", fontSize: "mixed" },
          },
        },
        {
          id: "Badge",
          type: "COMPONENT",
          name: "Badge",
          componentKey: "k-badge",
          children: [
            {
              id: "badge-label",
              type: "TEXT",
              name: "Badge label",
              props: {
                characters: "New",
                typography: { fontFamily: "Inter", fontSize: 11 },
              },
            },
          ],
        },
        {
          id: "badge-1",
          type: "INSTANCE",
          name: "Badge one",
          instance: instanceInfo("Badge", [], "k-badge"),
          children: [
            {
              id: "badge-1-label",
              type: "TEXT",
              name: "Badge label",
              props: {
                characters: "New",
                typography: { fontFamily: "Inter", fontSize: 11 },
              },
            },
          ],
        },
        {
          id: "badge-2",
          type: "INSTANCE",
          name: "Badge two",
          instance: instanceInfo("Badge", [], "k-badge"),
          children: [
            {
              id: "badge-2-label",
              type: "TEXT",
              name: "Badge label",
              props: {
                characters: "New",
                typography: { fontFamily: "Inter", fontSize: 11 },
              },
            },
          ],
        },
      ],
    },
  ],
  components: [
    { key: "k-badge", name: "Badge", remote: false, nodeId: "Badge" },
  ],
  styles: [
    { id: "S:text-pub", key: "sk-text-pub", name: "Typography/Header", type: "TEXT", remote: true },
    { id: "S:text-loc", key: "sk-text-loc", name: "Scratch/Subhead", type: "TEXT", remote: false },
  ],
  variables: [
    { id: "V:font-family", key: "vk-family", name: "type/family", resolvedType: "STRING", collectionId: "C:1", remote: true },
    { id: "V:font-size", key: "vk-size", name: "type/size", resolvedType: "FLOAT", collectionId: "C:1", remote: true },
  ],
})

export const typographyLabels: LabelSet = {
  snapshot: "typography-fixture",
  split: "tuning",
  notes:
    "Written from the file, not from detector output. Local text is here unlabelled on purpose: " +
    "following a local style is still following something.",
  cases: [
    {
      page: "Typography",
      path: "Orphan style text",
      field: "typography",
      category: "typography-drift",
      why: "it names a text style that is not in the file, so it follows nothing at all",
    },
    {
      page: "Typography",
      path: "Partial bound text",
      field: "typography",
      category: "typography-drift",
      why: "only font size is bound to a variable while font family is hardcoded",
    },
    {
      page: "Typography",
      path: "Unbound text",
      field: "typography",
      category: "typography-drift",
      why: "types raw typography values by hand with no style and no bound variables",
    },
    {
      page: "Typography",
      path: "Badge / Badge label",
      field: "typography",
      category: "typography-drift",
      why: "the component itself has untokenised typography, so the defect belongs to the component once",
    },
  ],
}
