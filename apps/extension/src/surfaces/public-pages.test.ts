import type { ListedChannel } from '@creator-analytics/api-types'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { signedInReadKeptMs } from '../kept.ts'
import type { AskBackground, BackgroundRequest } from '../messages.ts'
import type { ChannelsRead, UploadsRead } from '../product-api.ts'
import { failureModes } from '../testing.ts'
import { publicPageReads } from './public-pages.ts'
import { uploadsAskedIn, uploadsOf, videoIdsSentIn } from './testing.ts'

const nick: ListedChannel = {
  id: 'channel-1',
  youtubeChannelId: 'UC8mOjhMBTyPPScCF9vYtwFg',
  title: 'Nick Vogel',
  handle: '@nick_vogel',
  revenueConsentedAt: null,
}
const other: ListedChannel = {
  id: 'channel-2',
  youtubeChannelId: 'UCaaaaaaaaaaaaaaaaaaaaaa',
  title: 'Second channel',
  handle: '@second',
  revenueConsentedAt: null,
}

/** Eleven characters, like a YouTube id. */
const idOf = (index: number) => `video${String(index).padStart(6, '0')}`

/** What the background answers a channel's uploads read: by default, ids 1 to 3 for each channel. */
type UploadsAnswered = (youtubeChannelId: string, call: number) => Promise<UploadsRead>

/** The shared reads over a background that answers each uploads read, recording each request. */
function readsOver(
  channels: ChannelsRead | (() => Promise<ChannelsRead>) = {
    state: 'signed-in',
    channels: [nick, other],
  },
  uploads: UploadsAnswered = () => Promise.resolve(uploadsOf([idOf(1), idOf(2), idOf(3)])),
) {
  const calls = new Map<string, number>()
  const asked: BackgroundRequest[] = []
  // Not async, so an ask that throws before it returns a promise throws.
  const ask = ((request: BackgroundRequest) => {
    asked.push(request)
    if (request.type === 'read-channels')
      return typeof channels === 'function' ? channels() : Promise.resolve(channels)
    if (request.type === 'read-uploads') {
      const call = (calls.get(request.youtubeChannelId) ?? 0) + 1
      calls.set(request.youtubeChannelId, call)
      return uploads(request.youtubeChannelId, call)
    }
    if (request.type === 'read-videos') return Promise.resolve({ state: 'failed' })
    return Promise.resolve(true)
  }) as AskBackground
  const reads = publicPageReads({ ask, locale: 'en-GB' })
  const uploadsReads = () => uploadsAskedIn(asked)
  const channelReads = () => asked.filter(({ type }) => type === 'read-channels')
  return { reads, asked, uploadsReads, channelReads }
}

