import type { ErrorAnswer, PreferencesAnswer } from '@creator-analytics/api-types'
import type { Hono } from 'hono'
import type { ApiDependencies } from '../app.ts'
import {
  clearPreferences,
  preferencesOf,
  readPreferences,
  savePreferences,
} from '../preferences.ts'
import type { SignedIn } from '../signed-in.ts'

// Parsed here rather than by c.req.json(), whose error on malformed JSON would reach onError and
// answer 500 where the body is the client's mistake.
function jsonOf(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

/** GET, PUT and DELETE /api/me/preferences: the signed-in user's own, outside any channel. */
export function preferencesRoute(
  signedIn: Hono<SignedIn>,
  { database, appVersions }: Pick<ApiDependencies, 'database' | 'appVersions'>,
): void {
  signedIn.get('/me/preferences', async (c) => {
    const saved = await database.asUser(c.get('user').id, readPreferences)
    return c.json(saved satisfies PreferencesAnswer)
  })
  signedIn.put('/me/preferences', async (c) => {
    const values = preferencesOf(jsonOf(await c.req.text()), appVersions)
    if (!values) return c.json({ error: 'invalid_preference' } satisfies ErrorAnswer, 400)
    const saved = await database.asUser(c.get('user').id, (tx) => savePreferences(tx, values))
    return c.json(saved satisfies PreferencesAnswer)
  })
  signedIn.delete('/me/preferences', async (c) => {
    const saved = await database.asUser(c.get('user').id, clearPreferences)
    return c.json(saved satisfies PreferencesAnswer)
  })
}
