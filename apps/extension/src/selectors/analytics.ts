// Studio's markup for a video's analytics page, Overview tab, as the fixture of 2026-10-10 shows it
// (test/fixtures/studio/video-analytics.html). Each surface keeps its selectors in its own file.

/**
 * The header of Studio's key metric card, which holds the metric tabs, when Views is among them.
 * Views is found by its id, `EXTERNAL_VIEWS-tab`, not by its label, which Studio translates. The
 * tabs' listbox treats every child as a tab, so the extension never adds a direct child to it: the
 * line goes before the whole card (`keyMetricCardOf`), and the figure goes inside the Views tab,
 * after its number row (`viewsNumberRowIn`).
 */
export function keyMetricHeaderIn(document: Document): Element | null {
  const header = document.querySelector('#key-metric-header')
  return header?.querySelector('#EXTERNAL_VIEWS-tab') ? header : null
}

/**
 * Studio's key metric card, `yta-key-metric-card`, that holds `header`: the metric tiles and the
 * chart under them. The extension's line goes directly before it, outside it, so it sits above the
 * tiles and the chart (creator-analytics#229). The card is found from the header, so the header
 * with its Views tab stays what proves the page.
 */
export function keyMetricCardOf(header: Element): Element | null {
  return header.closest('yta-key-metric-card')
}

/**
 * The row in Studio's Views tile that holds the tile's number, `#metric-total`. The tile is found by
 * the Views tab's id, not by its label. The row lays its children out side by side, so the
 * extension's figure goes after the row, on a line of its own under the number, never inside it.
 */
export function viewsNumberRowIn(document: Document): Element | null {
  return (
    document.querySelector('#key-metric-header #EXTERNAL_VIEWS-tab #metric-total')?.parentElement ??
    null
  )
}

/**
 * The href of Studio's "YouTube Studio dashboard" link in the page header, `/channel/<id>`. The
 * analytics page's URL carries no channel id, and this link does.
 */
export function dashboardHrefIn(document: Document): string | null {
  return document.querySelector('a#home-button')?.getAttribute('href') ?? null
}
