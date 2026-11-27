// Limits: these tests cover the cards' text, as pure functions. No test here renders the cards, so
// none shows the boxes, the smaller views line under the number, how the row wraps at 375 pixels
// wide, or that a long amount shrinks to fit its card and wraps only after the currency. Nick checks
// those at /app in a real browser.
import { describe, expect, test } from 'vitest'
import {
  ctrCardOf,
  engagedViewsCardOf,
  ratioLineOf,
  revenueCardOf,
  revenueReportedIn,
  viewsLineOf,
  watchHoursCardOf,
} from './cards.ts'

describe('the engaged views card', () => {
  test('shows engaged views, with the views as a smaller line under them', () => {
    expect(engagedViewsCardOf({ engagedViews: 1200, views: 1234 }, 'en-US')).toEqual({
      label: 'Engaged views',
      text: '1,200',
      detail: '1,234 views',
      ratio: { text: 'Views are 1.0× engaged views', spoken: 'Views are 1.0 times engaged views' },
      chart: 'engagedViews',
    })
  })

  test('says how many times engaged views the views are, as a second smaller line', () => {
    expect(engagedViewsCardOf({ engagedViews: 1200, views: 1920 }, 'en-US').ratio).toEqual({
      text: 'Views are 1.6× engaged views',
      spoken: 'Views are 1.6 times engaged views',
    })
  })

  test('writes the multiple with one decimal place, a whole one too, rounded', () => {
    expect([
      ratioLineOf(2400, 1200, 'en-US')?.text,
      ratioLineOf(1500, 1200, 'en-US')?.text,
      ratioLineOf(34_000, 1200, 'en-US')?.text,
    ]).toEqual([
      'Views are 2.0× engaged views',
      'Views are 1.3× engaged views',
      'Views are 28.3× engaged views',
    ])
  })

  test("writes the multiple in the locale's digits", () => {
    expect(ratioLineOf(1920, 1200, 'de-DE')).toEqual({
      text: 'Views are 1,6× engaged views',
      spoken: 'Views are 1,6 times engaged views',
    })
    expect(ratioLineOf(1920, 1200, 'ar-EG')?.text).toBe(
      'Views are \u0661\u066b\u0666× engaged views',
    )
  })

  test('shows no ratio line at zero engaged views', () => {
    expect(ratioLineOf(34, 0, 'en-US')).toBeNull()
    expect(engagedViewsCardOf({ engagedViews: 0, views: 34 }, 'en-US')).toHaveProperty(
      'ratio',
      null,
    )
  })

  test('counts the views in the locale', () => {
    expect(viewsLineOf(1234, 'de-DE')).toBe('1.234 views')
  })

  test('says one view, and no views as 0 views', () => {
    expect([viewsLineOf(1, 'en-US'), viewsLineOf(0, 'en-US')]).toEqual(['1 view', '0 views'])
  })
})

describe('the watch hours card', () => {
  test('shows the minutes as hours with one decimal, and no smaller line', () => {
    expect(watchHoursCardOf(738, 'en-US')).toEqual({
      label: 'Watch hours',
      text: '12.3',
      chart: 'watchTime',
    })
  })
})

const revenue = {
  estimatedRevenue: 42.8,
  estimatedAdRevenue: 30.5,
  estimatedRedPartnerRevenue: 4.25,
  noFormatRevenue: 5.4,
  currency: 'USD',
} as const

