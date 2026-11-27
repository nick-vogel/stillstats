import { isInternalId, maskSecrets, scrubContext } from './scrub.ts'

export type LogLevel = 'info' | 'warn' | 'error'

/** Where a log line goes: the process's stdout and stderr in production, a list in tests. */
export type LogSink = (level: LogLevel, line: string) => void

export type LogContext = Readonly<Record<string, unknown>>

/** One gateway read of an API request: its name, whether the cache answered it, and its time. */
export interface RequestRead {
  name: string
  cache: 'hit' | 'miss'
  googleMs: number
  databaseMs: number
}

/**
 * An API request's one line: its route's pattern (never its path), its status, its time in
 * milliseconds and its reads in the order they finished. The channel appears by its internal id
 * only, and only on this line, which stays on main-box.
 */
export interface RequestLogLine {
  method: string
  route: string
  status: number
  totalMs: number
  channelId?: string | undefined
  reads: readonly RequestRead[]
}

/**
 * Writes one JSON line per entry. The line passes through the same rule as an error report: a
 * channel appears by its internal id only, and no token or analytics value is written.
 */
export interface Logger {
  info(message: string, context?: LogContext): void
  warn(message: string, context?: LogContext): void
  error(message: string, context?: LogContext, error?: unknown): void
  /** Writes the request's line at info, its durations kept as numbers. */
  request(line: RequestLogLine): void
}

const consoleSink: LogSink = (level, line) => console[level](line)

function errorText(error: unknown): string {
  return maskSecrets(error instanceof Error ? `${error.name}: ${error.message}` : String(error))
}

export function createLogger(sink: LogSink = consoleSink): Logger {
  function write(level: LogLevel, message: string, context?: LogContext, error?: unknown) {
    const kept = context === undefined ? {} : scrubContext(context)
    sink(
      level,
      JSON.stringify({
        level,
        message: maskSecrets(message),
        ...(Object.keys(kept).length === 0 ? {} : { context: kept }),
        ...(error === undefined ? {} : { error: errorText(error) }),
      }),
    )
  }
  function request({ method, route, status, totalMs, channelId, reads }: RequestLogLine) {
    sink(
      'info',
      JSON.stringify({
        level: 'info',
        message: 'API request',
        request: {
          method: maskSecrets(method),
          route: maskSecrets(route),
          status,
          totalMs,
          ...(isInternalId(channelId) ? { channelId } : {}),
          reads: reads.map(({ name, cache, googleMs, databaseMs }) => ({
            name: maskSecrets(name),
            cache,
            googleMs,
            databaseMs,
          })),
        },
      }),
    )
  }
  return {
    request,
    info: (message, context) => write('info', message, context),
    warn: (message, context) => write('warn', message, context),
    error: (message, context, error) => write('error', message, context, error),
  }
}
