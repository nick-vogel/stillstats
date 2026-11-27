// creator-analytics#5 pre-PR review 2, finding 1. Not a test file on its own: it uses helpers
// local to packages/database/test/subscriptions.test.ts (test, freeChannel, record,
// readSubscriptions, created). Append it to the end of that file in a scratch worktree, then run
// from the repo root:
//   env -u TEST_DATABASE_ADMIN_URL pnpm exec vitest run packages/database/test/subscriptions.test.ts -t 'repro:'
// Red at db2e8416: a channel whose row holds subscription B, created and still incomplete, takes a
// live event of another subscription C created before B's, and answers 'unchanged', so the webhook
// neither records nor reports C, which Stripe charges. Green once that event answers
// 'other_subscription'.
test('repro: an older live event of another subscription on an incomplete row is reported', async ({
  web,
  worker,
}) => {
  const channelId = await freeChannel(web, worker, 'subscriptions-owner')
  const storedRow = () => web.asUser('subscriptions-owner', readSubscriptions).then(([row]) => row)
  const later = new Date('2026-11-17T12:05:00.000Z')
  await web.asAnonymous(
    record(channelId, { ...created, subscription: 'sub_test_b', eventCreated: later }),
  )
  const before = await storedRow()

  const earlier = { ...created, subscription: 'sub_test_c', status: 'active' }
  const outcome = await web.asAnonymous(record(channelId, earlier))

  expect(before).toMatchObject({ subscription: 'sub_test_b', status: 'incomplete' })
  expect(await storedRow()).toEqual(before)
  expect(outcome).toBe('other_subscription')
})
