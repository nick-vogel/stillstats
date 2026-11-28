/**
 * A Pro grant as the admin screen's Grants tab reads it: blocks of Pro given to a user without a
 * purchase (stillstats#24). Times are ISO strings. `paidBlocks` are the blocks of the user's live
 * paid subscription, 0 without one, and `grantedBlocks` the sum of every grant the user holds,
 * this one included, so the list can label the granted blocks beside the paid ones.
 */
export interface AdminGrant {
  id: string
  /** The email of the user the grant is to. */
  email: string
  /** The blocks this grant gives, each 4 channel slots. */
  blocks: number
  /** When the grant ends, 00:00 UTC of the end day; null for a grant with no end. */
  endsAt: string | null
  createdAt: string
  paidBlocks: number
  grantedBlocks: number
}

/**
 * The answer of GET /api/admin/grants, every grant newest first. POST /api/admin/grants and
 * DELETE /api/admin/grants/:id answer it too, after the change. Anyone not on the allowlist gets
 * 404 `not_found`.
 */
export interface AdminGrantsAnswer {
  grants: AdminGrant[]
}

/**
 * POST /api/admin/grants: the user's email, a whole number of blocks from 1 to 100, and the end
 * day, `YYYY-MM-DD` after today in UTC, or null for a grant with no end. The grant ends at 00:00
 * UTC of that day. A body that breaks a rule answers 400 `invalid_grant`, and an email no user
 * holds 404 `unknown_email`.
 */
export interface AdminGrantRequest {
  email: string
  blocks: number
  endsOn: string | null
}

/** The most blocks one grant may give; the bound only stops a typo granting thousands. */
export const adminGrantMaxBlocks = 100
