// Pre-PR review 2, finding 1. Not a test file on its own: these two cases use helpers local to
// apps/web/src/app.test.ts (installFakeApi, render, laidOut, linkNamed, listTable, click, settle,
// listRoute). Paste both as the last tests of describe("the pager's landing on the video list") in
// that file, then run from the repo root:
//   pnpm exec vitest run apps/web/src/app.test.ts -t 'repro:'
// At 3944fd5 the first case is red (focus is on document.body) and the second is green. After the
// fix both are green, and the second goes red if the fix drops the clear on a list answer.
test('repro: a refused re-read of the first page after Next then Previous keeps focus in the list', async () => {
  const api = installFakeApi()
  api.pageCount = 5
  const { container } = await render('?page=1')
  laidOut(container)
  const page2 = api.hold(listRoute)
  api.failNext(listRoute)

  await click(linkNamed(container, 'Next page'))
  await click(linkNamed(container, 'Previous page'))
  await settle()

  const alert = container.querySelector('.video-list [role="alert"]')
  expect(alert).not.toBeNull()
  expect(document.activeElement).toBe(alert)
  page2.release()
})

test('repro: after Next page answers, a refused read a sort heading starts takes no focus', async () => {
  const api = installFakeApi()
  api.pageCount = 5
  const { container } = await render('?page=1')
  laidOut(container)
  await click(linkNamed(container, 'Next page'))
  api.failNext(listRoute)
  const heading = listTable(container).querySelector<HTMLButtonElement>('button.sortable-heading')
  if (!heading) throw new Error('No sortable heading in the list')
  heading.focus()

  await click(heading)

  const alert = container.querySelector('.video-list [role="alert"]')
  expect(alert).not.toBeNull()
  expect(document.activeElement).not.toBe(alert)
})
