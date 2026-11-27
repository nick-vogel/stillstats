import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto'
import {
  connectionIdentifiers,
  connectionRoster,
  connections,
  consentStates,
  type DeletionReason,
  type GoogleIdentifierKind,
  type GrantedScope,
  type JobData,
  jobDataOf,
  type Scoped,
  securityEvents,
  setting,
} from '@creator-analytics/database'
import type { Reporter } from '@creator-analytics/reporter'
import { requestDeletion } from '@creator-analytics/retention-engine'
import { and, eq, lt } from 'drizzle-orm'
import { decryptToken, encryptToken, type TokenKeys } from './encryption.ts'

export const scopeUrls = {
  'youtube.readonly': 'https://www.googleapis.com/auth/youtube.readonly',
  'yt-analytics.readonly': 'https://www.googleapis.com/auth/yt-analytics.readonly',
  'yt-analytics-monetary.readonly':
    'https://www.googleapis.com/auth/yt-analytics-monetary.readonly',
} as const

export type ScopeName = keyof typeof scopeUrls

/**
 * The longest the API waits on one Google call, a YouTube call the gateway makes or a call to
 * Google's token or revocation endpoint, before it ends it as a call Google did not answer. Under
 * the extension's 15 s (`apiAnswerWithinMs` in apps/extension/src/product-api.ts), with room left
 * for the request's database work, so a request whose one Google call does not answer ends on
 * `google_failed` before the extension gives up. The bound is per call: a request whose several
 * calls each answer slowly can still outlast the extension. A Google call that answers normally
 * takes well under it.
 */
export const googleCallTimeoutMs = 10_000

/**
 * Google's own endpoints, from its OAuth 2.0 web server guide, checked 2026-10-03; the revocation
 * endpoint checked 2026-10-04.
 */
export const googleOAuthEndpoints = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
}

// Read-only scopes only, so the product can never change anything on a channel. Revenue is a
// consent step of its own, never part of the connection.
const connectionScopes: ScopeName[] = ['youtube.readonly', 'yt-analytics.readonly']

/**
 * The screens a connect may land the web app on, other than its first: the upgrade screen, for a
 * connect begun on its way there (creator-analytics#907). A name, never an address, so no consent
 * can send the browser anywhere the API does not name itself.
 */
export const consentLandings = ['upgrade'] as const
export type ConsentLanding = (typeof consentLandings)[number]

/**
 * What a consent asks Google for: a channel's connection, with the screen it lands on when that is
 * not the web app's first, or revenue reads for a connected one.
 */
export type ConsentIntent =
  | { purpose: 'connect'; landing?: ConsentLanding }
  | { purpose: 'revenue'; channelId: string }

/**
 * The Google account a consent starts with: the signed-in user's, named by its email as
 * `login_hint`, or Google's account chooser, so the creator can pick a channel held under another
 * Google account.
 */
export type ConsentAccount = { loginHint: string } | 'choose'

// openid brings the ID token the Google subject is read from. Google's RISC page: "You only
// receive security event tokens for Google users who have granted your service permission to
// access their profile information or email addresses."
const identityScopes = ['openid', 'email']

const requestedScopes: Record<ConsentIntent['purpose'], ScopeName[]> = {
  connect: connectionScopes,
  revenue: ['yt-analytics-monetary.readonly'],
}

// The revenue grant replaces the connection's tokens, so it must hold the connection's scopes too.
const requiredScopes: Record<ConsentIntent['purpose'], ScopeName[]> = {
  connect: connectionScopes,
  revenue: [...connectionScopes, ...requestedScopes.revenue],
}

const consentLifetimeMs = 10 * 60 * 1000

// A token this close to its expiry is refreshed first, so it cannot expire during the call.
const refreshMarginMs = 60 * 1000

export interface TokenVaultOptions {
  google: {
    authorizationEndpoint: string
    tokenEndpoint: string
    revocationEndpoint: string
    clientId: string
    clientSecret: string
  }
  /** The connection's own callback, registered with Google next to sign-in's. */
  redirectUri: string
  keys: TokenKeys
  /**
   * The HMAC key of a connection's Google identifiers, which a security event finds it by. A new
   * key leaves every stored connection unfindable until its next consent.
   */
  identifierKey: string
  reporter: Reporter
  /** The bound on one call to Google's token or revocation endpoint. Unset, `googleCallTimeoutMs`. */
  callTimeoutMs?: number | undefined
}

