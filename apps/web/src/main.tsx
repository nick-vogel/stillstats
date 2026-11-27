import { CSPProvider } from '@base-ui/react/csp-provider'
import * as Sentry from '@sentry/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import './app.css'
import { startAnalytics, track } from './analytics.ts'
import { readClientSettings } from './client-settings.ts'
import { startErrorReporting } from './error-reporting.ts'
import { landingParameters, readLanding } from './landing.ts'
import { type ObserveEntries, startScreenTiming } from './screen-timing.ts'

const sentryReactErrorHandler = Sentry.reactErrorHandler()

// createRoot passes an absent component stack as undefined, where Sentry's ErrorInfo takes null.
function reportReactError(
  error: unknown,
  { componentStack }: { componentStack?: string | null | undefined },
) {
  sentryReactErrorHandler(error, { componentStack: componentStack ?? null })
}

/**
 * The browser's own performance observers, buffered so the entries before the start count, and
 * none for an entry type the browser does not support. An event entry of 40ms or more counts
 * towards INP, web-vitals' default threshold (github.com/GoogleChrome/web-vitals).
 */
const observeEntries: ObserveEntries = (type, onEntries) => {
  if (!PerformanceObserver.supportedEntryTypes?.includes(type)) return () => {}
  const observer = new PerformanceObserver((list) => onEntries(list.getEntries()))
  observer.observe({ type, buffered: true, ...(type === 'event' ? { durationThreshold: 40 } : {}) })
  return () => observer.disconnect()
}

const root = document.getElementById('root')
if (!root) throw new Error('index.html has no #root element')

// The reporters start before anything renders or records, so no error or event is lost, and the
// app renders once with the settings, so the account menu's version line needs no wait.
async function start(element: HTMLElement): Promise<void> {
  const clientSettings = await readClientSettings()
  startErrorReporting(clientSettings)
  startAnalytics(clientSettings)
  if (typeof PerformanceObserver !== 'undefined') {
    startScreenTiming({ now: () => performance.now(), observe: observeEntries, document })
  }

  // Read and recorded once, before React renders, and then removed from the address bar, so a
  // reload or a StrictMode second render records nothing twice.
  const landing = readLanding(window.location.search)
  if (landing.event) track(landing.event)
  const url = new URL(window.location.href)
  for (const name of landingParameters) url.searchParams.delete(name)
  window.history.replaceState(null, '', url)

  createRoot(element, {
    onUncaughtError: reportReactError,
    onCaughtError: reportReactError,
    onRecoverableError: reportReactError,
  }).render(
    <StrictMode>
      {/* Base UI writes no <style> element, which the policy's style-src 'self' would block. */}
      <CSPProvider disableStyleElements>
        <App landingMessage={landing.message} clientSettings={clientSettings} />
      </CSPProvider>
    </StrictMode>,
  )
}

void start(root)
