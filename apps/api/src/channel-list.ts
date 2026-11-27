import type { Accounts } from '@creator-analytics/accounts'
import type { ListedChannel } from '@creator-analytics/api-types'
import type { Scoped } from '@creator-analytics/database'
import type { YouTubeGateway } from '@creator-analytics/youtube-gateway'

/**
 * The channels the user holds, each with its name on YouTube. A refused name read still lists the
 * channel, with no title and no handle, so the web app can name it by its YouTube channel id.
 */
export async function namedChannelsOf(
  accounts: Accounts,
  gateway: YouTubeGateway,
  tx: Scoped<'user'>,
): Promise<ListedChannel[]> {
  const named: ListedChannel[] = []
  for (const channel of await accounts.channelsOf(tx)) {
    const read = await gateway.read(tx, channel.id, 'channelSnippet', {})
    const snippet = read.ok ? read.value : null
    named.push({ ...channel, title: snippet?.title ?? null, handle: snippet?.handle ?? null })
  }
  return named
}
