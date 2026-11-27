# Pre-PR review: creator-analytics#267 launch chart, one marked video, the processed note, the empty state and a color per video

**Branch:** `creator-analytics-267-launch-chart-color-per-video` vs `origin/main` (merge-base `1dc23c5`, "Merge pull request #321 from nick-vogel/creator-analytics-266-web-app-fixes")
**Reviewed at:** HEAD `748712d` (creator-analytics#325 Launch chart: predict the first-10 note from the rows the list last answered) + 0 files with uncommitted changes, 0 untracked files, 25 files total, +2634 / −185 (18 code and test files, 6 review files from rounds 1 to 3, 1 shared stylesheet)
**Delta under review:** none. A `--fresh` run: the whole working surface since the merge-base, which includes the third `/epic-loop` run's tickets #322 (`604e6ac`), #323 (`bfc0931`), #324 (`28c887d`) and #325 (`05d6fdb`) on top of review 3 (`37c5fc8`) and the origin/main merge (`909933f`).
**Reviewed against:** the epic creator-analytics#267 (its body is the spec), its sub-issues #181, #175, #176, #191, #273, #312, #313, #314 (closed) and #322, #323, #324, #325 (open, carried by this branch; #311 is open and not carried), `CODING_STANDARDS.md`, pre-PR reviews 1 to 3 in this folder, and `.epic-loop/tickets/322` to `325` (plans, assumptions, proposals, ticket reviews)
**Date:** 2026-10-22
**Reviewer:** 2 code-review agents + 1 tautology-audit agent + verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | clean, lockfile unchanged |
| Lint | `pnpm lint` (`biome check .`, repro files included) | green, 481 files |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` | green |
| Full suite | `pnpm test` (Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | green: 110 files, 2,544 passed, 1 expected fail (`packages/token-vault`, as in reviews 1 to 3) |
| Review 1 repro | `pnpm exec vitest run --config docs/reviews/creator-analytics-267/repro/review-1.vitest.config.ts` | green (review 1 finding 2 stays fixed) |
| Tautology audit, base | the 7 modified test files from HEAD in a scratch worktree at `1dc23c5` | 76 added or modified: 68 red (15 by `components.test.ts` failing collection), 8 green, all expected-green (see Test quality) |
| Tautology audit, review 3 | the test files changed since `37c5fc8` in a scratch worktree there | 31: 23 red, 8 green; the branch's own green ones are `app.test.ts:1852` (a control) and `placeholder.test.ts:286` (finding 6) |
| Mutation: the #323 effect deleted (`LaunchChart.tsx:151`) | finder, scratch worktree at HEAD, `app.test.ts` + `launch-chart.test.ts` | 1 red, the #323 test: it guards the effect |
| Mutation: `mode` dropped from `linesKey` (`LaunchChart.tsx:136`) | `docs/reviews/creator-analytics-267/repro/review-4-finding-1.sh` | 204 of 204 green across `app.test.ts`, `components.test.ts`, `launch-chart.test.ts` (finding 1) |
| Finding 1's recommended assertion | scratch worktree at HEAD with the diff in finding 1 applied | green at HEAD; red with `mode` dropped from `linesKey`; red with the #323 effect body removed |
| Mutation: `select()`'s live region clear deleted (`LaunchChart.tsx:177`) | finder, scratch worktree | 140 of 140 green (finding 2) |
| Mutations: `pointAt`'s clear (`:192`), the render-phase clear (`:145`) | finder, scratch worktree | each turns exactly its target test red (#322, #312) |
| Mutation: the card sort removed (`launch-chart.ts:330`) | finder, scratch worktree | `app.test.ts` 104 of 104 green; the unit tests catch it (finding 5) |
| #325 memo key, writer against reader | finder's node script against the real `video-list.ts`: watch-time sort with the column off, page 3, size 25, 7 rows remembered under the writer's query | `listRowsExpectedFor(address)` 25, `listRowsExpectedFor(listRoute)` 7 (finding 3) |
| `app.test.ts` order dependence on the rows memo | `--sequence.shuffle`, seeds 1, 2, 3 | 104 of 104 each time; not reproduced |
| #324 pins against `app.css` | finder read of every breakpoint against its pin; note lengths counted with node | all match (22.5625rem, 41.875rem, 23.375rem, 43.0625rem, 24.125rem); notes of 99, 93 and 49 characters, as the comments say |
| Palette | not re-checked: unchanged since review 3, where all 20 values matched | — |
| Browser walk (palette in light and dark, 375px, the card on a phone, the placeholder heights in a real browser) | not run: no browser in this review | Nick's walk, `.epic-loop/end-report.md` |

**Overall:** Every requirement in the epic's End state and in #322 to #325 is implemented, all four CI checks are green, and every new ticket's test is red before its fix. No MEDIUM or higher. Nine LOWs: one test that cannot see the regression its title names (#323's proof never checks the moment after Back), a dead live region clear, the #325 reader building the list's query by hand, a measurement comment that now contradicts its own paragraph, repeated CSS and pins, and the test and comment debt carried from reviews 1 and 3. The PR can open as-is.

## Approach decisions
- Mark origin (#181, #313): the shared mark carries `by: 'row' | 'chart'`, the chart shows its held selection only while the mark is the chart's, and a clear (`null`) from one origin ends only a mark of that origin. Landed in `App.tsx:224-230` (`markVideoBy`, a functional `setMark`). Precedent: `ListMark` in `apps/web/src/video-list.ts`.
- Live region (#312, #322): the render-phase `selectionShown` block in `LaunchChart.tsx:142-146` empties the live region whenever the shown selection ends; `pointAt` (`:192`) empties it when a pointer selection replaces a key step, since a pointer step writes no announcement. Finding 2 removes the third, dead copy in `select()`. Precedent: React's "adjusting state while rendering" pattern, the same block.
- The chart's mark outliving its selection (#323): an effect in `LaunchChart` (`:149-152`), before the empty-state return, calls `onMark(null)` while `markedBy === 'chart' && held === null`. Not a render-time parent `set` (React forbids it). Only a mode change reaches it: a new page or sort makes a new `SummaryPlaceList`, and `markedVideoOf` (`video-list.ts:268-270`) already ends a mark made on another list by identity.
- Launch chart day card placement (review 1 finding 1, `16a2433`): the card sits under the plot (`top: calc(100% + 0.25rem)`), scoped to `.launch-chart`, no z-index. Precedent: `.chart-hover-card` in `apps/web/src/app.css`.
- Placement guard (review 2 finding 1): filed as creator-analytics#316, not on this branch.
- Placeholder parity (#314, #324): every note the loaded launch chart shows under a predictable condition gets its own placeholder shape whose line counts are measured per width in headless Chrome and pinned in `apps/web/test/web.test.ts` through `valueIn(webOwnSheet(), …)`. The running total note has `.placeholder-launch-total-note` (#324). Precedent: `.placeholder-first-rows-note` at `apps/web/src/app.css:1628`.
- First-10 note prediction (#325): a module-level memo in `video-list.ts` (`answeredRows`, `:105`), keyed by channel and the list's read query, written by `VideoList` on each landed answer, read by `AfterPublishPlaceholder`; with no remembered answer, the page size. Precedent: `rememberSincePublishOf` and `rememberAwaitingProcessingOf`. Finding 3 makes the reader build its key with `listReadOf`, the writer's own builder.
- Review repro files: `biome check .` lints `docs/reviews/**/repro/`, so a repro must pass `pnpm lint` before it is committed. A shell repro is outside biome's file types.

## Prior-review closure
For information; this run is `--fresh`.
- Review 3: finding 1 (LOW, `select(null)`'s redundant clear) untouched, carried as finding 2; finding 2 (LOW, the App card test and the #181 test) untouched, carried as finding 5; finding 3 (LOW, tests that cannot fail) untouched, carried in finding 6; finding 4 (LOW, `markedBy` fallback) untouched, carried as finding 7; finding 5 (LOW, running total placeholder) fixed by #324 (`28c887d`); finding 6 (LOW, comment hygiene) untouched except where #322 to #325 rewrote the lines, carried in finding 9. NFI C (pointer selection after a key step) fixed by #322 (`604e6ac`).
- None was resolved only by a comment or doc edit.

## Confirmed Issues

### 1. The #323 proof test never checks the state right after Back, so a mode change that keeps the selection passes the whole suite — LOW
- **Location:** `apps/web/src/app.test.ts:352-397` (the self-comparison at `:389-397`, the Escape at `:392`)
- **Attribution:** introduced by `bfc0931` (creator-analytics#323 Launch chart: drop the chart's mark when a mode, page or sort change drops its selection); `git log -S"const halfState" 1dc23c5..HEAD` finds only that commit. The test is #323's issue body word for word. The gap it leaves (nothing pins that a mode change drops the held selection) is pre-existing: `mode` was already in `linesKey` at `1dc23c5` (`LaunchChart.tsx:65` there) with no test on it.
- **Real-world trigger:** none for users today; the code at HEAD drops the selection and its mark at Back. A future change to `linesKey` or `useLaunchSelection` that keeps the selection across a mode change would ship green: line A accented, row A marked and a card for a mode it was not made in. Test gap, LOW.

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
**Failure mode** — `halfState` sits on both sides, so nothing is asserted about the moment after Back. The Escape is a no-op at HEAD (`launchKeyStepOf('Escape', null, …)` returns `undefined`), but if the selection survived the mode change, that same Escape clears it and its mark, so `after` comes out empty either way. Executed: `sh docs/reviews/creator-analytics-267/repro/review-4-finding-1.sh` drops `mode` from `linesKey` in a scratch worktree, and `app.test.ts`, `components.test.ts` and `launch-chart.test.ts` stay 204 of 204 green ("GAP OPEN", exit 1). The test does guard the effect: with `onMark(null)` removed it goes red. Its title, "once the pointer leaves the row it rests on", also names the wrong moment: the clear happens at Back.
**Recommended fix**
```diff
-  test('clear the mark of a key selection a mode change by Back drops, once the pointer leaves the row it rests on', async () => {
+  test('clear the mark of a key selection when a mode change by Back drops it, and keep it clear when the pointer leaves the row it rests on', async () => {
@@
     expect(document.activeElement).toBe(plot)
-    const halfState = shown()
+    const cleared = { accented: [], marked: [], valueText: sliderTextOf(null), day: null }
+    expect(shown()).toEqual(cleared)
 
     await pointer(rowOf(container, 'Video B'), 'pointerout', document.body)
-    await press('Escape')
-    expect({ halfState, after: shown() }).toEqual({
-      halfState,
-      after: { accented: [], marked: [], valueText: sliderTextOf(null), day: null },
-    })
+    expect(shown()).toEqual(cleared)
```
Executed in a scratch worktree: green at HEAD; red with `mode` dropped from `linesKey` (`accented: ['A']`); red with the #323 effect's body removed.
**Remediation brief**
- **Design intent:** a mode change draws other lines, so `useLaunchSelection` (`LaunchChart.tsx:79-88`) drops the held selection, and the #323 effect (`:149-152`) then ends the chart's mark; at every moment the accented line, the marked row and the card name one video or none. The test proves both halves at the moment of Back, and that the row's leave afterwards changes nothing.
- **Full surface:** `apps/web/src/app.test.ts:352` (title) and `:389-397` only. `renderLaunchChart(start)` at `:309` and the local `shown` at `:358-371` stay (the local `shown` keys lines on `data-launch-position` so line identity survives the mode change).
- **Must preserve:** the test's first assertion after ArrowDown (`accented: ['A']`, `marked: ['Video A']`, `Day 1`) and the two checks after Back (the Daily button pressed, focus on the plot). The #313 test "keep a key selection made while the pointer rests on a row when the pointer leaves that row" (`:338`) and "keep a hovered row's mark when focus leaves the plot" unchanged.
- **Do not touch:** the effect itself and its one-render delay (Dismissed: the `useLayoutEffect` suggestion).
- **Proof:** red before green: `sh docs/reviews/creator-analytics-267/repro/review-4-finding-1.sh` prints "GAP OPEN" and exits 1 today; after the fix it prints "GAP CLOSED" and exits 0. Then `pnpm exec vitest run apps/web/src/app.test.ts` green.

### 2. The live region's clear is written three times, and the copy in `select()` does nothing — LOW
- **Location:** `apps/web/src/LaunchChart.tsx:177`, with `:145` and `:192`
- **Attribution:** `:177` is on the base and became redundant in `5586efc` (creator-analytics#312), carried from review 3 finding 1; `:192` introduced by `604e6ac` (creator-analytics#322) with a guard its siblings lack (#322 ticket review F1.3).
- **Real-world trigger:** none for users. CODING_STANDARDS 3: one rule in three places, one of them dead.

**Evidence**
```tsx
    if (selection === null) setAnnouncement((last) => ({ ...last, text: '' }))       // :145
  ...
    if (next === null) setAnnouncement((last) => ({ ...last, text: '' }))            // :177
  ...
    setAnnouncement((last) => (last.text === '' ? last : { ...last, text: '' }))      // :192
```
**Failure mode** — the text is non-empty only after a key step, which also selects, so any `select(null)` ends a shown selection and `:145` empties the text on the next render. Executed (finder, scratch worktree): with `:177` deleted, `app.test.ts` and `launch-chart.test.ts` stay 140 of 140 green; deleting `:145` or `:192` each turns its own test red.
**Recommended fix**
```diff
+const emptied = (last: Announcement): Announcement => (last.text === '' ? last : { ...last, text: '' })
@@
-    if (selection === null) setAnnouncement((last) => ({ ...last, text: '' }))
+    if (selection === null) setAnnouncement(emptied)
@@
     setSelection(next)
-    if (next === null) setAnnouncement((last) => ({ ...last, text: '' }))
     onMark(next === null ? null : (chart.lines[next.line]?.videoId ?? null))
@@
-    setAnnouncement((last) => (last.text === '' ? last : { ...last, text: '' }))
+    setAnnouncement(emptied)
```
`emptied` goes at module level in `LaunchChart.tsx` beside `LaunchDayCardContent`, or in `apps/web/src/chart-hover.ts` beside `silence` and `announcementAfter` if `Announcement` is imported from there.
**Remediation brief**
- **Design intent:** the live region speaks only for a selection the chart shows: a key step writes it, and it empties (keeping `step`, so the next key step remounts its span) when the shown selection ends or a pointer selection replaces a key step.
- **Full surface:** `apps/web/src/LaunchChart.tsx:145`, `:177`, `:192`. `onKeyDown` (`:196-205`) unchanged.
- **Must preserve:** `step` survives every clear; the guard in `:192` keeps the same state object on every pointer move once empty (no re-render per move). `app.test.ts` "empty the live region when a row hover replaces the chart's key selection" (#312), the #322 pointer test, "clear a selection the chart made on %s", and the live region tests in `launch-chart.test.ts`.
- **Do not touch:** the render-phase `setState` pattern (review 3 Dismissed).
- **Proof:** behaviour-preserving, no red step. `pnpm typecheck` and `pnpm exec vitest run apps/web/src/app.test.ts apps/web/src/launch-chart.test.ts` green.

### 3. The #325 placeholder builds the list's read query by hand and skips the list's route rewrite, and its tests share the blind spot — LOW
- **Location:** `apps/web/src/video-list.ts:121-130` (`listRowsExpectedFor`); test helpers `apps/web/src/placeholder.test.ts:214-216`, `apps/web/src/video-list.test.ts:870-872`
- **Attribution:** introduced by `05d6fdb` (creator-analytics#325); #325 ticket review F1.1.
- **Real-world trigger:** an address whose sort the list rewrites (a watch hours or revenue sort with its column off, a revenue sort without consent, a source sort with sources hidden): the writer (`VideoList.tsx:328`, `:378`) keys on `listReadOf(addressRoute, channel, saved).query`, which applies `listRouteFor`; the reader keys on the raw address. VideoList replaces the address with the list's route in an effect, so the keys disagree for one commit, and the placeholder then falls back to the page size (the pre-#325 behaviour). Layout only; LOW, and close to unreachable since the replaced history entry is what Back returns to.

**Evidence**
```ts
  const pageSize = pageSizeOf(route, saved)
  if (channelId === null) return pageSize
  const query = videoListQueryOf({ ...route, pageSize, visibility: visibilityOf(route, saved) })
  return answeredRows.get(answeredRowsKeyOf(channelId, query)) ?? pageSize
```
**Failure mode** — executed (finder's node script against the real module): `sort=estimatedMinutesWatched`, page 3, size 25, a channel with no revenue consent and the watch time column off; after remembering 7 rows under the writer's query, `listRowsExpectedFor(address)` returns 25 while the list's own route returns 7. Both test helpers seed with `listReadOf(route, null, {})`, whose `channel === null` branch skips `listRouteFor`, so they agree with the reader by construction. `listReadOf` lines `:586-588` and `listRowsExpectedFor` lines `:126-128` are two copies of one derivation (CODING_STANDARDS 3).
**Recommended fix** — give the reader the writer's channel and builder. `AfterPublishPlace` (`apps/web/src/ChannelSummaryFigures.tsx:109`) has only `channelId`; App has `channelOnView` (a `ListedChannel`). Pass the channel through:
```diff
-export function listRowsExpectedFor(
-  channelId: string | null,
-  route: Route,
-  saved: Preferences,
-): number {
-  const pageSize = pageSizeOf(route, saved)
-  if (channelId === null) return pageSize
-  const query = videoListQueryOf({ ...route, pageSize, visibility: visibilityOf(route, saved) })
-  return answeredRows.get(answeredRowsKeyOf(channelId, query)) ?? pageSize
-}
+export function listRowsExpectedFor(
+  channel: ListedChannel | null,
+  route: Route,
+  saved: Preferences,
+): number {
+  const { pageSize, query } = listReadOf(route, channel, saved)
+  if (channel === null) return pageSize
+  return answeredRows.get(answeredRowsKeyOf(channel.id, query)) ?? pageSize
+}
```
with `AfterPublishPlaceholder`'s prop changed from `channelId` to `channel: ListedChannel | null`, and `ChannelSummaryFigures` given the channel object (check what App passes it: `git grep -n "ChannelSummaryFigures" apps/web/src/App.tsx`). `listReadOf` is declared later in the same module; that is fine for a function call. Then seed the test helpers with the channel too, and add one case where `listRouteFor` rewrites the sort.
**Remediation brief**
- **Design intent:** the memo answers "how many rows did this exact list read answer on this page load"; the one function that says what the list reads for an address (`listReadOf`) must build both the key written and the key looked up.
- **Full surface:** `apps/web/src/video-list.ts:121-130`; `apps/web/src/Placeholder.tsx` (`AfterPublishPlaceholder`'s props and `:171`); `apps/web/src/ChannelSummaryFigures.tsx:109` and whatever passes it `channelId` from App; `apps/web/src/placeholder.test.ts:214-216` and `afterPublishPlaceholderOn`; `apps/web/src/video-list.test.ts:862-912`; `apps/web/src/app.test.ts:1825-1860` (uses the real wiring, check it still compiles).
- **Must preserve:** with no channel, the page size; with no remembered answer, the page size (`app.test.ts:1852`); the chart mode leaves the key the same (`video-list.test.ts` "the chart mode leaves the read the same"); a later answer replaces an earlier one; Back from a video opened from a short page holds no first-10 note place (`app.test.ts:1839`). The writer at `VideoList.tsx:378` unchanged.
- **Do not touch:** the module-level memo and its per-test channel ids (recorded #325 assumption; order dependence not reproduced under shuffle).
- **Proof:** red before green: a new `video-list.test.ts` case that remembers 7 rows under `listReadOf(watchTimeSortRoute, notConsented, {}).query` and expects `listRowsExpectedFor(notConsented, watchTimeSortRoute, {})` to be 7 (with `notConsented` as at `video-list.test.ts:1413`; it fails to typecheck or returns 25 today). Then `pnpm typecheck` and `pnpm exec vitest run apps/web/src/video-list.test.ts apps/web/src/placeholder.test.ts apps/web/src/app.test.ts` green.

### 4. The note places' preamble says every width below it is moved up by 1.5rem and not measured again, which the total note's paragraph now contradicts — LOW
- **Location:** `apps/web/src/app.css:1574-1579` against `:1585-1590`
- **Attribution:** introduced by `28c887d` (creator-analytics#324): the preamble is on the base, and #324 re-measured the total note's widths without the 1.5rem shift and said so in its own paragraph, leaving the preamble wrong for it. #324 ticket review F1.1.
- **Real-world trigger:** a maintainer re-measuring either note follows the preamble and adds 24px to the total note's widths, putting its place a line short again. Comment only, a wrong measurement rule; LOW.

**Evidence**
```css
   scrollbar, as on Windows, narrows the note and moves each width up by about its own 15px. Each
   width below is the measured one moved up by the 1.5rem the note's padding takes from its text
   (creator-analytics issue 119, W7), not measured again.
   ...
   2026-10-22 in headless Chrome with Switzer, the visual system's styles and this sheet, the note
   with its padding in the signed-in view's gutter, so the widths are the measured ones and not
   moved up, ...
```
**Failure mode** — two sentences in one comment give opposite rules for `.placeholder-total-note`'s widths.
**Recommended fix** — in the preamble, replace "Each width below is the measured one moved up by the 1.5rem the note's padding takes from its text (creator-analytics issue 119, W7), not measured again." with "The .placeholder-note widths are the measured ones moved up by the 1.5rem the note's padding takes from its text (creator-analytics issue 119, W7), not measured again." In the total note paragraph, drop the history clause "; the 1 line width was 660px, a line short to 669px (creator-analytics issue 324)" (CODING_STANDARDS 1, change narration), ending the sentence after "with no scrollbar taking width".
**Remediation brief**
- **Design intent:** each place's comment states how its widths were obtained, so the next measurement reproduces them.
- **Full surface:** `apps/web/src/app.css:1574-1590`. The `.placeholder-launch-total-note` comment above `:1647` and `.placeholder-first-rows-note`'s above `:1628` already say "measured in the gutter, not moved up"; leave them.
- **Must preserve:** every width and `--lines` value, and their pins in `apps/web/test/web.test.ts:674-737`.
- **Proof:** comment only. `pnpm lint` and `pnpm exec vitest run apps/web/test/web.test.ts -t "placeholder"` green.

### 5. The App card test cannot see the card's sort, and the launch chart's App tests copy their own setup — LOW
- **Location:** `apps/web/src/app.test.ts:530` (the card test), `:264-301` (the #181 test), the `liveRegion` copies at `:442`, `:464`, `:548`, the `press` copies at `:324`, `:536`
- **Attribution:** introduced: the card test by `244ae72` (#273), the #181 test by `2fb8a69`, `renderLaunchChart` by `9eb3434` (#313), the third `liveRegion` copy by `604e6ac` (#322). Carried from review 3 finding 2, plus #322 ticket review F1.1.
- **Real-world trigger:** none for users; a coverage claim the test does not hold (CODING_STANDARDS 2) and duplicated setup (CODING_STANDARDS 3).

**Evidence**
```ts
  test("list every drawn video in the card at the selected day, most first, ...", async () => {
    api.videos = [videoA, videoB, videoC]          // day 2: A 20, B 5, C no data, already list order
```
**Failure mode** — executed (finder): with the sort at `apps/web/src/launch-chart.ts:330` removed, `app.test.ts` stays 104 of 104 green; the unit tests in `launch-chart.test.ts` catch it. The #181 test rebuilds by hand the render, the plot lookup and the hover-to-learn-each-line steps that `renderLaunchChart()` does, and calls the value text `card`.
**Recommended fix** — in the card test, `api.videos = [videoA, { ...videoB, engagedViewsByDay: [90, 25, 60] }, videoC]` and expect the rows Video B (`'25'`, not selected), Video A (`'20'`, selected), Video C (`'No data'`), each swatch still from `swatchOf(container, …)`; the value text stays `'Video A'` and the live region `'Day 2, Engaged views 20'`. Rewrite the #181 test on `renderLaunchChart()` and its `press` and `shown`, keeping its three steps and its rule. Return `liveRegion` from `renderLaunchChart` and drop the copies at `:442` and `:464`; the card test at `:530` may move onto `renderLaunchChart` too if its three-video fixture is passed in, else keep its own `press` and `liveRegion`.
**Remediation brief**
- **Design intent:** the App test proves the card's wiring in the real app (every drawn video, its row's swatch, sorted by the day's number with the selected row flagged wherever it sorts); the sort's own rules stay in `launch-chart.test.ts`. One helper renders the launch chart for every App test of the mark.
- **Full surface:** `apps/web/src/app.test.ts:264-301`, `:309-336` (`renderLaunchChart`), `:442`, `:464`, `:530-560`. `git grep -n "videoB" apps/web/src/app.test.ts` before touching the shared `videoB`; the fix overrides it locally.
- **Must preserve:** the card test's swatch per row, the selected row's class, the value text and the live region reading the selected video only; the #181 rule (one video named at every step); the #312, #313, #322 and #323 tests' assertions.
- **Do not touch:** the hover-to-learn-each-line step (review 1 Dismissed).
- **Proof:** red before green: in a scratch worktree, delete the `rows.sort(…)` at `apps/web/src/launch-chart.ts:330`, then `pnpm exec vitest run apps/web/src/app.test.ts -t "list every drawn video in the card"` must go red with the new fixture (green today). Then `pnpm exec vitest run apps/web/src/app.test.ts` green.

### 6. Tests that cannot fail, assert class strings and production-computed paths, or repeat a rule (carried from reviews 1 and 3, plus #324 and #325) — LOW
- **Location:** per item below
- **Attribution:** introduced by `8307cc3`, `8b5216c`, `244ae72` (carried), `28c887d` (#324) and `05d6fdb` (#325).
- **Real-world trigger:** none for users; claims of coverage the suite does not have, and duplicates (CODING_STANDARDS 2).

Items, each its own small fix:
- `apps/web/src/components.test.ts:632-637` with `launchGroupsOf` at `:572`: the expected paths are `` `chart-line launch-chart-line ${lineA?.path}` `` from `launchChartOf`, an identity and an exact class string. Fix: have `launchGroupsOf` return per group its `data-launch-position`, its path count and whether it holds an end dot (`class` contains `launch-chart-end`), assert `[{ position: '2', paths: 1, endDot: false }, { position: '3', paths: 2, endDot: true }]`, and update the callers at `:595`, `:645`, `:646` (give `:646` a `selected` flag from `launch-chart-line-selected`) and `:720`.
- `apps/web/src/components.test.ts:783` "in a calendar window, takes no processed note and no launch chart from the list's answer": `renderToStaticMarkup` never lands the summary read, so it holds whatever the code does. Fix: delete it; `app.test.ts:616` covers the calendar window through the full render.
- `apps/web/src/app.test.ts:616` "in a calendar window, sits once with the summary, and not in the video list": nothing asserts "with the summary". Fix: add `expect(notes[0]?.closest('.metric-charts')).not.toBeNull()` before `:622`.
- `apps/web/src/launch-chart.test.ts:57`: the name says "among the page's first 10" though its fixture has 3 rows. Fix: drop "among the page's first 10" from the name.
- `apps/web/src/launch-chart.test.ts:290`: after `toBe('Day 12, Engaged views 1,234')`, the loop `for (const other of [...]) expect(text).not.toContain(other)` cannot fail. Fix: delete the line.
- `apps/web/src/launch-chart.test.ts:110`, `:130`, `:393`: the first-10 positions rule is asserted through `launchChartOf` twice and through `launchPositionsOf` (which `launchChartOf` is built on) once. Fix: keep `:393` for the rule and one `launchChartOf` test that lines carry their positions; drop the positions line from `:110` or the test at `:130`.
- `apps/web/src/placeholder.test.ts:296-298`: `expect(total.indexOf('placeholder-note')).toBeGreaterThan(total.indexOf('placeholder-launch-total-note'))` passes when the launch total note is absent (`indexOf` is -1); green at `37c5fc8` where the class did not exist. Presence is held by `:301-310`, and the order by the parity tests. Fix: delete the `total` half of the test (`:288-292`, `:296-298`), keeping the daily assertions; or assert `toContain('placeholder-launch-total-note')` first.
- `apps/web/src/video-list.test.ts:900` repeats `:877` (`listRowsExpectedFor(null, page3, {})` is 25); `apps/web/src/placeholder.test.ts:237` restates the "another page" case of `video-list.test.ts` one layer up; the seeding helpers `answered` (`placeholder.test.ts:214`) and `remember` (`video-list.test.ts:870`) are one function. Fix: delete `:900`, delete `placeholder.test.ts:237`'s test, and export one seeding helper from a test-support module or keep one per file only if finding 3 changes their signatures differently. #325 ticket review F1.3.

**Remediation brief**
- **Design intent:** a test builds only its input, observes only real output, states one rule and never asserts an exact class string (CODING_STANDARDS 2).
- **Full surface:** the sites above.
- **Must preserve:** `app.test.ts:581` "give no row a swatch under %s, where no launch chart draws" (green at base by design, the proof of #191 review pass 1 finding 1, `72f88ba`); `app.test.ts:1852` (a control for the page-size fallback); every test's red at base.
- **Do not touch:** `components.test.ts:859`, the summary's note under the metric charts (review 1 Dismissed); `placeholder.test.ts:301-310` (see Minor: the only test that tells the two total note shapes apart).
- **Proof:** `pnpm exec vitest run apps/web/src/components.test.ts apps/web/src/app.test.ts apps/web/src/launch-chart.test.ts apps/web/src/placeholder.test.ts apps/web/src/video-list.test.ts` green after; for the first item, in a scratch worktree remove `data-launch-position={line.position}` from the `<g>` at `apps/web/src/LaunchChart.tsx:243` and see the rewritten test go red.

### 7. A dead fallback in `markedBy` restates when a mark is live (carried from reviews 1 and 3) — LOW
- **Location:** `apps/web/src/App.tsx:225-226`
- **Attribution:** introduced by `2fb8a69` (creator-analytics#181); untouched since.
- **Real-world trigger:** none; CODING_STANDARDS 3.

**Evidence**
```ts
  const markedVideoId = markedVideoOf(mark, summaryPlaceList)
  const markedBy = markedVideoId === null ? null : (mark?.by ?? null)
```
**Failure mode** — when `markedVideoId` is non-null, `mark` is non-null, so `?.` and `?? null` never fire; App re-derives "is this mark live" a second time because TypeScript cannot narrow through `markedVideoOf`.
**Recommended fix** — in `apps/web/src/video-list.ts`, export `liveMarkOf(mark: ListMark | null, list: SummaryPlaceList): ListMark | null` with `markedVideoOf`'s body returning the mark, and make `markedVideoOf(mark, list)` return `liveMarkOf(mark, list)?.videoId ?? null`. In App:
```diff
-  const markedVideoId = markedVideoOf(mark, summaryPlaceList)
-  const markedBy = markedVideoId === null ? null : (mark?.by ?? null)
+  const liveMark = liveMarkOf(mark, summaryPlaceList)
+  const markedVideoId = liveMark?.videoId ?? null
+  const markedBy = liveMark?.by ?? null
```
**Remediation brief**
- **Design intent:** one function owns when a mark is live: only on the list it was made on. The #323 effect relies on it, since a page or sort change ends a chart mark through this identity check.
- **Full surface:** `apps/web/src/App.tsx:59` (import), `:225-226`; `apps/web/src/video-list.ts:268-270`; `apps/web/src/video-list.test.ts` "the video a mark marks" (`git grep -n "markedVideoOf" apps/web/src` lists every caller).
- **Must preserve:** `markedVideoOf`'s null on another list and while reading; `markVideoBy` at `App.tsx:227-230` unchanged.
- **Do not touch:** the `by` field (recorded #181 assumption).
- **Proof:** behaviour-preserving, no red step. `pnpm typecheck` and `pnpm exec vitest run apps/web/src/video-list.test.ts apps/web/src/app.test.ts` green.

### 8. The note place rule and its pin are repeated a further time for the launch total note — LOW
- **Location:** `apps/web/src/app.css:1647-1652`; `apps/web/test/web.test.ts:716-737`
- **Attribution:** introduced by `28c887d` (creator-analytics#324); #324 ticket review F1.4 and F1.5.
- **Real-world trigger:** none; CODING_STANDARDS 3 (a third copy of one rule) and 2 (one rule, one test).

**Evidence**
```css
.placeholder-launch-total-note {
  --lines: 3;
  width: min(24rem, 100%);
  height: calc(var(--lines) * 0.9375rem * 1.6 + 1rem);
}
```
equals the `.placeholder-note, .placeholder-total-note` group at `:1591-1596`; the pin at `web.test.ts:716-737` repeats the `.note` padding `'0.5rem 0.75rem'` and the height formula assertions of the pins at `:674` and `:696`, the fourth time.
**Failure mode** — a change to the shared formula must be made in three CSS blocks and four tests, and a missed one passes silently in its own pin.
**Recommended fix** — add `.placeholder-launch-total-note` to the selector list at `:1591-1592` and keep only its two `@media` blocks (`:1653-1663`) and its measurement comment. In `web.test.ts`, assert the `.note` padding once, and fold the total note, first-10 note and launch total note pins into one `test.each` over `[selector, base lines, [[media, lines], …]]`, each row asserting the shared height formula on its selector.
**Remediation brief**
- **Design intent:** every note place shares one height formula (lines of 0.9375rem text at line height 1.6, plus the 1rem padding); each differs only by its width and its measured line counts.
- **Full surface:** `apps/web/src/app.css:1591-1596`, `:1628-1633` (leave `.placeholder-first-rows-note` separate, its width differs), `:1647-1663`; `apps/web/test/web.test.ts:674-737`.
- **Must preserve:** every width, `--lines` value and media query, so the computed heights are unchanged; the pins' coverage of each selector.
- **Proof:** behaviour-preserving, no red step. `pnpm lint` and `pnpm exec vitest run apps/web/test/web.test.ts -t "placeholder"` green; optionally mutate one breakpoint in a scratch worktree and see the folded pin go red.

### 9. Comment hygiene — LOW (aggregated)
- `apps/web/src/LaunchChart.tsx:138` — "A row hover, or the pointer leaving the row, replaces the chart's own selection." → "The chart shows its own selection only while the mark is the chart's, so a row hover hides it."
- `apps/web/src/LaunchChart.tsx:103-105` — "so a list row hover replaces it, and the pointer leaving the row clears both" → "so a list row hover replaces it, and the pointer leaving the row clears a mark the row made, never one the chart made"
- `apps/web/src/LaunchChart.tsx:107-108` and `:147-148` — "When a new page, sort or mode clears the chart's selection, the chart's mark on the list clears with it" / "A new page, sort or mode drops the held selection (`useLaunchSelection`); its mark goes with it" → "A new page or sort ends the chart's mark through the list it was made on (`markedVideoOf`); a mode change drops the held selection, and this effect ends its mark, so no accented line or marked row outlives the card." (once, at `:147`; the component doc keeps one clause) (finder trace: a new answer is a new `SummaryPlaceList`, so the effect never sees a page or sort change)
- `apps/web/src/LaunchChart.tsx:76-77` — "The chart's mark on the list clears with it." → delete (the hook never touches the mark; #323 ticket review F1.2)
- `apps/web/src/VideoList.tsx:531` — "Once per page, the same positions the launch chart draws its lines in." → "For the whole page rather than per row, the same positions the launch chart draws its lines in."
- `apps/web/src/launch-chart.ts:58` — "Whether the page holds rows the launch chart does not draw, processed or not" → "Whether the page holds rows past the launch chart's first 10, processed or not"
- `apps/web/src/ChannelSummaryFigures.tsx:82-84` — "either with the processed note of the list's answer under it" → "each with the list answer's processed note last", reflowed; and "for a refused or" → "for a refused or empty list"
- `apps/web/src/video-list.ts:273` — "marked when its video's line is selected on the launch chart" → "marked when the row is hovered or its video's line is selected on the launch chart"
- `apps/web/src/video-list.ts:107` — "/** The memo's key of the read `query` of `channelId`. */" → delete (restates the signature; #325 ticket review F1.2)
- `apps/web/src/Placeholder.tsx:136-138` — "So only a page the list has not answered on this page load, of 10 rows or fewer at a larger page size, holds the note's place, which never fills" → "So a page the list has not answered on this page load, of 10 rows or fewer at a larger page size, holds the note's place, which never fills; so does a page whose row count crossed 10 since its last answer" (a new upload or visibility change can move a last page across 10)
- `apps/web/src/app.css:1020` — "The plot a chart's hover card sits over." → "The plot a chart's hover card is placed against: over it, or under it on the launch chart."
- `apps/web/src/app.css:1039` — "beside the line and inside the plot." → "beside the line and inside the plot's width."
- `apps/web/src/chart-hover.ts:85-86` (`cardLeftOf`) — "covers it rather than running off the chart and the page" → "covers it, or on the launch chart sits under it, rather than running off the chart and the page"
- `apps/web/src/app.css:1152-1155` — move "The card sits under the plot rather than over it, as with ten rows it is taller than the plot." from above `.launch-card-rows` to directly above `.launch-chart .chart-hover-card` (`:1162`), extended: "No z-index, so the sticky controls bar, earlier in the page at z-index 1, still covers it."
- `apps/web/test/web.test.ts:687-688` — "(the one line width measured again in creator-analytics#324)" → delete the parenthetical (change narration; #324 ticket review F1.2)
- `apps/web/test/web.test.ts:697` (test name) — "holds two lines of the note on a phone and one from where the note fits one" → "holds two lines of the note below 386px wide and one from 386px"

## Needs Further Investigation

### A. The card's swatch may render square where the list's is rounded — confirm in the browser
Carried from reviews 1 to 3. `.chart svg { overflow: visible }` (`apps/web/src/app.css:977-982`) also matches the card's swatch. Confirm in Nick's browser walk; fix, if wanted, with `overflow: hidden` on `.chart .launch-swatch`.

### B. On a phone, the card opens mostly below the fold and over the axis's day labels — confirm on a device
Carried from reviews 2 and 3, unchanged. Confirm or kill in Nick's 375px walk on a real phone.

### C. A window after publish with an empty list now shows the processed note nowhere — a decision for Nick
At `1dc23c5`, `VideoList` showed the note above its body whenever an answer landed in a window after publish (`listDelayNoteOf`, `VideoList.tsx:518` and `:544` there), including the empty list ("No live streams…" for a format with none). At HEAD the list shows it in no window (#175, as the spec says), and `AfterPublishPlace` renders nothing for `list.kind === 'none'` (`ChannelSummaryFigures.tsx:107`), so an empty list in `first7` or later has no note. The spec places the note "under the chart that takes the channel summary's place" and says nothing of a window with no chart. Confirm the drop is wanted (the note dates numbers that the page does not show), or keep the note in the place for an empty list.

## Reviewed and Dismissed
- The #323 effect looping — `onMark(null)` sets the mark to null when `last.by === 'chart'`, which makes `markedBy` null and the guard false; `onMark` is a new closure on each App render, so the effect re-runs, but as a no-op. StrictMode's double run is idempotent.
- The #323 effect clearing a row hover's mark — guarded on `markedBy === 'chart'`, and `markVideoBy`'s updater checks `last.by` when it runs (`App.tsx:227-230`).
- The #323 effect's one painted frame with the old row marked after a mode change (finder suggested `useLayoutEffect`) — the line and row still name one video (R7 holds); the one-render cost is the recorded #323 assumption.
- An unmounted `LaunchChart` keeping a chart mark — a window, channel or page change makes a new list, so the mark is orphaned by identity; a remount on the same list starts with `held` null and the effect clears it.
- A key that does not move the selection after a pointer selection announcing nothing (Home on day 1) — the existing no-move rule; the plot's value text still reads the selected video.
- Every pointer move re-rendering App through `markVideoBy` — on the base already (`markVideo` did the same); a performance nit outside this epic.
- A remembered empty answer leaving the whole chart's placeholder in place — R16 asks only about the first-10 note; an empty answer's shape jump is the recorded #314 assumption.
- The list's own row placeholder ignoring the #325 memo — out of #325's scope, already proposed in `.epic-loop/tickets/325/proposals.md`.
- `app.test.ts:1852` depending on module-level memo state — not reproduced under three shuffle seeds; the describe comment states the constraint, as the since publish memo's tests do.
- `#325`'s test helpers seeding with `listReadOf` — not a tautology: the writer uses the same builder, and the reader builds its key separately; the gap is finding 3.
- From reviews 1 to 3, still standing (do not touch): the render-phase `selectionShown` block; `markVideoBy` capturing a stale `summaryPlaceList`; plot leave and row enter ordering; Escape with no shown selection a no-op; the card sort `(b ?? -1) - (a ?? -1)`; `components.test.ts:859`; the hover-to-learn-each-line step; a hover on row 11 or later marking a row with no line; `z-index` on the card (paints over the sticky controls bar); the card's ellipsis, nowrap rows, bold selected row and muted "No data" (#273 assumptions); `.placeholder-first-rows-note`'s height; the palette.

## Minor / nits
- `apps/web/src/placeholder.test.ts:301-310` asserts the class `placeholder-launch-total-note` and not `placeholder-total-note`: a class-string test, but the only one that tells the two total note shapes apart, as `placeholderParts` maps both to `'total note'`. Mapping `'launch-total-note'` to its own part name would let the parity tests carry the rule and this test go.
- `apps/web/src/app.test.ts:296`, `:300` and the #323 test take the expected "no point" text from `sliderTextOf(null)`; the literal `'No point selected'` would state it.
- `apps/web/src/LaunchChart.tsx:63` picks the "No data" style by comparing the shown string to `noDataLabel`; a `missing` flag on `LaunchDayCardRow` would carry it.
- `apps/web/src/LaunchChart.tsx:245` is 110 characters, the one line over 100 in the file (biome passes it).
- The ten `[data-launch-position]` rules and tokens are tied to `launchChartRows = 10` with no test linking them (carried from review 1).
- `.launch-card-row-selected { font-weight: 700 }` gives the mono number a synthesized bold; JetBrains Mono ships 400 and 500 only (carried from review 1).
- The publish day placeholder holds three bars against up to ten in the loaded top (`Placeholder.tsx:147-156`); pre-existing.

## Test quality
Tests added or modified against `1dc23c5`: 76 instances. Red at base: 68 (15 of them because `components.test.ts` fails collection at `:583`, `launchChartText.firstRowsNote` not existing there). Green at base: 8, all expected: `app.test.ts:581` (negative control, #191 review pass 1 finding 1's proof, `72f88ba`), `app.test.ts:616` (calendar window control; finding 6 strengthens it), `app.test.ts:1839` (#325's Back proof, green at base only because the note did not exist; red at `37c5fc8`), `launch-chart.test.ts:57` (rename; finding 6 fixes the name), `launch-chart.test.ts:166`, `video-list.test.ts:1071` and `:1076` (fixture fields), `web.test.ts:645` (rename). Against `37c5fc8` (#322 to #325, plus main's #302 to #304 through the merge): 31 instances, 23 red, 8 green: `app.test.ts:1852` (#325's page-size control, a live guard by mutation), `placeholder.test.ts:286` (the vacuous order check, finding 6), and main's `retention.test.ts` and `thumbnail.test.ts` en-US and fr-FR controls. Shapes: one self-comparison (`app.test.ts:389`, finding 1), one order check vacuous on absence (`placeholder.test.ts:296`, finding 6), module-level memo state shared across a file (Dismissed). No mocked unit under test (`app.test.ts:472` stubs only `getBoundingClientRect`, and says why), no call-shaped assertions, snapshots, assertion-free or copy tests.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and the full suite are green at `748712d`.
- **Commit hygiene:** the tree is clean; this doc and `repro/review-4-finding-1.sh` are the only additions.
- **Likely reviewer asks:** the palette's 3:1 contrast, which no test holds (#315); the card placement guard (#316); #311's empty-state wording, still waiting on Nick and not carried; NFI C, the empty list's missing processed note; the browser walk in `.epic-loop/end-report.md`, unrun; the open #322 to #325 issues, whose work this branch carries.

## Verdict
Ready to open a PR as-is, with follow-ups. No gate: zero CRITICAL, HIGH or MEDIUM findings. Nine LOWs: findings 1, 5 and 6 are test work, 2, 3, 7 and 8 refactors on lines this branch wrote, 4 and 9 comments. Of review 3's six findings, 1 is fixed (finding 5, by #324), 0 partially fixed, 5 untouched (carried here as findings 2, 5, 6, 7 and 9), and 0 were resolved only by a comment or doc edit; review 3's NFI C is fixed by #322.
