type Child = Node | string | null | undefined | false

/** Builds elements from text rather than from HTML, so no value can be markup. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Record<string, string> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag)
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value)
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue
    element.append(typeof child === "string" ? document.createTextNode(child) : child)
  }
  return element
}

export function replace(target: HTMLElement, ...children: Child[]): void {
  target.replaceChildren()
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue
    target.append(typeof child === "string" ? document.createTextNode(child) : child)
  }
}
