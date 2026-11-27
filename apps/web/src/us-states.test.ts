// Limits: these tests cover the US state bars as pure functions. No test here draws the bars or
// can prove which state codes Google answers. Nick checks those at /app in a real browser.
import type { UsState } from '@creator-analytics/api-types'
import { describe, expect, test } from 'vitest'
import { usStateBarsOf } from './us-states.ts'

/** States with engaged views from `first` down by one, each code from the list given. */
function statesOf(codes: string[], first = 100): UsState[] {
  return codes.map((code, i) => ({ code, engagedViews: first - i, views: first - i + 1 }))
}

describe('the US state bars', () => {
  test('name each state by its English name, Washington, D.C. and the territories included', () => {
    const bars = usStateBarsOf(statesOf(['US-CA', 'US-DC', 'US-PR', 'US-GU']), 'en-US')

    expect(bars.map(({ name }) => name)).toEqual([
      'California',
      'Washington, D.C.',
      'Puerto Rico',
      'Guam',
    ])
  })

  test('name US-ZZ "Unknown state", in its place by its number', () => {
    const bars = usStateBarsOf(statesOf(['US-TX', 'US-ZZ', 'US-NY']), 'en-US')

    expect(bars.map(({ name }) => name)).toEqual(['Texas', 'Unknown state', 'New York'])
  })

  test('show a code no name is known for as the code', () => {
    const bars = usStateBarsOf(statesOf(['US-QQ']), 'en-US')

    expect(bars.map(({ name }) => name)).toEqual(['US-QQ'])
  })

  test('draw the first 10 states, then one "Other states" bar adding up the rest, each with its share', () => {
    const twelve = [
      'US-CA',
      'US-TX',
      'US-NY',
      'US-FL',
      'US-IL',
      'US-PA',
      'US-OH',
      'US-GA',
      'US-NC',
      'US-MI',
      'US-NJ',
      'US-VA',
    ]

    const bars = usStateBarsOf(statesOf(twelve), 'en-US')

    // Every state's engaged views add up to 100 + 99 + ... + 89 = 1134.
    expect(bars.map(({ key }) => key)).toEqual([...twelve.slice(0, 10), 'other'])
    expect(bars[0]).toMatchObject({ name: 'California', engagedViews: '100', share: '(9%)' })
    expect(bars.at(-1)).toMatchObject({ name: 'Other states', engagedViews: '179', share: '(16%)' })
  })
})
