import {
  type AdminGrant,
  type AdminGrantRequest,
  type AdminGrantsAnswer,
  adminGrantMaxBlocks,
  type ErrorAnswer,
} from '@creator-analytics/api-types'
import { longDateOf } from './processing.ts'

// Drafted for stillstats#24, for Nick's word-for-word approval: the admin screens' tab strip, and
// the Grants tab's heading, form, list, question and lines. Change them only with Nick.
export const adminTabsLabel = 'Admin screens'
export const feedbackTabText = 'Feedback'
export const grantsTabText = 'Grants'
export const adminGrantsHeading = 'Pro grants'
export const emailLabel = 'Email'
export const blocksLabel = 'Blocks'
export const endDateLabel = 'End date (optional)'
export const grantText = 'Grant'
export const allBlocksLabel = 'All blocks'
export const endsLabel = 'Ends'
export const noEndText = 'No end'
export const removeText = 'Remove'
export const noGrantsText = 'No grants.'
export const listFailedText = 'The grants did not load. Try again.'
export const unknownEmailText = 'No user has that email.'
export const invalidGrantText = `Check the grant: an email, a whole number of blocks from 1 to ${adminGrantMaxBlocks}, and an end date after today, or none.`
export const grantFailedText = 'The grant did not save. Try again.'
export const removeFailedText = 'The grant was not removed. Try again.'

/** What the user a grant goes to holds: every granted block of theirs beside their paid ones. */
export function allBlocksTextOf({ grantedBlocks, paidBlocks }: AdminGrant): string {
  return `${grantedBlocks} granted, ${paidBlocks} paid`
}

/** The day a grant ends on, in the locale as Settings writes its dates, or that it has none. */
export function endsTextOf(endsAt: string | null, locale?: string): string {
  return endsAt === null ? noEndText : longDateOf(endsAt.slice(0, 10), locale)
}

/** The question "Remove" asks before it deletes the grant. */
export function removeQuestionOf({ blocks, email }: AdminGrant): string {
  return `Remove the grant of ${blocks} ${blocks === 1 ? 'block' : 'blocks'} to ${email}?`
}

/** The Grants tab's form as typed: the date input gives `YYYY-MM-DD`, or '' while it is empty. */
export interface AdminGrantForm {
  email: string
  blocks: string
  endsOn: string
}

export const emptyAdminGrantForm: AdminGrantForm = { email: '', blocks: '1', endsOn: '' }

/**
 * The request the form sends: the email trimmed, the blocks as a number, and the end day, or null
 * for a grant with no end. The API checks every rule, so the form sends what was typed.
 */
export function adminGrantRequestOf({ email, blocks, endsOn }: AdminGrantForm): AdminGrantRequest {
  return { email: email.trim(), blocks: Number(blocks), endsOn: endsOn === '' ? null : endsOn }
}

const adminGrantsPath = '/api/admin/grants'

/**
 * The Grants tab once its read lands: the list, the not-found screen for anyone the API answers
 * 404, as it answers anyone not on the allowlist, or a failure's alert.
 */
export type AdminGrantsView =
  | ({ kind: 'list' } & AdminGrantsAnswer)
  | { kind: 'not-found' }
  | { kind: 'failed'; alert: string }

export async function readAdminGrants(): Promise<AdminGrantsView> {
  try {
    const response = await fetch(adminGrantsPath)
    if (response.status === 404) return { kind: 'not-found' }
    if (!response.ok) return { kind: 'failed', alert: listFailedText }
    const { grants } = (await response.json()) as AdminGrantsAnswer
    return { kind: 'list', grants }
  } catch {
    return { kind: 'failed', alert: listFailedText }
  }
}

/** A change on the Grants tab: the list after it, as the API answers it, or the alert. */
export type AdminGrantsChange = { ok: true; grants: AdminGrant[] } | { ok: false; alert: string }

/**
 * Posts a grant, and answers the list after it, or the alert: what the grant needs for a body the
 * API refused, that no user has the email for an unknown one, and else that it did not save.
 */
export async function createAdminGrant(request: AdminGrantRequest): Promise<AdminGrantsChange> {
  try {
    const response = await fetch(adminGrantsPath, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    })
    if (response.ok) {
      const { grants } = (await response.json()) as AdminGrantsAnswer
      return { ok: true, grants }
    }
    const { error } = (await response.json()) as Partial<ErrorAnswer>
    if (response.status === 400 && error === 'invalid_grant') {
      return { ok: false, alert: invalidGrantText }
    }
    if (response.status === 404 && error === 'unknown_email') {
      return { ok: false, alert: unknownEmailText }
    }
    return { ok: false, alert: grantFailedText }
  } catch {
    return { ok: false, alert: grantFailedText }
  }
}

/** Deletes a grant, and answers the list after it, or the alert. */
export async function removeAdminGrant(id: string): Promise<AdminGrantsChange> {
  try {
    const response = await fetch(`${adminGrantsPath}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
    if (!response.ok) return { ok: false, alert: removeFailedText }
    const { grants } = (await response.json()) as AdminGrantsAnswer
    return { ok: true, grants }
  } catch {
    return { ok: false, alert: removeFailedText }
  }
}
