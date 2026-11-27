// creator-analytics#237 pre-PR review 3, finding 2. Not a test file on its own: it uses
// `markedApi`, `render`, `markersIn`, `click`, `hover` and `cardRows`, local to the describe
// "the channel summary's upload markers" in apps/web/src/app.test.ts. second-card.sh inserts it
// there in a scratch worktree and runs it. Red at 95de9319: a click opens the tile's card under the
// axis, the mouse then rests on the same day's tile in the row under the first plot, and a second
// card opens beside the first, so 4 rows show. Green once one tile card shows at a time.
test('repro: a hover on another tile while a card is open shows one card, not two', async () => {
  markedApi()
  const { container } = await render()
  const tile = markersIn(container).find((marker) => marker.tagName === 'BUTTON')
  const upper = [
    ...container.querySelectorAll<HTMLElement>('.upload-markers-mirror .upload-marker'),
  ].find((marker) => marker.tagName === 'BUTTON')
  if (!tile || !upper) throw new Error('No tile in both rows')

  await click(tile)
  expect(cardRows()).toHaveLength(2)
  await hover(upper)
  expect(cardRows()).toHaveLength(2)
})
