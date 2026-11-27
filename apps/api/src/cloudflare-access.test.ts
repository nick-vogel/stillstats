// Limits: the tokens here are signed with a local key and checked against a local key set, so
// these tests cannot prove that staging holds Cloudflare's real team domain and AUD tag, or that
// Traefik's direct path to main-box answers 403. A direct request to main-box's IP with the staging
// host header after the first staging deploy covers them (creator-analytics#593). Nor can they
// prove that Cloudflare's edge lets Stripe's webhook through: that is the Access application's
// Bypass policy for staging.stillstats.com/api/stripe/events, which a Stripe sandbox delivery to
// staging covers.
import { test } from '@creator-analytics/database/testing'
import { errors } from 'jose'
import { describe, expect } from 'vitest'
import { type FakeCloudflareAccess, fakeCloudflareAccess } from '../test/cloudflare-access.ts'
import { startApi } from '../test/start-api.ts'
import {
  checkoutSessionEvent,
  deliverStripeEvent,
  stripeSignatureOf,
  testStripe,
} from '../test/stripe.ts'
import { cloudflareAccessSettingsOf } from './cloudflare-access.ts'

const teamDomain = 'example.cloudflareaccess.com'
const aud = 'a-staging-application-aud-tag'

describe('seam 1: the Cloudflare Access settings', () => {
  test('on production, are not read', () => {
    expect(cloudflareAccessSettingsOf({}, 'production')).toBeUndefined()
  })

  test('on staging, give the issuer, the audience and the certs URL', () => {
    const settings = cloudflareAccessSettingsOf(
      { CLOUDFLARE_ACCESS_TEAM_DOMAIN: teamDomain, CLOUDFLARE_ACCESS_AUD: aud },
      'staging',
    )

    expect(settings).toEqual({
      issuer: 'https://example.cloudflareaccess.com',
      audience: aud,
      certsUrl: new URL('https://example.cloudflareaccess.com/cdn-cgi/access/certs'),
    })
  })

  test.for([
    ['CLOUDFLARE_ACCESS_TEAM_DOMAIN', { CLOUDFLARE_ACCESS_AUD: aud }],
    ['CLOUDFLARE_ACCESS_AUD', { CLOUDFLARE_ACCESS_TEAM_DOMAIN: teamDomain }],
    [
      'CLOUDFLARE_ACCESS_TEAM_DOMAIN',
      { CLOUDFLARE_ACCESS_TEAM_DOMAIN: '', CLOUDFLARE_ACCESS_AUD: aud },
    ],
    [
      'CLOUDFLARE_ACCESS_AUD',
      { CLOUDFLARE_ACCESS_TEAM_DOMAIN: teamDomain, CLOUDFLARE_ACCESS_AUD: '' },
    ],
  ] as const)('on staging, refuse to start without %s', ([name, env]) => {
    expect(() => cloudflareAccessSettingsOf(env, 'staging')).toThrow(`${name} is not set`)
  })

  test.for([`https://${teamDomain}`, `${teamDomain}/`, `${teamDomain}:443`])(
    'on staging, refuse a team domain that is not a bare host: %s',
    (value) => {
      expect(() =>
        cloudflareAccessSettingsOf(
          { CLOUDFLARE_ACCESS_TEAM_DOMAIN: value, CLOUDFLARE_ACCESS_AUD: aud },
          'staging',
        ),
      ).toThrow('CLOUDFLARE_ACCESS_TEAM_DOMAIN')
    },
  )
})

/** Every route class the check stands before: the health check, a public route, a signed-in
 * route, whose own check answers 401, and the RISC receiver, whose own check answers 400. */
const everyKindOfRoute = [
  ['GET', '/health'],
  ['GET', '/api/client-settings'],
  ['GET', '/api/me'],
  ['POST', '/api/risc/events'],
] as const

const anHourAgo = () => Math.floor(Date.now() / 1000) - 3600

function send(
  origin: string,
  [method, path]: readonly [string, string],
  headers: Record<string, string> = {},
): Promise<Response> {
  return fetch(new URL(path, origin), { method, headers })
}

