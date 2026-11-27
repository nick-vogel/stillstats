// creator-analytics#5 pre-PR review 1, finding 3. Not a test file on its own: it uses helpers
// local to apps/api/src/subscription-changes.test.ts (test, paidChannel, deliver, now,
// subscriptionCheckoutEvent). Append it to the end of that file in a scratch worktree, then run
// from the repo root:
//   env -u TEST_DATABASE_ADMIN_URL pnpm exec vitest run apps/api/src/subscription-changes.test.ts -t 'repro:'
// Red at 7b640f3b: the owner of a paid channel completes a second paid Checkout (a second tab, or
// a click before the first one's webhook landed), Stripe charges for both, and Stillstats records
// and reports nothing of the second. Green once the second one reaches GlitchTip, with its Checkout
// Session's or its subscription's ID only.
test('repro: a second paid Checkout for a channel already paid reports its subscription to GlitchTip', async ({
  web,
  clock,
}) => {
  clock.set(now)
  const { api, channelId } = await paidChannel(web)

  await deliver(
    api,
    subscriptionCheckoutEvent({
      channelId,
      id: 'cs_test_second',
      subscription: 'sub_test_second',
      created: now,
    }),
  )

  expect(api.reporter.reports.map(({ context }) => context)).toEqual([
    { stripeObject: expect.stringMatching(/^(cs|sub)_test_second$/) },
  ])
})
