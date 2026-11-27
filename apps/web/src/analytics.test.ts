// @vitest-environment happy-dom
// Limits: OpenPanel's SDK is mocked, so these tests show which client the web app builds and what
// it hands it, not that an event reaches the self-hosted project; Nick checks that in OpenPanel
// after a deploy. The client settings come from the fake API, as the API answers them.
import type { OpenPanel } from '@openpanel/web'
import { afterEach, beforeEach, describe, expect, onTestFinished, test, vi } from 'vitest'
import { installFakeApi } from './fake-api.ts'

vi.mock('@openpanel/web', () => ({
  OpenPanel: vi.fn(
    class {
      track = vi.fn(async () => {})
    },
  ),
}))

const apiUrl = 'https://openpanel.invalid'

/** The web app's analytics, loaded afresh, as a page load does, with OpenPanel's mocked client. */
async function loadAnalytics() {
  vi.resetModules()
  // One at a time: imported together, the mocked SDK can load twice, once for each importer.
  const analytics = await import('./analytics.ts')
  const client = await import('@openpanel/web')
  const settings = await import('./client-settings.ts')
  const timing = await import('./screen-timing.ts')
  const built = vi.mocked(client.OpenPanel)
  const started = async () => analytics.startAnalytics(await settings.readClientSettings())
  return { ...analytics, built, started, timing }
}

/**
 * Starts the screen timing on a page whose clock reads `ms` and whose first input comes when the
 * test calls it, with one LCP candidate at 1200ms, and answers that input.
 */
function startTimingAt(
  { startScreenTiming }: typeof import('./screen-timing.ts'),
  ms: number,
): () => void {
  const page = new EventTarget()
  const stop = startScreenTiming({
    now: () => ms,
    observe: (type, onEntries) => {
      if (type === 'largest-contentful-paint') onEntries([{ startTime: 1200, duration: 0 }])
      return () => {}
    },
    document: Object.assign(page, { visibilityState: 'visible' as const }),
  })
  onTestFinished(stop)
  return () => page.dispatchEvent(new Event('pointerdown'))
}

function tracksOf(built: ReturnType<typeof vi.mocked<typeof OpenPanel>>) {
  return built.mock.instances.flatMap((panel) => vi.mocked(panel.track).mock.calls)
}

beforeEach(() => {
  vi.stubEnv('VITE_OPENPANEL_API_URL', apiUrl)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("the web app's OpenPanel client", () => {
  test("starts once, with the client ID from the client settings and the build's API URL", async () => {
    const api = installFakeApi()
    api.clientSettings = { ...api.clientSettings, openPanelClientId: 'a-staging-client-id' }
    const { built, started } = await loadAnalytics()

    await started()
    await started()

    expect(built.mock.calls).toEqual([[{ clientId: 'a-staging-client-id', apiUrl }]])
  })

  test('sends each event to the client it started', async () => {
    installFakeApi()
    const { built, started, track } = await loadAnalytics()
    await started()

    track({ name: 'settings_opened' })

    expect(tracksOf(built)).toEqual([['settings_opened', {}]])
  })

  test('is never built when the client settings carry no client ID', async () => {
    const api = installFakeApi()
    api.clientSettings = { ...api.clientSettings, openPanelClientId: null }
    const { built, started } = await loadAnalytics()

    await started()

    expect(built).not.toHaveBeenCalled()
  })

  test('is never built when the client settings cannot be read', async () => {
    const api = installFakeApi()
    api.failNext('GET /api/client-settings')
    const { built, started } = await loadAnalytics()

    await started()

    expect(built).not.toHaveBeenCalled()
  })

  test('is never built when the build names no OpenPanel API, which would send to its cloud', async () => {
    vi.stubEnv('VITE_OPENPANEL_API_URL', '')
    installFakeApi()
    const { built, started } = await loadAnalytics()

    await started()

    expect(built).not.toHaveBeenCalled()
  })

  test('an event before the client starts is sent nowhere', async () => {
    installFakeApi()
    const { built, started, track } = await loadAnalytics()

    track({ name: 'settings_opened' })
    await started()

    expect(tracksOf(built)).toEqual([])
  })

  test("a budget screen's web vital and answer shown reach the client it started", async () => {
    installFakeApi()
    const { built, started, timing } = await loadAnalytics()
    await started()
    const input = startTimingAt(timing, 1840)

    timing.screenShown('/app/audience')
    timing.answerShown('/app/audience', 'last28', 'hit')
    input()

    expect(tracksOf(built)).toEqual([
      [
        'answer_shown',
        { screen: '/app/audience', trigger: 'load', window: 'last28', cache: 'hit', ms: 1840 },
      ],
      ['web_vital', { metric: 'LCP', value: 1200, screen: '/app/audience' }],
    ])
  })

  test('a timing event before the client starts is sent nowhere', async () => {
    installFakeApi()
    const { built, started, timing } = await loadAnalytics()
    const input = startTimingAt(timing, 1840)

    timing.screenShown('/app/')
    timing.answerShown('/app/', 'last28', 'miss')
    input()
    await started()

    expect(tracksOf(built)).toEqual([])
  })
})
