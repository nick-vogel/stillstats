// Pre-PR review 2 of creator-analytics#64, findings 1 and 2. The finding 1 test states the correct
// behaviour: it is green now that the finding is fixed (creator-analytics#145). It passes
// `routeTheScreenReads` in by hand, so it pins the helper; App's wiring of it is pinned in
// `apps/web/src/app.test.ts`.
// The finding 2 test shows the consequence the App wiring reaches: it is green, and its fix is in
// App, which `apps/web/src/app.test.ts` renders.
import { describe, expect, test } from 'vitest'
import {
  failedSaveOn,
  listColumnsOf,
  preferencesAfterFailedSave,
} from '../../../../apps/web/src/preferences.ts'
import {
  addressOf,
  listRouteOf,
  revertAddressAfterFailedSave,
} from '../../../../apps/web/src/route.ts'
import { listRouteFor, routeAfterLostSwitches } from '../../../../apps/web/src/video-list.ts'

describe('finding 1: a failed save of a switched-on column keeps its notice', () => {
  test('the notice is still on view once the list settles its sort', () => {
    const onView = listRouteOf('?sort=-estimatedMinutesWatched')
    const lost = { watchTimeColumn: true }
    const noticeAddress = revertAddressAfterFailedSave(
      onView,
      lost,
      () => {},
      (route) => routeAfterLostSwitches(route, lost),
    )
    const saved = preferencesAfterFailedSave({ watchTimeColumn: true }, lost, {})
    const settled = listRouteFor(onView, listColumnsOf(saved, true), false)
    expect(failedSaveOn({ id: 1, address: noticeAddress, lost }, addressOf(settled))).not.toBeNull()
  })
})

describe('finding 2: a change before the first preferences read lands', () => {
  test('with the default switches, an address sort by watch hours is replaced by newest first', () => {
    const route = listRouteFor(
      listRouteOf('?sort=-estimatedMinutesWatched'),
      listColumnsOf({ pageSize: 25 }, true),
      false,
    )
    expect(addressOf(route)).toBe('')
  })
})
