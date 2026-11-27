/** The environments one image can run as. */
export const environments = ['production', 'staging'] as const

export type Environment = (typeof environments)[number]

/**
 * GET /api/client-settings: what the web app and the site read at load rather than at build, so
 * one image serves staging and production. Public, as the site reads it signed out.
 */
export interface ClientSettingsAnswer {
  environment: Environment
  /** The newest app release note in the build, or null when the build holds none. */
  version: string | null
  /** The first 7 characters of the image's commit, or null when the build was given none. */
  commit: string | null
  /** The version's release page, a same-origin path, or null with no version. */
  releasePath: string | null
  /** The OpenPanel project's client ID, or null when the API has none, and no event is sent. */
  openPanelClientId: string | null
}
