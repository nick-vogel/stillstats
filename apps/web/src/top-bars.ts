import { shareLabelOf, shareOf } from './share.ts'

/** The rows drawn one bar each; the rest add up to one more bar. */
export const shownRows = 10

export interface TopBar {
  /** The row's own key, or `other` for the bar adding up the rest and any folded rows. */
  key: string
  name: string
  engagedViews: string
  /** The bar's share of the engaged views of every row Google answered, such as "(26%)". */
  share: string
  /** The bar's length, as a percentage of the longest bar shown. */
  width: number
}

/**
 * One bar for each of the first 10 rows in the given order, then one bar named `otherName` adding
 * up the rest. Rows keyed `foldedKey` never take one of the 10 bars: they always add into the
 * `otherName` bar, which shows whenever there is a folded row or a row past the first 10. With no
 * `otherName`, one bar for every row. Each carries its share of the engaged views of every row
 * given, folded rows included, and its length against the longest bar shown.
 */
export function topBarsOf(
  rows: { key: string; name: string; engagedViews: number }[],
  otherName: string | undefined,
  locale?: string,
  foldedKey?: string,
): TopBar[] {
  const unfolded = rows.filter(({ key }) => key !== foldedKey)
  const rest = [...rows.filter(({ key }) => key === foldedKey), ...unfolded.slice(shownRows)]
  const bars =
    otherName === undefined || rest.length === 0
      ? rows
      : [
          ...unfolded.slice(0, shownRows),
          {
            key: 'other',
            name: otherName,
            engagedViews: rest.reduce((sum, { engagedViews }) => sum + engagedViews, 0),
          },
        ]
  const allEngagedViews = rows.reduce((sum, { engagedViews }) => sum + engagedViews, 0)
  const longest = Math.max(0, ...bars.map(({ engagedViews }) => engagedViews))
  return bars.map(({ key, name, engagedViews }) => ({
    key,
    name,
    engagedViews: engagedViews.toLocaleString(locale),
    share: shareLabelOf(engagedViews, allEngagedViews),
    width: shareOf(engagedViews, longest),
  }))
}
