import type { ExtensionSurface, ListedChannel } from '@creator-analytics/api-types'
import { signedInReadKeptMs } from '../kept.ts'
import type { ChannelsRead, UploadsRead } from '../product-api.ts'
import type { SurfaceOptions } from './page-watcher.ts'
import {
  type PillLayout,
  type PillSeparator,
  removeSurface,
  renderEngagedViewsPill,
} from './render.ts'
import { type PillView, pillViewOf } from './states.ts'

/**
 * One read a navigation holds: its outcome, and when it settled holding no answer. `at` stays
 * undefined while the read is out and once it answers, so neither is ever asked again.
 */
interface HeldRead<T> {
  outcome: Promise<T>
  at?: number
}

/** Each of a channel's uploads' pills, by video id. An upload awaiting processing has none. */
type Pills = ReadonlyMap<string, PillView>

/**
 * Pills and whether every uploads read they were drawn from came from the cache: the API's, or the
 * background's 30-second keep. A read that held no answer draws no pill and does not count.
 * `answered` is true when at least one uploads read answered.
 */
export interface PillsRead {
  pills: Pills
  fromCache: boolean
  answered: boolean
}

/** What one navigation has read: the held channels, and each held channel's uploads' pills. */
interface NavigationReads {
  navigation: number
  channels: HeldRead<ListedChannel[]> | undefined
  uploads: Map<string, HeldRead<PillsRead>>
}

/** Whether a read stands: it is out, it answered, or it held no answer less than the keep time ago. */
const stands = <T>(held: HeldRead<T> | undefined): held is HeldRead<T> =>
  held !== undefined && (held.at === undefined || Date.now() - held.at < signedInReadKeptMs)

/** No pills, from a read that held no answer, which counts toward no cache result. */
export const noPills: PillsRead = { pills: new Map(), fromCache: true, answered: false }

/**
 * A public page's reads from the background, one for every surface of the tab, so the surfaces of
 * one navigation read once together. A tile, a watch page's `v` or a Short is the creator's exactly
 * when it is among a held channel's uploads, which the background reads through the video list:
 * the page matches its ids against them here, and no id from the page is ever sent (ADR 0016,
 * creator-analytics#520). Whose a video is depends on no channel link, URL or draw order.
 *
 * Within one navigation the held channels are asked once, and each held channel's uploads once,
 * while the read stands. A read that holds no answer (signed out, failed, refused, channel not in
 * Stillstats, access withheld) stands only `signedInReadKeptMs` from when it settled, as a Studio
 * line does, and the first ask after that asks it again: a public page shows no line to try again
 * through. A read that is out is never asked twice. A new navigation asks afresh; an `ahead` pass
 * carries the next navigation's count, so what it reads stands for that navigation.
 */
