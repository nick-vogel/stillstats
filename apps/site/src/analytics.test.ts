// @vitest-environment happy-dom
// Limits: OpenPanel's SDK is mocked, so these tests show what the page hands the client for a tool
// event, not that the event reaches the self-hosted project; Nick checks that in OpenPanel on the
// deployed product. main.test.ts holds how the client is built, which this module now owns.
import type { ClientSettingsAnswer } from '@creator-analytics/api-types'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('@openpanel/web', () => ({
  OpenPanel: vi.fn(
    class {
      track = vi.fn(async () => {})
    },
  ),
}))

const clientSettings: ClientSettingsAnswer = {
  environment: 'production',
  version: '2026.11.9',
  commit: 'abc1234',
  releasePath: '/releases/2026.11.9',
  openPanelClientId: 'a-site-client-id',
}

/** Lets every settled promise run its callbacks. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

/** analytics.ts loaded afresh with GET /api/client-settings answering `settings`. */
async function analyticsWith(settings: ClientSettingsAnswer) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json(settings)),
  )
  vi.resetModules()
  const analytics = await import('./analytics.ts')
  const { OpenPanel } = await import('@openpanel/web')
  return { ...analytics, built: vi.mocked(OpenPanel) }
}

beforeEach(() => {
  vi.stubEnv('VITE_OPENPANEL_API_URL', 'https://openpanel.invalid')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe("the tool's events", () => {
  test('a thumbnail_load reaches the client with its name and properties unchanged', async () => {
    const { sendToolEvent, built } = await analyticsWith(clientSettings)

    sendToolEvent({
      name: 'thumbnail_load',
      properties: { slot: 'a', mode: 'landscape', detected: false, source: 'picker' },
    })
    await settle()

    expect(vi.mocked(built.mock.instances[0]?.track)?.mock.calls).toEqual([
      ['thumbnail_load', { slot: 'a', mode: 'landscape', detected: false, source: 'picker' }],
    ])
  })

  test('with no client ID in the settings, an event builds no client and throws nothing', async () => {
    const { sendToolEvent, built } = await analyticsWith({
      ...clientSettings,
      openPanelClientId: null,
    })

    sendToolEvent({ name: 'thumbnail_title_entered', properties: { slot: 'b' } })
    await settle()

    expect(built.mock.calls).toEqual([])
  })
})
