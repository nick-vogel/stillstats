import Stripe from 'stripe'

/** Cancels a deleted channel's Stripe subscription at once and refunds the unused part. */
export interface SubscriptionCanceller {
  /**
   * Safe to run again from any point: a canceled subscription is not canceled again, and a
   * refund this cancellation already made is not made again.
   */
  cancelAndRefund(
    subscriptionId: string,
    cancellation: { cancellationId: string; channelId: string },
  ): Promise<void>
}

/** The fake Stripe server's address, which a test points the client at in place of Stripe's. */
export interface StripeApi {
  host: string
  port: number
  protocol: 'http' | 'https'
  maxNetworkRetries?: number
}

/**
 * The worker's Stripe key, or undefined when it has none. A key that is neither a secret key,
 * `sk_`, nor a restricted key, `rk_`, throws, so the worker refuses to start with it.
 */
export function stripeSecretKeyOf(
  env: Readonly<Record<string, string | undefined>>,
): string | undefined {
  const secretKey = env.STRIPE_SECRET_KEY
  if (!secretKey) return undefined
  if (!secretKey.startsWith('sk_') && !secretKey.startsWith('rk_'))
    throw new Error('STRIPE_SECRET_KEY is not a secret key, sk_, or a restricted key, rk_')
  return secretKey
}

// The API's metadata key for the channel a subscription pays for (apps/api/src/billing.ts), and the
// one that ties a refund to the cancellation that made it.
const channelMetadataKey = 'stillstats_channel_id'
const cancellationMetadataKey = 'stillstats_cancellation_id'

/**
 * Stripe's rules here are from docs.stripe.com, checked 2026-11-17. Cancelling with `prorate` and
 * `invoice_now` false ends the subscription at once with no proration credit, which would only
 * land on the customer's credit balance; the cash return is a separate refund against the latest
 * invoice's PaymentIntent. Under Adaptive Pricing the invoice and its PaymentIntent are in the
 * price's currency, and Stripe refunds that amount in the currency the customer paid at the
 * original rate, so the refund names no currency. Under Managed Payments Link tells the customer
 * of the refund, and the refund includes the tax they paid.
 */
export function createStripeCanceller({
  secretKey,
  stripeApi,
}: {
  secretKey: string
  stripeApi?: StripeApi
}): SubscriptionCanceller {
  const stripe = new Stripe(secretKey, stripeApi ?? {})

  return {
    async cancelAndRefund(subscriptionId, { cancellationId, channelId }) {
      let subscription = await stripe.subscriptions.retrieve(subscriptionId)
      if (subscription.status !== 'canceled') {
        subscription = await stripe.subscriptions.cancel(
          subscriptionId,
          {
            prorate: false,
            invoice_now: false,
            cancellation_details: {
              comment: `Stillstats deleted the channel it paid for (cancellation ${cancellationId})`,
            },
          },
          { idempotencyKey: `cancel-${cancellationId}` },
        )
      }
      const invoiceId =
        typeof subscription.latest_invoice === 'string'
          ? subscription.latest_invoice
          : subscription.latest_invoice?.id
      if (!invoiceId) return
      const invoice = await stripe.invoices.retrieve(invoiceId, { expand: ['payments'] })
      if (invoice.status !== 'paid' || invoice.amount_paid <= 0) return

      const amount = unusedAmount(subscription, invoice.amount_paid)
      if (amount <= 0) return
      const payment = invoice.payments?.data.find(
        ({ payment }) => payment.type === 'payment_intent' && payment.payment_intent,
      )?.payment.payment_intent
      const paymentIntent = typeof payment === 'string' ? payment : payment?.id
      if (!paymentIntent) {
        throw new Error(`The paid invoice ${invoiceId} names no PaymentIntent to refund`)
      }

      // Stripe keeps an idempotency key for 24 hours, and a cancellation can be retried after
      // that, so the refund this cancellation made is looked for by its metadata first.
      const refunds = await stripe.refunds.list({ payment_intent: paymentIntent, limit: 100 })
      if (
        refunds.data.some((refund) => refund.metadata?.[cancellationMetadataKey] === cancellationId)
      )
        return
      await stripe.refunds.create(
        {
          payment_intent: paymentIntent,
          amount,
          metadata: { [cancellationMetadataKey]: cancellationId, [channelMetadataKey]: channelId },
        },
        { idempotencyKey: `refund-${cancellationId}` },
      )
    },
  }
}

/**
 * The paid amount's share of the period left after the subscription ended, rounded to the
 * currency's smallest unit. Stripe's time, not the worker's clock, so every retry refunds the same.
 * Stripe's `ended_at`, not its `canceled_at`: a subscription canceled at period end keeps the time
 * of the request as its `canceled_at` though it ran to the end of the period it paid for.
 */
function unusedAmount(subscription: Stripe.Subscription, amountPaid: number): number {
  const item = subscription.items.data[0]
  const endedAt = subscription.ended_at
  if (!item || endedAt === null) {
    throw new Error(`The canceled subscription ${subscription.id} has no period or end time`)
  }
  const period = item.current_period_end - item.current_period_start
  if (period <= 0) return 0
  const unused = Math.min(Math.max(item.current_period_end - endedAt, 0), period)
  return Math.round((amountPaid * unused) / period)
}
