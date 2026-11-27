// @vitest-environment jsdom
// Limits: the page here is a stand-in for the analytics page's shape, a card holding a header and a
// Views tile with its number row, the line before the card and the figure after the number row, so
// these tests see what the placer keeps up while a read is out, not Studio's markup. The redraws
// they model, Studio putting back an earlier card, header, Views number or whole container, drawing
// a new header over the same Views number, a redrawn one or none, and redrawing a card many times
// for one video, appear in no saved fixture; whether real Studio makes any of them is the mutation
// recording in creator-analytics#99. Where a test passes a root that holds none of the earlier
// elements, that is only a way to leave an earlier placement up beside a later one.
import type { VideoListAnswer, VideoRow } from '@creator-analytics/api-types'
import { describe, expect, onTestFinished, test, vi } from 'vitest'
import { signedInReadKeptMs } from '../kept.ts'
import type { AskBackground, BackgroundRequest } from '../messages.ts'
import type { VideosRead } from '../product-api.ts'
import { lineClicks } from './line-clicks.ts'
import { redrawnFrom, shownFrom } from './page-watcher.ts'
import { type PlacedHost, videoRowPlacer } from './video-row.ts'

const videoOf = (id: string): VideoRow => ({
  id,
  title: 'A video',
  thumbnailUrl: null,
  thumbnails: [],
  durationSeconds: null,
  publishedAt: '2026-10-06T15:00:00Z',
  scheduled: false,
  privacy: 'public',
  format: 'video',
  engagedViews: 1234,
  views: 1400,
  averageViewPercentage: 41.2,
  subscribersGained: 3,
  estimatedMinutesWatched: 0,
  awaitingProcessing: false,
})

const readOf = (id: string, fromCache = false): VideosRead => {
  const answer: VideoListAnswer = {
    videos: [videoOf(id)],
    window: 'lifetime',
    page: 1,
    pageSize: 1,
    pageCount: 1,
    revenue: { refusal: 'consent_missing' },
    lastProcessedDay: '2026-10-07',
    creationDay: null,
    fetchedAt: '2026-10-10T12:00:00Z',
    fromCache,
  }
  return { state: 'read', channelId: 'channel-1', answer }
}

function placerHolding() {
  let held = false
  let signedOut = false
  let reads = 0
  let fromCache = false
  const leftOut = new Set<string>()
  const ask = (async (request: BackgroundRequest) => {
    if (request.type !== 'read-videos') return true
    reads += 1
    if (held) return new Promise<VideosRead>(() => {})
    if (signedOut) return { state: 'signed-out' } satisfies VideosRead
    const id = 'ids' in request ? (request.ids[0] ?? '') : ''
    return readOf(leftOut.has(id) ? 'ZZZZZZZZZZZ' : id, fromCache)
  }) as AskBackground
  const place = videoRowPlacer('analytics', {
    ask,
    origin: 'https://stillstats.example',
    locale: 'en-GB',
    lineClicks: lineClicks(ask),
  })
  return {
    place,
    holdReads: () => {
      held = true
    },
    leaveOut: (id: string) => {
      leftOut.add(id)
    },
    letIn: (id: string) => {
      leftOut.delete(id)
    },
    /** Every read answers as for a signed-out creator, so a pass places a line with a host. */
    signOut: () => {
      signedOut = true
    },
    signIn: () => {
      signedOut = false
    },
    reads: () => reads,
    /** Every read from now on answers with `cached` as its `fromCache`. */
    answerFromCache: (cached: boolean) => {
      fromCache = cached
    },
  }
}

function card() {
  const element = document.createElement('div')
  const header = document.createElement('div')
  const tile = document.createElement('div')
  const number = document.createElement('div')
  tile.append(number)
  element.append(header, tile)
  return { element, header, number }
}

/** A card inside an element of its own, so Studio can swap the whole container or only the card. */
function contained() {
  const shown = card()
  const outer = document.createElement('div')
  outer.append(shown.element)
  return { ...shown, outer }
}

