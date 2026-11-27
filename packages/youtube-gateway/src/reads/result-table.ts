import type { youtubeAnalytics_v2 } from '@googleapis/youtubeanalytics'

/** The answer's rows, each as its cells by column name, since Google sets the column order. */
export function recordsOf({
  columnHeaders,
  rows,
}: youtubeAnalytics_v2.Schema$QueryResponse): Record<string, unknown>[] {
  const columns = (columnHeaders ?? []).map(({ name }) => name ?? '')
  return (rows ?? []).map((row) => Object.fromEntries(columns.map((column, i) => [column, row[i]])))
}

/** The named metrics of a row as numbers, a zero where the row or the metric is missing. */
export function metricsOf<M extends string>(
  record: Record<string, unknown> | undefined,
  names: readonly M[],
): Record<M, number> {
  return Object.fromEntries(names.map((name) => [name, Number(record?.[name] ?? 0)])) as Record<
    M,
    number
  >
}