describe('seam 2: the Cloudflare Access check', () => {
  test('on staging, lets a request with a valid token reach its route', async ({ web }) => {
    const team = await fakeCloudflareAccess()
    const { origin } = await startApi(web, { cloudflareAccess: team.access })
    const headers = { 'cf-access-jwt-assertion': await team.sign() }

    expect((await send(origin, ['GET', '/health'], headers)).status).toBe(200)
    expect((await send(origin, ['GET', '/api/client-settings'], headers)).status).toBe(200)
    // Past the check, the signed-in route's own check answers.
    expect((await send(origin, ['GET', '/api/me'], headers)).status).toBe(401)
  })

  test.for([
    ['no token', () => Promise.resolve(undefined)],
    ['a bad signature', (team) => team.sign({ foreignKey: true })],
    ['an expired token', (team) => team.sign({ expiresAt: anHourAgo() })],
    ['the wrong audience', (team) => team.sign({ audience: 'another-application-aud-tag' })],
    [
      'the wrong issuer',
      (team) => team.sign({ issuer: 'https://another-team.cloudflareaccess.com' }),
    ],
    ['a token that is not a JWT', () => Promise.resolve('not-a-token')],
  ] as const satisfies readonly (readonly [
    string,
    (team: FakeCloudflareAccess) => Promise<string | undefined>,
  ])[])(
    'on staging, refuses %s with 403 and no detail, before any route runs',
    async ([, tokenOf], { web }) => {
      const team = await fakeCloudflareAccess()
      const { origin, reporter } = await startApi(web, { cloudflareAccess: team.access })
      const token = await tokenOf(team)

      for (const route of everyKindOfRoute) {
        const response = await send(
          origin,
          route,
          token ? { 'cf-access-jwt-assertion': token } : {},
        )

        expect({ route, status: response.status, body: await response.text() }).toEqual({
          route,
          status: 403,
          body: '',
        })
      }
      // A refused token is the request's fault, not an outage to report.
      expect(reporter.reports).toEqual([])
    },
  )

  test("on staging, refuses a request when the team's keys are out of reach, and reports it without the token", async ({
    web,
  }) => {
    const team = await fakeCloudflareAccess()
    const { origin, reporter } = await startApi(web, {
      cloudflareAccess: {
        ...team.access,
        keys: () => Promise.reject(new errors.JWKSTimeout()),
      },
    })
    const token = await team.sign()

    const response = await send(origin, ['GET', '/health'], { 'cf-access-jwt-assertion': token })

    expect({ status: response.status, body: await response.text() }).toEqual({
      status: 403,
      body: '',
    })
    expect(reporter.reports).toEqual([
      {
        message: 'The Cloudflare Access check could not verify a token',
        context: { method: 'GET' },
        error: expect.any(errors.JWKSTimeout),
      },
    ])
    expect(JSON.stringify(reporter.reports)).not.toContain(token)
  })

  test('on staging, refuses a valid token sent only in the CF_Authorization cookie', async ({
    web,
  }) => {
    const team = await fakeCloudflareAccess()
    const { origin } = await startApi(web, { cloudflareAccess: team.access })

    const response = await send(origin, ['GET', '/health'], {
      cookie: `CF_Authorization=${await team.sign()}`,
    })

    expect(response.status).toBe(403)
  })

  test.for<[string, (body: string) => string | null]>([
    ['no signature', () => null],
    [
      'a signature made with another secret',
      (body) => stripeSignatureOf(body, { secret: 'whsec_another_secret' }),
    ],
  ])(
    "on staging, lets Stripe's webhook through with no token, to the route's own check, which refuses %s with 400",
    async ([, signatureOf], { web }) => {
      const team = await fakeCloudflareAccess()
      const api = await startApi(web, { stripe: testStripe, cloudflareAccess: team.access })
      const body = checkoutSessionEvent({ clientReferenceId: 'a-user' })

      const response = await deliverStripeEvent(api, body, signatureOf(body))

      expect(response.status).toBe(400)
    },
  )

  test.for([
    ['GET', '/api/stripe/events'],
    ['POST', '/api/stripe/events/anything'],
    ['POST', '/api/stripe/events/'],
    ['POST', '/api/stripe/eventsanything'],
    ['POST', '/anything/api/stripe/events'],
    ['POST', '/api/stripe%2Fevents'],
    ['POST', '/API/stripe/events'],
  ] as const)(
    "on staging, refuses %s %s with no token, as only Stripe's exact webhook is let through",
    async (route, { web }) => {
      const team = await fakeCloudflareAccess()
      const { origin } = await startApi(web, { stripe: testStripe, cloudflareAccess: team.access })

      const response = await send(origin, route)

      expect({ status: response.status, body: await response.text() }).toEqual({
        status: 403,
        body: '',
      })
    },
  )

  test('on production, lets a request with no token reach its route as today', async ({ web }) => {
    const { origin } = await startApi(web)

    expect((await send(origin, ['GET', '/health'])).status).toBe(200)
    expect((await send(origin, ['GET', '/api/client-settings'])).status).toBe(200)
  })
})
