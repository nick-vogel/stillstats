import type { ListedChannel } from '@creator-analytics/api-types'
import { describe, expect, test } from 'vitest'
import {
  channelOfLink,
  channelTabOf,
  heldChannelOf,
  shortsTabOf,
  shortsVideoOf,
  videoIdOfLink,
  watchVideoOf,
} from './youtube-url.ts'

const channelId = 'UC8mOjhMBTyPPScCF9vYtwFg'

function channel(overrides: Partial<ListedChannel> = {}): ListedChannel {
  return {
    id: 'channel-1',
    youtubeChannelId: channelId,
    title: 'Nick Vogel',
    handle: '@nick_vogel',
    revenueConsentedAt: null,
    ...overrides,
  }
}

describe('a video id from a link', () => {
  test.each([
    ['/watch?v=9SvyFna2XGM', '9SvyFna2XGM'],
    ['/watch?v=BD5zferNslE&pp=0gcJCSkMAYcqIYzv', 'BD5zferNslE'],
    ['/watch?v=9SvyFna2XGM&t=42s', '9SvyFna2XGM'],
    ['/watch?v=9SvyFna2XGM&list=PL1234567890', '9SvyFna2XGM'],
    ['https://www.youtube.com/watch?v=9SvyFna2XGM', '9SvyFna2XGM'],
    ['/shorts/h1jr1K82xuQ', 'h1jr1K82xuQ'],
    ['https://www.youtube.com/shorts/h1jr1K82xuQ', 'h1jr1K82xuQ'],
  ])('%s is the video %s', (href, id) => {
    expect(videoIdOfLink(href)).toBe(id)
  })

  test.each([
    ['a watch link with no video', '/watch'],
    ['a watch link with a malformed video', '/watch?v=short'],
    ['a playlist link', '/playlist?list=PL1234567890'],
    ['a channel link', '/@nick_vogel'],
    ['a Shorts link with a malformed video', '/shorts/short'],
    ['a watch link on another host', 'https://example.com/watch?v=9SvyFna2XGM'],
  ])('%s is no video', (_, href) => {
    expect(videoIdOfLink(href)).toBeUndefined()
  })
})

describe('a channel from a link', () => {
  test.each([
    ['/@nick_vogel', { handle: '@nick_vogel' }],
    ['/@nick_vogel/videos', { handle: '@nick_vogel' }],
    ['https://www.youtube.com/@nick_vogel', { handle: '@nick_vogel' }],
    ['/@%E3%83%8B%E3%83%83%E3%82%AF', { handle: '@ニック' }],
    [`/channel/${channelId}`, { youtubeChannelId: channelId }],
    [`/channel/${channelId}/videos`, { youtubeChannelId: channelId }],
  ])('%s is the channel %o', (href, found) => {
    expect(channelOfLink(href)).toEqual(found)
  })

  test.each([
    ['a watch link', '/watch?v=9SvyFna2XGM'],
    ['a Shorts link', '/shorts/h1jr1K82xuQ'],
    ['the home page', '/'],
    ['a legacy custom URL', '/c/NickVogel'],
    ['a legacy user URL', '/user/NickVogel'],
    ['a handle with a malformed escape', '/@nick%E3%83'],
    ['a channel link on another host', 'https://example.com/@nick_vogel'],
  ])('%s names no channel', (_, href) => {
    expect(channelOfLink(href)).toBeUndefined()
  })
})

describe("the creator's held channel a link names", () => {
  test('a handle matches whatever its case', () => {
    const held = channel()
    const found = channelOfLink('/@Nick_Vogel')

    expect(found && heldChannelOf(found, [held])).toBe(held)
  })

  test('a percent-encoded handle matches the handle it decodes to', () => {
    const held = channel({ handle: '@ニック' })
    const found = channelOfLink('/@%E3%83%8B%E3%83%83%E3%82%AF')

    expect(found && heldChannelOf(found, [held])).toBe(held)
  })

  test('a channel with no handle matches a link by its channel id, and no handle link', () => {
    const held = channel({ handle: null })
    const byId = channelOfLink(`/channel/${channelId}`)
    const byHandle = channelOfLink('/@nick_vogel')

    expect(byId && heldChannelOf(byId, [held])).toBe(held)
    expect(byHandle && heldChannelOf(byHandle, [held])).toBeUndefined()
  })

  test('a link to a channel the creator does not hold matches none of theirs', () => {
    const held = [channel()]

    expect(heldChannelOf({ handle: '@someone_else' }, held)).toBeUndefined()
    expect(heldChannelOf({ youtubeChannelId: 'UCaaaaaaaaaaaaaaaaaaaaaa' }, held)).toBeUndefined()
  })
})

