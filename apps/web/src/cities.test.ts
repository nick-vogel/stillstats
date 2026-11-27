// Limits: these tests cover the city bars as pure functions. No test here draws the bars or can
// prove which city names Google answers. Nick checks those at /app in a real browser.
import type { City } from '@creator-analytics/api-types'
import { describe, expect, test } from 'vitest'
import { cityBarsOf } from './cities.ts'

/** Cities with engaged views from `first` down by one, each name from the list given. */
function citiesOf(names: string[], first = 100): City[] {
  return names.map((name, i) => ({ name, engagedViews: first - i, views: first - i + 1 }))
}

describe('the city bars', () => {
  test('draw each city by the name given, in the given order, the first 10, then one "Other cities" bar adding up the rest, each with its share', () => {
    const twelve = [
      'Mumbai',
      'Chicago',
      'London',
      'Toronto',
      'Berlin',
      'Sydney',
      'Austin',
      'Delhi',
      'Paris',
      'Lagos',
      'Seoul',
      'Lima',
    ]

    const bars = cityBarsOf(citiesOf(twelve), 'en-US')

    // Every city's engaged views add up to 100 + 99 + ... + 89 = 1134.
    expect(bars.map(({ name }) => name)).toEqual([...twelve.slice(0, 10), 'Other cities'])
    expect(bars[0]).toMatchObject({ engagedViews: '100', share: '(9%)' })
    expect(bars.at(-1)).toMatchObject({ engagedViews: '179', share: '(16%)' })
  })

  test('draw two cities of one name as two bars, each with its own key', () => {
    const bars = cityBarsOf(citiesOf(['Springfield', 'Springfield']), 'en-US')

    expect(bars.map(({ name }) => name)).toEqual(['Springfield', 'Springfield'])
    expect(new Set(bars.map(({ key }) => key)).size).toBe(2)
  })
})