declare const unclaimed: unique symbol

/**
 * A completed consent that no channel holds yet. Its tokens live only in the vault's memory, so
 * nothing outside the vault can read or serialise them.
 */
export interface UnclaimedGrant {
  readonly [unclaimed]: true
  readonly scopes: readonly ScopeName[]
  readonly grantedAt: Date
}

/** A grant the YouTube gateway has read the channel of. */
export interface IdentifiedGrant {
  readonly grant: UnclaimedGrant
  readonly youtubeChannelId: string
}

/** A fresh access token for one Google call, usable only until that call returns. */
export interface GoogleAuthority {
  bearer(): string
}

export type ConsentCallback = Partial<Record<'state' | 'code' | 'error', string>>

export type ConsentRefusal = 'state_invalid' | 'consent_denied' | 'scopes_missing' | 'google_failed'
export type AuthorityRefusal = 'not_connected' | 'connection_revoked' | 'consent_missing'

/** Why a channel's connection ends at the creator's request, rather than on Google's side. */
export type DisconnectReason = Extract<DeletionReason, 'in_app_revocation' | 'user_deletion'>

/**
 * Each form Google's RISC page names a refresh token by, as the identifier kind it is stored
 * under and the identifier computed from the token.
 */
const tokenIdentifiers = {
  prefix: { kind: 'refresh_token_prefix', of: (token: string) => token.slice(0, 16) },
  hash_base64_sha512_sha512: {
    kind: 'refresh_token_hash',
    of: (token: string) => sha512(sha512(token)).toString('base64'),
  },
} as const satisfies Record<
  string,
  { kind: GoogleIdentifierKind; of: (refreshToken: string) => string }
>

export type TokenIdentifierAlg = keyof typeof tokenIdentifiers

export function isTokenIdentifierAlg(value: unknown): value is TokenIdentifierAlg {
  return typeof value === 'string' && Object.hasOwn(tokenIdentifiers, value)
}

/** A grant Google revoked, by the identifier its security event names it with. */
export type RevokedGrant =
  | { by: 'subject'; sub: string }
  | { by: 'refresh_token'; identifierAlg: TokenIdentifierAlg; token: string }

export interface ConnectionStatus {
  state: 'active' | 'revoked'
  scopes: readonly { name: ScopeName; grantedAt: string }[]
}

export interface TokenVault {
  /**
   * A revenue intent names a channel the caller has checked the user holds. Nothing stores the
   * login hint.
   */
  beginConsent(
    tx: Scoped<'user'>,
    intent: ConsentIntent,
    account: ConsentAccount,
  ): Promise<{ authorizationUrl: string }>
  /**
   * The grant and the intent its consent began with. A refusal names the intent too, except
   * `state_invalid`, whose intent is unknown. A `google_failed` refusal says what Google's token
   * endpoint answered the code exchange: `none` for an outage, and `unusable` for a 200 with no
   * refresh token, or with an ID token that names no subject or does not parse. Nothing is stored
   * for either.
   */
  completeConsent(
    tx: Scoped<'user'>,
    callback: ConsentCallback,
  ): Promise<
    | { ok: true; intent: ConsentIntent; grant: UnclaimedGrant }
    | { ok: false; refusal: Exclude<ConsentRefusal, 'google_failed'>; intent?: ConsentIntent }
    | { ok: false; refusal: 'google_failed'; intent: ConsentIntent; answer: 'none' | 'unusable' }
  >
  /**
   * For accounts and memberships only: stores the grant as the channel's connection. It stores the
   * connection scopes, and a revenue scope only when the active connection already held it. Each
   * scope the connection held keeps the time it was granted.
   */
  attach(tx: Scoped<'user'>, channelId: string, grant: IdentifiedGrant): Promise<void>
  /**
   * For accounts only: replaces an active connection's tokens with a revenue grant's, which holds
   * the connection's scopes and more. Each scope the connection held keeps the time it was
   * granted, and each new scope records the grant's time. A refusal changes nothing.
   */
  addScopes(
    tx: Scoped<'user'>,
    channelId: string,
    grant: IdentifiedGrant,
  ): Promise<{ ok: true } | { ok: false; refusal: 'not_connected' | 'connection_revoked' }>
  /** The connection's state and granted scopes, or null for a channel with no connection. */
  status(tx: Scoped<'user' | 'channel'>, channelId: string): Promise<ConnectionStatus | null>
  /**
   * Ends the channel's connection: revokes its grant at Google, marks it revoked and requests the
   * channel's deletion. A revoke Google does not confirm is reported, and the deletion still
   * happens. `revokedAtGoogle` is false only for such a revoke.
   */
  disconnect(
    tx: Scoped<'user' | 'channel'>,
    channelId: string,
    reason: DisconnectReason,
  ): Promise<{ revokedAtGoogle: boolean }>
  /**
   * For the RISC receiver only, with grants from a verified security event: records each one as an
   * HMAC of its identifier and enqueues the job that finds the connections it names.
   */
  receiveRevocations(tx: Scoped<'anonymous'>, revoked: RevokedGrant[]): Promise<void>
  /**
   * For the YouTube gateway only. A refresh Google refuses with invalid_grant marks the connection
   * revoked, requests the channel's deletion as google_revocation, and is refused with
   * `connection_revoked`; the caller's transaction commits both.
   */
  withAuthority<T>(
    tx: Scoped<'user' | 'channel'>,
    source: string | UnclaimedGrant,
    needs: ScopeName[],
    call: (authority: GoogleAuthority) => Promise<T>,
  ): Promise<{ ok: true; value: T } | { ok: false; refusal: AuthorityRefusal }>
}