function placing(
  place: ReturnType<typeof placerHolding>['place'],
  shown: ReturnType<typeof card>,
  videoId: string,
  standsOn: Element | undefined,
  /** Where the placer takes the surface's earlier elements down from: the whole page by default. */
  root: ParentNode = document,
  /** The navigation the pass places for. */
  navigation = 1,
) {
  return place({
    document,
    navigation,
    after: shown.header,
    ...(standsOn ? { standsOn } : {}),
    root,
    youtubeChannelId: 'UC8mOjhMBTyPPScCF9vYtwFg',
    videoId,
    window: 'lifetime',
    current: () => true,
    render(view) {
      if (view.view.kind === 'nothing') return []
      const host = (kind: string) => {
        const element = document.createElement('div')
        element.setAttribute('data-stillstats-surface', 'analytics')
        element.dataset.kind = kind
        element.dataset.video = videoId
        return element
      }
      const line: PlacedHost = { host: host('line'), before: shown.element }
      return standsOn && view.view.kind !== 'line'
        ? [{ host: host('figure'), after: standsOn }, line]
        : [line]
    },
  })
}

const up = (root: ParentNode = document) =>
  [...root.querySelectorAll<HTMLElement>('[data-stillstats-surface="analytics"]')].map(
    (host) => `${host.dataset.kind}:${host.dataset.video}`,
  )

const settle = async () => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve()
}

/** What a placing call has resolved to so far: `'pending'` while its read is out. */
const soFar = (placement: Promise<unknown>) => Promise.race([placement, Promise.resolve('pending')])

test('Studio putting back an earlier card for an earlier video leaves nothing of the video shown since while the read is out', async () => {
  document.body.replaceChildren()
  const { place, holdReads } = placerHolding()
  const first = card()
  document.body.append(first.element)
  await placing(place, first, 'XXXXXXXXXXX', first.number)
  const second = card()
  first.element.replaceWith(second.element)
  await placing(place, second, 'YYYYYYYYYYY', second.number)
  expect(up()).toEqual(['line:YYYYYYYYYYY', 'figure:YYYYYYYYYYY'])

  second.element.replaceWith(first.element)
  holdReads()
  void placing(place, first, 'XXXXXXXXXXX', first.number)
  await settle()

  expect(up()).toEqual([])
})

test('Studio drawing a new header and taking the Views number away in one render leaves no figure in the tile while the read is out, and the line up', async () => {
  document.body.replaceChildren()
  const { place, holdReads } = placerHolding()
  const shown = card()
  document.body.append(shown.element)
  await placing(place, shown, 'XXXXXXXXXXX', shown.number)
  expect(up()).toEqual(['line:XXXXXXXXXXX', 'figure:XXXXXXXXXXX'])

  const header = document.createElement('div')
  shown.header.replaceWith(header)
  shown.number.remove()
  holdReads()
  void placing(place, { ...shown, header }, 'XXXXXXXXXXX', undefined)
  await settle()

  expect(up()).toEqual(['line:XXXXXXXXXXX'])
})

test('Studio putting back an earlier card whose video showed nothing leaves nothing of the video shown since', async () => {
  document.body.replaceChildren()
  const { place, holdReads, leaveOut } = placerHolding()
  leaveOut('XXXXXXXXXXX')
  const first = card()
  document.body.append(first.element)
  await placing(place, first, 'XXXXXXXXXXX', first.number)
  expect(up()).toEqual([])
  const second = card()
  first.element.replaceWith(second.element)
  await placing(place, second, 'YYYYYYYYYYY', second.number)
  expect(up()).toEqual(['line:YYYYYYYYYYY', 'figure:YYYYYYYYYYY'])

  second.element.replaceWith(first.element)
  holdReads()
  const placement = placing(place, first, 'XXXXXXXXXXX', first.number)
  await settle()

  expect(await soFar(placement)).toBe('placed')
  expect(up()).toEqual([])
})

test('a kept header whose read showed nothing still takes down a figure beside a Views number Studio has since redrawn', async () => {
  document.body.replaceChildren()
  const { place, holdReads, reads, leaveOut, letIn } = placerHolding()
  const shown = card()
  document.body.append(shown.element)
  leaveOut('XXXXXXXXXXX')
  expect(await placing(place, shown, 'XXXXXXXXXXX', shown.number)).toBe('placed')
  expect(up()).toEqual([])
  letIn('XXXXXXXXXXX')
  const redrawn = {
    ...shown,
    header: document.createElement('div'),
    number: document.createElement('div'),
  }
  shown.header.replaceWith(redrawn.header)
  shown.number.replaceWith(redrawn.number)
  expect(await placing(place, redrawn, 'XXXXXXXXXXX', redrawn.number)).toEqual(shownFrom(false))
  expect(up()).toEqual(['line:XXXXXXXXXXX', 'figure:XXXXXXXXXXX'])

  const readsBefore = reads()

  redrawn.header.replaceWith(shown.header)
  redrawn.number.replaceWith(shown.number)
  holdReads()
  const placement = placing(place, shown, 'XXXXXXXXXXX', shown.number)
  await settle()

  expect(await soFar(placement)).toBe('placed')
  expect(reads()).toBe(readsBefore)
  expect(up()).toEqual(['line:XXXXXXXXXXX'])
})

