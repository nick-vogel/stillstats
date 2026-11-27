import { randomBytes } from 'node:crypto'
import {
  type Scoped,
  subscriptions,
  type WebDatabase,
  type WorkerDatabase,
} from '@creator-analytics/database'
import { test as databaseTest, seedUser } from '@creator-analytics/database/testing'
import { type FakeGoogle, startFakeGoogle } from '@creator-analytics/fake-google'
import {
  createLogger,
  type RecordingReporter,
  recordingReporter,
} from '@creator-analytics/reporter'
import { createRetention } from '@creator-analytics/retention-engine'
import {
  createConnectionAuthority,
  createTokenVault,
  parseTokenKeys,
  type TokenKeys,
  type TokenVault,
} from '@creator-analytics/token-vault'
import { createYouTubeGateway, type YouTubeGateway } from '@creator-analytics/youtube-gateway'
import { sql } from 'drizzle-orm'
import { onTestFinished } from 'vitest'
import { jobHandlers } from '../src/jobs.ts'

const creator = { sub: '104729', email: 'creator@example.com', name: 'A Creator' }
export const reachReportType = 'channel_reach_combined_a1'

/** The database fixtures, the fake Google server, token keys, a recording reporter, the lines the
 * gateway logs, the gateway at the fake, and the worker's handlers on it. */
export const test = databaseTest.extend<{
  $test: {
    google: FakeGoogle
    keys: TokenKeys
    reporter: RecordingReporter
    logs: string[]
    gateway: YouTubeGateway
    handlers: ReturnType<typeof jobHandlers>
  }
}>({
  // biome-ignore lint/correctness/noEmptyPattern: Vitest reads a fixture's dependencies from this pattern.
  google: async ({}, use) => {
    const google = await startFakeGoogle()
    onTestFinished(() => google.close())
    google.signInAs(creator)
    await use(google)
  },
  // biome-ignore lint/correctness/noEmptyPattern: as above.
  keys: async ({}, use) => use(parseTokenKeys(`1:${randomBytes(32).toString('base64')}`)),
  // biome-ignore lint/correctness/noEmptyPattern: as above.
  reporter: async ({}, use) => use(recordingReporter()),
  // biome-ignore lint/correctness/noEmptyPattern: as above.
  logs: async ({}, use) => use([]),
  // The gateway as worker.ts builds it: it holds the probe's Google client and token keys only,
  // and calls the fake Google server.
  gateway: async ({ google, keys, logs }, use) => {
    const { tokenEndpoint, clientId, clientSecret } = google
    await use(
      createYouTubeGateway({
        vault: createConnectionAuthority({
          google: { tokenEndpoint, clientId, clientSecret },
          keys,
        }),
        rootUrls: {
          data: google.youtubeRootUrl,
          analytics: google.youtubeRootUrl,
          reporting: google.youtubeRootUrl,
        },
        logger: createLogger((_level, line) => logs.push(line)),
      }),
    )
  },
  // The worker's handlers as worker.ts builds them.
  handlers: async ({ gateway, reporter }, use) => {
    await use(
      jobHandlers(
        createRetention({ deletionLogKey: 'key', reporter }),
        { probe: async () => {} },
        { relay: undefined, reporter },
        { gateway, reporter },
      ),
    )
  },
})

/** The API's token vault, which runs the consent the worker never does. */
function apiVault(google: FakeGoogle, keys: TokenKeys): TokenVault {
  return createTokenVault({
    google,
    redirectUri: 'http://localhost:3000/api/channels/connect/callback',
    keys,
    identifierKey: 'an identifier key',
    reporter: recordingReporter(),
  })
}

async function claim(tx: Scoped<'user'>, youtubeChannelId: string): Promise<string> {
  const result = await tx.sql.execute<{ channel_id: string }>(
    sql`select channel_id from claim_channel(${youtubeChannelId})`,
  )
  const channelId = result.rows[0]?.channel_id
  if (!channelId) throw new Error('The claim was refused')
  return channelId
}

/** A user connects the YouTube channel through Google's consent, as the API does. */
export async function connectedChannel(
  web: WebDatabase,
  google: FakeGoogle,
  keys: TokenKeys,
  userId: string,
  youtubeChannelId: string,
): Promise<string> {
  const vault = apiVault(google, keys)
  await seedUser(web, userId)
  google.pickChannel(youtubeChannelId)
  const { authorizationUrl } = await web.asUser(userId, (tx) =>
    vault.beginConsent(tx, { purpose: 'connect' }, { loginHint: creator.email }),
  )
  const redirect = await fetch(authorizationUrl, { redirect: 'manual' })
  const callback = new URL(redirect.headers.get('location') ?? '')
  return web.asUser(userId, async (tx) => {
    const completed = await vault.completeConsent(tx, Object.fromEntries(callback.searchParams))
    if (!completed.ok) throw new Error(`The consent was refused: ${completed.refusal}`)
    const channelId = await claim(tx, youtubeChannelId)
    await vault.attach(tx, channelId, { grant: completed.grant, youtubeChannelId })
    return channelId
  })
}

/** The channel subscribes to Stillstats Pro: its subscription is active. */
export async function subscribe(worker: WorkerDatabase, channelId: string): Promise<void> {
  await worker.forChannel(channelId, (tx) =>
    tx.sql.insert(subscriptions).values({
      channelId,
      stripeCustomerId: `cus_${channelId}`,
      stripeSubscriptionId: `sub_${channelId}`,
      status: 'active',
      updatedAt: tx.now,
    }),
  )
}

/**
 * A gateway whose every channel already has its reporting job, whose job holds no report, every
 * one of whose videos still exists, and whose every read Google fails.
 */
export const reportingStub: Parameters<typeof jobHandlers>[3]['gateway'] = {
  ensureReportingJob: async () => ({ ok: true, created: false }),
  listReachReports: async () => ({ ok: true, reports: [] }),
  downloadReachReport: async () => ({ ok: true, rows: [] }),
  existingVideos: async (_tx, _channelId, videoIds) => ({ ok: true, videoIds: new Set(videoIds) }),
  read: async () => ({ ok: false, refusal: 'google_failed' }),
}
