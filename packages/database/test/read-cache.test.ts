import { randomUUID } from 'node:crypto'
import { describe, expect } from 'vitest'
import { channels, readCache } from '../src/schema.ts'
import { test } from './harness.ts'

const dayMs = 24 * 60 * 60 * 1000

describe('the read cache', () => {
  test('rejects a row whose expiry is more than 24 hours after its fetch time', async ({
    worker,
  }) => {
    const channelId = randomUUID()
    const fetchedAt = new Date('2026-10-04T12:00:00.000Z')

    // A refused insert aborts its scope's savepoint, so the refusal is read outside the scope.
    const cacheFor = (lifetimeMs: number) =>
      worker
        .forChannel(channelId, (scope) =>
          scope.sql
            .insert(readCache)
            .values({
              channelId,
              key: `lifetime-${lifetimeMs}`,
              payload: {},
              fetchedAt,
              expiresAt: new Date(fetchedAt.getTime() + lifetimeMs),
            })
            .returning({ key: readCache.key }),
        )
        .catch((error: { cause?: { constraint?: string } }) => error.cause?.constraint)
    await worker.forChannel(channelId, (scope) =>
      scope.sql.insert(channels).values({ id: channelId, youtubeChannelId: `UC${channelId}` }),
    )

    expect(await cacheFor(dayMs)).toEqual([{ key: `lifetime-${dayMs}` }])
    expect(await cacheFor(dayMs + 1)).toBe('read_cache_expiry_within_24_hours')
  })
})
