// Limits: these tests cover the traffic source bars and the impressions table's rows, as pure
// functions. No test here draws the SVG, so none shows the bars, the rows' text beside them, or the
// layout at 375 pixels wide. Nick checks those at /app in a real browser.
import { reachTrafficSourceTypes } from '@creator-analytics/api-types'
import { describe, expect, test } from 'vitest'
import {
  allTrafficSources,
  trafficSourceBarsOf,
  trafficSourceNameOf,
  trafficSourceOptions,
  trafficSourceReachRowsOf,
} from './traffic-sources.ts'

describe('the traffic source bars', () => {
  test('give the source with the most engaged views the full width, and the rest their share', () => {
    const bars = trafficSourceBarsOf([
      { type: 'YT_SEARCH', engagedViews: 400, views: 500 },
      { type: 'RELATED_VIDEO', engagedViews: 100, views: 300 },
    ])

    expect(bars.map(({ width }) => width)).toEqual([100, 25])
  })

  test('with no engaged view from any source, draw every bar empty', () => {
    const bars = trafficSourceBarsOf([{ type: 'YT_SEARCH', engagedViews: 0, views: 3 }])

    expect(bars.map(({ width }) => width)).toEqual([0])
  })

  test("name each source as YouTube Studio does, and a type Google adds later by Google's code", () => {
    const bars = trafficSourceBarsOf([
      { type: 'SUBSCRIBER', engagedViews: 2, views: 2 },
      { type: 'NO_LINK_OTHER', engagedViews: 1, views: 1 },
      { type: 'WATCH_WITH', engagedViews: 1, views: 1 },
      { type: 'NEW_SOURCE', engagedViews: 1, views: 1 },
    ])

    expect(bars.map(({ name }) => name)).toEqual([
      'Browse features',
      'Direct or unknown sources',
      'Watch With streams',
      'NEW_SOURCE',
    ])
  })

  test('carry the engaged views of each source as text, and not its views', () => {
    const [bar] = trafficSourceBarsOf(
      [{ type: 'YT_SEARCH', engagedViews: 1200, views: 34567 }],
      'en-US',
    )

    expect(bar?.engagedViews).toBe('1,200')
    expect(bar).not.toHaveProperty('views')
  })

  test("give each source its share of the engaged views of all the video's sources, not of the longest or of views", () => {
    const bars = trafficSourceBarsOf([
      { type: 'YT_SEARCH', engagedViews: 75, views: 1000 },
      { type: 'RELATED_VIDEO', engagedViews: 200, views: 10 },
      { type: 'EXT_URL', engagedViews: 13, views: 10 },
    ])

    expect(bars.map(({ share }) => share)).toEqual(['(26%)', '(69%)', '(5%)'])
  })
})

describe("a paid channel's impressions and CTR by traffic source (creator-analytics#785)", () => {
  const sources = [
    { type: 'YT_SEARCH', engagedViews: 50, views: 60, impressions: 3000, ctr: 0.021 },
    { type: 'REPORTING_18', engagedViews: 0, views: 0, impressions: 100, ctr: null },
  ]

  test("the table's rows carry each source's impressions and CTR as text, and name a type only the history has", () => {
    const rows = trafficSourceReachRowsOf(sources, 'en-US')

    expect(rows.map(({ name, impressions, ctr }) => ({ name, impressions, ctr }))).toEqual([
      { name: 'YouTube search', impressions: '3,000', ctr: '2.1%' },
      { name: 'Playlist pages', impressions: '100', ctr: '' },
    ])
  })

  test("the table's rows carry the newest average's impressions and CTR for each source it has, and none for a source it lacks", () => {
    const rows = trafficSourceReachRowsOf(sources, 'en-US', [
      { type: 'YT_SEARCH', impressions: 2499.5, ctr: 0.04 },
    ])

    expect(rows.map(({ average }) => average)).toEqual([
      { impressions: '2,500', ctr: '4.0%' },
      undefined,
    ])
  })

  test("the bars carry no impressions, CTR or average, which only the table's rows carry, even with the history", () => {
    const [bar] = trafficSourceBarsOf(sources, 'en-US')

    expect(bar).not.toHaveProperty('impressions')
    expect(bar).not.toHaveProperty('ctr')
    expect(bar).not.toHaveProperty('average')
  })
})

describe("the video list's traffic source filter (creator-analytics#944)", () => {
  test('offers All sources first', () => {
    expect(trafficSourceOptions[0]).toEqual({ value: allTrafficSources, label: 'All sources' })
  })

  test('names each source as the traffic sources view does', () => {
    const labelOf = (type: string) =>
      trafficSourceOptions.find(({ value }) => value === type)?.label

    expect(labelOf('YT_SEARCH')).toBe('YouTube search')
    expect(labelOf('SUBSCRIBER')).toBe('Browse features')
    expect(labelOf('REPORTING_18')).toBe('Playlist pages')
    for (const type of reachTrafficSourceTypes) {
      const [bar] = trafficSourceBarsOf([{ type, engagedViews: 1, views: 1 }])
      expect(labelOf(type)).toBe(bar?.name)
      expect(trafficSourceNameOf(type)).toBe(bar?.name)
    }
  })

  test('offers every source the list filters by once, after All sources, by name', () => {
    const sources = trafficSourceOptions.slice(1)

    expect(sources.map(({ value }) => value).toSorted()).toEqual(
      [...reachTrafficSourceTypes].toSorted(),
    )
    expect(sources.map(({ label }) => label)).toEqual(
      sources.map(({ label }) => label).toSorted((a, b) => a.localeCompare(b, 'en')),
    )
    expect(sources.slice(0, 3).map(({ label }) => label)).toEqual([
      'Browse features',
      'Campaign cards',
      'Channel pages',
    ])
  })

  test("names a type Google adds later by Google's code", () => {
    expect(trafficSourceNameOf('NEW_SOURCE')).toBe('NEW_SOURCE')
  })
})
