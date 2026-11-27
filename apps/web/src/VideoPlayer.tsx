import type { ThumbnailSize, VideoFormat } from '@creator-analytics/api-types'
import { type RefObject, useEffect, useRef, useState } from 'react'
import type { MovePlayer } from './AudienceRetention.tsx'
import { track } from './analytics.ts'
import { followPlayer, type PlayheadFollower, type PlayheadStore } from './playhead.ts'
import { Thumbnail } from './Thumbnail.tsx'
import { playerThumbnailSizes } from './thumbnail.ts'
import { watchOnYouTubeText, youtubeWatchUrlOf } from './video-detail.ts'
import { playerFrameTitleOf, playerMoveText } from './video-player.ts'
import { createVideoPlayer, type VideoPlayer as Player } from './youtube-player.ts'

/** The video the player shows. */
export interface PlayerVideo {
  id: string
  title: string
  thumbnailUrl: string | null
  thumbnails: readonly ThumbnailSize[]
  /** A Short's box is 9:16, every other video's 16:9 (`app.css`). */
  format: VideoFormat | null
  /** Google's `embeddable`, or null while a step heads the screen from a list row. */
  embeddable: boolean | null
  /**
   * Google's `madeForKids`, or null while a step heads the screen from a list row. Only a video
   * known not to be made for kids sends player events (Developer Policies III.E.4.j).
   */
  madeForKids: boolean | null
}

/**
 * What the retention plots move the video player by, for the video on the screen: a pick seeks the
 * player, which before it is ready holds the seek until it is (`youtube-player.ts`), and sends
 * `video_player_seeked` unless `sendsEvents` is false. It holds the last player error with the
 * video it came from, which a step to another video leaves behind. In memory only.
 */
export function useVideoPlayerMoves(videoId: string, sendsEvents: boolean) {
  const player = useRef<Player | null>(null)
  const [error, setError] = useState<{ videoId: string; code: number } | null>(null)
  const playerError = error?.videoId === videoId ? error.code : null
  const move: MovePlayer = (seconds, plot, input) => {
    player.current?.seekTo(seconds)
    if (sendsEvents) track({ name: 'video_player_seeked', plot, input })
    return playerMoveText.movedTo(seconds)
  }
  const fail = (failedVideoId: string, code: number) => setError({ videoId: failedVideoId, code })
  return { player, move, playerError, fail }
}

/**
 * The video player, which the screen loads as it opens (ADR 0020): YouTube's player, cued at 0:00
 * and not playing, with the thumbnail drawn over its frame in the same box until the player is
 * ready. A new video cues at 0:00 in the same player, and the player goes with the box. The player
 * drives the playhead on the retention plots (`playhead.ts`): a cue of another video hides it until
 * that video plays, and the destroy hides it. The box is one element throughout, so a step between
 * a Short and a video reshapes it with no remount of the frame, and once the player is ready the
 * frame is its only child: nothing is drawn over it. Each ready sends `video_player_loaded` for a
 * video known not to be made for kids. A video that cannot play (`cannotPlayLineOf`) shows the
 * thumbnail with its line and the Watch on YouTube link, and no player: a player error destroys the
 * player, and a step to a video that plays creates a new one.
 */
export function VideoPlayer({
  video,
  playhead,
  player,
  cannotPlay,
  onError,
}: {
  video: PlayerVideo
  /** Where the player writes the time the playhead shows. */
  playhead: PlayheadStore
  /** Where the created player is kept for the retention plots to move (`useVideoPlayerMoves`). */
  player: RefObject<Player | null>
  /** The line in place of the player for a video that cannot play, or null for one that can. */
  cannotPlay: string | null
  /** A player error, with the video the player showed. */
  onError: (videoId: string, code: number) => void
}) {
  const frame = useRef<HTMLDivElement>(null)
  const follower = useRef<PlayheadFollower | null>(null)
  const latest = useRef({ video, onError })
  const cued = useRef<string | null>(null)
  const [ready, setReady] = useState(false)
  const [live, setLive] = useState(false)
  useEffect(() => {
    latest.current = { video, onError }
  })
  const showsFrame = cannotPlay === null && (video.embeddable !== null || live)

  useEffect(() => {
    const element = frame.current
    if (!showsFrame || !element) return
    const { id, title } = latest.current.video
    // The player reports no state before it is created, so the follower reads a created player.
    const following = followPlayer(() => created.currentTime(), playhead)
    const created = createVideoPlayer(element, {
      videoId: id,
      startSeconds: 0,
      frameTitle: playerFrameTitleOf(title),
      events: {
        onReady: () => {
          setReady(true)
          if (latest.current.video.madeForKids === false) track({ name: 'video_player_loaded' })
        },
        onStateChange: following.onStateChange,
        onError: (code) => latest.current.onError(cued.current ?? id, code),
      },
    })
    player.current = created
    follower.current = following
    cued.current = id
    setLive(true)
    return () => {
      following.stop()
      created.destroy()
      player.current = null
      follower.current = null
      setReady(false)
      setLive(false)
    }
  }, [showsFrame, playhead, player])

  useEffect(() => {
    if (!player.current || cued.current === video.id) return
    cued.current = video.id
    follower.current?.reset()
    player.current.cue(video.id, 0, playerFrameTitleOf(video.title))
  }, [video.id, video.title, player])

  return (
    <div className={video.format === 'short' ? 'video-player video-player-short' : 'video-player'}>
      {showsFrame && <div ref={frame} className="video-player-frame" />}
      {!(showsFrame && ready) && (
        <Thumbnail
          url={video.thumbnailUrl}
          thumbnails={video.thumbnails}
          sizes={playerThumbnailSizes}
          durationSeconds={null}
          className="video-player-thumbnail"
        />
      )}
      {cannotPlay !== null && (
        <div className="video-player-cannot-play">
          <p>{cannotPlay}</p>
          <a href={youtubeWatchUrlOf(video.id)}>{watchOnYouTubeText}</a>
        </div>
      )}
    </div>
  )
}
