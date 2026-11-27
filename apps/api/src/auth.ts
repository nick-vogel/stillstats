import type { WebDatabase } from '@creator-analytics/database'
import { betterAuth } from 'better-auth'
import { genericOAuth } from 'better-auth/plugins'
import { anonymousScopeAdapter } from './auth-database.ts'

// Also the last segment of the redirect URI registered in the Google Cloud project (#21), so a
// change here breaks sign-in until the registration changes with it.
export const googleProviderId = 'google'

/** Where the API serves the web app. apps/web's Vite `base` repeats it, and must change with it. */
export const webAppPath = '/app'

export const googleDiscoveryUrl = 'https://accounts.google.com/.well-known/openid-configuration'

export interface AuthOptions {
  /** The origin the API serves, which Better Auth builds the Google redirect URI from. */
  baseURL: string
  secret: string
  google: {
    /** Google's own document in production, the fake Google server's in tests. */
    discoveryUrl: string
    clientId: string
    clientSecret: string
  }
}

function buildBetterAuth(database: WebDatabase, { baseURL, secret, google }: AuthOptions) {
  return betterAuth({
    baseURL,
    secret,
    database: anonymousScopeAdapter(database),
    // Better Auth's telemetry would send usage data to a third party, which ADR 0007 forbids.
    telemetry: { enabled: false },
    // The product stores only what a feature needs, and no feature needs a session's IP address.
    advanced: { ipAddress: { disableIpTracking: true } },
    account: { encryptOAuthTokens: true },
    // The web app shows the error. Better Auth's own error page is closed with its other routes.
    onAPIError: { errorURL: webAppPath },
    plugins: [
      // Not Better Auth's built-in Google provider: it hardcodes Google's token endpoint, so
      // tests could not point it at the fake Google server (recorded on #10).
      genericOAuth({
        config: [
          {
            providerId: googleProviderId,
            discoveryUrl: google.discoveryUrl,
            clientId: google.clientId,
            clientSecret: google.clientSecret,
            // Identity only. The YouTube scopes are the connection's own consent step.
            scopes: ['openid', 'email', 'profile'],
            requireIdTokenVerification: true,
          },
        ],
      }),
    ],
  })
}

export type Auth = ReturnType<typeof buildBetterAuth>

export async function createAuth(database: WebDatabase, options: AuthOptions): Promise<Auth> {
  const auth = buildBetterAuth(database, options)
  // The plugin reads the discovery document once, at start, and on a failure it only logs and
  // skips the provider. An API that cannot sign anyone in must not start.
  const { socialProviders } = await auth.$context
  if (!socialProviders.some((provider) => provider.id === googleProviderId)) {
    throw new Error(
      `Sign-in with Google is unavailable: no discovery document at ${options.google.discoveryUrl}`,
    )
  }
  return auth
}
