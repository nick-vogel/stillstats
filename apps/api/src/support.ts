/**
 * The three Stripe settings a tip needs: the link a creator opens, the webhook's secret, and the
 * link's ID, which tells the tip link's sessions from any other Checkout Session on the Stripe
 * account, such as a Pro Checkout.
 */
export interface SupportSettings {
  paymentLinkUrl: string
  webhookSecret: string
  /** The Payment Link's ID, Stripe's `plink_...`, which each of its Checkout Sessions carries. */
  paymentLinkId: string
}

/**
 * Stripe's settings from the API's env. None set means no support UI. Some but not all, a link
 * that is not a URL, or an ID that is not a Payment Link's throws, so the API refuses to start
 * rather than fail on a click or take another Checkout Session for a tip.
 */
export function supportSettingsOf(
  env: Readonly<Record<string, string | undefined>>,
): SupportSettings | undefined {
  const paymentLinkUrl = env.STRIPE_PAYMENT_LINK_URL
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET
  const paymentLinkId = env.STRIPE_PAYMENT_LINK_ID
  if (!paymentLinkUrl && !webhookSecret && !paymentLinkId) return undefined
  if (!paymentLinkUrl || !webhookSecret || !paymentLinkId)
    throw new Error(
      'Set all three of STRIPE_PAYMENT_LINK_URL, STRIPE_WEBHOOK_SECRET and STRIPE_PAYMENT_LINK_ID, or none',
    )
  if (!URL.canParse(paymentLinkUrl)) throw new Error('STRIPE_PAYMENT_LINK_URL is not a URL')
  if (!paymentLinkId.startsWith('plink_'))
    throw new Error("STRIPE_PAYMENT_LINK_ID is not a Payment Link's ID, which starts with plink_")
  return { paymentLinkUrl, webhookSecret, paymentLinkId }
}

/**
 * Stripe's rule for `client_reference_id`, from docs.stripe.com/payment-links/url-parameters
 * (checked 2026-11-04). Stripe silently drops a value that breaks it, so a tip through that link
 * could never be tied to its creator.
 */
export function fitsClientReferenceId(id: string): boolean {
  return /^[A-Za-z0-9_-]{1,200}$/.test(id)
}

/** The Payment Link with the creator's user ID as `client_reference_id`, and no prefilled email. */
export function supportLinkOf(settings: SupportSettings, userId: string): string {
  const link = new URL(settings.paymentLinkUrl)
  link.searchParams.set('client_reference_id', userId)
  return link.href
}
