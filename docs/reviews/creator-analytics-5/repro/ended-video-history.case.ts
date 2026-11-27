// creator-analytics#5 pre-PR review 1, finding 1. Not a test file on its own: it uses helpers
// local to apps/api/src/video-history.test.ts (connectedCreator, storeHistory, listOf, detailOf,
// reachOfRows, noonToday). Append it to the end of that file in a scratch worktree, then run from
// the repo root:
//   env -u TEST_DATABASE_ADMIN_URL pnpm exec vitest run apps/api/src/video-history.test.ts -t 'repro:'
// Red at 7b640f3b: an ended channel whose purge date is ahead reads its history on the summary,
// but its video list and video screen carry none, so the web app fills them with the sample.
// Green once both read the history while it is readable, as the summary does.
apiTest(
  "repro: an ended channel's video list and video screen carry its history until its purge date, as its summary does",
  async ({ web, worker, clock }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    await worker.forChannel(channelId, (tx) =>
      tx.sql.insert(subscriptions).values({
        channelId,
        stripeCustomerId: 'cus_video_history',
        stripeSubscriptionId: 'sub_video_history',
        status: 'canceled',
        purgeAfter: new Date('2026-11-06T01:00:00Z'),
        updatedAt: tx.now,
      }),
    )
    await storeHistory(worker, channelId)

    const list = await listOf(browser, channelId, { window: 'first7' })
    const detail = await detailOf(browser, channelId, 'v2', { window: 'first7' })

    expect(list.history).toEqual({ firstDay: '2026-09-10', newestDay: '2026-10-04' })
    expect(reachOfRows(list).v1?.impressions).toBe(200)
    expect(detail.history).toMatchObject({ firstDay: '2026-09-10', newestDay: '2026-10-04' })
  },
)
