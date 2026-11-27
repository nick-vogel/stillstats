import { jobQueue, openWorkerDatabase, startJobRunner } from '@creator-analytics/database'
import { createEventRelay, openPanelOptionsFrom } from '@creator-analytics/event-relay'
import { deploymentOf } from '@creator-analytics/releases'
import {
  createLogger,
  errorTrackingReporter,
  initErrorTracking,
  tracesSampleRateOf,
} from '@creator-analytics/reporter'
import {
  createRetention,
  createStripeCanceller,
  stripeSecretKeyOf,
} from '@creator-analytics/retention-engine'
import {
  createConnectionAuthority,
  createConnectionProbe,
  googleOAuthEndpoints,
  parseTokenKeys,
} from '@creator-analytics/token-vault'
import { createYouTubeGateway, youtubeRootUrls } from '@creator-analytics/youtube-gateway'
import pg from 'pg'
import { jobHandlers, work } from './jobs.ts'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

// First, so an unknown environment or a malformed trace sample rate throws before anything starts,
// and every error after it reports where it ran and on which version. The worker opens no span of
// its own, and under the static lifecycle the SDK opens no root span of its own (its pg, http and
// fetch spans need a parent), so the worker sends no trace; one the SDK did open would be scrubbed
// as the API's (ADR 0023).
const { environment, version } = deploymentOf(process.env)
initErrorTracking({
  dsn: process.env.GLITCHTIP_DSN,
  environment,
  release: version ?? undefined,
  tracesSampleRate: tracesSampleRateOf(process.env),
})
const logger = createLogger()
const reporter = errorTrackingReporter(logger)

// Read before anything starts, so a malformed key throws here. With none, a paid channel's
// deletion still deletes its rows, and its cancellation fails until the alarm reports it.
const stripeSecretKey = stripeSecretKeyOf(process.env)
const pool = new pg.Pool({ connectionString: required('DATABASE_URL') })
// pg-boss's maintenance and its cron pass run here and in no other process.
const boss = await startJobRunner(pool, { supervise: true, schedule: true, reporter })
const worker = await openWorkerDatabase(pool, { jobs: jobQueue(boss) })
const retention = createRetention({
  deletionLogKey: required('DELETION_LOG_KEY'),
  reporter,
  ...(stripeSecretKey && { canceller: createStripeCanceller({ secretKey: stripeSecretKey }) }),
})
// The API's Google client and token keys: a probe refreshes the tokens the API stored, and the
// gateway creates each channel's reporting job with them.
const googleTokens = {
  google: {
    tokenEndpoint: googleOAuthEndpoints.tokenEndpoint,
    clientId: required('GOOGLE_CLIENT_ID'),
    clientSecret: required('GOOGLE_CLIENT_SECRET'),
  },
  keys: parseTokenKeys(required('TOKEN_ENCRYPTION_KEYS')),
}
const prober = createConnectionProbe(googleTokens)
const gateway = createYouTubeGateway({
  vault: createConnectionAuthority(googleTokens),
  rootUrls: youtubeRootUrls,
  logger,
})
// The API's OpenPanel project, all three settings or none. With none, the active user count still
// prunes, and reports on every run that it sent nothing.
const openPanel = openPanelOptionsFrom(process.env)
const relay = openPanel && createEventRelay(openPanel, { reporter })
await work(
  boss,
  worker,
  jobHandlers(retention, prober, { relay, reporter }, { gateway, reporter }),
  reporter,
)
logger.info('Job worker started')

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, async () => {
    await boss.stop({ graceful: true })
    await pool.end()
  })
}
