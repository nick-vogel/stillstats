import type { City, VideoFormatFilter } from '@creator-analytics/api-types'
import { everyFormatText } from './audience.ts'
import { cityBarsOf } from './cities.ts'
import { TopBarsSection } from './TopBarsSection.tsx'

// The heading and the note are approved word for word in creator-analytics#268 on 2026-10-19.
const fewViewsNote =
  "YouTube leaves out cities with few views, so the cities can add up to less than the channel's total."

/**
 * The cities the channel's engaged views came from, most engaged views first, then the note, and
 * with a format chosen the note that the cities count every format, as the API reads them for
 * every format. With no city, the heading and the empty state alone.
 */
export function Cities({ cities, format }: { cities: City[]; format: VideoFormatFilter }) {
  return (
    <TopBarsSection
      heading="Cities (engaged views)"
      bars={cityBarsOf(cities)}
      notes={format === 'all' ? [fewViewsNote] : [fewViewsNote, everyFormatText]}
    />
  )
}
