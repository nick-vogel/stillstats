// @vitest-environment jsdom
// Pre-PR review 9 of creator-analytics#4, finding 2. Each test states the correct behaviour, so it
// is red until the finding is fixed: before the placer reads, nothing it placed for another video
// stays up, and no shown figure stays beside a number Studio has taken away, whichever of its
// placements, the one held by this element or its last one, those hosts belong to. The page here
// is a minimal stand-in for the analytics page's shape: a card holding a header and a Views tile
// with its number row, the line before the card and the figure after the number row.
import { expect, test } from 'vitest'
import type { AskBackground, BackgroundRequest } from '../../../../apps/extension/src/messages.ts'
import type { VideosRead } from '../../../../apps/extension/src/product-api.ts'
import { lineClicks } from '../../../../apps/extension/src/surfaces/line-clicks.ts'
import {
  type PlacedHost,
  videoRowPlacer,
} from '../../../../apps/extension/src/surfaces/video-row.ts'
import type { VideoListAnswer, VideoRow } from '../../../../packages/api-types/src/index.ts'

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
const readOf = (id: string): VideosRead => {
  const answer: VideoListAnswer = {
    videos: [videoOf(id)],
    window: 'lifetime',
    page: 1,
    pageSize: 1,
    pageCount: 1,
    lastProcessedDay: '2026-10-07',
    creationDay: null,
    fetchedAt: '2026-10-10T12:00:00Z',
    fromCache: false,
  }
  return { state: 'read', channelId: 'channel-1', answer }
}

function placerHolding() {
  let held = false
  const ask = (async (request: BackgroundRequest) => {
    if (request.type !== 'read-videos') return true
    if (held) return new Promise<VideosRead>(() => {})
    return readOf('ids' in request ? (request.ids[0] ?? '') : '')
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

function placing(
  place: ReturnType<typeof placerHolding>['place'],
  shown: ReturnType<typeof card>,
  videoId: string,
  standsOn: Element | undefined,
) {
  return place({
    document,
    after: shown.header,
    ...(standsOn ? { standsOn } : {}),
    root: document,
    youtubeChannelId: 'UC8mOjhMBTyPPScCF9vYtwFg',
    videoId,
    window: 'lifetime',
    current: () => true,
    render() {
      const host = (kind: string) => {
        const element = document.createElement('div')
        element.setAttribute('data-stillstats-surface', 'analytics')
        element.dataset.kind = kind
        element.dataset.video = videoId
        return element
      }
      const line: PlacedHost = { host: host('line'), before: shown.element }
      return standsOn ? [{ host: host('figure'), after: standsOn }, line] : [line]
    },
  })
}

const up = () =>
  [...document.querySelectorAll<HTMLElement>('[data-stillstats-surface="analytics"]')].map(
    (host) => `${host.dataset.kind}:${host.dataset.video}`,
  )
const settle = async () => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve()
}

test('finding 2: Studio putting back an earlier card for an earlier video leaves nothing of the video shown since while the read is out', async () => {
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

  expect(up().filter((host) => host.endsWith('YYYYYYYYYYY'))).toEqual([])
})

test('finding 2: Studio drawing a new header and taking the Views number away in one render leaves no figure in the tile while the read is out', async () => {
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
