// Pre-PR review 2, finding 1, as amended 2026-11-24 (Nick's decision: a marked floor). Not a test
// file on its own: it uses `started`, `tracked`, and `screenShown` from
// `apps/web/src/screen-timing.test.ts`. Paste it inside `describe('the web vitals', ...)` in
// `apps/web/src/screen-timing.test.ts`, then run from the repo root:
//   pnpm exec vitest run apps/web/src/screen-timing.test.ts -t 'repro:'
// Red at HEAD 7aea7d5f (tracked() is []), green once an input or hide before the budget screen
// shows sends its own time as the LCP, with `beforeScreen: true`.
test('repro: an input before the budget screen shows sends its time as the LCP floor, marked', () => {
  const browser = started()
  browser.entries('largest-contentful-paint', [{ startTime: 640, duration: 0 }])
  browser.at(1_800)
  browser.input()
  browser.at(2_600)
  browser.entries('largest-contentful-paint', [{ startTime: 2_500, duration: 0 }])
  screenShown('/app/')

  expect(tracked()).toEqual([
    { name: 'web_vital', metric: 'LCP', value: 1_800, screen: '/app/', beforeScreen: true },
  ])
})

test('repro: a hide before the budget screen shows sends its time as the LCP floor, marked', () => {
  const browser = started()
  browser.entries('largest-contentful-paint', [{ startTime: 640, duration: 0 }])
  browser.at(1_200)
  browser.hide()
  browser.at(9_000)
  browser.show()
  screenShown('/app/audience')

  expect(tracked()).toEqual([
    { name: 'web_vital', metric: 'LCP', value: 1_200, screen: '/app/audience', beforeScreen: true },
  ])
})
