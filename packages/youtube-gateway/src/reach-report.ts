/**
 * One video's impressions on one day from one traffic source type, the only fields of a reach
 * report the product keeps. `ctr` is clicks over impressions, capped at 1.
 */
export interface ReachRow {
  videoId: string
  /** YYYY-MM-DD, YouTube's reporting day in Pacific Time. */
  day: string
  /** The report's numeric traffic source code, such as 5 for YouTube search. */
  trafficSourceType: number
  impressions: number
  ctr: number
}

const neededColumns = [
  'date',
  'video_id',
  'traffic_source_type',
  'video_thumbnail_impressions',
  'video_thumbnail_impressions_ctr',
] as const

type Column = (typeof neededColumns)[number]

/** The records of a CSV file, RFC 4180: a quoted field may hold commas, newlines and `""`. */
function recordsOf(csv: string): string[][] {
  const records: string[][] = []
  let record: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i]
    if (quoted) {
      if (char === '"' && csv[i + 1] === '"') {
        field += '"'
        i++
      } else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === ',') {
      record.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && csv[i + 1] === '\n') i++
      record.push(field)
      records.push(record)
      record = []
      field = ''
    } else field += char
  }
  if (field !== '' || record.length > 0) {
    record.push(field)
    records.push(record)
  }
  return records.filter((fields) => fields.some((value) => value !== ''))
}

// The docs name no text form for `date`; the Reporting API's other reports write YYYYMMDD. A real
// file on the production walk (#791) confirms it.
function dayOf(value: string, column: string): string {
  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(value)
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  throw new Error(`A reach report row has no day in ${column}`)
}

function numberOf(value: string, column: string): number {
  const number = Number(value)
  if (value === '' || !Number.isFinite(number)) {
    throw new Error(`A reach report row has no number in ${column}`)
  }
  return number
}

/**
 * The rows of a `channel_reach_combined_a1` file, one per video, day and traffic source type:
 * impressions summed over the traffic source details, devices and operating systems, and CTR their
 * mean weighted by impressions, 0 for a group with none. Each column is found by the header row,
 * as Google asks, since a report's columns may change order and gain new ones. A file holding only
 * its header is a day with no data. A file missing a needed column, or with a row whose impressions
 * or CTR are below 0, throws.
 *
 * A row's CTR may be above 1 (#1040). Google counts an impression only for a thumbnail shown for
 * more than a second and at least half visible (YouTube Help, "Impressions and click-through rate
 * FAQs", read 2026-11-23), so a row can hold clicks from thumbnails it counted no impression for.
 * Its clicks still count in its group, and the group's CTR is capped at 1, the most the history
 * stores.
 */
export function reachRowsOf(csv: string): ReachRow[] {
  const [header, ...records] = recordsOf(csv)
  if (!header) return []
  const indexOf = Object.fromEntries(
    neededColumns.map((column) => {
      const index = header.indexOf(column)
      if (index === -1) throw new Error(`A reach report file has no ${column} column`)
      return [column, index]
    }),
  ) as Record<Column, number>

  // The logger masks every number in a message, so each refusal names its rule and column in words
  // and carries no row value.
  const groups = new Map<string, { row: ReachRow; clicks: number }>()
  for (const record of records) {
    const value = (column: Column) => record[indexOf[column]] ?? ''
    const numberIn = (column: Column) => numberOf(value(column), column)
    const notBelowZeroIn = (column: Column, what: string) => {
      const number = numberIn(column)
      if (number < 0) throw new Error(`A reach report row has ${what} below zero in ${column}`)
      return number
    }
    const videoId = value('video_id')
    const day = dayOf(value('date'), 'date')
    const trafficSourceType = numberIn('traffic_source_type')
    const impressions = notBelowZeroIn('video_thumbnail_impressions', 'impressions')
    const ctr = notBelowZeroIn('video_thumbnail_impressions_ctr', 'a CTR')
    const key = JSON.stringify([videoId, day, trafficSourceType])
    const group = groups.get(key) ?? {
      row: { videoId, day, trafficSourceType, impressions: 0, ctr: 0 },
      clicks: 0,
    }
    group.row.impressions += impressions
    group.clicks += impressions * ctr
    groups.set(key, group)
  }
  return [...groups.values()].map(({ row, clicks }) => ({
    ...row,
    ctr: row.impressions === 0 ? 0 : Math.min(clicks / row.impressions, 1),
  }))
}
