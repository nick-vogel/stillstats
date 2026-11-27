// creator-analytics#569 pre-PR review 1, finding 1. Not a test file on its own: it uses helpers
// local to apps/web/src/app.test.ts (installFakeApi, render, adminMessages, adminMessagesIn,
// openOnlyBoxIn, doneBoxIn, articleAt, buttonNamed, click, olderText). Append it to the end of that
// file in a scratch worktree, then run from the repo root:
//   pnpm exec vitest run apps/web/src/app.test.ts -t 'repro:'
// Red at 62f34c77: with the open filter ticked, five messages marked "Done" on page 1 shift the
// open set, and "Older" then skips the five open messages that moved onto page 1. Green once every
// open message shows on some page the admin can reach by paging.
test('repro: with the open filter ticked, marking messages "Done" on page 1 skips no open message on "Older"', async () => {
  const api = installFakeApi()
  const [first] = adminMessages()
  if (!first) throw new Error('No message')
  api.adminFeedback = Array.from({ length: 60 }, (_, place) => ({
    ...first,
    id: `00000000-0000-4000-8000-${String(place).padStart(12, '0')}`,
    text: `Message ${place + 1}`,
    doneAt: null,
  }))
  const { container } = await render('admin/feedback')
  await click(openOnlyBoxIn(container))
  for (const place of [0, 1, 2, 3, 4]) await click(doneBoxIn(articleAt(container, place)))
  const textsOf = () =>
    [...container.querySelectorAll('.admin-feedback-text dd')].map((each) => each.textContent)
  const pageOne = textsOf()

  await click(buttonNamed(container, olderText))

  const seen = new Set([...pageOne, ...textsOf()])
  const missed = Array.from({ length: 60 }, (_, place) => `Message ${place + 1}`).filter(
    (text) => !seen.has(text),
  )
  expect(adminMessagesIn(container).length).toBeGreaterThan(0)
  expect(missed).toEqual([])
})
