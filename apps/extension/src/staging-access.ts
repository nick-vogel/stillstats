/**
 * The headers of a Cloudflare Access service token, the way the staging build gets through the
 * Access application in front of staging.stillstats.com. Access blocks a cross-origin preflight
 * regardless of sign-in, and a request without its cookie (Cloudflare Access documentation, "CORS"),
 * so the staging build cannot rely on Nick's own Access session.
 */
export type AccessHeaders = Readonly<Record<string, string>>

/** The build environment's names for the token. No `WXT_` or `VITE_` prefix: no bundle reads them. */
interface AccessEnv {
  readonly CF_ACCESS_CLIENT_ID?: string
  readonly CF_ACCESS_CLIENT_SECRET?: string
}

/**
 * The Access headers a build of `mode` sends on every API request: the service token for a staging
 * build, read from the build's environment, and none for any other. A staging build without both
 * values fails, so it never ships a build Access refuses.
 */
export function accessHeadersOf(mode: string, env: AccessEnv): AccessHeaders {
  if (mode !== 'staging') return {}
  const { CF_ACCESS_CLIENT_ID: id, CF_ACCESS_CLIENT_SECRET: secret } = env
  if (!id || !secret) {
    throw new Error(
      'A staging build needs the Cloudflare Access service token: set CF_ACCESS_CLIENT_ID and ' +
        'CF_ACCESS_CLIENT_SECRET in the environment or in apps/extension/.env.staging.local.',
    )
  }
  return { 'CF-Access-Client-Id': id, 'CF-Access-Client-Secret': secret }
}
