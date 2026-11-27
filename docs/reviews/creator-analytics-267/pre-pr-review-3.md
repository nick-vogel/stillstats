# Pre-PR review: creator-analytics#267 launch chart, one marked video, the processed note, the empty state and a color per video

**Branch:** `creator-analytics-267-launch-chart-color-per-video` vs `origin/main` (merge-base `b10c8d4`, "Merge pull request #309 from nick-vogel/creator-analytics-253-marketing-site-seo")
**Reviewed at:** HEAD `26e7a07` (creator-analytics#314 Launch chart: the loading placeholder matches the loaded chart's shape) + 0 files with uncommitted changes, 0 untracked files, 24 files total, +2022 / −173 (18 code and test files, 5 review files from rounds 1 and 2, 1 shared stylesheet)
**Delta under review:** none. A `--fresh` run: the whole working surface since the merge-base, which includes the second `/epic-loop` run's tickets #312 (`5586efc`, `e0c14e3`), #313 (`9eb3434`, `6c886b6`) and #314 (`3b7963d`, `808005a`, `26e7a07`) on top of review 2 (`e555263`).
**Reviewed against:** the epic creator-analytics#267 (its body is the spec), its sub-issues #181, #175, #176, #191, #273 (closed) and #312, #313, #314 (open, carried by this branch; #311 is open and not carried), `CODING_STANDARDS.md`, pre-PR reviews 1 and 2 in this folder, and `.epic-loop/tickets/312`, `313`, `314` (assumptions and proposals)
**Date:** 2026-10-21
**Reviewer:** 2 code-review agents + 1 tautology-audit agent + verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | clean, lockfile unchanged |
| Lint | `pnpm lint` (`biome check .`, repro files included) | green, 483 files |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` | green |
| Full suite | `pnpm test` (Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | green: 110 files, 2,511 passed, 1 expected fail (`packages/token-vault`, as in reviews 1 and 2) |
| Review 1 repro | `pnpm exec vitest run --config docs/reviews/creator-analytics-267/repro/review-1.vitest.config.ts` | green: review 1 finding 2 is fixed by #313 |
| Tautology audit, base | the 7 modified test files from HEAD copied into a scratch worktree at `b10c8d4` | 46 red, 392 green; 12 instances (8 declarations) green at base, all expected-green (see Test quality) |
| Red before green, #312 to #314 | the 3 changed test files from HEAD copied into a scratch worktree at `e555263` | every test aimed at a #312, #313 or #314 bug is red there; the green ones are controls |
| Live region rule duplicated (finding 1) | scratch worktree at HEAD with `LaunchChart.tsx:168` deleted; `pnpm exec vitest run apps/web/src/app.test.ts apps/web/src/components.test.ts apps/web/src/launch-chart.test.ts apps/web/src/placeholder.test.ts` | 218 of 218 green: the line carries no behaviour |
| Card sort seen by the App test (finding 2) | scratch worktree at HEAD with the sort at `launch-chart.ts:330` deleted; the App card test alone, then `launch-chart.test.ts` | App test green; 5 `launch-chart.test.ts` tests red |
| First-10 note placeholder height | finder's headless Chrome sweep, 360 to 460px and spot widths to 840px, Switzer loaded, the real signed-in nesting | matches the loaded note at every width (2 lines below 386px, 1 from 386px) |
| Running total note placeholder height (finding 5) | the same sweep, and the #314 run's own measurement in `.epic-loop/tickets/314/proposals.md` | a line short at 361 to 373px and from 660px to about 688px |
| Palette | the 20 values in `packages/visual-system/src/styles.css:58-99` against the epic's table | all match; dark values in the existing `prefers-color-scheme: dark` block |
| Mark, selection and live region sequences | finder trace of hover, key, blur, Escape and pointer orders against `App.tsx:209-213` and `LaunchChart.tsx:134-194` | no sequence names two videos, see Dismissed |
| Browser walk (palette in light and dark, 375px, the card on a phone) | not run: no browser walk in this review | Nick's walk, `.epic-loop/end-report.md` |

**Overall:** Every requirement in the epic's End state and in #312, #313 and #314 is implemented, all four CI checks are green, and the three new tickets' tests are red before their fixes. Review 1's findings 1 to 3 are fixed. No MEDIUM or higher. Six LOWs: one now-redundant line that #312 left behind, an App test whose title claims a sort it cannot see, the review 1 test and fallback LOWs still open, a running total placeholder sized for the summary's shorter note (on the base already, and proposed in the #314 run), and comment hygiene. The PR can open as-is.

## Approach decisions
- Mark origin (#181, #313): the shared mark carries `by: 'row' | 'chart'`, the chart shows its held selection only while the mark is the chart's, and a clear (`null`) from one origin ends only a mark of that origin. Landed in `App.tsx:209-213` (`markVideoBy`, a functional `setMark`). Precedent: `ListMark` in `apps/web/src/video-list.ts`.
- Live region (#312, this review's finding 1): the render-phase `selectionShown` block in `LaunchChart.tsx:137-143` is the one place that empties the live region, whenever the shown selection ends, a row hover, Escape, a blur, the pointer leaving the plot and new lines included. Precedent: React's "adjusting state while rendering" pattern, the same block.
- Launch chart day card placement (review 1 finding 1, `16a2433`): the card sits under the plot (`top: calc(100% + 0.25rem)`), scoped to `.launch-chart`, no z-index. Precedent: `.chart-hover-card` in `apps/web/src/app.css`.
- Placement guard (review 2 finding 1): filed as creator-analytics#316, not on this branch.
- Placeholder parity (review 1 finding 3, #314): every note the loaded launch chart shows under a predictable condition gets its own placeholder shape whose line counts are measured per width in headless Chrome and pinned in `apps/web/test/web.test.ts` through `valueIn(webOwnSheet(), …)`. The first-10 note's place follows the page size alone (`pageSizeOf(route, saved) > launchChartRows`), and the empty answer's shape jump is accepted and named by a test (#314 assumptions). Finding 5 follows this decision for the running total note. Precedent: `.placeholder-first-rows-note` at `apps/web/src/app.css:1618-1634` and its pin at `apps/web/test/web.test.ts:696-714`.
- Review repro files: `biome check .` lints `docs/reviews/**/repro/`, so a repro must pass `pnpm lint` before it is committed. Precedent: the lint-clean repros in this folder.

## Prior-review closure
For information; this run is `--fresh`, round 1 of the second `/epic-loop` run.
- Review 1: finding 1 (MEDIUM) fixed in `16a2433`; finding 2 (LOW) fixed by #313 (`9eb3434`, `6c886b6`), its repro now green; finding 3 (LOW) fixed by #314 (`3b7963d`, `808005a`, `26e7a07`) within its declared drop; findings 4, 5 and 6 (LOW) untouched, carried here as findings 3, 4 and 6.
- Review 2: finding 1 (LOW) untouched, filed as #316; finding 2 (LOW, comment hygiene) untouched, carried in finding 6.
- None was resolved only by a comment or doc edit.

## Confirmed Issues

### 1. Since #312, `select(null)`'s own live region clear repeats the new rule and does nothing — LOW
- **Location:** `apps/web/src/LaunchChart.tsx:168`
- **Attribution:** introduced by `5586efc` (creator-analytics#312 Launch chart: empty the live region when a row hover replaces the selection), which added the block at `:137-143` and left this line, already on the base (`git log -S'if (next === null) setAnnouncement' b10c8d4..HEAD` finds no commit), redundant beside it.
- **Real-world trigger:** none for users. CODING_STANDARDS 3: a walked-past refactor in the function the change edited, with two places now stating one rule.

**Evidence**
```tsx
  const [selectionShown, setSelectionShown] = useState(false)
  if (selectionShown !== (selection !== null)) {
    setSelectionShown(selection !== null)
    if (selection === null) setAnnouncement((last) => ({ ...last, text: '' }))
  }
  ...
  function select(next: LaunchSelection) {
    setSelection(next)
    if (next === null) setAnnouncement((last) => ({ ...last, text: '' }))
```
**Failure mode** — the announcement only gets text in `onKeyDown`, right after `select(step.selection)` with a non-null selection, which makes the chart's mark and so a shown selection. Any later `select(null)` ends that shown selection, and the block empties the text on the next render. Executed: with `:168` deleted, `pnpm exec vitest run apps/web/src/app.test.ts apps/web/src/components.test.ts apps/web/src/launch-chart.test.ts apps/web/src/placeholder.test.ts` stays 218 of 218 green, the Escape, pointer-leave and blur clears and the #312 test included.
**Recommended fix**
```diff
   function select(next: LaunchSelection) {
     setSelection(next)
-    if (next === null) setAnnouncement((last) => ({ ...last, text: '' }))
     onMark(next === null ? null : (chart.lines[next.line]?.videoId ?? null))
   }
```
**Remediation brief**
- **Design intent:** the live region speaks only for a selection the chart shows. One rule, one place: the render-phase block empties the text (keeping `step`) whenever the shown selection (`markedBy === 'chart' ? held : null`) turns null, however it ended; a key step writes it.
- **Full surface:** `apps/web/src/LaunchChart.tsx:168` only. The block at `:137-143` and `onKeyDown` at `:184-194` stay as they are.
- **Must preserve:** the live region empties on Escape, on blur, on the pointer leaving the plot, and on a row hover, and a key step after any of them announces again: `apps/web/src/app.test.ts` "empty the live region when a row hover replaces the chart's key selection" and "clear a selection the chart made on %s", and the live region tests in `apps/web/src/launch-chart.test.ts`. The `step` counter survives the clear, so the next announcement still remounts its span.
- **Do not touch:** the render-phase `setState` pattern itself (Dismissed).
- **Proof:** behaviour-preserving, no red step. `pnpm typecheck` and `pnpm exec vitest run apps/web/src/app.test.ts apps/web/src/launch-chart.test.ts` green after.

### 2. The App card test cannot see the card's sort, and the #181 test repeats the helper #313 added beside it — LOW
- **Location:** `apps/web/src/app.test.ts:448` (the card test) and `apps/web/src/app.test.ts:264-301` (the #181 test)
- **Attribution:** introduced. The card test by `244ae72` (creator-analytics#273 Launch chart: the hover card lists every drawn video); the #181 test by `2fb8a69`, with `renderLaunchChart` (`:308`) added by `9eb3434` (creator-analytics#313 …) without moving the older test onto it.
- **Real-world trigger:** none for users; a coverage claim the test does not hold (CODING_STANDARDS 2) and a duplicate setup (CODING_STANDARDS 3).

**Evidence**
```ts
  test("list every drawn video in the card at the selected day, most first, ...", async () => {
    api.videos = [videoA, videoB, videoC]          // day 2: A 20, B 5, C no data, already in list order
    ...
    await press('ArrowDown')
    await press('ArrowRight')
```
```ts
    const shown = () => ({
      accented: ...,
      marked: markedTitles(container),
      card: plot.getAttribute('aria-valuetext'),   // app.test.ts:284, the value text, not the card
    })
```
**Failure mode** — at day 2 the fixture's values already fall in list order, so the card's expected order equals the list's. Executed: with the sort at `apps/web/src/launch-chart.ts:330` deleted, the App card test stays green while five `launch-chart.test.ts` tests go red. The sort is covered at unit level; the App test's "most first" is not. Separately, the #181 test at `:264` builds by hand the render, the plot lookup and the hover-to-learn-each-line steps that `renderLaunchChart()` at `:308` now does, and it labels the value text `card`, which the newer tests call `valueText`.
**Recommended fix**
```diff
   test("list every drawn video in the card at the selected day, most first, ...", async () => {
     const api = installFakeApi()
-    api.videos = [videoA, videoB, videoC]
+    api.videos = [videoA, { ...videoB, engagedViewsByDay: [90, 25, 60] }, videoC]
```
then expect the rows in the order Video B (`'25'`, `selected: false`), Video A (`'20'`, `selected: true`), Video C (`'No data'`), each `swatch` still from `swatchOf(container, …)`. The value text stays `'Video A'` and the live region `'Day 2, Engaged views 20'` (its assertion at `:486`, unchanged). For `:264-301`, rewrite the test on `renderLaunchChart()` and its `press` and `shown`, which read `valueText` and `day`, keeping its three steps (ArrowDown, hover row B, leave row B) and its rule.
**Remediation brief**
- **Design intent:** the App test proves the card's wiring in the real app: every drawn video, each with its list row's swatch, sorted by the day's number with the selected row flagged wherever it sorts. The sort's own rules (ties in list order, "No data" last, running total order) stay in `launch-chart.test.ts`.
- **Full surface:** `apps/web/src/app.test.ts:448-490` (the card test, its fixture and its expected rows), `apps/web/src/app.test.ts:264-301` (the #181 test), `renderLaunchChart` at `:308-336` (used, not changed). Check `git grep -n "videoB" apps/web/src/app.test.ts` before changing the shared `videoB`; the recommended fix overrides it locally instead.
- **Must preserve:** the card test's assertions on the swatch per row, the selected row's class, the value text and the live region reading the selected video only. The #181 test's rule: after a key selection, a row hover and the row's leave, the accented line and the marked row name one video at every step. The #313 tests at `:337-391` and the #312 test at `:393-411` unchanged.
- **Do not touch:** the hover-to-learn-each-line step (review 1 Dismissed: the ArrowDown step, which selects line 0 by index, exposes a swapped mapping).
- **Proof:** red before green: in a scratch copy, delete `rows.sort(…)` at `apps/web/src/launch-chart.ts:330`, then `pnpm exec vitest run apps/web/src/app.test.ts -t "list every drawn video in the card"` must go red with the new fixture (it is green today); restore, and `pnpm exec vitest run apps/web/src/app.test.ts` green.

### 3. Tests that cannot fail, or assert class strings and production-computed paths (carried from review 1 finding 4) — LOW
- **Location:** per item below
- **Attribution:** introduced by `8307cc3`, `8b5216c` and `244ae72`; untouched by the second run.
- **Real-world trigger:** none for users; claims of coverage the suite does not have (CODING_STANDARDS 2).

Items, each its own small fix:
- `apps/web/src/components.test.ts:622-638` with the helper `launchGroupsOf` at `:572`: `const [lineA, lineB] = launchChartOf(answer.videos, 'first28', 'daily').lines`, then `` `chart-line launch-chart-line ${lineA?.path}` ``, so the paths are an identity and the class strings exact. Fix: have `launchGroupsOf` return, per group, its `data-launch-position`, its path count and whether it holds an end dot (`class` contains `launch-chart-end`), and assert `[{ position: '2', paths: 1, endDot: false }, { position: '3', paths: 2, endDot: true }]`. Keep the `not.toMatch(/<(g|path)[^>]* style=/)` line. Update the other `launchGroupsOf` callers at `:595`, `:645` and `:646` to the new shape (`:646` reads `paths[0]`; give it a `selected` flag from `launch-chart-line-selected` instead).
- `apps/web/src/components.test.ts:783` "in a calendar window, takes no processed note and no launch chart from the list's answer": `renderToStaticMarkup` never lands the summary read, so in a calendar window the markup can only be the summary's placeholder and `not.toContain(processedNote)` holds whatever the code does. Fix: delete it; `apps/web/src/app.test.ts:534` covers calendar-window placement through the full render.
- `apps/web/src/app.test.ts:534` "in a calendar window, sits once with the summary, and not in the video list": nothing asserts "with the summary". Fix: add `expect(notes[0]?.closest('.metric-charts')).not.toBeNull()` before the existing absence line.
- `apps/web/src/launch-chart.test.ts:57`: the name says "among the page's first 10" though its fixture has 3 rows (the 10-row rule is tested at `:110`). Fix: drop "among the page's first 10" from the name.
- `apps/web/src/launch-chart.test.ts:290`: after `expect(text).toBe('Day 12, Engaged views 1,234')`, the loop `for (const other of ['Title b', 'Title d', '5,678', '7']) expect(text).not.toContain(other)` cannot fail. Fix: delete the line.

**Remediation brief**
- **Design intent:** a test builds only its input, observes only real output, states one rule and never asserts an exact class string (CODING_STANDARDS 2).
- **Full surface:** the sites above.
- **Must preserve:** `apps/web/src/app.test.ts:499` "give no row a swatch under %s, where no launch chart draws", green at base by design as the proof of #191 review pass 1 finding 1 (`72f88ba`); every test's red at base (the components.test.ts items keep theirs through the positions).
- **Do not touch:** `apps/web/src/components.test.ts:859`, the summary's note under the metric charts (review 1 Dismissed: R9's guard on the calendar window).
- **Proof:** `pnpm exec vitest run apps/web/src/components.test.ts apps/web/src/app.test.ts apps/web/src/launch-chart.test.ts` green after; for the first item, in a scratch copy remove `data-launch-position={line.position}` from the `<g>` at `apps/web/src/LaunchChart.tsx:232` and see the rewritten test go red.

### 4. A dead fallback in `markedBy` restates when a mark is live (carried from review 1 finding 5) — LOW
- **Location:** `apps/web/src/App.tsx:208-209`
- **Attribution:** introduced by `2fb8a69` (creator-analytics#181 Keep one marked video between a launch chart key selection and a list row hover); untouched by #313, which edited the next line.
- **Real-world trigger:** none; CODING_STANDARDS 3.

**Evidence**
```ts
  const markedVideoId = markedVideoOf(mark, summaryPlaceList)
  const markedBy = markedVideoId === null ? null : (mark?.by ?? null)
```
**Failure mode** — when `markedVideoId` is non-null, `mark` is non-null, so `?.` and `?? null` never fire; they exist because TypeScript cannot narrow through `markedVideoOf`, and App re-derives "is this mark live" a second time.
**Recommended fix** — in `apps/web/src/video-list.ts`, export `liveMarkOf(mark: ListMark | null, list: SummaryPlaceList): ListMark | null` with `markedVideoOf`'s body returning the mark, and keep `markedVideoOf(mark, list)` as `liveMarkOf(mark, list)?.videoId ?? null` while its tests use it. In App:
```diff
-  const markedVideoId = markedVideoOf(mark, summaryPlaceList)
-  const markedBy = markedVideoId === null ? null : (mark?.by ?? null)
+  const liveMark = liveMarkOf(mark, summaryPlaceList)
+  const markedVideoId = liveMark?.videoId ?? null
+  const markedBy = liveMark?.by ?? null
```
**Remediation brief**
- **Design intent:** one function owns when a mark is live: only on the list it was made on.
- **Full surface:** `apps/web/src/App.tsx:59` (import), `:208-209`; `apps/web/src/video-list.ts:239` (`markedVideoOf`); `apps/web/src/video-list.test.ts:1015-1028` ("the video a mark marks"). `git grep -n markedVideoOf` lists no other caller.
- **Must preserve:** `markedVideoOf`'s null on another list and while reading (both `video-list.test.ts` cases); `markVideoBy` at `App.tsx:210-213` unchanged.
- **Do not touch:** the `by` field (recorded #181 assumption).
- **Proof:** behaviour-preserving, no red step. `pnpm typecheck` and `pnpm exec vitest run apps/web/src/video-list.test.ts apps/web/src/app.test.ts` green.

### 5. The launch chart's running total placeholder is sized for the summary's shorter note, so the page moves a line at two width bands — LOW
- **Location:** `apps/web/src/Placeholder.tsx:168`, with `.placeholder-total-note` at `apps/web/src/app.css:1585-1611`
- **Attribution:** pre-existing, untouched. At `b10c8d4`, `AfterPublishPlaceholder` already rendered `<Placeholder shape="total-note" />` (`git show b10c8d4:apps/web/src/Placeholder.tsx`, line 154) and `launchChartText.runningTotalNote` was already the 99-character sentence. Already proposed by the #314 run in `.epic-loop/tickets/314/proposals.md` ("Size the launch chart's running total note place for its own, longer note").
- **Real-world trigger:** a creator in "Running total" mode opens a window after publish on a phone 361 to 373px wide, or a window 660 to about 688px wide: the note lands one line taller than its place and everything under the chart moves down 24px. Layout only; LOW.

**Evidence**
```css
   .placeholder-total-note holds the 92 character running total note under the charts: 3
   lines below 361px, 2 from 361px (22.5625rem) and 1 from 660px (41.25rem). */
```
```ts
  runningTotalNote:
    'The running total adds the daily numbers, so its last point can differ from the totals in the list.',
```
**Failure mode** — the place is measured for the summary charts' "…differ from the totals above." (`apps/web/src/metric-charts.ts:26`); the launch chart shows "…differ from the totals in the list." (99 characters). Measured in headless Chrome with Switzer in the signed-in view (finder sweep, and independently by the #314 run): the launch note takes 3 lines below 374px, 2 from 374px and 1 from about 689px, against the place's 361px and 660px, so the place is a line short at 361 to 373px and at 660 to about 688px. The #314 run also measured the summary note's one-line width at 670px, not 660px, so the summary's own place may be a line short at 660 to 669px; confirm that while measuring.
**Recommended fix** — a `launch-total-note` shape for the launch chart, as the first-10 note got its own:
```diff
   | 'first-rows-note'
   | 'not-processed'
   | 'total-note'
+  | 'launch-total-note'
```
```diff
-      {chartModeOf(route, saved) === 'aggregate' && <Placeholder shape="total-note" />}
+      {chartModeOf(route, saved) === 'aggregate' && <Placeholder shape="launch-total-note" />}
```
and in `apps/web/src/app.css`, a `.placeholder-launch-total-note` rule beside `.placeholder-first-rows-note`, with the `.placeholder-note` height formula and `--lines` 3, then 2 from the measured 2-line width, then 1 from the measured 1-line width (expected near 23.375rem and 43.0625rem; measure them, do not copy these), with a comment giving the measurement the way `:1618-1623` does. Pin it in `apps/web/test/web.test.ts` beside `:674-692` and `:696-714`. In `apps/web/src/placeholder.test.ts`, map the new shape in `placeholderParts` (`:135`) to `'total note'` so the parity tests keep passing.
**Remediation brief**
- **Design intent:** each note the loaded launch chart shows under a predictable condition gets its own placeholder shape whose line counts are measured per width (Approach decisions, placeholder parity).
- **Full surface:** `apps/web/src/Placeholder.tsx:14-31` (the shape union) and `:168`; the `Placeholder` component's class mapping, if it lists shapes (`grep -n "placeholder-" apps/web/src/Placeholder.tsx`); `apps/web/src/app.css` beside `:1618-1634`; `apps/web/test/web.test.ts` beside `:696-714`; `apps/web/src/placeholder.test.ts:135-143`.
- **Must preserve:** `MetricChartsPlaceholder`'s `total-note` at `apps/web/src/Placeholder.tsx:107` and its pin at `apps/web/test/web.test.ts:674-692`, unchanged; the parity tests at `apps/web/src/placeholder.test.ts:172-229`.
- **Do not touch:** `.placeholder-first-rows-note`, re-measured in this review and correct.
- **Proof:** measure in headless Chrome as `apps/web/src/app.css:1618-1623` describes (Switzer, the visual system's styles and this sheet, the note in the signed-in view's gutter, no scrollbar), the loaded note's height against `.placeholder-launch-total-note`'s at 360, 373, 374, 659, 660, 688, 689 and 700px: unequal today at 361 to 373 and 660 to 688, equal after. Then `pnpm exec vitest run apps/web/test/web.test.ts apps/web/src/placeholder.test.ts` green.

### 6. Comment hygiene — LOW (aggregated)
- `apps/web/src/LaunchChart.tsx:135` — "A row hover, or the pointer leaving the row, replaces the chart's own selection." → "The chart shows its own selection only while the mark is the chart's, so a row hover hides it." (since #313 a row's leave never ends a chart-made mark)
- `apps/web/src/LaunchChart.tsx:102-106` — "so a list row hover replaces it, and the pointer leaving the row clears both" → "so a list row hover replaces it, and the pointer leaving the row clears a mark the row made, never one the chart made"; and reflow the block at 100 characters (line 105 is 125)
- `apps/web/src/VideoList.tsx:527` — "Once per page, the same positions the launch chart draws its lines in." → "For the whole page rather than per row, the same positions the launch chart draws its lines in."
- `apps/web/src/launch-chart.ts:58-59` — "Whether the page holds rows the launch chart does not draw, processed or not" → "Whether the page holds rows past the launch chart's first 10, processed or not" (the chart also skips unprocessed rows inside the first 10, which this does not count)
- `apps/web/src/ChannelSummaryFigures.tsx:82-84` — "the launch chart of the list's page, either with the processed note of the list's answer under it. While the list is read, their placeholder; for a refused or" (ragged wrap, "either" for "each") → "the launch chart of the list's page, each with the list answer's processed note last. While the list is read, their placeholder; for a refused or empty list", reflowed
- `apps/web/src/video-list.ts:244-245` — "marked when its video's line is selected on the launch chart" → "marked when the row is hovered or its video's line is selected on the launch chart"
- `apps/web/src/app.css:1020` — "The plot a chart's hover card sits over." → "The plot a chart's hover card is placed against: over it, or under it on the launch chart."
- `apps/web/src/app.css:1039-1040` — "beside the line and inside the plot." → "beside the line and inside the plot's width."
- `apps/web/src/chart-hover.ts:84-86` (`cardLeftOf`) — "so a card with no room beside the line covers it rather than running off the chart and the page" → "so a card with no room beside the line covers it, or on the launch chart sits under it, rather than running off the chart and the page"
- `apps/web/src/app.css:1152-1155` — move "The card sits under the plot rather than over it, as with ten rows it is taller than the plot." from above `.launch-card-rows` to directly above `.launch-chart .chart-hover-card` (`:1162`), extended: "No z-index, so the sticky controls bar, earlier in the page at z-index 1, still covers it; it clears the video list, a later stacking context, only by the notes and the list's controls between them."
- `apps/web/test/web.test.ts:697` (test name) — "holds two lines of the note on a phone and one from where the note fits one" → "holds two lines of the note below 386px wide and one from 386px" (current iPhones and Pixels at 390 to 430px take one line)

## Needs Further Investigation

### A. The card's swatch may render square where the list's is rounded — confirm in the browser
Carried from reviews 1 and 2. `.chart svg { overflow: visible }` (`apps/web/src/app.css:977-982`) also matches the card's swatch. Confirm in Nick's browser walk; fix, if wanted, with `overflow: hidden` on `.chart .launch-swatch`.

### B. On a phone, the card opens mostly below the fold and over the axis's day labels — confirm on a device
Carried from review 2, unchanged. Confirm or kill in Nick's 375px walk on a real phone.

### C. A pointer selection after a key step leaves the key step's text in the live region
Already proposed by the #312 run (`.epic-loop/tickets/312/proposals.md`). `pointAt` (`apps/web/src/LaunchChart.tsx:172-182`) selects without writing the announcement, and the shown selection stays non-null, so the block at `:137-143` does not fire. Pre-existing (`pointAt` and the live region are unchanged from the base). Not executed here; confirm with an App test that steps with a key, then stubs the plot's `getBoundingClientRect` and moves the pointer to another line.

## Reviewed and Dismissed
- The render-phase `selectionShown` block (`LaunchChart.tsx:137-143`) — React's "adjusting state while rendering" pattern: it settles in one extra pass, runs before the empty-state return so every hook runs on each render, and the #312 App test goes red without it (red at `e555263`).
- `markVideoBy` capturing a stale `summaryPlaceList` — the same capture the base's handler had; a mark from an older list fails `markedVideoOf`'s identity check and never shows.
- Plot leave and row enter racing — React derives leave and enter from the out/over pair, so the plot's leave (clears the chart's mark) runs before the row's enter (sets the row's).
- Hover a row, focus the plot, ArrowDown, Tab out: no row marked though the pointer rests on the row — the chart's mark had replaced the row's, and a chart clear ends it; neither the line nor a row shows, which R8 allows (#313's rule).
- Escape with no shown selection while a row is hovered — `launchKeyStepOf` returns `undefined` (`launchKeyStepOf`, `launch-chart.ts:224`), a no-op, and the row's mark stays.
- A hidden held selection coming back with a card after a row hover — every chart mark is written by `select()`, which overwrites `held` in the same handler.
- The card sort `(b ?? -1) - (a ?? -1)` (`launch-chart.ts:330`) — every number is non-negative, `Array.prototype.sort` is stable, and a 0 sorts above "No data".
- The note's place lost on first load after `notePlace` left `video-list.ts` — `AfterPublishPlaceholder` ends with the `note` shape (`Placeholder.tsx:169`), and the parity tests pin it.
- `components.test.ts:500` building the note's markup with `delayNoteOf` — the rule under test is the note's place, read by `indexOf`; the note's text is pinned in `apps/web/src/processing.test.ts`.
- The first-10 note's place filling no note on a page of 10 rows or fewer at page size 25 or 50 — recorded #314 assumption, declared drop of review 1 finding 3, and a #314 proposal to predict from the last answer.
- The empty answer dropping the toolbar, plot, axis and running total note places — recorded #314 assumption, named by the "the accepted jump" test.
- `.placeholder-first-rows-note`'s height — re-measured 360 to 460px, equal to the loaded note's at every width.
- The palette — all 20 values match the epic's table; no other theme switch needs a second block.
- The #313 "clear a selection the chart made on %s" and the size-10 parity and empty-answer cases, green at `e555263` — positive controls the acceptance criteria ask for.
- From reviews 1 and 2, still standing (do not touch): `app.test.ts`'s hover-to-learn-each-line step; `components.test.ts:859`; a hover on row 11 or later marking a row with no line; a mode toggle keeping a chart mark; `z-index` on the card (rejected: it paints over the sticky controls bar); the video list painting over the card's lower rows (they never overlap in the real layout); the card's ellipsis, nowrap rows, bold selected row and muted "No data" (recorded #273 assumptions).

## Minor / nits
- `apps/web/src/app.test.ts:296`, `:300`, `:359`, `:390` take the expected "no point" text from `sliderTextOf(null)`; the literal `'No point selected'` would state it.
- `apps/web/src/LaunchChart.tsx:63` picks the "No data" style by comparing the shown string to `noDataLabel`; a `missing` flag on `LaunchDayCardRow` would carry it.
- `.placeholder-first-rows-note`'s `width: min(22rem, 100%)` (`app.css:1626`) is 6px wider than the one-line note (21.625rem); no height effect, and the comment does not say where 22rem comes from.
- `apps/web/test/web.test.ts:704-712` restates the CSS declarations; the repo's existing pattern (`:674-692`), with the browser measurement as the human step.
- `apps/web/src/app.css:792-793`: "A rect's fill paints it, from its data-launch-position, as the token may be warm-hued" gives no reason a reader can act on. Ask why a rect fill rather than `background-color` (forced colors or print would be load-bearing reasons) and say that, or drop the clause.
- A selection hidden by a mode toggle comes back on toggling back (`useLaunchSelection` at `LaunchChart.tsx:78-87` hides a stale-key selection rather than dropping it). Pre-existing, unchanged from the base; reachable only with the pointer resting on the plot while the toggle is worked from the keyboard, and the card then names the still-marked video.
- The publish day placeholder holds three bars against up to ten in the loaded top (`Placeholder.tsx:147-156`); pre-existing and outside #314's launch chart scope.
- The ten `[data-launch-position]` rules and tokens are tied to `launchChartRows = 10` with no test linking them (carried from review 1).
- `.launch-card-row-selected { font-weight: 700 }` gives the mono number a synthesized bold; JetBrains Mono ships 400 and 500 only (carried from review 1).

## Test quality
Tests added or modified: 61 declarations (51 added, 8 modified, 2 renamed), 76 instances once `.each` and `.for` expand; `channel-summary.test.ts` only lost the two `listDelayNoteOf` tests with their function. At `b10c8d4`: 46 red, and 12 instances (8 declarations) green, all expected-green: `app.test.ts:499` (the #191 review pass 1 finding 1 proof, `72f88ba`, a negative control), `app.test.ts:534` (guards base behaviour; finding 3 strengthens it), `launch-chart.test.ts:57` (rename; finding 3 fixes the name), `launch-chart.test.ts:166` (a fixture field), `placeholder.test.ts:172` daily at 10, 25 and 50 (both sides lack the note at base; 25 and 50 go red at `e555263`, so they are #314's proof), `video-list.test.ts:1018` and `:1023` (fixture `by` fields), `web.test.ts:645` (rename). At `e555263`: both #313 "keep" tests, the #312 test, the #314 parity tests at 25 and 50, the saved page size test, the empty answer at 25 and the `web.test.ts:696` pin are red; the #313 "clear" tests and the size-10 cases are controls. Tautology shapes: none strong. Mild: `sliderTextOf(null)` as an expectation (Minor); the line identity learned by hovering rows (review 1 Dismissed); the parity classifier labelling notes by `launchChartText` (its expectation is the rendered `LaunchChart`, so it can go red); `web.test.ts:704-712` restating CSS (Minor). One test whose title claims more than it can see: finding 2. No mocks of the unit under test, call-shaped assertions, snapshots, assertion-free tests or copy tests.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and the full suite are green at `26e7a07`.
- **Commit hygiene:** the tree is clean; this doc is the only addition.
- **Likely reviewer asks:** the palette's 3:1 contrast, which no test holds (#315); the card placement guard (#316); #311's empty-state wording, still waiting on Nick; the browser walk in `.epic-loop/end-report.md`, unrun; the open #312, #313 and #314 issues, whose work this branch carries.

## Verdict
Ready to open a PR as-is, with follow-ups. No gate: zero CRITICAL, HIGH or MEDIUM findings. Six LOWs, all cheap: findings 1 to 4 and 6 are test, refactor and comment work on lines this branch wrote, and finding 5 is pre-existing and already proposed by the #314 run. Of the prior reviews' eight findings, 3 are fixed (review 1 findings 1 to 3), 0 partially fixed, 5 untouched (review 1 findings 4 to 6 and review 2 finding 2, carried here; review 2 finding 1 filed as #316), and 0 were resolved only by a comment or doc edit.