export function publicPageReads(options: Pick<SurfaceOptions, 'ask' | 'locale'>) {
  let reads: NavigationReads = { navigation: Number.NaN, channels: undefined, uploads: new Map() }

  const readsOf = (navigation: number): NavigationReads => {
    if (reads.navigation !== navigation)
      reads = { navigation, channels: undefined, uploads: new Map() }
    return reads
  }

  /** The pills of one held channel's uploads, none for a read that holds no answer. */
  function uploadsPillsOf(youtubeChannelId: string): HeldRead<PillsRead> {
    const uploads: HeldRead<PillsRead> = {
      outcome: Promise.resolve()
        .then(() => options.ask({ type: 'read-uploads', youtubeChannelId }))
        .then((read: UploadsRead) => (read.state === 'read' ? read : undefined))
        .catch(() => undefined)
        .then((read) => {
          if (!read) {
            uploads.at = Date.now()
            return noPills
          }
          const pills = new Map<string, PillView>()
          for (const video of read.videos) {
            const pill = pillViewOf({
              video,
              lastProcessedDay: read.lastProcessedDay,
              locale: options.locale,
            })
            if (pill) pills.set(video.id, pill)
          }
          return { pills, fromCache: read.fromCache, answered: true }
        }),
    }
    return uploads
  }

  const heldChannels = (navigation: number): Promise<ListedChannel[]> => {
    const held = readsOf(navigation)
    if (stands(held.channels)) return held.channels.outcome
    const channels: HeldRead<ListedChannel[]> = {
      outcome: Promise.resolve()
        .then(() => options.ask({ type: 'read-channels' }))
        .then((read: ChannelsRead) => (read.state === 'signed-in' ? read.channels : undefined))
        .catch(() => undefined)
        .then((listed) => {
          if (listed) return listed
          channels.at = Date.now()
          return []
        }),
    }
    held.channels = channels
    return channels.outcome
  }

  return {
    /**
     * The creator's held channels: none when signed out, or when the read fails or the ask throws,
     * and then asked again once `signedInReadKeptMs` has passed.
     */
    heldChannels,

    /**
     * The pill of every upload of every held channel, by video id: what a surface gives a video on
     * the page whose id is among them. Empty when signed out or no channel is held, with no uploads
     * read asked; a channel whose read holds no answer adds nothing, and the others' pills stand.
     * A surface asks it only once the page holds an id to match. `fromCache` is true when every
     * held channel's uploads read that answered came from the cache.
     */
    async pillsOn(navigation: number): Promise<PillsRead> {
      const channels = await heldChannels(navigation)
      const { uploads } = readsOf(navigation)
      const outcomes = channels.map(({ youtubeChannelId }) => {
        let held = uploads.get(youtubeChannelId)
        if (!stands(held)) {
          held = uploadsPillsOf(youtubeChannelId)
          uploads.set(youtubeChannelId, held)
        }
        return held.outcome
      })
      const pills = new Map<string, PillView>()
      let fromCache = true
      let answered = false
      for (const channel of await Promise.all(outcomes)) {
        for (const [videoId, pill] of channel.pills) pills.set(videoId, pill)
        fromCache &&= channel.fromCache
        answered ||= channel.answered
      }
      return { pills, fromCache, answered }
    },
  }
}

/** The one reads holder a tab's public page surfaces share. */
export type PublicPageReads = ReturnType<typeof publicPageReads>

/**
 * Places a public page surface's pills, each directly after the element it stands beside: YouTube's
 * view count in a tile, in the watch page's sidebar the view count's metadata row, or in the Shorts
 * player, which shows no view count, the channel bar. Each pill opens with the `separator` its line
 * takes, drawn inside the pill so the pill stays that element's next sibling, and its host sits as
 * its `layout` says. A pill already there for the same video, figure, separator and layout is kept,
 * so YouTube's redraws and the watch's passes do not flicker it.
 */
export function pillPlacer(surface: ExtensionSurface) {
  const shown = new WeakMap<Element, string>()
  const drawnFor = new WeakMap<Element, string>()

  return {
    /**
     * Shows `view` after `after`, the element in `tile` it stands beside, opening with `separator`
     * and laid out as `layout`, or takes the tile's pill down when `view` is undefined.
     */
    place({
      document,
      tile,
      after,
      videoId,
      view,
      separator,
      layout = 'inline',
    }: {
      document: Document
      tile: Element
      after: Element
      videoId: string
      view: PillView | undefined
      separator: PillSeparator
      layout?: PillLayout | undefined
    }): void {
      if (!view) {
        removeSurface(tile, surface)
        return
      }
      const key = `${videoId} ${view.figure} ${view.name} ${separator} ${layout}`
      const next = after.nextElementSibling
      if (next && shown.get(next) === key) return
      // A pill elsewhere in the tile is one YouTube moved or redrew, or one for the tile's last video.
      removeSurface(tile, surface)
      const host = renderEngagedViewsPill({ document, surface, view, separator, layout })
      shown.set(host, key)
      drawnFor.set(host, videoId)
      after.after(host)
    },

    takeDownRepointed(tiles: Iterable<Element>, idIn: (tile: Element) => string | undefined): void {
      for (const tile of tiles)
        for (const host of tile.querySelectorAll(`[data-stillstats-surface="${surface}"]`))
          if (drawnFor.get(host) !== idIn(tile)) host.remove()
    },
  }
}
