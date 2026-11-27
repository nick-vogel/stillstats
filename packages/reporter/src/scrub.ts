import type { Breadcrumb, ErrorEvent, Exception, NodeOptions } from '@sentry/node'

// This module imports types only, so the web app's bundle can use it without @sentry/node.

/**
 * Turns off every category of data the SDK collects on its own. Sentry 11 collects them all
 * when this option is unset, where Sentry 10's unset `sendDefaultPii` collected none.
 */
const noDataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
} as const satisfies NodeOptions['dataCollection']

const uuidSource = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const uuidPattern = new RegExp(`^${uuidSource}$`, 'i')

/** A uuid, which is how every internal id is formed. */
export type InternalId = string & { readonly __brand: 'InternalId' }

/**
 * Keys whose value leaves the process even though it is not an internal id. Each one holds a
 * status, a method, a port, a route's pattern (never its path), a day or the product's own YouTube
 * quota, never a token, a YouTube id or an analytics value, so its value keeps its numbers. A key added
 * here is a decision that its values are safe to send to GlitchTip.
 */
const allowedKeys = new Set([
  'status',
  'status_code',
  'method',
  'port',
  'route',
  'quotaDay',
  'unitsSpent',
  'unitsUsable',
  // The active user count's UTC day, YYYY-MM-DD: no id and no value of a creator.
  'countedDay',
  // How many times a rate-limited history download may queue its job again, the worker's own cap:
  // no id and no value of a creator.
  'requeues',
])

/** Contexts the SDK fills from the runtime, which hold no data of a creator. */
const runtimeContexts = new Set([
  'app',
  'browser',
  'cloud_resource',
  'culture',
  'device',
  'os',
  'runtime',
  'trace',
])

