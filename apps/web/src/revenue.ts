import type { RevenueCurrency } from '@creator-analytics/api-types'

// The text is approved word for word in creator-analytics#78. Change it only with Nick.
export const revenueText = {
  consentMissing: 'Revenue needs your consent.',
  // Approved word for word in creator-analytics#119 (W32). Change it only with Nick.
  consentButton: 'Give revenue consent',
  notMonetized:
    'This channel is not in the YouTube Partner Program, so YouTube reports no revenue for it.',
  // Approved word for word in creator-analytics#151. Change it only with Nick.
  noRevenue:
    'YouTube reports no revenue for this date range. That can happen when no revenue was earned during the date range, or when the channel is not in the YouTube Partner Program.',
  otherSourcesNote: 'Other sources include channel memberships and Supers.',
  // Approved word for word in creator-analytics#79. Change it only with Nick.
  currencyNote:
    'YouTube converts revenue at its daily exchange rate. Your final amount is in AdSense.',
}

function moneyFormatOf(currency: RevenueCurrency, locale?: string): Intl.NumberFormat {
  return new Intl.NumberFormat(locale, { style: 'currency', currency, signDisplay: 'negative' })
}

/**
 * An amount in the answer's currency, the creator's, as the locale writes it, such as "$4.57" or
 * "4,57 €". An amount that rounds to zero in the currency's smallest unit shows no minus sign, so
 * floating point leftovers never read as "-$0.00".
 */
export function moneyTextOf(amount: number, currency: RevenueCurrency, locale?: string): string {
  return moneyFormatOf(currency, locale).format(amount)
}

/**
 * An amount as a chart's y axis label: rounded to the currency's own smallest unit, then in compact
 * notation in the answer's currency, such as "$12K" or "1,2 M €". The rounding keeps a floating
 * point leftover from reading as "-$0.000000000000001" and the yen from showing decimals.
 */
export function axisMoneyTextOf(
  amount: number,
  currency: RevenueCurrency,
  locale?: string,
): string {
  const decimals = moneyFormatOf(currency, locale).resolvedOptions().maximumFractionDigits ?? 2
  const rounded = Math.round(amount * 10 ** decimals) / 10 ** decimals
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    notation: 'compact',
    signDisplay: 'negative',
  }).format(rounded)
}

/**
 * An amount as `moneyTextOf` writes it, but with an ordinary space between the currency and the
 * amount, where the locale puts a no-break one, so a card too narrow for "UZS 62,193,167.99" breaks
 * the line after the code. The amount keeps its own no-break separators, so it never breaks inside.
 */
export function wrappableMoneyTextOf(
  amount: number,
  currency: RevenueCurrency,
  locale?: string,
): string {
  return moneyFormatOf(currency, locale)
    .formatToParts(amount)
    .map(({ type, value }) => (type === 'literal' ? value.replace(/\s/g, ' ') : value))
    .join('')
}

/**
 * RPM: estimated revenue per 1,000 engaged views, simple arithmetic on YouTube's own numbers under
 * ADR 0013, for every format. Null with no engaged views, which earn no rate. Every caller passes
 * the revenue `rpmRevenueOf` counts, so the RPM switch on Settings leaves other sources out.
 */
export function rpmOf(estimatedRevenue: number, engagedViews: number): number | null {
  return engagedViews > 0 ? (estimatedRevenue / engagedViews) * 1000 : null
}

// The line's text is approved word for word in creator-analytics#119 (W4). Change it only with Nick.
/** The smaller line under the revenue card, such as "RPM: $4.57". */
export function rpmLineOf(rpm: number, currency: RevenueCurrency, locale?: string): string {
  return `RPM: ${moneyTextOf(rpm, currency, locale)}`
}

/**
 * The note under the cards on the revenue YouTube ties to no video or format, when there is any in
 * the currency's smallest unit: an amount that shows as "$0.00", or "¥0", is none.
 */
export function noFormatNoteOf(
  amount: number,
  currency: RevenueCurrency,
  locale?: string,
): string | null {
  const format = moneyFormatOf(currency, locale)
  const decimals = format.resolvedOptions().maximumFractionDigits ?? 2
  if (Math.round(amount * 10 ** decimals) <= 0) return null
  return `YouTube ties ${format.format(amount)} of this channel's revenue to no video or format.`
}
