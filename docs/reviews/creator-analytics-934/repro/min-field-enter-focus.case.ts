// creator-analytics#934 pre-PR review 1, finding 1. Not a test file on its own: it uses
// `installFakeApi`, `render`, `settle`, `act` and `minimumFieldIn`, local to the describe "the
// history filters leaving the controls row with focus in one" in apps/web/src/app.test.ts.
// min-field-enter-focus.sh inserts it there in a scratch worktree and runs it. Red at a5a8a81c: the
// minimum field is keyed on the minimum in force, so the commit Enter makes mounts a new input in
// place of the focused one, and focus falls to the page. Green once focus stays in the field.
test('repro: on a Pro channel, a minimum committed with Enter keeps focus in the minimum field', async () => {
  const api = installFakeApi()
  api.entitlements = {
    paidTierOffered: true,
    channels: [{ channelId: fakeChannel.id, tier: 'paid', canSubscribe: false, canManage: true }],
  }
  api.listHistory = { firstDay: '2026-10-03', newestDay: '2026-10-04' }
  const { container } = await render()
  const minimum = minimumFieldIn(container)
  if (!minimum) throw new Error('No minimum impressions field')
  act(() => minimum.focus())

  await act(async () => {
    minimum.value = '500'
    minimum.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  })
  await settle()

  expect(window.location.search).toContain('minImpressions=500')
  expect(minimumFieldIn(container)).not.toBeNull()
  expect(document.activeElement).toBe(minimumFieldIn(container))
})