describe('the estimated revenue card', () => {
  test.each(['consent_missing', 'not_monetized'] as const)(
    'chooses the revenue chart when revenue answered, and no chart with the refusal %s',
    (refusal) => {
      expect(revenueCardOf(revenue, 9365, true, 'en-US').chart).toBe('revenue')
      expect(revenueCardOf({ refusal }, 9365, false, 'en-US')).not.toHaveProperty('chart')
    },
  )

  test('shows the revenue in USD, with RPM as the smaller line', () => {
    expect(revenueCardOf(revenue, 9365, true, 'en-US')).toEqual({
      label: 'Estimated revenue',
      text: '$42.80',
      detail: 'RPM: $4.57',
      chart: 'revenue',
      detailChart: 'rpm',
    })
  })

  test("shows the revenue and its RPM in the answer's currency, as the locale writes it", () => {
    expect(revenueCardOf({ ...revenue, currency: 'EUR' }, 9365, true, 'de-DE')).toEqual({
      label: 'Estimated revenue',
      text: '42,80 €',
      detail: 'RPM: 4,57\u00a0€',
      chart: 'revenue',
      detailChart: 'rpm',
    })
  })

  // creator-analytics#356: on a screen too small to stack the charts, the RPM line chooses the RPM
  // chart, which ends on the same number in running total mode.
  test('its RPM line chooses the RPM chart', () => {
    expect(revenueCardOf(revenue, 9365, true, 'en-US').detailChart).toBe('rpm')
  })

  test.each([
    ['there are no engaged views', revenueCardOf(revenue, 0, true, 'en-US')],
    ['revenue consent is missing', revenueCardOf({ refusal: 'consent_missing' }, 9365, false)],
    ['the channel is not monetized', revenueCardOf({ refusal: 'not_monetized' }, 9365, false)],
    ['YouTube reports no revenue', revenueCardOf({ ...revenue, estimatedRevenue: 0 }, 9365, false)],
  ])('has no line that chooses the RPM chart when %s', (_, card) => {
    expect(card).not.toHaveProperty('detailChart')
  })

  // creator-analytics#357: $30.50 from ads and $4.25 from YouTube Premium, $34.75 over 9,365
  // engaged views, against $42.80 in all.
  test('with the RPM switch on, its RPM line counts only ads and YouTube Premium', () => {
    const on = revenueCardOf(revenue, 9365, true, 'en-US', { adsAndPremiumOnly: true })
    const off = revenueCardOf(revenue, 9365, true, 'en-US', { adsAndPremiumOnly: false })

    expect(on).toEqual({
      label: 'Estimated revenue',
      text: '$42.80',
      detail: 'RPM: $3.71',
      chart: 'revenue',
      detailChart: 'rpm',
    })
    expect(off.detail).toBe('RPM: $4.57')
  })

  test('with the RPM switch on and no ads or YouTube Premium revenue, its RPM line reads $0.00', () => {
    const otherSourcesOnly = { ...revenue, estimatedAdRevenue: 0, estimatedRedPartnerRevenue: 0 }

    expect(
      revenueCardOf(otherSourcesOnly, 9365, true, 'en-US', { adsAndPremiumOnly: true }),
    ).toMatchObject({ detail: 'RPM: $0.00', detailChart: 'rpm' })
  })

  test('with the RPM switch on, shows no RPM line when there are no engaged views', () => {
    expect(revenueCardOf(revenue, 0, true, 'en-US', { adsAndPremiumOnly: true })).toEqual({
      label: 'Estimated revenue',
      text: '$42.80',
      chart: 'revenue',
    })
  })

  test('shows no RPM line when there are no engaged views', () => {
    expect(revenueCardOf(revenue, 0, true, 'en-US')).toEqual({
      label: 'Estimated revenue',
      text: '$42.80',
      chart: 'revenue',
    })
  })

  test('without revenue consent, says so with a button that gives it', () => {
    expect(revenueCardOf({ refusal: 'consent_missing' }, 9365, false, 'en-US')).toEqual({
      label: 'Estimated revenue',
      text: 'Revenue needs your consent.',
      message: true,
      consentButton: 'Give revenue consent',
    })
  })

  test('when YouTube reports no revenue over the date range, says so in place of $0.00', () => {
    const noRevenue = { ...revenue, estimatedRevenue: 0, estimatedAdRevenue: 0 }

    expect(revenueCardOf(noRevenue, 9365, false, 'en-US')).toEqual({
      label: 'Estimated revenue',
      text: 'YouTube reports no revenue for this date range. That can happen when no revenue was earned during the date range, or when the channel is not in the YouTube Partner Program.',
      message: true,
    })
  })

  test('a long amount may break after the currency code, never inside the amount', () => {
    const text = revenueCardOf(
      { ...revenue, estimatedRevenue: 62_193_167.99, currency: 'UZS' },
      9365,
      true,
      'en-US',
    ).text

    expect(text).toBe('UZS 62,193,167.99')
    expect(text.indexOf(' ')).toBe(3)
  })

  test('the amount keeps the no-break space the locale groups its digits with', () => {
    expect(
      revenueCardOf({ ...revenue, estimatedRevenue: 1234.5, currency: 'EUR' }, 0, true, 'fr-FR')
        .text,
    ).toBe('1\u202f234,50 €')
  })

  test('for a channel outside the YouTube Partner Program, says YouTube reports no revenue for it', () => {
    expect(revenueCardOf({ refusal: 'not_monetized' }, 9365, false, 'en-US')).toEqual({
      label: 'Estimated revenue',
      text: 'This channel is not in the YouTube Partner Program, so YouTube reports no revenue for it.',
      message: true,
    })
  })
})

describe('whether YouTube reported revenue over the days', () => {
  test('an empty day list reports no revenue', () => {
    expect(revenueReportedIn([])).toBe(false)
  })
})

describe('the CTR card', () => {
  test('with no impressions over the range, says so in place of a rate', () => {
    const history = { impressions: 0, ctr: null, firstDay: '2026-10-01', newestDay: '2026-10-04' }

    expect(ctrCardOf(history, null, 'en-US')).toEqual({
      label: 'Impressions click-through rate',
      text: 'No impressions in this range',
      message: true,
    })
  })

  test('with no impressions over a range that starts before the history, keeps the partial label the impressions card carries', () => {
    const history = { impressions: 0, ctr: null, firstDay: '2026-10-03', newestDay: '2026-10-04' }

    expect(ctrCardOf(history, '2 of 4 days', 'en-US')).toMatchObject({
      text: 'No impressions in this range',
      detail: '2 of 4 days',
    })
  })
})