test('a kept header whose read showed nothing still takes down a figure beside a Views number Studio has since taken away', async () => {
  document.body.replaceChildren()
  const { place, holdReads, reads, leaveOut, letIn } = placerHolding()
  const shown = card()
  document.body.append(shown.element)
  leaveOut('XXXXXXXXXXX')
  await placing(place, shown, 'XXXXXXXXXXX', shown.number)
  letIn('XXXXXXXXXXX')
  const redrawn = {
    ...shown,
    header: document.createElement('div'),
    number: document.createElement('div'),
  }
  shown.header.replaceWith(redrawn.header)
  shown.number.replaceWith(redrawn.number)
  await placing(place, redrawn, 'XXXXXXXXXXX', redrawn.number)
  const readsBefore = reads()

  redrawn.header.replaceWith(shown.header)
  redrawn.number.remove()
  holdReads()
  const placement = placing(place, shown, 'XXXXXXXXXXX', undefined)
  await settle()

  expect(await soFar(placement)).toBe('placed')
  expect(reads()).toBe(readsBefore)
  expect(up()).toEqual(['line:XXXXXXXXXXX'])
})

test('a container Studio puts back after a read for another video is read again, and a new card for that video then leaves nothing of the put-back one up while the read is out', async () => {
  document.body.replaceChildren()
  const { place, holdReads, reads } = placerHolding()
  const one = contained()
  document.body.append(one.outer)
  await placing(place, one, 'XXXXXXXXXXX', undefined)
  expect(up()).toEqual(['line:XXXXXXXXXXX'])
  const two = contained()
  one.outer.replaceWith(two.outer)
  await placing(place, two, 'XXXXXXXXXXX', two.number)
  const three = contained()
  two.outer.replaceWith(three.outer)
  await placing(place, three, 'YYYYYYYYYYY', three.number)
  expect(up()).toEqual(['line:YYYYYYYYYYY', 'figure:YYYYYYYYYYY'])
  three.outer.replaceWith(one.outer)
  const readsBefore = reads()
  expect(await placing(place, one, 'XXXXXXXXXXX', undefined)).toEqual(shownFrom(false))
  expect(reads()).toBe(readsBefore + 1)
  expect(up()).toEqual(['line:XXXXXXXXXXX'])

  const five = card()
  one.element.replaceWith(five.element)
  holdReads()
  void placing(place, five, 'YYYYYYYYYYY', five.number)
  await settle()

  expect(up()).toEqual([])
})

test.for([
  { pass: 'reads', on: 'a new card' },
  { pass: 'keeps', on: 'a header whose read showed nothing' },
] as const)(
  'a placement from two back, still up beside the last one, comes down whole when a pass for another video $pass on $on',
  async ({ pass }) => {
    document.body.replaceChildren()
    const { place, holdReads, reads, leaveOut } = placerHolding()
    const other = card()
    document.body.append(other.element)
    leaveOut('YYYYYYYYYYY')
    expect(await placing(place, other, 'YYYYYYYYYYY', other.number)).toBe('placed')
    const earlier = card()
    document.body.append(earlier.element)
    await placing(place, earlier, 'XXXXXXXXXXX', earlier.number)
    // A new header over the same Views number, placed with a root that holds none of the earlier
    // elements, so the earlier line and figure stay up beside the last ones.
    const last = { ...earlier, header: document.createElement('div') }
    earlier.header.replaceWith(last.header)
    await placing(place, last, 'XXXXXXXXXXX', earlier.number, document.createElement('div'))
    expect(up()).toEqual([
      'line:XXXXXXXXXXX',
      'line:XXXXXXXXXXX',
      'figure:XXXXXXXXXXX',
      'figure:XXXXXXXXXXX',
    ])
    const readsBefore = reads()

    let passing = other
    if (pass === 'reads') {
      passing = card()
      other.element.replaceWith(passing.element)
    }
    holdReads()
    const placement = placing(place, passing, 'YYYYYYYYYYY', passing.number)
    await settle()

    expect(await soFar(placement)).toBe(pass === 'reads' ? 'pending' : 'placed')
    expect(reads()).toBe(pass === 'reads' ? readsBefore + 1 : readsBefore)
    expect(up()).toEqual([])
  },
)

