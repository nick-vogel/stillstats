import { listedChannel } from '@creator-analytics/api-types/testing'
import { describe, expect, test } from 'vitest'
import {
  channelLinesOf,
  channelTitleOf,
  pickerShownFor,
  routeToChannel,
  selectedChannelOf,
} from './channel-picker.ts'
import { defaultRoute } from './route.ts'

const first = listedChannel({ id: 'c-1' })
const second = listedChannel({ id: 'c-2' })

describe('when the channel picker shows', () => {
  test('a creator with one channel sees no picker', () => {
    expect(pickerShownFor([first])).toBe(false)
  })

  test('a creator with no channel sees no picker', () => {
    expect(pickerShownFor([])).toBe(false)
  })

  test('a creator with two channels sees the picker', () => {
    expect(pickerShownFor([first, second])).toBe(true)
  })
})

describe('the channel the URL selects', () => {
  test('a URL that names a held channel selects it', () => {
    expect(selectedChannelOf([first, second], { ...defaultRoute, channel: 'c-2' })).toBe(second)
  })

  test('a URL that names no channel selects the first', () => {
    expect(selectedChannelOf([first, second], defaultRoute)).toBe(first)
  })

  test('a URL that names a channel the creator does not hold selects the first', () => {
    expect(selectedChannelOf([first, second], { ...defaultRoute, channel: 'c-9' })).toBe(first)
  })

  test('a creator with no channel has none selected', () => {
    expect(selectedChannelOf([], { ...defaultRoute, channel: 'c-2' })).toBeNull()
  })
})

describe('the route after a switch of channel', () => {
  test('names the new channel, returns to page 1 and keeps the window, sort and format', () => {
    const route = {
      page: 3,
      window: 'last28',
      sort: 'views',
      format: 'short',
      chart: 'daily',
    } as const
    expect(routeToChannel({ ...route, channel: 'c-1' }, 'c-2')).toStrictEqual({
      ...route,
      page: 1,
      channel: 'c-2',
    })
  })

  test.each([
    ["a video's detail screen", { video: 'dQw4w9WgXcQ' }],
    ['Settings', { settings: true }],
  ] as const)("from %s, opens the new channel's channel screen", (_screen, screen) => {
    const route = {
      page: 3,
      window: 'last28',
      sort: 'views',
      format: 'short',
      chart: 'aggregate',
    } as const
    expect(routeToChannel({ ...route, channel: 'c-1', ...screen }, 'c-2')).toStrictEqual({
      ...route,
      page: 1,
      channel: 'c-2',
    })
  })

  test("from the Audience screen, opens the new channel's Audience screen on page 1", () => {
    const route = {
      page: 3,
      window: 'last90',
      sort: 'views',
      format: 'short',
    } as const
    expect(routeToChannel({ ...route, channel: 'c-1', audience: true }, 'c-2')).toStrictEqual({
      ...route,
      page: 1,
      channel: 'c-2',
      audience: true,
    })
  })

  test("from the Audience screen, keeps the window chosen there and the list's own (creator-analytics#1049)", () => {
    const route = {
      page: 3,
      window: 'last7',
      sort: 'views',
      format: 'short',
      listWindow: { window: 'lifetime' },
    } as const
    expect(routeToChannel({ ...route, channel: 'c-1', audience: true }, 'c-2')).toStrictEqual({
      ...route,
      page: 1,
      channel: 'c-2',
      audience: true,
    })
  })
})

describe("a channel's name on its screen and on Settings", () => {
  test('is its title alone', () => {
    expect(channelTitleOf(listedChannel({ title: 'Nick Vogel', handle: '@nick_vogel' }))).toBe(
      'Nick Vogel',
    )
  })

  test('is its YouTube channel id when it has no title', () => {
    const untitled = listedChannel({ handle: '@nick_vogel' })
    expect(channelTitleOf(untitled)).toBe(untitled.youtubeChannelId)
  })
})

describe("the sidebar picker's two lines for a channel (creator-analytics#531)", () => {
  test('are its handle over its title', () => {
    expect(
      channelLinesOf(listedChannel({ title: 'Nick Vogel', handle: '@nick_vogel' })),
    ).toStrictEqual({ handle: '@nick_vogel', name: 'Nick Vogel' })
  })

  test('are its title alone when it has no handle', () => {
    expect(channelLinesOf(listedChannel({ title: 'Nick Vogel' }))).toStrictEqual({
      handle: null,
      name: 'Nick Vogel',
    })
  })

  test.each([
    ['and no handle', {}],
    ['but a handle', { handle: '@nick_vogel' }],
  ])('are its YouTube channel id alone when it has no title %s', (_case, fields) => {
    const untitled = listedChannel(fields)
    expect(channelLinesOf(untitled)).toStrictEqual({
      handle: null,
      name: untitled.youtubeChannelId,
    })
  })
})
