// Limits: the revoke reaches the fake Google server, so these tests cannot prove that Google ends
// the real grant. Nick disconnecting his own channel on the deployed product, then finding the
// product gone from his Google account's third-party access page, covers it.
import type { EntitlementsAnswer } from '@creator-analytics/api-types'
import { channels, deletionLog, memberships, userSubscriptions } from '@creator-analytics/database'
import { subscribeOwner, test } from '@creator-analytics/database/testing'
import { entitlementOf } from '@creator-analytics/entitlements'
import { recordingReporter } from '@creator-analytics/reporter'
import { createRetention, deletionJobData } from '@creator-analytics/retention-engine'
import { eq } from 'drizzle-orm'
import { describe, expect } from 'vitest'
import type { Browser } from '../test/browser.ts'
import { channelsOf, connect, signIn, userIdOf } from '../test/flows.ts'
import { startApi } from '../test/start-api.ts'

const creator = { sub: '304729', email: 'disconnect@example.com', name: 'A Creator' }
const otherCreator = { sub: '404729', email: 'disconnect-other@example.com', name: 'Another' }

async function connectedChannel(browser: Browser): Promise<string> {
  await connect(browser)
  const [channel] = (await channelsOf(browser)).channels
  if (!channel) throw new Error('The connect flow connected no channel')
  return channel.id
}

function disconnect(browser: Browser, channelId: string): Promise<Response> {
  return browser.fetch(`/api/channels/${channelId}/disconnect`, { method: 'POST' })
}

describe('seam 1: disconnect a channel', () => {
  test('a creator disconnects a channel and it disappears from their list', async ({ web }) => {
    const api = await startApi(web)
    const browser = await signIn(api, creator)
    api.google.pickChannel('UC-disconnect')
    const channelId = await connectedChannel(browser)

    const response = await disconnect(browser, channelId)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ revokedAtGoogle: true })
    expect(await channelsOf(browser)).toEqual({ channels: [] })
  })

  // The vault's tests prove the report and the deletion request. This one proves what the API
  // answers the creator.
  test('a revoke Google refuses answers revokedAtGoogle false and the channel still leaves the list', async ({
    web,
  }) => {
    const api = await startApi(web)
    const browser = await signIn(api, creator)
    api.google.pickChannel('UC-disconnect')
    const channelId = await connectedChannel(browser)
    api.google.failRevocation(500)

    const response = await disconnect(browser, channelId)

    expect(await response.json()).toEqual({ revokedAtGoogle: false })
    expect(await channelsOf(browser)).toEqual({ channels: [] })
  })

  test("a disconnect of another user's channel is refused with not_connected and changes nothing", async ({
    web,
    findJobs,
  }) => {
    const api = await startApi(web)
    const holder = await signIn(api, otherCreator)
    api.google.pickChannel('UC-disconnect-held')
    const channelId = await connectedChannel(holder)
    const held = await channelsOf(holder)
    const browser = await signIn(api, creator)

    const response = await disconnect(browser, channelId)

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ refusal: 'not_connected' })
    expect(await channelsOf(holder)).toEqual(held)
    expect(api.google.revokedTokens).toEqual([])
    expect(await findJobs('deleteChannel')).toEqual([])
  })

  test("the disconnect's deletion job deletes the channel and logs it as an in-app revocation", async ({
    web,
    worker,
    findJobs,
  }) => {
    const api = await startApi(web)
    const browser = await signIn(api, creator)
    api.google.pickChannel('UC-disconnect')
    const channelId = await connectedChannel(browser)
    await disconnect(browser, channelId)
    const [deletion] = await findJobs('deleteChannel')
    if (!deletion) throw new Error('The disconnect enqueued no deletion')
    const retention = createRetention({ deletionLogKey: 'key', reporter: recordingReporter() })
    const data = deletionJobData('deleteChannel', deletion.data)

    await worker.forChannel(data.channelId, (tx) => retention.deleteChannel(tx, data))

    const remaining = await worker.forChannel(channelId, (tx) => tx.sql.select().from(channels))
    const logged = await worker.asSystem((tx) =>
      tx.sql.select({ reason: deletionLog.reason }).from(deletionLog),
    )
    expect(remaining).toEqual([])
    expect(logged).toEqual([{ reason: 'in_app_revocation' }])
  })

  test("a disconnect of a paid channel cancels nothing, keeps the owner's subscription running, and frees the channel's slot for another", async ({
    web,
    worker,
    findJobs,
  }) => {
    const api = await startApi(web)
    const browser = await signIn(api, creator)
    const channelIds: string[] = []
    // In connection order, the order a purchase fills the slots in.
    for (let n = 1; n <= 5; n++) {
      const before = new Set((await channelsOf(browser)).channels.map(({ id }) => id))
      api.google.pickChannel(`UC-disconnect-${n}`)
      await connect(browser)
      const added = (await channelsOf(browser)).channels.find(({ id }) => !before.has(id))
      if (added) channelIds.push(added.id)
    }
    // The test's one transaction gives every membership the connect writes the same now(), where
    // production gives each connect its own, so each channel gets its connection time here.
    for (const [n, channelId] of channelIds.entries()) {
      await worker.forChannel(channelId, (tx) =>
        tx.sql
          .update(memberships)
          .set({ createdAt: new Date(Date.UTC(2026, 10, 1, 12, n)) })
          .where(eq(memberships.channelId, channelId)),
      )
    }
    const [first = ''] = channelIds
    await subscribeOwner(web, worker, first)
    const userId = await userIdOf(web, creator.email)
    const proCount = () =>
      web.asUser(userId, async (tx) => {
        let count = 0
        for (const id of channelIds) if ((await entitlementOf(tx, id)).tier === 'paid') count++
        return count
      })
    const slotsInUse = async () =>
      ((await (await browser.fetch('/api/me/entitlements')).json()) as EntitlementsAnswer)
        .slotsInUse
    expect([await proCount(), await slotsInUse()]).toEqual([4, 4])

    await disconnect(browser, first)

    expect(await findJobs('cancelSubscription')).toEqual([])
    expect(await findJobs('cancelAccountSubscription')).toEqual([])
    expect(
      await web.asUser(userId, (tx) =>
        tx.sql.select({ status: userSubscriptions.status }).from(userSubscriptions),
      ),
    ).toEqual([{ status: 'active' }])
    expect([await proCount(), await slotsInUse()]).toEqual([3, 3])
  })
})
