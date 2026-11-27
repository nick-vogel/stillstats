// @vitest-environment happy-dom
// Pre-PR review 2 of creator-analytics#637, finding 1. The harness is
// apps/web/src/video-player.test.ts's, copied in part with its paths pointed at apps/web/src. The
// test states the correct behaviour, so it is red while the defect stands.
import type { AudienceRetentionPoint, VideoRow } from '@creator-analytics/api-types'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act } from '../../../../apps/web/node_modules/react/index.js'
import {
  fakeChannel,
  fakeVideo,
  installFakeApi,
  type RenderedApp,
  renderApp,
  settle,
} from '../../../../apps/web/src/fake-api.ts'
import { fakePlayers, resetFakePlayers } from '../../../../apps/web/src/fake-youtube-player.ts'

vi.mock('../../../../apps/web/src/analytics.ts', () => ({ track: vi.fn() }))
vi.mock(
  '../../../../apps/web/src/youtube-player.ts',
  () => import('../../../../apps/web/src/fake-youtube-player.ts'),
)

let rendered: RenderedApp | null = null

const videos: VideoRow[] = [
  fakeVideo,
  { ...fakeVideo, id: 'video-2', title: 'Another video' },
  { ...fakeVideo, id: 'video-3', title: 'A third video' },
].map((video) => ({
  ...video,
  thumbnailUrl: `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`,
  thumbnails: [],
}))

const curve: AudienceRetentionPoint[] = [
  { elapsedVideoTimeRatio: 0.05, audienceWatchRatio: 1, relativeRetentionPerformance: 0.5 },
  { elapsedVideoTimeRatio: 1, audienceWatchRatio: 0.4, relativeRetentionPerformance: 0.5 },
]

beforeEach(() => resetFakePlayers())

afterEach(() => {
  rendered?.unmount()
  rendered = null
  vi.unstubAllGlobals()
})

test('a step from a video that cannot play to one whose answer holds no retention curve creates no YouTube player', async () => {
  const api = installFakeApi()
  api.videos = videos
  api.retention = curve
  api.playability = { 'video-2': { embeddable: false } }
  rendered = await renderApp('videos/video-2')
  expect(fakePlayers).toEqual([])

  const read = api.hold(`GET /api/channels/${fakeChannel.id}/videos/video-3`)
  api.retention = []
  const link = rendered.container.querySelector<HTMLAnchorElement>(
    'a[aria-label="Older video: A third video"]',
  )
  if (!link) throw new Error('No Older video link')
  await act(async () => link.click())
  await settle()
  const createdDuringRead = fakePlayers.map((player) => player.videoId)
  await act(async () => read.release())
  await settle()

  expect({
    createdDuringRead,
    boxAfterAnswer: rendered.container.querySelector('.video-player') !== null,
  }).toEqual({ createdDuringRead: [], boxAfterAnswer: false })
})
