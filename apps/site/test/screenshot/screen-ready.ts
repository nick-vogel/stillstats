/**
 * Whether the screen in `document` has landed: the signed-in header, or from 48rem the sidebar's
 * nav in its place, and the screen's heading are in, and no region is busy. It goes by elements and `aria-busy`, never by class: shadcn's Input
 * and Native Select carry `placeholder:text-muted-foreground`, and every placeholder already sits
 * in a busy region. The signed-out screen has a heading but no header and no nav. The walk runs this in the
 * page from its source text, so it reads nothing but its argument.
 */
export function screenLanded(document: { querySelector(selector: string): unknown }): boolean {
  const signedIn =
    document.querySelector('main header, main nav') && document.querySelector('main h1')
  return !!signedIn && !document.querySelector('[aria-busy="true"]')
}
