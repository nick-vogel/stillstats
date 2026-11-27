import type { UsState, VideoFormatFilter } from '@creator-analytics/api-types'
import { everyFormatText } from './audience.ts'
import { TopBarsSection } from './TopBarsSection.tsx'
import { usStateBarsOf } from './us-states.ts'

// The heading and the note are approved word for word in creator-analytics#268 on 2026-10-19.
const fewViewsNote =
  'YouTube leaves out states with few views, so the states can add up to less than the United States total.'

/**
 * The US states the channel's engaged views came from, most engaged views first, then the note,
 * and with a format chosen the note that the states count every format, as the API reads them for
 * every format. With no state, the heading and the empty state alone.
 */
export function UsStates({ usStates, format }: { usStates: UsState[]; format: VideoFormatFilter }) {
  return (
    <TopBarsSection
      heading="US states (engaged views)"
      bars={usStateBarsOf(usStates)}
      notes={format === 'all' ? [fewViewsNote] : [fewViewsNote, everyFormatText]}
    />
  )
}
