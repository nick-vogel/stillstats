// Pre-PR review 4, finding 1. Not a test file on its own: it uses `started`, `at`, `list`,
// `changeStarted`, `screenShown` and `tracked` from `apps/web/src/screen-timing.test.ts`. Paste it
// inside `describe('the web vitals', ...)` in that file, then run from the repo root:
//   pnpm exec vitest run apps/web/src/screen-timing.test.ts -t 'repro:'
// Green at HEAD 217ac2d2. Red once `&& timing.lcp.loadedOn === undefined` is deleted from
// `changeStarted` (the floor goes out under `/app/` at 1,000), a mutant all 34 shipped cases miss.
test('repro: a second move before the budget screen shows keeps the first move time and the screen the page loaded on', () => {
  const browser = started()
  browser.at(1_000)
  changeStarted(at('audience'), list)
  browser.at(2_000)
  changeStarted(list, at('retention'))
  screenShown('/app/retention')

  expect(tracked()).toEqual([
    {
      name: 'web_vital',
      metric: 'LCP',
      value: 1_000,
      screen: '/app/audience',
      beforeScreen: true,
    },
  ])
})
