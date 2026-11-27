# Pre-PR review: creator-analytics#267 follow-ups #374, #375 and #376 (key step on the pointer's point, note places beside the sidebar, the first-10 note's read key)

**Branch:** `creator-analytics-267-launch-chart-color-per-video` vs `origin/main` (merge-base `4c032ab`, "Merge pull request #409 from nick-vogel/creator-analytics-359-tanstack-charts")
**Reviewed at:** HEAD `c9525ce` (creator-analytics#374 Charts: a key step onto the point the pointer holds announces that point) + 0 files with uncommitted changes, 0 untracked files, 12 files total, +309 / −100
**Reviewed against:** epic creator-analytics#267 (its body is the spec; its earlier work landed on main as PR #377, `d592eb2`, an ancestor of the merge-base) and the three open children this branch carries: #374, #375, #376; `CODING_STANDARDS.md`; the Approach decisions of `pre-pr-review-5.md`, and its findings 1 and 4, which #375 and #376 were filed from
**Date:** 2026-11-04
**Reviewer:** 2 code-review agents + tautology audit agent + verify pass. A full (`--fresh`) review of the 8 commits since the merge-base: #376 (`2783c87`, `4b0e9ce`), #375 (`92ec296`, `33c1c00`), #374 (`ac5a7bd`, `c9525ce`) and two merges of the epic branch into the lanes (`ba598f0`, `9146226`).

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | ok, already up to date |
| Lint | `pnpm lint` | green, 539 files |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` | green |
| Test suite | `pnpm test` (Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | green: 124 files, 2772 passed, 1 expected fail |
| Browser walk | `pnpm run --if-present test:browser` | green: no content security policy violation in 27 steps |
| #375 acceptance | `sh docs/reviews/creator-analytics-267/repro/review-5-finding-1.sh` | MATCH, exit 0, no `!` in any column |
| #375 band edges to the pixel | finder's scratch copy of the script with 766 to 769, 858 to 872, 878 to 891, 1000 to 1034, 1050, 1200, 1440, 1920, 2400 | every row matches; edges at 767/768, 869/870, 888/889, 1031/1032 as app.css says; Switzer confirmed loaded via `document.fonts` |
| #375 every place a note placeholder renders | finder read of `MetricChartsPlaceholder` (`ChannelSummaryFigures.tsx:78`, `VideoDetail.tsx:271`), `AfterPublishPlaceholder`, `VideoDetail.tsx:263` and their loaded counterparts, plus the containers' CSS | every place is the full screen column the repro models; `.app`'s `max-width: 76rem` caps the column at about 952px, wider than every note's one-line width |
| #375 a signed-in screen from 48rem without the sidebar | read of `App.tsx:257-264` | none renders these placeholders: failed channels render no screen, no channels render only the connect text |
| #375 pins go red | finder's mutation harness on the real `rulesIn`/`valueIn`; then a scratch worktree at HEAD with `@media (min-width: 60rem) { .placeholder-note { --lines: 1; } }` appended to `app.css` | red on band removed, reordered before the one-line rule, media text changed, `--lines: 1`. **Green with a later overriding rule** (finding 1) |
| The May 1 delay note beside the sidebar | finder's scratch copy of the repro page with the 99 character May note, re-run at 773, 974, 975, 1031 | 2 lines to 974px, 1 from 975px; the comment's "773px" is wrong (comment hygiene) |
| #374 behaviour on both `useChartSlider` callers | read of `CursorPlot.tsx:137`, `LaunchChart.tsx:161-163`, `:210`, `:245` | the launch chart's row hover, mode and page paths reach the guard with `selection` null, so old and new guards agree there |
| #376 `channelOnView` against `shownChannelId` | read of `App.tsx:253-265`, `:512-550`, `ChannelSummaryFigures.tsx:111`, `:176` | equivalent; `VideoList` and `ChannelSummaryFigures` get the same channel object, so writer and reader key alike |
| #376 callers of `listRowsExpectedFor` | `grep -rn listRowsExpectedFor apps/web/src` | only `Placeholder.tsx:177` and the tests; none left on the old signature |
| Tautology audit | branch test files run at `4c032ab` in a scratch worktree | see Test quality: every ticket proof test is red at base |
| Em-dashes in shipped strings | read of the diff | none added outside this doc |

**Overall:** All three children do what their issues ask, every full check is green, and each ticket's proof test fails at the merge-base. #375's repro now prints MATCH with every band edge exact to the pixel, #374 reads a point's values when a key step lands on the point the pointer holds, and #376 puts the first-10 note's reader on the list's own read key. What remains is three LOW test and refactor findings and one batch of comment corrections, none of which gates the PR.

## Approach decisions
- Live region (#312, #322, #343, #374): `emptied` empties an announcement for a pointer, a tap or a hide; a key step that stays on its point reads its values only while this plot's own region (`announcer === plotId ? text : ''`, now the `spoken` const in `ChartSlider.tsx:83`) is empty. Precedent: `ChartSlider.tsx:102-109`.
- Placeholder parity (#314, #324, #375): every note the loaded chart shows under a predictable condition gets its own placeholder shape, measured per width in headless Chrome in the signed-in shell with the sidebar beside the screen from 48rem, and a band the sidebar changes gets its own `(min-width: 48rem) and (max-width: …)` rule placed after the one-line rule. **This review adds:** each shape's `--lines` rules are pinned as one ordered table per selector, so a missing, extra or reordered rule goes red (finding 1). Precedent: the video title's `lineCounts` table at `apps/web/test/web.test.ts:444-451`.
- First-10 note prediction (#325, #344, #376): one module-level memo in `video-list.ts` (`answeredRows`), written by `VideoList` under `listReadOf(addressRoute, channel, saved).query` (`VideoList.tsx:328`, `:378`) and read by the list (`VideoList.tsx:410`) and by `listRowsExpectedFor` (`video-list.ts:127-135`) through the same `listReadOf`.
- Review repro files: `biome check .` lints `docs/reviews/**/repro/`, so a repro must pass `pnpm lint` before it is committed. A shell repro is outside biome's file types.

## Prior findings this branch claims to close
- Review 5 finding 1 (both running total notes a line short beside the sidebar): **fixed** by #375. The repro prints MATCH, the delay note included.
- Review 4 finding 4 (the comment over the note places contradicting itself): **fixed in substance** by #375's rewrite; four smaller inaccuracies in the new text sit in comment hygiene (finding 4).
- Review 5 finding 4 (the #325 placeholder skipping the list's route rewrite): **fixed** by #376, with a unit proof and an App proof, both red at base.
- Review 5's other findings (2, 3, 5 to 9) concern code that landed on main in PR #377 and is outside this branch's diff; this review did not re-check them.

## Confirmed Issues
### 1. The new sidebar-band pins compare each band with one named rule only, so a later rule that overrides the band passes the suite — LOW
- **Location:** `apps/web/test/web.test.ts:715-720`, `:746-751`, `:798-803`, and the helper `placeOf` at `:98-107`
- **Attribution:** introduced. `git log --oneline -S'placeOf' 4c032ab..HEAD` shows `92ec296` (creator-analytics#375).
- **Real-world trigger:** a later edit to `app.css` adds a `--lines` rule for one of the three note places after the band (a new breakpoint, a copy-paste of a neighbour). The placeholder is then a line short in part of the band and the page moves 24px when the chart lands, with the suite green. No user path today: the rules as written are correct, which the repro proves. LOW, capped: a test-strength gap, not a defect.

**Evidence**
```ts
      const band = '(min-width: 48rem) and (max-width: 64.4375rem)'
      expect(valueIn(own, '.placeholder-note', '--lines', band)).toBe('2')
      expect(placeOf(own, '.placeholder-note', band)).toBeGreaterThan(
        placeOf(own, '.placeholder-note', '(min-width: 52.0625rem)'),
      )
```

**Failure mode** — Executed: in a scratch worktree at HEAD, `@media (min-width: 60rem) { .placeholder-note { --lines: 1; } }` appended to `apps/web/src/app.css` makes the delay note's placeholder hold 1 line from 960px to 1031px, where the loaded September note takes 2. `pnpm exec vitest run apps/web/test/web.test.ts -t "delay note's placeholder"` stays green (1 passed). The same holds for the two running total notes by construction: each test compares the band only with the one rule it names. `placeOf` also copies the inline `alignedAt` at `web.test.ts:571-579` (the last index of a rule naming a selector), which standard 3 asks the change to fold rather than repeat.

**Recommended fix** — Replace `placeOf` with a helper that lists every rule giving a selector its `--lines`, and pin each shape's whole table, as the video title's test does at `web.test.ts:444-451`.

```diff
-/**
- * Where in the sheet's @media rules the last rule naming `selector` in the block of `media` sits,
- * so a test can pin which of two rules of equal specificity comes later and wins. -1 when none.
- */
-function placeOf(css: string, selector: string, media: string): number {
-  return rulesIn(css).findLastIndex(
-    (rule) =>
-      rule.media === media && rule.selector.split(',').some((listed) => listed.trim() === selector),
-  )
-}
+/**
+ * Each rule that sets `selector`'s `--lines`, as its @media text (null outside any) and the count:
+ * the rule outside any @media first, then the @media rules in sheet order, where a later one wins.
+ */
+function lineCountsOf(css: string, selector: string): [string | null, string | undefined][] {
+  return rulesIn(css)
+    .filter(
+      (rule) =>
+        rule.selector.split(',').some((listed) => listed.trim() === selector) &&
+        /--lines\s*:/.test(rule.body),
+    )
+    .map(({ media }) => [media, valueIn(css, selector, '--lines', media)])
+}
```

In the delay note's test, replace the four `--lines` assertions (`:706`, `:710-711`, `:715-719`) with:

```ts
      expect(lineCountsOf(own, '.placeholder-note')).toEqual([
        [null, '3'],
        ['(min-width: 27.4375rem)', '2'],
        ['(min-width: 52.0625rem)', '1'],
        ['(min-width: 48rem) and (max-width: 64.4375rem)', '2'],
      ])
```

In the running total note's test (`:735`, `:739-742`, `:746-750`):

```ts
      expect(lineCountsOf(own, '.placeholder-total-note')).toEqual([
        [null, '3'],
        ['(min-width: 22.5625rem)', '2'],
        ['(min-width: 41.875rem)', '1'],
        ['(min-width: 48rem) and (max-width: 54.3125rem)', '2'],
      ])
```

In the launch chart's running total note's test (`:786`, `:789-794`, `:798-802`):

```ts
      expect(lineCountsOf(own, '.placeholder-launch-total-note')).toEqual([
        [null, '3'],
        ['(min-width: 23.375rem)', '2'],
        ['(min-width: 43.0625rem)', '1'],
        ['(min-width: 48rem) and (max-width: 55.5rem)', '2'],
      ])
```

Keep each test's existing comments on where the widths come from, folded above its table. `alignedAt` stays as it is: it tests `text-align` outside any @media, a different question.

**Remediation brief**
- **Design intent:** each note's placeholder holds `--lines` lines of the note; the count is a base rule plus `min-width` rules measured with no sidebar, then one band from 48rem measured beside the sidebar, placed last so it wins over the one-line rule where both match. The pin must fail on any change to that set or its order.
- **Full surface:** `apps/web/test/web.test.ts:98-107` (`placeOf`, deleted), `:706-719`, `:735-750`, `:786-802`. `rulesIn` and `valueIn` come from `@creator-analytics/visual-system/testing` (imported at `:42-55`). No production file changes.
- **Must preserve:** the three tests' height-formula and padding assertions (`:702-705`, `:731-734`, `:782-785`), their names, the other `--lines` pins in the file (the first-10 note's, the title's at `:444-451`), and `alignedAt` at `:571-582`.
- **Do not touch:** `apps/web/src/app.css`; its rules are correct (repro MATCH). The 52.0625rem rule stays as the ticket prescribed (see Minor / nits).
- **Proof:** red before green by mutation in a scratch worktree, never in the live tree: `git worktree add --detach <scratch>/mut HEAD`, `pnpm install --frozen-lockfile --prefer-offline` there, append `@media (min-width: 60rem) { .placeholder-note { --lines: 1; } }` to its `apps/web/src/app.css`, then `pnpm exec vitest run apps/web/test/web.test.ts -t "delay note's placeholder"`. Green today, red after the fix. Without the mutation, `pnpm exec vitest run apps/web/test/web.test.ts -t "placeholder"` is green.

### 2. #374's second case, a key step on a plot whose group's last reading came from another plot, is named in the guard's comment and has no test — LOW
- **Location:** `apps/web/src/ChartSlider.tsx:102-109`
- **Attribution:** introduced. `git log --oneline -S'another plot of the group' 4c032ab..HEAD` shows `ac5a7bd` (creator-analytics#374).
- **Real-world trigger:** a screen reader user steps the first of the stacked metric charts, tabs to the second, which keeps the card, and presses Home or End onto the day already held. Rare, and the code does what the issue asks; the gap is that reverting this half of the guard keeps the suite green. LOW: no user-visible failure today.

**Evidence**
```ts
    // A step that stays on its point, as Home on the first, reads its values when this plot's region
    // is empty: a pointer or a tap placed the card and emptied it, or another plot of the group
    // spoke last (creator-analytics#374). While the region already holds them, it reads nothing
    // again.
    const stays = selection !== null && sameAs(selection, next)
    if (reading && (!stays || spoken === '')) {
```

**Failure mode** — The stacked-plot harness `stackedPlots()` (`apps/web/src/app.test.ts:1431-1457`) sends every key to `firstPlot`, and its `liveRegion` reads the first chart's region only. `grep -n "secondPlot.dispatchEvent" apps/web/src/*.test.ts` finds nothing; the retention pair's test uses only steps that move. So no test covers a staying step on a plot whose region is empty because another plot spoke. A guard narrowed to the pointer case (for example `spoken === '' && group.announcer === plotId`) would pass the whole suite.

**Recommended fix** — Add one App test in `describe("a video's detail screen")` beside the #374 cases (`app.test.ts:1513-1542`): `stackedPlots()`, `press('End')` on the first plot (day 2, read in the first region), move focus to the second plot with `leaveFor(secondPlot)` and focus it, dispatch `keydown` `End` on `secondPlot`, then assert the second chart's own live region (`p.visually-hidden[aria-live="polite"] > span` inside the second `.metric-chart`) reads that day's values and the first chart's region is empty. Extend `stackedPlots()` to return a `secondLiveRegion` and a `pressOn(plot, key)` rather than copying its setup.

**Remediation brief**
- **Design intent:** a slider group shares one announcement; each plot's region shows it only when that plot made it (`spoken`). A key step that moves always reads; one that stays reads only when this plot's region is empty, which happens after a pointer, a tap, a hide, or when another plot of the group made the last announcement. Correct behaviour here: the second plot's region reads the held day's values once, and the first plot's region shows nothing.
- **Full surface:** `apps/web/src/app.test.ts:1431-1457` (`stackedPlots`, gains the second region and a per-plot press), one new test after `:1542`. No production change.
- **Must preserve:** the existing stacked tests at `:1459-1511` (focus moves keep the card, Home on the first point reads nothing new, Escape empties the region) and the two #374 cases at `:1516-1542`.
- **Do not touch:** the guard itself; it matches #374's acceptance (see Reviewed and Dismissed, "the second plot reads again").
- **Proof:** `pnpm exec vitest run apps/web/src/app.test.ts -t "<the new test's name>"` must go red with the guard at `ChartSlider.tsx:107` changed (in a scratch worktree) to `if (reading && (!stays || (spoken === '' && group.announcer === plotId)))`, and green at HEAD.

### 3. The #376 tests copy a channel fixture three times, one copy inside the scope of the helper it repeats — LOW
- **Location:** `apps/web/src/video-list.test.ts:944-950`, beside `channelOf` at `:875-883`; a third copy of `channelOf` at `apps/web/src/placeholder.test.ts:215-223`
- **Attribution:** introduced. `git log --oneline -S'function channelOf' 4c032ab..HEAD` shows `2783c87` (creator-analytics#376).
- **Real-world trigger:** none for users. Standard 3: a refactor the change walked past on its own path. LOW.

**Evidence**
```ts
    (_, sort, saved) => {
      const channel: ListedChannel = {
        id: `c-rewritten${sort}`,
        youtubeChannelId: 'UC1',
        title: 'A channel',
        handle: null,
        revenueConsentedAt: null,
      }
```

**Failure mode** — The literal is byte for byte `channelOf`'s body, inside the `describe` where `channelOf` is in scope. A later change to the fixture (a new required `ListedChannel` field) has to be made in three places.

**Recommended fix**
```diff
-      const channel: ListedChannel = {
-        id: `c-rewritten${sort}`,
-        youtubeChannelId: 'UC1',
-        title: 'A channel',
-        handle: null,
-        revenueConsentedAt: null,
-      }
+      const channel = channelOf(`c-rewritten${sort}`)
```

**Remediation brief**
- **Design intent:** each #325/#376 case names its own channel id because the rows memo lives as long as the test file; the channel's other fields only need no revenue consent.
- **Full surface:** `apps/web/src/video-list.test.ts:944-950`. The cross-file copy at `placeholder.test.ts:215-223` may stay: a shared fixture would mean a new test-support module, which this round does not ask for.
- **Must preserve:** each case's distinct channel id (`c-rewritten-estimatedMinutesWatched`, `c-rewritten-estimatedRevenue`), so the memo entries never collide; `revenueConsentedAt: null`, which the revenue case's rewrite depends on.
- **Do not touch:** the seeding through `listReadOf(...).query` (see Reviewed and Dismissed, "the #376 unit test seeds with the function the reader calls").
- **Proof:** `pnpm exec vitest run apps/web/src/video-list.test.ts -t "which the list reads newest first"`: 2 passed before and after.

### 4. Comment hygiene — LOW (aggregated)
- `apps/web/src/app.css:1289-1290` — "Every width was measured in Chrome with Switzer" → "Every width comes from a measurement in Chrome with Switzer" (the 333, 439 and 833px widths below are moved up, not measured).
- `apps/web/src/app.css:1296-1297` — "The 1 line widths are the measurements with no sidebar, and take effect past the band's end." → "The 1 line widths are the measurements with no sidebar: below 48rem each takes effect from its own width, and from 48rem only past the band's end."
- `apps/web/src/app.css:1300` — "and 1 from 833px (52.0625rem)" → "and 1 from 833px (52.0625rem), a rule that beside the sidebar takes effect only past the band, from 1032px".
- `apps/web/src/app.css:1303-1304` — "With no sidebar the 99 character note of May 1 drops a line at 419px and 773px, so a shorter month can move what follows up a line just past those widths." → "The 99 character note of May 1 drops a line at 419px with no sidebar, and beside the sidebar takes 1 line from 975px (measured 2026-11-04 the same way), so a shorter month can move what follows up a line just past 419px and from 975px to the band's end." (From 768px the sidebar is always beside the screen, so the 773px width never occurs; measured: the May note is 2 lines at 974px and 1 at 975px.)
- `apps/web/src/app.css:1381-1382` — "The 1 line width is the measurement with no sidebar, and takes effect past the band's end." → "The 1 line width is the measurement with no sidebar: below 48rem it takes effect from 689px, and from 48rem only past the band's end."
- `apps/web/test/web.test.ts:13-15` — "they cannot see a rule that outranks another, a title's wrap, or the widths the note wraps at, which app.css takes from a measurement in Chrome." → "they see the order of the rules that set a placeholder's lines, not a title's wrap or the widths the note wraps at, which app.css takes from a measurement in Chrome; the bands beside the sidebar come from docs/reviews/creator-analytics-267/repro/review-5-finding-1.sh." (Apply after finding 1, whose tables are what makes the order visible.)
- `apps/web/test/web.test.ts:98-101` — only if finding 1 is not applied: "Where in the sheet's @media rules the last rule … sits" → "The index, among all of `rulesIn`'s rules (those outside any @media first), of the last rule naming `selector` in the block of `media`".
- `apps/web/src/video-list.test.ts:952` — "// The list remembers its answer under the query it sends, through listRouteFor's rewrite." → delete; it repeats the comment over the `test.each` at `:936-937`.
- `docs/reviews/creator-analytics-267/repro/review-5-finding-1.sh:4-5` — "Exit 1 while the launch total, the summary total or the delay note ("delay") mismatches at any width." → add "The first-10 note ("first") is printed but not gated."

## Needs Further Investigation
None.

## Reviewed and Dismissed
- `spoken` stale inside `onKeyDown` — computed in the render that creates the handler; React flushes discrete key events synchronously, so the next key sees the new render.
- A re-read of identical text is swallowed — `announcementAfter` always increments `step`, and the span is keyed on `step`, so the same text is a new node after `emptied` or after another plot spoke.
- The launch chart's behaviour changes under #374 — a row hover (#312), a mode or page change (#323) and a pointer select all reach the guard with `selection` null or after `group.quiet()`, where old and new guards agree.
- The second plot reads again after focus moved to it — this is #374's rule as written (the region a plot shows is `announcer === plotId ? text : ''`, and a staying step reads when that is empty). Do-not-touch for finding 2.
- The guard checks "non-empty" while its comment says "holds the point's values" — every change of a plot's selection either announces or empties its region, so a non-empty region holds the current point's values; no path in `CursorPlot` or `LaunchChart` changes a card's values under an unchanged selection.
- `channelOnView` differs from `shownChannelId` in `ChannelSummaryFigures` — `selectedChannelOf` returns `ListedChannel | null`, and `shownChannelId` is `channelOnView ? channelOnView.id : null` (`App.tsx:265`); the summary read's effect depends on the id string, so a new object with the same id reads nothing again.
- `listReadOf(route, null, saved).pageSize` differs from the old `pageSizeOf(route, saved)` — with no channel `listReadOf` uses the address route unchanged; with one, `listRouteFor` rewrites sort and source columns only.
- The #376 unit test seeds with the function the reader calls — the seed plays the writer (`VideoList.tsx:328`, `:378` write exactly that key), the expectation is a literal, and both cases are red at base. The App test pins the real writer and reader end to end.
- `drawsFirstRowsNote` counts removed nodes — deliberate and documented in its docstring: a note added inside a subtree and taken back in the same step shows up only among removed nodes. It can only cause a false red.
- `placeOf` returns -1 for both sides and passes — `valueIn(…, band)` must already be `'2'`, and a missing one-line rule fails its own `valueIn` pin first.
- The band is wrong on the video page's delay note place (`VideoDetail.tsx:263`) — its placeholder sits in `.placeholders` and its note in `section.video-detail`, both full-width grids in the same screen column; the repro's model holds.
- A signed-in screen from 48rem without the sidebar renders these placeholders — none does (`App.tsx:257-264`).

## Minor / nits
- `apps/web/src/app.test.ts:46` is 172 characters: #374's header edit added a sentence without re-wrapping. `apps/web/src/ChartSlider.tsx:102` is 101. Biome's `lineWidth: 100` does not reflow comments.
- `apps/web/src/ChannelSummaryFigures.tsx:111` and `:176` both derive `const channelId = channel === null ? null : channel.id`; `AfterPublishPlace` could take the id from its parent.
- The band tests hard-code `48rem` apart from the sidebar's own pin (`web.test.ts:325`); a moved sidebar breakpoint would leave the bands green and wrong.
- Below 1032px the `.placeholder-note` rule at 52.0625rem is entirely shadowed by the band; one `(min-width: 64.5rem)` rule would say the same thing, but #375 prescribed the band after the existing rules.
- The #374 cases start from a region that was never filled; #343's tests already cover a pointer emptying a region a key step filled.
- Under page zoom a fractional viewport just above each band's end (for example 1031.0 to 1031.47px) gets the one-line placeholder for a two-line note; every breakpoint in the sheet shares this.
- `docs/reviews/creator-analytics-267/repro/review-5-finding-1-note-places.html:1` calls all four notes "the launch chart's notes"; two of them also render under the summary's charts.

## Test quality
Tests added or changed: #374 two App cases (`app.test.ts:1516-1542`) and one assertion (`:1502`); #376 two unit cases (`video-list.test.ts:936-956`), one App case (`app.test.ts:2394-2417`) with its `drawsFirstRowsNote` helper, and the #325 tests moved to the channel signature in `video-list.test.ts`, `placeholder.test.ts` and `components.test.ts`; #375 three widened tests in `web.test.ts`. Green against `$BASE` that assert something new: 0. Every ticket proof test is red at `4c032ab` on its real assertion: #374 `expected '' to be 'Engaged views 600, Views 700'` (and `… 800` for End), #376 `expected 25 to be 7` and `expected true to be false`, #375 `expected undefined to be '2'` three times. The tests green at base are the #325 refactors whose expectation is the page size and the `:1502` assertion, which guards the other half of #374's guard. Tautology shapes found: 0. Strength gaps: finding 1 (a later overriding rule passes) and finding 2 (the other-plot case untested).

## Before opening the PR
- **CI readiness:** `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` all green at `c9525ce`; the browser walk green.
- **Commit hygiene:** the branch is clean; commit this doc as `creator-analytics#267 pre-PR review 6`.
- **Likely reviewer asks:** why the 52.0625rem rule stays when the band shadows it (the ticket's shape); whether the second stacked plot reading again on Home is wanted (it is #374's rule).

## Verdict
**Ready to open the PR, with follow-ups.** No finding gates it: findings 1 to 3 are LOW test and refactor gaps and finding 4 is one batch of comment corrections, all fit for `/pr-review-remediate` before the PR or a follow-up after. All three prior findings this branch claimed to close (review 5 findings 1 and 4, review 4 finding 4) are closed in code, none by a comment or doc edit alone; #375's rewritten comment carries the four inaccuracies listed in finding 4.
