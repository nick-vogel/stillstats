// @vitest-environment jsdom
// Pre-PR review 10 of creator-analytics#4, findings 1 and 2. Each test states the correct
// behaviour, so it is red until the finding is fixed: a kept placement never leaves a shown figure
// of the same read beside a Views number Studio has since redrawn or taken away, and no placement
// the placer holds for another video stays up while the next read is out, whichever placement the
// placer last made. The page here is a minimal stand-in for the analytics page's shape: a card
// holding a header and a Views tile with its number row, the line before the card and the figure
// after the number row. Whether real Studio redraws this way is the mutation recording in #99.
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

function harness() {
  let held = false
  const leftOut = new Set<string>()
  let reads = 0
  const ask = (async (request: BackgroundRequest) => {
    if (request.type !== 'read-videos') return true
    reads += 1
    if (held) return new Promise<VideosRead>(() => {})
    const id = 'ids' in request ? (request.ids[0] ?? '') : ''
    return readOf(leftOut.has(id) ? 'ZZZZZZZZZZZ' : id)
  }) as AskBackground
  const place = videoRowPlacer('analytics', {
    ask,
    origin: 'https://stillstats.example',
    locale: 'en-GB',
    lineClicks: lineClicks(ask),
  })
  const placing = (
    card: Element,
    header: Element,
    videoId: string,
    standsOn: Element | undefined,
  ) =>
    place({
      document,
      after: header,
      ...(standsOn ? { standsOn } : {}),
      root: document,
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
        const line: PlacedHost = { host: host('line'), before: card }
        return standsOn ? [{ host: host('figure'), after: standsOn }, line] : [line]
      },
    })
  return {
    placing,
    holdReads: () => {
      held = true
    },
    leaveOut: (id: string) => leftOut.add(id),
    letIn: (id: string) => leftOut.delete(id),
    reads: () => reads,
  }
}

const up = () =>
  [...document.querySelectorAll<HTMLElement>('[data-stillstats-surface="analytics"]')].map(
    (host) => `${host.dataset.kind}:${host.dataset.video}`,
  )
const settle = async () => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve()
}
const div = () => document.createElement('div')

function cardWithHostlessX() {
  document.body.replaceChildren()
  const h = harness()
  const card = div()
  const tile = div()
  const h1 = div()
  const n1 = div()
  tile.append(n1)
  card.append(h1, tile)
  document.body.append(card)
  return { h, card, tile, h1, n1 }
}

test('finding 1: Studio putting back a header whose read showed nothing, beside its old Views number, leaves no figure beside that number', async () => {
  const { h, card, h1, n1 } = cardWithHostlessX()
  h.leaveOut('XXXXXXXXXXX')
  expect(await h.placing(card, h1, 'XXXXXXXXXXX', n1)).toBe('placed')
  expect(up()).toEqual([])
  h.letIn('XXXXXXXXXXX')
  const h2 = div()
  const n2 = div()
  h1.replaceWith(h2)
  n1.replaceWith(n2)
  expect(await h.placing(card, h2, 'XXXXXXXXXXX', n2)).toBe('shown')
  expect(up()).toEqual(['line:XXXXXXXXXXX', 'figure:XXXXXXXXXXX'])

  h2.replaceWith(h1)
  n2.replaceWith(n1)
  h.holdReads()
  void h.placing(card, h1, 'XXXXXXXXXXX', n1)
  await settle()

  expect(up()).toEqual(['line:XXXXXXXXXXX'])
})

test('finding 1: Studio putting back a header whose read showed nothing, with no Views number, leaves no figure in the tile', async () => {
  const { h, card, h1, n1 } = cardWithHostlessX()
  h.leaveOut('XXXXXXXXXXX')
  await h.placing(card, h1, 'XXXXXXXXXXX', n1)
  h.letIn('XXXXXXXXXXX')
  const h2 = div()
  const n2 = div()
  h1.replaceWith(h2)
  n1.replaceWith(n2)
  await h.placing(card, h2, 'XXXXXXXXXXX', n2)

  h2.replaceWith(h1)
  n2.remove()
  h.holdReads()
  void h.placing(card, h1, 'XXXXXXXXXXX', undefined)
  await settle()

  expect(up()).toEqual(['line:XXXXXXXXXXX'])
})

test('finding 2: after a kept placement, a new card for another video leaves nothing of the kept video up while the read is out', async () => {
  document.body.replaceChildren()
  const h = harness()
  const container = () => {
    const outer = div()
    const card = div()
    const header = div()
    const tile = div()
    const number = div()
    tile.append(number)
    card.append(header, tile)
    outer.append(card)
    return { outer, card, header, number }
  }
  const one = container()
  document.body.append(one.outer)
  await h.placing(one.card, one.header, 'XXXXXXXXXXX', undefined)
  expect(up()).toEqual(['line:XXXXXXXXXXX'])
  const two = container()
  one.outer.replaceWith(two.outer)
  await h.placing(two.card, two.header, 'XXXXXXXXXXX', two.number)
  const three = container()
  two.outer.replaceWith(three.outer)
  await h.placing(three.card, three.header, 'YYYYYYYYYYY', three.number)
  expect(up()).toEqual(['line:YYYYYYYYYYY', 'figure:YYYYYYYYYYY'])
  three.outer.replaceWith(one.outer)
  expect(await h.placing(one.card, one.header, 'XXXXXXXXXXX', undefined)).toBe('shown')
  expect(up()).toEqual(['line:XXXXXXXXXXX'])

  const five = container()
  one.card.replaceWith(five.card)
  h.holdReads()
  void h.placing(five.card, five.header, 'YYYYYYYYYYY', five.number)
  await settle()

  expect(up()).toEqual([])
})
