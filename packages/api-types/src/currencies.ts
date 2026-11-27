import type { Preferences } from './preferences.ts'

/**
 * Every currency the YouTube Analytics API documents for `reports.query`'s `currency` parameter, in
 * the order its page lists them:
 * https://developers.google.com/youtube/analytics/reference/reports/query, read 2026-10-09, the
 * page "Last updated 2026-09-16 UTC". Google converts revenue into the code at its daily exchange
 * rate, and answers an error to any code outside this list. No API exposes the currency AdSense
 * pays out in, so the app never guesses it: the creator picks one of these.
 */
export const revenueCurrencies = [
  'AED',
  'ANG',
  'ARS',
  'AUD',
  'BDT',
  'BGN',
  'BHD',
  'BND',
  'BOB',
  'BRL',
  'BWP',
  'CAD',
  'CHF',
  'CLP',
  'CNY',
  'COP',
  'CRC',
  'CZK',
  'DKK',
  'DOP',
  'DZD',
  'EGP',
  'EUR',
  'FJD',
  'GBP',
  'GTQ',
  'HKD',
  'HNL',
  'HRK',
  'HUF',
  'IDR',
  'ILS',
  'INR',
  'JMD',
  'JOD',
  'JPY',
  'KES',
  'KRW',
  'KWD',
  'KYD',
  'KZT',
  'LBP',
  'LKR',
  'MAD',
  'MDL',
  'MKD',
  'MUR',
  'MVR',
  'MXN',
  'MYR',
  'NAD',
  'NGN',
  'NIO',
  'NOK',
  'NPR',
  'NZD',
  'OMR',
  'PEN',
  'PGK',
  'PHP',
  'PKR',
  'PLN',
  'PYG',
  'QAR',
  'RON',
  'RSD',
  'RUB',
  'SAR',
  'SCR',
  'SEK',
  'SGD',
  'SLL',
  'SVC',
  'THB',
  'TND',
  'TRY',
  'TTD',
  'TWD',
  'TZS',
  'UAH',
  'UGX',
  'USD',
  'UYU',
  'UZS',
  'VEF',
  'VND',
  'XAF',
  'XOF',
  'YER',
  'ZAR',
] as const
export type RevenueCurrency = (typeof revenueCurrencies)[number]

/** The currency revenue shows in until the creator picks one: Google's own default. */
export const defaultCurrency: RevenueCurrency = 'USD'

/** One of the currencies Google's Analytics API documents, which is the only list it takes. */
export function isRevenueCurrency(value: unknown): value is RevenueCurrency {
  return (revenueCurrencies as readonly unknown[]).includes(value)
}

/**
 * The currency revenue is read and shown in: the saved one, or USD when none is saved. A code the
 * database holds from before the API took only Google's list falls back to USD too, so it never
 * reaches Google.
 */
export function currencyOf(saved: Preferences): RevenueCurrency {
  return isRevenueCurrency(saved.currency) ? saved.currency : defaultCurrency
}
