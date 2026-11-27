// Proof for pre-PR review 1, finding on a null last processed day.
// Run from the repo root: node docs/reviews/creator-analytics-2/repro/null-last-processed-day.ts
// The API's VideoListAnswer.lastProcessedDay is null when Google answers no day in the 90-day
// search (packages/api-types/src/videos.ts). This prints what the API makes of such a channel on
// 2026-10-07: a video published on 2026-06-29, whose first 28 days ended on 2026-07-26.

import { processedThroughOf } from '../../../../apps/api/src/calendar-range.ts'
import { partialOf } from '../../../../apps/api/src/window-after-publish.ts'

const today = '2026-10-07'
const partial = partialOf('first28', '2026-06-29', null, today)
console.log('processedThroughOf(null) =', processedThroughOf(null, today))
console.log("partialOf('first28', '2026-06-29', null) =", JSON.stringify(partial))
// The detail screen's rule (apps/api/src/video-detail.ts isAwaitingProcessing) for a video
// published on 2026-08-01: publishDay > processedThroughOf(null, today).
console.log(
  'detail awaitingProcessing for 2026-08-01 =',
  '2026-08-01' > processedThroughOf(null, today),
)
const wrong = partial.partial !== undefined
console.log(wrong ? 'DEFECT: a window that ended in July is partial' : 'no defect')
process.exit(wrong ? 1 : 0)
