import type { ChannelsAnswer, PreferencesUpdate } from '@creator-analytics/api-types'
import { users, type WebDatabase } from '@creator-analytics/database'
import type { GoogleUser } from '@creator-analytics/fake-google'
import { eq } from 'drizzle-orm'
import { connectCallbackPath } from '../src/app.ts'
import { Browser } from './browser.ts'
import type { StartedApi } from './start-api.ts'

/**
 * A redirect to Google's consent for a connection, or for revenue, both of which return to the
 * connection's callback. Sign-in's consent returns to its own.
 */
export function isConnectionConsent(location: URL): boolean {
  const redirectUri = location.searchParams.get('redirect_uri')
  return redirectUri !== null && new URL(redirectUri).pathname === connectCallbackPath
}

/**
 * Signs the user in from the web app. A user with no channel goes on to Google's connect consent,
 * and this stops there, as a creator who closes Google's tab, so a test connects with `connect`
 * when it chooses.
 */
export async function signIn(api: StartedApi, user: GoogleUser): Promise<Browser> {
  api.google.signInAs(user)
  const browser = new Browser(api.origin)
  const started = await browser.fetch('/api/auth/sign-in/google?then=connect', { method: 'POST' })
  const { url } = (await started.json()) as { url: string }
  await browser.navigate(url, { stopAt: isConnectionConsent })
  return browser
}

/**
 * Starts the connect consent, from `path`, the web app's own route unless given, and follows it
 * through Google back to the web app.
 */
export async function connect(browser: Browser, path = '/api/channels/connect'): Promise<URL> {
  const started = await browser.fetch(path, { method: 'POST' })
  const { url } = (await started.json()) as { url: string }
  return (await browser.navigate(url)).url
}

/** Starts the revenue consent for the channel and follows it through Google back to the web app. */
export async function giveRevenueConsent(browser: Browser, channelId: string): Promise<URL> {
  const started = await browser.fetch(`/api/channels/${channelId}/revenue-consent`, {
    method: 'POST',
  })
  const { url } = (await started.json()) as { url: string }
  return (await browser.navigate(url)).url
}

/** Saves the preferences given, with the PUT the web app sends. */
export function savePreferences(
  browser: Browser,
  preferences: PreferencesUpdate,
): Promise<Response> {
  return browser.fetch('/api/me/preferences', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(preferences),
  })
}

export async function channelsOf(browser: Browser): Promise<ChannelsAnswer> {
  return (await browser.fetch('/api/channels')).json() as Promise<ChannelsAnswer>
}

/** The id of the user who signed in with this email. */
export async function userIdOf(web: WebDatabase, email: string): Promise<string> {
  const [user] = await web.asAnonymous((tx) =>
    tx.sql.select({ id: users.id }).from(users).where(eq(users.email, email)),
  )
  if (!user) throw new Error(`No user signed in with ${email}`)
  return user.id
}
