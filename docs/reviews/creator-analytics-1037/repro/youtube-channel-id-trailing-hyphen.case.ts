// Pre-PR review 2, finding 2. Not a test file on its own: it uses `scrubEvent` and
// `scrubTransaction` from `packages/reporter/src/scrub.test.ts`. Paste it at the end of
// `packages/reporter/src/scrub.test.ts`, then run from the repo root:
//   pnpm exec vitest run packages/reporter/src/scrub.test.ts -t 'repro:'
// Red at HEAD 7aea7d5f: `UCabcdefghijklmnopqrstu-` passes through `scrubEvent` and
// `scrubTransaction` because `\b` does not match after a trailing `-`. Green after replacing
// the trailing `\b` in `secretPatterns` with `(?![\w-])`.
test('repro: masks a YouTube channel ID ending in a hyphen in errors and traces', () => {
  const ytDash = 'UCabcdefghijklmnopqrstu-'
  const scrubbedError = scrubEvent({
    type: undefined,
    message: `read failed for /channels/${ytDash}/videos`,
  })
  expect(scrubbedError.message).toBe('read failed for /channels/[youtube id]/videos')

  const scrubbedTrace = scrubTransaction({
    type: 'transaction',
    transaction: `GET /channels/${ytDash}`,
    spans: [
      {
        span_id: '1',
        trace_id: '2',
        start_timestamp: 1,
        timestamp: 2,
        description: `GET https://google.example.com/channels/${ytDash}`,
        data: {},
      },
    ],
  })
  expect(JSON.stringify(scrubbedTrace)).not.toContain(ytDash)
  expect(scrubbedTrace.spans?.[0]?.description).toBe(
    'GET https://google.example.com/channels/[youtube id]',
  )
})
