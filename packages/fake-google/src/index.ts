import { createHash, randomBytes } from 'node:crypto'
import { once } from 'node:events'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { exportJWK, generateKeyPair, type JWK, SignJWT, UnsecuredJWT } from 'jose'
import {
  type Answer,
  type Asked,
  type ChannelData,
  type FakeChannel,
  type FakeReachReport,
  type FakeReachRow,
  type FakeReportingJob,
  type FakeRevenue,
  googleError,
} from './channel-data.ts'
import { channelsList } from './data-api/channels-list.ts'
import { playlistItemsList } from './data-api/playlist-items-list.ts'
import { videosList } from './data-api/videos-list.ts'
import { createJob, listJobs } from './reporting-api/jobs.ts'
import { downloadPath, listReports, reportFile, reportsListPath } from './reporting-api/reports.ts'
import {
  channelDevices,
  channelOperatingSystems,
  channelSubscriberSplit,
} from './reports/channel-breakdowns.ts'
import { channelCities } from './reports/channel-cities.ts'
import { channelCountries } from './reports/channel-countries.ts'
import { channelTotals } from './reports/channel-totals.ts'
import { channelUsStates } from './reports/channel-us-states.ts'
import { channelAgeGroups, channelGenders } from './reports/channel-viewer-shares.ts'
import { dailyRevenue } from './reports/daily-revenue.ts'
import { dailyTotals } from './reports/daily-totals.ts'
import { estimatedRevenue } from './reports/estimated-revenue.ts'
import type { Report } from './reports/report.ts'
import { revenueByContentType } from './reports/revenue-by-content-type.ts'
import { videoContentTypes } from './reports/video-content-types.ts'
import { videoDailyRows } from './reports/video-daily-rows.ts'
import { videoDetailReports } from './reports/video-detail.ts'
import { videoTotals } from './reports/video-totals.ts'

export type {
  ChannelNumbers,
  FakeChannel,
  FakeContentType,
  FakeRangeNumbers,
  FakeReachRow,
  FakeReportingJob,
  FakeRevenue,
  FakeUpload,
  RevenueNumbers,
  VideoNumbers,
} from './channel-data.ts'

/**
 * Google at the HTTP level, for every test that would otherwise call Google. It answers the
 * OpenID discovery document, the OAuth authorization, token, userinfo and revocation endpoints,
 * the signing keys, the RISC configuration and signed security events, the YouTube Data API's
 * `channels.list` with `mine=true`, `playlistItems.list` of the uploads playlist and
 * `videos.list` with the parts `id`, `status` and `contentDetails`, and the Analytics API's
 * `reports.query` for each report in `reports/`, and the Reporting API's `jobs.list`,
 * `jobs.create`, `jobs.reports.list` and the report files their download URLs name. It answers 400 to a report it does not support,
 * the way Google answers 400 to a query it cannot serve; Google serves some reports the fake
 * refuses. A revenue report takes Google's `currency` parameter, and answers 400 to a code that is
 * not three upper-case letters; any other report ignores it, as Google does.
 *
 * It cannot prove Google's real behaviour: its consent screen, the exact scope strings Google
 * grants, or a change on Google's side. Nick signing in on the deployed product covers those.
 */
