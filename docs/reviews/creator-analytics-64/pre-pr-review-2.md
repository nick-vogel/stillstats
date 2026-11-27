# Pre-PR review: creator-analytics#64 Web dashboard: key metrics together, a profile screen and saved preferences

**Branch:** `creator-analytics-64-web-dashboard-metrics-profile` vs `origin/main` (merge-base `6f9caa1` "Add weekly Dependabot version updates for npm and GitHub Actions")
**Reviewed at:** HEAD `a704a70` ("creator-analytics#64 pre-PR review 1 remediation closure table"), clean tree, no uncommitted or untracked files at review time. Whole branch: 191 files, +23,646 / −1,763.
**Delta under review:** since `60c0bff` ("creator-analytics#64 Write the partial label of a one-day window in the singular"), the HEAD that `pre-pr-review-1.md` reviewed. 30 files, +764 / −104, of which 440 lines are review 1's doc and repro. The code delta is round 1's remediation, commits `f89e7db` to `99b456f`.
**Reviewed against:** `pre-pr-review-1.md` (its findings, briefs, closure table and Approach decisions), `CODING_STANDARDS.md` 1 to 3, and the epic's rule that an address value wins over a saved preference, which wins over the default. Delta-scoped, no `--fresh`.
**Date:** 2026-10-11
**Reviewer:** 2 code-review agents, 1 test-oracle agent, and a verify pass

## What was verified and how

| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | green, lockfile unchanged |
| Lint | `pnpm lint` | green (323 files) |
| Typecheck | `pnpm typecheck` | green, every package |
| Build | `pnpm build` | green |
| Full suite | `pnpm test` (Testcontainers Postgres) | green: 70 files, 1,351 tests |
| Round 1 repro | `pnpm exec vitest run --config docs/reviews/creator-analytics-64/repro/web-display.vitest.config.ts` | 4 of 4 green (findings 1 and 2 of round 1 stay fixed) |
| Delta tests against `60c0bff` (oracle) | The delta's 9 web test files and 2 API test files copied into a scratch worktree at `60c0bff` and run there (API on Testcontainers) | 20 web tests red, the rest green; every green changed test is a negative guard, a mechanical signature or fixture edit, or a round 1 finding 8 strengthening of code that was already right. See Test quality |
| Failed save of a switched-on column (Finding 1) | Executed: `pnpm exec vitest run --config docs/reviews/creator-analytics-64/repro/round-2-state.vitest.config.ts -t "finding 1"` | red. The React effect chain that clears the notice was traced by reading `App.tsx`; App has no render seam |
| Change before the first read (Finding 2) | Executed: same config, `-t "finding 2"` (shows the consequence, green by design); App's wait gating traced by reading | the address sort is replaced once any control changes before the read lands |
| Format path of the no-revenue rule (Finding 3) | Read: `channel-summary.test.ts:157,193,230` against the mutation in the brief | the format path's stripping is unpinned |
| Every consumer of the stripped revenue (round 1 F1) | Read by agent: `metric-charts.ts:101,141`, `numbers-table.ts:152`, `NumbersTable.tsx`, `MetricCharts.tsx:144,294`, `ChannelSummaryFigures.tsx:46`, `VideoDetail.tsx:72` | hold |
| `docs/oauth-verification.md` rows 6 to 12 (round 1 F7) | Read against `AccountMenu.tsx:83`, `account-menu.ts:3`, `profile.ts:8,44`, `Profile.tsx:109-123`, `controls-bar.ts:8`, `windows.ts:13`, `metric-charts.ts:18-20`, `token-vault.ts:604-608` | hold |
| Em-dashes in shipped copy | `git diff 60c0bff -- apps packages docs/oauth-verification.md \| grep -c '^+.*—'` | 0 |
| A real browser, App wiring | Not run: no browser in a review, and App has no DOM test seam (CODING_STANDARDS 2) | Findings 1 and 2's App halves are proved by reading |

