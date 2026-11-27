// creator-analytics#5 pre-PR review 1, finding 2. Not a test file on its own: it uses helpers
// local to packages/database/test/subscriptions.test.ts (test, freeChannel, record,
// readSubscriptions, completed, created, ended). Append it to the end of that file in a scratch
// worktree, then run from the repo root:
//   env -u TEST_DATABASE_ADMIN_URL pnpm exec vitest run packages/database/test/subscriptions.test.ts -t 'repro:'
// Red at 7b640f3b: an ended channel whose second subscription was canceled takes a late 'active'
// event of its first, older subscription, and becomes paid again with no purge date. Green once
// another subscription replaces a stored one only with an event no older than the newest the row
// holds, whatever the stored status.
test("repro: a late event of an old subscription never re-points an ended channel's canceled one", async ({
  web,
  worker,
}) => {
  const channelId = await freeChannel(web, worker, 'subscriptions-owner')
  const storedRow = () => web.asUser('subscriptions-owner', readSubscriptions).then(([row]) => row)
  await web.asAnonymous(record(channelId, completed))
  await web.asAnonymous(record(channelId, created))
  await web.asAnonymous(record(channelId, ended))
  const again = new Date('2026-11-20T12:00:00.000Z')
  const second = { ...created, subscription: 'sub_test_b', status: 'active', eventCreated: again }
  await web.asAnonymous(record(channelId, second))
  const secondEnd = new Date('2027-01-19T12:00:00.000Z')
  const endedAgain = new Date('2026-12-20T12:00:00.000Z')
  await web.asAnonymous(
    record(channelId, {
      ...second,
      status: 'canceled',
      purgeAfter: secondEnd,
      eventCreated: endedAgain,
    }),
  )
  const before = await storedRow()

  const late = { ...created, status: 'active' }
  const outcome = await web.asAnonymous(record(channelId, late))

  expect(before).toMatchObject({ subscription: 'sub_test_b', status: 'canceled' })
  expect(outcome).toBe('unchanged')
  expect(await storedRow()).toEqual(before)
})
