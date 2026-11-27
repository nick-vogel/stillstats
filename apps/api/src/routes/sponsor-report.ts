import {
  type ErrorAnswer,
  type SponsorChoiceAnswer,
  type SponsorReportAnswer,
  sponsorChoiceOf,
  sponsorFigures,
  sponsorFiguresOf,
} from '@creator-analytics/api-types'
import { heldChannelsOf } from '@creator-analytics/entitlements'
import type { Hono } from 'hono'
import { recordActivityDay } from '../activity-days.ts'
import {
  answerFailedRead,
  type ChannelReading,
  channelIdOf,
  refuse,
  type SignedIn,
} from '../signed-in.ts'
import { singleQueryOf } from '../single-query.ts'
import { readSponsorChoice, saveSponsorChoice } from '../sponsor-choice.ts'
import { sponsorReport } from '../sponsor-report.ts'

// Parsed here rather than by c.req.json(), whose error on malformed JSON would reach onError and
// answer 500 where the body is the client's mistake.
function jsonOf(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

/**
 * GET /api/channels/:channelId/videos/:videoId/sponsor-report, and PUT
 * /api/channels/:channelId/sponsor-figures, the channel's stored figure choice. The report is free
 * for every channel. A revenue figure in `figures`, or in the choice, is refused before any read or
 * write, so the report can never carry one.
 */
export function sponsorReportRoute(
  signedIn: Hono<SignedIn>,
  { database, gateway }: ChannelReading,
): void {
  signedIn.get(
    '/channels/:channelId/videos/:videoId/sponsor-report',
    recordActivityDay(database),
    async (c) => {
      const single = singleQueryOf(c.req.queries(), { figures: 'invalid_figure' as const })
      if (!single.ok) return c.json({ error: single.error } satisfies ErrorAnswer, 400)
      const asked = single.query.figures
      const chosen = asked === undefined ? undefined : sponsorFiguresOf(asked)
      if (chosen && 'fault' in chosen) {
        return c.json({ error: chosen.fault } satisfies ErrorAnswer, 400)
      }
      const channelId = channelIdOf(c)
      if (!channelId) return refuse(c, 'not_connected')
      const report = await database.asUser(c.get('user').id, async (tx) => {
        const figures = chosen?.figures ??
          (await readSponsorChoice(tx, channelId)) ?? [...sponsorFigures]
        return sponsorReport(gateway, tx, channelId, c.req.param('videoId'), figures)
      })
      if (!report.ok) return answerFailedRead(c, report)
      return c.json(report.answer satisfies SponsorReportAnswer)
    },
  )
  signedIn.put('/channels/:channelId/sponsor-figures', async (c) => {
    const channelId = channelIdOf(c)
    if (!channelId) return refuse(c, 'not_connected')
    const choice = sponsorChoiceOf(jsonOf(await c.req.text()))
    if ('fault' in choice) return c.json({ error: choice.fault } satisfies ErrorAnswer, 400)
    const saved = await database.asUser(c.get('user').id, async (tx) => {
      const held = (await heldChannelsOf(tx)).some((each) => each.channelId === channelId)
      if (held) await saveSponsorChoice(tx, channelId, choice.figures)
      return held
    })
    if (!saved) return refuse(c, 'not_connected')
    return c.json({ figures: choice.figures } satisfies SponsorChoiceAnswer)
  })
}
