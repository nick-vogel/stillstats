// `P[nD][T[nH][nM][nS]]`, the shapes the Data API's videos resource page documents for
// `contentDetails.duration` (checked 2026-10-08): `PT#M#S`, `PT#H#M#S` and, at a day or more,
// `P#DT#H#M#S`.
const isoDuration = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/

/**
 * A video's length in whole seconds, from the Data API's ISO 8601 `contentDetails.duration`. Null
 * when Google gives none, gives one this cannot read, or gives zero: the videos page documents no
 * value for a live or upcoming video, and a zero-second video has no length to show.
 */
export function durationSecondsOf(iso: string | null | undefined): number | null {
  const match = iso ? isoDuration.exec(iso) : null
  if (!match) return null
  const [, days, hours, minutes, seconds] = match
  // A bare `P` or `PT` matches the pattern with no number in it, and is no duration.
  if ([days, hours, minutes, seconds].every((part) => part === undefined)) return null
  const total =
    ((Number(days ?? 0) * 24 + Number(hours ?? 0)) * 60 + Number(minutes ?? 0)) * 60 +
    Number(seconds ?? 0)
  return total > 0 ? total : null
}
