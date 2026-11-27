import { fileURLToPath } from 'node:url'
import { jobQueue, openWebDatabase, startJobRunner } from '@creator-analytics/database'
import { openPanelOptionsFrom } from '@creator-analytics/event-relay'
import { deploymentOf, packageContentRoot, readReleaseContent } from '@creator-analytics/releases'
import {
  createLogger,
  errorTrackingReporter,
  initErrorTracking,
  tracesSampleRateOf,
} from '@creator-analytics/reporter'
import { googleOAuthEndpoints, parseTokenKeys } from '@creator-analytics/token-vault'
import { youtubeRootUrls } from '@creator-analytics/youtube-gateway'
import { serve } from '@hono/node-server'
import pg from 'pg'
import { adminUserIdsOf } from './admin-feedback.ts'
import { createApi } from './app.ts'
import { createAuth, googleDiscoveryUrl } from './auth.ts'
import { billingSettingsOf, createBilling } from './billing.ts'
import { cloudflareAccessKeys, cloudflareAccessSettingsOf } from './cloudflare-access.ts'
import { createModules } from './modules.ts'
import { emailSettingsOf } from './notification-email.ts'
import { googleRiscConfigurationUrl } from './risc.ts'
import { clientSettingsOf } from './routes/client-settings.ts'
import { supportSettingsOf } from './support.ts'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

// First, so an unknown environment, a broken release note or a malformed trace sample rate throws
// before anything starts, and every error after it reports where it ran and on which version. One
// read of the build's release content gives both the version and the app versions the "What's
// new" marker may take.
const { releases } = readReleaseContent(process.env.RELEASE_CONTENT_ROOT || packageContentRoot)
const deployment = deploymentOf(process.env, releases)
const appVersions = new Set(
  releases.filter(({ product }) => product === 'app').map(({ version }) => version),
)
initErrorTracking({
  dsn: process.env.GLITCHTIP_DSN,
  environment: deployment.environment,
  release: deployment.version ?? undefined,
  // Unset, 0: no trace leaves, as before (ADR 0023).
  tracesSampleRate: tracesSampleRateOf(process.env),
})
// Read first, so a half-set Stripe throws before the API opens the database or listens.
const support = supportSettingsOf(process.env)
const billingSettings = billingSettingsOf(process.env)
// The same: all four email settings or none, read before the database.
const email = emailSettingsOf(process.env)
// Staging's, read here for the same reason. Production reads neither setting.
const accessSettings = cloudflareAccessSettingsOf(process.env, deployment.environment)
const logger = createLogger()
const reporter = errorTrackingReporter(logger)

const pool = new pg.Pool({ connectionString: required('DATABASE_URL') })
const database = await openWebDatabase(pool, {
  jobs: jobQueue(await startJobRunner(pool, { reporter })),
})
const baseURL = required('BETTER_AUTH_URL')
const clientId = required('GOOGLE_CLIENT_ID')
const clientSecret = required('GOOGLE_CLIENT_SECRET')
const auth = await createAuth(database, {
  baseURL,
  secret: required('BETTER_AUTH_SECRET'),
  google: { discoveryUrl: googleDiscoveryUrl, clientId, clientSecret },
})
const openPanel = openPanelOptionsFrom(process.env)
const modules = createModules({
  baseURL,
  google: {
    clientId,
    clientSecret,
    ...googleOAuthEndpoints,
    riscConfigurationUrl: googleRiscConfigurationUrl,
    youtubeRootUrls,
  },
  keys: parseTokenKeys(required('TOKEN_ENCRYPTION_KEYS')),
  identifierKey: required('GOOGLE_IDENTIFIER_KEY'),
  // All three or none: until the self-hosted project has a server-side secret, the relay sends
  // nothing and the extension's events still answer success.
  ...(openPanel && { openPanel }),
  // None set, as on staging, the API saves feedback messages and emails no one.
  email,
  reporter,
  logger,
})
const webRoot = process.env.WEB_ROOT ?? fileURLToPath(new URL('../../web/dist', import.meta.url))
const siteRoot = process.env.SITE_ROOT ?? fileURLToPath(new URL('../../site/dist', import.meta.url))
const port = Number(process.env.PORT ?? 3000)
// The web app and the site send to the relay's project, with its website client, not the relay's.
const clientSettings = clientSettingsOf(deployment, process.env)

serve(
  {
    fetch: createApi({
      database,
      auth,
      ...modules,
      support,
      billing: billingSettings && createBilling({ settings: billingSettings, baseURL }),
      cloudflareAccess: accessSettings && {
        ...accessSettings,
        keys: cloudflareAccessKeys(accessSettings),
      },
      clientSettings,
      appVersions,
      adminUserIds: adminUserIdsOf(process.env),
      webRoot,
      siteRoot,
    }).fetch,
    port,
  },
  (info) => {
    logger.info('API listening', { port: String(info.port) })
  },
)