const secretPatterns: readonly [RegExp, string][] = [
  [/\bya29\.[\w.-]+/g, '[token]'],
  [/\b1\/\/[\w.-]+/g, '[token]'],
  [/\beyJ[\w-]+\.[\w-]+\.[\w-]*/g, '[token]'],
  [/\bBearer\s+\S+/gi, 'Bearer [token]'],
  [/\bUC[\w-]{22}(?:\b|(?!\w))/g, '[youtube id]'],
  // A video id has no prefix of its own, so only its place in a path marks it as one.
  [/\/videos\/[\w-]{11}(?![\w-])/g, '/videos/[youtube id]'],
  // A query string can carry a token, a YouTube id or a metric, so none leaves.
  [/\?[^\s"'#]*=[^\s"'#]*/g, ''],
]

/**
 * A uuid, or a standalone number: an integer or a decimal, with or without thousands separators.
 * The uuid branch consumes a whole uuid, so the number branch never reaches a digit group inside
 * one. A number with a word character beside it is part of an identifier and does not match.
 */
const uuidOrNumberPattern = new RegExp(
  `(${uuidSource})|(?<!\\w)(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?(?!\\w)`,
  'gi',
)

/** An HTTP status, which is the one number free text keeps. */
const httpStatusPattern = /^[1-5]\d\d$/

/** Whether a value has the form of an internal id: a uuid, which no YouTube id is. */
export function isInternalId(value: unknown): value is InternalId {
  return typeof value === 'string' && uuidPattern.test(value)
}

function maskTokensAndIds(text: string): string {
  return secretPatterns.reduce((masked, [pattern, mask]) => masked.replace(pattern, mask), text)
}

/**
 * Masks every token, YouTube channel or video id and query string in free text, then every number
 * but an HTTP status, because a number in a message can be a creator's analytics value. A uuid is
 * kept.
 */
export function maskSecrets(text: string): string {
  return maskTokensAndIds(text).replace(uuidOrNumberPattern, (match, uuid: string | undefined) =>
    uuid !== undefined || httpStatusPattern.test(match) ? match : '[number]',
  )
}

/** Keeps the internal ids and the allowed keys of a context, and drops every other entry. */
export function scrubContext(context: Readonly<Record<string, unknown>>): Record<string, string> {
  const kept: Record<string, string> = {}
  for (const [key, value] of Object.entries(context)) {
    if (isInternalId(value)) kept[key] = value
    else if (allowedKeys.has(key) && (typeof value === 'string' || typeof value === 'number')) {
      kept[key] = maskTokensAndIds(String(value))
    }
  }
  return kept
}

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  const { message, data, ...rest } = breadcrumb
  return {
    ...rest,
    ...(message === undefined ? {} : { message: maskSecrets(message) }),
    ...(data === undefined ? {} : { data: scrubContext(data) }),
  }
}

function scrubException(exception: Exception): Exception {
  const { value, stacktrace, ...rest } = exception
  return {
    ...rest,
    ...(value === undefined ? {} : { value: maskSecrets(value) }),
    ...(stacktrace?.frames === undefined
      ? {}
      : {
          stacktrace: {
            ...stacktrace,
            frames: stacktrace.frames.map(({ vars: _vars, ...frame }) => frame),
          },
        }),
  }
}

function scrubUrl(url: string): string {
  const parsed = URL.parse(url)
  if (!parsed) return maskSecrets(url)
  return maskSecrets(`${parsed.origin}${parsed.pathname}`)
}

/**
 * The scrubbing hook, run on every event before it leaves the process. It keeps internal ids
 * and drops everything else a creator owns: tokens, YouTube ids, analytics values, and the
 * request's headers, cookies, body and query string.
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const {
    message,
    logentry,
    exception,
    breadcrumbs,
    extra,
    contexts,
    tags,
    user,
    request,
    ...rest
  } = event
  const scrubbed: ErrorEvent = { ...rest }
  if (rest.transaction !== undefined) scrubbed.transaction = maskSecrets(rest.transaction)
  if (message !== undefined) scrubbed.message = maskSecrets(message)
  if (logentry?.message !== undefined)
    scrubbed.logentry = { message: maskSecrets(logentry.message) }
  if (exception?.values !== undefined)
    scrubbed.exception = { values: exception.values.map(scrubException) }
  if (breadcrumbs !== undefined) scrubbed.breadcrumbs = breadcrumbs.map(scrubBreadcrumb)
  if (extra !== undefined) scrubbed.extra = scrubContext(extra)
  if (tags !== undefined) scrubbed.tags = scrubContext(tags)
  if (contexts !== undefined) {
    scrubbed.contexts = Object.fromEntries(
      Object.entries(contexts).map(([name, context]) => [
        name,
        runtimeContexts.has(name) || context === undefined ? context : scrubContext(context),
      ]),
    )
  }
  if (isInternalId(user?.id)) scrubbed.user = { id: user.id }
  if (request !== undefined) {
    scrubbed.request = {
      ...(request.method === undefined ? {} : { method: request.method }),
      ...(request.url === undefined ? {} : { url: scrubUrl(request.url) }),
    }
  }
  return scrubbed
}

/** A trace as the SDK sends it: one transaction, its root span's context and its child spans. */
export type TransactionEvent = Parameters<NonNullable<NodeOptions['beforeSendTransaction']>>[0]

type TraceData = Readonly<Record<string, unknown>>

/**
 * The keys a trace's tags, its root span's data and each span's data keep (ADR 0023): the trace's
 * own window, filter names and cache result, and the SDK's structural keys, which carry no data of
 * a creator. Every other key goes, so a key the SDK adds later stays in the process until it is
 * added here. A key added here is a decision that its values are safe to send to GlitchTip.
 */
const traceKeys = new Set([
  'window',
  'filters',
  'cache',
  'sentry.op',
  'sentry.origin',
  'sentry.source',
  'sentry.segment.name.source',
  'sentry.sample_rate',
  'http.request.method',
  'http.response.status_code',
  'server.address',
  'db.system',
  'db.system.name',
])

const emailPattern = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g
const uuidAnywherePattern = new RegExp(uuidSource, 'gi')

/**
 * The one mask every string of a trace passes through. Stricter than an error report's, since a
 * trace carries no internal id: every token, YouTube id, query string and number goes as in
 * `maskSecrets`, then every uuid becomes `[id]` and every email `[email]`.
 */
export function maskTraceText(text: string): string {
  return maskSecrets(text.replace(emailPattern, '[email]')).replace(uuidAnywherePattern, '[id]')
}

/** Keeps the trace keys, a string masked and a number or a boolean as it is, and drops the rest. */
function scrubTraceData(data: TraceData): Record<string, string | number | boolean> {
  const kept: Record<string, string | number | boolean> = {}
  for (const [key, value] of Object.entries(data)) {
    if (!traceKeys.has(key)) continue
    if (typeof value === 'string') kept[key] = maskTraceText(value)
    else if (typeof value === 'number' || typeof value === 'boolean') kept[key] = value
  }
  return kept
}

/**
 * The keys a transaction, each of its spans and its trace context keep (ADR 0023), beside the ones
 * `scrubTransaction` builds itself. `server_name`, the host name, and `modules`, the dependency
 * list, go: GlitchTip's performance view reads neither, and the host name is the server's identity.
 * `sdkProcessingMetadata` stays: the SDK builds the envelope's trace header from it after the hook,
 * and drops it from the body itself. Each runtime context keeps the keys `@sentry/node` 11.4.0
 * fills on a traced request but the boot and start times, each of which marks one server, and
 * `cloud_resource` goes whole, since it can hold the cloud account's ID and GlitchTip's performance
 * view reads none of it.
 */
const transactionKeys = [
  'event_id',
  'type',
  'platform',
  'timestamp',
  'start_timestamp',
  'release',
  'environment',
  'sdk',
  'transaction_info',
  'measurements',
  'sdkProcessingMetadata',
]
const spanKeys = [
  'span_id',
  'trace_id',
  'parent_span_id',
  'op',
  'status',
  'origin',
  'start_timestamp',
  'timestamp',
]
const traceContextKeys = ['span_id', 'trace_id', 'parent_span_id', 'op', 'status', 'origin']
const runtimeContextKeys = new Map<string, readonly string[]>([
  ['app', ['app_memory', 'free_memory']],
  ['culture', ['locale', 'timezone']],
  [
    'device',
    [
      'arch',
      'memory_size',
      'free_memory',
      'processor_count',
      'cpu_description',
      'processor_frequency',
    ],
  ],
  ['os', ['kernel_version', 'name', 'version', 'build']],
  ['runtime', ['name', 'version']],
])

function picked<T extends object>(from: T, keys: readonly string[]): T {
  const values = from as Readonly<Record<string, unknown>>
  return Object.fromEntries(keys.filter((key) => key in from).map((key) => [key, values[key]])) as T
}

function scrubTraceUrl(url: string): string {
  const parsed = URL.parse(url)
  return maskTraceText(parsed ? `${parsed.origin}${parsed.pathname}` : url)
}

/**
 * The trace scrubbing hook, run on every transaction before it leaves the process (ADR 0023). A
 * trace may carry its name, the route's pattern, its timings, its status, the window, the filter
 * names and the cache result. It keeps no channel id, video id, user id, email, token, query value
 * or analytics value: it keeps only the keys it names, at every level, so its user, extra and
 * breadcrumbs go, its request keeps its method and masked address with no query, and its tags and
 * data keep only the trace keys.
 */
export function scrubTransaction(event: TransactionEvent): TransactionEvent {
  const { transaction, request, spans, tags, contexts } = event
  const scrubbed = picked(event, transactionKeys)
  if (transaction !== undefined) scrubbed.transaction = maskTraceText(transaction)
  if (request !== undefined) {
    scrubbed.request = {
      ...(request.method === undefined ? {} : { method: request.method }),
      ...(request.url === undefined ? {} : { url: scrubTraceUrl(request.url) }),
    }
  }
  if (tags !== undefined) scrubbed.tags = scrubTraceData(tags)
  if (spans !== undefined) {
    scrubbed.spans = spans.map(({ description, data, ...span }) => ({
      ...picked(span, spanKeys),
      ...(description === undefined ? {} : { description: maskTraceText(description) }),
      data: scrubTraceData(data),
    }))
  }
  if (contexts !== undefined) {
    scrubbed.contexts = Object.fromEntries(
      Object.entries(contexts).flatMap(([name, context]): unknown[][] => {
        if (context === undefined) return [[name, context]]
        if (name === 'cloud_resource') return []
        const runtimeKeys = runtimeContextKeys.get(name)
        if (runtimeKeys) return [[name, picked(context, runtimeKeys)]]
        if (name === 'trace') {
          const { data, ...trace } = context
          return [
            [
              name,
              {
                ...picked(trace, traceContextKeys),
                ...(data === undefined ? {} : { data: scrubTraceData(data as TraceData) }),
              },
            ],
          ]
        }
        return [[name, scrubTraceData(context)]]
      }),
    )
  }
  return scrubbed
}

/** The SDK options that keep a creator's data in the process, shared by the API, worker and web. */
export const scrubbingOptions = {
  sendClientReports: false,
  dataCollection: noDataCollection,
  beforeSend: scrubEvent,
  beforeBreadcrumb: scrubBreadcrumb,
} satisfies Pick<
  NodeOptions,
  'sendClientReports' | 'dataCollection' | 'beforeSend' | 'beforeBreadcrumb'
>
