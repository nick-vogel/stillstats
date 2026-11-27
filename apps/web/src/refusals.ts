import type { ErrorAnswer, ErrorCode, Refusal, RefusalAnswer } from '@creator-analytics/api-types'

export type RefusalTexts = Partial<Record<Refusal | ErrorCode, string>>

const refusalTexts: RefusalTexts = {
  quota_reserved: 'The product has used its YouTube quota for today. Try again tomorrow.',
  not_connected: 'This channel is not connected. Connect it to see its numbers.',
  connection_revoked:
    'Google no longer lets Stillstats read this channel. Connect it again to see its numbers.',
  google_failed: 'YouTube did not answer. Try again in a few minutes.',
  consent_missing: 'The connection does not grant access to YouTube Analytics.',
  unauthenticated: 'Your session has ended. Sign in again to see your numbers.',
}

/**
 * What a screen shows for a refusal or an error: the screen's own text for its code, else the
 * shared one, else a failure that names what the screen was reading and the code.
 */
export function refusalMessageOf(
  answer: RefusalAnswer | ErrorAnswer,
  noun: string,
  overrides: RefusalTexts = {},
): string {
  const code = 'refusal' in answer ? answer.refusal : answer.error
  return overrides[code] ?? refusalTexts[code] ?? `Reading ${noun} failed: ${code}`
}

/** A custom range the API refused for its bounds, which a screen falls back from rather than shows. */
export interface RefusedRangeView {
  kind: 'invalid-range'
}

/** Whether the API refused the read's custom range for its bounds. */
export function isRangeRefusal(answer: object): boolean {
  return 'error' in answer && answer.error === 'invalid_range'
}
