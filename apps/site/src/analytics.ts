import type { ClientSettingsAnswer } from '@creator-analytics/api-types'
import type { ThumbnailToolEvent } from '@creator-analytics/thumbnail-preview'
import { OpenPanel } from '@openpanel/web'

/**
 * The OpenPanel client, built from the client ID the API answers at load, so one build serves
 * staging's project and production's. The API URL stays in the build, as both share the host and
 * the content security policy names it. Without an API URL the SDK sends to openpanel.dev's
 * cloud, a third party ADR 0007 forbids, so no client is built at all, and none is built when the
 * settings cannot be read. The site sends page views, `sign_in_clicked`, `site_nav_clicked` from
 * the header's navigation on every page (creator-analytics#888) and, from the tool page, the
 * thumbnail preview tool's events. A click on a tool page's sign-in button carries that page's
 * `source`; the homepage's carries none. The page's entries share this module, so a page builds
 * one client.
 */
async function startAnalytics(): Promise<OpenPanel | undefined> {
  const apiUrl: string | undefined = import.meta.env.VITE_OPENPANEL_API_URL
  if (!apiUrl) return undefined
  try {
    const response = await fetch('/api/client-settings')
    if (!response.ok) return undefined
    const { openPanelClientId: clientId } = (await response.json()) as ClientSettingsAnswer
    return clientId ? new OpenPanel({ clientId, apiUrl, trackScreenViews: true }) : undefined
  } catch {
    return undefined
  }
}

export const panel = startAnalytics()

/** Hands a tool event to the client as it comes, once the client settings land. */
export function sendToolEvent(event: ThumbnailToolEvent): void {
  void panel.then((client) => client?.track(event.name, event.properties))
}
