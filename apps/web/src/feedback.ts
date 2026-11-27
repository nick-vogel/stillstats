import {
  cleanFeedbackText,
  type ErrorCode,
  type FeedbackRequest,
  type FeedbackScreen,
  type FeedbackType,
  feedbackLengthOf,
  feedbackTextLimit,
  isReplyAddress,
} from '@creator-analytics/api-types'
import type { ProductEvent } from './landing.ts'

// Every string here is pending Nick's word-for-word approval (creator-analytics#582). Change them
// only with Nick.
export const sendFeedbackText = 'Send feedback' // pending Nick's word-for-word approval
export const feedbackTypeLabel = 'What is it about?' // pending Nick's word-for-word approval
export const feedbackTypeOptions: { value: FeedbackType; label: string }[] = [
  { value: 'something_wrong', label: 'Something is wrong' }, // pending Nick's word-for-word approval
  { value: 'idea', label: 'An idea' }, // pending Nick's word-for-word approval
  { value: 'other', label: 'Other' }, // pending Nick's word-for-word approval
]
export const feedbackTextLabel = 'Your message' // pending Nick's word-for-word approval
export const replyCheckboxText = 'You can reply to me at' // pending Nick's word-for-word approval
export const replyAddressLabel = 'Reply address' // pending Nick's word-for-word approval
export const invalidAddressText = 'Enter a valid email address.' // pending Nick's word-for-word approval
export const sendText = 'Send' // pending Nick's word-for-word approval
export const feedbackThanksText = 'Thank you for making Stillstats better!' // approved by Nick on 2026-11-16 (creator-analytics#750)
export const resetFormText = 'Reset form' // approved by Nick on 2026-11-16 (creator-analytics#750)
export const incompleteText = 'Choose a type and write a message.' // pending Nick's word-for-word approval
export const tooLongText = 'Your message is longer than 5,000 characters.' // pending Nick's word-for-word approval
export const dailyLimitText = 'You have sent 10 messages today. Try again tomorrow.' // pending Nick's word-for-word approval
export const failedSendText = 'Your message did not send. Try again.' // pending Nick's word-for-word approval

// The screens a message can come from, by name, as Nick's admin screen shows them.
export const screenNames: Record<FeedbackScreen, string> = {
  video_list: 'the video list', // pending Nick's word-for-word approval
  video_detail: "a video's page", // pending Nick's word-for-word approval
  audience: 'Audience', // pending Nick's word-for-word approval
  settings: 'Settings', // pending Nick's word-for-word approval
  whats_new: "What's new", // pending Nick's word-for-word approval
  extension: 'the extension', // approved by Nick on 2026-11-16 (creator-analytics#751)
}

/** The counter's text. Pending Nick's word-for-word approval. */
export function counterTextOf(left: number): string {
  return left >= 0 ? `${left} characters left` : `${-left} characters over the limit`
}

// Near the limit: a counter from the first character is noise.
const counterFrom = 4500

/**
 * How many characters the text has left before the limit, counted as the API counts them, after
 * the trim a send makes; below zero past it. Null under 4,500 characters, where no counter shows.
 */
export function charactersLeftOf(text: string): number | null {
  const length = feedbackLengthOf(cleanFeedbackText(text))
  return length < counterFrom ? null : feedbackTextLimit - length
}

/**
 * The form as the creator fills it. The reply address holds the account's email until edited, and
 * the app version is the build's, null when it has none.
 */
export interface FeedbackForm {
  type: FeedbackType | null
  text: string
  screen: FeedbackScreen
  appVersion: string | null
  replyWanted: boolean
  replyTo: string
}

/**
 * The form as it opens, and as Reset form brings it back: no type, no text, the reply box unticked
 * and the reply address the account's email, on the screen the form came from.
 */
export function emptyFeedbackFormOf(
  email: string,
  screen: FeedbackScreen,
  appVersion: string | null,
): FeedbackForm {
  return { type: null, text: '', screen, appVersion, replyWanted: false, replyTo: email }
}

export type FeedbackProblem = 'incomplete' | 'too_long' | 'invalid_address'

/** Why the form cannot be sent yet, by the API's rules, or null when it can. */
export function feedbackProblemOf(form: FeedbackForm): FeedbackProblem | null {
  const text = cleanFeedbackText(form.text)
  if (form.type === null || text === '') return 'incomplete'
  if (feedbackLengthOf(text) > feedbackTextLimit) return 'too_long'
  if (form.replyWanted && !isReplyAddress(form.replyTo)) return 'invalid_address'
  return null
}

/**
 * The body a send posts: the app version only when the build has one, the reply address only while
 * the box is ticked.
 */
export function feedbackRequestOf(form: FeedbackForm & { type: FeedbackType }): FeedbackRequest {
  const { type, text, screen, appVersion } = form
  return {
    type,
    text,
    screen,
    ...(appVersion !== null ? { appVersion } : {}),
    ...(form.replyWanted ? { replyTo: form.replyTo } : {}),
  }
}

/** The alert a failed send shows: the daily limit by name, any other failure as one. */
export function feedbackAlertOf(failure: ErrorCode | 'network'): string {
  return failure === 'rate_limited' ? dailyLimitText : failedSendText
}

/** Posts the message, and answers how it went: sent, or why not. */
export async function sendFeedback(
  request: FeedbackRequest,
): Promise<'sent' | ErrorCode | 'network'> {
  try {
    const response = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    })
    if (response.status === 201) return 'sent'
    const answer = (await response.json().catch(() => null)) as { error?: ErrorCode } | null
    return answer?.error ?? 'internal'
  } catch {
    return 'network'
  }
}

/**
 * Sent each time the form opens. It carries no account ID (approved by Nick on 2026-11-09,
 * creator-analytics#582).
 */
export const feedbackOpenedEvent = { name: 'feedback_opened' } as const satisfies ProductEvent

/**
 * Sent on a send the API saved, with the message's type and nothing else: no text, no reply
 * address and no account ID (approved by Nick on 2026-11-09, creator-analytics#582).
 */
export function feedbackSentEvent(type: FeedbackType): ProductEvent {
  return { name: 'feedback_sent', type }
}
