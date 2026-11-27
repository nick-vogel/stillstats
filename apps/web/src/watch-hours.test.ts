import { describe, expect, test } from 'vitest'
import { axisWatchHoursTextOf, watchHoursOf, watchHoursTextOf } from './watch-hours.ts'

describe("watch hours from YouTube's minutes", () => {
  test('are the minutes divided by 60', () => {
    expect([watchHoursOf(0), watchHoursOf(90), watchHoursOf(738)]).toEqual([0, 1.5, 12.3])
  })

  test('show with one decimal in the locale', () => {
    expect([
      watchHoursTextOf(738, 'en-US'),
      watchHoursTextOf(74_070, 'en-US'),
      watchHoursTextOf(74_070, 'de-DE'),
    ]).toEqual(['12.3', '1,234.5', '1.234,5'])
  })

  test('keep the decimal on a whole hour and on none', () => {
    expect([watchHoursTextOf(120, 'en-US'), watchHoursTextOf(0, 'en-US')]).toEqual(['2.0', '0.0'])
  })

  test('round to the nearest tenth of an hour', () => {
    // 100 minutes is 1.666... hours, and 2 minutes is 0.0333... hours.
    expect([watchHoursTextOf(100, 'en-US'), watchHoursTextOf(2, 'en-US')]).toEqual(['1.7', '0.0'])
  })
})

describe('watch hours as a chart axis label', () => {
  test('are compact, as the locale writes them', () => {
    // 74,070 minutes is 1,234.5 hours.
    expect([axisWatchHoursTextOf(74_070, 'en-US'), axisWatchHoursTextOf(74_070, 'fr-FR')]).toEqual([
      '1.2K',
      '1,2\u00a0k',
    ])
  })

  test('show no finer number than the tenth of an hour the cards and tables show', () => {
    // 738 minutes is 12.3 hours, and 2 minutes rounds to no tenth at all.
    expect([axisWatchHoursTextOf(738, 'en-US'), axisWatchHoursTextOf(2, 'en-US')]).toEqual([
      '12',
      '0',
    ])
  })
})
