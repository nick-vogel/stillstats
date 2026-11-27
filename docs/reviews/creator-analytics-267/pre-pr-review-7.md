# Pre-PR review: creator-analytics#267 follow-up #311 (the launch chart draws the first 10 processed rows, wherever they sit)

**Branch:** `creator-analytics-267-launch-chart-color-per-video` vs `origin/main` (merge-base `ed67816`, "Merge pull request #438 from nick-vogel/creator-analytics-267-launch-chart-color-per-video")
**Reviewed at:** HEAD `566513d` (creator-analytics#311 Launch chart: the empty state when only rows past the 10th are processed, the merge of `43f18e2` of the same subject) + 0 files with uncommitted changes, 0 untracked files, 11 files total, +151 / −83
**Reviewed against:** issue creator-analytics#311 (its "Decided (2026-11-05)" section and acceptance criteria, which overturn the epic's "row position" rule for #191), epic creator-analytics#267's body (the spec for everything #311 does not change); `CODING_STANDARDS.md`; the Approach decisions of `pre-pr-review-6.md`
**Date:** 2026-11-05
**Reviewer:** 2 code-review agents + tautology audit agent + verify pass. A full (`--fresh`) review of the 2 commits since the merge-base (`43f18e2` and its merge `566513d`). `origin/main` has moved on to `9c73a81` (#448, the support button), which touches `apps/web/src/app.css` and `apps/web/test/web.test.ts`; `git merge-tree --write-tree HEAD origin/main` merges clean.

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | ok, already up to date |
| Lint | `pnpm lint` | ok, 539 files, no fixes |
| Typecheck | `pnpm typecheck` | ok |
| Build | `pnpm build` | ok |
| Test | `pnpm test` (Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | ok, 124 files, 2775 passed, 1 expected fail |
| Browser walk | `pnpm run --if-present test:browser` | ok, 27 steps, no content security policy violation |
| Merge with current main | `git merge-tree --write-tree HEAD origin/main` | clean |
| Positions, swatches, empty state read one source | read every consumer of `launchPositionsOf` (`launchChartOf` `launch-chart.ts:147`, `launchSwatchPositionsOf` `launch-chart.ts:86` via `VideoList.tsx:534`, `launchChartEmpty` `launch-chart.ts:57`); grepped for any other index-derived position (`position - 1`, `slice(0, 10)`, `index + 1` outside tests) | holds: no other code derives a color from a row index |
| Selection clears when positions change | read `linesKey` (`LaunchChart.tsx:155`): mode plus the ordered drawn video ids | holds: a change of drawn rows changes the key |
| Day card, key steps, stroke | read `launchDayCardOf` (`launch-chart.ts:288-314`), `launchKeyStepOf`, stroke `var(--launch-line-${position})` (`launch-plot.ts:63`) | unchanged and correct under the new positions |
| First-10 note under the empty state | read both branches of `LaunchChart` (`LaunchChart.tsx:224-231`, `:306`) | the empty branch no longer renders it; the drawn branch does when the page holds more than 10 rows |
| Approved copy | compared `launchChartText.firstRowsNote` and `.empty` with #311's body, and their comments | word for word, comments name #311 and 2026-11-05 |
| Acceptance tests | located each: row 11 only `app.test.ts:605`; rows 3, 5, 12 to 30 `launch-chart.test.ts:130`; 25 rows none processed `components.test.ts:927`; placeholder parity at 10, 25, 50 `placeholder.test.ts:184-199` (unchanged, green) | all present and green |
| Note width, no sidebar, below 500px | headless Chrome, the real `p.note` in the signed-in shell with both stylesheets, column widths 200 to 470px in 1px steps and 443 to 446px in 0.25px steps (window 1280, so the column is set directly) | the 64 character note takes 1 line from a 444.5px column, 2 from 256px, 3 below 256px. Viewport edges with the 40px of gutters below 500px: 484.5px (1 to 2 lines) and 296px (2 to 3 lines) |
| Note width beside the sidebar | `docs/reviews/creator-analytics-267/repro/review-5-finding-1.sh` widths plus 500, 600, 700, 767, 769, 1600 | `"first":"1/1"` (loaded/placeholder) at every width from 500 to 1600; the column is narrowest beside the sidebar at 768px (522.56px), so no `(min-width: 48rem) and (max-width: …)` band is needed |
| Tautology audit | base checkout at `ed67816` in a scratch worktree, the six HEAD test files copied in, changed tests run by name | 18 changed or added cases: 13 red at base, 5 green at base (all with assertions unchanged from base, see Test quality) |
| Phone widths under 500px in a real window | not run | headless Chrome on macOS renders no window narrower than 500px; the container-width page above stands in for it |

**Overall:** The new rule is implemented in one place (`launchPositionsOf`, filter then slice) and every reader (lines, swatches, empty state, day card) goes through it, so the list stays the chart's legend; every acceptance criterion has a test that is red at the base and green here, and all full checks are green. The first-10 note's re-measured placeholder widths hold in headless Chrome, with and without the sidebar. What remains is wording: two pre-existing test names and the empty-jump test's title and comment still state or over-claim the replaced rule, two names (`rowsPastLaunchChart`, `launchChartRows`) now describe the old rule, and a batch of comments still say "row position", "65 character" and "the note on the first 10 rows". None of it gates the PR.

## Approach decisions
- Launch chart color positions (#191, overturned in part by #311): `launchPositionsOf` (`launch-chart.ts:42-49`) is the single source: keep the page's rows with a processed day (`engagedViewsByDay` non-empty, all zeros included), take the first 10, number them 1 to 10 in page order. Lines, swatches, the empty state and the day card read it and never a row index. Precedent: `launchSwatchPositionsOf` and `launchChartEmpty`, both built on it.
- First-10 note (#191, #311): shows under the drawn chart only, when the page's row count exceeds 10 (`rowsPastLaunchChart`), so the placeholder can predict it; it never shows under the empty state. The placeholder's mis-prediction for an empty page is part of the empty answer's accepted jump (#314).
- Live region (#312, #322, #343, #374): carried forward unchanged from `pre-pr-review-6.md`.
- Placeholder parity (#314, #324, #375): carried forward unchanged from `pre-pr-review-6.md`. This review confirms the 64 character first-10 note needs no sidebar band: it keeps one line at every width from 48rem.
- First-10 note prediction (#325, #344, #376): carried forward unchanged from `pre-pr-review-6.md`.
- Review repro files: `biome check .` lints `docs/reviews/**/repro/`, so a repro must pass `pnpm lint` before it is committed. A shell repro is outside biome's file types.

## Confirmed Issues
### 1. Three test names and one test comment still state the rule #311 replaced, or claim a page size the table does not hold — LOW
- **Location:** `apps/web/src/launch-chart.test.ts:97`, `apps/web/src/components.test.ts:859`, `apps/web/src/placeholder.test.ts:265-279`
- **Attribution:** the names at `launch-chart.test.ts:97` and `components.test.ts:859` are pre-existing, made stale by this branch (`git show ed67816:apps/web/src/launch-chart.test.ts | grep -n "draws only the page's first 10"` → line 97; `git show ed67816:apps/web/src/components.test.ts | grep -n 'draws the first 10 and says so'` → line 859). The `placeholder.test.ts` comment and title are introduced by `43f18e2`.
- **Real-world trigger:** no user path; a maintainer reading the suite as the spec (CODING_STANDARDS rule 2: "Its name says which rule"). Capped at LOW.

**Evidence**
```ts
test("draws only the page's first 10 rows, as rows 1 to 10 in order, whatever the page size", () => {
  const rows = Array.from({ length: 12 }, (_, i) => row(`v${i + 1}`, [i + 1]))
test('with 25 rows on the page, draws the first 10 and says so under the axis', () => {
// ... At page size 25 or
// 50 the first-10 note's place drops too, ... while the placeholder still predicts it from the page size.
test.each([ { size: 10, chart: 'daily' }, { size: 25, chart: 'daily' }, { size: 10, chart: 'aggregate' }, { size: 25, chart: 'aggregate' } ] as const)(
  "... drops the placeholder's toolbar, plot, axis, first-10 note and total note for its sentence and keeps the delay note, the accepted jump",
```
**Failure mode** — Both pre-existing tests feed only processed rows, so they still pass, but their names state "the first 10 rows" as the drawn set, which #311 replaced with "the first 10 rows with a processed day". What they actually pin is the 10-line cap. The empty-jump comment claims page size 50, which the table has no row for; its title says every row drops a first-10 note and a total note, though at size 10 the placeholder never holds the first-10 note and in daily mode never holds the total note; and "predicts it from the page size" omits the list's last answer (`listRowsExpectedFor`, #325), which predicts the note the same way for an answered page of more than 10 unprocessed rows.

**Recommended fix**
```diff
-  test("draws only the page's first 10 rows, as rows 1 to 10 in order, whatever the page size", () => {
+  test('draws at most 10 lines, the first 10 rows with a processed day in order, whatever the page size', () => {
-  test('with 25 rows on the page, draws the first 10 and says so under the axis', () => {
+  test('with 25 processed rows on the page, draws the first 10 and says so under the axis', () => {
```
In `placeholder.test.ts`, add `{ size: 50, chart: 'daily' }` and `{ size: 50, chart: 'aggregate' }` to the empty-jump `test.each` table; change the title's "drops the placeholder's toolbar, plot, axis, first-10 note and total note" to "drops whichever of the placeholder's toolbar, plot, axis, first-10 note and total note it holds"; change the comment's "predicts it from the page size" to "predicts it from the page size or the list's last answer for the page".

**Remediation brief**
- **Design intent:** a test name is the rule it defends (CODING_STANDARDS rule 2). Since #311 the drawn set is "the page's first 10 rows with a processed day", and the empty-jump test holds the rule that an empty answer drops every place the placeholder held except the heading and the delay note.
- **Full surface:** `apps/web/src/launch-chart.test.ts:97`; `apps/web/src/components.test.ts:859`; `apps/web/src/placeholder.test.ts:265-270` (comment), `:271-276` (table), `:278` (title).
- **Must preserve:** every assertion in the three tests; the empty-jump body's expectations (`empty` equals `['heading', 'text', 'note']`, the placeholder list built with `firstRows` for `size > 10` and `total` for aggregate). The new size-50 rows must pass with the body unchanged.
- **Do not touch:** the placeholder parity `test.each` at `placeholder.test.ts:184-199` (see Reviewed and Dismissed); the rename-only tests the tautology audit found green at base (Test quality).
- **Proof:** `pnpm exec vitest run apps/web/src/placeholder.test.ts -t "empty answer at page size 50"` matches no test now and must run 2 green tests after; `pnpm exec vitest run apps/web/src/launch-chart.test.ts apps/web/src/components.test.ts` stays green.

### 2. `rowsPastLaunchChart` and `launchChartRows` still name the old rule — LOW
- **Location:** `apps/web/src/launch-chart.ts:31-32`, `apps/web/src/launch-chart.ts:59-67`
- **Attribution:** introduced in part: `43f18e2` rewrote both doc comments and left the name `rowsPastLaunchChart` and the constant's second use. A walked-past refactor on lines the change touched (CODING_STANDARDS rule 3).
- **Real-world trigger:** no user path; a maintainer changing the line cap or reading the note's condition. Capped at LOW.

**Evidence**
```ts
/** How many of the page's rows with a processed day the chart draws, whatever the page size. */
export const launchChartRows = 10
/**
 * Whether the page holds more than 10 rows, processed or not, so the note on the launch chart's
 * first 10 rows shows under the drawn chart. The page size alone decides it, so the loading
 * placeholder can predict it. It does not show under the empty state.
 */
export function rowsPastLaunchChart(videos: VideoRow[]): boolean {
  return videos.length > launchChartRows
```
**Failure mode** — `rowsPastLaunchChart` reads as "the page holds rows the chart does not draw". Since #311 that is false: with 25 rows and only row 11 processed it returns true while the chart draws row 11, and with 25 rows and 3 processed the chart draws every processed row. `launchChartRows` is documented as the line cap only, yet `rowsPastLaunchChart` and `Placeholder.tsx:177` (`listRowsExpectedFor(...) > launchChartRows`) use it as a page row count; a change to the cap would silently move the note's threshold with it. "The page size alone decides it" is also inexact: the function reads the page's row count, which on a last page is below the page size, and the placeholder predicts from the list's last answer before the page size.

**Recommended fix**
```diff
-/** How many of the page's rows with a processed day the chart draws, whatever the page size. */
+/**
+ * How many of the page's rows with a processed day the chart draws, whatever the page size, and
+ * the page row count past which the first-10 note shows.
+ */
 export const launchChartRows = 10
-export function rowsPastLaunchChart(videos: VideoRow[]): boolean {
+export function firstRowsNoteShown(videos: VideoRow[]): boolean {
```
And in the function's doc: "The page size alone decides it" → "The page's row count alone decides it, never which rows are processed". Rename the callers.

**Remediation brief**
- **Design intent:** the first-10 note's condition is the page's row count only, never which rows are processed, so the loading placeholder can predict it before the answer (#314, #325, #376); it renders only in `LaunchChart`'s drawn branch.
- **Full surface:** `apps/web/src/launch-chart.ts:31-32`, `:59-67`; `apps/web/src/LaunchChart.tsx:27` (import), `:306` (use); `apps/web/src/launch-chart.test.ts:21` (import), `:423-426`.
- **Must preserve:** `videos.length > launchChartRows` exactly; the import of the constant at `apps/web/src/Placeholder.tsx:3` and its use at `:177`; `launch-chart.test.ts` "the note on the launch chart's first 10 rows" cases (11 and 25 true, 10 and 0 false).
- **Do not touch:** splitting `launchChartRows` into two constants is not recommended: both are 10 by one decision (#191), and the doc names both uses.
- **Proof:** `pnpm typecheck` and `pnpm exec vitest run apps/web/src/launch-chart.test.ts apps/web/src/components.test.ts apps/web/src/placeholder.test.ts` green; `git grep -n rowsPastLaunchChart` prints nothing.

### 3. Comment hygiene — LOW (aggregated)
- `apps/web/src/launch-plot.ts:2-3` — "one line per drawn video in its row position's colour" → "one line per drawn video in its color position's colour (`launchPositionsOf`)"
- `packages/visual-system/src/styles.css:58` — "The launch chart's line colors by row position, approved in creator-analytics#191." → "The launch chart's line colors by color position (`launchPositionsOf`), approved in creator-analytics#191."
- `apps/web/src/chart-colours.test.ts:76` — "every row position's colour" → "every color position's colour"
- `apps/web/src/app.css:1354` — "the 65 character note" → "the 64 character note" (`printf '%s' 'The chart shows the first 10 videos on this page that have data.' | wc -m` prints 64)
- `apps/web/src/app.css:1357-1358` — "the signed-in view's gutter below 48rem is 40px" → "the signed-in view's two gutters take 40px below 500px (1.25rem each, as `--gutter` clamps)"
- `apps/web/src/LaunchChart.tsx:106` — "with the note on the first 10 rows under it" → "with the first-10 note under it"
- `apps/web/src/LaunchChart.tsx:131` — "and the note on the first 10 rows" → "and the first-10 note"
- `apps/web/src/Placeholder.tsx:143` — "then the note on its first 10 rows when the page is expected to hold more" → "then the first-10 note when the page is expected to hold more than 10 rows"
- `apps/web/src/placeholder.test.ts:178-182` — "so a page of 10 rows or fewer at page size 25 or 50 holds a place that never fills, an accepted mis-prediction (creator-analytics#314) left only for a page the list has not answered on this page load (creator-analytics#325)." → append "A page of more than 10 rows with no processed row also holds a first-10 place that never fills, inside the empty answer's accepted jump (creator-analytics#311)."

## Needs Further Investigation
### A. Below a 296px viewport the first-10 note takes 3 lines and its placeholder holds 2 — confirm whether widths under 320px are supported
Measured in headless Chrome with the real `p.note` in the signed-in shell at fixed column widths (window 1280, one `section.video-detail-section.metric-charts.launch-chart` per column width, both real stylesheets): 3 lines below a 256px column, which is a viewport under 296px with the 40px of gutters, for example a 280px folded phone cover screen. The page would move up one 24px line when the note loads. `.placeholder-first-rows-note` (`apps/web/src/app.css:1360-1364`) starts at 2 lines. The app's other measurements start at 320px (`app.css:1215`), where the note takes 2 lines and matches. Pre-existing in kind: the old 49 character note also took 3 lines in a narrow enough column, and the branch moves that edge up. Confirm by asking Nick whether sub-320px widths are in scope; if they are, add `--lines: 3` as the base and a `@media (min-width: 18.5rem)` step to 2 before the one-line rule, and pin both in `apps/web/test/web.test.ts:754`.

## Reviewed and Dismissed
- The 485px (30.3125rem) one-line threshold rounds up past the measured 484.5px edge — reachable only at a fractional viewport under browser zoom, and the sibling rules round the same way.
- `apps/web/test/web.test.ts:754` restates the stylesheet's breakpoint literal rather than observing a browser — the documented jsdom limit (CODING_STANDARDS rule 2, "a test states its own limits"), the same pattern as the sibling note tests at `web.test.ts:690-750`, and the Approach decision pins each shape's rules this way.
- The placeholder parity `test.each` at `placeholder.test.ts:184-199` uses processed pages only and does not cover the empty answer — the empty answer is the separate accepted-jump test below it, by design (#314).
- The #325 and #376 "after the list answered the same page" placeholder tests (`placeholder.test.ts:212-262`) — every case answers processed rows, so the empty branch never runs there and their rule still holds.
- On a page of more than 10 rows with fewer than 10 processed, the chart draws fewer than 10 lines and still shows "The chart shows the first 10 videos on this page that have data." — the 2026-11-05 decision in #311: the note follows the row count so the placeholder can predict it.
- A first-10 note band beside the sidebar from 48rem — not needed: the column there is at least 522.56px and the note one line at 444.5px, measured at every width from 768 to 1600.
- `rowsPastLaunchChart` import left unused in `LaunchChart.tsx` after the empty branch dropped it — it is still used at `LaunchChart.tsx:306`, and `pnpm lint` passes.

## Minor / nits
- `apps/web/src/launch-chart.test.ts:130` (`launchChartOf` over 30 rows) and `:382` (`launchPositionsOf`, "wherever they sit") state the same rule at adjacent layers, the chart taking its positions from the map. Defensible as one test per unit; the closest pair to a duplicate in the branch.
- `apps/site/test/screenshot/browser-walk.ts:1266-1271` computes the expected launch lines as `.slice(0, 10)` then filter, the pre-#311 order. Equivalent at the walk's `pageSize=10` address; it would expect the old rule only if that address moves to 25 or 50.
- `docs/reviews/creator-analytics-267/repro/review-5-finding-1.sh` exits non-zero only on the `ltotal`, `total` and `delay` notes, so a first-10 note mismatch in the html this branch edited prints and exits 0, and the app.css comment's 444.5px / 485px measurement cites no checked-in harness. Adding `*'"first":"'?/?!*` to the script's `case` would make the beside-the-sidebar half reproducible.
- `apps/web/src/app.test.ts:605` names three outcomes in one test name; it is #311's first acceptance criterion word for word, one rule seen three ways.
- `.placeholder-first-rows-note` repeats the `height: calc(var(--lines) * 0.9375rem * 1.6 + 1rem)` that `.placeholder-note, .placeholder-total-note` and `.placeholder-launch-total-note` also carry; a shared selector could name it.

## Test quality
Tests added or changed: 18 cases (17 tests plus the 4 rows of one `test.each`) · red at `ed67816` and green at HEAD: 13 · green against `ed67816`: 5, all with assertions byte-identical to the base at the case run, and none a prior finding's proof (`git log -S` on each name returns only `43f18e2`) · tautology shapes found: 0 (no expectation computed with a production helper, no mocked unit, no call-shaped assertion, no snapshot, no assertion-free test, no copy test; text constants appear only to observe which branch rendered).

Green at base, keep as they are:
- `components.test.ts:900` "with no row processed, shows its heading and approved empty sentence …", `:916` "with no row processed under "Running total" …", `launch-chart.test.ts:59` "draws one line per row with a processed day …", `:436` "does not show when a row on the page has a processed day, even all zeros": renamed only, pre-existing coverage of rules #311 did not change.
- `placeholder.test.ts:278` at size 10 (daily and aggregate): `firstRows` was already `[]` at size 10, so these rows assert what the base produced; the size-25 rows carry #311's change and are red at base. Finding 1 adds size 50.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and test all green locally at `566513d`; the browser walk green. Merges clean with `origin/main` at `9c73a81`.
- **Commit hygiene:** nothing uncommitted. This doc is the only addition.
- **Likely reviewer asks:** the epic body (#267) still states the #191 rule ("A row without a processed day draws no line but keeps its position", "Color goes with the row position on the page") and the old note text; #311's body supersedes it, so the PR description should say so. A screenshot at a 25-row page whose first 10 rows are unprocessed would show the change.

## Verdict
**Ready to open the PR, with follow-ups.** No finding gates it: all three confirmed findings are LOW wording and naming, and every acceptance criterion of #311 is met by a test that is red at the base. Findings 1 to 3 can be remediated on the branch before the PR or carried as one follow-up; item A needs Nick's call on sub-320px widths. This round has no prior findings to close (a `--fresh` review).
