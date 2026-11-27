import type { ExtensionEvent } from '@creator-analytics/api-types'
import type { Settled } from './messages.ts'

/**
 * Firefox declares the usage events as optional `technicalAndInteraction` data, which the creator
 * grants or declines at install and can change in about:addons. An optional data permission the
 * extension ignored would be a false declaration. Chrome asks no such consent.
 */
export function usageEventsAllowed({
  browser,
  dataCollection,
}: {
  browser: string
  /** `data_collection` from `browser.permissions.getAll()`. */
  dataCollection: string[] | undefined
}): boolean {
  if (browser !== 'firefox') return true
  return dataCollection?.includes('technicalAndInteraction') ?? false
}

/**
 * The caller passes the product API client's `sendEvent`, so this file stays free of the client
 * (only the background holds it).
 */
export async function usageEventSettled({
  event,
  browser,
  dataCollection,
  sendEvent,
}: {
  event: ExtensionEvent
  browser: string
  /** `data_collection` from `browser.permissions.getAll()`. */
  dataCollection: string[] | undefined
  sendEvent: (event: ExtensionEvent) => Promise<boolean>
}): Promise<Settled> {
  if (!usageEventsAllowed({ browser, dataCollection })) return true
  return sendEvent(event)
}
