// Pre-PR review 1 of creator-analytics#4, finding 1. The extension's analytics surface links a
// lifetime period with the href pinned by apps/extension/src/surfaces/analytics.test.ts, "writes
// lifetime into the link ...". Before the fix that href was `?channel=channel-1` with no window,
// which this test read as `last28`. It reads the pinned href the way the web app's detail screen
// does, and states the correct behaviour.
import { expect, test } from 'vitest'
import { routeOf } from '../../../../apps/web/src/route.ts'

test("finding 1: the link from a lifetime analytics page opens the web app's detail screen on lifetime", () => {
  const href = 'https://stillstats.com/app/videos/NDha0z6zDA8?channel=channel-1&window=lifetime'
  const { pathname, search } = new URL(href)

  const route = routeOf(pathname.replace(/^\/app\//, ''), search)

  expect(route.video).toBe('NDha0z6zDA8')
  expect(route.window).toBe('lifetime')
})
