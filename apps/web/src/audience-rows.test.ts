import { describe, expect, test } from 'vitest'
import type { AudienceView } from './audience.ts'
import {
  audienceRowsExpectedFor,
  audienceRowsOf,
  fullAudienceRows,
  rememberAudienceRowsOf,
} from './audience-rows.ts'

type SectionsView = Extract<AudienceView, { kind: 'sections' }>

/** A sections view with no rows in any section, which a test fills as it needs. */
const emptyView: SectionsView = {
  kind: 'sections',
  countries: [],
  usStates: [],
  cities: [],
  ageGroups: [],
  genders: [],
  devices: [],
  operatingSystems: [],
  subscriberSplit: null,
  format: 'all',
  bounds: { lastProcessedDay: '2026-11-01', creationDay: null },
}

/** `count` rows of engaged views, most first, each made by `rowOf` from its index. */
function rowsOf<Row>(count: number, rowOf: (index: number) => Row): Row[] {
  return Array.from({ length: count }, (_, index) => rowOf(index))
}

const numbers = (index: number) => ({ engagedViews: 100 - index, views: 200 - index })

test('the full sizes: 10 bars and the "Other" bar for the lists cut at 10, the seven age groups, the three genders and the eight device types', () => {
  expect(fullAudienceRows).toEqual({
    countries: 11,
    usStates: 11,
    cities: 11,
    ageGroups: 7,
    genders: 3,
    devices: 8,
    operatingSystems: 11,
  })
})

describe('the bars each section of an answer draws', () => {
  test('a list cut at 10 counts its "Other" bar, a shorter one its rows', () => {
    const view: SectionsView = {
      ...emptyView,
      countries: rowsOf(14, (i) => ({ code: `C${i}`, ...numbers(i) })),
      usStates: rowsOf(10, (i) => ({ code: `US-S${i}`, ...numbers(i) })),
      cities: rowsOf(1, (i) => ({ name: `City ${i}`, ...numbers(i) })),
    }
    expect(audienceRowsOf(view)).toMatchObject({ countries: 11, usStates: 10, cities: 1 })
  })

  test("Google's OTHER operating system adds into the rest bar, which counts as one more bar", () => {
    const view: SectionsView = {
      ...emptyView,
      operatingSystems: [
        { operatingSystem: 'WINDOWS', ...numbers(0) },
        { operatingSystem: 'OTHER', ...numbers(1) },
        { operatingSystem: 'IOS', ...numbers(2) },
      ],
    }
    expect(audienceRowsOf(view).operatingSystems).toBe(3)
  })

  test('the age groups, the genders and the devices count a bar for each row, and an empty section 0', () => {
    const view: SectionsView = {
      ...emptyView,
      ageGroups: [
        { ageGroup: 'age18-24', viewerPercentage: 60 },
        { ageGroup: 'age25-34', viewerPercentage: 40 },
      ],
      devices: [
        { deviceType: 'MOBILE', ...numbers(0) },
        { deviceType: 'DESKTOP', ...numbers(1) },
        { deviceType: 'TV', ...numbers(2) },
        { deviceType: 'TABLET', ...numbers(3) },
      ],
    }
    expect(audienceRowsOf(view)).toEqual({
      countries: 0,
      usStates: 0,
      cities: 0,
      ageGroups: 2,
      genders: 0,
      devices: 4,
      operatingSystems: 0,
    })
  })
})

// The memo lives as long as the test file, as it does the page, so each test names its own channel.
describe('the bars the Audience placeholder expects for a read (creator-analytics#510)', () => {
  const answered = { ...fullAudienceRows, countries: 3, genders: 0 }

  test('with nothing remembered, or no channel yet, the full sizes', () => {
    expect(audienceRowsExpectedFor('a-none', 'window=last28')).toEqual(fullAudienceRows)
    expect(audienceRowsExpectedFor(null, 'window=last28')).toEqual(fullAudienceRows)
  })

  test('after an answer, the same read expects the bars it answered', () => {
    rememberAudienceRowsOf('a-same', 'window=last28', answered)
    expect(audienceRowsExpectedFor('a-same', 'window=last28')).toEqual(answered)
  })

  test('another read of the same channel, the same read of another, or of no channel, still expects the full sizes', () => {
    rememberAudienceRowsOf('a-one', 'window=last28', answered)
    expect(audienceRowsExpectedFor('a-one', 'window=last90')).toEqual(fullAudienceRows)
    expect(audienceRowsExpectedFor('a-one', 'window=last28&format=short')).toEqual(fullAudienceRows)
    expect(audienceRowsExpectedFor('a-two', 'window=last28')).toEqual(fullAudienceRows)
    expect(audienceRowsExpectedFor(null, 'window=last28')).toEqual(fullAudienceRows)
  })

  test('a later answer for the same read replaces the earlier one', () => {
    rememberAudienceRowsOf('a-later', 'window=last28', answered)
    rememberAudienceRowsOf('a-later', 'window=last28', fullAudienceRows)
    expect(audienceRowsExpectedFor('a-later', 'window=last28')).toEqual(fullAudienceRows)
  })
})
