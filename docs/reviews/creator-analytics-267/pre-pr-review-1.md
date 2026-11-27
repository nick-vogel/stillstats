# Pre-PR review: creator-analytics#267 Launch chart: one marked video, the processed note, the empty state and a color per video

**Branch:** `creator-analytics-267-launch-chart-color-per-video` vs `origin/main` (merge-base `b10c8d4` "Merge pull request #309 from nick-vogel/creator-analytics-253-marketing-site-seo")
**Reviewed at:** HEAD `d7bf6ae` ("creator-analytics#273 Launch chart: the hover card lists every drawn video"). The tree was clean, with no uncommitted or untracked files at review time. 19 files, +1,203 / −168, 12 commits (the five child tickets #181, #175, #191, #176, #273, each a lane commit plus its merge, and two review-pass fix commits `72f88ba` and `be4b92e`).
**Reviewed against:** the epic body of creator-analytics#267 (its End state, Implementation Decisions and Testing Decisions are the spec), its child issues #181, #175, #176, #191 and #273, `CODING_STANDARDS.md` 1 to 3, and the per-ticket assumptions the loop recorded. No prior review of this branch (`--fresh`).
**Date:** 2026-10-20
**Reviewer:** 2 code-review agents, 1 test-oracle agent, and a verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | up to date |
| Lint | `pnpm lint` | pass |
| Typecheck | `pnpm typecheck` | pass |
| Build | `pnpm build` | pass |
| Full suite | `pnpm test` (Docker up, Testcontainers Postgres) | 110 files, 2,494 passed, 1 expected fail (`packages/token-vault/src/token-vault.test.ts:619`, a `test.fails` not in this diff) |
| Tests green at `$BASE` | scratch worktree at `b10c8d4`, the branch's 7 changed test files copied in, each run per file (`components.test.ts` with a one-line shim so it imports at base) | most new cases red at base. Green ones: rename-only or fixture-only edits, the #191 review pass 1 finding 1 swatch negative test (kept as a finding proof), and three guards on unchanged calendar-window behaviour. See Test quality. |
| Hover card at 375px | headless Chrome over a copy of the card markup with the real `styles.css` and `app.css`, 10 real-length titles | card 295x224 over a 295x160 plot, 7 of 10 titles cut. Finding 1. |
| Recommended fix for finding 1 | same harness with the recommended rule injected | the card no longer overlaps the plot |
| Key selection then row leave | executed repro in the happy-dom App harness over the fake API | red: the selection, its card and its row mark all vanish. Finding 2. |
| Recommended fix for finding 2 | applied in a scratch worktree at HEAD | repro green; `app.test.ts`, `components.test.ts`, `video-list.test.ts` 358 of 358 green |
| Swatch and line positions agree | traced: list `launchSwatchPositionsOf(body.answer…)` vs chart `launchChartOf(list.answer…)`, both through `launchPositionsOf`, and `summaryPlaceListOf` hands the chart the list's own `body.answer` | agree in every window |
| Reading unchanged (R7) | diff of `launchCardOf` to `launchReadingOf` plus `selectedDayOf` | byte-identical output; the exact-output test still pins it |
| Card sort | read `launchDayCardOf`: stable sort on `(b ?? -1) - (a ?? -1)` | most first, ties in list order, "No data" last below a real 0 |
| Palette tokens | compared `styles.css` with the epic's table, light and dark | all 20 values match; dark values only under `prefers-color-scheme: dark` (the sheet has no `data-theme` override) |
| CSP | grep of the diff for `style=` on lines, groups, swatches | none; colour reaches every mark through `data-launch-position` |
| OpenPanel | grep of the diff for `track(` | none added |
| Em-dashes in shipped strings | grep of added lines | none |
| Browser-only behaviour | not run in the real app | the palette in light and dark mode, the card at 375px and desktop in the running app, the swatch's rounded corners in the card. Nick's browser walk, per the epic. |

**Overall:** Every requirement in the epic's End state is implemented, and all four CI checks pass. One MEDIUM: on a phone, the new ten-row day card is taller and as wide as the plot, so a tap hides every line it describes. The rest are LOW: a keyboard selection lost when a resting pointer leaves a row, a placeholder that lets the page jump at page sizes 25 and 50, a handful of tests that cannot fail or assert class strings, one dead fallback, and comment hygiene. The PR can open after finding 1; the LOWs are cheap enough to remediate in the same pass.

## Approach decisions
- Mark origin (#181): the shared mark carries `by: 'row' | 'chart'`, and the chart shows its held selection only while the mark is the chart's. Finding 2 extends it: a clear (`null`) from one origin ends only a mark of that origin. Precedent: the `by` field itself, `apps/web/src/video-list.ts` `ListMark`.
- Launch chart day card placement (finding 1): the card sits under the plot (`top` below the plot's box) rather than over it, scoped to `.launch-chart` only; horizontal placement stays with `cardLeftOf`. Precedent: the card is already positioned by CSS in `.chart-hover-card` (`apps/web/src/app.css:1041`), and the existing metric charts' cards are untouched.
- Placeholder parity (finding 3): every note the landed launch chart shows under a predictable condition gets a placeholder shape whose line counts are measured per width. Precedent: `.placeholder-total-note` and `.placeholder-note` in `apps/web/src/app.css:1580-1612`, guarded by `apps/web/test/web.test.ts:646`.
- Review repro files (remediation 2026-10-20): `biome check .` lints `docs/reviews/**/repro/` with the code, so a repro page or test must pass `pnpm lint` before it is committed (a `lang` on `<html>`, `aria-hidden` on a decorative SVG, template literals, `===`, biome formatting). Precedent: the lint-clean `.ts` repros under `docs/reviews/creator-analytics-253/repro/`.

## Confirmed Issues

### 1. On a phone, the ten-row day card covers the whole launch chart plot — MEDIUM
- **Location:** `apps/web/src/app.css:1041-1054` (`.chart-hover-card`, `position: absolute; top: 0; width: max-content; max-width: 100%`) with the new card rows at `apps/web/src/app.css:1152-1176`
- **Attribution:** introduced by `244ae72` ("creator-analytics#273 Launch chart: the hover card lists every drawn video"), which put up to ten rows in the card (`git log -S'launch-card-rows' b10c8d4..HEAD`). At base the card was the same width for a long title, but about three lines tall, so it covered only the top strip of the plot.
- **Real-world trigger:** a creator on a phone at 375px, in First 7/28/90/365 days with a full page, taps the launch chart to compare videos. Any title of about 35 characters or more makes the card full width (`max-content` of the longest nowrap title, clamped to 100% by `max-width`, then `cardLeftOf` clamps it to `left: 0`), and ten rows plus the heading make it 224px tall over a 160px plot. YouTube titles are routinely that long.

**Evidence**
```css
.chart-hover-card {
  position: absolute;
  top: 0;
  width: max-content;
  max-width: 100%;
  …
  background: var(--bg);
```
```css
/* … With ten rows the card can run below the plot. */
.launch-card-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
```

**Failure mode** — at 375px the opaque card covers the hover line, the accented line, every other line and their end dots, and spills 64px over the axis and the notes. The creator scrubs a chart they cannot see. Executed: `repro/review-1-finding-1-card-375.html` prints `{"plotW":295,"plotH":160,"cardW":295,"cardH":224,"titleClipped":7,"coversPlot":true}`. The harness is a copy of LaunchChart's card markup with the real stylesheets linked, not the running app.

**Recommended fix**
```diff
 .launch-card-rows {
   margin: 0;
   padding: 0;
   list-style: none;
 }
+
+.launch-chart .chart-hover-card {
+  top: calc(100% + 0.25rem);
+}
```
and reword the comment above `.launch-card-rows` (`app.css:1152-1154`) so it says the launch chart's card sits under the plot, because with ten rows it is taller than the plot, rather than "With ten rows the card can run below the plot."

**Remediation brief**
- **Design intent:** `HoverLineAndCard` (`apps/web/src/ChartHover.tsx`) renders the card as a child of `.chart-plot` (`position: relative`, `app.css:1021`), measures the plot after each render, and sets only the card's `left` through the style property (CSP: no style attribute). Vertical placement is pure CSS. The launch chart's card is a comparison table of up to ten rows; the plot it describes must stay visible while the card shows.
- **Full surface:** `apps/web/src/app.css` (a new rule after `.launch-card-rows`, scoped to `.launch-chart`, and the comment at `:1152-1154`); `docs/reviews/creator-analytics-267/repro/review-1-finding-1-card-375.html` needs no change, since it links the real `app.css`.
- **Must preserve:** the metric charts' and video detail charts' cards keep `top: 0` (scope the rule to `.launch-chart`); `cardLeftOf`'s horizontal placement (`apps/web/src/chart-hover.ts:88`); no z-index on the card, so the sticky controls bar (`app.css`, z-index 1) still covers it when the page scrolls; `.chart-hover-card`'s `max-width: 100%`. Suites: `pnpm exec vitest run apps/web/test/web.test.ts` (the CSP and visual-system checks) and `apps/web/src/components.test.ts`.
- **Do not touch:** the card's ellipsis on titles and its nowrap rows (recorded #273 assumption, see Dismissed); `.chart .launch-swatch` (see Minor).
- **Proof:** red now, green after, from the repo root: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --dump-dom --window-size=375,800 "file://$PWD/docs/reviews/creator-analytics-267/repro/review-1-finding-1-card-375.html" | grep -o "<title>.*</title>"` prints `"coversPlot":true` now and `"coversPlot":false` after. The CSS-only fix was checked in this harness. Nick's browser walk at 375px and desktop width is the human check, and is where a different placement gets chosen if this one reads badly.

### 2. A pointer leaving a list row wipes a keyboard selection made after the hover — LOW
- **Location:** `apps/web/src/App.tsx:208-209` (`markVideoBy`), reached from `apps/web/src/VideoList.tsx:146` (`onPointerLeave={() => onHover(null)}`) and gated at `apps/web/src/LaunchChart.tsx:135`
- **Attribution:** introduced by `2fb8a69` ("creator-analytics#181 Keep one marked video between a launch chart key selection and a list row hover"), which made the chart show its selection only while the mark is the chart's (`git log -S"markedBy === 'chart'" b10c8d4..HEAD`). At base the same unconditional `null` unmarked the row but left the chart's selection showing.
- **Real-world trigger:** a keyboard user whose mouse rests over a list row Tabs into the launch chart and steps with the arrow keys, then nudges the mouse off the row. The recorded #181 assumption covers a key press after a row hover replaced the selection; here the key selection came after the hover, which no assumption covers.

**Evidence**
```ts
const markVideoBy = (by: ListMark['by']) => (videoId: string | null) =>
  setMark(videoId === null ? null : { videoId, list: summaryPlaceList, by })
```

**Failure mode** — pointer rests on row B (mark `{B, row}`); focus the plot, ArrowDown, ArrowRight (mark `{A, chart}`, card "Day 2", row A marked, correct); the pointer leaves row B, `onHover(null)` clears the mark whoever made it, `markedBy` becomes null, and the chart hides its selection: no card, no mark, value text "No point selected". The next key starts again at Day 1. Chart and list still agree (neither), so R8 holds, but the keyboard user loses their place to a stray mouse movement. Executed: `repro/review-1.test.ts` "finding 2" fails with `expected { marked: [], …(2) } to deeply equal { marked: [ 'Video A' ], …(2) }`.

**Recommended fix**
```diff
   const markVideoBy = (by: ListMark['by']) => (videoId: string | null) =>
-    setMark(videoId === null ? null : { videoId, list: summaryPlaceList, by })
+    setMark((last) =>
+      videoId !== null ? { videoId, list: summaryPlaceList, by } : last?.by === by ? null : last,
+    )
```
Then move the repro case into `apps/web/src/app.test.ts` beside "name one video at every step from a key selection to a row hover and the pointer leaving the row" (`:264`).

**Remediation brief**
- **Design intent:** one shared mark in App, `{ videoId, list, by }`, read through `markedVideoOf` (which drops a mark made on another list). A row hover sets a `row` mark, a chart selection a `chart` mark, and the chart shows its own held selection only while the mark is `chart`. The rule is that the accented line and the marked row always name one video, or neither. A clear from one origin must end only that origin's mark: a row leave ends a row mark, and a chart clear (Escape, blur, the pointer leaving the plot) ends a chart mark.
- **Full surface:** `apps/web/src/App.tsx:208-209`, the only writer of the mark (both `onMark={markVideoBy('chart')}` at `:460` and `onRowHover={markVideoBy('row')}` at `:468` go through it). The fix also changes the chart side: with a row hovered, a Tab out of the plot no longer clears the hovered row's mark. That is the loop's open proposal "A chart clear keeps a hovered row's mark" in `.epic-loop/tickets/181/proposals.md`, so the orchestrator can drop it once this lands. After the fix, the comment at `apps/web/src/video-list.ts:235-236` ("Only a pointer leaving the row ends a row's mark") becomes true and stays.
- **Must preserve:** `app.test.ts:264` (hover row B after a key selection replaces it; leaving row B clears both); the recorded #181 assumption that a key press after a row hover replaced the selection starts from no selection (`LaunchChart.tsx:135` gating is unchanged); `markedVideoOf`'s list check (`video-list.test.ts` "the video a mark marks"); the chart's `select(null)` still emptying the live region.
- **Do not touch:** `LaunchChart.tsx:135` (`markedBy === 'chart' ? held : null`) and `useLaunchSelection`'s clear on new lines, both checked and correct (see Dismissed).
- **Proof:** red now, green after: `pnpm exec vitest run --config docs/reviews/creator-analytics-267/repro/review-1.vitest.config.ts -t "finding 2"`. Then run the moved test: `pnpm exec vitest run apps/web/src/app.test.ts`.

### 3. The launch chart placeholder holds no place for "The chart shows the first 10 videos on this page.", so the page jumps at page sizes 25 and 50 — LOW
- **Location:** `apps/web/src/Placeholder.tsx:146-158` (`AfterPublishPlaceholder`, the launch chart shape) and its docstring at `:126-131`
- **Attribution:** introduced by `8307cc3` ("creator-analytics#191 Launch chart: the first 10 rows, a color per row and list swatches"), which added the note to `LaunchChart` (`git log -S'firstRowsNote' b10c8d4..HEAD`) but not to the placeholder.
- **Real-world trigger:** a creator with a saved page size of 25 or 50 opens First 7/28/90/365 days, or changes page. The placeholder shows toolbar, heading, plot, axis, the running total note's place and the processed note's place; when the answer lands, a note line appears between the axis and the running total note and everything below, the list included, moves down.

**Evidence**
```tsx
      <Placeholder shape="axis" />
      {chartModeOf(route, saved) === 'aggregate' && <Placeholder shape="total-note" />}
      <Placeholder shape="note" />
```

**Failure mode** — confirmed by reading: `LaunchChart.tsx` renders `launchChartText.firstRowsNote` whenever `rowsPastLaunchChart(videos)`; the placeholder has no counterpart. No test covers it (`placeholder.test.ts:78` checks only the processed note's place).

**Recommended fix** — in `AfterPublishPlaceholder`'s launch chart shape, after the axis and before the total note:
```diff
       <Placeholder shape="axis" />
+      {pageSizeOf(route, saved) > launchChartRows && <Placeholder shape="first-rows-note" />}
       {chartModeOf(route, saved) === 'aggregate' && <Placeholder shape="total-note" />}
```
with a new `first-rows-note` member of `PlaceholderShape` (`Placeholder.tsx:7`) and a `.placeholder-first-rows-note` rule in `app.css` beside `.placeholder-total-note`, its line count per width measured for the 49-character note the way the existing rule's comment at `app.css:1572-1581` records its widths. Add a `placeholder.test.ts` case: page size 25 shows the place between the axis and the processed note's place; page size 10 shows none. Add the note to the docstring at `:126-131`.

**Remediation brief**
- **Design intent:** a placeholder stands in for what lands, shape for shape, so nothing below moves when the answer arrives. Conditional notes are predicted from what the placeholder already knows (the route and the saved preferences): the running total note's place follows `chartModeOf`. The page size is the best predictor of "the page holds more than 10 rows".
- **Full surface:** `apps/web/src/Placeholder.tsx:7` (shape union), `:126-131` (docstring), `:146-158` (the shape); `apps/web/src/app.css` beside `:1582-1612`; `apps/web/src/placeholder.test.ts`; `launchChartRows` is exported from `apps/web/src/launch-chart.ts:30` and `pageSizeOf` from `apps/web/src/preferences.ts:56`.
- **Must preserve:** the publish day shape (no first-10 note there); the processed note's place last in both shapes (`placeholder.test.ts:78`, `:91`); `apps/web/test/web.test.ts:646`, which measures `.placeholder-note`'s line counts. Declared dropped: a channel whose page holds 10 rows or fewer at page size 25 or 50 (a last page, or a small channel) reserves a line that never fills; that mis-prediction is accepted, as the summary placeholder's `stackedOnly` legend already accepts one.
- **Do not touch:** the empty state's height difference from the placeholder (see Dismissed).
- **Proof:** the new `placeholder.test.ts` case, red before the `Placeholder.tsx` change and green after: `pnpm exec vitest run apps/web/src/placeholder.test.ts`.

### 4. Tests that cannot fail, or assert class strings and production-computed paths — LOW
- **Location:** listed per item below
- **Attribution:** introduced by this branch's test commits (`8307cc3`, `8b5216c`, `244ae72`); each item names its file.
- **Real-world trigger:** none for users; each is a claim of coverage the suite does not have (CODING_STANDARDS 2).

Items, each its own small fix:
- `apps/web/src/components.test.ts:622-636` and the helper `launchGroupsOf` at `:572`: the expected paths come from the production helper (`const [lineA, lineB] = launchChartOf(answer.videos, 'first28', 'daily').lines`, then `` `chart-line launch-chart-line ${lineA?.path}` ``), and the whole class string is compared. The path half is an identity, and the class half asserts an exact class string. Fix: have `launchGroupsOf` return, per group, its `data-launch-position`, its path count, and whether it holds an end dot (`class` contains `launch-chart-end`); assert `[{ position: '2', paths: 1, endDot: false }, { position: '3', paths: 2, endDot: true }]`. The geometry stays pinned literally in `launch-chart.test.ts`. The red at base comes from the positions, so the test keeps its red.
- `apps/web/src/components.test.ts:783` "in a calendar window, takes no processed note and no launch chart from the list's answer": `renderToStaticMarkup` never lands the summary read, so in a calendar window this markup can only be the summary's placeholder, and `not.toContain(processedNote)` holds whatever the code does. It passes at base. Fix: delete it; `app.test.ts:424` covers calendar-window placement through the full render.
- `apps/web/src/app.test.ts:424` "in a calendar window, sits once with the summary, and not in the video list": the name promises "with the summary" but nothing asserts it. Fix: add `expect(notes[0]?.closest('.metric-charts')).not.toBeNull()` (the launch chart, which also carries `metric-charts`, is already asserted absent on the next line).
- `apps/web/src/launch-chart.test.ts:57`: renamed to "draws one line per row with a processed day among the page's first 10, …" though its fixture has 3 rows, so the first-10 half is never exercised (the new "draws only the page's first 10 rows" test does that). Fix: restore the name to the rule the body shows, dropping "among the page's first 10".
- `apps/web/src/launch-chart.test.ts:289-290`: after `expect(text).toBe('Day 12, Engaged views 1,234')`, the loop `for (const other of ['Title b', 'Title d', '5,678', '7']) expect(text).not.toContain(other)` cannot fail. Fix: delete the loop line.

**Remediation brief**
- **Design intent:** a test builds only its input and observes only real output, states one rule, and never asserts an exact class string (CODING_STANDARDS 2).
- **Full surface:** the five sites above.
- **Must preserve:** the #191 review pass 1 finding 1 proof `app.test.ts:389-399` ("give no row a swatch under %s"), which is green at base by design (see Test quality); every red-at-base test's red.
- **Do not touch:** `app.test.ts:264`'s row-hover mapping step (see Dismissed); `components.test.ts:859`, a guard on the calendar window's note that R9 asks for.
- **Proof:** `pnpm exec vitest run apps/web/src/components.test.ts apps/web/src/app.test.ts apps/web/src/launch-chart.test.ts` green after; for the first item, revert `data-launch-position={line.position}` on the `<g>` in `LaunchChart.tsx` locally and see the rewritten test go red.

### 5. A dead fallback in `markedBy` restates the mark's lifetime rule in App — LOW
- **Location:** `apps/web/src/App.tsx:207`
- **Attribution:** introduced by `2fb8a69` ("creator-analytics#181 …").
- **Real-world trigger:** none; CODING_STANDARDS 3 (a dead fallback on a line the change wrote).

**Evidence**
```ts
const markedVideoId = markedVideoOf(mark, summaryPlaceList)
const markedBy = markedVideoId === null ? null : (mark?.by ?? null)
```
**Failure mode** — when `markedVideoId` is non-null, `mark` is non-null, so `?.` and `?? null` never fire; they exist only because TypeScript cannot narrow through `markedVideoOf`, and App re-derives "is this mark live" a second time.

**Recommended fix** — have `apps/web/src/video-list.ts` export the live mark (`liveMarkOf(mark, list): ListMark | null`, the body of `markedVideoOf` returning the mark), keep `markedVideoOf` as `liveMarkOf(mark, list)?.videoId ?? null` if other callers need it, and in App:
```diff
-  const markedVideoId = markedVideoOf(mark, summaryPlaceList)
-  const markedBy = markedVideoId === null ? null : (mark?.by ?? null)
+  const liveMark = liveMarkOf(mark, summaryPlaceList)
+  const markedVideoId = liveMark?.videoId ?? null
+  const markedBy = liveMark?.by ?? null
```
**Remediation brief**
- **Design intent:** one function owns when a mark is live (only on the list it was made on).
- **Full surface:** `apps/web/src/App.tsx:206-207`; `apps/web/src/video-list.ts` `markedVideoOf` (about `:235-241`) and its tests in `apps/web/src/video-list.test.ts` ("the video a mark marks"); `git grep -n markedVideoOf` for every caller.
- **Must preserve:** `markedVideoOf`'s behaviour on another list (both `video-list.test.ts` cases). Land after finding 2, which edits the next line.
- **Do not touch:** the `by` field (recorded #181 assumption).
- **Proof:** `pnpm typecheck` and `pnpm exec vitest run apps/web/src/video-list.test.ts apps/web/src/app.test.ts` green; behaviour-preserving, no red step.

### 6. Comment hygiene — LOW (aggregated)
- `apps/web/src/launch-chart.ts:58-59` — "Whether the page holds rows the launch chart does not draw, processed or not" → "Whether the page holds rows past the launch chart's first 10, processed or not" (the chart also skips unprocessed rows inside the first 10, which this function does not count)
- `apps/web/src/ChannelSummaryFigures.tsx:82-84` — "the launch chart of the list's page, either with the processed note of the list's answer under it. While the list is read, their placeholder; for a refused or / empty list" (ragged mid-sentence wrap, "either" unclear) → "the launch chart of the list's page, each with the list answer's processed note last. While the list is read, their placeholder; for a refused or empty list", reflowed
- `apps/web/src/video-list.ts:244-245` — "marked when its video's line is selected on the launch chart" → "marked when the row is hovered or its video's line is selected on the launch chart"

## Needs Further Investigation

### A. The card's swatch may render square where the list's is rounded — confirm in the browser
`.chart svg { overflow: visible }` (`app.css:977-982`) also matches the card's swatch, and an SVG with visible overflow is not clipped by its `border-radius` the way the list's swatch (UA `overflow: hidden`) is. Confirm by zooming on a card swatch beside a list swatch in Nick's browser walk; fix, if wanted, by adding `overflow: hidden` to `.chart .launch-swatch`.

## Reviewed and Dismissed
- A hover on row 11 or later, or on an unprocessed row, marks the row with no line accented — R1 gives that row no line, so there is nothing to accent; the chart and the list do not name different videos.
- A stale held selection resurfacing after a row hover — every `chart` mark is written by `select()`, which overwrites the held selection in the same handler, so no older selection can come back with a card (`LaunchChart.tsx:135`).
- A mode toggle keeping a chart mark — the held selection clears on new lines, the line stays accented from `markedVideoId` with no card, and the row stays marked: one video named.
- Swatch and line positions disagreeing — both go through `launchPositionsOf` over the same answer; the chart draws only when the list's answer window matches the route.
- The empty-state predicate counting an all-zero row as processed — recorded #176 assumption, consistent with the drawn rows.
- The empty state's height differing from the placeholder — unpredictable before the answer, and the #176 assumptions record what the empty state drops.
- `HoverLineAndCard` taking children — its other caller, `ChartHover`, passes the same title and values markup it rendered before.
- Dark tokens only under `prefers-color-scheme: dark` — the shared sheet has no other theme switch.
- `.chart svg` stretching the swatch — `.chart .launch-swatch` (0,2,0) beats `.chart svg` (0,1,1).
- `app.test.ts:264` learning each line by hovering its row — the ArrowDown step, which selects line 0 by index, would expose a swapped mapping; the row-hover step tests the replacement rule, not the mapping.
- `components.test.ts:859`, the summary's note under the metric charts, green at base — R9 says the calendar window is unchanged, and no other test pins it.
- Card ellipsis on titles, nowrap rows, the selected row bold by class, "No data" muted — recorded #273 assumptions.

## Minor / nits
- `apps/web/src/LaunchChart.tsx:63` picks the "No data" style by comparing the shown string to `noDataLabel`; a `missing` flag on `LaunchDayCardRow` would carry it.
- `.launch-card-row-selected { font-weight: 700 }` gives the mono number a synthesized bold, since JetBrains Mono ships 400 and 500 only.
- `.chart .launch-swatch` repeats `.launch-swatch`'s size; one combined selector would hold one copy.
- The ten `[data-launch-position]` rules and tokens are tied to `launchChartRows = 10` with no test linking them.
- `launchChartRows` is exported, and nothing outside `launch-chart.ts` imports it until finding 3 does.
- `app.test.ts:296` and `:300` take the expected "no card" value from `sliderTextOf(null)`; `app.test.ts:396`'s `toBeTruthy()` is redundant, as `rowOf` throws.
- `components.test.ts:611`'s 10-row boundary would bracket tighter if its 25-row partner used 11 rows.

## Test quality
Tests added or modified: about 70 cases across 6 files (`channel-summary.test.ts` only lost the two `listDelayNoteOf` tests with their function). Green against `$BASE`: 11 cases. Of those, the rename-only or fixture-only edits (`launch-chart.test.ts:57`, the four nearest-pointer cases, the two `markedVideoOf` cases, `web.test.ts:646`) are expected green; `app.test.ts:389-399` is the proof of #191 review pass 1 finding 1 (`72f88ba`) and stays; `app.test.ts:424`, `components.test.ts:611`, `:783` and `:859` guard behaviour the base already had, and finding 4 strengthens or deletes the two that cannot fail. Tautology shapes: one production-computed expectation (`components.test.ts:630-636`, finding 4), two minor ones (`sliderTextOf(null)` as an expectation, Minor). No mocks of the unit under test, call-shaped assertions, snapshots, assertion-free tests or copy tests.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and the full suite are green at `d7bf6ae`.
- **Commit hygiene:** the branch is clean; this doc and `repro/` are the only additions.
- **Likely reviewer asks:** the card on a phone (finding 1); the palette's 3:1 contrast, which no test holds (already a loop proposal under #191); the open #181 and #176 proposals (empty state when only rows past the 10th are processed, the live region after a row hover).

## Verdict
Ready to open a PR after finding 1. Gate: finding 1 (MEDIUM) fixed and checked in Nick's 375px walk. Findings 2 to 6 are LOW and cheap; remediating them in the same pass is recommended, and none blocks. No prior review findings were claimed by this branch.

## Remediation — 2026-10-20
Scope: CRITICAL, HIGH and MEDIUM, the default. The doc has one MEDIUM (finding 1) and no CRITICAL or HIGH, so findings 2 to 6 (all LOW) are deliberately deferred to Nick, unfixed.

| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 1 (MEDIUM) | `16a2433` creator-analytics#267 pre-PR review 1 finding 1: on a phone the ten-row day card covers the whole launch chart plot | red→green: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --dump-dom --window-size=375,800 "file://$PWD/docs/reviews/creator-analytics-267/repro/review-1-finding-1-card-375.html" \| grep -o "<title>.*</title>"` printed `"coversPlot":true` before, `"coversPlot":false` after. Must-preserve suites `apps/web/test/web.test.ts` and `apps/web/src/components.test.ts` 111 of 111 green; `pnpm typecheck` green | 0 (gate count; the existing CSS comment above `.launch-card-rows` reworded as the brief directs, no comment added) | proved by execution (MEDIUM, CSS only, no shared core, so no verify agent) |
| 2 (LOW) | — deferred | the repro `-t "finding 2"` is still red, as expected | — | deferred: LOW tail, Nick's call |
| 3 (LOW) | — deferred | — | — | deferred: LOW tail, Nick's call |
| 4 (LOW) | — deferred | — | — | deferred: LOW tail, Nick's call |
| 5 (LOW) | — deferred | — | — | deferred: LOW tail, Nick's call |
| 6 (LOW, comment hygiene) | — deferred | — | — | deferred: LOW tail, Nick's call |
| not a finding: `pnpm lint` red | `5b513d5` creator-analytics#267 Keep the pre-PR review 1 repro files lint-clean | `pnpm lint` red at `a7c5921` (four diagnostics in `repro/review-1-finding-1-card-375.html`, a format diff in `repro/review-1.test.ts`), green after; the 375px harness output unchanged | 0 | proved by execution |

The lint red came from the review commit `a7c5921` itself, not from the branch's code: the review ran `pnpm lint` at `d7bf6ae`, before its repro files existed. Left red, the PR's lint check would fail.

After both commits, at `5b513d5`: `pnpm lint`, `pnpm typecheck` and `pnpm test` green (110 files, 2,494 passed, 1 expected fail at `packages/token-vault/src/token-vault.test.ts:619`, as in the review). `pnpm build` was not re-run; the change since the review's green build is one CSS rule and two repro files outside the build.

### Known regressions, deferred
- none

### Rework briefs
- none (no verify pass ran, so no rework)
