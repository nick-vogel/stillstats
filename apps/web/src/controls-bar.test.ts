import type { RangeBounds } from '@creator-analytics/api-types'
import { describe, expect, test } from 'vitest'
import {
  appliedOf,
  barChangeOf,
  barShowsFormat,
  barWindowOptionsOf,
  customApplyOf,
  dayPickedOf,
  dayTypedOf,
  dismissedOf,
  draftOnViewOf,
  formatFilterOptions,
  rangeFieldsOf,
  untouchedRangeDraft,
  windowPickedOf,
} from './controls-bar.ts'
import { customRangeErrorOf, customRangeText, prefillOf } from './custom-range.ts'
import { defaultRoute, type Route, searchOf } from './route.ts'

const channelScreen: Route = { ...defaultRoute, page: 3, window: 'last28', format: 'short' }
const detailScreen: Route = { ...channelScreen, video: 'vid-1' }
const audienceScreen: Route = { ...channelScreen, audience: true }

describe('the date range in the bar', () => {
  test('on the Audience screen, offers the calendar windows and a custom range, and neither lifetime nor a window after publish', () => {
    expect(barWindowOptionsOf(audienceScreen).map(({ value }) => value)).toEqual([
      'last7',
      'last28',
      'last90',
      'last365',
      'custom',
    ])
  })

  test.each([
    ['the channel screen', channelScreen],
    ["a video's detail screen", detailScreen],
  ])('on %s, offers the windows after publish too', (_screen, route) => {
    expect(barWindowOptionsOf(route).map(({ value }) => value)).toContain('first7')
  })
})

describe('the format in the bar', () => {
  test('offers every format, then each one', () => {
    expect(formatFilterOptions.map(({ value }) => value)).toEqual(['all', 'video', 'short', 'live'])
  })

  test('shows on the channel screen', () => {
    expect(barShowsFormat(channelScreen)).toBe(true)
  })

  test("is left out on a video's detail screen", () => {
    expect(barShowsFormat(detailScreen)).toBe(false)
  })

  test('shows on the Audience screen', () => {
    expect(barShowsFormat(audienceScreen)).toBe(true)
  })
})

describe('a change made in the bar', () => {
  test('a date range change on the channel screen goes to the first page and sends video_window_changed', () => {
    expect(barChangeOf(channelScreen, { window: 'last7' })).toEqual({
      route: { ...channelScreen, window: 'last7', page: 1 },
      event: { name: 'video_window_changed', window: 'last7' },
    })
  })

  test("a date range change on a video's detail screen keeps the page and sends video_window_changed", () => {
    expect(barChangeOf(detailScreen, { window: 'last7' })).toEqual({
      route: { ...detailScreen, window: 'last7' },
      event: { name: 'video_window_changed', window: 'last7' },
    })
  })

  test.each([
    ['date range', { window: 'last7' }, { listWindow: { window: 'last28' } }],
    ['format', { format: 'video' }, {}],
  ] as const)(
    "a %s change on the Audience screen stays on it, goes to the first page, keeps the list's window and sends no event",
    (_control, control, kept) => {
      expect(barChangeOf(audienceScreen, control)).toEqual({
        route: { ...audienceScreen, ...control, page: 1, ...kept },
        event: null,
      })
    },
  )
})

describe('Apply on a custom range', () => {
  const bounds: RangeBounds = { creationDay: '2019-03-12', lastProcessedDay: '2026-10-07' }

  test.each([
    ['', '2026-10-01', 'Pick a start day and an end day.'],
    ['2026-10-02', '2026-10-01', 'The end day is before the start day.'],
    [
      '2019-03-11',
      '2026-10-01',
      'The channel starts on 12 March 2019. Pick that day or a later one.',
    ],
    [
      '2026-10-01',
      '2026-10-08',
      'YouTube has processed data up to 7 October 2026. Pick that day or an earlier one.',
    ],
  ])('from %j to %j answers its error and no route, so nothing is read', (from, to, error) => {
    expect(customApplyOf(channelScreen, from, to, bounds, 'en-GB')).toEqual({ error })
  })

  test('a valid range moves the list to it on the first page, and sends its length in days', () => {
    const applied = customApplyOf(channelScreen, '2026-09-01', '2026-10-01', bounds, 'en-GB')
    expect(applied).toEqual({
      route: {
        ...channelScreen,
        window: 'custom',
        range: { from: '2026-09-01', to: '2026-10-01' },
        page: 1,
      },
      event: { name: 'video_window_changed', window: 'custom', days: 31 },
    })
    expect(applied && 'route' in applied && searchOf(applied.route)).toBe(
      '?window=custom&from=2026-09-01&to=2026-10-01&format=short',
    )
  })

  test("a valid range on a video's detail screen keeps the page", () => {
    expect(customApplyOf(detailScreen, '2026-09-01', '2026-10-01', bounds, 'en-GB')).toEqual({
      route: {
        ...detailScreen,
        window: 'custom',
        range: { from: '2026-09-01', to: '2026-10-01' },
      },
      event: { name: 'video_window_changed', window: 'custom', days: 31 },
    })
  })

  test('the range already on view answers no change', () => {
    const onView: Route = {
      ...channelScreen,
      window: 'custom',
      range: { from: '2026-09-01', to: '2026-10-01' },
    }
    expect(customApplyOf(onView, '2026-09-01', '2026-10-01', bounds, 'en-GB')).toBeNull()
  })
})

