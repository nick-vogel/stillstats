/** GET /api/me/support: the signed-in creator's way to leave a Tip, when Stripe is configured. */
export interface SupportAnswer {
  /** The Payment Link, tied to the creator's user ID. Null when there is none to offer. */
  link: string | null
  /** Whether the sidebar prompt shows. */
  prompt: boolean
}
