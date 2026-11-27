import type { ChannelDay, ChannelHistory } from '@creator-analytics/api-types'
import { reachHistory, reachHistoryDays, type Scoped } from '@creator-analytics/database'
import { entitlementOf, historyReadable } from '@creator-analytics/entitlements'
import { and, between, eq, max, min, sql } from 'drizzle-orm'

/** A day's or a range's impressions, and the clicks their CTRs stand for. */
interface Reach {
  impressions: number
  clicks: number
}

/** The channel CTR of ADR 0013: clicks over impressions, null with no impressions. */
function ctrOf({ impressions, clicks }: Reach): number | null {
  return impressions === 0 ? null : clicks / impressions
}

/**
 * A paid or an ended channel's history over the summary's days (`daily`, oldest first): the range's
 * totals and channel CTR, its first and newest day, an ended channel's purge date, and the days
 * with their numbers laid on each day it holds. `countsVideo` says which videos the summary's
 * format counts. Undefined, with the days as given, for a free channel, an ended one past its purge
 * date, or one whose history holds no day yet.
 */
export async function withHistoryOf<Day extends ChannelDay>(
  tx: Scoped<'user'>,
  channelId: string,
  daily: Day[],
  countsVideo: (videoId: string) => boolean,
): Promise<{ history: ChannelHistory | undefined; daily: Day[] }> {
  const none = { history: undefined, daily }
  const entitlement = await entitlementOf(tx, channelId)
  if (!historyReadable(entitlement)) return none
  const [held] = await tx.sql
    .select({ firstDay: min(reachHistoryDays.day), newestDay: max(reachHistoryDays.day) })
    .from(reachHistoryDays)
    .where(eq(reachHistoryDays.channelId, channelId))
  const heldFirstDay = held?.firstDay
  const newestDay = held?.newestDay
  if (!heldFirstDay || !newestDay) return none
  const { purgeDate } = entitlement
  const ends = {
    firstDay: heldFirstDay,
    newestDay,
    ...(purgeDate && { purgeDate: purgeDate.toISOString().slice(0, 10) }),
  }
  const firstDay = daily[0]?.day
  const lastDay = daily.at(-1)?.day
  if (firstDay === undefined || lastDay === undefined) {
    return { history: { impressions: 0, ctr: null, ...ends }, daily }
  }

  const heldDays = await tx.sql
    .select({ day: reachHistoryDays.day })
    .from(reachHistoryDays)
    .where(
      and(
        eq(reachHistoryDays.channelId, channelId),
        between(reachHistoryDays.day, firstDay, lastDay),
      ),
    )
  const rows = await tx.sql
    .select({
      videoId: reachHistory.videoId,
      day: reachHistory.day,
      impressions: sql<number>`sum(${reachHistory.impressions})::integer`,
      clicks: sql<number>`sum(${reachHistory.impressions} * ${reachHistory.ctr})::float8`,
    })
    .from(reachHistory)
    .where(and(eq(reachHistory.channelId, channelId), between(reachHistory.day, firstDay, lastDay)))
    .groupBy(reachHistory.videoId, reachHistory.day)

  const reachOf = new Map<string, Reach>(
    heldDays.map(({ day }) => [day, { impressions: 0, clicks: 0 }]),
  )
  const total: Reach = { impressions: 0, clicks: 0 }
  for (const row of rows) {
    const day = reachOf.get(row.day)
    if (!day || !countsVideo(row.videoId)) continue
    day.impressions += row.impressions
    day.clicks += row.clicks
    total.impressions += row.impressions
    total.clicks += row.clicks
  }
  return {
    history: { impressions: total.impressions, ctr: ctrOf(total), ...ends },
    daily: daily.map((day) => {
      const reach = reachOf.get(day.day)
      return reach ? { ...day, impressions: reach.impressions, ctr: ctrOf(reach) } : day
    }),
  }
}
