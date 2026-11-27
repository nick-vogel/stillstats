/**
 * Watch hours: YouTube's `estimatedMinutesWatched` divided by 60. The API carries the minutes and
 * the screens show hours, simple arithmetic on the channel's own numbers under ADR 0013.
 */
export function watchHoursOf(minutes: number): number {
  return minutes / 60
}

// The format is approved in creator-analytics#76: one decimal in the browser's locale, such as
// "12.3". Change it only with Nick.
/** Watch hours with exactly one decimal, so a column of them lines up. */
export function watchHoursTextOf(minutes: number, locale?: string): string {
  return watchHoursOf(minutes).toLocaleString(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}

/**
 * Watch hours as a chart's y axis label: rounded to the tenth of an hour the cards and tables show,
 * then in compact notation, as the locale writes it, such as "1.2K" for 1,234.5 hours.
 */
export function axisWatchHoursTextOf(minutes: number, locale?: string): string {
  const hours = Math.round(watchHoursOf(minutes) * 10) / 10
  return new Intl.NumberFormat(locale, { notation: 'compact' }).format(hours)
}
