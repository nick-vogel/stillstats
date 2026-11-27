import * as Sentry from '@sentry/node'
import { expect, test, vi } from 'vitest'
import { initErrorTracking } from './index.ts'
import { recordingTransport } from './test-support.ts'

// Its own file, so the SDK starts in a fresh worker. After another test's init and close in the
// same file, this test passed with sessions still on.

test('the process records no session, which GlitchTip does not accept', async () => {
  // The SDK sends a session only with a release, which it reads from Railway's commit sha.
  vi.stubEnv('RAILWAY_GIT_COMMIT_SHA', '09014ed')
  const { envelopes, transport } = recordingTransport()
  initErrorTracking({ dsn: 'https://publickey@glitchtip.example.com/1', transport })

  // An exception marks a recorded session as errored, which sends that session at once.
  Sentry.captureException(new Error('the job failed'))
  await Sentry.flush(2000)

  expect(envelopes.join('\n')).toContain('"type":"event"')
  expect(envelopes.join('\n')).not.toContain('"type":"session"')
})
