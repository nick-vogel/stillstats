import type { Environment } from '@creator-analytics/api-types'
import type { Reporter } from '@creator-analytics/reporter'
import type { Context, MiddlewareHandler } from 'hono'
import { createRemoteJWKSet, errors, type JWTVerifyGetKey, jwtVerify } from 'jose'
import { stripeEventsPath } from './routes/stripe-events.ts'

/** Where staging's Access tokens come from, and which Access application they are for. */
export interface CloudflareAccessSettings {
  /** `https://<team domain>`, the `iss` of every token the team signs. */
  issuer: string
  /** The Access application's AUD tag, the `aud` of its tokens. */
  audience: string
  /** The team's public keys, which Cloudflare rotates. */
  certsUrl: URL
}

/**
 * The Access settings of staging, which a request to main-box's IP with the staging host header
 * reaches without Cloudflare (creator-analytics#593). Production checks no token and reads neither.
 */
export function cloudflareAccessSettingsOf(
  env: Readonly<Record<string, string | undefined>>,
  environment: Environment,
): CloudflareAccessSettings | undefined {
  if (environment === 'production') return undefined
  const teamDomain = env.CLOUDFLARE_ACCESS_TEAM_DOMAIN
  const audience = env.CLOUDFLARE_ACCESS_AUD
  // Read at start, as Stripe's are (ADR 0015): a missing value stops the API, where a wrong one
  // would refuse every request on an issuer or audience mismatch.
  if (!teamDomain) throw new Error('CLOUDFLARE_ACCESS_TEAM_DOMAIN is not set')
  if (!audience) throw new Error('CLOUDFLARE_ACCESS_AUD is not set')
  if (/[/:]/.test(teamDomain))
    throw new Error(
      'CLOUDFLARE_ACCESS_TEAM_DOMAIN is the bare team domain, such as <team>.cloudflareaccess.com, with no scheme, port or path',
    )
  const issuer = `https://${teamDomain}`
  return { issuer, audience, certsUrl: new URL('/cdn-cgi/access/certs', issuer) }
}

// The token's own fault: a refused request, never an outage. Any other failure, such as the team's
// keys out of reach, still refuses the request, and is reported so it does not read as a run of
// bad tokens.
const refusedToken = [
  errors.JWSInvalid,
  errors.JWTInvalid,
  errors.JWSSignatureVerificationFailed,
  errors.JWTClaimValidationFailed,
  // Not a JWTClaimValidationFailed in jose 6, so named on its own.
  errors.JWTExpired,
  errors.JWKSNoMatchingKey,
  errors.JWKSMultipleMatchingKeys,
  errors.JOSEAlgNotAllowed,
  errors.JOSENotSupported,
]

/** The API's Access check on staging: the team's issuer, the application's AUD tag, its keys. */
export interface CloudflareAccess {
  issuer: string
  audience: string
  keys: JWTVerifyGetKey
}

/**
 * Stripe's webhook, the one request let through with no token: Stripe cannot send one, and the
 * route's own signature check refuses any delivery Stripe did not sign. `c.req.path` is the path
 * Hono's router matches on, with no query string and decoded as the router decodes it, so a request
 * this lets through reaches the Stripe route and no other.
 */
function isStripeWebhook(c: Context): boolean {
  return c.req.method === 'POST' && c.req.path === stripeEventsPath
}

/**
 * Refuses, with 403 and no body, any request but Stripe's webhook whose `Cf-Access-Jwt-Assertion`
 * Cloudflare's team did not sign for this application. The header, never the `CF_Authorization`
 * cookie, which Cloudflare does not guarantee to pass.
 */
export function cloudflareAccessCheck(
  { issuer, audience, keys }: CloudflareAccess,
  reporter: Reporter,
): MiddlewareHandler {
  return async (c, next) => {
    if (isStripeWebhook(c)) return next()
    const token = c.req.header('cf-access-jwt-assertion')
    if (!token) return c.body(null, 403)
    try {
      // RS256 only, the algorithm Cloudflare signs Access tokens with, so no other is tried.
      await jwtVerify(token, keys, { issuer, audience, algorithms: ['RS256'] })
    } catch (error) {
      // No token and no claim in the report: the method alone, as a path can hold a channel's id.
      if (!refusedToken.some((refused) => error instanceof refused))
        reporter.report({
          message: 'The Cloudflare Access check could not verify a token',
          context: { method: c.req.method },
          error,
        })
      return c.body(null, 403)
    }
    await next()
  }
}

/** The team's keys from its certs URL, fetched at the first check and again as Cloudflare rotates. */
export function cloudflareAccessKeys({ certsUrl }: CloudflareAccessSettings): JWTVerifyGetKey {
  return createRemoteJWKSet(certsUrl)
}