export interface FakeGoogle {
  readonly origin: string
  readonly discoveryUrl: string
  readonly clientId: string
  readonly clientSecret: string
  readonly authorizationEndpoint: string
  readonly tokenEndpoint: string
  readonly revocationEndpoint: string
  readonly riscConfigurationUrl: string
  /** The root URL every YouTube API client takes in place of Google's own. */
  readonly youtubeRootUrl: string
  /** The query of every authorization request, in the order they arrived. */
  readonly authorizationRequests: URLSearchParams[]
  readonly issuedAccessTokens: string[]
  readonly issuedRefreshTokens: string[]
  readonly revokedTokens: string[]
  /** The query of every Analytics API report request, in the order they arrived. */
  readonly analyticsRequests: URLSearchParams[]
  /** The URL of every Data API request, in the order they arrived. */
  readonly dataApiRequests: URL[]
  /** The method and path of every Reporting API request, such as `GET /v1/jobs`, in order. */
  readonly reportingRequests: string[]
  /** The id of every report file requested, in order, whatever the fake answered. */
  readonly reportDownloads: string[]
  /** Sets the Google user who completes the consent of every later authorization request. */
  signInAs(user: GoogleUser): void
  /**
   * Records scopes the signed-in Google user granted this client before. As in Google's
   * incremental authorization, only a request with `include_granted_scopes=true` adds them to its
   * token's scope.
   */
  grantedEarlier(scopes: string[]): void
  /** The signed-in Google user refuses every later consent. */
  refuseConsent(): void
  /** The signed-in Google user unchecks these scopes on every later consent screen. */
  uncheckScopes(scopes: string[]): void
  /**
   * The channel the signed-in Google user picks on every later consent screen, as Google asks a
   * user whose Google account holds several channels. Without a pick, the user has no channel.
   */
  pickChannel(youtubeChannelId: string): void
  /**
   * The channel's revenue: its total and sources over any range, by day, and the revenue YouTube
   * ties to no format. A format's revenue is its `formats` entry's, set with `setChannel`. The fake
   * converts nothing: a revenue report answers these amounts whatever its `currency`, so a test
   * sets them as the amounts in the currency it asks for.
   */
  setRevenue(youtubeChannelId: string, revenue: FakeRevenue): void
  /**
   * Whether the channel is in the YouTube Partner Program, as it is until set otherwise. The fake
   * answers a 403 to every revenue report of a channel outside it, as Google did in Nick's live
   * check of 2026-10-08. Google answers such a channel with zeros as often as with a 403 (Nick's
   * walk of 2026-10-10, #119 W21), which a test models with `setRevenue` zeros. The 403 carries
   * Google's generic reason, `forbidden`: no real 403 for such a channel has shown its reason yet.
   */
  setPartnerProgram(youtubeChannelId: string, member: boolean): void
  /**
   * Whether the channel's revenue reports answer their rows. Without them, every revenue report of
   * the channel answers 200 with its column headers and no rows, as Google answered a channel
   * outside the YouTube Partner Program in #119's walk (W21), in place of the 403 of
   * `setPartnerProgram`. A report with no revenue metric still answers its rows.
   */
  setRevenueRows(youtubeChannelId: string, answered: boolean): void
  /**
   * The channel's creation date and its uploads, with each video's numbers. A `dimensions=video`
   * report answers a video's `rangeMetrics` entry with the report's exact dates. Failing that, it
   * answers the video's lifetime numbers to a startDate on or before the channel's creation day in
   * Pacific Time, Google's reporting day, and omits the video otherwise. A video's numbers and days
   * carry its revenue, which a video report answers with revenue metrics only, in place of its
   * views, under the same rules as the channel's revenue: the monetary scope, the YouTube Partner
   * Program and the currency, which the fake converts nothing into. A channel-wide report filtered
   * to `creatorContentType==` one of `videoOnDemand`, `shorts` or `liveStream` answers that
   * format's `formats` entry, its totals, days, countries, devices, operating systems, subscribed
   * statuses, age groups and genders; any other content type filter answers 400. The channel's US
   * states and cities have no `formats` entry: a province or city report under a format filter
   * answers 400. A live check on Nick's channel on 2026-10-19 answered no Shorts rows for age group
   * or gender in the last 28 days, so a test that holds a `shorts` entry of either models a channel
   * unlike his; the same check answered Shorts rows for devices, operating systems and subscribed
   * status.
   */
  setChannel(youtubeChannelId: string, channel: FakeChannel): void
  /** The last day whose numbers every later report includes. */
  setLastProcessedDay(day: string): void
  /**
   * The Analytics API answers every later report request with this HTTP error status. With
   * `error`, the body carries Google's legacy error detail, `errors: [{ message, domain, reason }]`,
   * as Google's 403 for `quotaExceeded` does; without it, the message is `Backend Error` and the
   * body has no reason.
   */
  failAnalytics(status: number, error?: { reason: string; message: string }): void
  /**
   * Every later Data API request to this path, such as `/youtube/v3/playlistItems`, gets no
   * answer: the fake destroys its connection, as a network outage would.
   */
  dropDataApi(pathname: string): void
  /** Every later Analytics API report request gets no answer, as with `dropDataApi`. */
  dropAnalyticsApi(): void
  /** The Reporting API answers every later request with this HTTP error status. */
  failReporting(status: number): void
  /** Every later Reporting API request gets no answer, as with `dropDataApi`. */
  dropReportingApi(): void
  /**
   * A Reporting API job Google already holds for the channel, such as one created by a call whose
   * answer the product never stored.
   */
  setReportingJob(youtubeChannelId: string, job: FakeReportingJob): void
  /** The channel's Reporting API jobs, as Google holds them. */
  reportingJobsOf(youtubeChannelId: string): FakeReportingJob[]
  /**
   * A daily reach report Google generated for the channel, listed under each job the channel holds
   * and served as a CSV file. A second report for a day already added is Google's correction of
   * it. Returns the report's id.
   */
  addReachReport(
    youtubeChannelId: string,
    report: { day: string; createTime: string; rows: FakeReachRow[] },
  ): string
  /**
   * Every later report file request is answered with this HTTP error status, or, with null, with
   * its file again. Listing still answers.
   */
  failReportDownloads(status: number | null): void
  /** Every later report file request gets no answer, as with `dropDataApi`. */
  dropReportDownloads(): void
  /**
   * Answers at most `perMinute` report file requests in a minute of the fake's clock, and a 429
   * to every other one, with `retryAfter` as its Retry-After header when given. A minute starts at
   * the first request after the last one ended, as Google Cloud's per-minute quotas reset "one
   * minute after your first request in a rolling window" (the quotas overview at
   * docs.cloud.google.com/docs/quotas/overview, read 2026-11-23). A refused request uses none of
   * the minute's count. Listing still answers.
   */
  limitReportDownloads(perMinute: number, options?: { retryAfter?: string }): void
  /** Every later reports.list request, under a limit of its own, as with `limitReportDownloads`. */
  limitReportLists(perMinute: number, options?: { retryAfter?: string }): void
  /**
   * The fake's clock, which a report's 60 days are counted against. Unset, the system clock. Jobs
   * still take their creation time from the system clock.
   */
  setNow(now: Date): void
  /**
   * Every later Data API request to this path is taken and never answered: the connection stays
   * open with nothing written, as a Google that accepts a call and never replies. `close` ends it.
   */
  holdDataApi(pathname: string): void
  /** Every later Analytics API report request is taken and never answered, as with `holdDataApi`. */
  holdAnalyticsApi(): void
  /**
   * Each later Data API or Analytics API request calls the listener as it arrives, before it is
   * answered; null stops it. The fake has no latency of its own, so a test that stubs the clock
   * moves it here to stand for the time a call spends at Google.
   */
  onYouTubeApiRequest(listener: (() => void) | null): void
  /** The revocation endpoint answers every later request with this HTTP error status. */
  failRevocation(status: number): void
  /** Every later token endpoint request is taken and never answered, as with `holdDataApi`. */
  holdTokenEndpoint(): void
  /**
   * Every later token endpoint request is answered 200 with JSON headers and part of a body, then
   * held open with nothing more written, as a Google whose answer stalls mid-body. `close` ends it.
   */
  stallTokenEndpointBody(): void
  /** The token endpoint answers every later request with this HTTP error status. */
  failTokenEndpoint(status: number): void
  /**
   * Every later authorization code exchange answers 200 without a refresh token, even to an
   * offline grant, as Google would if it ignored `access_type=offline`. The grant is otherwise as
   * usual, scopes and ID token included, and no refresh token is recorded as issued. A refresh
   * token grant is unaffected.
   */
  withholdRefreshToken(): void
  /**
   * Every later authorization code exchange answers an ID token signed as usual but with no `sub`
   * claim. A refresh token grant is unaffected.
   */
  withholdIdTokenSubject(): void
  /**
   * Every later authorization code exchange answers its usual 200, refresh token and scopes
   * included, but with an ID token that is not a JWT Google would sign: its payload segment is not
   * JSON (`'not_json'`, the token `a.not-json.b`), or is JSON `null` (`'null'`). As before, only a
   * grant that includes openid carries an ID token. A refresh token grant is unaffected.
   */
  malformIdToken(payload: 'not_json' | 'null'): void
  /**
   * Every later token endpoint request is answered 200 with JSON headers and the body `null`, for
   * either grant, as a Google whose answer is JSON but not a token response.
   */
  answerTokenEndpointWithNull(): void
  /** Every later revocation request is taken and never answered, as with `holdDataApi`. */
  holdRevocation(): void
  /**
   * A security event token as Cross-Account Protection (RISC) posts one to a registered receiver,
   * or a forgery of one. Delivery is the test's: it posts the token itself.
   */
  securityEventToken(event: SecurityEvent, forgery?: SecurityEventForgery): Promise<string>
  close(): Promise<void>
}