describe("the channel tab a page's URL is on", () => {
  test.each([
    `https://www.youtube.com/channel/${channelId}`,
    `https://www.youtube.com/channel/${channelId}/`,
    `https://www.youtube.com/channel/${channelId}/featured`,
    `https://www.youtube.com/channel/${channelId}/videos`,
    `https://www.youtube.com/channel/${channelId}/videos/`,
    `https://www.youtube.com/channel/${channelId}/streams`,
    `https://www.youtube.com/channel/${channelId}/streams/`,
  ])('%s is the channel by id', (url) => {
    expect(channelTabOf(url)).toEqual({ youtubeChannelId: channelId })
  })

  test.each([
    'https://www.youtube.com/@nick_vogel',
    'https://www.youtube.com/@nick_vogel/',
    'https://www.youtube.com/@nick_vogel/featured',
    'https://www.youtube.com/@nick_vogel/videos',
    'https://www.youtube.com/@nick_vogel/streams',
  ])('%s is the channel by handle', (url) => {
    expect(channelTabOf(url)).toEqual({ handle: '@nick_vogel' })
  })

  test.each([
    `https://www.youtube.com/channel/${channelId}/shorts`,
    'https://www.youtube.com/@nick_vogel/playlists',
    'https://www.youtube.com/@nick_vogel/community',
    'https://www.youtube.com/watch?v=9SvyFna2XGM',
    'https://www.youtube.com/',
    'https://www.youtube.com/c/NickVogel',
  ])('%s is no Videos, Live or Home tab', (url) => {
    expect(channelTabOf(url)).toBeUndefined()
  })
})

describe("the video a watch page's URL plays", () => {
  test.each([
    ['https://www.youtube.com/watch?v=9SvyFna2XGM', '9SvyFna2XGM'],
    ['https://www.youtube.com/watch?v=9SvyFna2XGM&t=42s', '9SvyFna2XGM'],
    ['https://www.youtube.com/watch?v=9SvyFna2XGM&list=PL1234567890&index=2', '9SvyFna2XGM'],
    ['https://www.youtube.com/watch?v=BD5zferNslE&pp=0gcJCSkMAYcqIYzv', 'BD5zferNslE'],
  ])('%s plays %s', (url, id) => {
    expect(watchVideoOf(url)).toBe(id)
  })

  test.each([
    ['a watch page with no video', 'https://www.youtube.com/watch'],
    ['a watch page with a malformed video', 'https://www.youtube.com/watch?v=short'],
    ['a Shorts page', 'https://www.youtube.com/shorts/h1jr1K82xuQ'],
    ['a live page', 'https://www.youtube.com/live/9SvyFna2XGM'],
    ['the home page', 'https://www.youtube.com/'],
    ['a channel tab', 'https://www.youtube.com/@nick_vogel/videos'],
    ['a watch page on another host', 'https://example.com/watch?v=9SvyFna2XGM'],
  ])('%s is no watch page', (_, url) => {
    expect(watchVideoOf(url)).toBeUndefined()
  })
})

describe("the channel Shorts tab a page's URL is on", () => {
  test.each([
    [`https://www.youtube.com/channel/${channelId}/shorts`, { youtubeChannelId: channelId }],
    [`https://www.youtube.com/channel/${channelId}/shorts/`, { youtubeChannelId: channelId }],
    ['https://www.youtube.com/@nick_vogel/shorts', { handle: '@nick_vogel' }],
  ])('%s is the channel %o', (url, found) => {
    expect(shortsTabOf(url)).toEqual(found)
  })

  test.each([
    ['the Videos tab', `https://www.youtube.com/channel/${channelId}/videos`],
    ['the Home tab', 'https://www.youtube.com/@nick_vogel'],
    ['the Live tab', 'https://www.youtube.com/@nick_vogel/streams'],
    ['the Shorts player', 'https://www.youtube.com/shorts/h1jr1K82xuQ'],
    ['a watch page', 'https://www.youtube.com/watch?v=9SvyFna2XGM'],
    ['a Shorts tab on another host', 'https://example.com/@nick_vogel/shorts'],
  ])('%s is no Shorts tab', (_, url) => {
    expect(shortsTabOf(url)).toBeUndefined()
  })
})

describe("the Short a Shorts player's URL plays", () => {
  test.each([
    ['https://www.youtube.com/shorts/h1jr1K82xuQ', 'h1jr1K82xuQ'],
    ['https://www.youtube.com/shorts/h1jr1K82xuQ/', 'h1jr1K82xuQ'],
    ['https://www.youtube.com/shorts/h1jr1K82xuQ?feature=share', 'h1jr1K82xuQ'],
  ])('%s plays %s', (url, id) => {
    expect(shortsVideoOf(url)).toBe(id)
  })

  test.each([
    ['a Shorts page with a malformed video', 'https://www.youtube.com/shorts/short'],
    ['a watch page', 'https://www.youtube.com/watch?v=9SvyFna2XGM'],
    ['a channel Shorts tab', 'https://www.youtube.com/@nick_vogel/shorts'],
    ['a Shorts page on another host', 'https://example.com/shorts/h1jr1K82xuQ'],
  ])('%s is no Shorts player', (_, url) => {
    expect(shortsVideoOf(url)).toBeUndefined()
  })
})
