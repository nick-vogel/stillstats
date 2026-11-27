// Pre-PR review 3, finding 4 (from the Grok trial second opinion, ported). Not a test file on its
// own: it uses `started`, `tracked`, `at`, `list`, `changeStarted` and `screenShown` from
// `apps/web/src/screen-timing.test.ts`. Paste it inside `describe('the web vitals', ...)` in that
// file, then run from the repo root:
//   pnpm exec vitest run apps/web/src/screen-timing.test.ts -t 'repro:'
// Red at HEAD 8aff9d8d for both navigation cases (tracked() is []), green once a navigation from a
// budget route before any screen shows holds the floor for the screen the page loaded on.
test('repro: a click that navigates before the budget screen shows still sends the load LCP as a floor', () => {
  const browser = started()
  browser.entries('largest-contentful-paint', [{ startTime: 640, duration: 0 }])
  browser.at(1_800)
  browser.input()
  changeStarted(list, list)
  screenShown('/app/')

  expect(tracked()).toEqual([
    { name: 'web_vital', metric: 'LCP', value: 1_800, screen: '/app/', beforeScreen: true },
  ])
})

test('repro: a move from the load screen to another budget screen before either shows sends the floor for the screen the page loaded on', () => {
  const browser = started()
  browser.at(2_200)
  changeStarted(at('audience'), list)
  screenShown('/app/')

  expect(tracked()).toEqual([
    { name: 'web_vital', metric: 'LCP', value: 2_200, screen: '/app/audience', beforeScreen: true },
  ])
})
