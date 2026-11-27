import {
  type AdminFeedbackAnswer,
  type AdminFeedbackMessage,
  adminFeedbackPageSize,
} from '@creator-analytics/api-types'
import { feedbackMessages, type Scoped } from '@creator-analytics/database'
import { count, desc, eq, isNull, sql } from 'drizzle-orm'

/**
 * The user IDs on the admin allowlist, from `ADMIN_USER_IDS`: Better Auth's user IDs, comma
 * separated, each trimmed, an empty item dropped. Unset or empty, no one is an admin.
 */
export function adminUserIdsOf(env: Record<string, string | undefined>): ReadonlySet<string> {
  const ids = (env.ADMIN_USER_IDS ?? '').split(',').map((id) => id.trim())
  return new Set(ids.filter((id) => id !== ''))
}

/** Which page of the list, from 1, and whether it keeps only the messages not yet "Done". */
export interface FeedbackListRequest {
  page: number
  open: boolean
}

// Every column but the user's: the admin screen names no account.
const listedColumns = {
  id: feedbackMessages.id,
  type: feedbackMessages.type,
  text: feedbackMessages.text,
  screen: feedbackMessages.screen,
  appVersion: feedbackMessages.appVersion,
  replyTo: feedbackMessages.replyTo,
  createdAt: feedbackMessages.createdAt,
  doneAt: feedbackMessages.doneAt,
}

type ListedRow = Omit<AdminFeedbackMessage, 'createdAt' | 'doneAt'> & {
  createdAt: Date
  doneAt: Date | null
}

function messageOf({ createdAt, doneAt, ...row }: ListedRow): AdminFeedbackMessage {
  return { ...row, createdAt: createdAt.toISOString(), doneAt: doneAt?.toISOString() ?? null }
}

/**
 * One page of the messages, newest first, the ID breaking a tie, so a page boundary never repeats
 * or skips a message. A page past the last holds none.
 */
export async function listFeedback(
  scope: Scoped<'admin'>,
  { page, open }: FeedbackListRequest,
): Promise<AdminFeedbackAnswer> {
  const kept = open ? isNull(feedbackMessages.doneAt) : undefined
  const [counted] = await scope.sql.select({ total: count() }).from(feedbackMessages).where(kept)
  const rows = await scope.sql
    .select(listedColumns)
    .from(feedbackMessages)
    .where(kept)
    .orderBy(desc(feedbackMessages.createdAt), desc(feedbackMessages.id))
    .limit(adminFeedbackPageSize)
    .offset((page - 1) * adminFeedbackPageSize)
  return {
    messages: rows.map(messageOf),
    pageCount: Math.ceil((counted?.total ?? 0) / adminFeedbackPageSize),
  }
}

/**
 * Marks the message "Done" at the scope's pinned time, keeping an earlier "Done" time, so a second
 * press does not restart the year after which the message is deleted. Answers the message as it
 * now stands, or undefined when none has the ID.
 */
export async function setFeedbackDone(
  scope: Scoped<'admin'>,
  id: string,
): Promise<AdminFeedbackMessage | undefined> {
  const [row] = await scope.sql
    .update(feedbackMessages)
    .set({
      doneAt: sql`coalesce(${feedbackMessages.doneAt}, ${scope.now.toISOString()}::timestamptz)`,
    })
    .where(eq(feedbackMessages.id, id))
    .returning(listedColumns)
  return row && messageOf(row)
}

/** Clears the message's "Done" time. Answers it as it now stands, or undefined when none has the ID. */
export async function clearFeedbackDone(
  scope: Scoped<'admin'>,
  id: string,
): Promise<AdminFeedbackMessage | undefined> {
  const [row] = await scope.sql
    .update(feedbackMessages)
    .set({ doneAt: null })
    .where(eq(feedbackMessages.id, id))
    .returning(listedColumns)
  return row && messageOf(row)
}
