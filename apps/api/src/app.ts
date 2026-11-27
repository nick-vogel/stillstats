import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Accounts } from '@creator-analytics/accounts'
import type {
  ChannelsAnswer,
  ClientSettingsAnswer,
  ConsentLandingRefusal,
  ConsentStartAnswer,
  DeleteMeAnswer,
  DisconnectAnswer,
  ErrorAnswer,
  LandingParameter,
  MeAnswer,
} from '@creator-analytics/api-types'
import type { WebDatabase } from '@creator-analytics/database'
import type { EventRelay } from '@creator-analytics/event-relay'
import type { Logger, Reporter } from '@creator-analytics/reporter'
import {
  type ConsentIntent,
  type ConsentLanding,
  consentLandings,
  type TokenVault,
} from '@creator-analytics/token-vault'
import type { YouTubeGateway } from '@creator-analytics/youtube-gateway'
import { serveStatic } from '@hono/node-server/serve-static'
import { sql } from 'drizzle-orm'
import { type Context, Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { routePath } from 'hono/route'
import { type Auth, googleProviderId, webAppPath } from './auth.ts'
import type { Billing } from './billing.ts'
import { namedChannelsOf } from './channel-list.ts'
import { type CloudflareAccess, cloudflareAccessCheck } from './cloudflare-access.ts'
import type { EventLimit } from './event-limit.ts'
import type { FeedbackNotifier } from './feedback-notice.ts'
import { requestTiming } from './request-timing.ts'
import { requestTrace } from './request-trace.ts'
import type { SecurityEventReader } from './risc.ts'
import { adminFeedbackRoute } from './routes/admin-feedback.ts'
import { audienceRoute } from './routes/audience.ts'
import { billingRoute } from './routes/billing.ts'
import { channelSummaryRoute } from './routes/channel-summary.ts'
import { clientSettingsRoute } from './routes/client-settings.ts'
import { eventRelayRoute } from './routes/events.ts'
import { feedbackRoute } from './routes/feedback.ts'
import { preferencesRoute } from './routes/preferences.ts'
import { retentionCurvesRoute } from './routes/retention-curves.ts'
import { sponsorReportRoute } from './routes/sponsor-report.ts'
import { stripeEventsRoute } from './routes/stripe-events.ts'
import { supportRoute } from './routes/support.ts'
import { upgradeRoute } from './routes/upgrade.ts'
import { videoDetailRoute } from './routes/video-detail.ts'
import { videoListRoute } from './routes/videos.ts'
import { channelIdOf, refuse, type SignedIn } from './signed-in.ts'
import type { SupportSettings } from './support.ts'

export interface ApiDependencies {
  database: WebDatabase
  auth: Auth
  vault: TokenVault
  gateway: YouTubeGateway
  accounts: Accounts
  securityEvents: SecurityEventReader
  eventRelay: EventRelay
  eventLimit: EventLimit
  /** Emails Nick of each saved feedback message. With the email settings unset, it sends nothing. */
  feedbackNotifier: FeedbackNotifier
  /** Stripe's settings for a Tip. Unset, the API offers no support link. */
  support: SupportSettings | undefined
  /** Stripe's Checkout for Pro. Unset, no channel may subscribe. */
  billing: Billing | undefined
  /**
   * Staging's Cloudflare Access check, which every request passes before any route. Unset, as on
   * production, no request is checked.
   */
  cloudflareAccess: CloudflareAccess | undefined
  /** What the web app and the site read at load: the environment, the version, the client ID. */
  clientSettings: ClientSettingsAnswer
  /**
   * The app versions of the build's release notes, the only values the "What's new" marker
   * Preference takes.
   */
  appVersions: ReadonlySet<string>
  /**
   * The user IDs on the admin allowlist (`ADMIN_USER_IDS`), the only users the admin routes
   * answer. Empty, no one's.
   */
  adminUserIds: ReadonlySet<string>
  reporter: Reporter
  logger: Logger
  /**
   * The built web app, served under /app from the API's origin so the session cookie stays
   * first-party.
   */
  webRoot: string
  /** The built site, served at / with its pages at their clean paths. */
  siteRoot: string
}

// Every consent, a connect or a revenue consent, comes back here: Google's one registered redirect
// URI for the connection. The consent state names which it was.
const connectCallbackRoute = '/channels/connect/callback'

// A Google sign-in that asks for it returns here. A user who holds no channel goes straight on to
// the connect consent, so a first visit takes no click between the two grants; any other lands on
// the web app.
const afterSignInRoute = '/channels/connect/after-sign-in'

/** The path a sign-in that asks for the hop returns to, carrying the landing it was begun with. */
function afterSignInPathOf(landing: ConsentLanding | undefined): string {
  const path = `/api${afterSignInRoute}`
  return landing ? `${path}?${new URLSearchParams({ [landingParameter]: landing })}` : path
}

// Only the web app's signed-out screen carries the connection consent text, so only its sign-in
// asks for the hop to the connect consent. The homepage's sign-in lands on the web app, whose
// empty state opens the connection consent screen before Google.
const firstVisitHop = { parameter: 'then', value: 'connect' } as const

// A sign-in or a connect begun on the way to another screen than the web app's first names it
// here, by a name from a fixed set: the web app's signed-out screen and its empty state on the
// upgrade screen, where the homepage's "Subscribe" sends a visitor (creator-analytics#907). The API
// maps the name to its own address, so no value of the parameter can send the browser off the web
// app: an unknown one lands where none does.
const landingParameter = 'landing'

/** The web app's address for each landing a consent may name. */
const landingPaths: Record<ConsentLanding, string> = { upgrade: `${webAppPath}/upgrade` }

/** The landing a request's query names, when it is one the API knows. */
function landingOf(c: Context): ConsentLanding | undefined {
  const named = c.req.query(landingParameter)
  return consentLandings.find((landing) => landing === named)
}

/** The web app's path a sign-in or a consent lands on: its first screen, or the one named. */
function webAppPathOf(landing: ConsentLanding | undefined): string {
  return landing ? landingPaths[landing] : webAppPath
}

function webAppLanding(
  parameter: LandingParameter,
  value: ConsentLandingRefusal | '1',
  landing?: ConsentLanding,
): string {
  return `${webAppPathOf(landing)}?${parameter}=${value}`
}

/** The landing a consent began with: a connect's, as a revenue consent names none. */
function landingOfIntent(intent: ConsentIntent | undefined): ConsentLanding | undefined {
  return intent?.purpose === 'connect' ? intent.landing : undefined
}

/**
 * Where the web app lands after a refused consent, by the purpose the consent began with, on the
 * screen a connect began on its way to.
 */
function refusedLanding(intent: ConsentIntent | undefined, refusal: ConsentLandingRefusal): string {
  return webAppLanding(
    intent?.purpose === 'revenue' ? 'revenue_error' : 'connect_error',
    refusal,
    landingOfIntent(intent),
  )
}

/**
 * Where the web app lands after a connect: its first screen, or the upgrade screen for the channel
 * just connected when the connect began on its way there.
 */
function connectedLanding(landing: ConsentLanding | undefined, channelId: string): string {
  if (landing !== 'upgrade') return webAppLanding('connected', '1')
  const query = new URLSearchParams({ channel: channelId, connected: '1' })
  return `${landingPaths.upgrade}?${query}`
}

/** The path of the connection's Google redirect URI, registered next to sign-in's. */
export const connectCallbackPath = `/api${connectCallbackRoute}`

/** Whether the path is the web app's, the API's or /health, which search engines leave out. */
function keptOutOfSearch(path: string): boolean {
  return (
    path === '/health' ||
    [webAppPath, '/api'].some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
  )
}

export function createApi({
  database,
  auth,
  vault,
  gateway,
  accounts,
  securityEvents,
  eventRelay,
  eventLimit,
  feedbackNotifier,
  support,
  billing,
  cloudflareAccess,
  clientSettings,
  appVersions,
  adminUserIds,
  reporter,
  logger,
  webRoot,
  siteRoot,
}: ApiDependencies): Hono {
  const app = new Hono()

  // First, so a request that did not pass Cloudflare Access reaches no route and no other
  // middleware: on staging, a request to main-box's IP with the staging host header skips
  // Cloudflare (creator-analytics#593). Stripe's webhook alone gets through with no token, to its
  // own signature check.
  if (cloudflareAccess) app.use(cloudflareAccessCheck(cloudflareAccess, reporter))

  // Every API request reports where its time went, in its Server-Timing header and one log line.
  // After the Access check, so a request refused there is neither timed nor logged. With no path,
  // like the middleware below, so the route inventory in sign-in.test.ts keeps one entry for it.
  app.use(requestTiming(logger))
  // Every API request's trace, which leaves for GlitchTip only with a trace sample rate set, and
  // then ID-free (ADR 0023). Inside the timing, whose record of each read gives its cache result.
  app.use(requestTrace())

  // The site is meant to be indexed. The web app, the API and /health are not: the web app's entry
  // page is a signed-out sign-in shell and the API answers JSON, so neither holds anything a
  // searcher wants (creator-analytics#254). One middleware over every path, not one per prefix,
  // so the route inventory in sign-in.test.ts keeps a single entry for it.
  app.use(async (c, next) => {
    await next()
    if (keptOutOfSearch(c.req.path)) c.header('X-Robots-Tag', 'noindex')
  })

  // The route's pattern, never its path: a path can hold a channel's id. routePath's default index
  // is the handler that threw; an index of -1 would name the last route matched, the catch-all '*'.
  const reportFailure = (c: Context, error: unknown) =>
    reporter.report({
      message: 'The API failed a request',
      context: { method: c.req.method, route: routePath(c) },
      error,
    })
  app.onError((error, c) => {
    if (error instanceof HTTPException) return error.getResponse()
    reportFailure(c, error)
    return c.json({ error: 'internal' } satisfies ErrorAnswer, 500)
  })

  app.get('/health', async (c) => {
    try {
      await database.asAnonymous((scope) => scope.sql.execute(sql`select 1`))
      return c.json({ status: 'ok' })
    } catch (error) {
      logger.error('Health check could not read the database', {}, error)
      return c.json({ status: 'unavailable' }, 503)
    }
  })

  // Only these Better Auth routes are reachable. The rest would let a client choose its own
  // scopes, read the sign-in grant's tokens, or delete a user around the deletion cascade.
  app.post(`/api/auth/sign-in/${googleProviderId}`, (c) => {
    const headers = new Headers(c.req.raw.headers)
    headers.set('content-type', 'application/json')
    const hop = c.req.query(firstVisitHop.parameter) === firstVisitHop.value
    // A landing comes only with the hop: only the web app's signed-out screen names one.
    const landing = hop ? landingOf(c) : undefined
    return auth.handler(
      new Request(new URL('/api/auth/sign-in/social', c.req.url), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          provider: googleProviderId,
          callbackURL: hop ? afterSignInPathOf(landing) : webAppPath,
          // A sign-in Google refuses lands on the screen it was begun on, with Google's error code;
          // with none named, Better Auth's errorURL, the web app's first screen (auth.ts).
          ...(landing ? { errorCallbackURL: webAppPathOf(landing) } : {}),
        }),
      }),
    )
  })
  app.get(`/api/auth/callback/${googleProviderId}`, (c) => auth.handler(c.req.raw))
  app.post('/api/auth/sign-out', (c) => auth.handler(c.req.raw))
  app.all('/api/auth/*', (c) => c.json({ error: 'not_found' } satisfies ErrorAnswer, 404))

  // Google's Cross-Account Protection posts here, with no session. Google's RISC page sets the
  // answers: 400 for a token that fails verification, 202 for every verified one.
  app.post('/api/risc/events', async (c) => {
    const read = await securityEvents.read(await c.req.text())
    if (!read.ok) return c.body(null, 400)
    const { revoked } = read
    if (revoked.length > 0) {
      await database.asAnonymous((tx) => vault.receiveRevocations(tx, revoked))
    }
    return c.body(null, 202)
  })

  // Stripe's webhook, with no session, before the signed-in routes so their check never runs.
  stripeEventsRoute(app, { support, billing, database, reporter, eventRelay })
  // Public too, as the site reads it signed out.
  clientSettingsRoute(app, { clientSettings })
  // Before the signed-in routes too, as their check would answer a signed-out visitor 401: every
  // path under /api/admin answers 404 to anyone not on the allowlist, as an unknown route does.
  adminFeedbackRoute(app, { auth, database, adminUserIds })

  const signedIn = new Hono<SignedIn>()
  signedIn.use(async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers })
    if (!session) return c.json({ error: 'unauthenticated' } satisfies ErrorAnswer, 401)
    c.set('user', session.user)
    await next()
  })
  signedIn.get('/me', (c) => {
    const { email, name, createdAt } = c.get('user')
    return c.json({ email, name, createdAt: createdAt.toISOString() } satisfies MeAnswer)
  })
  // One transaction, as with a disconnect, for every channel the user held. Deleting the user
  // deletes its sessions, so the sign-out only clears the cookies.
  signedIn.delete('/me', async (c) => {
    const { revokedAtGoogle } = await database.asUser(c.get('user').id, (tx) =>
      accounts.deleteUser(tx),
    )
    const { headers } = await auth.api.signOut({ headers: c.req.raw.headers, returnHeaders: true })
    for (const cookie of headers.getSetCookie()) c.header('set-cookie', cookie, { append: true })
    return c.json({ revokedAtGoogle } satisfies DeleteMeAnswer)
  })
  preferencesRoute(signedIn, { database, appVersions })
  supportRoute(signedIn, { support, reporter, database })
  billingRoute(signedIn, { billing, database })
  upgradeRoute(signedIn, { billing, database, gateway, reporter })
  feedbackRoute(signedIn, { database, feedbackNotifier })
  signedIn.get('/channels', async (c) => {
    const channels = await database.asUser(c.get('user').id, (tx) =>
      namedChannelsOf(accounts, gateway, tx),
    )
    return c.json({ channels } satisfies ChannelsAnswer)
  })
  // A connect started by a click, from Settings or the empty state, opens Google's account
  // chooser, so the creator can connect a channel held under another Google account.
  signedIn.post('/channels/connect', async (c) => {
    const landing = landingOf(c)
    const { authorizationUrl } = await database.asUser(c.get('user').id, (tx) =>
      vault.beginConsent(tx, { purpose: 'connect', ...(landing ? { landing } : {}) }, 'choose'),
    )
    return c.json({ url: authorizationUrl } satisfies ConsentStartAnswer)
  })
  // A refused or cancelled connect comes back through the connect callback, never here, so the
  // product never starts the connect consent again on its own. The browser arrives here straight
  // from sign-in, so a failure lands it on the web app, signed in, rather than on an error body.
  // A sign-in begun on the way to the upgrade screen lands there, and a first visit's connect lands
  // on the upgrade screen for the channel it connects.
  signedIn.get(afterSignInRoute, async (c) => {
    const { id, email } = c.get('user')
    const landing = landingOf(c)
    try {
      const authorizationUrl = await database.asUser(id, async (tx) => {
        const held = await accounts.channelsOf(tx)
        if (held.length > 0) return null
        // Right after sign-in, the creator just picked the Google account the channel is under.
        const intent: ConsentIntent = { purpose: 'connect', ...(landing ? { landing } : {}) }
        return (await vault.beginConsent(tx, intent, { loginHint: email })).authorizationUrl
      })
      return c.redirect(authorizationUrl ?? webAppPathOf(landing))
    } catch (error) {
      reportFailure(c, error)
      return c.redirect(webAppPathOf(landing))
    }
  })
  // A revenue consent adds the monetary scope to a channel the user already holds, so it is
  // refused before Google for any other channel.
  signedIn.post('/channels/:channelId/revenue-consent', async (c) => {
    const channelId = channelIdOf(c)
    if (!channelId) return refuse(c, 'not_connected')
    const started = await database.asUser(c.get('user').id, (tx) =>
      accounts.beginRevenueConsent(tx, channelId),
    )
    if (!started.ok) return refuse(c, started.refusal)
    return c.json({ url: started.authorizationUrl } satisfies ConsentStartAnswer)
  })
  videoListRoute(signedIn, { database, gateway })
  videoDetailRoute(signedIn, { database, gateway })
  retentionCurvesRoute(signedIn, { database, gateway })
  sponsorReportRoute(signedIn, { database, gateway })
  channelSummaryRoute(signedIn, { database, gateway })
  audienceRoute(signedIn, { database, gateway })
  eventRelayRoute(signedIn, { eventRelay, eventLimit })
  // One transaction: the revoked connection, the deletion request with its jobs and the ended
  // membership commit together. The revoke at Google is an HTTP call and stands either way.
  signedIn.post('/channels/:channelId/disconnect', async (c) => {
    const channelId = channelIdOf(c)
    if (!channelId) return refuse(c, 'not_connected')
    const disconnected = await database.asUser(c.get('user').id, (tx) =>
      accounts.disconnectChannel(tx, channelId),
    )
    if (!disconnected.ok) return refuse(c, disconnected.refusal)
    return c.json({ revokedAtGoogle: disconnected.revokedAtGoogle } satisfies DisconnectAnswer)
  })
  // The three calls share one transaction, so the channel, its owner membership and its
  // connection appear together or not at all, and a revenue consent changes the connection only
  // when the grant reads the channel it began for.
  signedIn.get(connectCallbackRoute, async (c) => {
    const landing = await database.asUser(c.get('user').id, async (tx) => {
      const consent = await vault.completeConsent(tx, c.req.query())
      if (!consent.ok) {
        // No status, no error and no token: the vault answers only the refusal and what Google
        // answered, never the error, whose message may carry identifiers. An outage and an answer
        // the consent cannot use log apart, so one is not read as the other.
        if (consent.refusal === 'google_failed')
          logger.error(
            consent.answer === 'none'
              ? "Google's token endpoint did not answer a call"
              : "Google's token endpoint answered a consent without a refresh token or an ID token subject",
          )
        return refusedLanding(consent.intent, consent.refusal)
      }
      const { intent } = consent
      const identified = await gateway.identifyGrant(tx, consent.grant)
      if (!identified.ok) return refusedLanding(intent, identified.refusal)
      if (intent.purpose === 'revenue') {
        const given = await accounts.giveRevenueConsent(tx, intent.channelId, identified.grant)
        return given.ok
          ? webAppLanding('revenue_consented', '1')
          : refusedLanding(intent, given.refusal)
      }
      const claimed = await accounts.claimChannel(tx, identified.grant)
      return claimed.ok
        ? connectedLanding(intent.landing, claimed.channelId)
        : refusedLanding(intent, claimed.refusal)
    })
    return c.redirect(landing)
  })
  signedIn.all('*', (c) => c.json({ error: 'not_found' } satisfies ErrorAnswer, 404))
  app.route('/api', signedIn)

  app.get(
    `${webAppPath}/*`,
    serveStatic({ root: webRoot, rewriteRequestPath: (path) => path.slice(webAppPath.length) }),
  )
  // Client-side routes have no file, so every unmatched GET under the web app gets its entry page.
  app.get(`${webAppPath}/*`, serveStatic({ root: webRoot, path: 'index.html' }))

  const notFoundPage = async (c: Context) =>
    c.html(await readFile(join(siteRoot, '404.html'), 'utf8'), 404)
  // Vite builds each page as a .html file, but a page answers only at its clean path: '/' for
  // index.html, '/<name>' for the rest. A file's own path, '/index' and '/404' name no page, and
  // answering them would serve one page at several URLs.
  app.get('*', async (c, next) => {
    const path = c.req.path
    if (path.endsWith('.html') || path === '/index' || path === '/404') return notFoundPage(c)
    await next()
  })
  app.get('*', serveStatic({ root: siteRoot }))
  app.get('*', serveStatic({ root: siteRoot, rewriteRequestPath: (path) => `${path}.html` }))
  app.get('*', notFoundPage)

  return app
}
