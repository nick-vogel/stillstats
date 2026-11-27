import type { Freshness } from '@creator-analytics/api-types'
import type { ReadResult, Reads, YouTubeGateway } from '@creator-analytics/youtube-gateway'

/** A read of the one channel an answer is for, inside its transaction. */
export type ReadChannel = <K extends keyof Reads>(
  name: K,
  request: Reads[K]['request'],
) => Promise<ReadResult<Reads[K]['value']>>

/**
 * The gateway's read, keeping each answered read, and each not_monetized refusal, which is Google's
 * answer too, so an answer built from several reads can carry their freshness: when the oldest was
 * fetched, and whether every one came from the cache.
 */
export function freshnessTracker(gateway: YouTubeGateway): {
  read: YouTubeGateway['read']
  /** Only after at least one read answered. */
  freshness(): Freshness
} {
  const fetched: { fetchedAt: Date; fromCache: boolean }[] = []
  return {
    async read(...args) {
      const result = await gateway.read(...args)
      if (result.ok || result.refusal === 'not_monetized') fetched.push(result)
      return result
    },
    freshness() {
      const oldest = fetched.reduce((a, b) => (a.fetchedAt <= b.fetchedAt ? a : b))
      return {
        fetchedAt: oldest.fetchedAt.toISOString(),
        fromCache: fetched.every((result) => result.fromCache),
      }
    },
  }
}
