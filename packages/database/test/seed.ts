import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import {
  channels,
  connectionIdentifiers,
  connections,
  memberships,
  proEnds,
  reachHistory,
  reachHistoryDays,
  readCache,
  reportingJobs,
  retentionCurveReads,
  retentionCurves,
  sponsorReportFigureChoices,
  subscriptions,
  users,
} from '../src/schema.ts'
import type { WebDatabase, WorkerDatabase } from '../src/scopes.ts'
import { fixtureNotes } from './fixtures.ts'
import { recordUserSubscription } from './pro.ts'

export async function seedUser(web: WebDatabase, userId: string): Promise<void> {
  await web.asAnonymous((scope) =>
    scope.sql
      .insert(users)
      .values({ id: userId, name: userId, email: `${userId}@example.com` })
      .onConflictDoNothing(),
  )
}

/**
 * A channel the user owns, with one row in every channel-owned table, so a test of a deletion or
 * a policy fails on a table that holds nothing. Returns the channel id; the YouTube channel id is
 * `UC` followed by it.
 */
export async function seedChannel(
  web: WebDatabase,
  worker: WorkerDatabase,
  ownerId: string,
): Promise<string> {
  await seedUser(web, ownerId)
  const channelId = randomUUID()
  await worker.forChannel(channelId, async (scope) => {
    await scope.sql.insert(channels).values({ id: channelId, youtubeChannelId: `UC${channelId}` })
    await scope.sql.insert(memberships).values({ channelId, userId: ownerId, role: 'owner' })
    await scope.sql.insert(connections).values({
      channelId,
      refreshToken: 'ciphertext',
      accessToken: 'ciphertext',
      accessTokenExpiresAt: scope.now,
      keyVersion: 1,
      scopes: [],
      status: 'active',
      connectedAt: scope.now,
    })
    await scope.sql
      .insert(connectionIdentifiers)
      .values({ channelId, kind: 'subject', hmac: `hmac-${channelId}` })
    await scope.sql.insert(readCache).values({
      channelId,
      key: 'fixture',
      payload: {},
      fetchedAt: scope.now,
      expiresAt: scope.now,
    })
    await scope.sql
      .insert(reportingJobs)
      .values({ channelId, jobId: `job-${channelId}`, createdAt: scope.now })
    // The channel's subscription as the release before blocks kept it, which the previous images
    // still read: ended, so the channel stays on the free tier.
    await scope.sql.insert(subscriptions).values({
      channelId,
      stripeCustomerId: `cus_${channelId}`,
      stripeSubscriptionId: `sub_${channelId}`,
      status: 'canceled',
      updatedAt: scope.now,
    })
    await scope.sql.insert(reachHistory).values({
      channelId,
      videoId: 'fixture',
      day: '2026-11-01',
      trafficSourceType: 0,
      impressions: 0,
      ctr: 0,
    })
    await scope.sql
      .insert(reachHistoryDays)
      .values({ channelId, day: '2026-11-01', reportCreatedAt: scope.now })
    await scope.sql.insert(retentionCurves).values({
      channelId,
      videoId: 'fixture',
      elapsedVideoTimeRatio: 0,
      audienceWatchRatio: 1,
      readAt: scope.now,
    })
    await scope.sql
      .insert(retentionCurveReads)
      .values({ channelId, videoId: 'fixture', readAt: scope.now })
    await scope.sql
      .insert(sponsorReportFigureChoices)
      .values({ channelId, figures: ['views'], updatedAt: scope.now })
    await scope.sql.insert(fixtureNotes).values({ channelId, body: 'fixture' })
  })
  // Stripe's webhook is the one writer of a pick, through the owner's subscription in the anonymous
  // scope: a purchase fills the owner's free slots, and its end leaves the picks, so the channel is
  // picked and free, as every channel was before it. A live paid subscription of the owner's
  // answers other_subscription and picks nothing.
  const turnedPro = await web.asAnonymous(async (scope) => {
    const event = {
      userId: ownerId,
      customer: `cus_${ownerId}`,
      subscription: `sub_seed_${channelId}`,
      plan: 'monthly',
      periodEnd: null,
      eventCreated: scope.now,
    } as const
    const paid = await recordUserSubscription(scope, { ...event, status: 'active' })
    await recordUserSubscription(scope, { ...event, status: 'canceled' })
    // The webhook is the one writer of a paid invoice, too.
    await scope.sql.execute(
      sql`select record_user_subscription_payment(${`in_${channelId}`}, ${ownerId}, null)`,
    )
    return paid.turnedPro
  })
  // The end of Pro of each channel the purchase turned Pro, which deleted its row, with the purge
  // date already cleared, as the history purge leaves it.
  for (const picked of new Set([...turnedPro, channelId])) {
    await worker.forChannel(picked, (scope) =>
      scope.sql
        .insert(proEnds)
        .values({ channelId: picked, endedAt: scope.now, purgeAfter: null })
        .onConflictDoNothing(),
    )
  }
  return channelId
}
