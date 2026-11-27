// @vitest-environment happy-dom
// Pre-PR review 1 of creator-analytics#637, findings 1 and 2. The harness is
// apps/web/src/youtube-player.test.ts's fake `window.YT`, copied. Each test states the correct
// behaviour, so it is red while the defect stands.
import { beforeAll, beforeEach, expect, test, vi } from 'vitest'

interface FakeYouTubePlayer {
  events: { onReady: () => void }
  destroy: ReturnType<typeof vi.fn>
}

let players: FakeYouTubePlayer[]

function installFakeYouTube(): void {
  players = []
  class Player {
    constructor(_frame: HTMLIFrameElement, { events }: { events: FakeYouTubePlayer['events'] }) {
      players.push({ events, destroy: vi.fn() })
      // biome-ignore lint/correctness/noConstructorReturn: the fake hands back its recording.
      return players.at(-1) as unknown as Player
    }
  }
  window.YT = { Player } as unknown as NonNullable<Window['YT']>
}

async function playerModule() {
  vi.resetModules()
  return import('../../../../apps/web/src/youtube-player.ts')
}

async function apiLoaded(): Promise<void> {
  window.onYouTubeIframeAPIReady?.()
  await Promise.resolve()
  await Promise.resolve()
}

const options = { videoId: 'ANIQ6TTkj70', startSeconds: 0, frameTitle: 'Video player: How I edit' }

beforeAll(() => {
  ;(
    window as unknown as { happyDOM: { settings: { handleDisabledFileLoadingAsSuccess: boolean } } }
  ).happyDOM.settings.handleDisabledFileLoadingAsSuccess = true
})

beforeEach(() => {
  document.head.replaceChildren()
  document.body.replaceChildren()
  window.onYouTubeIframeAPIReady = undefined
  installFakeYouTube()
})

test('finding 1: a player destroyed after the API loads but before it is ready is destroyed on YouTube too', async () => {
  const { createVideoPlayer } = await playerModule()
  const player = createVideoPlayer(
    document.body.appendChild(document.createElement('div')),
    options,
  )
  await apiLoaded()
  player.destroy()

  expect(players[0]?.destroy).toHaveBeenCalledTimes(1)
})

test('finding 2: an IFrame API script that fails to load reports a player error', async () => {
  const { createVideoPlayer } = await playerModule()
  const onError = vi.fn()
  createVideoPlayer(document.body.appendChild(document.createElement('div')), {
    ...options,
    events: { onError },
  })
  const script = [...document.querySelectorAll('script')].find((each) =>
    each.src.includes('iframe_api'),
  )
  script?.dispatchEvent(new Event('error'))
  await Promise.resolve()
  await Promise.resolve()

  expect(onError).toHaveBeenCalled()
})
