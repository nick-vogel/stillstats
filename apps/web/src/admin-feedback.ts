import type {
  AdminFeedbackAnswer,
  AdminFeedbackDoneAnswer,
  AdminFeedbackMessage,
  FeedbackScreen,
  FeedbackType,
} from '@creator-analytics/api-types'
import { feedbackTypeOptions, screenNames } from './feedback.ts'

// Every string here is pending Nick's word-for-word approval (creator-analytics#583). Change them
// only with Nick. The type and screen words are the feedback form's own, from feedback.ts.
export const adminFeedbackHeading = 'Feedback' // pending Nick's word-for-word approval
export const openOnlyText = 'Only open messages' // pending Nick's word-for-word approval
export const typeLabel = 'Type' // pending Nick's word-for-word approval
export const sentLabel = 'Sent' // pending Nick's word-for-word approval
export const screenLabel = 'Screen' // pending Nick's word-for-word approval
export const versionLabel = 'Version' // pending Nick's word-for-word approval
export const replyAddressLabel = 'Reply address' // pending Nick's word-for-word approval
export const messageLabel = 'Message' // pending Nick's word-for-word approval
export const noVersionText = 'No version' // pending Nick's word-for-word approval
export const noReplyAddressText = 'No reply address' // pending Nick's word-for-word approval
export const doneText = 'Done' // pending Nick's word-for-word approval
export const newerText = 'Newer' // pending Nick's word-for-word approval
export const olderText = 'Older' // pending Nick's word-for-word approval
export const noMessagesText = 'No messages.' // pending Nick's word-for-word approval
export const listFailedText = 'The messages did not load. Try again.' // pending Nick's word-for-word approval
export const doneFailedText = 'The change did not save. Try again.' // pending Nick's word-for-word approval
export const notFoundHeading = 'This page does not exist.' // pending Nick's word-for-word approval
export const notFoundLinkText = 'Go to your videos' // pending Nick's word-for-word approval

/** The type as the feedback form names it. */
export function typeTextOf(type: FeedbackType): string {
  return feedbackTypeOptions.find((option) => option.value === type)?.label ?? type
}

/** The screen's name, from `screenNames`. */
export function screenTextOf(screen: FeedbackScreen): string {
  return screenNames[screen]
}

/** The time a message was sent, as a medium date and a short time in the reader's locale. */
export function sentTextOf(createdAt: string, locale?: string, timeZone?: string): string {
  return new Date(createdAt).toLocaleString(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...(timeZone ? { timeZone } : {}),
  })
}

export function versionTextOf(appVersion: string | null): string {
  return appVersion ?? noVersionText
}

export function replyAddressTextOf(replyTo: string | null): string {
  return replyTo ?? noReplyAddressText
}

/**
 * What tells one message's "Done" control from the next for a screen reader: the message's type
 * and the time it was sent.
 */
export function doneDescriptionOf(
  message: AdminFeedbackMessage,
  locale?: string,
  timeZone?: string,
): string {
  return `${typeTextOf(message.type)}, ${sentTextOf(message.createdAt, locale, timeZone)}`
}

/** Where a page of the list is read, only the open messages when `open`. */
export function adminFeedbackPathOf(page: number, open: boolean): string {
  return `/api/admin/feedback?page=${page}${open ? '&open=true' : ''}`
}

/**
 * The admin screen once its read lands: a page of the list, the not-found screen for anyone the
 * API answers 404, as it answers anyone not on the allowlist, or a failure's alert.
 */
export type AdminFeedbackView =
  | ({ kind: 'list' } & AdminFeedbackAnswer)
  | { kind: 'not-found' }
  | { kind: 'failed'; alert: string }

export async function readAdminFeedback(page: number, open: boolean): Promise<AdminFeedbackView> {
  try {
    const response = await fetch(adminFeedbackPathOf(page, open))
    if (response.status === 404) return { kind: 'not-found' }
    if (!response.ok) return { kind: 'failed', alert: listFailedText }
    const { messages, pageCount } = (await response.json()) as AdminFeedbackAnswer
    return { kind: 'list', messages, pageCount }
  } catch {
    return { kind: 'failed', alert: listFailedText }
  }
}

/** Sets or clears a message's "Done" time, and answers the message as it now stands, or the alert. */
export async function saveDone(
  id: string,
  done: boolean,
): Promise<{ ok: true; message: AdminFeedbackMessage } | { ok: false; alert: string }> {
  try {
    const response = await fetch(`/api/admin/feedback/${encodeURIComponent(id)}/done`, {
      method: done ? 'PUT' : 'DELETE',
    })
    if (!response.ok) return { ok: false, alert: doneFailedText }
    return { ok: true, message: (await response.json()) as AdminFeedbackDoneAnswer }
  } catch {
    return { ok: false, alert: doneFailedText }
  }
}
