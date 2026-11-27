import { track } from './analytics.ts'
import { revenueSourcesOf, usePreferences } from './preferences.ts'
import { revenueSourcesText, revenueSourcesToggledEvent, type SourcesTable } from './tables.ts'

/**
 * The button that shows or hides the revenue source columns of the numbers table and the video
 * list, one saved choice for both. Each click sends `revenue_sources_toggled` with the table it
 * sits above. `onHide` runs when it hides them.
 */
export function RevenueSourcesButton({
  table,
  onHide,
}: {
  table: SourcesTable
  onHide?: () => void
}) {
  const { saved, save } = usePreferences()
  const shown = revenueSourcesOf(saved)
  return (
    <button
      className="button button-quiet revenue-sources-button"
      type="button"
      aria-expanded={shown}
      onClick={() => {
        save({ revenueSources: !shown })
        track(revenueSourcesToggledEvent(table, !shown))
        if (shown) onHide?.()
      }}
    >
      {shown ? revenueSourcesText.hide : revenueSourcesText.show}
    </button>
  )
}
