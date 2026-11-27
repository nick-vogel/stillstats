/** GET /api/me. */
export interface MeAnswer {
  email: string
  name: string
  /** When the account was created, an ISO 8601 time. */
  createdAt: string
}

/** DELETE /api/me. */
export interface DeleteMeAnswer {
  /** False when Google did not confirm the revoke of one of the user's channels' grants. */
  revokedAtGoogle: boolean
}
