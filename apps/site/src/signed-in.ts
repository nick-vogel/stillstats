import type { MeAnswer } from '@creator-analytics/api-types'

export type SignedInUser = Pick<MeAnswer, 'email'>

// The strings are approved word for word in creator-analytics#157. Change them only with Nick.
export const dashboardLinkText = 'Open your dashboard'

// The tool page's back link, signed in and signed out. The strings are approved word for word in
// creator-analytics#889 (the 2026-11-18 mockup session). Change them only with Nick.
export const accountBackLinkText = 'Back to your account'
export const homeBackLinkText = 'Home'

export function avatarLabelOf(email: string): string {
  return `Open Stillstats, signed in as ${email}`
}

function isSignedInUser(body: unknown): body is SignedInUser {
  return (
    typeof body === 'object' && body !== null && 'email' in body && typeof body.email === 'string'
  )
}

/**
 * The user GET /api/me answers for, or null on a 401, any other failure, or a body that does not
 * read as a user. It never throws, because a page that cannot tell stays signed out.
 */
export async function signedInUserOf(
  fetchMe: () => Promise<Response>,
): Promise<SignedInUser | null> {
  try {
    const response = await fetchMe()
    if (response.status !== 200) return null
    const body: unknown = await response.json()
    return isSignedInUser(body) ? body : null
  } catch {
    return null
  }
}