test('many redraws of one video leave nothing of the extension in a card Studio detached, so the card Studio puts back is read again and holds one line and one figure', async () => {
  document.body.replaceChildren()
  const { place, reads } = placerHolding()
  const first = contained()
  document.body.append(first.outer)
  await placing(place, first, 'XXXXXXXXXXX', first.number)
  let showing = first
  for (let i = 0; i < 3; i += 1) {
    const redrawn = contained()
    showing.outer.replaceWith(redrawn.outer)
    expect(await placing(place, redrawn, 'XXXXXXXXXXX', redrawn.number)).toEqual(shownFrom(false))
    showing = redrawn
  }
  expect(up()).toEqual(['line:XXXXXXXXXXX', 'figure:XXXXXXXXXXX'])

  showing.outer.replaceWith(first.outer)
  expect(up(first.outer)).toEqual([])
  const readsBefore = reads()
  expect(await placing(place, first, 'XXXXXXXXXXX', first.number)).toEqual(shownFrom(false))

  expect(reads()).toBe(readsBefore + 1)
  expect(up(first.outer)).toEqual(['line:XXXXXXXXXXX', 'figure:XXXXXXXXXXX'])
  expect(up()).toEqual(['line:XXXXXXXXXXX', 'figure:XXXXXXXXXXX'])
})

test('a header Studio kept, beside the same Views number, keeps its line and figure with no read', async () => {
  document.body.replaceChildren()
  const { place, holdReads, reads } = placerHolding()
  const shown = card()
  document.body.append(shown.element)
  await placing(place, shown, 'XXXXXXXXXXX', shown.number)
  const readsBefore = reads()

  holdReads()
  const placement = placing(place, shown, 'XXXXXXXXXXX', shown.number)
  await settle()

  expect(await soFar(placement)).toEqual(shownFrom(false))
  expect(reads()).toBe(readsBefore)
  expect(up()).toEqual(['line:XXXXXXXXXXX', 'figure:XXXXXXXXXXX'])
})

test('a header Studio kept over a redrawn Views number reads again, with the figure down and the line up while the read is out', async () => {
  document.body.replaceChildren()
  const { place, holdReads, reads } = placerHolding()
  const shown = card()
  document.body.append(shown.element)
  await placing(place, shown, 'XXXXXXXXXXX', shown.number)
  const readsBefore = reads()

  const number = document.createElement('div')
  shown.number.replaceWith(number)
  holdReads()
  const placement = placing(place, shown, 'XXXXXXXXXXX', number)
  await settle()

  expect(await soFar(placement)).toBe('pending')
  expect(reads()).toBe(readsBefore + 1)
  expect(up()).toEqual(['line:XXXXXXXXXXX'])
})

test('a kept sign-in line returns with no read, and a figure of the same video beside a Views number Studio has since redrawn comes down first', async () => {
  document.body.replaceChildren()
  const { place, holdReads, reads, signOut, signIn } = placerHolding()
  const shown = card()
  document.body.append(shown.element)
  signOut()
  expect(await placing(place, shown, 'XXXXXXXXXXX', shown.number)).toBe('placed')
  expect(up()).toEqual(['line:XXXXXXXXXXX'])
  signIn()
  const redrawn = {
    ...shown,
    header: document.createElement('div'),
    number: document.createElement('div'),
  }
  shown.header.replaceWith(redrawn.header)
  shown.number.replaceWith(redrawn.number)
  // The card's line is outside this root, so the sign-in line stays up beside the new one.
  expect(await placing(place, redrawn, 'XXXXXXXXXXX', redrawn.number, redrawn.element)).toEqual(
    shownFrom(false),
  )
  expect(up()).toEqual(['line:XXXXXXXXXXX', 'line:XXXXXXXXXXX', 'figure:XXXXXXXXXXX'])
  const readsBefore = reads()

  redrawn.header.replaceWith(shown.header)
  redrawn.number.replaceWith(shown.number)
  holdReads()
  const placement = placing(place, shown, 'XXXXXXXXXXX', shown.number)
  await settle()

  expect(await soFar(placement)).toBe('placed')
  expect(reads()).toBe(readsBefore)
  expect(up()).toEqual(['line:XXXXXXXXXXX', 'line:XXXXXXXXXXX'])
})

