// Studio's markup for the Content list, as the fixture of 2026-10-10 shows it
// (test/fixtures/studio/content-list.html, the Videos tab). Each surface keeps its selectors in its
// own file.

export function videoListIn(document: Document): Element | null {
  return document.querySelector('ytcp-video-section-content#video-list')
}

/**
 * Studio's page title, "Channel content": the page header of the Content section,
 * `ytcp-content-section#video-list`, the `ytcp-entity-page-header` that holds Studio's `h1`. The
 * extension's line goes directly after it, as the section's own child, before Studio's tab bar: the
 * section's children are its header, its tab bar and its tab page, not items it repeats. Not inside
 * the header, where the `h1` sits in the header's own wrapper, whose layout the fixture does not
 * show and which may set the line in a row beside the title. Not `#page-title` either, which is an
 * empty `ytcp-animatable` in the app shell, outside the section. Found by structure, not by the
 * words, which Studio translates.
 */
export function pageTitleIn(document: Document): Element | null {
  return document.querySelector('ytcp-content-section#video-list > ytcp-entity-page-header')
}

/** Studio's column headings, which hold the Views heading. */
export function tableHeaderIn(list: Element): Element | null {
  return list.querySelector('#table-header')
}

/**
 * The Views column's heading cell, which holds Studio's line with the word "Views" and the
 * extension's anchor after that line, and what a Studio redraw's copies of that anchor are cleaned
 * from. Found by its column's class, like `viewsCellIn`, not by the word "Views", which Studio
 * translates.
 */
export function viewsHeadingIn(header: Element): Element | null {
  return header.querySelector('[role="columnheader"].tablecell-views')
}

/**
 * The line of the Views heading that holds Studio's sort control and its word "Views", its `h3`, a
 * child of the heading cell. The extension's anchor goes directly after it, as the cell's own child,
 * and never inside it: the `h3` clips whatever lies outside its own box (see `headingStyle` in
 * surfaces/render.ts). Found by structure, not by the word, which Studio translates.
 */
export function viewsWordLineIn(heading: Element): Element | null {
  return heading.querySelector(':scope > h3')
}

export function videoRowsIn(list: Element): Element[] {
  return [...list.querySelectorAll('ytcp-video-row')]
}

/** The href of the row's title link, `/video/<id>/edit`. */
export function videoHrefIn(row: Element): string | null {
  return row.querySelector('a#video-title')?.getAttribute('href') ?? null
}

/** The row's Views cell. Found by its column's class, not by its heading, which Studio translates. */
export function viewsCellIn(row: Element): Element | null {
  return row.querySelector('.tablecell-views')
}
