import * as Sentry from '@sentry/node'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { errorTrackingReporter, initErrorTracking } from './index.ts'
import { createLogger } from './logger.ts'
import { accessToken, channelId, recordingTransport, views } from './test-support.ts'

// The recording transport stands where the SDK's HTTP transport would, so these tests observe what
// would leave the process. They cover only that the scrubbing hook is installed and runs on it;
// scrub.test.ts holds the rules the hook applies. They do not observe GlitchTip itself: a report
// reaching a live GlitchTip project is checked by hand after #21 provisions it.

const dsn = 'https://publickey@glitchtip.example.com/1'

/** The events in the envelopes. An envelope line can also hold source lines around a frame. */
function sentEvents(envelopes: string[]): Sentry.ErrorEvent[] {
  return envelopes.flatMap((envelope) => {
    const lines = envelope.split('\n')
    const at = lines.indexOf('{"type":"event"}')
    return at === -1 ? [] : [JSON.parse(lines[at + 1] ?? '{}')]
  })
}

const silentLogger = createLogger(() => {})

afterEach(async () => {
  vi.unstubAllEnvs()
  await Sentry.close()
})

describe('the GlitchTip reporter', () => {
  test('a report reaches the transport only through the scrubbing hook', async () => {
    const { envelopes, transport } = recordingTransport()
    initErrorTracking({ dsn, transport })

    errorTrackingReporter(silentLogger).report({
      message: `refresh failed for Bearer ${accessToken}`,
      context: { channelId, views },
    })
    await Sentry.flush(2000)

    const [event] = sentEvents(envelopes)
    expect(event?.message).toBe('refresh failed for Bearer [token]')
    expect(event?.extra).toEqual({ channelId })
    expect(envelopes.join('\n')).not.toContain(accessToken)
  })

  test("a report's error reaches the transport as its cause, through the scrubbing hook", async () => {
    const { envelopes, transport } = recordingTransport()
    initErrorTracking({ dsn, transport })

    errorTrackingReporter(silentLogger).report({
      message: 'pg-boss reported an error',
      error: new Error(`Google answered 401 to Bearer ${accessToken}`),
    })
    await Sentry.flush(2000)

    const values = sentEvents(envelopes)
      .flatMap((event) => event.exception?.values ?? [])
      .map(({ value }) => value)
    expect(values).toContain('pg-boss reported an error')
    expect(values).toContain('Google answered 401 to Bearer [token]')
    expect(envelopes.join('\n')).not.toContain(accessToken)
  })

  test('a report carries the environment and the release error tracking started with', async () => {
    const { envelopes, transport } = recordingTransport()
    initErrorTracking({ dsn, transport, environment: 'staging', release: '2026.11.9.1' })

    errorTrackingReporter(silentLogger).report({ message: 'a refresh failed' })
    await Sentry.flush(2000)

    const [event] = sentEvents(envelopes)
    expect({ environment: event?.environment, release: event?.release }).toEqual({
      environment: 'staging',
      release: '2026.11.9.1',
    })
  })

  // Limits: the SDK reads a release of its own from SENTRY_RELEASE or a CI or host commit variable
  // such as GITHUB_SHA. The test clears the two it can meet, so it holds the reporter's rule and not
  // the SDK's detection.
  test('with no release given, the reporter adds none of its own', async () => {
    vi.stubEnv('GITHUB_SHA', '')
    vi.stubEnv('SENTRY_RELEASE', '')
    const { envelopes, transport } = recordingTransport()
    initErrorTracking({ dsn, transport, environment: 'production' })

    errorTrackingReporter(silentLogger).report({ message: 'a refresh failed' })
    await Sentry.flush(2000)

    const [event] = sentEvents(envelopes)
    expect(event).toBeDefined()
    expect(event?.release).toBeUndefined()
  })

  test('with no DSN, a report sends nothing', async () => {
    const { envelopes, transport } = recordingTransport()
    initErrorTracking({ dsn: undefined, transport })

    errorTrackingReporter(silentLogger).report({
      message: 'a deletion is incomplete',
      context: { channelId },
    })
    await Sentry.flush(2000)

    expect(envelopes).toEqual([])
  })
})
