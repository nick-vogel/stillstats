import type { ClientSettingsAnswer } from '@creator-analytics/api-types'
import { scrubbingOptions } from '@creator-analytics/reporter/scrub'
import * as Sentry from '@sentry/react'

/**
 * Starts the Sentry SDK against GlitchTip, with the environment and the version from the client
 * settings, so one build reports staging's errors apart from production's. The DSN stays in the
 * build, as both share the host and the content security policy names it. With the DSN unset, the
 * SDK sends nothing. No tracesSampleRate, so no trace of a creator's visit is taken. GlitchTip
 * accepts no sessions (glitchtip.com/sdkdocs/javascript-react).
 */
export function startErrorReporting(
  settings: ClientSettingsAnswer | null,
  transport?: Sentry.BrowserOptions['transport'],
): void {
  Sentry.init({
    dsn: import.meta.env.VITE_GLITCHTIP_DSN,
    ...(settings && { environment: settings.environment }),
    ...(settings?.version && { release: settings.version }),
    ...(transport && { transport }),
    integrations: (defaults) => defaults.filter(({ name }) => name !== 'BrowserSession'),
    ...scrubbingOptions,
  })
}
