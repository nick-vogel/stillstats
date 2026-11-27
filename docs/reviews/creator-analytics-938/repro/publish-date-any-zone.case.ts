// Pre-PR review 2, finding 1. Not a test file on its own: it uses the imports of
// apps/web/src/sponsor-report.test.ts, plus `onTestFinished` and `vi` from vitest. Paste it in place
// of the test 'the publish line names the Pacific day the windows count from, in any time zone' in
// describe("a sponsor report's figures, as the page writes them"), then run from the repo root:
//   TZ=UTC pnpm exec vitest run apps/web/src/sponsor-report.test.ts -t 'repro:'
//   TZ=Pacific/Honolulu pnpm exec vitest run apps/web/src/sponsor-report.test.ts -t 'repro:'
// Against the pre-fix sponsorPublishedOf (91d1cb92) both rows are red under either runner zone; at
// d8c50230 and later both are green. The committed test it replaces is green against the pre-fix
// code under TZ=Pacific/Honolulu and TZ=America/Los_Angeles.
test.each([
  // 23:30 on 3 March in Pacific time: 4 March for a reader east of it.
  ['Europe/London', '2024-03-04T07:30:00.000Z', 'Published March 3, 2024'],
  // 00:30 on 4 March in Pacific time: 3 March for a reader west of it.
  ['Pacific/Honolulu', '2024-03-04T08:30:00.000Z', 'Published March 4, 2024'],
])('repro: a reader in %s sees the Pacific publish day of %s', (zone, publishedAt, line) => {
  vi.stubEnv('TZ', zone)
  onTestFinished(() => {
    vi.unstubAllEnvs()
  })

  expect(sponsorPublishedOf({ publishedAt, scheduled: false }, 'en-US')).toBe(line)
})