export interface GoogleUser {
  sub: string
  email: string
  name: string
}

export type SecurityEvent =
  | {
      type:
        | 'tokens-revoked'
        | 'sessions-revoked'
        | 'account-disabled'
        | 'account-enabled'
        | 'account-credential-change-required'
      sub: string
    }
  | {
      type: 'token-revoked'
      refreshToken: string
      identifier: 'prefix' | 'hash_base64_sha512_sha512'
    }
  | { type: 'verification'; state: string }

export interface SecurityEventForgery {
  signing?: 'foreign-key' | 'unknown-key-id' | 'no-key-id' | 'unsigned'
  issuer?: string
  audience?: string
  /** Google's own tokens carry no exp; a test sets one to prove a receiver ignores it. */
  expiresAt?: Date
}

const eventTypeUris: Record<SecurityEvent['type'], string> = {
  'tokens-revoked': 'https://schemas.openid.net/secevent/oauth/event-type/tokens-revoked',
  'token-revoked': 'https://schemas.openid.net/secevent/oauth/event-type/token-revoked',
  'sessions-revoked': 'https://schemas.openid.net/secevent/risc/event-type/sessions-revoked',
  'account-disabled': 'https://schemas.openid.net/secevent/risc/event-type/account-disabled',
  'account-enabled': 'https://schemas.openid.net/secevent/risc/event-type/account-enabled',
  'account-credential-change-required':
    'https://schemas.openid.net/secevent/risc/event-type/account-credential-change-required',
  verification: 'https://schemas.openid.net/secevent/risc/event-type/verification',
}

interface PendingCode {
  user: GoogleUser
  redirectUri: string
  codeChallenge: string | null
  codeChallengeMethod: string
  nonce: string | null
  scopes: string[]
  includeGrantedScopes: boolean
  offline: boolean
  channelId: string | null
}

interface IssuedGrant {
  user: GoogleUser
  scopes: string[]
  channelId: string | null
}

const youtubeScopes = [
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/youtube.readonly',
]

const monetaryScope = 'https://www.googleapis.com/auth/yt-analytics-monetary.readonly'

const analyticsScopes = ['https://www.googleapis.com/auth/yt-analytics.readonly', monetaryScope]

