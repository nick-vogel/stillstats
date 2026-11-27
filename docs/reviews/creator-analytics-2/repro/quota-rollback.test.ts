// Repro: an unanswered FIRST call of a later read, in a request that already had an answered read,
// throws out of gateway.read(), rolls back the request's transaction (asUser), and with it the
// quota_usage units Google answered and charged for the earlier read.
import { randomBytes } from 'node:crypto'
import { once } from 'node:events'
import { mkdtemp, writeFile } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { serve } from '@hono/node-server'
import type { Hono } from 'hono'
import { describe, expect, onTestFinished } from 'vitest'
import { createApi } from '../../../../apps/api/src/app.ts'
import { createModules } from '../../../../apps/api/src/modules.ts'
import { channelsOf, connect, signIn } from '../../../../apps/api/test/flows.ts'
import { createTestAuth, type StartedApi } from '../../../../apps/api/test/start-api.ts'
import { quotaUsage, type WebDatabase } from '../../../../packages/database/src/index.ts'
import { test } from '../../../../packages/database/test/harness.ts'
import { startFakeGoogle } from '../../../../packages/fake-google/src/index.ts'
import { createLogger, recordingReporter } from '../../../../packages/reporter/src/index.ts'
import { parseTokenKeys } from '../../../../packages/token-vault/src/index.ts'

/** start-api.ts's startApi, but the Analytics root can be pointed somewhere that never answers. */
async function startApiWith(database: WebDatabase, analyticsRoot?: string): Promise<StartedApi> {
  const google = await startFakeGoogle()
  onTestFinished(() => google.close())
  let app: Hono | undefined
  const server = serve({
    fetch: (request) => (app ? app.fetch(request) : new Response(null, { status: 503 })),
    port: 0,
  })
  onTestFinished(() => {
    server.close()
  })
  await once(server, 'listening')
  const origin = `http://localhost:${(server.address() as AddressInfo).port}`
  const auth = await createTestAuth(database, google, origin)
  const reporter = recordingReporter()
  const logs: string[] = []
  const logger = createLogger((_level, line) => logs.push(line))
  const modules = createModules({
    baseURL: origin,
    google: {
      clientId: google.clientId,
      clientSecret: google.clientSecret,
      authorizationEndpoint: google.authorizationEndpoint,
      tokenEndpoint: google.tokenEndpoint,
      revocationEndpoint: google.revocationEndpoint,
      riscConfigurationUrl: google.riscConfigurationUrl,
      youtubeRootUrls: {
        data: google.youtubeRootUrl,
        // Port 9 (discard) is closed: connection refused, a call Google never answered.
        analytics: analyticsRoot ?? google.youtubeRootUrl,
      },
    },
    keys: parseTokenKeys(`1:${randomBytes(32).toString('base64')}`),
    identifierKey: randomBytes(32).toString('base64'),
    reporter,
    logger,
  })
  const root = await mkdtemp(join(tmpdir(), 'repro-'))
  await writeFile(join(root, 'index.html'), '<!doctype html>')
  await writeFile(join(root, '404.html'), '<!doctype html>')
  app = createApi({ database, auth, ...modules, webRoot: root, siteRoot: root })
  return { origin, google, reporter, logs, app }
}

async function dataUnits(web: WebDatabase): Promise<number> {
  const rows = await web.asUser('quota-reader', (tx) =>
    tx.sql.select({ api: quotaUsage.api, units: quotaUsage.units }).from(quotaUsage),
  )
  return rows.find((row) => row.api === 'data')?.units ?? 0
}

const uploads = Array.from({ length: 3 }, (_, i) => ({
  videoId: `video-${i + 1}`,
  title: `Upload ${i + 1}`,
  publishedAt: new Date(Date.UTC(2024, 0, 2 + i, 15)).toISOString(),
  metrics: { engagedViews: 1, views: 2, averageViewPercentage: 40, subscribersGained: 1 },
}))

describe('quota units of an answered read survive a later read whose first call is unanswered', () => {
  test('GET /channels/:id/videos cold, Analytics unreachable: Data units Google answered stay recorded', async ({
    web,
  }) => {
    const api = await startApiWith(web, 'http://127.0.0.1:9/')
    const browser = await signIn(api, { sub: '9001', email: 'rb1@example.com', name: 'Rb One' })
    api.google.pickChannel('UC-rb1')
    api.google.setChannel('UC-rb1', { createdAt: '2019-03-01T06:00:00Z', uploads })
    await connect(browser)
    const { channels } = await channelsOf(browser)
    const channelId = channels[0]?.id as string

    const unitsBefore = await dataUnits(web)
    const requestsBefore = api.google.dataApiRequests.length
    const response = await browser.fetch(`/api/channels/${channelId}/videos`)
    const answeredDataCalls = api.google.dataApiRequests.length - requestsBefore
    const unitsAfter = await dataUnits(web)

    console.log('REPRO videos:', {
      status: response.status,
      answeredDataCalls,
      unitsBefore,
      unitsAfter,
      reported: api.reporter.reports.map((r) => r.message),
    })
    expect(answeredDataCalls).toBeGreaterThan(0)
    // Every uploads-read call costs 1 unit; Google answered them all, so they must stay recorded.
    expect(unitsAfter - unitsBefore).toBe(answeredDataCalls)
  })

  test('GET /channels with the name read unanswered: lists the channel (base made no Google call)', async ({
    web,
  }) => {
    const api = await startApiWith(web)
    const browser = await signIn(api, { sub: '9002', email: 'rb2@example.com', name: 'Rb Two' })
    api.google.pickChannel('UC-rb2')
    api.google.setChannel('UC-rb2', { createdAt: '2019-03-01T06:00:00Z', uploads })
    await connect(browser)
    api.google.dropDataApi('/youtube/v3/channels')

    const response = await browser.fetch('/api/channels')
    console.log('REPRO channels:', { status: response.status, body: await response.clone().text() })
    expect(response.status).toBe(200)
  })
})
