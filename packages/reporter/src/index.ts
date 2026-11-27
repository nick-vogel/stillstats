import * as Sentry from '@sentry/node'
import { createLogger, type Logger } from './logger.ts'
import { scrubbingOptions, scrubTransaction } from './scrub.ts'

export {
  createLogger,
  type Logger,
  type LogLevel,
  type LogSink,
  type RequestLogLine,
  type RequestRead,
} from './logger.ts'
export {
  type RequestTrace,
  type TraceAttributes,
  traceRequest,
  tracesSampleRateOf,
} from './tracing.ts'

/**
 * An error report for the operator. Its context leaves the process with its internal ids and the
 * keys the scrubbing hook allows, such as `status`, and nothing else: never a token, a YouTube id
 * or an analytics value.
 */
export interface ErrorReport {
  message: string
  context?: Readonly<Record<string, string>>
  /** The error behind the report. The scrubbing hook masks any token in its message. */
  error?: unknown
}

/** The error reporter port: GlitchTip through the Sentry SDK in production. */
export interface Reporter {
  report(report: ErrorReport): void
}

export interface ErrorTrackingOptions {
  /** The GlitchTip project's DSN. Unset, the SDK sends nothing and the process runs as before. */
  dsn: string | undefined
  /** Where the process runs, `production` or `staging`. Unset, the SDK's default. */
  environment?: string | undefined
  /**
   * The version the process runs. Unset, the SDK's own detection applies (SENTRY_RELEASE, or a CI or
   * host commit variable such as GITHUB_SHA); the images set none.
   */
  release?: string | undefined
  /** Replaces the SDK's HTTP transport, so a test can observe what leaves the process. */
  transport?: Sentry.NodeOptions['transport']
  /**
   * The share of requests whose trace leaves the process, from 0 to 1 (`tracesSampleRateOf`).
   * Unset or 0, no trace leaves, as before ADR 0023.
   */
  tracesSampleRate?: number | undefined
}

/**
 * Tracing's options, only with a rate above 0: with none set the SDK starts exactly as it did
 * before traces left the process, since defining `tracesSampleRate` at all turns tracing on
 * (docs.sentry.io, Node options). A trace goes as one transaction, which GlitchTip groups by its
 * name, through the trace scrubbing hook. `beforeSendTransaction` runs only under the `static`
 * lifecycle, and @sentry/node 12 removes it: the scrub moves to `beforeSendSpan` before that
 * upgrade (ADR 0023).
 */
function tracingOptions(rate: number | undefined) {
  if (rate === undefined || rate <= 0) return {}
  return {
    tracesSampleRate: rate,
    traceLifecycle: 'static',
    beforeSendTransaction: scrubTransaction,
  } as const satisfies Pick<
    Sentry.NodeOptions,
    'tracesSampleRate' | 'traceLifecycle' | 'beforeSendTransaction'
  >
}

/**
 * Starts the Sentry SDK against GlitchTip. Moving to another tracker is a change of DSN only. It
 * also reports uncaught exceptions and unhandled rejections, so call it before the process does
 * any work.
 */
export function initErrorTracking({
  dsn,
  environment,
  release,
  transport,
  tracesSampleRate,
}: ErrorTrackingOptions): void {
  Sentry.init({
    dsn,
    ...(environment === undefined ? {} : { environment }),
    ...(release === undefined ? {} : { release }),
    ...(transport === undefined ? {} : { transport }),
    // Errors leave the process as before. A trace leaves only with a rate above 0, and then ID-free,
    // with its name, route pattern, window, filter names and cache result (ADR 0023).
    ...tracingOptions(tracesSampleRate),
    // On the server the SDK adds its trace headers to every request the process sends, so Google
    // would read the trace's name, release and environment. None goes, whatever the rate.
    tracePropagationTargets: [],
    // GlitchTip accepts no sessions (glitchtip.com/sdkdocs/node), so neither the process nor the
    // HTTP server records one. The SDK's own request span is named by the request's path, which
    // can hold a channel's id, so the API opens its own (`traceRequest`) and the SDK opens none.
    // Hono's integration would add a second root span for each request; the images never load its
    // hook, and it is left out by name.
    integrations: (defaults) => [
      ...defaults.filter(
        ({ name }) => name !== 'ProcessSession' && name !== 'Http' && name !== 'Hono',
      ),
      Sentry.httpIntegration({ sessions: false, disableIncomingRequestSpans: true }),
    ],
    ...scrubbingOptions,
  })
}

/** Writes each report to the log, and sends it to GlitchTip when `initErrorTracking` has a DSN. */
export function errorTrackingReporter(logger: Logger = createLogger()): Reporter {
  return {
    report({ message, context, error }) {
      logger.error(message, context, error)
      const captureContext = context === undefined ? {} : { extra: context }
      // The error becomes the cause, so GlitchTip titles the issue with the report's message.
      if (error === undefined) Sentry.captureMessage(message, { level: 'error', ...captureContext })
      else Sentry.captureException(new Error(message, { cause: error }), captureContext)
    },
  }
}

/** The test adapter: it keeps every report it is given, in order. */
export type RecordingReporter = Reporter & { readonly reports: ErrorReport[] }

export function recordingReporter(): RecordingReporter {
  const reports: ErrorReport[] = []
  return {
    reports,
    report(report) {
      reports.push(report)
    },
  }
}
