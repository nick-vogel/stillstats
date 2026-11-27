// Limits: these tests cover the revenue arithmetic and the texts it feeds, as pure functions. No
// test here renders a card, the note under the cards or the line under the numbers table; Nick
// checks those at /app in a real browser.
import { otherSourcesOf } from '@creator-analytics/api-types'
import { describe, expect, test } from 'vitest'
import { axisMoneyTextOf, moneyTextOf, noFormatNoteOf, rpmLineOf, rpmOf } from './revenue.ts'

describe('RPM', () => {
  test('is the estimated revenue per 1,000 engaged views', () => {
    // $42.80 over 9,365 engaged views is $4.57 for each 1,000.
    expect(rpmOf(42.8, 9365)).toBeCloseTo(4.5702, 4)
  })

  test('is absent when there are no engaged views', () => {
    expect(rpmOf(12.5, 0)).toBeNull()
  })

  test('is zero for engaged views that earned nothing', () => {
    expect(rpmOf(0, 500)).toBe(0)
  })

  test('shows as the approved smaller line, in USD with two decimals', () => {
    expect(rpmLineOf(4.5702, 'USD', 'en-US')).toBe('RPM: $4.57')
  })

  test("shows in the answer's currency", () => {
    expect(rpmLineOf(4.5702, 'EUR', 'en-US')).toBe('RPM: €4.57')
  })
})

describe('other sources', () => {
  test('is the estimated revenue less its ad and YouTube Premium parts', () => {
    expect(
      otherSourcesOf({
        estimatedRevenue: 42.8,
        estimatedAdRevenue: 30.5,
        estimatedRedPartnerRevenue: 4.25,
      }),
    ).toBeCloseTo(8.05, 10)
  })

  test('is zero when ads and YouTube Premium make up all of it', () => {
    expect(
      otherSourcesOf({ estimatedRevenue: 5, estimatedAdRevenue: 4, estimatedRedPartnerRevenue: 1 }),
    ).toBe(0)
  })

  test('shows no minus sign when ads and YouTube Premium make up all of it in cents', () => {
    // 0.3 - 0.1 - 0.2 is a hair below zero in floating point.
    const otherSources = otherSourcesOf({
      estimatedRevenue: 0.3,
      estimatedAdRevenue: 0.1,
      estimatedRedPartnerRevenue: 0.2,
    })
    expect(moneyTextOf(otherSources, 'USD', 'en-US')).toBe('$0.00')
  })
})

describe('the note on the revenue tied to no format', () => {
  test('gives the amount in USD when it is above zero', () => {
    expect(noFormatNoteOf(5.4, 'USD', 'en-US')).toBe(
      "YouTube ties $5.40 of this channel's revenue to no video or format.",
    )
  })

  test('is absent when YouTube ties no revenue to no format', () => {
    expect(noFormatNoteOf(0, 'USD', 'en-US')).toBeNull()
  })

  test('is absent when the amount rounds to zero cents', () => {
    expect(noFormatNoteOf(0.004, 'USD', 'en-US')).toBeNull()
  })

  test("gives the amount in the answer's currency", () => {
    expect(noFormatNoteOf(5.4, 'GBP', 'en-US')).toBe(
      "YouTube ties £5.40 of this channel's revenue to no video or format.",
    )
  })

  test("is absent when the amount rounds to zero in the currency's own smallest unit", () => {
    // The yen shows no decimals, so 0.4 yen shows as ¥0.
    expect(noFormatNoteOf(0.4, 'JPY', 'en-US')).toBeNull()
  })

  test("is present when the amount shows in the currency's own smallest unit, below a cent", () => {
    // The Kuwaiti dinar shows three decimals, so 0.004 dinars is not none.
    expect(noFormatNoteOf(0.004, 'KWD', 'en-US')).toBe(
      "YouTube ties KWD\u00a00.004 of this channel's revenue to no video or format.",
    )
  })
})

describe('an amount of revenue', () => {
  test("is written in the answer's currency, the way the browser's locale writes it", () => {
    expect(moneyTextOf(4.57, 'EUR', 'de-DE')).toBe('4,57\u00a0€')
  })

  test('shows no decimals in a currency that has none', () => {
    expect(moneyTextOf(1234.5, 'JPY', 'en-US')).toBe('¥1,235')
  })

  test.for([
    ['USD', -0.001, '$0.00'],
    ['EUR', -0.004, '€0.00'],
    ['JPY', -0.2, '¥0'],
  ] as const)(
    'shows no minus sign in %s for an amount that rounds to zero',
    ([currency, amount, text]) => {
      expect(moneyTextOf(amount, currency, 'en-US')).toBe(text)
    },
  )
})

describe('an amount of revenue as a chart axis label', () => {
  test('is compact, and keeps its currency', () => {
    expect([
      axisMoneyTextOf(12_345, 'USD', 'en-US'),
      axisMoneyTextOf(1_234_567, 'EUR', 'fr-FR'),
    ]).toEqual(['$12K', '1,2\u00a0M\u00a0€'])
  })

  test('keeps a minus sign below zero', () => {
    expect(axisMoneyTextOf(-1.2, 'USD', 'en-US')).toBe('-$1.2')
  })

  test("shows nothing finer than the currency's own smallest unit, and no minus sign at zero", () => {
    // The yen shows no decimals, and -1e-15 is a floating point leftover.
    expect([axisMoneyTextOf(0.4, 'JPY', 'en-US'), axisMoneyTextOf(-1e-15, 'USD', 'en-US')]).toEqual(
      ['¥0', '$0'],
    )
  })
})
