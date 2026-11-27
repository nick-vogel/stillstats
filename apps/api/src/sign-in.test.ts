// Limits: these tests sign in against the fake Google server, so they cannot prove Google's real
// consent screen or the exact scope strings Google grants. Nick signing in on the deployed
// product covers both.

import { accounts, type WebDatabase } from '@creator-analytics/database'
import { test } from '@creator-analytics/database/testing'
import { startFakeGoogle } from '@creator-analytics/fake-google'
import { describe, expect } from 'vitest'
import { Browser } from '../test/browser.ts'
import { channelsOf, isConnectionConsent } from '../test/flows.ts'
import { createTestAuth, type StartedApi, startApi } from '../test/start-api.ts'
import { testStripe } from '../test/stripe.ts'

// A Google user no other test file signs in with. Test files run in parallel against one database,
// and a first visit here spends Data API quota, so a user another file also signs in with
// deadlocks the two on the unique email index and the quota row.
const creator = { sub: '808729', email: 'signer@example.com', name: 'A Creator' }
const identityScopes = ['email', 'openid', 'profile']
const youtube = ['https://www.googleapis.com/auth/youtube.readonly']

/** Google separates scopes with spaces; Better Auth stores them separated with commas. */
function sortedScopes(scope: string | null | undefined): string[] {
  return scope?.split(/[ ,]/).sort() ?? []
}

// The web app's signed-out screen carries the connection consent text, so its sign-in asks for
// the first-visit hop; the homepage's does not.
const webAppSignIn = '/api/auth/sign-in/google?then=connect'
const homepageSignIn = '/api/auth/sign-in/google'
// The web app's signed-out screen on the upgrade screen's address, where the homepage's
// "Subscribe" sends a signed-out visitor (creator-analytics#907).
const upgradeSignIn = '/api/auth/sign-in/google?then=connect&landing=upgrade'

/**
 * Signs the creator in from the web app, or from `from`, and follows every redirect, as a browser
 * does, unless `stopAt` stops it: then `stoppedBefore` is the location it did not follow.
 */
async function signIn(
  api: StartedApi,
  { from = webAppSignIn, stopAt }: { from?: string; stopAt?: (location: URL) => boolean } = {},
): Promise<{ browser: Browser; landedOn: URL; stoppedBefore: string | null }> {
  api.google.signInAs(creator)
  const browser = new Browser(api.origin)
  const started = await browser.fetch(from, { method: 'POST' })
  const { url } = (await started.json()) as { url: string }
  const { url: landedOn, response } = await browser.navigate(url, stopAt ? { stopAt } : {})
  return { browser, landedOn, stoppedBefore: stopAt ? response.headers.get('location') : null }
}

async function currentUser(browser: Browser, headers?: Record<string, string>) {
  const response = await browser.fetch('/api/me', headers ? { headers } : {})
  return { status: response.status, body: response.ok ? await response.json() : null }
}

