import type { SponsorReportFigure } from '@creator-analytics/api-types'
import { type Scoped, sponsorReportFigureChoices } from '@creator-analytics/database'
import { eq } from 'drizzle-orm'

/** The channel's stored sponsor report figures, in report order, or undefined when none is stored. */
export async function readSponsorChoice(
  tx: Scoped<'user'>,
  channelId: string,
): Promise<SponsorReportFigure[] | undefined> {
  const [row] = await tx.sql
    .select({ figures: sponsorReportFigureChoices.figures })
    .from(sponsorReportFigureChoices)
    .where(eq(sponsorReportFigureChoices.channelId, channelId))
  return row?.figures
}

/** Stores the channel's sponsor report figures, replacing any choice it held. */
export async function saveSponsorChoice(
  tx: Scoped<'user'>,
  channelId: string,
  figures: readonly SponsorReportFigure[],
): Promise<void> {
  const values = { figures: [...figures], updatedAt: tx.now }
  await tx.sql
    .insert(sponsorReportFigureChoices)
    .values({ channelId, ...values })
    .onConflictDoUpdate({ target: sponsorReportFigureChoices.channelId, set: values })
}
