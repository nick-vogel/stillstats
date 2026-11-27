import { randomBytes } from 'node:crypto'
import { once } from 'node:events'
import { mkdtemp, writeFile } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ClientSettingsAnswer } from '@creator-analytics/api-types'
import type { WebDatabase } from '@creator-analytics/database'
import type { FakeOpenPanel } from '@creator-analytics/event-relay/testing'
import { type FakeGoogle, startFakeGoogle } from '@creator-analytics/fake-google'
import { type FakeStripe, startFakeStripe } from '@creator-analytics/fake-stripe'
import { readReleaseContent } from '@creator-analytics/releases'
import { fixtureContentRoot } from '@creator-analytics/releases/testing'
import {
  createLogger,
  type RecordingReporter,
  recordingReporter,
} from '@creator-analytics/reporter'
import { parseTokenKeys } from '@creator-analytics/token-vault'
import type { YouTubeGateway } from '@creator-analytics/youtube-gateway'
import { serve } from '@hono/node-server'
import type { Hono } from 'hono'
import { onTestFinished } from 'vitest'
import { createApi } from '../src/app.ts'
import { type Auth, createAuth } from '../src/auth.ts'
import { type BillingSettings, createBilling } from '../src/billing.ts'
import type { CloudflareAccess } from '../src/cloudflare-access.ts'
import { createModules } from '../src/modules.ts'
import type { EmailPort, EmailSettings } from '../src/notification-email.ts'
import type { SupportSettings } from '../src/support.ts'

export const indexHtml = '<!doctype html><title>web app</title>'

// Stands in for apps/web/dist, the built web app server.ts serves, so no test depends on a
// build. A smoke run of server.ts after `pnpm build` covers the real build output.
export async function webRootWithIndex(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'web-'))
  await writeFile(join(root, 'index.html'), indexHtml)
  return root
}

// Stands in for apps/site/dist. The site's own test builds the real site and passes its root.
async function siteRootWithPages(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'site-'))
  await writeFile(join(root, 'index.html'), '<!doctype html><title>site</title>')
  await writeFile(join(root, '404.html'), '<!doctype html><title>not found</title>')
  return root
}

/** Better Auth as the API builds it, with sign-in pointed at a fake Google server. */
export function createTestAuth(
  database: WebDatabase,
  google: Pick<FakeGoogle, 'discoveryUrl' | 'clientId' | 'clientSecret'>,
  baseURL = 'http://localhost:3000',
): Promise<Auth> {
  const { discoveryUrl, clientId, clientSecret } = google
  return createAuth(database, {
    baseURL,
    secret: 'a test secret that is at least thirty-two characters long',
    google: { discoveryUrl, clientId, clientSecret },
  })
}

export interface StartedApi {
  origin: string
  google: FakeGoogle
  reporter: RecordingReporter
  /** Every line the API's logger wrote, in order. */
  logs: string[]
  app: Hono
  /** The API's own gateway, for a test that runs a job the API enqueued as the worker would. */
  gateway: YouTubeGateway
  /** The fake Stripe server the API's Stripe client calls, started only with `billing`. */
  fakeStripe: FakeStripe | undefined
}

/** Production's answer with no release note, no commit and no OpenPanel client ID. */
const productionWithNothingSet: ClientSettingsAnswer = {
  environment: 'production',
  version: null,
  commit: null,
  releasePath: null,
  openPanelClientId: null,
}

/** The app versions of the release package's fixture build: 2026.11.9 and 2026.11.9.1. */
const fixtureAppVersions: ReadonlySet<string> = new Set(
  readReleaseContent(fixtureContentRoot)
    .releases.filter(({ product }) => product === 'app')
    .map(({ version }) => version),
)

/**
 * Starts the API on a free port, with every Google call pointed at a fresh fake Google server. With
 * no `openPanel`, the API runs with OpenPanel unset, with no `stripe`, with the tip unset, with no
 * `billing`, with Pro unset, with no `cloudflareAccess`, with no Access check, and with no
 * `email`, with the email settings unset.
 */
