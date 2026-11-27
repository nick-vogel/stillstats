import { describe, expect, test } from 'vitest'
import { currencyOf, revenueCurrencies } from './currencies.ts'

describe('the currency revenue is read and shown in', () => {
  test('is the saved one', () => {
    expect(currencyOf({ currency: 'EUR' })).toBe('EUR')
  })

  test('is USD with none saved', () => {
    expect(currencyOf({})).toBe('USD')
  })

  test("is USD for a saved code outside Google's list", () => {
    // A row saved before the API took only Google's list can hold a code such as ISK.
    expect(currencyOf(JSON.parse('{"currency":"ISK"}'))).toBe('USD')
  })
})

describe('the currencies revenue can be read in', () => {
  test("are the 90 codes Google's reports.query page lists, in its order", () => {
    expect(revenueCurrencies).toEqual([
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
    ])
  })
})
