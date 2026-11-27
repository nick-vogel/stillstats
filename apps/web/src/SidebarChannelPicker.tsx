import { channelNameOf, type ListedChannel } from '@creator-analytics/api-types'
import type { Ref } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { channelLinesOf } from './channel-picker.ts'
import { channelIconLabelOf } from './sidebar.ts'

/** A channel's handle over its name, or its name alone (`channelLinesOf`). */
function ChannelLines({ channel }: { channel: ListedChannel }) {
  const { handle, name } = channelLinesOf(channel)
  return (
    <span className="picker-lines">
      {handle !== null && <span className="picker-handle">{handle}</span>}
      <span className="picker-name">{name}</span>
    </span>
  )
}

/**
 * The channel picker in the sidebar's column (creator-analytics#531): a button that shows the
 * channel on view on two lines and opens the list of channels, each on the same two lines, on Base
 * UI's Select. No label shows above it; its name is the collapsed icon's, "Channel: " and the
 * channel's name, and each option's typeahead text is that name. The list opens beside the
 * sidebar, its bottom at the button's, as the account menu does. Not modal, as the account menu
 * is not, so the page still scrolls. `ref` reaches the button, which the collapsed icon focuses.
 */
export function SidebarChannelPicker({
  channels,
  selected,
  onPick,
  ref,
}: {
  channels: ListedChannel[]
  selected: ListedChannel
  onPick: (channelId: string) => void
  ref?: Ref<HTMLButtonElement> | undefined
}) {
  return (
    <Select
      value={selected.id}
      modal={false}
      onValueChange={(channelId) => {
        if (typeof channelId === 'string' && channelId !== selected.id) onPick(channelId)
      }}
    >
      <SelectTrigger ref={ref} className="sidebar-picker" aria-label={channelIconLabelOf(selected)}>
        <ChannelLines channel={selected} />
      </SelectTrigger>
      <SelectContent side="right" align="end" sideOffset={8} alignItemWithTrigger={false}>
        {channels.map((channel) => (
          <SelectItem key={channel.id} value={channel.id} label={channelNameOf(channel)}>
            <ChannelLines channel={channel} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