describe('the custom range fields in the bar', () => {
  const bounds: RangeBounds = { creationDay: '2019-03-12', lastProcessedDay: '2026-10-07' }
  const rangeA = { from: '2026-09-01', to: '2026-09-30' }
  const rangeB = { from: '2026-08-01', to: '2026-08-31' }
  const onA: Route = { ...channelScreen, window: 'custom', range: rangeA }
  const onB: Route = { ...channelScreen, window: 'custom', range: rangeB }

  test('an error Apply answered is gone once Back moves to another custom range', () => {
    const typed = dayTypedOf(untouchedRangeDraft, onA, bounds, { to: '2026-10-09' })
    const { draft, move } = appliedOf(typed, onA, bounds, 'en-GB')
    expect(move).toBeNull()
    expect(rangeFieldsOf(draft, onA, bounds).error).toBe(
      'YouTube has processed data up to 7 October 2026. Pick that day or an earlier one.',
    )

    expect(rangeFieldsOf(draft, onB, bounds)).toEqual({
      window: 'custom',
      open: false,
      fields: null,
      applied: rangeB,
      error: null,
    })
  })

  test('a draft and its error left on one range are dropped on another, so Forward back shows neither', () => {
    const typed = dayTypedOf(untouchedRangeDraft, onA, bounds, { to: '2026-10-09' })
    const { draft } = appliedOf(typed, onA, bounds, 'en-GB')
    const keptOnB = draftOnViewOf(draft, onB)

    expect(rangeFieldsOf(keptOnB, onA, bounds)).toEqual({
      window: 'custom',
      open: false,
      fields: null,
      applied: rangeA,
      error: null,
    })
  })

  test('picking the window on view while the fields are open closes them, and moves and sends nothing', () => {
    const opened = windowPickedOf(channelScreen, 'custom', bounds)
    expect(rangeFieldsOf(opened.draft, channelScreen, bounds).window).toBe('custom')

    const { draft, move } = windowPickedOf(channelScreen, 'last28', bounds)
    expect(move).toBeNull()
    expect(rangeFieldsOf(draft, channelScreen, bounds)).toEqual({
      window: 'last28',
      open: false,
      fields: null,
      applied: null,
      error: null,
    })
  })

  test("the fields opened before the bounds land show the window's days once they land", () => {
    const opened = windowPickedOf(channelScreen, 'custom', null)
    expect(rangeFieldsOf(opened.draft, channelScreen, bounds).fields).toEqual(
      prefillOf(channelScreen, bounds),
    )
    expect(rangeFieldsOf(opened.draft, channelScreen, bounds).fields).toEqual({
      from: '2026-09-10',
      to: '2026-10-07',
    })
  })

  test('a To past the last processed day typed into fields opened before the bounds landed names the last processed day', () => {
    const opened = windowPickedOf(channelScreen, 'custom', null)
    const typed = dayTypedOf(opened.draft, channelScreen, bounds, { to: '2026-10-09' })
    const { draft, move } = appliedOf(typed, channelScreen, bounds, 'en-GB')
    expect(move).toBeNull()
    expect(draft.error?.text).toBe(
      customRangeErrorOf(prefillOf(channelScreen, bounds).from, '2026-10-09', bounds, 'en-GB'),
    )
    expect(draft.error?.text).toBe(
      'YouTube has processed data up to 7 October 2026. Pick that day or an earlier one.',
    )
  })

  test("a From typed before the bounds land stays, and the To fills with the window's day once they land", () => {
    const opened = windowPickedOf(channelScreen, 'custom', null)
    const typed = dayTypedOf(opened.draft, channelScreen, null, { from: '2026-08-15' })
    expect(rangeFieldsOf(typed, channelScreen, bounds).fields).toEqual({
      from: '2026-08-15',
      to: '2026-10-07',
    })
  })

  test('a From the creator cleared stays cleared once the bounds land, and Apply asks for both days', () => {
    const opened = windowPickedOf(channelScreen, 'custom', null)
    const typed = dayTypedOf(opened.draft, channelScreen, null, { from: '2026-08-15' })
    const cleared = dayTypedOf(typed, channelScreen, null, { from: '' })

    expect(rangeFieldsOf(cleared, channelScreen, bounds).fields).toEqual({
      from: '',
      to: '2026-10-07',
    })
    expect(appliedOf(cleared, channelScreen, bounds, 'en-GB')).toEqual({
      draft: {
        ...cleared,
        error: { text: customRangeText.emptyField, onView: expect.any(String) },
      },
      move: null,
    })
  })

  test('a channel switch drops the days typed and the error Apply answered on the other channel', () => {
    const channelA: Route = { ...defaultRoute, channel: 'c-1' }
    const channelB: Route = { ...defaultRoute, channel: 'c-2' }
    const boundsA: RangeBounds = { creationDay: '2019-02-28', lastProcessedDay: '2026-10-04' }
    const boundsB: RangeBounds = { creationDay: '2018-01-01', lastProcessedDay: '2026-10-04' }
    const opened = windowPickedOf(channelA, 'custom', boundsA)
    const typed = dayTypedOf(opened.draft, channelA, boundsA, { from: '2019-01-01' })
    const { draft } = appliedOf(typed, channelA, boundsA, 'en-GB')
    expect(rangeFieldsOf(draft, channelA, boundsA).error).not.toBeNull()

    expect(rangeFieldsOf(draft, channelB, boundsB)).toEqual({
      window: 'last28',
      open: false,
      fields: null,
      applied: null,
      error: null,
    })
  })

  test('picking another window while the fields are open moves to it', () => {
    expect(windowPickedOf(channelScreen, 'last7', bounds).move).toEqual({
      route: { ...channelScreen, window: 'last7', page: 1 },
      event: { name: 'video_window_changed', window: 'last7' },
    })
  })
})

