/**
 * The screens show every chart stacked when the viewport is at least this wide and this tall,
 * and below it one chart, which the cards choose. `MetricCharts` reads it through matchMedia, and
 * app.css writes it again for the charts placeholder's stacked-only places, which web.test.ts holds
 * equal to it. Its own module, so that test can import it without the browser's types.
 */
export const stackedChartsQuery = '(min-width: 60rem) and (min-height: 45rem)'