interface Tokens {
  accessToken: string
  accessTokenExpiresAt: Date
  refreshToken: string
}

interface TokenResponse {
  access_token: string
  expires_in: number
  refresh_token?: string
  scope?: string
  id_token?: string
}

/** A completed consent's tokens, and the Google subject its ID token names. */
interface GrantSecrets extends Tokens {
  subject: string
}

/**
 * The `sub` of an ID token, read without a signature check: Google's OpenID Connect page allows
 * that for an ID token that comes straight from its token endpoint over HTTPS. A payload that does
 * not parse, or is not an object, names no subject.
 */
function subjectOf(idToken: string | undefined): string | undefined {
  const payload = idToken?.split('.')[1]
  if (!payload) return undefined
  try {
    const claims: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString())
    const sub = isJsonObject(claims) ? claims.sub : undefined
    return typeof sub === 'string' ? sub : undefined
  } catch {
    return undefined
  }
}

function sha512(value: string | Buffer): Buffer {
  return createHash('sha512').update(value).digest()
}

class GoogleRefusedGrantError extends Error {}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Google's token endpoint gave no answer to a call: no connection, no answer or no full body within
 * the bound, a 200 whose body is not a JSON object or lacks an access token or a lifetime, a 5xx
 * or a 429 (whatever its body). The YouTube gateway ends a read that meets it, and
 * `completeConsent` a consent's code exchange, as a Google outage (`google_failed`).
 */
export class TokenEndpointUnansweredError extends Error {}

function scopeNamesOf(scope: string | undefined): ScopeName[] {
  const granted = new Set(scope?.split(' '))
  return (Object.keys(scopeUrls) as ScopeName[]).filter((name) => granted.has(scopeUrls[name]))
}

function statusOf(stored: { status: 'active' | 'revoked'; scopes: GrantedScope[] }) {
  const scopes = stored.scopes.map(({ name, grantedAt }) => ({
    name: name as ScopeName,
    grantedAt,
  }))
  return { state: stored.status, scopes }
}

/** The scopes with the grant's time, except each one the connection held, which keeps its own. */
function keepingEarlierGrantTimes(
  scopes: readonly ScopeName[],
  grantedAt: Date,
  held: readonly GrantedScope[],
): GrantedScope[] {
  const earlier = new Map(held.map(({ name, grantedAt }) => [name, grantedAt]))
  return scopes.map((name) => ({ name, grantedAt: earlier.get(name) ?? grantedAt.toISOString() }))
}

function grants(scopes: readonly ScopeName[], needs: ScopeName[]): boolean {
  return needs.every((name) => scopes.includes(name))
}

