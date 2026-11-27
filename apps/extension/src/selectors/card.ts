// Studio's markup for the latest video card on the dashboard, as the fixture of 2026-10-10 shows it
// (test/fixtures/studio/dashboard.html). Each surface keeps its selectors in its own file.

export function latestVideoCardIn(document: Document): Element | null {
  return document.querySelector('ytcd-entity-snapshot-item')
}

/**
 * The href of the card's "Go to video analytics" link, `/video/<id>/analytics/...`. Studio gives
 * this link and the comments link the same `test-id`, so the button inside it tells them apart.
 */
export function analyticsHrefIn(card: Element): string | null {
  return (
    card.querySelector('#go-to-video-analytics-button')?.closest('a')?.getAttribute('href') ?? null
  )
}

/**
 * Studio's Views row: the first row of the metrics table that holds a metric value. The ranking
 * row before it holds none. Found by structure, not by its label, which Studio translates.
 */
export function viewsRowIn(card: Element): Element | null {
  const rows = card.querySelectorAll('#metrics-table > .table-row')
  return [...rows].find((row) => row.querySelector('.metrics-value')) ?? null
}
