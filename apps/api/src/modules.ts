import { createAccounts } from '@creator-analytics/accounts'
import { createEventRelay, type OpenPanelOptions } from '@creator-analytics/event-relay'
import type { Logger, Reporter } from '@creator-analytics/reporter'
import { createTokenVault, type TokenKeys } from '@creator-analytics/token-vault'
import { createYouTubeGateway, type YouTubeApi } from '@creator-analytics/youtube-gateway'
import { type ApiDependencies, connectCallbackPath } from './app.ts'
import { createEventLimit } from './event-limit.ts'
import { createFeedbackNotifier } from './feedback-notice.ts'
import { cloudflareEmailPort, type EmailPort, type EmailSettings } from './notification-email.ts'
import { recordRead } from './request-timing.ts'
import { createSecurityEventReader } from './risc.ts'

export interface ModuleOptions {
  /** The origin the API serves, which the connection's Google redirect URI is built from. */
  baseURL: string
  google: {
    clientId: string
    clientSecret: string
    authorizationEndpoint: string
    tokenEndpoint: string
    revocationEndpoint: string
    riscConfigurationUrl: string
    youtubeRootUrls: Record<YouTubeApi, string>
    /**
     * The bound on one Google call, the gateway's, the vault's and the RISC reader's. Unset,
     * `googleCallTimeoutMs`.
     */
    callTimeoutMs?: number | undefined
  }
  keys: TokenKeys
  identifierKey: string
  /** Unset, the event relay sends nothing. */
  openPanel?: OpenPanelOptions
  /** The four email settings. Unset, no feedback notification is sent. */
  email?: EmailSettings | undefined
  /** The email port for the settings. Unset, Cloudflare Email Service's. */
  emailPortOf?: (settings: EmailSettings) => EmailPort
  /** The event limit's clock. Unset, it reads system time. */
  clock?: () => Date
  reporter: Reporter
  logger: Logger
}

/**
 * Every dependency of the API but its database, auth and web root. The reporter and logger ride
 * along, so a composition root hands them to createModules alone.
 */
export type Modules = Pick<
  ApiDependencies,
  | 'vault'
  | 'gateway'
  | 'accounts'
  | 'securityEvents'
  | 'eventRelay'
  | 'eventLimit'
  | 'feedbackNotifier'
  | 'reporter'
  | 'logger'
>

export function createModules({
  baseURL,
  google,
  keys,
  identifierKey,
  openPanel,
  email,
  emailPortOf = cloudflareEmailPort,
  clock,
  reporter,
  logger,
}: ModuleOptions): Modules {
  const { youtubeRootUrls, riscConfigurationUrl, callTimeoutMs, ...oauth } = google
  const vault = createTokenVault({
    google: oauth,
    redirectUri: new URL(connectCallbackPath, baseURL).toString(),
    keys,
    identifierKey,
    reporter,
    callTimeoutMs,
  })
  return {
    vault,
    gateway: createYouTubeGateway({
      vault,
      rootUrls: youtubeRootUrls,
      logger,
      callTimeoutMs,
      // Each read's timing goes to the request it ran in, for its Server-Timing and log line.
      onRead: recordRead,
    }),
    accounts: createAccounts({ vault }),
    securityEvents: createSecurityEventReader({
      configurationUrl: riscConfigurationUrl,
      clientId: google.clientId,
      callTimeoutMs,
    }),
    eventRelay: createEventRelay(openPanel, { reporter }),
    eventLimit: createEventLimit(clock ? { clock } : {}),
    feedbackNotifier: createFeedbackNotifier({
      port: email && emailPortOf(email),
      baseURL,
      reporter,
    }),
    reporter,
    logger,
  }
}
