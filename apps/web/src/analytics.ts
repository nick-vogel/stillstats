import type { ClientSettingsAnswer } from '@creator-analytics/api-types'
import { OpenPanel } from '@openpanel/web'
import type { ProductEvent } from './landing.ts'

let panel: OpenPanel | undefined

/**
 * Builds the OpenPanel client from the client ID the API answers at load, so one build serves
 * staging's project and production's. The API URL stays in the build, as both share the host and
 * the content security policy names it. Without an API URL the SDK sends to openpanel.dev's cloud,
 * a third party ADR 0007 forbids, so no client is built at all. The SDK's defaults track no screen
 * view, link or attribute: only the events below are sent.
 */
export function startAnalytics(settings: ClientSettingsAnswer | null): void {
  const clientId = settings?.openPanelClientId
  const apiUrl: string | undefined = import.meta.env.VITE_OPENPANEL_API_URL
  if (panel || !clientId || !apiUrl) return
  panel = new OpenPanel({ clientId, apiUrl })
}

/**
 * Sends a product event, which carries no channel id, user id or email. Before the client starts,
 * or with none, it sends nothing.
 */
export function track({ name, ...properties }: ProductEvent): void {
  // The SDK retries and logs its own failures and never rejects, so nothing waits on it.
  void panel?.track(name, properties)
}
