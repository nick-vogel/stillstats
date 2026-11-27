import { randomUUID } from 'node:crypto'
import {
  cleanFeedbackText,
  type ErrorCode,
  type FeedbackScreen,
  type FeedbackType,
  feedbackLengthOf,
  feedbackScreens,
  feedbackTextLimit,
  feedbackTypes,
  isReplyAddress,
} from '@creator-analytics/api-types'
import {
  feedbackCountToday,
  feedbackMessages,
  type Scoped,
  setting,
} from '@creator-analytics/database'
import { isAppVersion } from '@creator-analytics/releases'
import type { SavedFeedback } from './feedback-notice.ts'
import { isOneOf } from './one-of.ts'

/** The most messages one account sends in 24 hours; the next is refused. */
export const feedbackDailyLimit = 10

/**
 * A feedback message as it is saved: the text cleaned, the app version and the reply address null
 * when none was sent.
 */
export interface FeedbackMessage {
  type: FeedbackType
  text: string
  screen: FeedbackScreen
  appVersion: string | null
  replyTo: string | null
}

/**
 * The message the body sends, or the code of the first rule it breaks, checked in this order: the
 * type, the text after cleaning, the screen, the app version, the reply address. A key the body holds beyond these
 * is ignored, so a later client can send one before the API reads it.
 */
export function feedbackOf(body: unknown): { message: FeedbackMessage } | { error: ErrorCode } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { error: 'invalid_feedback' }
  }
  const { type, text, screen, appVersion = null, replyTo = null } = body as Record<string, unknown>
  if (!isOneOf(feedbackTypes, type)) return { error: 'invalid_feedback_type' }
  const cleaned = typeof text === 'string' ? cleanFeedbackText(text) : ''
  if (cleaned === '' || feedbackLengthOf(cleaned) > feedbackTextLimit) {
    return { error: 'invalid_feedback_text' }
  }
  if (!isOneOf(feedbackScreens, screen)) return { error: 'invalid_feedback_screen' }
  if (appVersion !== null && (typeof appVersion !== 'string' || !isAppVersion(appVersion))) {
    return { error: 'invalid_app_version' }
  }
  if (replyTo !== null && (typeof replyTo !== 'string' || !isReplyAddress(replyTo))) {
    return { error: 'invalid_reply_address' }
  }
  return { message: { type, text: cleaned, screen, appVersion, replyTo } }
}

/** Whether the scope's user has sent the most messages the last 24 hours allow. */
export async function isOverFeedbackLimit(tx: Scoped<'user'>): Promise<boolean> {
  return (await feedbackCountToday(tx)) >= feedbackDailyLimit
}

/**
 * Saves the message as the scope's user's, at the scope's pinned time, with its app version as
 * sent, and answers what the notification email may hold of it. The ID is made here, since the
 * user scope cannot read the row back.
 */
export async function saveFeedback(
  tx: Scoped<'user'>,
  message: FeedbackMessage,
): Promise<SavedFeedback> {
  const saved = { id: randomUUID(), type: message.type, createdAt: tx.now }
  await tx.sql.insert(feedbackMessages).values({
    ...message,
    ...saved,
    userId: setting('app.user_id'),
  })
  return saved
}
