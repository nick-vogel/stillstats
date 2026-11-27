// Pre-PR review 1, finding 1. Not a test file on its own: it uses the imports of
// apps/web/src/sponsor-report.test.ts. Paste it as the last test of describe("a sponsor report's
// figures, as the page writes them") in that file, then run from the repo root:
//   TZ=Europe/London pnpm exec vitest run apps/web/src/sponsor-report.test.ts -t 'repro:'
// At HEAD 91d1cb92 it is red: the publish line reads "Published March 4, 2024", the reader's day,
// while the windows and the "Data through" line count from the Pacific day, 3 March. After the fix
// it is green under any TZ, and the file's existing publish date test is green under
// TZ=Asia/Tokyo too.
test('repro: the publish line names the Pacific day the windows count from, in any time zone', () => {
  const report = {
    ...fakeSponsorReport,
    video: {
      ...fakeSponsorReport.video,
      publishedAt: '2024-03-04T07:30:00.000Z',
      scheduled: false,
    },
    lastProcessedDay: '2024-06-01',
  }

  expect(sponsorDataThroughOf(report, 'en-US')).toBe('Data through April 1, 2024')
  expect(sponsorPublishedOf(report.video, 'en-US')).toBe('Published March 3, 2024')
})
