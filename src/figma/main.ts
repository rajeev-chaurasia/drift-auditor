import { postToUi, type UiMessage } from "./messages"

figma.showUI(__html__, { width: 480, height: 600, themeColors: true })

figma.ui.onmessage = (message: UiMessage) => {
  if (message.type === "close") figma.closePlugin()
}

postToUi({ type: "ready" })
