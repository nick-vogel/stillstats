import { channelNameOf, type ListedChannel } from '@creator-analytics/api-types'
import { pickerLabel } from './channel-picker.ts'
import { ListSelect } from './ListSelect.tsx'

/**
 * Picks which of the creator's channels the summary and the video list are for, in the header's
 * Menu panel (creator-analytics#891), its label beside it. Only the header renders it: the
 * sidebar's column has its own two-line picker, `SidebarChannelPicker` (creator-analytics#531).
 */
export function ChannelPicker({
  channels,
  selected,
  onPick,
}: {
  channels: ListedChannel[]
  selected: ListedChannel
  onPick: (channelId: string) => void
}) {
  return (
    <ListSelect
      label={pickerLabel}
      value={selected.id}
      options={channels.map((channel) => ({ value: channel.id, label: channelNameOf(channel) }))}
      onChange={onPick}
      inline
    />
  )
}
