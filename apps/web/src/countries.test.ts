// Limits: these tests cover the country bars, as pure functions, with the names Node's own
// `Intl.DisplayNames` gives. A browser's names can differ by its ICU data, and no test here draws
// the bars or the rows beside them. Nick checks those at /app in a real browser.
import type { Country } from '@creator-analytics/api-types'
import { describe, expect, test } from 'vitest'
import { countryBarsOf } from './countries.ts'

/** Countries with engaged views from `first` down by one, each code from the list given. */
function countriesOf(codes: string[], first = 100): Country[] {
  return codes.map((code, i) => ({ code, engagedViews: first - i, views: first - i + 1 }))
}

const twelve = ['US', 'GB', 'DE', 'FR', 'IN', 'CA', 'AU', 'BR', 'JP', 'MX', 'ES', 'IT']

describe('the country bars', () => {
  test('draw the first 10 countries in the given order, then one "Other countries" bar adding up the rest', () => {
    const bars = countryBarsOf(countriesOf(twelve), 'en-US')

    expect(bars.map(({ key }) => key)).toEqual([...twelve.slice(0, 10), 'other'])
    expect(bars.at(-1)).toMatchObject({ name: 'Other countries', engagedViews: '179' })
  })

  test('at 11 countries, the "Other countries" bar holds the eleventh', () => {
    const bars = countryBarsOf(countriesOf(twelve.slice(0, 11)), 'en-US')

    expect(bars).toHaveLength(11)
    expect(bars.at(-1)).toMatchObject({ name: 'Other countries', engagedViews: '90' })
  })

  test('at exactly 10 countries, draw no "Other countries" bar', () => {
    const bars = countryBarsOf(countriesOf(twelve.slice(0, 10)), 'en-US')

    expect(bars.map(({ name }) => name)).not.toContain('Other countries')
    expect(bars).toHaveLength(10)
  })

  test('with no country, draw no bar', () => {
    expect(countryBarsOf([], 'en-US')).toEqual([])
  })

  test('name ZZ "Unknown country", in its place by its number', () => {
    const bars = countryBarsOf(
      [
        { code: 'US', engagedViews: 50, views: 60 },
        { code: 'ZZ', engagedViews: 20, views: 25 },
        { code: 'GB', engagedViews: 10, views: 12 },
      ],
      'en-US',
    )

    expect(bars.map(({ name }) => name)).toEqual([
      'United States',
      'Unknown country',
      'United Kingdom',
    ])
  })

  test("name each country in the given language, as the browser's language names it", () => {
    const [english] = countryBarsOf(countriesOf(['US']), 'en-US')
    const [german] = countryBarsOf(countriesOf(['US']), 'de')

    expect(english?.name).toBe('United States')
    expect(german?.name).toBe('Vereinigte Staaten')
  })

  test('show a code no name is known for, or a malformed one, as the code', () => {
    const bars = countryBarsOf(countriesOf(['QQ', 'U1']), 'en-US')

    expect(bars.map(({ name }) => name)).toEqual(['QQ', 'U1'])
  })

  test('carry the engaged views as text, and each share of the engaged views of every country Google answered, ZZ and the rest included', () => {
    const bars = countryBarsOf(
      [
        { code: 'US', engagedViews: 1234, views: 2000 },
        ...countriesOf(['GB', 'DE', 'FR', 'IN', 'CA', 'AU', 'BR', 'JP', 'ZZ', 'MX'], 80),
      ],
      'en-US',
    )

    // Every country's engaged views add up to 1234 + 80 + 79 + ... + 71 = 1989.
    expect(bars[0]).toMatchObject({ engagedViews: '1,234', share: '(62%)' })
    expect(bars[9]).toMatchObject({ name: 'Unknown country', share: '(4%)' })
    expect(bars.at(-1)).toMatchObject({
      name: 'Other countries',
      engagedViews: '71',
      share: '(4%)',
    })
  })

  test('give the longest bar shown the full width, and each other bar its share of it', () => {
    const bars = countryBarsOf(
      [
        { code: 'US', engagedViews: 400, views: 500 },
        { code: 'GB', engagedViews: 100, views: 300 },
      ],
      'en-US',
    )

    expect(bars.map(({ width }) => width)).toEqual([100, 25])
  })

  test('measure every bar against "Other countries" when the rest adds up to the longest', () => {
    const bars = countryBarsOf(countriesOf([...twelve, 'PT', 'NL'], 20), 'en-US')

    // The four after the first ten add up to 10 + 9 + 8 + 7 = 34.
    expect(bars.at(-1)).toMatchObject({ engagedViews: '34', width: 100 })
    expect(bars[0]?.width).toBe((20 / 34) * 100)
  })

  test('with no engaged view from any country, draw every bar empty and give no share', () => {
    const bars = countryBarsOf([{ code: 'US', engagedViews: 0, views: 3 }], 'en-US')

    expect(bars).toMatchObject([{ width: 0, share: '' }])
  })
})