describe('seam 1: sign in with Google', () => {
  test('a user who signs in with Google lands on the web app signed in', async ({ web }) => {
    const api = await startApi(web)

    // No channel picked on Google, so the first visit's connect ends with no_channel.
    const { browser, landedOn } = await signIn(api)

    expect(landedOn.toString()).toBe(`${api.origin}/app?connect_error=no_channel`)
    // The account's creation time, which the web app's "What's new" banner compares releases with.
    expect(await currentUser(browser)).toEqual({
      status: 200,
      body: {
        email: creator.email,
        name: creator.name,
        createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      },
    })
  })

  test("a sign-in by a user with no channel continues to Google's connect consent with no click", async ({
    web,
  }) => {
    const api = await startApi(web)
    api.google.pickChannel('UC-first-visit')

    const { browser, landedOn } = await signIn(api)

    const [signInConsent, connectConsent, ...more] = api.google.authorizationRequests
    expect(sortedScopes(signInConsent?.get('scope'))).toEqual(identityScopes)
    expect(sortedScopes(connectConsent?.get('scope'))).toEqual(
      [
        'email',
        'openid',
        'https://www.googleapis.com/auth/youtube.readonly',
        'https://www.googleapis.com/auth/yt-analytics.readonly',
      ].sort(),
    )
    expect(more).toEqual([])
    expect(landedOn.toString()).toBe(`${api.origin}/app?connected=1`)
    expect((await channelsOf(browser)).channels.map((channel) => channel.youtubeChannelId)).toEqual(
      ['UC-first-visit'],
    )
  })

  test("the first visit's connect consent sends Google login_hint with the session's email, and no account chooser", async ({
    web,
  }) => {
    const api = await startApi(web)

    await signIn(api)

    const [, connectConsent] = api.google.authorizationRequests
    expect(connectConsent?.get('login_hint')).toBe(creator.email)
    expect(connectConsent?.get('prompt')).toBe('consent')
  })

  test('a sign-in by a user with a channel lands on the web app with no connect consent', async ({
    web,
  }) => {
    const api = await startApi(web)
    api.google.pickChannel('UC-first-visit')
    const { browser: firstVisit } = await signIn(api)
    await firstVisit.postJson('/api/auth/sign-out', {})
    const requestsBefore = api.google.authorizationRequests.length

    const { browser, landedOn } = await signIn(api)

    expect(landedOn.toString()).toBe(`${api.origin}/app`)
    expect(api.google.authorizationRequests).toHaveLength(requestsBefore + 1)
    expect(sortedScopes(api.google.authorizationRequests.at(-1)?.get('scope'))).toEqual(
      identityScopes,
    )
    expect((await channelsOf(browser)).channels).toHaveLength(1)
  })

  test('a sign-in from the homepage lands on the web app with no connect consent, as the homepage carries no consent text', async ({
    web,
  }) => {
    const api = await startApi(web)
    api.google.pickChannel('UC-first-visit')

    const { browser, landedOn } = await signIn(api, { from: homepageSignIn })

    expect(landedOn.toString()).toBe(`${api.origin}/app`)
    expect(api.google.authorizationRequests).toHaveLength(1)
    expect((await channelsOf(browser)).channels).toEqual([])
  })

  test('a sign-in from the upgrade screen by a user with a channel lands on the upgrade screen, with no connect consent', async ({
    web,
  }) => {
    const api = await startApi(web)
    api.google.pickChannel('UC-first-visit')
    const { browser: firstVisit } = await signIn(api)
    await firstVisit.postJson('/api/auth/sign-out', {})
    const requestsBefore = api.google.authorizationRequests.length

    const { landedOn } = await signIn(api, { from: upgradeSignIn })

    expect(landedOn.toString()).toBe(`${api.origin}/app/upgrade`)
    expect(api.google.authorizationRequests).toHaveLength(requestsBefore + 1)
  })

  test('a first visit from the upgrade screen goes on to the connect consent and lands on the upgrade screen for the channel just connected', async ({
    web,
  }) => {
    const api = await startApi(web)
    api.google.pickChannel('UC-first-visit')

    const { browser, landedOn } = await signIn(api, { from: upgradeSignIn })

    const { channels } = await channelsOf(browser)
    expect(channels.map((channel) => channel.youtubeChannelId)).toEqual(['UC-first-visit'])
    expect(landedOn.toString()).toBe(
      `${api.origin}/app/upgrade?channel=${channels[0]?.id}&connected=1`,
    )
    expect(api.google.authorizationRequests).toHaveLength(2)
  })

  test('a cancelled first-visit connect from the upgrade screen lands on the upgrade screen with the refusal', async ({
    web,
  }) => {
    const api = await startApi(web)
    api.google.pickChannel('UC-first-visit')
    const { browser, stoppedBefore } = await signIn(api, {
      from: upgradeSignIn,
      stopAt: isConnectionConsent,
    })
    expect(stoppedBefore).toBeTruthy()
    api.google.refuseConsent()

    const { url: landedOn } = await browser.navigate(stoppedBefore ?? '')

    expect(landedOn.toString()).toBe(`${api.origin}/app/upgrade?connect_error=consent_denied`)
    expect((await channelsOf(browser)).channels).toEqual([])
  })

  // The landing is a name the API maps to one of its own addresses, never an address it is given,
  // so no value of it sends the browser anywhere but the web app.
  test.for([
    'https://elsewhere.example/app/upgrade',
    '//elsewhere.example',
    '/app/upgrade',
    'Upgrade',
  ])(
    'a sign-in with the landing %s lands where a sign-in with none does',
    async (landing, { web }) => {
      const api = await startApi(web)
      api.google.pickChannel('UC-first-visit')
      const from = `${webAppSignIn}&landing=${encodeURIComponent(landing)}`

      const { landedOn } = await signIn(api, { from })

      expect(landedOn.toString()).toBe(`${api.origin}/app?connected=1`)
    },
  )

  test('a first-visit hop with an unknown landing redirects to the web app', async ({ web }) => {
    const api = await startApi(web)
    api.google.pickChannel('UC-first-visit')
    const { browser: firstVisit } = await signIn(api)

    const response = await firstVisit.fetch(
      `/api/channels/connect/after-sign-in?landing=${encodeURIComponent('https://elsewhere.example')}`,
      { redirect: 'manual' },
    )

    expect({ status: response.status, location: response.headers.get('location') }).toEqual({
      status: 302,
      location: '/app',
    })
  })

  test('a cancelled first-visit connect lands on the web app with the refusal, and Google is not asked again', async ({
    web,
  }) => {
    const api = await startApi(web)
    api.google.pickChannel('UC-first-visit')
    const { browser, stoppedBefore } = await signIn(api, { stopAt: isConnectionConsent })
    expect(stoppedBefore).toBeTruthy()
    api.google.refuseConsent()

    const { url: landedOn } = await browser.navigate(stoppedBefore ?? '')

    expect(landedOn.toString()).toBe(`${api.origin}/app?connect_error=consent_denied`)
    expect(api.google.authorizationRequests).toHaveLength(2)
    expect((await channelsOf(browser)).channels).toEqual([])
  })

  test('a first-visit hop that fails lands on the web app, and the failure is reported', async ({
    web,
  }) => {
    const failure = new Error('the database failed')
    // Better Auth signs in through the anonymous scope, so only the hop's user scope fails.
    const failingUserScope: WebDatabase = {
      asAnonymous: web.asAnonymous.bind(web),
      asUser: () => Promise.reject(failure),
      asAdmin: web.asAdmin.bind(web),
    }
    const api = await startApi(failingUserScope)

    const { landedOn } = await signIn(api)

    expect(landedOn.toString()).toBe(`${api.origin}/app`)
    expect(api.reporter.reports).toEqual([
      {
        message: 'The API failed a request',
        context: { method: 'GET', route: '/api/channels/connect/after-sign-in' },
        error: failure,
      },
    ])
  })

  // Better Auth sends a sign-in Google refuses to the sign-in's errorCallbackURL with Google's error
  // code, else to the auth config's errorURL, the web app's first screen (review of
  // creator-analytics#907).
  test('a cancelled sign-in from the upgrade screen lands on the upgrade screen with the error and no session', async ({
    web,
  }) => {
    const api = await startApi(web)
    api.google.refuseConsent()

    const { browser, landedOn } = await signIn(api, { from: upgradeSignIn })

    expect(landedOn.toString()).toBe(`${api.origin}/app/upgrade?error=access_denied`)
    expect((await currentUser(browser)).status).toBe(401)
  })

  // A landing counts only with the hop, which only the web app's signed-out screen asks for, and
  // only as a name the API knows; otherwise the sign-in sends Better Auth no errorCallbackURL, so a
  // refused one lands on Better Auth's errorURL, the web app's first screen.
  test.for([
    ['upgrade without the hop', '/api/auth/sign-in/google?landing=upgrade'],
    ['an unknown landing with the hop', '/api/auth/sign-in/google?then=connect&landing=evil'],
  ] as const)(
    'a cancelled sign-in with %s sends no errorCallbackURL and lands on the web app with the error',
    async ([, from], { web }) => {
      const api = await startApi(web)
      api.google.refuseConsent()

      const { landedOn } = await signIn(api, { from })

      expect(landedOn.toString()).toBe(`${api.origin}/app?error=access_denied`)
    },
  )

  test('a cancelled sign-in from any other screen lands on the web app with the error', async ({
    web,
  }) => {
    const api = await startApi(web)
    api.google.refuseConsent()

    const { landedOn } = await signIn(api)

    expect(landedOn.toString()).toBe(`${api.origin}/app?error=access_denied`)
  })

  test('a failed sign-in lands on the web app with the error and no session', async ({ web }) => {
    const api = await startApi(web)
    const browser = new Browser(api.origin)

    const { url } = await browser.navigate('/api/auth/callback/google?code=forged&state=forged')

    expect(url.pathname).toBe('/app')
    expect(url.searchParams.get('error')).toBeTruthy()
    expect((await currentUser(browser)).status).toBe(401)
  })

  test('a second visit with the session cookie is signed in without asking Google again', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser } = await signIn(api)

    const secondVisit = new Browser(api.origin)
    const user = await currentUser(secondVisit, { cookie: browser.cookieHeader })

    expect(user.status).toBe(200)
    // The sign-in consent and the first visit's connect consent.
    expect(api.google.authorizationRequests).toHaveLength(2)
  })

  test('sign-out ends the session, so even a kept copy of its cookie is refused', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser } = await signIn(api)
    const keptCookie = browser.cookieHeader

    const signOut = await browser.postJson('/api/auth/sign-out', {})

    expect(signOut.status).toBe(200)
    expect((await currentUser(browser, { cookie: keptCookie })).status).toBe(401)
  })

  test('the sign-in consent asks Google for openid, email and profile and nothing else', async ({
    web,
  }) => {
    const api = await startApi(web)

    await signIn(api)

    const [consent] = api.google.authorizationRequests
    expect(sortedScopes(consent?.get('scope'))).toEqual(identityScopes)
  })

  test('a client cannot add scopes to the sign-in consent', async ({ web }) => {
    const api = await startApi(web)
    const browser = new Browser(api.origin)
    const addedScopes = { provider: 'google', scopes: youtube }

    const ownRoute = await browser.postJson('/api/auth/sign-in/google', addedScopes)
    const betterAuthRoute = await browser.postJson('/api/auth/sign-in/social', addedScopes)

    const { url } = (await ownRoute.json()) as { url: string }
    expect(sortedScopes(new URL(url).searchParams.get('scope'))).toEqual(identityScopes)
    expect(betterAuthRoute.status).toBe(404)
  })

  test('the stored sign-in grant holds the identity scopes only, even after a YouTube grant', async ({
    web,
  }) => {
    const api = await startApi(web)
    api.google.signInAs(creator)
    // As the connection leaves it. Google would add these scopes to the sign-in token
    // if the sign-in request asked it to include earlier grants.
    api.google.grantedEarlier(youtube)

    await signIn(api)

    const grants = await web.asAnonymous((scope) =>
      scope.sql.select({ scope: accounts.scope }).from(accounts),
    )
    expect(grants.map((grant) => sortedScopes(grant.scope))).toEqual([identityScopes])
  })

  test("the stored sign-in grant holds Google's access token only in encrypted form", async ({
    web,
  }) => {
    const api = await startApi(web)

    await signIn(api)

    const [issued] = api.google.issuedAccessTokens
    const grants = await web.asAnonymous((scope) =>
      scope.sql.select({ accessToken: accounts.accessToken }).from(accounts),
    )
    expect(issued).toBeDefined()
    expect(grants).toHaveLength(1)
    expect(grants[0]?.accessToken).toBeTruthy()
    expect(grants[0]?.accessToken).not.toContain(issued)
  })

  test("a signed-in user cannot read the sign-in grant's tokens through Better Auth", async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser } = await signIn(api)

    const response = await browser.postJson('/api/auth/get-access-token', { providerId: 'google' })

    expect(response.status).toBe(404)
  })

  test('the API refuses every route but the public ones with 401 when no session exists, and every admin route with 404', async ({
    web,
  }) => {
    // With Stripe set, as deployed, so the inventory holds the Stripe webhook.
    const api = await startApi(web, { stripe: testStripe })
    const publicRoutes = [
      'GET /health',
      'POST /api/auth/sign-in/google',
      'GET /api/auth/callback/google',
      'POST /api/auth/sign-out',
      // Better Auth's other routes, closed with a 404.
      'ALL /api/auth/*',
      // Google's security events, which carry Google's signature in place of a session.
      'POST /api/risc/events',
      // Stripe's webhook, which carries Stripe's signature in place of a session.
      'POST /api/stripe/events',
      // What the web app and the site read at load, the site signed out.
      'GET /api/client-settings',
      // The X-Robots-Tag header on the web app's and the API's responses.
      'ALL /*',
      // The web app's files and its entry page for client-side routes.
      'GET /app/*',
      // The site's pages and its not-found page.
      'GET /*',
    ]
    // The admin routes answer 404, as an unknown route does, to anyone not on the allowlist
    // (creator-analytics#583), so a signed-out visitor cannot tell them from one.
    const isAdminRoute = (path: string) => path.startsWith('/api/admin/')
    const userRoutes = api.app.routes.filter(
      (route) => !publicRoutes.includes(`${route.method} ${route.path}`),
    )
    expect(userRoutes.map((route) => route.path)).toContain('/api/me')
    expect(userRoutes.map((route) => `${route.method} ${route.path}`)).toEqual(
      expect.arrayContaining([
        'GET /api/admin/feedback',
        'PUT /api/admin/feedback/:id/done',
        'DELETE /api/admin/feedback/:id/done',
      ]),
    )

    const browser = new Browser(api.origin)
    const statuses: string[] = []
    for (const route of userRoutes) {
      const method = route.method === 'ALL' ? 'GET' : route.method
      const path = route.path.replaceAll('*', 'any').replaceAll(/:(\w+)/g, '$1')
      statuses.push(
        `${route.method} ${route.path} ${(await browser.fetch(path, { method })).status}`,
      )
    }

    expect(statuses).toEqual(
      userRoutes.map(
        (route) => `${route.method} ${route.path} ${isAdminRoute(route.path) ? 404 : 401}`,
      ),
    )
  })

  test("the API refuses to start when Google's discovery document cannot be read", async ({
    web,
  }) => {
    const google = await startFakeGoogle()
    await google.close()

    const starting = createTestAuth(web, google)

    await expect(starting).rejects.toThrow('Sign-in with Google is unavailable')
  })
})