test('a sign-in line past its keeping time reads again, and stays up until the read lands', async () => {
  vi.useFakeTimers()
  try {
    document.body.replaceChildren()
    const { place, holdReads, reads, signOut } = placerHolding()
    const shown = card()
    document.body.append(shown.element)
    signOut()
    expect(await placing(place, shown, 'XXXXXXXXXXX', shown.number)).toBe('placed')
    const readsBefore = reads()

    vi.advanceTimersByTime(signedInReadKeptMs)
    holdReads()
    const placement = placing(place, shown, 'XXXXXXXXXXX', shown.number)
    await settle()

    expect(await soFar(placement)).toBe('pending')
    expect(reads()).toBe(readsBefore + 1)
    expect(up()).toEqual(['line:XXXXXXXXXXX'])
  } finally {
    vi.useRealTimers()
  }
})

test('a header Studio kept for another video takes down everything placed for the first one before the read', async () => {
  document.body.replaceChildren()
  const { place, holdReads, reads } = placerHolding()
  const shown = card()
  document.body.append(shown.element)
  await placing(place, shown, 'XXXXXXXXXXX', shown.number)
  const readsBefore = reads()

  holdReads()
  const placement = placing(place, shown, 'YYYYYYYYYYY', shown.number)
  await settle()

  expect(await soFar(placement)).toBe('pending')
  expect(reads()).toBe(readsBefore + 1)
  expect(up()).toEqual([])
})

test('a new header over the same Views number keeps the line and figure up while the read is out', async () => {
  document.body.replaceChildren()
  const { place, holdReads, reads } = placerHolding()
  const shown = card()
  document.body.append(shown.element)
  await placing(place, shown, 'XXXXXXXXXXX', shown.number)
  const readsBefore = reads()

  const header = document.createElement('div')
  shown.header.replaceWith(header)
  holdReads()
  const placement = placing(place, { ...shown, header }, 'XXXXXXXXXXX', shown.number)
  await settle()

  expect(await soFar(placement)).toBe('pending')
  expect(reads()).toBe(readsBefore + 1)
  expect(up()).toEqual(['line:XXXXXXXXXXX', 'figure:XXXXXXXXXXX'])
})

test('a figure from two placements back comes down once a pass stands on another Views number, and its line stays', async () => {
  document.body.replaceChildren()
  const { place, holdReads } = placerHolding()
  const earlier = card()
  document.body.append(earlier.element)
  await placing(place, earlier, 'XXXXXXXXXXX', earlier.number)
  // A new header over the same Views number, placed with a root that holds none of the earlier
  // elements, so the earlier line and figure stay up beside the last ones.
  const last = { ...earlier, header: document.createElement('div') }
  earlier.header.replaceWith(last.header)
  await placing(place, last, 'XXXXXXXXXXX', earlier.number, document.createElement('div'))
  expect(up()).toEqual([
    'line:XXXXXXXXXXX',
    'line:XXXXXXXXXXX',
    'figure:XXXXXXXXXXX',
    'figure:XXXXXXXXXXX',
  ])

  const next = {
    ...earlier,
    header: document.createElement('div'),
    number: document.createElement('div'),
  }
  last.header.replaceWith(next.header)
  earlier.number.replaceWith(next.number)
  holdReads()
  void placing(place, next, 'XXXXXXXXXXX', next.number)
  await settle()

  expect(up()).toEqual(['line:XXXXXXXXXXX', 'line:XXXXXXXXXXX'])
})

test.each([true, false])(
  "a figure placed from a read answers shown with the read's fromCache, %s",
  async (fromCache) => {
    document.body.replaceChildren()
    const { place, answerFromCache } = placerHolding()
    const shown = card()
    document.body.append(shown.element)
    answerFromCache(fromCache)

    expect(await placing(place, shown, 'XXXXXXXXXXX', shown.number)).toEqual(shownFrom(fromCache))
  },
)