/** Why a connection in this state cannot read with these scopes, or undefined when it can. */
export function authorityRefusal(
  status: ConnectionStatus | null,
  needs: ScopeName[],
): AuthorityRefusal | undefined {
  if (!status) return 'not_connected'
  if (status.state === 'revoked') return 'connection_revoked'
  const granted = status.scopes.map((scope) => scope.name)
  if (!grants(granted, needs)) return 'consent_missing'
  return undefined
}

function expiresAt(now: Date, response: TokenResponse): Date {
  return new Date(now.getTime() + response.expires_in * 1000)
}

/**
 * The one step every end of a connection comes to: an in-app disconnect, a RISC event, an
 * invalid_grant and a failed probe. The connection serves nothing from here on, and its channel is
 * deleted.
 */
async function markRevoked(
  tx: Scoped<'user' | 'channel'>,
  channelId: string,
  reason: DeletionReason,
): Promise<void> {
  await tx.sql
    .update(connections)
    .set({ status: 'revoked' })
    .where(eq(connections.channelId, channelId))
  await requestDeletion(tx, channelId, reason)
}

export function securityEventJobData(data: JobData) {
  return jobDataOf('securityEvent', data, 'eventId')
}

export function probeConnectionJobData(data: JobData) {
  return jobDataOf('probeConnection', data, 'channelId')
}

export function googleRevocationJobData(data: JobData) {
  return jobDataOf('googleRevocation', data, 'channelId')
}

/**
 * The securityEvent job: enqueues a googleRevocation job for each channel whose connection the
 * event names, then deletes the event, as Google's RISC terms ask of received events.
 */
export async function fanOutSecurityEvent(
  tx: Scoped<'system'>,
  { eventId }: { eventId: string },
): Promise<void> {
  const [event] = await tx.sql.select().from(securityEvents).where(eq(securityEvents.id, eventId))
  if (!event) return
  const named = await tx.sql
    .select({ channelId: connectionIdentifiers.channelId })
    .from(connectionIdentifiers)
    .where(
      and(eq(connectionIdentifiers.kind, event.kind), eq(connectionIdentifiers.hmac, event.hmac)),
    )
  for (const { channelId } of named) await tx.enqueue('googleRevocation', { channelId })
  await tx.sql.delete(securityEvents).where(eq(securityEvents.id, eventId))
}

const probeSlotSeconds = 24 * 60 * 60

/**
 * The daily probeRoster job: enqueues a probeConnection job for each active connection. The probe
 * of a channel is throttled to one per UTC day, so a roster job that runs again that day probes no
 * channel twice.
 */
export async function enqueueConnectionProbes(tx: Scoped<'system'>): Promise<void> {
  for (const { channelId } of await connectionRoster(tx)) {
    await tx.enqueue(
      'probeConnection',
      { channelId },
      { throttle: { key: channelId, seconds: probeSlotSeconds } },
    )
  }
}

/** The googleRevocation job: Google has already ended the grant, so nothing is revoked there. */
export async function markRevokedByGoogle(
  tx: Scoped<'channel'>,
  { channelId }: { channelId: string },
): Promise<void> {
  // A channel deleted since the event has no connection, and no deletion left to request.
  const [connected] = await tx.sql
    .select({ channelId: connections.channelId })
    .from(connections)
    .where(eq(connections.channelId, channelId))
  if (connected) await markRevoked(tx, channelId, 'google_revocation')
}

interface GoogleTokenOptions {
  google: Pick<TokenVaultOptions['google'], 'tokenEndpoint' | 'clientId' | 'clientSecret'>
  keys: TokenKeys
  /** Unset, `googleCallTimeoutMs`. */
  callTimeoutMs?: number | undefined
}

