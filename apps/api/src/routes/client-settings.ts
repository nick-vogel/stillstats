import type { ClientSettingsAnswer } from '@creator-analytics/api-types'
import { type Deployment, releasePagePath } from '@creator-analytics/releases'
import type { Hono } from 'hono'
import type { ApiDependencies } from '../app.ts'

/**
 * The answer from the process's deployment and `OPENPANEL_WEB_CLIENT_ID`, the OpenPanel project's
 * website client, which the browser sends with and no secret. Never `OPENPANEL_CLIENT_ID`: that is
 * the same project's write client, which only the relay sends with, beside its secret. The release
 * page is a same-origin path, so staging links its own.
 */
export function clientSettingsOf(
  { environment, version, commit }: Deployment,
  env: Readonly<Record<string, string | undefined>>,
): ClientSettingsAnswer {
  return {
    environment,
    version,
    commit,
    releasePath: version === null ? null : releasePagePath(version),
    openPanelClientId: env.OPENPANEL_WEB_CLIENT_ID || null,
  }
}

/**
 * GET /api/client-settings: public, as the site reads it signed out. Never cached, as one URL
 * answers anew after every deploy.
 */
export function clientSettingsRoute(
  app: Hono,
  { clientSettings }: Pick<ApiDependencies, 'clientSettings'>,
): void {
  app.get('/api/client-settings', (c) => {
    c.header('cache-control', 'no-store')
    return c.json(clientSettings)
  })
}