**Overall:** Round 1's remediation holds. Every one of its nine findings meets its intent, all four CI checks pass, and no CRITICAL, HIGH or MEDIUM finding was confirmed. The new findings are small. Two of them sit where round 1's Finding 2 fix, the list resetting a sort whose column is off, meets other screen state. First, a failed save of a switched-on column loses its notice. Second, a change made before the preferences read lands lets the list reset an address sort with the default switches. The other two are test and comment upkeep. The branch can open its PR; all four are LOW and can be fixed now or as follow-ups.

## Prior-review closure

Against `pre-pr-review-1.md`, nine findings:

- **Fully fixed: 9.**
  - F1 (MEDIUM): fixed for the summary, the detail screen and the Since publish table. The video list half was out of the brief's scope and is a stage 2 proposal.
  - F2 (MEDIUM): fixed against its intent. The list never stays sorted by a switched-off column. Its fix exposes Findings 1 and 2 below, both in App's preference state rather than in `listRouteFor`.
  - F3 to F9 (LOW): fixed. F4 has no test, because App has no render seam, as the closure table says. F5 has a test gap on `searchOf` (Finding 3).
- **Partially fixed: 0. Untouched: 0.**
- **Resolved by a comment or doc edit only:** F7 and F9, by design (both are doc findings).

## Approach decisions

Carried forward from round 1 (`pre-pr-review-1.md`, "Approach decisions" and "Approach decisions (remediation round 1)"); none is overturned here.

- **No revenue reported (round 1 F1):** `revenueReportedIn` in `apps/web/src/cards.ts` is the one predicate. Each view builder applies it once over the span its revenue card reads, and the consumers follow through `daysCarryRevenue`.
- **Sort on a hidden column (round 1 F2):** `listRouteFor(route, switches, sourcesShown)`.
- **First read vs local change (round 1 F3):** `preferencesAfterRead(read, local)`.
- **Page size in the address (round 1 F5):** like the visibility; any valid size stays in the route.

Added by this review:

- **A failed save that switches a column back off (F1):** the failed save's address revert also applies the sort reset the list would make, by running the reverted route through `listRouteFor` with only the lost switches off. It happens in place of the address on view, so the notice is raised on the address the list settles on. Precedent: `hideSourcesOn` (`apps/web/src/video-list.ts:429-440`), which replaces the address with the reset the list would make anyway.
- **The channel screen's wait for the preferences (F2):** the wait ends when the first read lands or fails, tracked on its own, never when `saved` first becomes non-null. Precedent: `channelsFailed`, which App tracks beside `channels` for the same reason.

## Confirmed Issues

### 1. A failed save of a column switched on loses its notice at once when the list is sorted by that column — LOW