describe('the custom range Popover in the bar', () => {
  const bounds: RangeBounds = { creationDay: '2019-03-12', lastProcessedDay: '2026-10-07' }
  const applied = { from: '2026-09-01', to: '2026-09-30' }
  const onCustom: Route = { ...channelScreen, window: 'custom', range: applied }

  test('picking "Custom range" opens it on the days on screen, with no compact button off a custom range', () => {
    const { draft, move } = windowPickedOf(channelScreen, 'custom', bounds)
    expect(move).toBeNull()
    expect(rangeFieldsOf(draft, channelScreen, bounds)).toEqual({
      window: 'custom',
      open: true,
      fields: { from: '2026-09-10', to: '2026-10-07' },
      applied: null,
      error: null,
    })
  })

  test('closed without Apply on a calendar window, the select shows the window the route holds', () => {
    const opened = windowPickedOf(channelScreen, 'custom', bounds)
    const typed = dayTypedOf(opened.draft, channelScreen, bounds, { from: '2026-08-15' })
    const draft = dismissedOf(typed, channelScreen)
    expect(rangeFieldsOf(draft, channelScreen, bounds)).toEqual({
      window: 'last28',
      open: false,
      fields: null,
      applied: null,
      error: null,
    })
  })

  test('closed without Apply on a custom range, the select stays on "Custom range" beside the compact button', () => {
    const opened = windowPickedOf(onCustom, 'custom', bounds)
    const draft = dismissedOf(opened.draft, onCustom)
    expect(rangeFieldsOf(draft, onCustom, bounds)).toEqual({
      window: 'custom',
      open: false,
      fields: null,
      applied,
      error: null,
    })
  })

  test('the compact button reopens it on the applied range', () => {
    const { draft } = windowPickedOf(onCustom, 'custom', bounds)
    expect(rangeFieldsOf(draft, onCustom, bounds)).toEqual({
      window: 'custom',
      open: true,
      fields: applied,
      applied,
      error: null,
    })
  })

  test('days typed and an error Apply answered, then closed, reopen on the applied range with no error', () => {
    const opened = windowPickedOf(onCustom, 'custom', bounds)
    const typed = dayTypedOf(opened.draft, onCustom, bounds, { to: '2026-10-09' })
    const erred = appliedOf(typed, onCustom, bounds, 'en-GB')
    expect(rangeFieldsOf(erred.draft, onCustom, bounds)).toMatchObject({
      open: true,
      error: 'YouTube has processed data up to 7 October 2026. Pick that day or an earlier one.',
    })

    const closed = dismissedOf(erred.draft, onCustom)
    const reopened = windowPickedOf(onCustom, 'custom', bounds)
    expect(rangeFieldsOf(closed, onCustom, bounds).error).toBeNull()
    expect(rangeFieldsOf(reopened.draft, onCustom, bounds)).toMatchObject({
      open: true,
      fields: applied,
      error: null,
    })
  })

  test('Apply on a valid range closes it and moves to the range', () => {
    const opened = windowPickedOf(channelScreen, 'custom', bounds)
    const { draft, move } = appliedOf(opened.draft, channelScreen, bounds, 'en-GB')
    expect(move?.route).toMatchObject({
      window: 'custom',
      range: { from: '2026-09-10', to: '2026-10-07' },
    })
    expect(move?.route && rangeFieldsOf(draft, move.route, bounds)).toEqual({
      window: 'custom',
      open: false,
      fields: null,
      applied: { from: '2026-09-10', to: '2026-10-07' },
      error: null,
    })
  })
})

