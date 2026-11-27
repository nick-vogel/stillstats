import type { FeedbackType } from '@creator-analytics/api-types'
import type { Reporter } from '@creator-analytics/reporter'
import { webAppPath } from './auth.ts'
import type { EmailPort, NotificationEmail } from './notification-email.ts'

/** What the notification email may hold of a saved message: never its text or its reply address. */
export interface SavedFeedback {
  id: string
  type: FeedbackType
  createdAt: Date
}

/** Tells Nick of each saved feedback message. */
export interface FeedbackNotifier {
  /** Never rejects: a failed send is reported with the message's ID, and the save stands. */
  notify(saved: SavedFeedback): Promise<void>
}

/** The types in the feedback form's own words. */
const typeWords: Record<FeedbackType, string> = {
  something_wrong: 'Something is wrong', // pending Nick's word-for-word approval
  idea: 'An idea', // pending Nick's word-for-word approval
  other: 'Other', // pending Nick's word-for-word approval
}

/** The admin screen's path under the web app, which lists the messages. */
const adminFeedbackPath = `${webAppPath}/admin/feedback`

/**
 * The email for one message: the type in words, the time it was saved in UTC to the minute, and the
 * admin screen's link under `baseURL`'s origin. It takes the type and the time only, so the text,
 * the reply address, the user and the message's ID cannot reach it.
 */
export function feedbackNoticeOf(
  { type, createdAt }: Pick<SavedFeedback, 'type' | 'createdAt'>,
  baseURL: string,
): NotificationEmail {
  const words = typeWords[type]
  const sent = `${createdAt.toISOString().slice(0, 16).replace('T', ' ')} UTC`
  return {
    subject: `Stillstats feedback: ${words}`, // pending Nick's word-for-word approval
    text: [
      'A feedback message arrived.', // pending Nick's word-for-word approval
      '',
      `Type: ${words}`,
      `Sent: ${sent}`,
      `Read it: ${new URL(adminFeedbackPath, baseURL).href}`,
      '',
    ].join('\n'),
  }
}

/**
 * Sends each notice through the port. With no port, as when the email settings are unset, it sends
 * nothing. A failed send is reported once, with the message's ID, the one value that rides along.
 */
export function createFeedbackNotifier({
  port,
  baseURL,
  reporter,
}: {
  port: EmailPort | undefined
  baseURL: string
  reporter: Reporter
}): FeedbackNotifier {
  if (!port) return { notify: async () => {} }
  return {
    async notify(saved) {
      try {
        await port.send(feedbackNoticeOf(saved, baseURL))
      } catch (error) {
        reporter.report({
          message: 'The feedback notification did not send',
          context: { feedbackMessageId: saved.id },
          error,
        })
      }
    },
  }
}