const reports: Report[] = [
  estimatedRevenue,
  dailyRevenue,
  revenueByContentType,
  videoTotals,
  videoContentTypes,
  dailyTotals,
  ...videoDetailReports,
  channelTotals,
  channelCountries,
  channelUsStates,
  channelCities,
  channelAgeGroups,
  channelGenders,
  channelDevices,
  channelOperatingSystems,
  channelSubscriberSplit,
  videoDailyRows,
]

const dataApiEndpoints: Record<string, (asked: Asked) => Answer> = {
  '/youtube/v3/channels': channelsList,
  '/youtube/v3/playlistItems': playlistItemsList,
  '/youtube/v3/videos': videosList,
}

const keyId = 'fake-google-1'
type PrivateKey = Awaited<ReturnType<typeof generateKeyPair>>['privateKey']
let signingKeys: Promise<{ privateKey: PrivateKey; publicJwk: JWK }> | undefined
let foreignKey: Promise<PrivateKey> | undefined
let retiringJwk: Promise<JWK> | undefined

// One RSA key pair per test process: generating one costs tens of milliseconds.
function keys() {
  signingKeys ??= generateKeyPair('RS256').then(async ({ privateKey, publicKey }) => ({
    privateKey,
    publicJwk: { ...(await exportJWK(publicKey)), kid: keyId, alg: 'RS256', use: 'sig' },
  }))
  return signingKeys
}

// Google publishes more than one signing key, so a token without a key id matches several.
function retiringPublicJwk() {
  retiringJwk ??= generateKeyPair('RS256').then(async ({ publicKey }) => ({
    ...(await exportJWK(publicKey)),
    kid: 'fake-google-0',
    alg: 'RS256',
    use: 'sig',
  }))
  return retiringJwk
}

function foreignPrivateKey() {
  foreignKey ??= generateKeyPair('RS256').then(({ privateKey }) => privateKey)
  return foreignKey
}

function sha512(value: string | Buffer): Buffer {
  return createHash('sha512').update(value).digest()
}

function randomToken(): string {
  return randomBytes(24).toString('base64url')
}

/** A limit of `limitReportDownloads` or `limitReportLists`, and the minute it is counting. */
interface RequestLimit {
  perMinute: number
  retryAfter: string | undefined
  minute: { start: number; answered: number } | null
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body))
}

async function bodyText(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString()
}

async function formBody(req: IncomingMessage): Promise<URLSearchParams> {
  return new URLSearchParams(await bodyText(req))
}

async function jsonBody(req: IncomingMessage): Promise<unknown> {
  try {
    return JSON.parse(await bodyText(req))
  } catch {
    return undefined
  }
}

function clientCredentials(req: IncomingMessage, body: URLSearchParams) {
  const basic = req.headers.authorization?.match(/^Basic (.+)$/)?.[1]
  if (basic) {
    const [id, secret] = Buffer.from(basic, 'base64').toString().split(':').map(decodeURIComponent)
    return { id, secret }
  }
  return { id: body.get('client_id'), secret: body.get('client_secret') }
}