- **Location:** `apps/web/src/App.tsx:243-254` (the save's failure handler), `apps/web/src/route.ts:277-285` (`revertAddressAfterFailedSave`), `apps/web/src/VideoList.tsx:286,314` (`listRouteFor` and the replace effect), `apps/web/src/App.tsx:202` (the effect that drops a notice once the address changes)
- **Attribution:** Introduced by round 1's remediation, `966a665` ("finding 2: Sort the list newest first when its sort's column is switched off"), for the Watch hours and Revenue columns. At `60c0bff`, `listRouteFor(route, true, sources)` kept a watch hours or revenue sort on a consented channel, so the address did not change and the notice stayed (`git show 60c0bff:apps/web/src/video-list.ts`, lines 445-452). The sources variant, a failed save of `revenueSources: true` while the list is sorted by a source, has the same shape and predates `60c0bff` (introduced on this branch by #119).
- **Real-world trigger:** The creator switches Watch hours on, clicks its heading to sort by it while the save is still on its way, and the save fails. The switch goes back off, which is right. The list then resets the sort to newest first and replaces the address, and the "Your change did not save. Try again." notice, raised on the sorted address, is dropped on the next render. The column vanishes and the order changes with no explanation. A failed save is rare (a server error or a dropped connection), so this stays LOW.

**Evidence**
```ts
// apps/web/src/App.tsx:251, in the save's failure handler
address: revertAddressAfterFailedSave(routeOnView.current, lost, navigate),
// apps/web/src/route.ts:282, column switches are not route keys, so nothing reverts
const reverted = routeAfterFailedSave(onView, change)
// apps/web/src/VideoList.tsx:314
if (route !== addressRoute) navigate(route, { replace: true })
// apps/web/src/App.tsx:202
useEffect(() => setFailedSave((failed) => failedSaveOn(failed, address)), [address])
```

**Failure mode:** Executed. `docs/reviews/creator-analytics-64/repro/round-2-state.test.ts`, "finding 1", takes the list on `?sort=-estimatedMinutesWatched` and a lost `{ watchTimeColumn: true }`. The notice address `revertAddressAfterFailedSave` answers is `?sort=-estimatedMinutesWatched`, the address the list settles on is `''`, and `failedSaveOn` gives `null` (red). The render order (failure handler, then VideoList's replace effect, then App's address effect) was traced by reading.

**Recommended fix:**
```diff
// apps/web/src/video-list.ts, beside listRouteFor
+export function routeAfterLostSwitches(route: Route, lost: Preferences): Route {
+  if (route.video || route.profile) return route
+  return listRouteFor(
+    route,
+    { views: true, watchTime: lost.watchTimeColumn !== true, revenue: lost.revenueColumn !== true },
+    lost.revenueSources !== true,
+  )
+}
// apps/web/src/route.ts
 export function revertAddressAfterFailedSave(
   onView: Route,
   change: Preferences,
   navigate: Navigate,
+  settle: (route: Route) => Route,
 ): string {
-  const reverted = routeAfterFailedSave(onView, change)
+  const reverted = settle(routeAfterFailedSave(onView, change))
   if (reverted !== onView) navigate(reverted, { replace: true })
   return addressOf(reverted)
 }
// apps/web/src/App.tsx:251
-              address: revertAddressAfterFailedSave(routeOnView.current, lost, navigate),
+              address: revertAddressAfterFailedSave(routeOnView.current, lost, navigate, (route) =>
+                routeAfterLostSwitches(route, lost),
+              ),
```
`route.ts` cannot import `video-list.ts` (it imports `route.ts`), which is why the list's rule is passed in. Update `revertAddressAfterFailedSave`'s doc comment to say the address is also settled to what the list would read.

**Remediation brief**
- **Design intent:** A failed save reverts the screen to what the server holds, in `saved` and in the address, and raises its notice on the address it leaves on view. The notice lasts until that address changes (`failedSaveOn`) or a later save of the lost keys succeeds (`failedSaveAfterSuccessOf`). The list then reads the address through `listRouteFor`, which replaces any sort the screen cannot show. The revert must therefore leave on view the address the list will settle on, or the list's own replace drops the notice it was meant to carry.
- **Full surface:** `apps/web/src/video-list.ts:442-452` (add the helper beside `listRouteFor`); `apps/web/src/route.ts:272-285` (the parameter and its doc); `apps/web/src/App.tsx:251` (the one caller; `git grep revertAddressAfterFailedSave` shows no other production caller); the two tests that call it, `apps/web/src/preferences.test.ts:288` ("replaces the address on view with the reverted one...") and `:302` ("leaves the address alone when the failed change is not in it..."), which pass `(route) => route` or the real helper.
- **Must preserve:** A lost change carried by the address still reverts it (`routeAfterFailedSave`, the two tests above). A lost change neither the address nor the list's sort carries navigates nowhere and answers the address on view, because `listRouteFor` returns the same object when nothing applies (`video-list.test.ts:1036,1048`, `toBe`). A lost `watchTimeColumn: false` or `revenueColumn: false` (a failed switch-off, reverting to on) resets nothing. On a video or the profile, nothing is reset: the list is not mounted, so the address would not be rewritten and a reset would mismatch the notice. The notice's place (`failedSaveNoticePlaceOf`) and the round 1 F4 clearing on reset and sign-out are unchanged.
- **Do not touch:** `listRouteFor` itself and its tests (round 1 F2, fixed). `toggleColumn`'s push (Minor, Back after a switch-off).
- **Proof:** `pnpm exec vitest run --config docs/reviews/creator-analytics-64/repro/round-2-state.vitest.config.ts -t "finding 1"` is red now. Its call has no `settle`, so after the fix the remediator writes the red-first unit test in `apps/web/src/video-list.test.ts`: `routeAfterLostSwitches(listRouteOf('?sort=-estimatedMinutesWatched&page=2'), { watchTimeColumn: true })` gives `sort: '-publishedAt', page: 1`. Add one case for `{ revenueSources: true }` with a source sort, one for a video route that stays the same object, and one for `{ watchTimeColumn: false }` that stays the same object. The App wiring is a browser check: block `PUT /api/me/preferences` in devtools, switch Watch hours on, sort by it, and the notice stays.
- **Escalation:** this is the seventh fix to the failed-save notice on this branch (#119 pass 2 F26, F30 and F31, pass 3 F2 and F3, round 1 F4, and this one), every one patched in place without an App render seam. Fix this one in place because it is small. Also file a split ticket: a render seam for App's preference state, with a test matrix over save, fail, retry, reset, sign-out and route change. A later finding in this area goes there, not into another in-place patch.

### 2. A preference changed before the first preferences read lands ends the channel screen's wait, and the list resets an address sort by the default switches — LOW

- **Location:** `apps/web/src/App.tsx:185,188` (`channelOnView`, `channelWaiting`), `:236` (`save`'s `setSaved`), `apps/web/src/VideoList.tsx:273-276,286`
- **Attribution:** Pre-existing, exposed and widened. Ending the wait as soon as `saved` is non-null predates `60c0bff`: `save` already set `saved` before the read. Round 1's `966a665` widened what the early end costs. A watch hours or revenue sort in the address is now reset by default switches that the read would have turned on, and the reset is permanent, because the list replaces the address. Round 1's F3 fix (`6e63651`) keeps the change once the read lands, but the address has already been rewritten. Against `$BASE`, introduced: the preferences are new on this branch.
- **Real-world trigger:** A creator whose saved Watch hours switch is on opens a bookmark or a shared address sorted by watch hours, `?sort=-estimatedMinutesWatched`. On a slow connection, they change the page size before `GET /api/me/preferences` answers. The list shows newest first and the address loses the sort. The controls render and work from the first paint (`screenShown` includes `channelWaiting`), so the change is possible. It needs a slow read and an early change, hence LOW.

**Evidence**
```ts
// apps/web/src/App.tsx:185-188
const channelOnView = saved && selected
const channelWaiting = !channelsFailed && (channels === null || saved === null)
// apps/web/src/App.tsx:236, in save
setSaved((current) => ({ ...current, ...change }))
```
The VideoList prop doc (`VideoList.tsx:273-276`) promises the opposite: "Null while the channels or the preferences are read, so a sort in the address stays until the revenue consent and the column switches are known." So does App's comment at `:183-184`: "A channel screen waits for the preferences too, so its chart never draws the default mode and then jumps to the saved one."

**Failure mode:** Executed for the list's half. `round-2-state.test.ts`, "finding 2", shows `listRouteFor(listRouteOf('?sort=-estimatedMinutesWatched'), listColumnsOf({ pageSize: 25 }, true), false)` gives the address `''`. That is correct for the switches it is given; the defect is that App hands the list a channel before the switches are known. Proved by reading App.

**Recommended fix:**
```diff
// apps/web/src/App.tsx
   const [saved, setSaved] = useState<Preferences | null>(null)
+  const [preferencesRead, setPreferencesRead] = useState(false)
@@
-  const channelOnView = saved && selected
+  const channelOnView = preferencesRead ? selected : null
@@
-  const channelWaiting = !channelsFailed && (channels === null || saved === null)
+  const channelWaiting = !channelsFailed && (channels === null || !preferencesRead)
@@ readPreferences().then(
       (read) => {
         confirmed.current = preferencesAfterRead(read, confirmed.current)
         setSaved((current) => preferencesAfterRead(read, current))
+        setPreferencesRead(true)
       },
       (reason: unknown) => {
         showError(reason)
         setSaved((current) => current ?? {})
+        setPreferencesRead(true)
       },
```
Keep `channelOnView`'s type as it is now: if `selected` can be `undefined`, write `preferencesRead ? (selected ?? null) : null` to match its current consumers.

**Remediation brief**
- **Design intent:** `saved` is the screen's view of the preferences, and it changes the moment a control does. Whether the server's preferences are known is a separate fact. The channel screen waits for that fact, so the list's sort reset (`listRouteFor`) and the charts' saved mode run on the real switches, never on the defaults.
- **Full surface:** `apps/web/src/App.tsx:159` (state), `:185`, `:188`, `:217-225` (both read callbacks). `screenShown` and `shownChannelId` (`:189-190`) follow with no edit. The comments at `App.tsx:183-187` and `VideoList.tsx:273-276` become true and stay.
- **Must preserve:** A failed preferences read still ends the wait with the defaults. A change before the read still shows at once on the controls (`saved`), and its save still goes out. `preferencesAfterRead` keeps that change once the read lands (`preferences.test.ts:185,192`). `channel === null` still passes the address route through `VideoList` unchanged (`VideoList.tsx:286`). "Reset preferences" and the failed-save revert keep using `saved`.
- **Do not touch:** `preferencesAfterRead` and the `confirmed` merge (round 1 F3, verified correct: `confirmed` only takes values the server acknowledged).
- **Proof:** App has no render seam (CODING_STANDARDS 2), so the proof is a browser check. Throttle the network in devtools to Slow 3G, sign in as a creator with the Watch hours switch saved on, open `/app?sort=-estimatedMinutesWatched`, and change the page size before the preferences request finishes. The address keeps the sort and the list is ordered by watch hours. Today it shows newest first.

### 3. The format path of the no-revenue rule and a page size of 10 in the address are untested, and four list tests name a rule their function no longer owns — LOW

- **Location / shape:**
  - `apps/web/src/channel-summary.test.ts:193`: the only test for one format of a channel with no revenue in any format asserts the card only. The stripping tests at `:157` use `format: 'all'`. This mutation passes the whole suite and brings back round 1 F1's "$0.00" chart and table for a non-partner channel filtered to Videos or Shorts: `const answered = !('refusal' in revenue) && (body.format !== 'all' || revenueReportedIn(revenueDays))`.
  - `apps/web/src/route.test.ts:197-199` "carries the page size": asserts 25 only. Round 1 F5's browser-visible half is that a chosen 10 survives a reload, so `searchOf` must write `?pageSize=10`. A default-skip in `searchOf` (`if (route.pageSize && route.pageSize !== 10)`) passes every test.
  - `apps/web/src/video-detail.test.ts:140` "shows when the revenue answered" and `:163` "with revenue, adds the three revenue numbers and their currency": their fixtures gained `days: earningDays` to meet the new rule, and the names still state round 1's rule.
  - `apps/web/src/video-list.test.ts:1012,1024,1048`: named "without revenue consent", but `listRouteFor` no longer sees consent, only `switches.revenue`. The consent-to-switch rule is `listColumnsOf`'s, pinned in `apps/web/src/preferences.test.ts`. `:1012` and `:1063` ("with the Revenue column off, a revenue sort...") state one rule with the same input (`withoutConsent` is `{ ...allOn, revenue: false }`).
- **Attribution:** Introduced by round 1's remediation (`f89e7db`, `814c59f`, `966a665`).
- **Recommended fix:**
  - At `channel-summary.test.ts:193`, or in a new test named for the rule, assert that the view has `currencyNote: null` and `noFormatNote: null`, that each `daily` day has no `estimatedRevenue` key, and that `total` has no `currency`.
  - In `route.test.ts` "carries the page size", add `expect(searchOf({ ...defaultRoute, pageSize: 10 })).toBe('?pageSize=10')`, and rename the test "carries the page size, the default, 10, included".
  - Rename `video-detail.test.ts:140` to "shows when the revenue answered and a day of the video earned some", and `:163` to "with revenue a day of the video earned, adds the three revenue numbers and their currency".
  - Rename `video-list.test.ts:1012,1024,1048` to "with the Revenue column off, as on a channel without revenue consent, ...". Then delete `:1063`, or fold its `?sort=estimatedRevenue&page=2` into `:1012`'s rows.
- **Proof:** each new assertion goes red under the mutation named for it (revert the mutation afterwards). The renames need no proof.

### 4. Comment hygiene — LOW (aggregated)

- `apps/web/src/channel-summary.ts:88-89`: "revenue and its currency included when it answered" → "revenue and its currency included when it answered and YouTube reports some over the span the revenue card reads". Also rename the local `answered` (`:112`) to `revenueShown`, matching `revenueShownOf` in `video-detail.ts`, because it now means answered and reported.
- `apps/web/src/since-publish.ts:61`: "Estimated revenue shows only when some row carries it." → "Estimated revenue shows only when YouTube reports revenue for some stage." Per the API contract (`packages/api-types/src/video-detail.ts:77`), every row carries the key whenever there is a currency.

## Needs Further Investigation

None new. Round 1's NFI A (every 403 on a monetary read becomes a cached `not_monetized`) and NFI B (the flaky `video_not_found` test) are outside this delta and stand as recorded there.

## Reviewed and Dismissed

- `preferencesAfterRead` merging into `confirmed` lets an unacknowledged change reach the failed-save revert: no. `confirmed.current` only takes values from the save's success callback (`App.tsx:240`), so a pending change is not in it; a later failure reverts to the read's value.
- `setFailedSave(null)` in `resetPreferences` can be overtaken by a stale failure: no. It runs after `await writePreferences(clearPreferences)`, and the queue settles every earlier save, including its callbacks, first.
- The address now carries `pageSize=10` after unrelated control changes: no. `routeWithControl` keeps a size only when the route had one, `routeWithoutPreferences` drops it on reset (`routeKeysOfPreferences`), and `routeAfterFailedSave` drops a failed 10.
- The one-day hover point at 0.5 disagrees with another x consumer: no. `metricChartsOf` reuses the views points, `ChartHover` places the line and card from the same x, `nearestIndexOf` over one point picks it, and `pathOf` still draws the line from 0 to 100.
- The Since publish table showing a revenue column under a detail card that says "YouTube reports no revenue": by design. The table reads the video's whole life by stage, and the card reads the window (round 1 F1 brief).
- `sincePublishTableOf` applies the predicate to every row, including hidden partial stages: Lifetime is always shown and covers every partial stage's days, so the two can differ only if later adjustments cancel a stage's revenue out over the lifetime. Theoretical.
- The four-day floor's "published on the floor day" side is unpinned in the two API tests: the floor itself is pinned in `apps/api/src/channel-summary.test.ts:222-285`, and the strengthened tests now separate four days from three, which is what round 1 F8 asked.

## Minor / nits

- `toggleColumn` (`apps/web/src/VideoList.tsx:349`) pushes the reset route. Since round 1 F2, Back from it lands on the sorted entry, which the list at once replaces with the same newest-first view, so one Back press shows no change. Replacing instead does not reliably help, since the entry before the heading click is usually the same view. The prior brief kept this push on purpose.
- "Reset preferences" while the first read is still in flight can be overwritten by that read, through `preferencesAfterRead(read, {})`. This is pre-existing, and round 1's closure notes already record it.
- `signOut` ignores an HTTP error status and leaves a network rejection unhandled (`App.tsx:321-324`). Pre-existing; round 1 Minor. The corrected `AccountMenu.tsx:91-92` comment now describes it accurately.
- `withoutRevenue` (`apps/web/src/cards.ts:65-72`) writes the three revenue keys out by hand, a third copy beside `revenueColumns` (`numbers-table.ts:23`) and `sourcesOf` (`channel-summary.ts:73`). Its `Omit<Day, keyof RevenueAmounts>` return type would not flag a fourth revenue field left in the rest object.
- "Carries" in several new test names means "earned some", whereas `daysCarryRevenue` uses it to mean "has the key" (`channel-summary.test.ts:157,230`, `since-publish.test.ts:75`, `video-detail.test.ts:150,176,184,190`).
- `docs/oauth-verification.md` row 9: "the 'Estimated revenue' chart joins them once revenue consent is given" holds only for a video that earned revenue in the chosen range. The recording uses a monetised channel, so this is narration accuracy only.

## Test quality

The delta's tests were run against `60c0bff`. Web: 20 red and 484 green across 9 files. API: the 3 changed tests are green, as expected, because `apps/api` has no source change in the delta.

- **Green changed tests, all accounted for:**
  - `components.test.ts:97`, `preferences.test.ts:288` and `:302`, and the three API tests are round 1 F8 strengthenings of code that was already right. Each can now go red: the API pair fails under a three-day floor, and `:968` fails when `sincePublish` is missing.
  - `channel-summary.test.ts:230` and `video-list.test.ts:1072` are negative guards. Their partners (`:157`, `:1054` and `:1063`) are red.
  - `video-detail.test.ts:140` and `:163`, `video-list.test.ts:1036`, `:1043` and `:1048`, and `route.test.ts:137` are mechanical fixture or signature edits.
- **Red for a shallower reason than they appear:**
  - `video-list.test.ts:1012` and `:1024` are red at `60c0bff` only because of the signature change (an object is truthy as the old consent flag).
  - `video-detail.test.ts:184` is red only because `detailDaysOf` did not exist.
  - Round 1 F2's rule is pinned by `:1054` and `:1063`.
- **No test** builds its expected value with the helper under test, mocks the unit under test, or is call-shaped only.
- **Gaps:** Finding 3. Round 1 F4 has no test, because App has no render seam (Finding 1's escalation).

## Before opening the PR

- **CI readiness:** lint, typecheck, build and the full suite are green at `a704a70`.
- **Commit hygiene:** commit this doc and the two new files `docs/reviews/creator-analytics-64/repro/round-2-state.test.ts` and `round-2-state.vitest.config.ts`. They sit outside the root vitest include, so only their own config runs them.
- **Follow-up tickets:**
  - the split ticket from Finding 1's escalation (an App render seam and a failed-save test matrix);
  - any of Findings 1 to 4 not fixed now;
  - round 1's list half of F1 (stage 2 proposal), NFI A and NFI B.
- **Likely reviewer asks:** unchanged from round 1. The three migrations and their RLS, the overlap on `apps/site/privacy.html` with `creator-analytics-3`, and the size of the branch.

## Verdict

**Ready to open the PR. All four findings are LOW and can be fixed now or as follow-up tickets.**

- No CRITICAL, HIGH or MEDIUM finding was confirmed. Round 1 had 2 MEDIUM and 7 LOW; this round has 4 LOW, and two of those are test and comment upkeep. The count shrank as it should, and it is reported at its real size.
- Round 1 claimed 9 findings resolved, and all 9 are. Two of them (F7, F9) were doc and comment findings, resolved by doc and comment edits as they should be.
- Fix-begets-finding: Findings 1 and 2 are both where round 1's sort reset meets App's preference state. The failed-save notice has now been fixed seven times in place. Fix Finding 1 in place, and file the split ticket that gives App a render seam and a failed-save test matrix. Any later finding in this area goes there, not into an eighth in-place patch.
