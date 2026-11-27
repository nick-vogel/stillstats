// @vitest-environment happy-dom
// Limits: a recording transport stands where the SDK's fetch transport would, so these tests see
// what would leave the page, not that GlitchTip files it under its environment and release; Nick
// checks that in GlitchTip after a deploy.
import * as Sentry from '@sentry/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { startErrorReporting } from './error-reporting.ts'
import { installFakeApi } from './fake-api.ts'

function recordingTransport() {
  const envelopes: string[] = []
  const transport: Sentry.BrowserOptions['transport'] = (options) =>
    Sentry.createTransport(options, async ({ body }) => {
      envelopes.push(typeof body === 'string' ? body : new TextDecoder().decode(body))
      return { statusCode: 200 }
    })
  return { envelopes, transport }
}

function sentEvents(envelopes: string[]): Sentry.ErrorEvent[] {
  return envelopes.flatMap((envelope) => {
    const lines = envelope.split('\n')
    const at = lines.findIndex((line) => line.startsWith('{"type":"event"'))
    return at === -1 ? [] : [JSON.parse(lines[at + 1] ?? '{}')]
  })
}

beforeEach(() => {
  vi.stubEnv('VITE_GLITCHTIP_DSN', 'https://publickey@glitchtip.invalid/1')
})

afterEach(async () => {
  await Sentry.close()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("the web app's error reports", () => {
  test('carry the environment and the version from the client settings, as the release', async () => {
    const api = installFakeApi()
    api.clientSettings = { ...api.clientSettings, environment: 'staging', version: '2026.11.9.1' }
    const { readClientSettings } = await import('./client-settings.ts')
    const { envelopes, transport } = recordingTransport()

    startErrorReporting(await readClientSettings(), transport)
    Sentry.captureException(new Error('a chart failed to draw'))
    await Sentry.flush(2000)

    const [event] = sentEvents(envelopes)
    expect({ environment: event?.environment, release: event?.release }).toEqual({
      environment: 'staging',
      release: '2026.11.9.1',
    })
  })

  test('carry no release when the client settings could not be read', async () => {
    const api = installFakeApi()
    api.failNext('GET /api/client-settings')
    const { readClientSettings } = await import('./client-settings.ts')
    const { envelopes, transport } = recordingTransport()

    startErrorReporting(await readClientSettings(), transport)
    Sentry.captureException(new Error('a chart failed to draw'))
    await Sentry.flush(2000)

    const [event] = sentEvents(envelopes)
    expect(event).toBeDefined()
    expect(event?.release).toBeUndefined()
  })
})
