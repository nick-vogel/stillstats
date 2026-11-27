import type { ClientSettingsAnswer } from '@creator-analytics/api-types'

/**
 * Reads the client settings once, at load. A failed read is null: the web app then runs with no
 * OpenPanel client, no environment or release on its errors, and no version line.
 */
export async function readClientSettings(): Promise<ClientSettingsAnswer | null> {
  try {
    const response = await fetch('/api/client-settings')
    return response.ok ? ((await response.json()) as ClientSettingsAnswer) : null
  } catch {
    return null
  }
}
