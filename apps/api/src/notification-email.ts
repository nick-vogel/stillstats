import { isReplyAddress } from '@creator-analytics/api-types'

/**
 * The four settings a notification email needs: the Cloudflare account that sends it, an API token
 * with "Email Sending: Edit" on that account, the from address on a routing domain, and the to
 * address, a verified destination address, which keeps the send free.
 */
export interface EmailSettings {
  accountId: string
  apiToken: string
  from: string
  to: string
}

const settingNames = {
  accountId: 'CLOUDFLARE_EMAIL_ACCOUNT_ID',
  apiToken: 'CLOUDFLARE_EMAIL_API_TOKEN',
  from: 'FEEDBACK_EMAIL_FROM',
  to: 'FEEDBACK_EMAIL_TO',
} as const satisfies Record<keyof EmailSettings, string>

/**
 * The email settings from the API's env. None set means no email is sent. Some but not all, or a
 * from or to address that is not an email address, throws, so the API refuses to start rather than
 * fail on every send (ADR 0015).
 */
export function emailSettingsOf(
  env: Readonly<Record<string, string | undefined>>,
): EmailSettings | undefined {
  const entries = Object.entries(settingNames) as [keyof EmailSettings, string][]
  const missing = entries.filter(([, name]) => !env[name]).map(([, name]) => name)
  if (missing.length === entries.length) return undefined
  if (missing.length > 0)
    throw new Error(
      `Set all four of CLOUDFLARE_EMAIL_ACCOUNT_ID, CLOUDFLARE_EMAIL_API_TOKEN, FEEDBACK_EMAIL_FROM and FEEDBACK_EMAIL_TO, or none. Missing: ${missing.join(', ')}`,
    )
  const settings = Object.fromEntries(
    entries.map(([key, name]) => [key, env[name] as string]),
  ) as unknown as EmailSettings
  for (const key of ['from', 'to'] as const) {
    if (!isReplyAddress(settings[key]))
      throw new Error(`${settingNames[key]} is not an email address`)
  }
  return settings
}

/** One email to the to address: a plain text body, no HTML part. */
export interface NotificationEmail {
  subject: string
  text: string
}

/** The email port: Cloudflare Email Service in production, a recording fake in tests. */
export interface EmailPort {
  /** Rejects when the email did not send, and reports nothing: its caller reports, once. */
  send(email: NotificationEmail): Promise<void>
}

/** The name the email comes from, beside the from address. */
const fromName = 'Stillstats'

// Long enough for Cloudflare's API on a normal day, short enough that an outage does not hold the
// feedback form's request open.
const defaultSendTimeoutMs = 5_000

/**
 * Sends through Cloudflare Email Service's REST API (developers.cloudflare.com/email-service/api/
 * send-emails/rest-api, read 2026-11-15) with a plain HTTPS request. A send fails when the status
 * is not 2xx, when the body's `success` is not `true`, or when the recipient bounced permanently;
 * a recipient queued for later is a send.
 */
export function cloudflareEmailPort(
  settings: EmailSettings,
  {
    apiRoot = 'https://api.cloudflare.com/client/v4',
    sendTimeout = () => AbortSignal.timeout(defaultSendTimeoutMs),
  }: {
    apiRoot?: string
    /** Called once per send, for the signal that ends it unanswered. */
    sendTimeout?: () => AbortSignal
  } = {},
): EmailPort {
  const url = `${apiRoot}/accounts/${encodeURIComponent(settings.accountId)}/email/sending/send`
  return {
    async send({ subject, text }) {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${settings.apiToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from: { address: settings.from, name: fromName },
          to: settings.to,
          subject,
          text,
        }),
        signal: sendTimeout(),
      })
      const answer = (await response.json().catch(() => undefined)) as SendAnswer | undefined
      if (!response.ok || answer?.success !== true) {
        throw new UnsentEmailError(response.status, errorCodesOf(answer))
      }
      if ((answer.result?.permanent_bounces?.length ?? 0) > 0) throw new BouncedEmailError()
    },
  }
}

/** The part of Cloudflare's answer the adapter reads. */
interface SendAnswer {
  success?: unknown
  errors?: unknown
  result?: { permanent_bounces?: unknown[] } | null
}

/** Cloudflare's numeric error codes only: its messages are left out, whatever they hold. */
function errorCodesOf(answer: SendAnswer | undefined): number[] {
  if (!Array.isArray(answer?.errors)) return []
  return answer.errors.flatMap((error: unknown) => {
    const code = (error as { code?: unknown } | null)?.code
    return typeof code === 'number' ? [code] : []
  })
}

class UnsentEmailError extends Error {
  readonly status: number
  constructor(status: number, codes: number[]) {
    super(
      `Cloudflare did not send the email: status ${status}, error codes ${codes.length > 0 ? codes.join(', ') : 'none'}`,
    )
    this.status = status
  }
}

class BouncedEmailError extends Error {
  constructor() {
    super('Cloudflare answered that the email bounced permanently')
  }
}
