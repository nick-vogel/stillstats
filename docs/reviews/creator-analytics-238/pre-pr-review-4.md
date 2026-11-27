# Pre-PR review: creator-analytics#238 More own-channel metrics (ratio, newest average, RPM by day, by video and as a chart, and the RPM switch)

**Branch:** `creator-analytics-238-own-channel-metrics` vs `origin/creator-analytics-236-video-list-paging-daily-table` (merge-base `21534e5` "creator-analytics#236 pre-PR review 3"; the base branch itself is now at `95ca09d` "creator-analytics#236 pre-PR review 5", 42 commits further on)
**Reviewed at:** HEAD `ede96cc` ("creator-analytics#357 RPM: a Profile switch that leaves other sources out"). The tree was clean, with no uncommitted or untracked files at review time. 72 files, +7802 / −389 against the merge-base. Of that, about 3270 lines are the two generated drizzle snapshots and 716 lines are review docs 1 to 3 and their repro scripts.
**Delta under review:** none. This is a `--fresh` full review of the whole branch, the first of stage 2 run 2 (tickets #418, #439, #356 and #357 landed since review 3, and the merge of `21534e5`).
**Reviewed against:** the epic creator-analytics#238 body and its 2026-11-04 amendment (the spec), the bodies of #418, #439, #356, #357 and #264/#244 (column placement), `CODING_STANDARDS.md` 1 to 3, `CONTEXT.md`, ADR 0013, the run's recorded ticket assumptions (`.epic-loop/tickets/{356,357,418,439}/assumptions.md`), and the finding headings and Approach decisions of `pre-pr-review-1.md` to `pre-pr-review-3.md`. The repo has no `CLAUDE.md`.
**Date:** 2026-11-05
**Reviewer:** 3 code-review agents + 1 tautology-audit agent + verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | up to date |
| Lint | `pnpm lint` | green, 544 files |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` | green |
| Tests | `pnpm test` (Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | 126 files, 2956 passed, 1 expected fail |
| Browser walk | `pnpm run --if-present test:browser` | passed, 32 steps, no content security policy violation |
| API RPM sort | finder read of `apps/api/src/video-list.ts` `orderOf`/`sortValueOf`/`hasNoValue`, expected orders in `video-revenue.test.ts` recomputed by hand, RPM tests run | total order (partial, then no RPM, then signed RPM, then newest first, then id), sorted before the page slice; zero engaged views last in both directions; consent refusal before any Analytics read; switch read from saved preferences |
| Newest average | finder read of `newestAverageOf` and its tests | public only, scheduled and partial out, format filter, newest 10, none below 2, only after publish, over every upload so visibility, `ids`, sort and page do not move it |
| Preference key and migrations | finder read of API, schema, 0016/0017 SQL, snapshots `prevId` chain, journal; preferences and delete-user tests run | saved, read back, cleared by reset and by user deletion; 0016 widens the check, 0017 adds a nullable boolean |
| One RPM rule everywhere | `git grep "rpmOf("`, `git grep rpmRevenueOf` | every web RPM (card, table cells and total, list cells, chart daily and to date, hover) and the API sort go through `rpmRevenueOf` |
| RPM to date | read of `runningTotalOf` and `dayRpmOf` | running revenue (and running ads and Premium) over running engaged views, never a sum of daily RPM |
| #439 card count vs the API | read of `detailCardCountOf` against `apps/api/src/video-detail.ts:194-197` | same omission rule; unknown video three; refusal keeps its place |
| Stacked heights | read of `app.css` stacked query and placeholder markup | 10rem engaged views, 6rem the rest, 10rem alone, query unchanged, placeholder matches |
| Switch markup | read of `Switch.tsx`, `Profile.tsx`, app tests | native checkbox, `role="switch"`, named by the label, hint outside the label through `aria-describedby`, `rpm_sources_toggled` with `on`/`off` |
| Summary re-read on a switch change | mutation in a scratch worktree at HEAD: drop `adsAndPremiumOnly` from the summary's read deps, run `app.test.ts`; also `biome check` on the mutant | 213/213 still pass and lint passes: finding 1, preserved as `repro/summary-rpm-switch-reread.sh` (exit 1 now) |
| List RPM column placement | read of `video-list.ts:445-507`, `VideoList.tsx:618-640`, `NumbersTable.tsx:86-97`, #264 and #244 bodies | finding 2 |
| Tautology audit | agent: HEAD test files copied onto a scratch checkout of `21534e5`, 187 added or changed tests run there | 32 green and 4 mixed at base, all explained (Test quality); one vacuous-at-base half carried from review 1 |
| PR base drift | `git merge-tree --write-tree --name-only HEAD origin/creator-analytics-236-video-list-paging-daily-table` | 7 conflicted files, the migration numbers among them (Before opening the PR) |
| Not run | VoiceOver or a screen reader on an RPM gap day | Needs Further Investigation B |

**Overall:** The epic's behaviour holds across the whole branch: every RPM follows one rule with the switch on and off, the RPM sort, the newest average, the RPM chart, the heights and the #439 count all match the spec, and every full check is green. No finding is MEDIUM or higher. What remains is a missing test for one load-bearing re-read, the list's RPM column sitting after the sources rather than beside Revenue, and test and comment tidying, part of it carried from review 1's deferred LOWs. Before the PR opens, the branch needs the merge of its moved base, which renumbers this branch's two migrations.

## Approach decisions
- Carried from reviews 1 to 3, all kept: the ratio line's two-line place (`--card-ratio-place`), the empty `aria-hidden` `card-detail` at zero engaged views, and one shared `--card-place` that `.card`'s `min-height` and `.placeholder-card`'s `height` both read. A further in-place change to the card height rule for a new state is a split ticket with a width-by-state matrix (review 2's escalation, applied in review 3 finding 1).
- One RPM rule: `rpmRevenueOf(amounts, adsAndPremiumOnly)` in `packages/api-types/src/channel-summary.ts`, read by the API sort and every web RPM (#357). Kept; any new RPM goes through it.
- A screen that builds its numbers when the read lands names the RPM switch in its read deps (`ChannelSummaryFigures.tsx:186`), and a screen that builds at render does not (#357 assumptions). Kept; finding 1 adds the missing test, not a new mechanism.
- New, this review: the video list's RPM column follows the numbers table's order, right after Revenue and before the sources group (finding 2). This overturns the list's current "after the sources when they show" placement, which no recorded decision covers.

## Confirmed Issues
### 1. When the RPM switch changes while the channel summary is on view, the summary reads again, but no test would notice if it stopped — LOW
- **Location:** `apps/web/src/ChannelSummaryFigures.tsx:181-187`, `apps/web/src/app.test.ts:1853` (the "RPM switch on the profile" describe)
- **Attribution:** introduced by `06b8916` "creator-analytics#357 RPM: a Profile switch that leaves other sources out" (`git log --oneline -S'format, adsAndPremiumOnly]' 21534e5..HEAD`). Review pass 1 of #357 added `4e90927` for the card following the switch, but that test saves the preference before the screen mounts.
- **Real-world trigger:** on the Profile, the creator turns the switch on and goes back to the channel summary before the save's round trip ends, and the save fails. The summary mounts with the optimistic value, waits on `settled()`, and the rollback then changes the switch while the summary is on view. Without the dep, the revenue card keeps the switch-on RPM while the Profile says off. The dep handles this today; the gap is that nothing pins it. Capped at LOW: the code is correct, and the path needs a failed save inside one round trip. Raise it to MEDIUM (wrong numbers silently shown) only if the dep is ever removed.

**Evidence**
```tsx
  // The revenue card is built when the read lands, so a change of the RPM switch reads again.
  const adsAndPremiumOnly = rpmAdsAndPremiumOnlyOf(usePreferences().saved)

  useViewInSavedCurrency(
    summary && channelId !== null ? () => readSummary(channelId, summary, adsAndPremiumOnly) : null,
    setView,
    [channelId, window, range?.from, range?.to, format, adsAndPremiumOnly],
  )
```
`useViewInSavedCurrency` (`apps/web/src/preferences.ts:277-291`) re-runs on `deps`, the currency and `settled`; `settled` is stable (`App.tsx:198`), so `adsAndPremiumOnly` is the only thing that re-reads on a switch change. Every switch-on app test calls `installFakeApi({ rpmAdsAndPremiumOnly: true })` or `earningDetailApi({ rpmAdsAndPremiumOnly: true })` before render, and screens mount only after the preferences read lands, so the first read already has the final value.

**Failure mode** — executed: in a detached worktree at `ede96cc`, removing `adsAndPremiumOnly` from the deps leaves `apps/web/src/app.test.ts` at 213/213 passed, and `biome check` passes the file (the hook's `useExhaustiveDependencies` is suppressed). `repro/summary-rpm-switch-reread.sh` prints "mutant survives" and exits 1.

**Recommended fix** — add one app test in the "RPM switch on the profile" describe:
```ts
test('a failed save of the switch, landing while the summary is on view, reads the summary again with the switch off', async () => {
  const api = earningSummaryApi()
  const { container } = await render('profile')
  const save = api.hold(savePreferences)
  await click(switchNamed(container, label))
  await navigateToSummary(container)
  await act(async () => save.fail())
  await settle()
  expect(rpmLineOf(container)).toBe(offRpmLine)
})
```
`earningSummaryApi`, `navigateToSummary` and `offRpmLine` stand for whatever the describe already uses to render the summary with revenue (`installFakeApi` with the revenue days the existing summary switch test uses), to reach the summary from the profile (the sidebar link or `render` route the describe uses), and the switch-off RPM line that test asserts. Use the existing helpers by name; add none if one exists.

**Remediation brief**
- **Design intent:** the channel summary builds its revenue card when its read lands (`readSummary(channelId, summary, adsAndPremiumOnly)`), so a change of the switch while it is mounted must re-read. Every read waits on `settled()`, so a read never lands ahead of a save in flight. The video page, the numbers table, the list cells and the charts compute at render and need no such dep.
- **Full surface:** `apps/web/src/app.test.ts` (one new test in the describe at `:1853`). No production change.
- **Must preserve:** `ChannelSummaryFigures.tsx:186` as it is; the existing describe's tests at `app.test.ts:1853-2060`; `failedOnTheProfile` (`app.test.ts:303`) and the hold helpers (`fake-api.ts:380-390`) unchanged.
- **Do not touch:** `useViewInSavedCurrency`'s `biome-ignore` (`preferences.ts:284`), which is the hook's documented contract.
- **Proof:** `pnpm exec vitest run apps/web/src/app.test.ts` green with the new test; then `sh docs/reviews/creator-analytics-238/repro/summary-rpm-switch-reread.sh` from the repo root must exit 0 ("mutant killed") on the commit that adds it. Run the new test once with the dep removed by hand in a scratch worktree if the script cannot run.

### 2. With the revenue sources shown, the video list's RPM column sits after the three sources, not beside Revenue as #264 asks and as the numbers table places it — LOW
- **Location:** `apps/web/src/video-list.ts:497-504` (the RPM column after Other sources), `apps/web/src/video-list.ts:425-429` (its doc comment), `apps/web/src/VideoList.tsx:623-635` (the sources heading placed after Revenue)
- **Attribution:** introduced by `14e8a85` "creator-analytics#264 Video list: an RPM column and sort" (`git log --oneline -S"after the sources" 21534e5..HEAD -- apps/web/src/video-list.ts`). No recorded decision covers it.
- **Real-world trigger:** a creator with revenue consent who has chosen "Show revenue sources" sees Revenue, Ads, YouTube Premium, Other sources, RPM in the list, and Revenue, RPM, then the sources in the numbers table on the same screen's sibling view. With the sources hidden (the default) the two agree. A display inconsistency, LOW.

**Evidence**
```ts
    {
      label: 'Other sources',
      sortKey: 'otherSources',
      optional: 'revenue',
      source: true,
      textOf: moneyTextOfRow(otherSourcesOfRow),
    },
    {
      // The glossary's term, as the revenue card's line names it.
      label: 'RPM',
```
#264: "The video list gains an "RPM" column beside "Revenue"", and its criterion "the RPM column beside Revenue only". The numbers table: `revenueColumns = ['estimatedRevenue', 'rpm', ...revenueSourceSortKeys]` (`numbers-table.ts:26`), its sources heading last in the first header row (`NumbersTable.tsx:88-95`). The list test `video-list.test.ts:177` pins the current order.

**Failure mode** — `listColumnsShownOf({ views: true, watchTime: false, revenue: true }, { window: 'last28', sources: true })` gives `… 'Revenue', 'Ads', 'YouTube Premium', 'Other sources', 'RPM', 'Average viewed' …` (`video-list.test.ts:177-196`).

**Recommended fix** — move the RPM column object to directly after the Revenue column in `metricColumnsOf`, and place the sources heading after RPM in the list's first header row:
```diff
-                      return grouped && shownColumn.column.sortKey === 'estimatedRevenue'
+                      return grouped && shownColumn.column.sortKey === 'rpm'
```
Change the doc comment at `video-list.ts:427-428` from "RPM shows with the Revenue switch, after the sources when they show" to "RPM shows with the Revenue switch, right after Revenue". Update the expected order in `video-list.test.ts:177-196` to `'Revenue', 'RPM', 'Ads', 'YouTube Premium', 'Other sources'`, and rename that test to "with revenue on and the sources shown, RPM follows Revenue and Ads, YouTube Premium and Other sources follow RPM". If Nick prefers the current order, the alternative is to record it as a decision here and leave the code.

**Remediation brief**
- **Design intent:** the list's body cells follow `listColumnsShownOf`'s order; its header has two rows when the sources show, with every non-source column spanning both rows and one `colgroup` heading over the source columns. The `colgroup` heading must sit, in the first row, exactly where the source columns start in the body, which after the move is right after RPM. RPM is never shown without Revenue (both `optional: 'revenue'`, neither narrow-only), so `'rpm'` is always present when `grouped` is true.
- **Full surface:** `apps/web/src/video-list.ts:425-429` and `:463-504` (move the RPM object to after the Revenue object at `:463-469`), `apps/web/src/VideoList.tsx:624`, `apps/web/src/video-list.test.ts:177-196`. The not-processed row's `colSpan` (`video-list.ts:951`) counts shown columns and needs no change.
- **Must preserve:** header and body alignment with the sources shown and hidden (add one assertion in the list markup tests in `apps/web/src/components.test.ts` that, with the sources shown, the header's leaf headings read in the body cells' order); `video-list.test.ts:207` and `:218` (RPM gone with Revenue, shown at every width); `sortKeysOfColumn('revenue')` giving `['estimatedRevenue', 'rpm']` (`video-list.test.ts:1270`); the vertical column lines `#351` gives every pair of columns.
- **Do not touch:** the numbers table's order (`numbers-table.ts:26`, `NumbersTable.tsx:88-95`), which is the reference.
- **Proof:** `pnpm exec vitest run apps/web/src/video-list.test.ts apps/web/src/components.test.ts` with the renamed order test red before the move and green after; `pnpm build && pnpm test:browser` green.

### 3. Duplicate, exact-markup and weak tests break the one-rule-one-test rule — LOW
- **Location:** listed per item below.
- **Attribution:** introduced on this branch: `ec38e1d` (#242), `485d85d` (#244), `14e8a85` (#264), `aaa9c94` (#439), `faef458` (#356), `06b8916` (#357). Items marked "review 1" were review 1 findings 2 and 3, deferred as LOW by its closure table, and still stand at HEAD. None of these tests was added by a review finding's fix commit (`git log -S'<test name>' 21534e5..HEAD` for each).
- **Real-world trigger:** none for users; `CODING_STANDARDS.md` 2 ("A duplicate that covers a rule an existing test already covers", "an exact class string", "a test that passes whatever the implementation does").

**Evidence and recommended fix, per item**
- `apps/web/src/components.test.ts:199-211` (#357), "is a switch, named by its label" and "is described by its hint": exact class strings (`<label class="list-switch">`, `<p class="switch-hint" id=…>`), and `toContain('A label')` passes even with the label text outside the `<label>`. Rewrite both against structure: the `<label>` element contains the input and the label text, and the element named by `aria-describedby` holds the hint and is not inside the `<label>`. Keep `:213` ("without a hint, is described by nothing").
- `apps/web/src/components.test.ts:718` (#242, review 1), "hides the "×" sign from a screen reader": asserts the same two spans the first ratio test pins through `ratioLine`. Delete.
- `apps/web/src/placeholder.test.ts:384-430` (#439) against `apps/web/src/video-detail.test.ts:205` (unknown video three, no publish day two, a custom range before the publish day two): each rule at both levels. Keep the pure `detailCardCountOf` cases in `video-detail.test.ts` and one render case in `placeholder.test.ts` (the custom range giving two placeholders); delete the other render cases.
- `apps/web/src/app.test.ts:2005` (#357): `rpmLineOf(container)?.startsWith('RPM: ')` cannot be false, as `rpmLineOf` only returns a `/RPM: \$[\d.,]+/` match. Replace with `expect(rpmLineOf(container)).toBeDefined()`; keep the heading assertions after it.
- `apps/web/src/metric-charts.test.ts:184` (#356), "its scale runs from zero up to the highest RPM, over the days that have one": repeats the `rpm: { top: 200 }` the daily scale test already asserts, and "over the days that have one" is unobservable (a null day coerces to 0 in `Math.max`/`Math.min`, with 0 already in range). Delete.
- `apps/web/src/metric-charts.test.ts:237-244` (#357), `rpmsOf`: maps `metricChartsOf(…)?.points` to `dayRpmOf(day, …)`, but the options only change the RPM scale, so the values come from `dayRpmOf` alone. Call `dayRpmOf` over the days (daily) and over `runningTotalOf(days)` (to date) directly, and name the tests for `dayRpmOf`.
- `apps/web/src/video-list.test.ts:363-364` (#357): the two empty-cell lines repeat the next test at `:367`. Delete those two lines.
- `apps/web/src/video-list.test.ts:1355-1361` and the `'?sort=rpm&window=first7'` row of `:1325-1331` (#264, review 1 finding 2): green at `21534e5`, where `listRouteOf('?sort=-rpm…')` parses to `-publishedAt`. Add `expect(byRpm.sort).toBe('-rpm')` before the `toBe` checks at `:1358`, and `expect(route.sort).toMatch(/rpm/)` for the RPM rows of `:1325`.
- `apps/web/src/numbers-table.test.ts:542` (#244, review 1 finding 2): an RPM sort over two no-RPM days keeps newest first, green at base because an unknown column falls back to newest first. Add one day with an RPM to the fixture and assert it sorts ahead of both.
- `apps/web/src/numbers-table.test.ts:554` "shows with the sources hidden or shown" and `:503` "is in the currency of the total, as the locale writes it" (#244, review 1 finding 3): covered by the revenue column list and de-DE cell tests. Delete both.
- `apps/web/src/components.test.ts:1783` (#264, review 1 finding 3): `/<button type="button" class="sortable-heading">RPM<span/`, an exact class string. Replace with a check that the RPM `<th>` holds a `<button>`.

**Remediation brief**
- **Design intent:** one rule, one test, observed through rendered output or returned values, never through class names (`CODING_STANDARDS.md` 2).
- **Full surface:** the locations above; no production code.
- **Must preserve:** the first ratio test in `components.test.ts` (the one asserting `toEqual(['1,920 views', ratioLine])`), `components.test.ts:213`, the pure cases in `video-detail.test.ts:205-260`, the daily scale test in `metric-charts.test.ts` that asserts `rpm: { top: 200 }`, `video-list.test.ts:367`, the numbers table revenue column list and de-DE cell tests, `app.test.ts:1853-2060` apart from the one line at `:2005`.
- **Do not touch:** `newest-average.test.ts`'s per-format and per-window sentence tests (a branch observed through its text, allowed by standard 2); the switch-off halves of the switch tests in `channel-summary.test.ts` and `video-detail.test.ts` (the control for the on half); the absence tests that pass at base (Test quality), which are the controls for the new branches.
- **Proof:** `pnpm exec vitest run apps/web/src/components.test.ts apps/web/src/placeholder.test.ts apps/web/src/video-detail.test.ts apps/web/src/app.test.ts apps/web/src/metric-charts.test.ts apps/web/src/video-list.test.ts apps/web/src/numbers-table.test.ts` green, with the case count down by the deletions; the strengthened `video-list.test.ts:1358` and `numbers-table.test.ts:542` red when their file is copied onto a scratch checkout of `21534e5`.

### 4. Comment hygiene — LOW (aggregated)
- `apps/web/src/numbers-table.ts:23-25` — "Named here, not taken from the video list's revenue sorts, so a sort the list gains never becomes a column of this table." → "Named here, not taken from the video list's revenue sorts, so the list's own sorts, such as RPM, do not set this table's order. The sources are the list's source sort keys on purpose, shared with `isSourceColumn`." (review 1 finding 4, still open)
- `apps/web/src/numbers-table.ts:89` — "The columns the table shows, in order: the day, then its numbers." → "The columns the table shows, in order: the day, its numbers, then the revenue columns with RPM when revenue shows." (review 1 finding 4, still open)
- `packages/api-types/src/videos.ts:333-334` — "(under `all`, of any format, those Google gives none too)" → "(under `all`, any format, including uploads Google gives no format)" (review 1 finding 4, still open)
- `apps/web/src/metric-charts.ts:83` — "or null with no engaged views or no revenue on the day" → "or null with no engaged views, or on a day that carries no revenue amount; a day of $0 with engaged views is 0"
- `apps/web/src/Placeholder.tsx:92-93` — "It holds no place for the revenue chart, which shows only once the answer carries revenue" → "It holds no place for the revenue and RPM charts, which show only once the answer carries revenue"
- `apps/api/src/preferences.test.ts:149-150` — "off by default, so a GET of a user who never touched it names no value." → "saved and read back; off by default means the key is absent until saved." (or add `expect(await read(browser)).toEqual({ status: 200, body: {} })` before the save and keep the comment)

## Needs Further Investigation
### A. An upcoming public live stream or Premiere may count in the newest average with zero engaged views — confirm what Google answers for an upcoming broadcast
Carried from reviews 1 to 3, unchanged. It is confirmed by a recorded Data API answer for an upcoming public broadcast showing `privacyStatus: public` with no `actualStartTime`, and the newest average counting it; it dies if Google reports such an upload as scheduled or partial.

### B. The RPM plot's unseen every-day focus line may be exposed to assistive technology on a gap day
`apps/web/src/metric-plot.ts:127-135` adds a non-decorative line, id `every-day`, along the bottom edge when an RPM day has no value, so the shared cursor shows the RPM card with no value (#356 assumption). With `focusRing: false` and `keyboard: false` and the app's own slider labels it is probably silent. Confirm with VoiceOver in Safari or Chrome on a window with a zero engaged views day: the RPM chart should announce nothing extra for the line; kill it if so.

## Reviewed and Dismissed
- API RPM sort and paging — a total order over every listed row before the page slice; zero engaged views last in both directions inside each partial group (`video-revenue.test.ts` expects `[2,1,3,4,5]`, not `[2,1,4,3,5]`). Do not reorder the comparator.
- The running-total RPM's last point equals the card only when the days add up to YouTube's totals — true of every running total since before this branch, and `runningTotalNote` says so; the tests use days that add up on purpose.
- `metric-charts.ts:133`'s `.filter((rpm): rpm is number => rpm !== null)` looks dead at run time — it narrows the type for `lineOf`. Do not remove.
- The newest average's sentence from the last answer stays above the loading rows while a new window reads (`VideoList.tsx:569`) — documented intent; the sentence names its own window and format, so it never says anything false.
- `newest-average.ts:33`'s `count < 2` guard — the API never answers below 2, but the guard is cheap and pinned by a test. Leave it.
- A ratio line of 1,000× or more wraps to three lines on a 12rem card — views a thousand times engaged views is no real channel's state.
- A saved `?card=rpm` with no window RPM shows the RPM chart alone with no card marked chosen — the recorded #356 decision's consequence; the case needs zero engaged views over a window that carries revenue.
- #439's card count — mirrors `apps/api/src/video-detail.ts:194-197` exactly; the only empty-revenue case for a processed video is a custom range ending before the publish day, which it covers.
- The Profile switch shows off until the preferences read lands — the currency select beside it behaves the same.
- The RPM switch has no failed-save test of its own — the generic rollback path is covered (`failedOnTheProfile`, `app.test.ts:303`).
- `chartShownOf('rpm')`, `chartMetricChangedEvent('rpm')` and `searchOf` with `card=rpm` pass at base — type widening; the base already passed the value through.

## Minor / nits
- `packages/api-types/src/index.ts:96` re-exports `revenueSortKeys`, which nothing outside `videos.ts` imports since this branch moved `apps/api/src/video-list.ts` and `apps/web/src/numbers-table.ts` off it (`git grep revenueSortKeys 21534e5 -- apps`). Drop it from the barrel (`CODING_STANDARDS.md` 3).
- `apps/site/test/screenshot/stub-api.ts:266` sorts by RPM over the whole estimated revenue whatever the saved switch says, unlike the API. Harmless while the walk never turns the switch on; use `rpmRevenueOf` with the stub's saved preference if a step ever does.
- Comment lines over the 100-column `lineWidth` left by this branch's rewraps: `MetricCharts.tsx:84` (108), `:242` (136), `route.ts:306` (103). Biome does not reflow comments, so lint stays green.
- No API test pages an RPM sort (`pageSize: 2, page: 2`); the code sorts before slicing, so this is coverage only.
- `apps/api/src/preferences.test.ts:151` and `:161` overlap the parameterized test at `:120` except for a GET read-back; keep them for that.
- `newest-average.test.ts` "names the days" runs 28, 90 and 365 days through the same branch as 7.
- `apps/web/test/web.test.ts`'s #418 tests re-assert the 10rem plots in each case, and still no assertion reads `.card`'s `min-height: var(--card-place)`: review 3 finding 2, still open.

## Test quality
Tests added or changed: 187 across 21 files. Green against `21534e5`: 32, plus 4 with mixed cases (old cases green, new RPM cases red). All are explained: 13 moved with an unchanged body when the describe was renamed from three charts to stacked charts (`metric-charts.test.ts:49`, `:59`, `:321`, `:335`, `:361`, `:368`, `:375`, `:398`, `:442`, `:450`; `components.test.ts:779`, `:786`, `:839`); 3 are type-widening cases (Reviewed and Dismissed); 10 are absence tests, the controls of new branches (`cards.test.ts:125`, `metric-charts.test.ts:425`, `numbers-table.test.ts:366`, `:402`, `components.test.ts:809`, `:1439`, `:1467`, `video-list.test.ts:207`, `app.test.ts:1843`, `web.test.ts:879`); 4 are controls whose behaviour already held at base (`cards.test.ts:158`, `components.test.ts:725`, `placeholder.test.ts:412`, the string case of `apps/api/src/preferences.test.ts:87`); 2 are vacuous at base and strengthened in finding 3 (`video-list.test.ts:1355`, `numbers-table.test.ts:542`). `chart-colours.test.ts` does not import at base (the RPM data needs the RPM chart), and `components.test.ts` and `newest-average.test.ts` imported only with HEAD's `Switch.tsx` and `newest-average.ts` copied in. Tautology shapes: no mocked unit under test (only `track` is mocked), no snapshots, no assertion-free or call-shaped-only tests. `components.test.ts:806`, `:825` and `:839` build part of their expected text from `metricChartsText.headings` and `chartLabelOf`, beside literal assertions that anchor them; acceptable.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and tests green at `ede96cc`; the browser walk green.
- **Base drift (gate):** `origin/creator-analytics-236-video-list-paging-daily-table` is at `95ca09d`, 42 commits past the merge-base, and now carries `0016_preferences_support_prompt_dismissed` and `0017_tips` from main. A trial merge conflicts in `apps/api/src/preferences.test.ts`, `apps/site/test/screenshot/browser-walk.ts`, `apps/web/src/Profile.tsx`, `apps/web/src/app.test.ts`, `packages/database/drizzle/meta/0016_snapshot.json`, `packages/database/drizzle/meta/0017_snapshot.json` and `packages/database/drizzle/meta/_journal.json`. Merge the base, delete this branch's 0016 and 0017 SQL and snapshots, and regenerate them as 0018 (`preferences_chart_card_rpm`) and 0019 (`preferences_rpm_ads_and_premium_only`) with `drizzle-kit generate`, then run the full checks. The preferences files need a hand merge (main adds `supportPromptDismissed`).
- **Commit hygiene:** commit this doc and `repro/summary-rpm-switch-reread.sh`.
- **Likely reviewer asks:** the migration renumbering; the list's RPM placement (finding 2); the switch's Reset preferences warning, whose approved text does not name the RPM switch (#357 assumption).

## Verdict
Ready to open the PR with follow-ups, once the moved base is merged and the two migrations are renumbered; that merge is the one gate. No finding is MEDIUM or higher. Findings 1 to 4 are LOW and can ride a remediation pass before the PR or follow it. Finding 1 is the one worth doing first: it pins a re-read that guards against a wrong RPM. Finding 2 is a product call: align the list with the numbers table and #264's "beside Revenue", or record the current order. Review 1's deferred findings 2 to 4 are folded into findings 3 and 4 where they still stand; review 3's finding 2 still stands (Minor / nits), and its findings 1 and 3 were not re-checked here.