describe("the held channels' uploads a public page reads", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  /** An uploads read that gives `first` on each channel's first call, and ids 1 to 3 after. */
  const firstThenRead =
    (first: () => Promise<UploadsRead>): UploadsAnswered =>
    (_, call) =>
      call === 1 ? first() : Promise.resolve(uploadsOf([idOf(1), idOf(2), idOf(3)]))

  test("each upload's pill is its compact figure, named with the full figure and the read's day", async () => {
    const { reads } = readsOver({ state: 'signed-in', channels: [nick] })

    const { pills } = await reads.pillsOn(1)

    expect(pills.get(idOf(1))).toEqual({
      figure: '334k',
      name: 'Stillstats: 334,212 engaged views. Through 7 Oct',
    })
    expect([...pills.keys()]).toEqual([idOf(1), idOf(2), idOf(3)])
  })

  test('an upload YouTube has not processed has no pill, and a video not among the uploads has none', async () => {
    const { reads } = readsOver({ state: 'signed-in', channels: [nick] }, () =>
      Promise.resolve(uploadsOf([idOf(1), idOf(2)], { awaiting: [idOf(2)] })),
    )

    const { pills } = await reads.pillsOn(1)

    expect([...pills.keys()]).toEqual([idOf(1)])
    expect(pills.get(idOf(9))).toBeUndefined()
  })

  test("each held channel's uploads are asked under its own YouTube channel id, both out at once, and their pills answered together", async () => {
    const out = new Map<string, (read: UploadsRead) => void>()
    const { reads, uploadsReads } = readsOver(
      undefined,
      (youtubeChannelId) =>
        new Promise((resolve) => {
          out.set(youtubeChannelId, resolve)
        }),
    )

    const pills = reads.pillsOn(1)
    await vi.advanceTimersByTimeAsync(0)
    expect(uploadsReads()).toEqual([nick.youtubeChannelId, other.youtubeChannelId])
    out.get(nick.youtubeChannelId)?.(uploadsOf([idOf(1)]))
    out.get(other.youtubeChannelId)?.(uploadsOf([idOf(2)], { engagedViews: () => 12_000 }))

    const { pills: answered } = await pills
    expect(answered.get(idOf(1))?.figure).toBe('334k')
    expect(answered.get(idOf(2))?.figure).toBe('12k')
  })

  test('uploads are asked once per held channel per navigation, however many passes and surfaces ask', async () => {
    const { reads, uploadsReads, channelReads } = readsOver()

    await Promise.all([reads.pillsOn(1), reads.pillsOn(1)])
    await reads.pillsOn(1)
    vi.advanceTimersByTime(signedInReadKeptMs * 3)
    await reads.pillsOn(1)

    expect(uploadsReads()).toEqual([nick.youtubeChannelId, other.youtubeChannelId])
    expect(channelReads()).toHaveLength(1)
  })

  test('a new navigation asks every held channel again', async () => {
    const { reads, uploadsReads } = readsOver()
    await reads.pillsOn(1)

    await reads.pillsOn(2)

    expect(uploadsReads()).toEqual([
      nick.youtubeChannelId,
      other.youtubeChannelId,
      nick.youtubeChannelId,
      other.youtubeChannelId,
    ])
  })

  test.each([
    ['signed out', { state: 'signed-out' }],
    ['no channel held', { state: 'signed-in', channels: [] }],
    ['a failed channels read', { state: 'failed' }],
  ] as const satisfies readonly (readonly [string, ChannelsRead])[])(
    'with %s, the pills are none and no uploads are asked',
    async (_, channels) => {
      const { reads, uploadsReads } = readsOver(channels)

      expect((await reads.pillsOn(1)).pills.size).toBe(0)
      expect(uploadsReads()).toEqual([])
    },
  )

  test.each([
    ['signed out', { state: 'signed-out' }],
    ['channel not in Stillstats', { state: 'channel-not-in-stillstats' }],
    ['refused for a reserved quota', { state: 'refused', refusal: 'quota_reserved' }],
    ['refused for a revoked connection', { state: 'refused', refusal: 'connection_revoked' }],
    ['failed', { state: 'failed' }],
    ['withheld by host access', { state: 'host-access-withheld' }],
  ] as const satisfies readonly (readonly [string, UploadsRead])[])(
    'uploads whose read is %s add no pill, and are asked again once signedInReadKeptMs has passed, not before',
    async (_, first) => {
      const { reads, uploadsReads } = readsOver(
        { state: 'signed-in', channels: [nick] },
        firstThenRead(() => Promise.resolve(first)),
      )

      expect((await reads.pillsOn(1)).pills.size).toBe(0)
      vi.advanceTimersByTime(signedInReadKeptMs - 1)
      expect((await reads.pillsOn(1)).pills.size).toBe(0)
      expect(uploadsReads()).toHaveLength(1)

      vi.advanceTimersByTime(1)
      const { pills } = await reads.pillsOn(1)

      expect(pills.get(idOf(1))?.figure).toBe('334k')
      expect(uploadsReads()).toHaveLength(2)
    },
  )

  test('the pills say whether an uploads read answered: none with no channel held or every read holding no answer, and yes when one answered beside a failed one', async () => {
    const failed = (): Promise<UploadsRead> => Promise.resolve({ state: 'failed' })

    expect((await readsOver({ state: 'failed' }).reads.pillsOn(1)).answered).toBe(false)
    expect((await readsOver(undefined, failed).reads.pillsOn(1)).answered).toBe(false)
    const oneAnswered = readsOver(undefined, (youtubeChannelId) =>
      youtubeChannelId === nick.youtubeChannelId ? failed() : Promise.resolve(uploadsOf([idOf(1)])),
    )
    expect((await oneAnswered.reads.pillsOn(1)).answered).toBe(true)
  })

  test.each(failureModes)(
    'uploads whose ask %s add no pill, and are asked again once signedInReadKeptMs has passed',
    async (_, fail) => {
      const { reads, uploadsReads } = readsOver(
        { state: 'signed-in', channels: [nick] },
        firstThenRead(fail),
      )

      expect((await reads.pillsOn(1)).pills.size).toBe(0)
      await reads.pillsOn(1)
      expect(uploadsReads()).toHaveLength(1)

      vi.advanceTimersByTime(signedInReadKeptMs)
      expect((await reads.pillsOn(1)).pills.get(idOf(1))?.figure).toBe('334k')
      expect(uploadsReads()).toHaveLength(2)
    },
  )

  test("one channel's failed read leaves the other channel's pills", async () => {
    const { reads } = readsOver(undefined, (youtubeChannelId) =>
      Promise.resolve(
        youtubeChannelId === nick.youtubeChannelId
          ? { state: 'failed' }
          : uploadsOf([idOf(4)], { engagedViews: () => 12_000 }),
      ),
    )

    const { pills } = await reads.pillsOn(1)

    expect([...pills.keys()]).toEqual([idOf(4)])
    expect(pills.get(idOf(4))?.figure).toBe('12k')
  })

  test.each([
    ['both from the cache', true, [true, true]],
    ['one read cold', false, [true, false]],
    ['both read cold', false, [false, false]],
  ])(
    "two held channels' uploads reads %s answer the pills with fromCache %s",
    async (_, fromCache, [nickCached, otherCached]) => {
      const { reads } = readsOver(undefined, (youtubeChannelId) =>
        Promise.resolve(
          uploadsOf([idOf(1)], {
            fromCache: youtubeChannelId === nick.youtubeChannelId ? !!nickCached : !!otherCached,
          }),
        ),
      )

      expect(await reads.pillsOn(1)).toMatchObject({ fromCache })
    },
  )

  test("a channel's read that held no answer does not count toward the cache result: the other channel's cached read answers fromCache true", async () => {
    const { reads } = readsOver(undefined, (youtubeChannelId) =>
      Promise.resolve(
        youtubeChannelId === nick.youtubeChannelId
          ? { state: 'failed' }
          : uploadsOf([idOf(4)], { fromCache: true }),
      ),
    )

    const { pills, fromCache } = await reads.pillsOn(1)

    expect([...pills.keys()]).toEqual([idOf(4)])
    expect(fromCache).toBe(true)
  })

  test('a read that is out is never asked twice, and its keep time runs from when it settles', async () => {
    let settle: (read: UploadsRead) => void = () => {}
    const out = new Promise<UploadsRead>((resolve) => {
      settle = resolve
    })
    const { reads, uploadsReads } = readsOver(
      { state: 'signed-in', channels: [nick] },
      (_, call) => (call === 1 ? out : Promise.resolve(uploadsOf([idOf(1)]))),
    )

    const first = reads.pillsOn(1)
    const before = reads.pillsOn(1)
    await vi.advanceTimersByTimeAsync(signedInReadKeptMs * 2)
    const after = reads.pillsOn(1)
    settle({ state: 'failed' })
    await Promise.all([first, before, after])
    expect(uploadsReads()).toHaveLength(1)

    await reads.pillsOn(1)
    expect(uploadsReads()).toHaveLength(1)

    vi.advanceTimersByTime(signedInReadKeptMs)
    expect((await reads.pillsOn(1)).pills.get(idOf(1))?.figure).toBe('334k')
    expect(uploadsReads()).toHaveLength(2)
  })

  test('no video id is ever sent, and no read of videos asked', async () => {
    const { reads, asked } = readsOver()

    await reads.pillsOn(1)
    await reads.pillsOn(2)

    expect(videoIdsSentIn(asked)).toEqual([])
    expect(asked.filter(({ type }) => type === 'read-videos')).toEqual([])
  })
})