describe('a day picked on the custom range Calendar', () => {
  const bounds: RangeBounds = { creationDay: '2019-03-12', lastProcessedDay: '2026-10-07' }

  test('one day picked, then Apply, asks for both days and keeps the Popover open', () => {
    const opened = windowPickedOf(channelScreen, 'custom', bounds)
    const picked = dayPickedOf(opened.draft, channelScreen, bounds, '2026-09-20')
    const { draft, move } = appliedOf(picked, channelScreen, bounds, 'en-GB')

    expect(move).toBeNull()
    expect(rangeFieldsOf(draft, channelScreen, bounds)).toEqual({
      window: 'custom',
      open: true,
      fields: { from: '2026-09-20', to: '' },
      applied: null,
      error: 'Pick a start day and an end day.',
    })
  })

  test('a day picked before the bounds land stays picked once they land', () => {
    const opened = windowPickedOf(channelScreen, 'custom', null)
    const picked = dayPickedOf(opened.draft, channelScreen, null, '2026-08-15')

    expect(rangeFieldsOf(picked, channelScreen, bounds).fields).toEqual({
      from: '2026-08-15',
      to: '',
    })
    const ended = dayPickedOf(picked, channelScreen, bounds, '2026-09-01')
    expect(rangeFieldsOf(ended, channelScreen, bounds).fields).toEqual({
      from: '2026-08-15',
      to: '2026-09-01',
    })
  })

  test('a channel switch drops the day picked and the error Apply answered on the other channel', () => {
    const channelA: Route = { ...defaultRoute, channel: 'c-1' }
    const channelB: Route = { ...defaultRoute, channel: 'c-2' }
    const opened = windowPickedOf(channelA, 'custom', bounds)
    const picked = dayPickedOf(opened.draft, channelA, bounds, '2026-09-20')
    const { draft } = appliedOf(picked, channelA, bounds, 'en-GB')
    expect(rangeFieldsOf(draft, channelA, bounds).error).toBe(customRangeText.emptyField)

    const kept = draftOnViewOf(draft, channelB)
    expect(kept).toEqual(untouchedRangeDraft)
    expect(rangeFieldsOf(kept, channelB, bounds)).toEqual({
      window: 'last28',
      open: false,
      fields: null,
      applied: null,
      error: null,
    })
  })

  test('on a custom range, the first pick starts a new range in place of the applied one', () => {
    const onCustom: Route = {
      ...channelScreen,
      window: 'custom',
      range: { from: '2026-09-01', to: '2026-09-30' },
    }
    const opened = windowPickedOf(onCustom, 'custom', bounds)
    const picked = dayPickedOf(opened.draft, onCustom, bounds, '2026-08-03')
    expect(rangeFieldsOf(picked, onCustom, bounds).fields).toEqual({ from: '2026-08-03', to: '' })
  })

  test('two days picked, then Apply, move to the custom range on the first page and send video_window_changed', () => {
    const opened = windowPickedOf(channelScreen, 'custom', bounds)
    const started = dayPickedOf(opened.draft, channelScreen, bounds, '2026-10-01')
    const ended = dayPickedOf(started, channelScreen, bounds, '2026-09-18')
    const { draft, move } = appliedOf(ended, channelScreen, bounds, 'en-GB')

    expect(draft).toEqual(untouchedRangeDraft)
    expect(move).toEqual({
      route: {
        ...channelScreen,
        page: 1,
        window: 'custom',
        range: { from: '2026-09-18', to: '2026-10-01' },
      },
      event: { name: 'video_window_changed', window: 'custom', days: 14 },
    })
  })
})