export async function startApi(
  database: WebDatabase,
  {
    webRoot,
    siteRoot,
    openPanel,
    stripe,
    billing,
    cloudflareAccess,
    email,
    clientSettings = productionWithNothingSet,
    appVersions = fixtureAppVersions,
    adminUserIds = new Set(),
    clock,
    googleCallTimeoutMs,
    stripePriceTimeoutMs,
  }: {
    webRoot?: string
    siteRoot?: string
    openPanel?: FakeOpenPanel
    stripe?: SupportSettings
    /** Pro's settings, with the API's Stripe client pointed at a fresh fake Stripe server. */
    billing?: BillingSettings
    /** Staging's Access check, such as a fake team's. Unset, production's: no check. */
    cloudflareAccess?: CloudflareAccess
    /**
     * The email settings, `undefined` for none set, and the port that stands in for Cloudflare's
     * for any settings. Unset, the email settings are unset.
     */
    email?: { settings: EmailSettings | undefined; port: EmailPort }
    /** What GET /api/client-settings answers. Unset, production's with nothing set. */
    clientSettings?: ClientSettingsAnswer
    /** The app versions of the build's release notes. Unset, the release package's fixtures'. */
    appVersions?: ReadonlySet<string>
    /**
     * The admin allowlist's user IDs: empty unless set. Better Auth makes a user's ID at sign-in,
     * so a test passes a set and adds the ID to it after signing in.
     */
    adminUserIds?: ReadonlySet<string>
    /** The event limit's and the price read's clock, such as the test harness's. */
    clock?: () => Date
    /** The bound on one Google call, the gateway's and the vault's. Unset, production's. */
    googleCallTimeoutMs?: number
    /** The bound on one read of a Stripe price. Unset, production's. */
    stripePriceTimeoutMs?: number
  } = {},
): Promise<StartedApi> {
  const google = await startFakeGoogle()
  onTestFinished(() => google.close())

  // Better Auth needs the origin before the app exists, so the server forwards to it late.
  let app: Hono | undefined
  const server = serve({
    fetch: (request, env) => (app ? app.fetch(request, env) : new Response(null, { status: 503 })),
    port: 0,
  })
  onTestFinished(() => {
    server.close()
  })
  await once(server, 'listening')
  const origin = `http://localhost:${(server.address() as AddressInfo).port}`

  const auth = await createTestAuth(database, google, origin)
  const {
    clientId,
    clientSecret,
    authorizationEndpoint,
    tokenEndpoint,
    revocationEndpoint,
    riscConfigurationUrl,
  } = google
  const youtubeRootUrls = {
    data: google.youtubeRootUrl,
    analytics: google.youtubeRootUrl,
    reporting: google.youtubeRootUrl,
  }
  const fakeStripe = billing ? await startFakeStripe() : undefined
  if (fakeStripe) onTestFinished(() => fakeStripe.close())
  // The two prices Checkout sells, as ADR 0022 sets them, under the settings' price IDs. A test
  // that needs another seeds it again before the API first reads it.
  if (billing && fakeStripe) {
    fakeStripe.addPrice({ id: billing.prices.monthly, unitAmount: 700, interval: 'month' })
    fakeStripe.addPrice({ id: billing.prices.annual, unitAmount: 7000, interval: 'year' })
  }
  const reporter = recordingReporter()
  const logs: string[] = []
  const logger = createLogger((_level, line) => logs.push(line))
  const modules = createModules({
    baseURL: origin,
    google: {
      clientId,
      clientSecret,
      authorizationEndpoint,
      tokenEndpoint,
      revocationEndpoint,
      riscConfigurationUrl,
      youtubeRootUrls,
      callTimeoutMs: googleCallTimeoutMs,
    },
    keys: parseTokenKeys(`1:${randomBytes(32).toString('base64')}`),
    identifierKey: randomBytes(32).toString('base64'),
    ...(openPanel && {
      openPanel: {
        apiUrl: openPanel.apiUrl,
        clientId: openPanel.clientId,
        clientSecret: openPanel.clientSecret,
      },
    }),
    ...(email && { email: email.settings, emailPortOf: () => email.port }),
    ...(clock && { clock }),
    reporter,
    logger,
  })
  app = createApi({
    database,
    auth,
    ...modules,
    support: stripe,
    billing:
      billing &&
      fakeStripe &&
      createBilling({
        settings: billing,
        baseURL: origin,
        stripeApi: fakeStripe,
        ...(clock && { now: clock }),
        ...(stripePriceTimeoutMs !== undefined && { priceTimeoutMs: stripePriceTimeoutMs }),
      }),
    cloudflareAccess,
    clientSettings,
    appVersions,
    adminUserIds,
    webRoot: webRoot ?? (await webRootWithIndex()),
    siteRoot: siteRoot ?? (await siteRootWithPages()),
  })
  return { origin, google, reporter, logs, app, gateway: modules.gateway, fakeStripe }
}