/** The calls to Google's token endpoint, and the sealing of the tokens it issues. */
function googleTokens({ google, keys, callTimeoutMs = googleCallTimeoutMs }: GoogleTokenOptions) {
  function unanswered(cause: unknown, message = 'Google did not answer a token endpoint call') {
    return new TokenEndpointUnansweredError(message, { cause })
  }

  async function requestToken(form: Record<string, string>): Promise<TokenResponse> {
    const response = await fetch(google.tokenEndpoint, {
      method: 'POST',
      body: new URLSearchParams({
        ...form,
        client_id: google.clientId,
        client_secret: google.clientSecret,
      }),
      signal: AbortSignal.timeout(callTimeoutMs),
    }).catch((error: unknown) => {
      throw unanswered(error)
    })
    // A body that stalls past the bound, or a 200 whose body is not a JSON object or lacks an access
    // token or a lifetime, is no answer either.
    if (response.ok) {
      const body: unknown = await response.json().catch((error: unknown) => {
        throw unanswered(error)
      })
      if (!isJsonObject(body)) {
        throw unanswered(
          undefined,
          "Google's token endpoint answered a 200 whose body is not a JSON object",
        )
      }
      if (typeof body.access_token !== 'string' || !Number.isFinite(body.expires_in)) {
        throw unanswered(
          undefined,
          "Google's token endpoint answered a 200 without an access token or a lifetime",
        )
      }
      return body as unknown as TokenResponse
    }
    const refusal: unknown = await response.json().catch((cause: unknown) => {
      if (cause instanceof DOMException && cause.name === 'TimeoutError') throw unanswered(cause)
      return {}
    })
    // Only a JSON object names an error; any other body falls to the status rules below.
    const error =
      isJsonObject(refusal) && typeof refusal.error === 'string' ? refusal.error : undefined
    if (error === 'invalid_grant') throw new GoogleRefusedGrantError()
    const message = `Google's token endpoint answered ${response.status} ${error ?? ''}`.trim()
    // A 5xx is Google's own failure, and a 429 Google's own rate limit: an outage like no answer
    // at all.
    if (response.status >= 500 || response.status === 429) throw unanswered(undefined, message)
    throw new Error(message)
  }

  function sealed(channelId: string, tokens: Tokens) {
    const refresh = encryptToken(keys, tokens.refreshToken, channelId)
    const access = encryptToken(keys, tokens.accessToken, channelId)
    return {
      refreshToken: refresh.ciphertext,
      accessToken: access.ciphertext,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      keyVersion: keys.current,
    }
  }

  /**
   * The stored connection's tokens, refreshed through Google `always` or `when_expiring`, when the
   * access token is about to expire, and stored again when they changed or were sealed under an
   * older key. Null when Google refuses the refresh with invalid_grant: a revocation in the creator's
   * Google settings, so the connection is marked revoked and its channel's deletion requested.
   */
  async function renewedTokens(
    tx: Scoped<'user' | 'channel'>,
    channelId: string,
    stored: typeof connections.$inferSelect,
    refresh: 'always' | 'when_expiring',
  ): Promise<Tokens | null> {
    const { keyVersion } = stored
    const tokens: Tokens = {
      accessToken: decryptToken(keys, { ciphertext: stored.accessToken, keyVersion }, channelId),
      accessTokenExpiresAt: stored.accessTokenExpiresAt,
      refreshToken: decryptToken(keys, { ciphertext: stored.refreshToken, keyVersion }, channelId),
    }
    let fresh = tokens
    const expiring = tokens.accessTokenExpiresAt.getTime() - refreshMarginMs <= tx.now.getTime()
    if (refresh === 'always' || expiring) {
      try {
        const response = await requestToken({
          grant_type: 'refresh_token',
          refresh_token: tokens.refreshToken,
        })
        fresh = {
          ...tokens,
          accessToken: response.access_token,
          accessTokenExpiresAt: expiresAt(tx.now, response),
        }
      } catch (error) {
        if (!(error instanceof GoogleRefusedGrantError)) throw error
        await markRevoked(tx, channelId, 'google_revocation')
        return null
      }
    }
    if (fresh !== tokens || keyVersion !== keys.current) {
      await tx.sql
        .update(connections)
        .set(sealed(channelId, fresh))
        .where(eq(connections.channelId, channelId))
    }
    return fresh
  }

  return { requestToken, sealed, renewedTokens }
}

/** For the probeConnection job only, so the worker holds no secret a probe does not use. */
export interface ConnectionProbe {
  /**
   * Refreshes an active connection's access token through Google, which spends no YouTube quota.
   * An invalid_grant marks the connection revoked and requests the channel's deletion as
   * google_revocation. A revoked or missing connection calls Google for nothing.
   */
  probe(tx: Scoped<'channel'>, channelId: string): Promise<void>
}

