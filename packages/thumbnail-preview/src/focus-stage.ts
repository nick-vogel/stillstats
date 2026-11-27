// Focus mode's page half, from nick-vogel/nlvogel-site's `ThumbnailTool.tsx` at `6d5d921`.
// nlvogel.com named its masthead, footer, call to action band and article; this package cannot
// name the elements of the page it is mounted in, so it walks up from the tool instead, and a
// sibling added to the page later cannot be missed.

/**
 * Puts the tool alone on the page: every sibling of each node from `root` up to `body` becomes
 * `inert` and `t-focus-hidden`, every ancestor between them a `t-focus-host`, and the document
 * `t-focus-locked`. `inert` takes the page out of the accessibility tree and the stylesheet's
 * `display: none` takes it out of sight; both are set here so one undo cannot miss either.
 *
 * Answers the undo, which removes exactly what this call set, from the set captured now: a node
 * re-queried later could strand an `inert` nothing clears, and an element inert before entry
 * stays inert. A root outside a document applies nothing, since a half-applied stage leaves the
 * page copy visible while the rest goes inert.
 */
export function enterFocusStage(root: HTMLElement): () => void {
  const body = root.ownerDocument.body
  if (!root.isConnected || !body.contains(root) || root === body) return () => {}

  const undo: (() => void)[] = []
  const addClass = (element: Element, name: string) => {
    if (element.classList.contains(name)) return
    element.classList.add(name)
    undo.push(() => element.classList.remove(name))
  }

  for (let node: HTMLElement = root; node !== body; ) {
    const parent = node.parentElement
    if (!parent) break
    for (const sibling of parent.children) {
      if (sibling === node || !(sibling instanceof HTMLElement)) continue
      if (!sibling.inert) {
        sibling.inert = true
        undo.push(() => {
          sibling.inert = false
        })
      }
      addClass(sibling, 't-focus-hidden')
    }
    if (parent !== body) addClass(parent, 't-focus-host')
    node = parent
  }
  addClass(root.ownerDocument.documentElement, 't-focus-locked')

  return () => {
    for (const step of undo.splice(0).reverse()) step()
  }
}
