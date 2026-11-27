import { readCache, type WorkerDatabase } from '@creator-analytics/database'
import { seedChannel, test } from '@creator-analytics/database/testing'
import { describe, expect } from 'vitest'
import { sweepExpiredCache } from './youtube-gateway.ts'

const hourMs = 60 * 60 * 1000

function readKeys(worker: WorkerDatabase, channelId: string) {
  return worker.forChannel(channelId, (scope) =>
    scope.sql.select({ key: readCache.key }).from(readCache).orderBy(readCache.key),
  )
}

describe('seam 2: the cache sweep', () => {
  test('deletes every expired cache row and no other', async ({ web, worker, clock }) => {
    clock.set(new Date('2026-10-04T12:00:00.000Z'))
    // Each seeded channel holds one cache row that expires at the clock reading.
    const channelIds = [
      await seedChannel(web, worker, 'cache-sweep-user-a'),
      await seedChannel(web, worker, 'cache-sweep-user-b'),
    ]
    for (const channelId of channelIds) {
      await worker.forChannel(channelId, (scope) =>
        scope.sql.insert(readCache).values([
          {
            channelId,
            key: 'expired',
            payload: {},
            fetchedAt: new Date(scope.now.getTime() - 7 * hourMs),
            expiresAt: new Date(scope.now.getTime() - hourMs),
          },
          {
            channelId,
            key: 'fresh',
            payload: {},
            fetchedAt: scope.now,
            expiresAt: new Date(scope.now.getTime() + 6 * hourMs),
          },
        ]),
      )
      expect(await readKeys(worker, channelId)).toEqual([
        { key: 'expired' },
        { key: 'fixture' },
        { key: 'fresh' },
      ])
    }

    const swept = await worker.asSystem(sweepExpiredCache)

    expect(swept).toBe(4)
    for (const channelId of channelIds) {
      expect(await readKeys(worker, channelId)).toEqual([{ key: 'fresh' }])
    }
  })

  test('deletes a row the moment it expires, by the pinned clock', async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(new Date('2026-10-04T12:00:00.000Z'))
    const channelId = await seedChannel(web, worker, 'cache-sweep-user-a')
    clock.advance(-1)

    expect(await worker.asSystem(sweepExpiredCache)).toBe(0)
    expect(await readKeys(worker, channelId)).toEqual([{ key: 'fixture' }])

    clock.advance(1)

    expect(await worker.asSystem(sweepExpiredCache)).toBe(1)
    expect(await readKeys(worker, channelId)).toEqual([])
  })
})
