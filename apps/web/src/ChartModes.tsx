import { type ChartMode, chartModes } from '@creator-analytics/api-types'
import { track } from './analytics.ts'
import { metricChartsText } from './metric-charts.ts'
import { chartModeOf, usePreferences } from './preferences.ts'
import { type Navigate, type Route, routeWithChartMode } from './route.ts'
import { chartModeChangedEvent } from './views-chart.ts'

/**
 * The charts' mode, daily or running total: the address's, then the saved preference, then daily
 * (`chartModeOf`), and a change of it, which saves the preference, writes the address and sends
 * `views_chart_mode_changed`, together. Every chart that obeys "Show numbers as" shares it.
 */
export function useChartMode(route: Route, navigate: Navigate) {
  const { saved, save } = usePreferences()
  const mode = chartModeOf(route, saved)

  function changeMode(next: ChartMode) {
    if (next === mode) return
    save({ chartMode: next })
    navigate(routeWithChartMode(route, next))
    track(chartModeChangedEvent(next))
  }

  return { mode, changeMode }
}

/** The "Show numbers as" toggle: one button per mode, the mode in force pressed. */
export function ChartModes({
  mode,
  onChange,
}: {
  mode: ChartMode
  onChange: (mode: ChartMode) => void
}) {
  return (
    <fieldset className="metric-charts-modes" aria-label={metricChartsText.modesLabel}>
      {chartModes.map((each) => (
        <button
          key={each}
          type="button"
          className="button button-quiet"
          aria-pressed={mode === each}
          onClick={() => onChange(each)}
        >
          {metricChartsText.modes[each]}
        </button>
      ))}
    </fieldset>
  )
}