test('a figure kept with no read answers the cache result it was drawn from', async () => {
  document.body.replaceChildren()
  const { place, answerFromCache, reads } = placerHolding()
  const shown = card()
  document.body.append(shown.element)
  answerFromCache(true)
  await placing(place, shown, 'XXXXXXXXXXX', shown.number)
  const readsBefore = reads()

  answerFromCache(false)
  const kept = await placing(place, shown, 'XXXXXXXXXXX', shown.number)

  expect(reads()).toBe(readsBefore)
  expect(kept).toEqual(shownFrom(true))
})

test("a figure drawn for an earlier navigation and kept by the next one's pass answers from the cache, as no request left the browser", async () => {
  document.body.replaceChildren()
  const { place, reads } = placerHolding()
  const shown = card()
  document.body.append(shown.element)
  await placing(place, shown, 'XXXXXXXXXXX', shown.number, document, 1)
  const readsBefore = reads()

  const kept = await placing(place, shown, 'XXXXXXXXXXX', shown.number, document, 2)

  expect(reads()).toBe(readsBefore)
  expect(kept).toEqual(shownFrom(true))
})

describe('a pass whose element Studio takes away while a read is out', () => {
  const videoId = 'XXXXXXXXXXX'
  /**
   * Places on `shown`, a card on the page, the background answering `read` after `whileReading`
   * runs, the comparison, when `compared` is given, answering it after `whileComparing` runs, and
   * the figure drawn after `figureAfter`, the card's Views number by default.
   */
  function placeWhile(
    shown: ReturnType<typeof card>,
    {
      read,
      whileReading = () => {},
      compared,
      whileComparing = () => {},
      figureAfter,
    }: {
      read: VideosRead
      whileReading?: () => void
      compared?: { fromCache: boolean }
      whileComparing?: () => void
      figureAfter?: Element
    },
  ) {
    const ask = (async (request: BackgroundRequest) => {
      if (request.type !== 'read-videos') return true
      whileReading()
      return read
    }) as AskBackground
    const place = videoRowPlacer('analytics', {
      ask,
      origin: 'https://stillstats.example',
      locale: 'en-GB',
      lineClicks: lineClicks(ask),
    })
    return place({
      document,
      navigation: 1,
      after: shown.header,
      standsOn: shown.number,
      root: document,
      youtubeChannelId: 'UC8mOjhMBTyPPScCF9vYtwFg',
      videoId,
      window: 'lifetime',
      current: () => true,
      render(view) {
        if (view.view.kind === 'nothing') return []
        const host = document.createElement('div')
        host.setAttribute('data-stillstats-surface', 'analytics')
        return [{ host, after: figureAfter ?? shown.number }]
      },
      ...(compared
        ? {
            comparisonOf: async () => {
              whileComparing()
              return { comparison: undefined, fromCache: compared.fromCache }
            },
          }
        : {}),
    })
  }

  /** A card on the page for the test, taken off it after. */
  function cardOnThePage() {
    const shown = card()
    document.body.append(shown.element)
    onTestFinished(() => shown.element.remove())
    return shown
  }

  test('a header Studio takes away during the read answers a redraw, with the read cache result', async () => {
    const shown = cardOnThePage()

    const answer = await placeWhile(shown, {
      read: readOf(videoId, true),
      whileReading: () => shown.header.remove(),
    })

    expect(answer).toEqual(redrawnFrom(true, 'not-found'))
  })

  test('a header Studio takes away during a read that failed answers not found, no redraw', async () => {
    const shown = cardOnThePage()

    const answer = await placeWhile(shown, {
      read: { state: 'failed' },
      whileReading: () => shown.header.remove(),
    })

    expect(answer).toBe('not-found')
  })

  test('a header Studio takes away during the comparison read answers a redraw, from the cache only when both reads were', async () => {
    const shown = cardOnThePage()

    const answer = await placeWhile(shown, {
      read: readOf(videoId, true),
      compared: { fromCache: false },
      whileComparing: () => shown.header.remove(),
    })

    expect(answer).toEqual(redrawnFrom(false, 'not-found'))
  })

  test('a figure whose element Studio took away before it was drawn answers a redraw, from the cache only when both reads were', async () => {
    const shown = cardOnThePage()

    const answer = await placeWhile(shown, {
      read: readOf(videoId, true),
      compared: { fromCache: false },
      figureAfter: document.createElement('div'),
    })

    expect(answer).toEqual(redrawnFrom(false, 'not-found'))
  })
})
