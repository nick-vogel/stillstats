import { maxComparedCurves, type UpgradeComparison } from '@creator-analytics/api-types'
import { describe, expect, test } from 'vitest'
import {
  comparisonLineOf,
  moneyOf,
  pricingOf,
  readyLineOf,
  startLinesOf,
  upgradeFeatures,
  upgradeViewedEvent,
} from './upgrade.ts'

describe("the upgrade screen's comparison lines", () => {
  test('a comparison of 2 or more uploads names its count and no date', () => {
    const line = comparisonLineOf({ window: 'first7', count: 4, availableOn: null }, 'en-US')

    expect(line).toBe('First 7 days: 4 of your uploads would count if you subscribed today.')
  })

  test('a comparison of fewer than 2 names the day it starts', () => {
    const line = comparisonLineOf(
      { window: 'first28', count: 1, availableOn: '2026-10-16' },
      'en-US',
    )

    expect(line).toBe(
      'First 28 days: 1 of your uploads would count if you subscribed today. It needs 2, so it starts on October 16, 2026.',
    )
  })

  test('a comparison of none with no date says it starts once 2 public uploads have had its days', () => {
    const line = comparisonLineOf({ window: 'first28', count: 0, availableOn: null }, 'en-US')

    expect(line).toBe(
      'First 28 days: 0 of your uploads would count if you subscribed today. It needs 2, so it starts once 2 of your public uploads have had those days.',
    )
  })
})

// creator-analytics#952: Pro draws up to `maxComparedCurves` of a channel's stored audience
// retention curves on one chart (#951). The card's words rest on Nick's approval on the epic's PR.
describe("the upgrade screen's retention comparison card", () => {
  function retentionCard() {
    const card = upgradeFeatures.find((feature) => feature.key === 'retention')
    if (!card) throw new Error('No retention comparison card')
    return card
  }

  test('names the limit on compared videos the comparison enforces', () => {
    const limits = retentionCard().lines.flatMap((line) =>
      [...line.matchAll(/\bup to (\d+)\b[^.,]*?\bvideos\b/g)].map(([, count]) => Number(count)),
    )

    expect(limits).toEqual([maxComparedCurves])
  })

  test('holds no em-dash', () => {
    const { title, lines } = retentionCard()
    const texts = [title, ...lines]

    expect(texts.filter((text) => text.includes('\u2014'))).toEqual([])
  })
})

describe('the OpenPanel event of the upgrade screen', () => {
  test('carries its name and no property, so no channel number', () => {
    expect(upgradeViewedEvent).toEqual({ name: 'upgrade_screen_viewed' })
  })
})

// creator-analytics#913: the pricing cards' amounts, formatted in the price's own currency.
describe("the upgrade screen's prices", () => {
  test('a whole amount shows no decimals, and any other shows two', () => {
    expect([moneyOf(700, 'usd', 'en-US'), moneyOf(7000, 'usd', 'en-US')]).toEqual(['$7', '$70'])
    expect([moneyOf(583, 'usd', 'en-US'), moneyOf(495, 'usd', 'en-US')]).toEqual(['$5.83', '$4.95'])
  })

  test("an amount is in its price's currency, by the currency's own smallest unit", () => {
    expect(moneyOf(650, 'eur', 'en-US')).toBe('€6.50')
    expect(moneyOf(1000, 'jpy', 'en-US')).toBe('¥1,000')
  })

  test('$7 and $70 show the yearly saving of $14 and $5.83 a month, annual / 12 rounded to the cent', () => {
    const pricing = pricingOf(
      { monthly: { amount: 700, currency: 'usd' }, annual: { amount: 7000, currency: 'usd' } },
      'en-US',
    )

    expect(pricing).toEqual({
      monthly: '$7',
      annual: '$70',
      saving: '$14',
      annualPerMonth: '$5.83',
    })
  })

  test('an annual price no cheaper than 12 months shows no saving', () => {
    const even = pricingOf(
      { monthly: { amount: 500, currency: 'usd' }, annual: { amount: 6000, currency: 'usd' } },
      'en-US',
    )
    const dearer = pricingOf(
      { monthly: { amount: 500, currency: 'usd' }, annual: { amount: 6500, currency: 'usd' } },
      'en-US',
    )

    expect([even.saving, dearer.saving]).toEqual([null, null])
    expect(even.annualPerMonth).toBe('$5')
  })

  test('two prices in different currencies show their amounts and no saving', () => {
    const pricing = pricingOf(
      { monthly: { amount: 700, currency: 'usd' }, annual: { amount: 5000, currency: 'eur' } },
      'en-US',
    )

    expect(pricing).toEqual({
      monthly: '$7',
      annual: '€50',
      saving: null,
      annualPerMonth: '€4.17',
    })
  })

  test('no prices show no amount, no saving and no monthly share', () => {
    expect(pricingOf(null, 'en-US')).toEqual({
      monthly: null,
      annual: null,
      saving: null,
      annualPerMonth: null,
    })
  })
})

describe("the Upload comparisons card's count", () => {
  const comparison = (
    window: UpgradeComparison['window'],
    count: number,
    availableOn: string | null = null,
  ): UpgradeComparison => ({ window, count, availableOn })

  test('the ready line counts the larger of the two comparisons', () => {
    expect(readyLineOf([comparison('first7', 7), comparison('first28', 4)])).toBe(
      'Ready today: 7 of your uploads are ready for review.',
    )
    expect(readyLineOf([comparison('first7', 2), comparison('first28', 3)])).toBe(
      'Ready today: 3 of your uploads are ready for review.',
    )
  })

  test('the ready line shows from 2, and not under it', () => {
    expect(readyLineOf([comparison('first7', 2), comparison('first28', 1, '2026-10-16')])).toBe(
      'Ready today: 2 of your uploads are ready for review.',
    )
    expect(readyLineOf([comparison('first7', 1), comparison('first28', 0)])).toBeNull()
    expect(readyLineOf([])).toBeNull()
  })

  test("each comparison under 2 keeps today's start date line, and one of 2 or more has none", () => {
    const lines = startLinesOf(
      [comparison('first7', 2), comparison('first28', 1, '2026-10-16')],
      'en-US',
    )

    expect(lines).toEqual([
      'First 28 days: 1 of your uploads would count if you subscribed today. It needs 2, so it starts on October 16, 2026.',
    ])
    expect(startLinesOf([comparison('first7', 3), comparison('first28', 2)], 'en-US')).toEqual([])
  })
})

// creator-analytics#945: the repackaging view's card, a draft for Nick's word for word approval on
// the epic's PR.
describe("the upgrade screen's feature cards", () => {
  test('the repackaging view has its own card, after Upload comparisons and before Your history', () => {
    expect(upgradeFeatures.map((feature) => feature.key)).toEqual([
      'reach',
      'comparisons',
      'repackaging',
      'retention',
      'history',
      'next',
    ])
    expect(upgradeFeatures.find((feature) => feature.key === 'repackaging')).toEqual({
      key: 'repackaging',
      title: 'Repackaging view',
      lines: [
        'Sort your video list by click-through rate or impressions, for all traffic sources or just one, and hide videos under a minimum number of impressions.',
      ],
    })
  })

  test('no feature card holds an em-dash', () => {
    const strings = upgradeFeatures.flatMap((feature) => [feature.title, ...feature.lines])

    expect(strings.filter((text) => text.includes('\u2014'))).toEqual([])
  })
})
