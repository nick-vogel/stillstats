/** A part of a whole as a percentage, a bar's length. A whole of nothing has no share. */
export function shareOf(part: number, whole: number): number {
  return whole === 0 ? 0 : (part / whole) * 100
}

/**
 * A percentage, 0 to 100, as a whole percent, such as "31%". A share above 0 and under 1% shows as
 * "<1%", so it never rounds up to 1% or down to 0%, and a share above 99% and under 100% shows as
 * ">99%", so it never rounds up to 100%. The rules are approved in creator-analytics#69; the share
 * label builds on them, so the two never drift.
 */
export function percentLabelOf(percent: number): string {
  if (percent > 0 && percent < 1) return '<1%'
  if (percent > 99 && percent < 100) return '>99%'
  return `${Math.round(percent)}%`
}

/**
 * A part of a whole as a whole percent in parentheses, such as "(26%)", by `percentLabelOf`'s
 * rules: "(<1%)" above 0 and under 1%, "(>99%)" above 99% and under the whole. A whole of nothing
 * has no share, so no label. The format is approved in creator-analytics#69.
 */
export function shareLabelOf(part: number, whole: number): string {
  if (whole === 0) return ''
  return `(${percentLabelOf((part / whole) * 100)})`
}

/** A number as text, then its share label if it has one, such as "1,234 (61%)" or a bare "0". */
export function numberWithShareOf(number: string, share: string): string {
  return share ? `${number} ${share}` : number
}
