// creator-analytics#237 pre-PR review 1, finding 2. Not a test file on its own: it uses `upload`
// and `week`, local to apps/web/src/upload-markers.test.ts. Append it to the end of that file in a
// scratch worktree, then run from the repo root:
//   pnpm exec vitest run apps/web/src/upload-markers.test.ts -t 'repro:'
// Red at c87ee162: days 2, 3 and 4 of a 7-day window sit equally close, five sixths of a marker
// width apart at a span of 5, and float rounding makes the right pair's gap one ulp smaller, so
// days 3 and 4 join instead of the leftmost pair. Green once ties are compared exactly.
test('repro: of three equally spaced days in the middle of a week, the leftmost pair joins', () => {
  const markers = uploadMarkersOf(
    [upload('c', '2026-10-02'), upload('b', '2026-10-01'), upload('a', '2026-09-30')],
    week,
    { span: 5 },
  )

  expect(markers.map(({ kind, day }) => [kind, day])).toEqual([
    ['tile', '2026-09-30'],
    ['single', '2026-10-02'],
  ])
})