export function createConnectionProbe(options: GoogleTokenOptions): ConnectionProbe {
  const { renewedTokens } = googleTokens(options)
  return {
    async probe(tx, channelId) {
      const [stored] = await tx.sql
        .select()
        .from(connections)
        .where(eq(connections.channelId, channelId))
      if (stored?.status !== 'active') return
      await renewedTokens(tx, channelId, stored, 'always')
    },
  }
}

async function readStatus(
  tx: Scoped<'user' | 'channel'>,
  channelId: string,
): Promise<ConnectionStatus | null> {
  const [stored] = await tx.sql
    .select({ status: connections.status, scopes: connections.scopes })
    .from(connections)
    .where(eq(connections.channelId, channelId))
  return stored ? statusOf(stored) : null
}

function authority(accessToken: string) {
  let valid = true
  return {
    bearer() {
      if (!valid) throw new Error('A Google authority was used outside its call')
      return accessToken
    },
    end() {
      valid = false
    },
  }
}

async function runWith<T>(accessToken: string, call: (authority: GoogleAuthority) => Promise<T>) {
  const granted = authority(accessToken)
  try {
    return { ok: true as const, value: await call({ bearer: granted.bearer }) }
  } finally {
    granted.end()
  }
}

/** The token vault's two methods the YouTube gateway calls. */
export type ConnectionAuthority = Pick<TokenVault, 'status' | 'withAuthority'>

/**
 * For the worker's YouTube gateway: the authority of a stored connection, built from the probe's
 * options, so the worker holds no secret a consent needs. It holds no grant, and a grant given as
 * the source throws: only the API runs a consent.
 */
export function createConnectionAuthority(options: GoogleTokenOptions): ConnectionAuthority {
  const { renewedTokens } = googleTokens(options)
  return {
    status: readStatus,
    async withAuthority(tx, source, needs, call) {
      if (typeof source !== 'string') {
        throw new Error('The worker holds no grant: only a stored connection gives it authority')
      }
      const [stored] = await tx.sql
        .select()
        .from(connections)
        .where(eq(connections.channelId, source))
      if (!stored) return { ok: false, refusal: 'not_connected' }
      const refusal = authorityRefusal(statusOf(stored), needs)
      if (refusal) return { ok: false, refusal }

      const fresh = await renewedTokens(tx, source, stored, 'when_expiring')
      if (!fresh) return { ok: false, refusal: 'connection_revoked' }
      return runWith(fresh.accessToken, call)
    },
  }
}

