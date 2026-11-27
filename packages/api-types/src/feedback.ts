/** What a feedback message is about. */
export const feedbackTypes = ['something_wrong', 'idea', 'other'] as const
export type FeedbackType = (typeof feedbackTypes)[number]

/**
 * The screen the creator sent a feedback message from: a name from this fixed set, never a path or
 * a query, so no channel ID and no video ID reaches the message. `extension` names the extension
 * popup's "Send feedback" link, not a screen of the web app.
 */
export const feedbackScreens = [
  'video_list',
  'video_detail',
  'audience',
  'settings',
  'whats_new',
  'extension',
] as const
export type FeedbackScreen = (typeof feedbackScreens)[number]

/** The most characters a feedback message's text holds, counted by `feedbackLengthOf`. */
export const feedbackTextLimit = 5000

/** The longest reply address, the most an SMTP path allows (RFC 5321, section 4.5.3.1.3). */
export const replyAddressLimit = 254

/**
 * The body of POST /api/feedback. The API answers 201 with no body. An `appVersion` or a `replyTo`
 * that is absent or null stores none, and a key not named here is ignored.
 */
export interface FeedbackRequest {
  type: FeedbackType
  text: string
  screen: FeedbackScreen
  /** The app version the creator runs, in the app's CalVer, `YYYY.M.D` or `YYYY.M.D.N`. */
  appVersion?: string | null
  replyTo?: string | null
}

const keptControlCharacters = new Set(['\n', '\r', '\t'])

/**
 * The text as it is checked and saved: every control character but a line break or a tab removed,
 * then trimmed, so a text of only control characters and spaces is empty.
 */
export function cleanFeedbackText(text: string): string {
  return text
    .replace(/\p{Cc}/gu, (character) => (keptControlCharacters.has(character) ? character : ''))
    .trim()
}

/**
 * The text's length in code points, so an emoji counts as one, and the API's limit and the form's
 * counter never disagree.
 */
export function feedbackLengthOf(text: string): number {
  return [...text].length
}

// The valid email address of the HTML standard, the one `<input type="email">` checks, so the form
// and the API agree.
const validEmailAddress =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

export function isReplyAddress(text: string): boolean {
  return text.length <= replyAddressLimit && validEmailAddress.test(text)
}
