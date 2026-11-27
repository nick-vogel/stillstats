// @vitest-environment happy-dom
// Pre-PR review 1 of creator-analytics#637, findings 3 and 4. The harness is
// apps/web/src/video-player.test.ts's, copied in part with its paths pointed at apps/web/src. Each
// test states the correct behaviour, so it is red while the defect stands.
import type { AudienceRetentionPoint, VideoRow } from '@creator-analytics/api-types'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act } from '../../../../apps/web/node_modules/react/index.js'
import { chartLabelOf } from '../../../../apps/web/src/chart-slider.ts'
import {
  fakeVideo,
  installFakeApi,
  type RenderedApp,
  renderApp,
  settle,
} from '../../../../apps/web/src/fake-api.ts'
import { resetFakePlayers } from '../../../../apps/web/src/fake-youtube-player.ts'
import { playerMoveText } from '../../../../apps/web/src/video-player.ts'

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

// fakeVideo's 754 seconds: the point at 0.11 moves the player to 80 seconds, 1:20.
const moveCurve: AudienceRetentionPoint[] = [
  { elapsedVideoTimeRatio: 0.01, audienceWatchRatio: 1, relativeRetentionPerformance: 0.5 },
  { elapsedVideoTimeRatio: 0.11, audienceWatchRatio: 0.8, relativeRetentionPerformance: 0.6 },
  { elapsedVideoTimeRatio: 1, audienceWatchRatio: 0.4, relativeRetentionPerformance: 0.5 },
]

async function click(element: HTMLElement): Promise<void> {
  await act(async () => element.click())
  await settle()
}

function link(container: HTMLElement, label: string): HTMLAnchorElement {
  const found = container.querySelector<HTMLAnchorElement>(`a[aria-label="${label}"]`)
  if (!found) throw new Error(`No link labelled ${label}`)
  return found
}

function startLines(container: HTMLElement): string[] {
  return [...container.querySelectorAll('.video-player-load p')]
    .map(({ textContent }) => textContent ?? '')
    .filter((line) => line.startsWith('Starts at'))
}

function watchingPlot(container: HTMLElement): HTMLElement {
  const plot = container.querySelector<HTMLElement>(
    `[role="slider"][aria-label="${chartLabelOf('Audience retention', playerMoveText.moveSentence)}"]`,
  )
  if (!plot) throw new Error('No audience retention plot')
  return plot
}

async function keyOn(plot: HTMLElement, key: string): Promise<void> {
  await act(async () => plot.focus())
  await act(async () => {
    plot.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  })
  await settle()
}

function spokenBeside(plot: HTMLElement): string {
  return (
    plot.parentElement?.querySelector('p.visually-hidden[aria-live="polite"] > span')
      ?.textContent ?? ''
  )
}

beforeEach(() => resetFakePlayers())

afterEach(() => {
  rendered?.unmount()
  rendered = null
})

test('finding 3: a step away and back to a video shows no start time from before the step', async () => {
  const api = installFakeApi()
  api.videos = videos
  api.retention = moveCurve
  rendered = await renderApp('videos/video-2')
  const { container } = rendered
  const svg = container.querySelector(
    `[role="slider"][aria-label="${chartLabelOf('Audience retention', playerMoveText.moveSentence)}"] .cursor-plot-chart svg`,
  )
  if (!svg) throw new Error('No library svg in the plot')
  await act(async () => {
    svg.dispatchEvent(
      new PointerEvent('click', {
        pointerType: 'mouse',
        bubbles: true,
        clientX: 640 * 0.11,
        clientY: 160,
      }),
    )
  })
  await settle()
  expect(startLines(container)).toEqual(['Starts at 1:20'])

  await click(link(container, 'Older video: A third video'))
  expect(startLines(container)).toEqual([])
  await click(link(container, 'Newer video: Another video'))

  expect(startLines(container)).toEqual([])
})

test('finding 4: Home on the first point after Enter reads the point again', async () => {
  const api = installFakeApi()
  api.videos = videos
  api.retention = moveCurve
  rendered = await renderApp('videos/video-2')
  const watching = watchingPlot(rendered.container)
  await keyOn(watching, 'Home')
  const reading = spokenBeside(watching)
  await keyOn(watching, 'Enter')
  expect(spokenBeside(watching)).toBe('Video player starts at 0:05.')
  await keyOn(watching, 'Home')

  expect(spokenBeside(watching)).toBe(reading)
})