describe("the creator's held channels", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  /** A channels ask that gives `first` on its first call and the signed-in channels after. */
  const firstThenSignedIn = (first: () => Promise<ChannelsRead>) => {
    let calls = 0
    return () => {
      calls += 1
      if (calls === 1) return first()
      return Promise.resolve<ChannelsRead>({ state: 'signed-in', channels: [nick, other] })
    }
  }

  test.each([
    ['signed out', (): Promise<ChannelsRead> => Promise.resolve({ state: 'signed-out' })],
    ['failed', (): Promise<ChannelsRead> => Promise.resolve({ state: 'failed' })],
    ...failureModes,
  ] as const)(
    'a channels read that %s is asked again once signedInReadKeptMs has passed, not before',
    async (_, first) => {
      const { reads, channelReads } = readsOver(firstThenSignedIn(first))

      expect(await reads.heldChannels(1)).toEqual([])
      vi.advanceTimersByTime(signedInReadKeptMs - 1)
      expect(await reads.heldChannels(1)).toEqual([])
      expect(channelReads()).toHaveLength(1)

      vi.advanceTimersByTime(1)
      expect(await reads.heldChannels(1)).toEqual([nick, other])
      expect(channelReads()).toHaveLength(2)
    },
  )

  test('a signed-in read is kept for the navigation, also once signedInReadKeptMs has passed', async () => {
    const { reads, channelReads } = readsOver()
    await reads.heldChannels(1)

    vi.advanceTimersByTime(signedInReadKeptMs * 3)

    expect(await reads.heldChannels(1)).toEqual([nick, other])
    expect(channelReads()).toHaveLength(1)
  })

  test('a channels read that is out is shared by every pass, before and after signedInReadKeptMs', async () => {
    let answer: (read: ChannelsRead) => void = () => {}
    const out = new Promise<ChannelsRead>((resolve) => {
      answer = resolve
    })
    const { reads, channelReads } = readsOver(() => out)

    const first = reads.heldChannels(1)
    const before = reads.heldChannels(1)
    vi.advanceTimersByTime(signedInReadKeptMs * 2)
    const after = reads.heldChannels(1)
    answer({ state: 'failed' })

    expect(await Promise.all([first, before, after])).toEqual([[], [], []])
    expect(channelReads()).toHaveLength(1)
  })

  test('are asked once per navigation, however many passes ask', async () => {
    const { reads, channelReads } = readsOver()

    expect(await reads.heldChannels(1)).toEqual([nick, other])
    await reads.heldChannels(1)
    expect(channelReads()).toHaveLength(1)

    await reads.heldChannels(2)
    expect(channelReads()).toHaveLength(2)
  })

  test.each([
    ['signed out', { state: 'signed-out' }],
    ['failed', { state: 'failed' }],
  ] as const)('a channels read that is %s holds no channels', async (_, read) => {
    const { reads } = readsOver(read)

    expect(await reads.heldChannels(1)).toEqual([])
  })

  test.each(failureModes)('a channels ask that %s holds no channels', async (_, fail) => {
    const { reads } = readsOver(fail)

    expect(await reads.heldChannels(1)).toEqual([])
  })
})
