import type { FeedbackScreen, FeedbackType } from './feedback.ts'

/** How many messages one page of the admin screen's list holds. */
export const adminFeedbackPageSize = 50

/**
 * A feedback message as the admin screen reads it, with no account ID: the screen names no user.
 * Times are ISO strings; `doneAt` is null while the message is open.
 */
export interface AdminFeedbackMessage {
  id: string
  type: FeedbackType
  text: string
  screen: FeedbackScreen
  appVersion: string | null
  replyTo: string | null
  createdAt: string
  doneAt: string | null
}

/**
 * The answer of GET /api/admin/feedback?page=N&open=true: one page of the messages, newest first,
 * and how many pages there are. `open=true` keeps only the messages not yet "Done". A page past
 * the last holds no message. A malformed `page`, or an `open` other than `true`, answers 400
 * `invalid_query`, and anyone not on the allowlist gets 404 `not_found`.
 */
export interface AdminFeedbackAnswer {
  messages: AdminFeedbackMessage[]
  pageCount: number
}

/**
 * The answer of PUT and DELETE /api/admin/feedback/:id/done, which set and clear the "Done" time:
 * the message as it now stands. A set keeps an earlier "Done" time. An unknown ID answers 404
 * `not_found`.
 */
export type AdminFeedbackDoneAnswer = AdminFeedbackMessage