export async function startFakeGoogle(): Promise<FakeGoogle> {
  const { privateKey, publicJwk } = await keys()
  const publishedJwks = [publicJwk, await retiringPublicJwk()]
  const clientId = 'fake-client-id.apps.googleusercontent.com'
  const clientSecret = 'fake-client-secret'
  const authorizationRequests: URLSearchParams[] = []
  const issuedAccessTokens: string[] = []
  const issuedRefreshTokens: string[] = []
  const revokedTokens: string[] = []
  const analyticsRequests: URLSearchParams[] = []
  const dataApiRequests: URL[] = []
  const reportingRequests: string[] = []
  const reportDownloads: string[] = []
  const data: ChannelData = {
    revenue: new Map(),
    outsidePartnerProgram: new Set(),
    revenueWithoutRows: new Set(),
    channels: new Map(),
    lastProcessedDay: null,
    reportingJobs: new Map(),
    reachReports: new Map(),
  }
  let analyticsFailure: {
    status: number
    error: { reason: string; message: string } | undefined
  } | null = null
  const droppedDataApiPaths = new Set<string>()
  let analyticsDropped = false
  const heldDataApiPaths = new Set<string>()
  let analyticsHeld = false
  let youtubeApiListener: (() => void) | null = null
  let reportingFailure: number | null = null
  let reportingDropped = false
  let reportDownloadFailure: number | null = null
  let reportDownloadsDropped = false
  let reportDownloadLimit: RequestLimit | null = null
  let reportListLimit: RequestLimit | null = null
  let pinnedNow: Date | null = null
  let reachReportCount = 0
  let revocationFailure: number | null = null
  let tokenEndpointHeld = false
  let tokenEndpointBodyStalled = false
  let tokenEndpointFailure: number | null = null
  let refreshTokenWithheld = false
  let idTokenSubjectWithheld = false
  let idTokenMalformed: 'not_json' | 'null' | null = null
  let tokenEndpointAnsweredWithNull = false
  let revocationHeld = false
  const liveAccessTokens = new Map<string, IssuedGrant>()
  const liveRefreshTokens = new Map<string, IssuedGrant>()
  const grantedScopes = new Map<string, Set<string>>()
  const codes = new Map<string, PendingCode>()
  let signedIn: GoogleUser | undefined
  let refusing = false
  let unchecked = new Set<string>()
  let pickedChannel: string | null = null
  let origin = ''

  function discovery(res: ServerResponse) {
    json(res, 200, {
      issuer: origin,
      authorization_endpoint: `${origin}/o/oauth2/v2/auth`,
      token_endpoint: `${origin}/token`,
      userinfo_endpoint: `${origin}/v1/userinfo`,
      revocation_endpoint: `${origin}/revoke`,
      jwks_uri: jwksUri(),
      response_types_supported: ['code'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      code_challenge_methods_supported: ['plain', 'S256'],
    })
  }

  function jwksUri() {
    return `${origin}/oauth2/v3/certs`
  }

  // Google's RISC issuer, https://accounts.google.com/, differs from its OpenID issuer by the
  // trailing slash, so a receiver has to read it from this document.
  function riscIssuer() {
    return `${origin}/`
  }

  function eventSubject(event: SecurityEvent) {
    if (event.type === 'verification') return { state: event.state }
    if (event.type === 'token-revoked') {
      const token =
        event.identifier === 'prefix'
          ? event.refreshToken.slice(0, 16)
          : sha512(sha512(event.refreshToken)).toString('base64')
      return {
        subject: {
          subject_type: 'oauth_token',
          token_type: 'refresh_token',
          token_identifier_alg: event.identifier,
          token,
        },
      }
    }
    return { subject: { subject_type: 'iss-sub', iss: riscIssuer(), sub: event.sub } }
  }

  async function securityEventToken(event: SecurityEvent, forgery: SecurityEventForgery = {}) {
    const claims = { events: { [eventTypeUris[event.type]]: eventSubject(event) } }
    const issuer = forgery.issuer ?? riscIssuer()
    const audience = forgery.audience ?? clientId
    const jti = randomBytes(16).toString('hex')
    if (forgery.signing === 'unsigned') {
      return new UnsecuredJWT(claims)
        .setIssuer(issuer)
        .setAudience(audience)
        .setJti(jti)
        .setIssuedAt()
        .encode()
    }
    const kid = forgery.signing === 'unknown-key-id' ? 'fake-google-unpublished' : keyId
    const signed = new SignJWT(claims)
      .setProtectedHeader({
        alg: 'RS256',
        typ: 'secevent+jwt',
        ...(forgery.signing === 'no-key-id' ? {} : { kid }),
      })
      .setIssuer(issuer)
      .setAudience(audience)
      .setJti(jti)
      .setIssuedAt()
    if (forgery.expiresAt) signed.setExpirationTime(forgery.expiresAt)
    return signed.sign(forgery.signing === 'foreign-key' ? await foreignPrivateKey() : privateKey)
  }

  function authorize(url: URL, res: ServerResponse) {
    const query = url.searchParams
    authorizationRequests.push(query)
    const redirectUri = query.get('redirect_uri')
    if (query.get('client_id') !== clientId || !redirectUri) {
      json(res, 400, { error: 'invalid_request' })
      return
    }
    if (!signedIn) throw new Error('The fake Google server has no signed-in user: call signInAs')
    const callback = new URL(redirectUri)
    const state = query.get('state')
    if (refusing) {
      callback.searchParams.set('error', 'access_denied')
      if (state) callback.searchParams.set('state', state)
      res.writeHead(302, { location: callback.toString() }).end()
      return
    }
    const code = randomToken()
    codes.set(code, {
      user: signedIn,
      redirectUri,
      codeChallenge: query.get('code_challenge'),
      // RFC 7636: a challenge sent without a method is plain.
      codeChallengeMethod: query.get('code_challenge_method') ?? 'plain',
      nonce: query.get('nonce'),
      scopes: (query.get('scope') ?? '')
        .split(' ')
        .filter((scope) => scope && !unchecked.has(scope)),
      includeGrantedScopes: query.get('include_granted_scopes') === 'true',
      offline: query.get('access_type') === 'offline',
      channelId: pickedChannel,
    })
    callback.searchParams.set('code', code)
    if (state) callback.searchParams.set('state', state)
    res.writeHead(302, { location: callback.toString() }).end()
  }

  async function exchange(req: IncomingMessage, res: ServerResponse) {
    if (tokenEndpointHeld) return
    if (tokenEndpointBodyStalled) {
      res.writeHead(200, { 'content-type': 'application/json' }).flushHeaders()
      res.write('{"access_token":"')
      return
    }
    if (tokenEndpointFailure !== null) {
      json(res, tokenEndpointFailure, { error: 'backend_error' })
      return
    }
    if (tokenEndpointAnsweredWithNull) {
      json(res, 200, null)
      return
    }
    const body = await formBody(req)
    const client = clientCredentials(req, body)
    if (client.id !== clientId || client.secret !== clientSecret) {
      json(res, 401, { error: 'invalid_client' })
      return
    }
    if (body.get('grant_type') === 'refresh_token') {
      const issued = liveRefreshTokens.get(body.get('refresh_token') ?? '')
      if (!issued) {
        json(res, 400, { error: 'invalid_grant' })
        return
      }
      json(res, 200, {
        access_token: issueAccessToken(issued),
        expires_in: 3599,
        scope: issued.scopes.join(' '),
        token_type: 'Bearer',
      })
      return
    }
    const code = body.get('code') ?? ''
    const pending = codes.get(code)
    codes.delete(code)
    const verifier = body.get('code_verifier')
    const challengeMet =
      pending?.codeChallenge == null ||
      (verifier !== null &&
        (pending.codeChallengeMethod === 'S256'
          ? createHash('sha256').update(verifier).digest('base64url')
          : verifier) === pending.codeChallenge)
    if (
      body.get('grant_type') !== 'authorization_code' ||
      !pending ||
      body.get('redirect_uri') !== pending.redirectUri ||
      !challengeMet
    ) {
      json(res, 400, { error: 'invalid_grant' })
      return
    }
    const { user } = pending
    const unsigned = new SignJWT({
      email: user.email,
      email_verified: true,
      name: user.name,
      ...(pending.nonce ? { nonce: pending.nonce } : {}),
    })
      .setProtectedHeader({ alg: 'RS256', kid: keyId })
      .setIssuer(origin)
      .setAudience(clientId)
      .setIssuedAt()
      .setExpirationTime('1h')
    if (!idTokenSubjectWithheld) unsigned.setSubject(user.sub)
    const idToken =
      idTokenMalformed === 'not_json'
        ? 'a.not-json.b'
        : idTokenMalformed === 'null'
          ? `a.${Buffer.from('null').toString('base64url')}.b`
          : await unsigned.sign(privateKey)
    const earlier = grantedScopes.get(user.sub) ?? new Set<string>()
    const scope = pending.includeGrantedScopes
      ? [...new Set([...pending.scopes, ...earlier])]
      : pending.scopes
    grantedScopes.set(user.sub, new Set([...earlier, ...pending.scopes]))
    const issued = { user, scopes: scope, channelId: pending.channelId }
    const refreshToken = pending.offline && !refreshTokenWithheld ? randomToken() : undefined
    if (refreshToken) {
      issuedRefreshTokens.push(refreshToken)
      liveRefreshTokens.set(refreshToken, issued)
    }
    json(res, 200, {
      access_token: issueAccessToken(issued),
      expires_in: 3599,
      ...(refreshToken ? { refresh_token: refreshToken } : {}),
      scope: scope.join(' '),
      token_type: 'Bearer',
      // Google issues an ID token only to a grant that includes openid.
      ...(scope.includes('openid') ? { id_token: idToken } : {}),
    })
  }

  function issueAccessToken(issued: IssuedGrant): string {
    const accessToken = randomToken()
    issuedAccessTokens.push(accessToken)
    liveAccessTokens.set(accessToken, issued)
    return accessToken
  }

  function bearer(req: IncomingMessage): IssuedGrant | undefined {
    const accessToken = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1] ?? ''
    return liveAccessTokens.get(accessToken)
  }

  function answer(res: ServerResponse, { status, body }: Answer) {
    json(res, status, body)
  }

  function dataApi(req: IncomingMessage, url: URL, res: ServerResponse) {
    dataApiRequests.push(url)
    if (droppedDataApiPaths.has(url.pathname)) return void res.destroy()
    if (heldDataApiPaths.has(url.pathname)) return
    const issued = bearer(req)
    if (!issued) return answer(res, googleError(401, 'Invalid Credentials'))
    if (!issued.scopes.some((scope) => youtubeScopes.includes(scope))) {
      return answer(res, googleError(403, 'Insufficient Permission'))
    }
    const endpoint = dataApiEndpoints[url.pathname]
    if (!endpoint) return answer(res, googleError(404, 'The fake has no such Data API endpoint'))
    answer(res, endpoint({ query: url.searchParams, youtubeChannelId: issued.channelId, data }))
  }

  function report(req: IncomingMessage, url: URL, res: ServerResponse) {
    const query = url.searchParams
    analyticsRequests.push(query)
    if (analyticsDropped) return void res.destroy()
    if (analyticsHeld) return
    if (analyticsFailure !== null) {
      const { status, error } = analyticsFailure
      return answer(
        res,
        error === undefined
          ? googleError(status, 'Backend Error')
          : googleError(status, error.message, error.reason),
      )
    }
    const issued = bearer(req)
    if (!issued) return answer(res, googleError(401, 'Invalid Credentials'))
    if (!issued.scopes.some((scope) => analyticsScopes.includes(scope))) {
      return answer(res, googleError(403, 'Insufficient Permission'))
    }
    const supported = reports.find((candidate) => candidate.matches(query))
    if (!supported) return answer(res, googleError(400, 'The fake answers no such report'))
    if (supported.needsMonetaryScope(query)) {
      if (!issued.scopes.includes(monetaryScope)) {
        return answer(res, googleError(403, 'Insufficient Permission'))
      }
      if (issued.channelId && data.outsidePartnerProgram.has(issued.channelId)) {
        return answer(res, googleError(403, 'Forbidden', 'forbidden'))
      }
      // Google takes a code from its own list and refuses any other with a 400. The fake holds no
      // list, so it refuses only what cannot be an ISO 4217 code; the API checks Google's list.
      const currency = query.get('currency')
      if (currency !== null && !/^[A-Z]{3}$/.test(currency)) {
        return answer(res, googleError(400, 'Unsupported currency'))
      }
    }
    const body = supported.answer({ query, youtubeChannelId: issued.channelId, data })
    if (
      issued.channelId &&
      data.revenueWithoutRows.has(issued.channelId) &&
      supported.needsMonetaryScope(query)
    ) {
      const { rows: _rows, ...headers } = body as Record<string, unknown>
      return json(res, 200, headers)
    }
    json(res, 200, body)
  }

  /** Whether the limit answers one more request in its minute, which it then counts. */
  function withinLimit(limit: RequestLimit): boolean {
    const now = (pinnedNow ?? new Date()).getTime()
    if (limit.minute === null || now - limit.minute.start >= 60_000) {
      limit.minute = { start: now, answered: 0 }
    }
    if (limit.minute.answered >= limit.perMinute) return false
    limit.minute.answered += 1
    return true
  }

  /** Google's 429, with the limit's Retry-After when it has one. */
  function answerRateLimited(res: ServerResponse, { retryAfter }: RequestLimit) {
    if (retryAfter !== undefined) res.setHeader('retry-after', retryAfter)
    answer(
      res,
      googleError(
        429,
        'Too many requests have been sent within a given time span.',
        'rateLimitExceeded',
      ),
    )
  }

  async function reporting(req: IncomingMessage, url: URL, res: ServerResponse) {
    const route = `${req.method} ${url.pathname}`
    reportingRequests.push(route)
    const download = downloadPath.exec(url.pathname)?.[1]
    if (download !== undefined) {
      reportDownloads.push(download)
      if (reportDownloadsDropped) return void res.destroy()
      if (reportDownloadFailure !== null) {
        return answer(res, googleError(reportDownloadFailure, 'Backend Error'))
      }
      if (reportDownloadLimit !== null && !withinLimit(reportDownloadLimit)) {
        return answerRateLimited(res, reportDownloadLimit)
      }
    }
    if (reportingDropped) return void res.destroy()
    if (reportingFailure !== null)
      return answer(res, googleError(reportingFailure, 'Backend Error'))
    const issued = bearer(req)
    if (!issued) return answer(res, googleError(401, 'Invalid Credentials'))
    if (!issued.scopes.some((scope) => analyticsScopes.includes(scope)) || !issued.channelId) {
      return answer(res, googleError(403, 'Insufficient Permission'))
    }
    const asked = { youtubeChannelId: issued.channelId, data }
    const now = pinnedNow ?? new Date()
    if (route === 'GET /v1/jobs') return answer(res, listJobs(asked))
    if (route === 'POST /v1/jobs') return answer(res, createJob(asked, await jsonBody(req)))
    const jobId = reportsListPath.exec(url.pathname)?.[1]
    if (jobId) {
      if (reportListLimit !== null && !withinLimit(reportListLimit)) {
        return answerRateLimited(res, reportListLimit)
      }
      return answer(res, listReports(asked, jobId, url.searchParams, { origin, now }))
    }
    const reportId = downloadPath.exec(url.pathname)?.[1] ?? ''
    const file = reportFile(asked, reportId, now)
    if (typeof file !== 'string') return answer(res, file)
    res.writeHead(200, { 'content-type': 'text/csv' }).end(file)
  }

  function userinfo(req: IncomingMessage, res: ServerResponse) {
    const user = bearer(req)?.user
    if (!user) {
      json(res, 401, { error: 'invalid_request', error_description: 'Invalid Credentials' })
      return
    }
    json(res, 200, { sub: user.sub, email: user.email, email_verified: true, name: user.name })
  }

  async function revoke(req: IncomingMessage, res: ServerResponse) {
    if (revocationHeld) return
    if (revocationFailure !== null) {
      json(res, revocationFailure, { error: 'backend_error' })
      return
    }
    const revoked = (await formBody(req)).get('token') ?? ''
    if (!liveAccessTokens.delete(revoked) && !liveRefreshTokens.delete(revoked)) {
      json(res, 400, { error: 'invalid_token' })
      return
    }
    revokedTokens.push(revoked)
    res.writeHead(200).end()
  }

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', origin)
    const route = `${req.method} ${url.pathname}`
    const handled = (async () => {
      if (route === 'GET /.well-known/openid-configuration') return discovery(res)
      if (route === 'GET /.well-known/risc-configuration') {
        return json(res, 200, { issuer: riscIssuer(), jwks_uri: jwksUri() })
      }
      if (route === 'GET /o/oauth2/v2/auth') return authorize(url, res)
      if (route === 'POST /token') return exchange(req, res)
      if (route === 'GET /v1/userinfo') return userinfo(req, res)
      if (route === 'POST /revoke') return revoke(req, res)
      if (route === 'GET /oauth2/v3/certs') return json(res, 200, { keys: publishedJwks })
      if (req.method === 'GET' && url.pathname.startsWith('/youtube/v3/')) {
        youtubeApiListener?.()
        return dataApi(req, url, res)
      }
      if (route === 'GET /v2/reports') {
        youtubeApiListener?.()
        return report(req, url, res)
      }
      if (
        route === 'GET /v1/jobs' ||
        route === 'POST /v1/jobs' ||
        (req.method === 'GET' &&
          (reportsListPath.test(url.pathname) || downloadPath.test(url.pathname)))
      ) {
        return reporting(req, url, res)
      }
      json(res, 404, { error: 'not_found', route })
    })()
    handled.catch((error: unknown) => {
      json(res, 500, { error: 'fake_google_failed', message: String(error) })
    })
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

  return {
    origin,
    discoveryUrl: `${origin}/.well-known/openid-configuration`,
    clientId,
    clientSecret,
    authorizationEndpoint: `${origin}/o/oauth2/v2/auth`,
    tokenEndpoint: `${origin}/token`,
    revocationEndpoint: `${origin}/revoke`,
    riscConfigurationUrl: `${origin}/.well-known/risc-configuration`,
    youtubeRootUrl: `${origin}/`,
    authorizationRequests,
    issuedAccessTokens,
    issuedRefreshTokens,
    revokedTokens,
    analyticsRequests,
    dataApiRequests,
    reportingRequests,
    reportDownloads,
    signInAs(user) {
      signedIn = user
    },
    grantedEarlier(scopes) {
      if (!signedIn) throw new Error('The fake Google server has no signed-in user: call signInAs')
      const earlier = grantedScopes.get(signedIn.sub) ?? new Set<string>()
      grantedScopes.set(signedIn.sub, new Set([...earlier, ...scopes]))
    },
    refuseConsent() {
      refusing = true
    },
    uncheckScopes(scopes) {
      unchecked = new Set(scopes)
    },
    pickChannel(youtubeChannelId) {
      pickedChannel = youtubeChannelId
    },
    setRevenue(youtubeChannelId, revenue) {
      data.revenue.set(youtubeChannelId, revenue)
    },
    setPartnerProgram(youtubeChannelId, member) {
      if (member) data.outsidePartnerProgram.delete(youtubeChannelId)
      else data.outsidePartnerProgram.add(youtubeChannelId)
    },
    setRevenueRows(youtubeChannelId, answered) {
      if (answered) data.revenueWithoutRows.delete(youtubeChannelId)
      else data.revenueWithoutRows.add(youtubeChannelId)
    },
    setChannel(youtubeChannelId, channel) {
      data.channels.set(youtubeChannelId, channel)
    },
    setLastProcessedDay(day) {
      data.lastProcessedDay = day
    },
    failAnalytics(status, error) {
      analyticsFailure = { status, error }
    },
    dropDataApi(pathname) {
      droppedDataApiPaths.add(pathname)
    },
    dropAnalyticsApi() {
      analyticsDropped = true
    },
    failReporting(status) {
      reportingFailure = status
    },
    dropReportingApi() {
      reportingDropped = true
    },
    setReportingJob(youtubeChannelId, job) {
      const jobs = data.reportingJobs.get(youtubeChannelId) ?? []
      data.reportingJobs.set(youtubeChannelId, [...jobs, job])
    },
    reportingJobsOf(youtubeChannelId) {
      return [...(data.reportingJobs.get(youtubeChannelId) ?? [])]
    },
    addReachReport(youtubeChannelId, { day, createTime, rows }) {
      reachReportCount += 1
      const report: FakeReachReport = {
        id: `reach-report-${reachReportCount}`,
        day,
        createTime,
        rows,
      }
      data.reachReports.set(youtubeChannelId, [
        ...(data.reachReports.get(youtubeChannelId) ?? []),
        report,
      ])
      return report.id
    },
    failReportDownloads(status) {
      reportDownloadFailure = status
    },
    dropReportDownloads() {
      reportDownloadsDropped = true
    },
    limitReportDownloads(perMinute, options = {}) {
      reportDownloadLimit = { perMinute, retryAfter: options.retryAfter, minute: null }
    },
    limitReportLists(perMinute, options = {}) {
      reportListLimit = { perMinute, retryAfter: options.retryAfter, minute: null }
    },
    setNow(now) {
      pinnedNow = now
    },
    holdDataApi(pathname) {
      heldDataApiPaths.add(pathname)
    },
    holdAnalyticsApi() {
      analyticsHeld = true
    },
    onYouTubeApiRequest(listener) {
      youtubeApiListener = listener
    },
    failRevocation(status) {
      revocationFailure = status
    },
    holdTokenEndpoint() {
      tokenEndpointHeld = true
    },
    stallTokenEndpointBody() {
      tokenEndpointBodyStalled = true
    },
    failTokenEndpoint(status) {
      tokenEndpointFailure = status
    },
    withholdRefreshToken() {
      refreshTokenWithheld = true
    },
    withholdIdTokenSubject() {
      idTokenSubjectWithheld = true
    },
    malformIdToken(payload) {
      idTokenMalformed = payload
    },
    answerTokenEndpointWithNull() {
      tokenEndpointAnsweredWithNull = true
    },
    holdRevocation() {
      revocationHeld = true
    },
    securityEventToken,
    close: () =>
      new Promise((resolve, reject) => {
        server.closeAllConnections()
        server.close((error) => (error ? reject(error) : resolve()))
      }),
  }
}
