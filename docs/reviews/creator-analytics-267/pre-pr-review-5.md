# Pre-PR review: creator-analytics#267 launch chart, one marked video, the processed note, the empty state and a color per video

**Branch:** `creator-analytics-267-launch-chart-color-per-video` vs `origin/main` (merge-base `efdfc48`, "creator-analytics#358 ADR 0014: the charts move to TanStack Charts, with the inline style patch and a browser policy test")
**Reviewed at:** HEAD `f48b6a1` (creator-analytics#344 Video list: after Back, hold as many placeholder rows as the read last answered) + 0 files with uncommitted changes, 0 untracked files, 29 files total, +3239 / −220 (21 code files, +2129 / −220; the rest are reviews 1 to 4 and their repros)
**Reviewed against:** epic creator-analytics#267 (its body is the spec) and its children #175, #176, #181, #191, #273, #311 (open, out of scope), #312, #313, #314, #322, #323, #324, #325, #343 and #344; `CODING_STANDARDS.md`; ADR 0014; the Approach decisions and Dismissed lists of `pre-pr-review-4.md`
**Date:** 2026-11-02
**Reviewer:** 3 code-review agents + tautology audit agent + 1 disprove agent + verify pass. A full (`--fresh`) review. Since review 4 (`a88ab23`) the branch took the merge of `origin/main` at `a70d1ed` (main's sidebar, Audience screen and ADR 0014), #343 (`2d3af45`, `1d4bcfb`) and #344 (`6b1f18f`, `f48b6a1`).

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | ok |
| Lint | `pnpm lint` | green, 511 files |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` | green |
| Test suite | `pnpm test` (Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | green: 115 files, 2669 passed, 1 expected fail |
| Browser walk | `pnpm run --if-present test:browser` | not run: the script does not exist yet (#361) |
| Merge `a70d1ed` resolution | `git show a70d1ed --cc` on `App.tsx`, `Placeholder.tsx`, `app.css`; `git diff a88ab23 a70d1ed` on the chart files | both sides kept; main's deletion of `.video-detail-breakdowns .placeholder-note` (4d4ae4c) kept on purpose. Main's sidebar does change the note places' widths (finding 1) |
| #343 in ChartHover charts | finder repro in happy-dom (key step, then pointermove, live region empty); tautology agent's mutations M1 to M3 | holds; every #343 test goes red under a mutation |
| #344 list placeholder | read of `videoListStateOf` and `VideoList.tsx:410`; mutations M4, M5 | holds; reads the memo with `listReadOf`'s own `query`; tests go red under the mutations |
| Note places beside the sidebar | `sh docs/reviews/creator-analytics-267/repro/review-5-finding-1.sh` (headless Chrome, real stylesheets, signed-in shell with `.sidebar`) | finding 1: both running total notes are a line short from 768px to about 880px |
| Launch day card under the video list's table | disprove agent: real `App` markup from `fake-api.ts` with 10 videos, built CSS, headless Chrome, 320 to 2560px, daily and running total | dismissed: the card ends at least 21px above `.video-list-scroll` at every width |
| Review 4 finding 1 still open | `TMPDIR=<scratchpad> sh docs/reviews/creator-analytics-267/repro/review-4-finding-1.sh` | "GAP OPEN", exit 1: finding 2 |
| Tautology audit | branch test files run at `efdfc48` in a scratch worktree (no globalSetup), plus mutations at HEAD | see Test quality |
| `emptied` "costs no render" | finder Profiler repro: three pointermoves at one index with an empty region | three commits; the claim is false (comment hygiene) |
| Em-dashes in shipped strings | grep of added UI strings | none |

**Overall:** The epic's end state holds at HEAD: one marked video, the processed note's move, the empty state, ten colors with swatches and the card, and the two children since review 4 (#343, #344) do what their issues ask, with tests that go red without them. The one new user-visible defect comes from the merge: main's sidebar narrows the screen from 768px, so the running total notes' placeholders, measured before it, are a line short there and the page moves a line when the chart lands. Everything else is review 4's nine LOWs, none remediated, carried here with their line numbers brought up to date. No finding gates the PR.

## Approach decisions
- Mark origin (#181, #313): the shared mark carries `by: 'row' | 'chart'`, the chart shows its held selection only while the mark is the chart's, and a clear (`null`) from one origin ends only a mark of that origin. `App.tsx:229-232` (`markVideoBy`, a functional `setMark`). Precedent: `ListMark` in `apps/web/src/video-list.ts`.
- Live region (#312, #322, #343): one helper, `emptied` in `apps/web/src/chart-hover.ts:154`, empties an announcement and keeps an already empty one as the same object. `useChartHover` uses it for a hide and for `pointTo`. On the launch chart, the render-phase `selectionShown` block (`LaunchChart.tsx:141-146`) empties the region whenever the shown selection ends, and `pointAt` (`:192`) empties it when a pointer selection replaces a key step. Finding 3 makes both take `emptied` and removes the dead third copy in `select()`. Precedent: `ChartHover.tsx:48`, `:57`.
- The chart's mark outliving its selection (#323): an effect in `LaunchChart` (`:149-152`), before the empty-state return, calls `onMark(null)` while `markedBy === 'chart' && held === null`. Only a mode change reaches it; a new page or sort makes a new `SummaryPlaceList`, and `markedVideoOf` ends a mark made on another list by identity.
- Launch chart day card placement (review 1 finding 1, `16a2433`): the card sits under the plot (`top: calc(100% + 0.25rem)`), scoped to `.launch-chart`, no z-index. Precedent: `.chart-hover-card` in `apps/web/src/app.css`.
- Placement guard (review 2 finding 1): filed as creator-analytics#316, not on this branch.
- Placeholder parity (#314, #324): every note the loaded launch chart shows under a predictable condition gets its own placeholder shape, with line counts measured per width in headless Chrome and pinned in `apps/web/test/web.test.ts` through `valueIn(webOwnSheet(), …)`. **This review adds:** the widths are measured in the signed-in shell with main's sidebar beside the screen (`.signed-in-shell:has(> .sidebar)`, from 48rem), the layout every creator with a channel sees, and a band that the sidebar changes gets its own `(min-width: 48rem) and (max-width: …)` rule (finding 1). Precedent: `.placeholder-first-rows-note` at `apps/web/src/app.css:1628`.
- First-10 note prediction (#325) and the list's own placeholder rows (#344): a module-level memo in `video-list.ts` (`answeredRows`), keyed by channel and the list's read query, written by `VideoList` on each landed answer (`VideoList.tsx:378`). The list reads it with `listReadOf`'s `query` (`VideoList.tsx:410`); finding 4 makes the launch chart placeholder read it the same way. Precedent: `rememberSincePublishOf` and `rememberAwaitingProcessingOf`.
- Review repro files: `biome check .` lints `docs/reviews/**/repro/`, so a repro must pass `pnpm lint` before it is committed. A shell repro is outside biome's file types.

## Prior-review closure
For information; this run is `--fresh`. Review 4 has no remediation table, and none of its nine findings was fixed: finding 1 carried as finding 2 (its repro still prints "GAP OPEN"), 2 as 3 (now beside #343's `emptied`), 3 as 4, 4 folded into finding 1 (the same comment block is rewritten there), 5 as 5, 6 as 6, 7 as 7, 8 as 8, 9 as 9. Its NFI A, B and C are carried. None was resolved only by a comment or doc edit.

## Confirmed Issues

### 1. Beside main's sidebar, both running total notes' placeholders are a line short from 768px to about 880px, so the page moves a line when the chart lands — LOW
- **Location:** `apps/web/src/app.css:1585-1614` (`.placeholder-total-note`, 1 line from 41.875rem), `:1636-1666` (`.placeholder-launch-total-note`, 1 line from 43.0625rem); the same mechanism, pre-existing, in `.placeholder-note` (`:1604-1620`)
- **Attribution:** introduced by #324 (`28c887d`, which measured both widths on 2026-10-22, `git log -S'43.0625rem'` and `-S'41.875rem'`), exposed by the merge `a70d1ed`, which brought main's sidebar (`96d0c48`, "creator-analytics#274 Sidebar: Videos and Audience"; `git merge-base --is-ancestor 96d0c48 28c887d` is false). The `.placeholder-note` band (2 lines to 52.0625rem) is pre-existing on main and wrong beside main's sidebar on main too; the branch moved that note's place under the launch chart and the publish day top 10 (#175, `Placeholder.tsx:164`, `:180`), and rewrote the comment block over it.
- **Real-world trigger:** a creator with a channel (so the sidebar shows, `App.tsx:262`) on a window 768 to about 880px wide (a tablet in landscape, a narrow laptop window) opens a window after publish in "Running total" mode, or any calendar window in running total mode, and the chart loads. The placeholder holds one line of the note, the loaded chart shows two, and everything below moves down 24px. The delay note does the same from about 833 to 1100px in every mode. No wrong number is shown.

**Evidence**
```css
@media (min-width: 48rem) {
  .signed-in-shell:has(> .sidebar) {
    grid-template-columns: 9rem minmax(0, 1fr);
    gap: 2.5rem;
  }
```
`app.css:1817-1821`: from 768px the sidebar takes 9rem plus a 2.5rem gap (184px) from the column the notes wrap in. The comment over the note places says each width was measured "in the signed-in view's gutter", which had no sidebar on 2026-10-22.

**Failure mode** — executed: `sh docs/reviews/creator-analytics-267/repro/review-5-finding-1.sh` prints, per width, loaded lines / placeholder lines:
```
{"vw":767,"first":"1/1","ltotal":"1/1","total":"1/1","delay":"2/2"}
{"vw":768,"first":"1/1","ltotal":"2/1!","total":"2/1!","delay":"2/2"}
{"vw":860,"first":"1/1","ltotal":"2/1!","total":"2/1!","delay":"2/1!"}
{"vw":880,"first":"1/1","ltotal":"2/1!","total":"1/1","delay":"2/1!"}
{"vw":900,"first":"1/1","ltotal":"1/1","total":"1/1","delay":"2/1!"}
{"vw":1100,"first":"1/1","ltotal":"1/1","total":"1/1","delay":"1/1"}
```
and exits 1. Without the `<nav class="sidebar">` the same page matches at every width (the finder's control: 669/670px for the total note, 688/689px for the launch total note, the comment's own breakpoints). The first-10 note fits one line at every width from 500px and is unaffected.

**Recommended fix** — after each shape's existing `min-width` rules, add a band from 48rem up to the last width the note still takes two lines beside the sidebar, measured by bisecting with the repro (add 1px steps to its width list); the values below are the bounds this review measured, not final:
```css
@media (min-width: 48rem) and (max-width: <last 2-line width, 880px to 899px, in rem>) {
  .placeholder-launch-total-note {
    --lines: 2;
  }
}

@media (min-width: 48rem) and (max-width: <last 2-line width, 860px to 879px, in rem>) {
  .placeholder-total-note {
    --lines: 2;
  }
}

@media (min-width: 48rem) and (max-width: <last 2-line width, 1000px to 1099px, in rem>) {
  .placeholder-note {
    --lines: 2;
  }
}
```
Pin each band in `apps/web/test/web.test.ts` beside the existing pins (`:674-681`, `:694-703`, `:736-746`) with `valueIn(own, '<selector>', '--lines', '<the band's exact media text>')`. Rewrite the comment over `.placeholder-note, .placeholder-total-note` (`:1574-1590`) so it states the measurement once: below 48rem the widths are measured with no sidebar beside the screen, from 48rem beside the sidebar; drop the preamble's "moved up by the 1.5rem ... not measured again" for any width this pass measures again (this also closes review 4 finding 4, where the preamble and the total note's paragraph contradict each other). Give the launch total note's comment (`:1636-1642`) the same sidebar sentence.

**Remediation brief**
- **Design intent:** a placeholder note holds as many lines as the loaded note wraps to at the screen's width, so nothing below it moves when the answer lands (#314, #324). The note wraps in the screen's column, and from 48rem the screen's column is the shell minus the sidebar (`.signed-in-shell:has(> .sidebar)`), which shows for every creator with a channel and while the channels are read (`App.tsx:262`), so beside the sidebar is the layout every loading chart is in at that width. Below 48rem the sidebar sits above the screen and takes no width.
- **Full surface:** `apps/web/src/app.css:1574-1590` (comment), `:1598-1620` (the `.placeholder-note` and `.placeholder-total-note` media rules), `:1636-1666` (launch total note comment and rules); `apps/web/test/web.test.ts:674-681`, `:694-703`, `:736-746` (the pins; also `:699`, see finding 9); the shapes are used at `apps/web/src/Placeholder.tsx:113-114`, `:164`, `:179-180` and `apps/web/src/VideoDetail.tsx:263` (the video page's delay note place, inside the same shell, so the `.placeholder-note` band applies there too; confirm with the repro that the video page's note column is the screen's width, or scope the band).
- **Must preserve:** every breakpoint below 48rem (`22.5625rem`, `23.375rem`, `24.125rem`, `27.4375rem`) and its pin; `web.test.ts` "no placeholder rule ..." checks at `:204`; the `height: calc(var(--lines) * 0.9375rem * 1.6 + 1rem)` formula; `.placeholder-first-rows-note`, which fits one line at every width from 386px and needs no band.
- **Do not touch:** the `.signed-in-shell` grid (main's #274 layout); `.placeholder-first-rows-note`'s height (review 1 Dismissed).
- **Proof:** red before green: `sh docs/reviews/creator-analytics-267/repro/review-5-finding-1.sh` exits 1 today ("MISMATCH") and must exit 0 ("MATCH") after, with the `delay` column also free of `!`. Then `pnpm lint` and `pnpm exec vitest run apps/web/test/web.test.ts -t "placeholder"` green. Headless Chrome on macOS renders nothing under 500px, so the phone breakpoints are not re-checked by the repro; they are unchanged.

### 2. The #323 proof test never checks the state right after Back, so a mode change that keeps the selection passes the whole suite (carried from review 4 finding 1) — LOW
- **Location:** `apps/web/src/app.test.ts:355-399` (the self-comparison at `:392-398`, the Escape at `:395`)
- **Attribution:** introduced by #323 (`bfc0931`, `a67e24d`); untouched since review 4.
- **Real-world trigger:** none for users; a coverage claim the test does not hold (CODING_STANDARDS 2).

**Evidence**
```ts
    const halfState = shown()

    await pointer(rowOf(container, 'Video B'), 'pointerout', document.body)
    await press('Escape')
    expect({ halfState, after: shown() }).toEqual({
      halfState,
      after: { accented: [], marked: [], valueText: sliderTextOf(null), day: null },
    })
```
**Failure mode** — executed: `review-4-finding-1.sh` drops `mode` from LaunchChart's `linesKey` in a scratch worktree (so a mode change keeps the selection) and runs the three launch chart test files: every test stays green, "GAP OPEN". `halfState` is compared with itself. The finder logged it: right after Back the state is already fully cleared, so the title ("once the pointer leaves the row") also says the opposite of what happens, and the Escape after it clears whatever a kept selection left.
**Recommended fix**
```diff
-    const halfState = shown()
-
-    await pointer(rowOf(container, 'Video B'), 'pointerout', document.body)
-    await press('Escape')
-    expect({ halfState, after: shown() }).toEqual({
-      halfState,
-      after: { accented: [], marked: [], valueText: sliderTextOf(null), day: null },
-    })
+    const cleared = { accented: [], marked: [], valueText: 'No point selected', day: null }
+    expect(shown()).toEqual(cleared)
+    await pointer(rowOf(container, 'Video B'), 'pointerout', document.body)
+    expect(shown()).toEqual(cleared)
```
and rename the test "drop the chart's mark when a mode change by Back drops its selection, and keep it dropped when the pointer leaves the row".
**Remediation brief**
- **Design intent:** after a mode change drops the chart's held selection, no accented line, marked row, value text or card outlives it, at once and not only after a further step (#323, R7 of the spec: the line and the row always name one video or neither shows).
- **Full surface:** `apps/web/src/app.test.ts:355-399` only.
- **Must preserve:** the steps before Back (Running total, row hover, ArrowDown, the first `shown()` expectation) and the two expectations after `settle()` (Daily pressed, focus on the plot).
- **Do not touch:** the #323 effect in `LaunchChart.tsx:149-152` and its one painted frame (review 4 Dismissed).
- **Proof:** red before green: `TMPDIR=<a scratch dir> sh docs/reviews/creator-analytics-267/repro/review-4-finding-1.sh` prints "GAP OPEN" and exits 1 today; after the fix it prints "GAP CLOSED" and exits 0. Then `pnpm exec vitest run apps/web/src/app.test.ts` green.

### 3. The live region's clear is written three times in the launch chart, beside the `emptied` helper #343 added, and the copy in `select()` does nothing (carried from review 4 finding 2) — LOW
- **Location:** `apps/web/src/LaunchChart.tsx:145`, `:177`, `:192`; `apps/web/src/chart-hover.ts:154` (`emptied`)
- **Attribution:** introduced by #312 (`5586efc`), #313 and #322 (`604e6ac`); widened by #343 (`2d3af45`), which added `emptied` with the same body as `:192` and left the launch chart's copies.
- **Real-world trigger:** none for users; a duplicated rule (CODING_STANDARDS 3). `:145` and `:177` always make a new object, so they render again even when the region is already empty.

**Evidence**
```ts
    if (selection === null) setAnnouncement((last) => ({ ...last, text: '' }))      // :145
    if (next === null) setAnnouncement((last) => ({ ...last, text: '' }))           // :177
    setAnnouncement((last) => (last.text === '' ? last : { ...last, text: '' }))    // :192
```
**Failure mode** — `select(null)` sets the held selection to null, so on the same render the `selectionShown` block at `:141-146` empties the region; `:177` repeats it. `:192` is `emptied` character for character.
**Recommended fix**
```diff
-    if (selection === null) setAnnouncement((last) => ({ ...last, text: '' }))
+    if (selection === null) setAnnouncement(emptied)
@@ function select(next: LaunchSelection) {
     setSelection(next)
-    if (next === null) setAnnouncement((last) => ({ ...last, text: '' }))
     onMark(next === null ? null : (chart.lines[next.line]?.videoId ?? null))
@@ function pointAt(event: PointerEvent<HTMLDivElement>) {
-    setAnnouncement((last) => (last.text === '' ? last : { ...last, text: '' }))
+    setAnnouncement(emptied)
```
with `emptied` added to the import from `./chart-hover.ts` at `LaunchChart.tsx:7`.
**Remediation brief**
- **Design intent:** the live region holds a key step's text only while that step's selection shows; every path that ends or replaces it without a key (a hide, a row hover, a pointer) empties it, through one helper.
- **Full surface:** `apps/web/src/LaunchChart.tsx:7`, `:145`, `:177`, `:192`. Keep the comment at `:191` ("A pointer step writes no announcement ..."), which is load-bearing.
- **Must preserve:** Escape and blur emptying the region (through `:141-146`); a key step after a pointer step announcing (`announcementAfter` at `:204`); the #312, #322 and #323 tests in `app.test.ts`.
- **Do not touch:** the render-phase `selectionShown` block itself (reviews 1 to 3 Dismissed).
- **Proof:** behaviour-preserving, no red step. `pnpm typecheck` and `pnpm exec vitest run apps/web/src/app.test.ts apps/web/src/launch-chart.test.ts apps/web/src/chart-hover.test.ts` green.

### 4. The #325 placeholder builds the list's read query by hand and skips the list's route rewrite, while #344's reader uses the list's own query (carried from review 4 finding 3) — LOW
- **Location:** `apps/web/src/video-list.ts:126-135` (`listRowsExpectedFor`); test helpers `apps/web/src/placeholder.test.ts:215`, `apps/web/src/video-list.test.ts:875`
- **Attribution:** introduced by #325 (`05d6fdb`). #344 (`6b1f18f`) added the correct reader beside it.
- **Real-world trigger:** Back to an address pushed before a column was switched off (for example page 3 sorted by revenue, after revenue consent is withdrawn): the list reads and remembers under the rewritten route (`listRouteFor`: newest first from page 1), while the chart placeholder looks up the unrewritten one and finds a stale count or the page size. The list's replace effect normalises the address after the first paint, so the wrong first-10 note place lasts about a frame. Unverified in a browser.

**Evidence**
```ts
  const pageSize = pageSizeOf(route, saved)
  if (channelId === null) return pageSize
  const query = videoListQueryOf({ ...route, pageSize, visibility: visibilityOf(route, saved) })
  return answeredRowsOf(channelId, query) ?? pageSize
```
**Failure mode** — `VideoList` writes under `listReadOf(addressRoute, channel, saved).query` (`VideoList.tsx:328`, `:378`), which has been through `listRouteFor` (`video-list.ts:593`); this reader never applies it. The tests seed through `listReadOf(route, null, {})`, where a null channel skips `listRouteFor`, so they share the blind spot.
**Recommended fix** — give `listRowsExpectedFor` the `ListedChannel | null` (the placeholder's caller already has the channel list in `App`) and take the key from the writer's builder:
```diff
-export function listRowsExpectedFor(channelId: string | null, route: Route, saved: Preferences): number {
-  const pageSize = pageSizeOf(route, saved)
-  if (channelId === null) return pageSize
-  const query = videoListQueryOf({ ...route, pageSize, visibility: visibilityOf(route, saved) })
-  return answeredRowsOf(channelId, query) ?? pageSize
+export function listRowsExpectedFor(channel: ListedChannel | null, route: Route, saved: Preferences): number {
+  const { query, pageSize } = listReadOf(route, channel, saved)
+  if (channel === null) return pageSize
+  return answeredRowsOf(channel.id, query) ?? pageSize
```
and thread the channel from `ChannelSummaryFigures` to `AfterPublishPlaceholder` (`Placeholder.tsx:176`).
**Remediation brief**
- **Design intent:** one key per list read: the writer and every reader of the rows memo build it with `listReadOf`, so a route the list rewrites is looked up as the list reads it.
- **Full surface:** `apps/web/src/video-list.ts:122-135`; `apps/web/src/Placeholder.tsx:176` and the `AfterPublishPlaceholder` props; its caller in `apps/web/src/ChannelSummaryFigures.tsx:113-115`; the tests at `apps/web/src/video-list.test.ts:870-920` and `apps/web/src/placeholder.test.ts:213-260` (their helpers take a channel).
- **Must preserve:** the page size with no channel and with no remembered answer; #325's Back proof (`app.test.ts:1912`) and page-size control (`:1925`); #344's reader at `VideoList.tsx:410`.
- **Do not touch:** the memo's module-level lifetime (review 4 Dismissed).
- **Proof:** red before green: a new `video-list.test.ts` case that remembers 7 rows under `listReadOf(watchTimeSortRoute, notConsented, {}).query` and expects `listRowsExpectedFor(notConsented, watchTimeSortRoute, {})` to be 7 (with `notConsented` as in the file's existing column tests; `grep -n "revenueConsentedAt: null" apps/web/src/video-list.test.ts`); it fails to typecheck or returns 25 today. Then `pnpm typecheck` and `pnpm exec vitest run apps/web/src/video-list.test.ts apps/web/src/placeholder.test.ts apps/web/src/app.test.ts` green.

### 5. The App card test cannot see the card's sort, and the launch chart's App tests copy their own setup (carried from review 4 finding 5) — LOW
- **Location:** `apps/web/src/app.test.ts:533` (the card test), `:264-301` (the #181 test), the `liveRegion` copies at `:445`, `:467`, `:551`, the `press` copies at `:327`, `:539`, `:1258`
- **Attribution:** introduced by #273 (`244ae72`), #181 (`2fb8a69`), #313 (`9eb3434`), #322 (`604e6ac`); #343 (`2d3af45`) added the `press` at `:1258` for a `ChartHover` plot, which is a different plot and may keep its own.
- **Real-world trigger:** none for users; a coverage claim the test does not hold (CODING_STANDARDS 2) and duplicated setup (CODING_STANDARDS 3).

**Evidence**
```ts
  test("list every drawn video in the card at the selected day, most first, ...", async () => {
    api.videos = [videoA, videoB, videoC]          // day 2: A 20, B 5, C no data, already list order
```
**Failure mode** — executed in review 4 (unchanged since): with the sort at `apps/web/src/launch-chart.ts:330` removed, `app.test.ts` stays green; only `launch-chart.test.ts` catches it.
**Recommended fix** — in the card test, `api.videos = [videoA, { ...videoB, engagedViewsByDay: [90, 25, 60] }, videoC]` and expect the rows Video B (`'25'`, not selected), Video A (`'20'`, selected), Video C (`'No data'`), each swatch from `swatchOf(container, …)`; the value text stays `'Video A'` and the live region `'Day 2, Engaged views 20'`. Rewrite the #181 test on `renderLaunchChart()` (`:312`) and its `press` and `shown`, keeping its three steps and its rule. Return `liveRegion` from `renderLaunchChart` and drop the copies at `:445` and `:467`.
**Remediation brief**
- **Design intent:** the App test proves the card's wiring in the real app (every drawn video, its row's swatch, sorted by the day's number, the selected row flagged wherever it sorts); the sort's own rules stay in `launch-chart.test.ts`. One helper renders the launch chart for every App test of the mark.
- **Full surface:** `apps/web/src/app.test.ts:264-301`, `:312-340` (`renderLaunchChart`), `:445`, `:467`, `:533-565`. `git grep -n "videoB" apps/web/src/app.test.ts` before touching the shared `videoB`; the fix overrides it locally.
- **Must preserve:** the card test's swatch per row, the selected row's class, the value text and the live region reading the selected video only; the #181 rule; the #312, #313, #322, #323 and #343 tests' assertions.
- **Do not touch:** the hover-to-learn-each-line step (review 1 Dismissed); the #343 tests' own `press` at `:1258` (a `ChartHover` plot, not the launch chart).
- **Proof:** red before green: in a scratch worktree, delete the `rows.sort(…)` at `apps/web/src/launch-chart.ts:330`, then `pnpm exec vitest run apps/web/src/app.test.ts -t "list every drawn video in the card"` must go red with the new fixture (green today). Then `pnpm exec vitest run apps/web/src/app.test.ts` green.

### 6. Tests that cannot fail, assert class strings, production-computed paths or a Map's order, or repeat a rule (carried from review 4 finding 6, plus one) — LOW
- **Location:** per item below
- **Attribution:** introduced by `8307cc3`, `8b5216c`, `244ae72`, `28c887d` (#324) and `05d6fdb` (#325); untouched since review 4.
- **Real-world trigger:** none for users; claims of coverage the suite does not have, and duplicates (CODING_STANDARDS 2).

Items, each its own small fix:
- `apps/web/src/components.test.ts:922` with `launchGroupsOf` at `:861`: the expected paths are `` `chart-line launch-chart-line ${lineA?.path}` `` from `launchChartOf`, an identity and an exact class string. Fix: have `launchGroupsOf` return per group its `data-launch-position`, its path count and whether it holds an end dot (`class` contains `launch-chart-end`), assert `[{ position: '2', paths: 1, endDot: false }, { position: '3', paths: 2, endDot: true }]`, and update its other callers (`grep -n "launchGroupsOf(" apps/web/src/components.test.ts`; give the selected-line caller a `selected` flag from `launch-chart-line-selected`).
- `apps/web/src/components.test.ts:1072` "in a calendar window, takes no processed note and no launch chart from the list's answer": `renderToStaticMarkup` never lands the summary read, so it holds whatever the code does; green at `efdfc48` (tautology audit). Fix: delete it; `app.test.ts:619` covers the calendar window through the full render.
- `apps/web/src/app.test.ts:619` "in a calendar window, sits once with the summary, and not in the video list": nothing asserts "with the summary". Fix: add `expect(notes[0]?.closest('.metric-charts')).not.toBeNull()` after the note count.
- `apps/web/src/launch-chart.test.ts:57`: the name says "among the page's first 10" though its fixture has 3 rows. Fix: drop "among the page's first 10" from the name.
- `apps/web/src/launch-chart.test.ts:290`: after `toBe('Day 12, Engaged views 1,234')`, the loop `for (const other of [...]) expect(text).not.toContain(other)` cannot fail. Fix: delete the line.
- `apps/web/src/launch-chart.test.ts:110`, `:130`, `:393`: the first-10 positions rule is asserted through `launchChartOf` twice and through `launchPositionsOf` once. Fix: keep `:393` for the rule and one `launchChartOf` test that lines carry their positions; drop the positions line from `:110` or the test at `:130`.
- **New:** `apps/web/src/launch-chart.test.ts:401-403`: `expect([...positions]).toEqual([['a', 1], ...])` asserts the Map's insertion order, which no rule cares about. Fix: `expect(positions).toEqual(new Map([['a', 1], ...]))` (Vitest's Map equality ignores order).
- `apps/web/src/placeholder.test.ts:287-300`: `expect(total.indexOf('placeholder-note')).toBeGreaterThan(total.indexOf('placeholder-launch-total-note'))` passes when the launch total note is absent (`indexOf` is -1). Fix: delete the `total` half (`:289-293`, `:297-299`), keeping the daily assertions; or assert `toContain('placeholder-launch-total-note')` first.
- `apps/web/src/video-list.test.ts:905` repeats `:882` (`listRowsExpectedFor(null, page3, {})` is 25); `apps/web/src/placeholder.test.ts:238` restates the "another page" case of `video-list.test.ts` one layer up; the seeding helpers `answered` (`placeholder.test.ts:215`) and `remember` (`video-list.test.ts:875`) are one function. Fix: delete `:905`, delete `placeholder.test.ts:238`'s test, and keep one seeding helper per file only if finding 4 changes their signatures differently.

**Remediation brief**
- **Design intent:** a test builds only its input, observes only real output, states one rule and never asserts an exact class string or an order no rule cares about (CODING_STANDARDS 2).
- **Full surface:** the sites above.
- **Must preserve:** `app.test.ts:584-594` "give no row a swatch under %s, where no launch chart draws" (green at base by design, the proof of #191 review pass 1 finding 1, `72f88ba`); `app.test.ts:1925` (the page-size control for #325); `components.test.ts:900` (the 10-row boundary control for the 25-row cap test); every test's red at base.
- **Do not touch:** `components.test.ts:1148`, the summary's note under the metric charts (review 1 Dismissed); `placeholder.test.ts:302-311` (see Minor: the only test that tells the two total note shapes apart).
- **Proof:** `pnpm exec vitest run apps/web/src/components.test.ts apps/web/src/app.test.ts apps/web/src/launch-chart.test.ts apps/web/src/placeholder.test.ts apps/web/src/video-list.test.ts` green after; for the first item, in a scratch worktree remove `data-launch-position={line.position}` from the `<g>` at `apps/web/src/LaunchChart.tsx:243` and see the rewritten test go red.

### 7. A dead fallback in `markedBy` restates when a mark is live (carried from review 4 finding 7) — LOW
- **Location:** `apps/web/src/App.tsx:227-228`
- **Attribution:** introduced by #313 (`9eb3434`); untouched since.
- **Real-world trigger:** none for users; a walked-past refactor (CODING_STANDARDS 3).

**Evidence**
```ts
  const markedVideoId = markedVideoOf(mark, summaryPlaceList)
  const markedBy = markedVideoId === null ? null : (mark?.by ?? null)
```
**Failure mode** — when `markedVideoId` is not null, `mark` is not null, so `?.` and `?? null` are dead and "is the mark live" is decided twice.
**Recommended fix** — in `video-list.ts`, replace `markedVideoOf` with `liveMarkOf(mark, list): ListMark | null` (the same identity rule), then in `App.tsx`: `const liveMark = liveMarkOf(mark, summaryPlaceList)`, `const markedVideoId = liveMark?.videoId ?? null`, `const markedBy = liveMark?.by ?? null`.
**Remediation brief**
- **Design intent:** a mark is live only on the list it was made on; one function says so, and App derives both the marked video and its origin from it.
- **Full surface:** `apps/web/src/App.tsx:227-228`; `markedVideoOf` in `apps/web/src/video-list.ts` (`grep -n "markedVideoOf" apps/web/src/*.ts apps/web/src/*.tsx`) and its tests in `video-list.test.ts`.
- **Must preserve:** a mark made on another list (new page, sort, window, channel) is not live; the `markedVideoOf` tests' rules, renamed.
- **Do not touch:** `markVideoBy`'s stale `summaryPlaceList` capture (reviews 1 to 3 Dismissed).
- **Proof:** behaviour-preserving, no red step. `pnpm typecheck` and `pnpm exec vitest run apps/web/src/video-list.test.ts apps/web/src/app.test.ts` green.

### 8. The note place rule and its pin are repeated for each note shape (carried from review 4 finding 8) — LOW
- **Location:** `apps/web/src/app.css:1592-1597`, `:1628-1632`, `:1647-1651`; `apps/web/test/web.test.ts:674-746`
- **Attribution:** introduced by #314 (`3b7963d`) and #324 (`28c887d`).
- **Real-world trigger:** none for users; a duplicated rule (CODING_STANDARDS 3).

**Evidence** — `height: calc(var(--lines) * 0.9375rem * 1.6 + 1rem);` appears verbatim in `.placeholder-note, .placeholder-total-note`, `.placeholder-first-rows-note` and `.placeholder-launch-total-note`, and each has its own height pin in `web.test.ts`.
**Recommended fix** — remediate after finding 1, which adds bands to these rules. Fold the shared declarations into one selector list:
```diff
 .placeholder-note,
-.placeholder-total-note {
+.placeholder-total-note,
+.placeholder-first-rows-note,
+.placeholder-launch-total-note {
   --lines: 3;
   width: min(24rem, 100%);
   height: calc(var(--lines) * 0.9375rem * 1.6 + 1rem);
 }
```
then keep `.placeholder-first-rows-note { --lines: 2; width: min(22rem, 100%); }` after it, delete the two repeated blocks, and fold the height pins into one `test.each` over the four selectors.
**Remediation brief**
- **Design intent:** one rule sizes a note's place from its line count; each shape states only its line counts per width (and the first-10 note its narrower width).
- **Full surface:** `apps/web/src/app.css:1592-1597`, `:1628-1632`, `:1647-1651`; `apps/web/test/web.test.ts` height pins at `:674`, `:694`, `:736` and the first-10 note's.
- **Must preserve:** every `--lines` value at every width (including finding 1's bands); `.placeholder-first-rows-note`'s 22rem width; the order of the rules, so each media rule still follows the base rule it overrides.
- **Do not touch:** `.placeholder-first-rows-note`'s height (review 1 Dismissed).
- **Proof:** behaviour-preserving. `pnpm lint` and `pnpm exec vitest run apps/web/test/web.test.ts -t "placeholder"` green; `sh docs/reviews/creator-analytics-267/repro/review-5-finding-1.sh` still prints "MATCH" after finding 1; optionally mutate one breakpoint in a scratch worktree and see the folded pin go red.

### 9. Comment hygiene — LOW (aggregated)
- `apps/web/src/chart-hover.ts:151-152` (`emptied`) — "An already empty region keeps its announcement, the same object, so a pointer move over the plot costs no render." → "An already empty region keeps its announcement, the same object, so a pointer move changes no announcement state." (`pointTo` sets a new hover object on every move, so it renders anyway; the finder's Profiler counted one commit per move)
- `apps/web/src/chart-hover.test.ts:194` (test name) — "is the same announcement when the region is already empty, so the move costs no render" → "is the same announcement when the region is already empty"
- `apps/web/src/video-list.test.ts:8-9` — "they show how many placeholder rows the list holds and whether it holds the delay note's place" → "they show how many placeholder rows the list holds" (#175 moved the note out of the list)
- `apps/web/src/video-list.test.ts:11-16` — "Nor does any test run the wiring between the list and the launch chart ... Nick checks those at /app in a real browser." → "No test in this file runs the wiring between the list and the launch chart ...; `app.test.ts` drives it in happy-dom (the launch chart and its legend, the list), and Nick checks it at /app in a real browser."
- `apps/web/src/LaunchChart.tsx:138` — "A row hover, or the pointer leaving the row, replaces the chart's own selection." → "The chart shows its own selection only while the mark is the chart's, so a row hover hides it."
- `apps/web/src/LaunchChart.tsx:103-105` — "so a list row hover replaces it, and the pointer leaving the row clears both" → "so a list row hover replaces it, and the pointer leaving the row clears a mark the row made, never one the chart made"
- `apps/web/src/LaunchChart.tsx:107-108` and `:147-148` — "When a new page, sort or mode clears the chart's selection, the chart's mark on the list clears with it" / "A new page, sort or mode drops the held selection (`useLaunchSelection`); its mark goes with it" → "A new page or sort ends the chart's mark through the list it was made on (`markedVideoOf`); a mode change drops the held selection, and this effect ends its mark, so no accented line or marked row outlives the card." (once, at `:147`; the component doc keeps one clause)
- `apps/web/src/LaunchChart.tsx:76-77` — "The chart's mark on the list clears with it." → delete (the hook never touches the mark)
- `apps/web/src/VideoList.tsx:531` — "Once per page, the same positions the launch chart draws its lines in." → "For the whole page rather than per row, the same positions the launch chart draws its lines in."
- `apps/web/src/launch-chart.ts:58` — "Whether the page holds rows the launch chart does not draw, processed or not" → "Whether the page holds rows past the launch chart's first 10, processed or not"
- `apps/web/src/ChannelSummaryFigures.tsx:82-84` — "either with the processed note of the list's answer under it. While the list is read, their placeholder; for a refused or" → "each with the list answer's processed note last. While the list is read, their placeholder; for a refused or empty list", reflowed
- `apps/web/src/video-list.ts:281` — "marked when its video's line is selected on the launch chart" → "marked when the row is hovered or its video's line is selected on the launch chart"
- `apps/web/src/video-list.ts:107` — "/** The memo's key of the read `query` of `channelId`. */" → delete (restates the signature)
- `apps/web/src/Placeholder.tsx:146-148` — "So only a page the list has not answered on this page load, of 10 rows or fewer at a larger page size, holds the note's place, which never fills" → "So a page the list has not answered on this page load, of 10 rows or fewer at a larger page size, holds the note's place, which never fills; so does a page whose row count crossed 10 since its last answer"
- `apps/web/src/app.css:792-793` — "A rect's fill paints it, from its data-launch-position, as the token may be warm-hued." → "A rect's fill paints it, from its data-launch-position: a background naming a warm-hued token fails web.test.ts's cream background check."
- `apps/web/src/app.css:1020` — "The plot a chart's hover card sits over." → "The plot a chart's hover card is placed against: over it, or under it on the launch chart."
- `apps/web/src/app.css:1039` — "beside the line and inside the plot." → "beside the line and inside the plot's width."
- `apps/web/src/chart-hover.ts:85-86` (`cardLeftOf`) — "covers it rather than running off the chart and the page" → "covers it, or on the launch chart sits under it, rather than running off the chart and the page"
- `apps/web/src/app.css:1154-1155` — move "The card sits under the plot rather than over it, as with ten rows it is taller than the plot." from above `.launch-card-rows` to directly above `.launch-chart .chart-hover-card` (`:1162`), extended: "No z-index, so the sticky controls bar, earlier in the page at z-index 1, still covers it."
- `apps/web/src/app.css:1182` — "\"No data\" reads muted, as the list shows a missing value." → "\"No data\" reads muted and in the body's font, as the list shows a missing value."
- `apps/web/test/web.test.ts:699` — "(the one line width measured again in creator-analytics#324)" → delete the parenthetical (change narration)
- `apps/web/test/web.test.ts:708` (test name) — "holds two lines of the note on a phone and one from where the note fits one" → "holds two lines of the note below 386px wide and one from 386px"

## Needs Further Investigation
### A. The card's swatch may render square where the list's is rounded — confirm in the browser
Carried from reviews 1 to 4: `.launch-swatch`'s `border-radius` rounds a box, while the swatch is an SVG rect. Nick's browser walk settles it.
### B. On a phone, the card opens mostly below the fold and over the axis's day labels — confirm on a device
Carried. The disprove agent measured at 375px: the card runs from 576px to 800px, 148px clear of the video list's table; whether that reads as "below the fold" is a device check.
### C. A window after publish with an empty list shows the processed note nowhere — a decision for Nick
Carried from review 4. The launch chart and its note are not drawn for an empty list, and #175 took the note out of the list.

## Reviewed and Dismissed
- The launch day card's lower rows painting under the video list's table (`.video-list-scroll`, `position: relative; z-index: 0`, later in the page) — the paint order is real (a positive control with the table lifted 80px hid rows 8 to 10), but on the real channel screen the card ends at least 21px above the table at every width from 320 to 2560px, daily and running total, first7 and first28, because the axis, the delay note, the list's controls and its average-viewed note sit between them; the card is `pointer-events: none`, and the table head is not sticky. Unverified only for a browser minimum font size above 13px.
- `useChartHover`'s `pointTo` rendering on every pointer move — `show` did the same on the base; #343 asks only that the announcement state not change, which holds. The comment's overclaim is finding 9.
- Every pointer move re-rendering App through `markVideoBy`, and `onMark` being a new function on each App render so the #323 effect re-runs — on the base already (`markVideo` did the same); the effect is a no-op unless `markOutlivesSelection`; a performance nit outside this epic (review 4 Dismissed).
- The #323 effect's one painted frame with the old row accented after a mode change (finder suggested `useLayoutEffect`) — the line and row still name one video; the recorded #323 assumption (review 4 Dismissed).
- `delayNoteOf(list.answer.lastProcessedDay)` written in both branches of `AfterPublishPlace` (`ChannelSummaryFigures.tsx:117`, `:130`) — two call sites of one pure function, each passing it to a different component; not a duplicated rule.
- `components.test.ts:1166` building the expected note without `htmlOf` — the delay note holds no character React escapes, and the test is review 1's do-not-touch `:859` (now `:1148`) family; see Minor.
- The `components.test.ts` negative class checks in `expectNoPlot` (`chart-plot`, `chart-label`, `metric-charts-axis`, `metric-charts-modes`) — each class exists on the loaded chart (finder checked `LaunchChart.tsx` and `ChartModes.tsx:36`), so none is vacuous; static markup gives no other handle on "no plot".
- `video-list.test.ts:952`, `:962` green at `efdfc48` — call-shape edits by #344 (`key, 50` to `readOf(50)`); green at base because the base function took the object as `key`, which never matched. Not a tautology.
- `video-list.test.ts:928`, `:936`, `:945`, `:973`, `:983`, `:1042` red at base only through `videoListStateOf`'s new signature — behaviour unchanged, as their pre-#344 versions held; `:1042` is a control by design.
- The #344 memo tests sharing module-level memo state — each names its own channel (`c-344-*`), as the #325 tests do (review 4 Dismissed).
- From reviews 1 to 4, still standing (do not touch): the render-phase `selectionShown` block; `markVideoBy` capturing a stale `summaryPlaceList`; plot leave and row enter ordering; Escape with no shown selection a no-op; the card sort `(b ?? -1) - (a ?? -1)`; `components.test.ts:1148`; the hover-to-learn-each-line step; a hover on row 11 or later marking a row with no line; no `z-index` on the card; the card's ellipsis, nowrap rows, bold selected row and muted "No data" (#273 assumptions); `.placeholder-first-rows-note`'s height; the palette; a remembered empty answer leaving the chart's whole placeholder in place.

## Minor / nits
- `apps/web/src/placeholder.test.ts:302-311` asserts the class `placeholder-launch-total-note` and not `placeholder-total-note`: a class-string test, but the only one that tells the two total note shapes apart, as `placeholderParts` maps both to `'total note'`. Mapping `'launch-total-note'` to its own part name would let the parity tests carry the rule and this test go.
- `apps/web/src/app.test.ts:296`, `:300` take the expected "no point" text from `sliderTextOf(null)`; the literal `'No point selected'` would state it (finding 2's fix already does).
- `apps/web/src/LaunchChart.tsx:63` picks the "No data" style by comparing the shown string to `noDataLabel`; a `missing` flag on `LaunchDayCardRow` would carry it.
- `apps/web/src/LaunchChart.tsx:245` is 110 characters, the one line over 100 in the file (biome passes it).
- `.chart .launch-swatch` (`app.css:1189-1194`) restates `.launch-swatch`'s `display`, `width` and `height` only to beat `.chart svg`'s stretch; narrowing `.chart svg` to the plot's own SVG would leave `margin-inline-end: 0` as the only override.
- `apps/web/src/components.test.ts:1166` builds `` `<p class="note">${note}</p>` `` without `htmlOf`, where `:789` uses it; it would fail confusingly if the delay note ever gained an apostrophe.
- The ten `[data-launch-position]` rules and tokens are tied to `launchChartRows = 10` with no test linking them (carried from review 1).
- `.launch-card-row-selected { font-weight: 700 }` gives the mono number a synthesized bold; JetBrains Mono ships 400 and 500 only (carried from review 1).
- The publish day placeholder holds three bars against up to ten in the loaded top (`Placeholder.tsx`); pre-existing.
- `ChannelSummaryFigures.tsx:141-142` has a ragged reflow ("(`markedBy`). It / reads again"); hard wrapping is allowed in source.

## Test quality
Tests added or modified against `efdfc48`: 93 definitions, 115 runs (85 added, 30 modified). Red at base: 97 runs. Green at base: 18 runs from 14 definitions, all expected: `app.test.ts:584-594` (negative control, #191 review pass 1 finding 1's proof, `72f88ba`), `app.test.ts:619` (calendar window control; finding 6 strengthens it), `app.test.ts:1912` (#325's Back proof, green only because the note did not exist), `launch-chart.test.ts:57` (rename; finding 6), `launch-chart.test.ts:166` and `video-list.test.ts:1131`, `:1136` (fixture fields), `web.test.ts:665` (rename), `placeholder.test.ts:191-200` (the vacuous order check, finding 6), `components.test.ts:900` (boundary control for the 25-row cap, meaningful at HEAD), `components.test.ts:1072` (finding 6: delete), `components.test.ts:1148` (review 1 do-not-touch), `video-list.test.ts:952`, `:962` (call-shape edits, Dismissed). `components.test.ts` fails collection at base (`launchChartText.firstRowsNote` at `:872`), so the audit patched only its scratch copy to get per-test results; review 4 counted those 15 tests red. Since review 4: #343's `app.test.ts:1251`, `:1289` and `chart-hover.test.ts:187`, `:194`, and #344's `app.test.ts:1943` and `video-list.test.ts:998`, `:1007`, `:1016`, `:1023` are red at base and each goes red under a targeted mutation at HEAD (M1 `pointTo` without `emptied`; M2 `emptied` returning `last`; M3 `emptied` always copying; M4 no memo read; M5 memo key without the channel). Shapes: one self-comparison (`app.test.ts:392`, finding 2), one order check vacuous on absence (`placeholder.test.ts:297`, finding 6), one Map order assertion (`launch-chart.test.ts:401`, finding 6). No mocked unit under test (`app.test.ts:472` and the #343 tests stub only `getBoundingClientRect`, and say why), no call-shaped assertions, snapshots, assertion-free or copy tests.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and `pnpm test` are green at `f48b6a1`; `test:browser` does not exist yet (#361).
- **Commit hygiene:** commit this doc with `docs/reviews/creator-analytics-267/repro/review-5-finding-1-note-places.html` and `review-5-finding-1.sh` (both pass `pnpm lint`). The branch carries review docs 1 to 5 and their repros under `docs/reviews/`, as earlier rounds did.
- **Likely reviewer asks:** the palette in light and dark mode and the card at 375px and desktop (Nick's browser walk, NFI A and B); the empty-list note (NFI C); #311's wording, still open; why the note place widths need a sidebar band (finding 1).

## Verdict
Ready to open a PR as-is, with follow-ups. No gate: zero CRITICAL, HIGH or MEDIUM findings. Nine LOWs: finding 1 is the one user-visible defect (a one-line move on load at 768 to about 880px in running total mode, from the merge with main's sidebar); findings 2, 5 and 6 are test work; 3, 4, 7 and 8 refactors on lines this branch wrote; 9 comments. Of review 4's nine findings, 0 are fixed, 0 partially fixed, 9 untouched (carried here as findings 1 to 9, review 4 finding 4 folded into finding 1), and 0 were resolved only by a comment or doc edit.
