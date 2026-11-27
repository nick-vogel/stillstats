import type { FakeUpload, VideoNumbers } from '../channel-data.ts'

/**
 * The numbers a video holds for exactly this range. Failing that, its lifetime numbers when the
 * range covers its lifetime, and none otherwise.
 */
export function numbersOverRange(
  upload: FakeUpload,
  startDate: string,
  endDate: string,
  coversLifetime: boolean,
): VideoNumbers | undefined {
  return (
    upload.rangeMetrics?.find((range) => range.startDate === startDate && range.endDate === endDate)
      ?.metrics ?? (coversLifetime ? upload.metrics : undefined)
  )
}
