import type { VideoWindow } from '@creator-analytics/api-types'
import { customRangeText } from './custom-range.ts'
import type { Option } from './ListSelect.tsx'

// The window names are approved word for word in creator-analytics#53, those of `first1`, `first90`
// and `first365` in creator-analytics#68, and that of `custom` in creator-analytics#118. Change them
// only with Nick.
export const windowOptions: Option<VideoWindow>[] = [
  { value: 'lifetime', label: 'Lifetime' },
  { value: 'last7', label: 'Last 7 days' },
  { value: 'last28', label: 'Last 28 days' },
  { value: 'last90', label: 'Last 90 days' },
  { value: 'last365', label: 'Last 365 days' },
  { value: 'custom', label: customRangeText.option },
  { value: 'first1', label: 'Publish day' },
  { value: 'first7', label: 'First 7 days after publish' },
  { value: 'first28', label: 'First 28 days after publish' },
  { value: 'first90', label: 'First 90 days after publish' },
  { value: 'first365', label: 'First 365 days after publish' },
]