export function createTokenVault({
  google,
  redirectUri,
  keys,
  identifierKey,
  reporter,
  callTimeoutMs = googleCallTimeoutMs,
}: TokenVaultOptions): TokenVault {
  const grantTokens = new WeakMap<UnclaimedGrant, GrantSecrets>()
  const { requestToken, sealed } = googleTokens({ google, keys, callTimeoutMs })
  const connectionAuthority = createConnectionAuthority({ google, keys, callTimeoutMs })

  // The kind is part of the input, so no identifier of one kind matches an HMAC of another.
  function identifierHmac(kind: GoogleIdentifierKind, identifier: string): string {
    return createHmac('sha256', identifierKey).update(`${kind}:${identifier}`).digest('hex')
  }

  /** Replaces the channel's identifiers with the grant's: its subject and its refresh token's. */
  async function storeIdentifiers(tx: Scoped<'user'>, channelId: string, grant: GrantSecrets) {
    const { subject, refreshToken } = grant
    const identifiers: [GoogleIdentifierKind, string][] = [
      ['subject', subject],
      ...Object.values(tokenIdentifiers).map(({ kind, of }): [GoogleIdentifierKind, string] => [
        kind,
        of(refreshToken),
      ]),
    ]
    await tx.sql.delete(connectionIdentifiers).where(eq(connectionIdentifiers.channelId, channelId))
    await tx.sql.insert(connectionIdentifiers).values(
      identifiers.map(([kind, identifier]) => ({
        channelId,
        kind,
        hmac: identifierHmac(kind, identifier),
      })),
    )
  }

  function tokensOf(grant: UnclaimedGrant): GrantSecrets {
    const tokens = grantTokens.get(grant)
    if (!tokens) throw new Error('The grant did not come from this token vault')
    return tokens
  }

  /** Revokes a token at Google, and answers why Google did not confirm it, if it did not. */
  async function revokeAtGoogle(
    token: string,
  ): Promise<{ confirmed: true } | { confirmed: false; status: string }> {
    try {
      const response = await fetch(google.revocationEndpoint, {
        method: 'POST',
        body: new URLSearchParams({ token }),
        signal: AbortSignal.timeout(callTimeoutMs),
      })
      return response.ok
        ? { confirmed: true }
        : { confirmed: false, status: String(response.status) }
    } catch {
      return { confirmed: false, status: 'no_answer' }
    }
  }

  return {
    async beginConsent(tx, intent, account) {
      const state = randomBytes(32).toString('base64url')
      await tx.sql.delete(consentStates).where(lt(consentStates.expiresAt, tx.now))
      await tx.sql.insert(consentStates).values({
        state,
        userId: setting('app.user_id'),
        purpose: intent.purpose,
        channelId: intent.purpose === 'revenue' ? intent.channelId : null,
        landing: intent.purpose === 'connect' ? (intent.landing ?? null) : null,
        expiresAt: new Date(tx.now.getTime() + consentLifetimeMs),
      })
      const url = new URL(google.authorizationEndpoint)
      url.search = new URLSearchParams({
        client_id: google.clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: [
          ...identityScopes,
          ...requestedScopes[intent.purpose].map((name) => scopeUrls[name]),
        ].join(' '),
        // Incremental authorization: the grant holds every scope given before as well. The
        // revenue grant then keeps the connection's scopes, and a reconnect keeps revenue.
        include_granted_scopes: 'true',
        // A refresh token, issued again on every consent, so a reconnect replaces a lost one.
        access_type: 'offline',
        // Google's web server guide (developers.google.com/identity/protocols/oauth2/web-server):
        // `prompt` is a space-delimited list, `select_account` shows the account chooser, and the
        // login hint prefills the email or selects the matching session.
        ...(account === 'choose'
          ? { prompt: 'select_account consent' }
          : { prompt: 'consent', login_hint: account.loginHint }),
        state,
      }).toString()
      return { authorizationUrl: url.toString() }
    },

    async completeConsent(tx, callback) {
      const [consent] = callback.state
        ? await tx.sql
            .delete(consentStates)
            .where(eq(consentStates.state, callback.state))
            .returning({
              purpose: consentStates.purpose,
              channelId: consentStates.channelId,
              landing: consentStates.landing,
              expiresAt: consentStates.expiresAt,
            })
        : []
      if (!consent || consent.expiresAt <= tx.now) return { ok: false, refusal: 'state_invalid' }
      const intent: ConsentIntent =
        consent.purpose === 'revenue' && consent.channelId
          ? { purpose: 'revenue', channelId: consent.channelId }
          : { purpose: 'connect', ...(consent.landing ? { landing: consent.landing } : {}) }
      if (callback.error || !callback.code) {
        return { ok: false, refusal: 'consent_denied', intent }
      }

      let response: TokenResponse
      try {
        response = await requestToken({
          grant_type: 'authorization_code',
          code: callback.code,
          redirect_uri: redirectUri,
        })
      } catch (error) {
        // A code Google will not redeem is a consent that did not complete.
        if (error instanceof GoogleRefusedGrantError)
          return { ok: false, refusal: 'consent_denied', intent }
        // An outage ends the consent on the google_failed landing, not the API's error handler.
        if (error instanceof TokenEndpointUnansweredError)
          return { ok: false, refusal: 'google_failed', intent, answer: 'none' }
        throw error
      }
      const scopes = scopeNamesOf(response.scope)
      if (!grants(scopes, requiredScopes[intent.purpose])) {
        return { ok: false, refusal: 'scopes_missing', intent }
      }
      // The consent asks offline access and openid, so Google should send both. An answer without
      // either is one the consent cannot use, and it lands like an outage, not on the error handler.
      const subject = subjectOf(response.id_token)
      if (!response.refresh_token || !subject) {
        return { ok: false, refusal: 'google_failed', intent, answer: 'unusable' }
      }
      const grant = { scopes, grantedAt: tx.now } as unknown as UnclaimedGrant
      grantTokens.set(grant, {
        accessToken: response.access_token,
        accessTokenExpiresAt: expiresAt(tx.now, response),
        refreshToken: response.refresh_token,
        subject,
      })
      return { ok: true, intent, grant }
    },

    async attach(tx, channelId, { grant }) {
      const stored = await readStatus(tx, channelId)
      const held = stored?.state === 'active' ? stored.scopes : []
      // Google holds a grant per Google account, not per channel, so include_granted_scopes can
      // bring a revenue scope given for another channel. Only revenue this connection held stays.
      const kept = grant.scopes.filter(
        (name) => connectionScopes.includes(name) || held.some((scope) => scope.name === name),
      )
      const connection = {
        ...sealed(channelId, tokensOf(grant)),
        scopes: keepingEarlierGrantTimes(kept, grant.grantedAt, held),
        status: 'active' as const,
        connectedAt: grant.grantedAt,
      }
      const written = await tx.sql
        .insert(connections)
        .values({ channelId, ...connection })
        // A revoked connection stays revoked: its channel is waiting for its deletion (#14).
        .onConflictDoUpdate({
          target: connections.channelId,
          set: connection,
          setWhere: eq(connections.status, 'active'),
        })
        .returning({ channelId: connections.channelId })
      if (written.length > 0) await storeIdentifiers(tx, channelId, tokensOf(grant))
    },

    async addScopes(tx, channelId, { grant }) {
      const stored = await readStatus(tx, channelId)
      if (!stored) return { ok: false, refusal: 'not_connected' }
      if (stored.state === 'revoked') return { ok: false, refusal: 'connection_revoked' }
      const scopes = keepingEarlierGrantTimes(grant.scopes, grant.grantedAt, stored.scopes)
      const updated = await tx.sql
        .update(connections)
        .set({ ...sealed(channelId, tokensOf(grant)), scopes })
        .where(and(eq(connections.channelId, channelId), eq(connections.status, 'active')))
        .returning({ channelId: connections.channelId })
      if (updated.length > 0) await storeIdentifiers(tx, channelId, tokensOf(grant))
      return { ok: true }
    },

    status: readStatus,

    async receiveRevocations(tx, revoked) {
      for (const grant of revoked) {
        const [kind, identifier]: [GoogleIdentifierKind, string] =
          grant.by === 'subject'
            ? ['subject', grant.sub]
            : [tokenIdentifiers[grant.identifierAlg].kind, grant.token]
        const eventId = randomUUID()
        await tx.sql.insert(securityEvents).values({
          id: eventId,
          kind,
          hmac: identifierHmac(kind, identifier),
          receivedAt: tx.now,
        })
        await tx.enqueue('securityEvent', { eventId })
      }
    },

    async disconnect(tx, channelId, reason) {
      const [stored] = await tx.sql
        .select()
        .from(connections)
        .where(eq(connections.channelId, channelId))
      let revokedAtGoogle = true
      // A revoked connection's grant is already gone at Google, so only an active one is revoked.
      if (stored?.status === 'active') {
        const { keyVersion } = stored
        const refreshToken = decryptToken(
          keys,
          { ciphertext: stored.refreshToken, keyVersion },
          channelId,
        )
        // Google revokes the whole grant when it revokes its refresh token. The revoke is an HTTP
        // call, so it stands even if the disconnect's transaction later rolls back; the
        // connection's next refresh then meets invalid_grant (#16).
        const revoked = await revokeAtGoogle(refreshToken)
        if (!revoked.confirmed) {
          revokedAtGoogle = false
          reporter.report({
            message: 'Google did not confirm the revocation of a disconnected connection',
            context: { channelId, status: revoked.status },
          })
        }
      }
      await markRevoked(tx, channelId, reason)
      return { revokedAtGoogle }
    },

    async withAuthority(tx, source, needs, call) {
      if (typeof source !== 'string') {
        const { accessToken } = tokensOf(source)
        if (!grants(source.scopes, needs)) return { ok: false, refusal: 'consent_missing' }
        return runWith(accessToken, call)
      }
      return connectionAuthority.withAuthority(tx, source, needs, call)
    },
  }
}
