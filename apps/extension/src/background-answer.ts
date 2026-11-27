import type { ExtensionEvent } from '@creator-analytics/api-types'
import type { HeldInstallEvent } from './held-install.ts'
import type { BackgroundAnswer, BackgroundRequest, Settled } from './messages.ts'
import type { ChannelsRead, ProductApi, UploadsRead, VideosRead } from './product-api.ts'
import { youtubeOrigins } from './youtube-access.ts'

/** The part of the browser's `MessageSender` the answer reads: the asking page's URL. */
export interface RequestSender {
  url?: string | undefined
}

const youtubeTabOrigins = youtubeOrigins.map((pattern) => new URL(pattern).origin)

/** Whether `sender` is a www.youtube.com tab. A URL that does not parse is not one. */
function fromYouTubeTab(sender: RequestSender): boolean {
  if (sender.url === undefined) return false
  try {
    return youtubeTabOrigins.includes(new URL(sender.url).origin)
  } catch {
    return false
  }
}

export function backgroundAnswerer({
  productApi,
  hostAccess,
  youtubeAccess,
  settle,
  installEvent,
}: {
  productApi: Pick<ProductApi, 'readChannels' | 'readVideos' | 'readUploads'>
  /**
   * `hostAccessOf(...).granted`, the popup's check. Without host access to stillstats.com the
   * browser sends the read without the session cookie, so the API would answer it signed out.
   */
  hostAccess: () => Promise<boolean>
  /**
   * `youtubeAccessOf(...).granted`. A www.youtube.com tab's script keeps running after YouTube
   * access is removed until the tab hears the background's removal message, so its requests are
   * answered only while the grant holds. A public page reads its held channels' uploads and sends
   * no video id at all, so a www.youtube.com tab's `read-videos` is answered failed whatever the
   * grant (creator-analytics#520).
   */
  youtubeAccess: () => Promise<boolean>
  settle: (event: ExtensionEvent) => Promise<Settled>
  installEvent: Pick<HeldInstallEvent, 'sendOn'>
}): (
  request: BackgroundRequest,
  // Required, so a caller that drops the sender fails the typecheck instead of answering a
  // www.youtube.com tab as the popup.
  sender: RequestSender,
) => Promise<BackgroundAnswer[BackgroundRequest['type']]> {
  /**
   * Every read, the popup's and the surfaces', may send a held `extension_installed`. The answer
   * does not wait for that send, which can take up to `apiAnswerWithinMs`.
   */
  function answered<Read extends ChannelsRead | VideosRead | UploadsRead>(read: Read): Read {
    void Promise.resolve()
      .then(() => installEvent.sendOn(read))
      .catch(() => {})
    return read
  }

  // A usage event that failed is not settled, and an access ask that failed is not a grant.
  const failed = (request: BackgroundRequest) =>
    request.type === 'usage-event' || request.type === 'youtube-access'
      ? false
      : ({ state: 'failed' } as const)

  return async (request, sender) => {
    try {
      // Studio and the popup are answered whatever the grant.
      if (fromYouTubeTab(sender) && !(await youtubeAccess())) return failed(request)
      switch (request.type) {
        case 'read-channels':
          return answered(await productApi.readChannels())
        case 'read-videos':
          if (fromYouTubeTab(sender)) return failed(request)
          if (!(await hostAccess())) return answered({ state: 'host-access-withheld' })
          return answered(await productApi.readVideos(request))
        case 'read-uploads':
          if (!(await hostAccess())) return answered({ state: 'host-access-withheld' })
          return answered(await productApi.readUploads(request.youtubeChannelId))
        case 'usage-event':
          return await settle(request.event)
        case 'youtube-access':
          return await youtubeAccess()
      }
    } catch {
      return failed(request)
    }
  }
}
