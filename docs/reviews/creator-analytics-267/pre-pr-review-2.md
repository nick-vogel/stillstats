# Pre-PR review: creator-analytics#267 Launch chart: one marked video, the processed note, the empty state and a color per video

**Branch:** `creator-analytics-267-launch-chart-color-per-video` vs `origin/main` (merge-base `b10c8d4` "Merge pull request #309 from nick-vogel/creator-analytics-253-marketing-site-seo")
**Reviewed at:** HEAD `d0c21f7` ("creator-analytics#267 pre-PR review 1 remediation closure table"). The tree was clean, with no uncommitted or untracked files at review time. Full surface against `$BASE`: 23 files, +1,573 / −168, 16 commits.
**Delta under review:** since `d7bf6ae` ("creator-analytics#273 Launch chart: the hover card lists every drawn video"), the HEAD that `pre-pr-review-1.md` reviewed. 4 commits (`a7c5921` the review doc, `16a2433` finding 1's fix, `5b513d5` lint-clean repro files, `d0c21f7` the closure table), 5 files, +371 / −1. The only code change is 7 lines of `apps/web/src/app.css`.
**Reviewed against:** the epic body of creator-analytics#267 and its child issues #181, #175, #176, #191 and #273 (as distilled in review 1), `CODING_STANDARDS.md` 1 and 2, `pre-pr-review-1.md` finding 1 (the intent of the fix) and its remediation closure table.
**Date:** 2026-10-20
**Reviewer:** 1 code-review agent and a verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | up to date |
| Lint | `pnpm lint` | pass (483 files) |
| Typecheck | `pnpm typecheck` | pass |
| Build | `pnpm build` | pass |
| Full suite | `pnpm test` (Docker up, Testcontainers Postgres) | 110 files, 2,494 passed, 1 expected fail (`packages/token-vault/src/token-vault.test.ts:619`, a `test.fails` not in this diff), as in review 1 |
| Round 1 finding 1 proof | `repro/review-1-finding-1-card-375.html` in headless Chrome | `"coversPlot":false`, green as the fix should give |
| Round 1 finding 2 proof | `pnpm exec vitest run --config docs/reviews/creator-analytics-267/repro/review-1.vitest.config.ts -t "finding 2"` | still red, as expected: finding 2 was deferred |
| Card under the plot, real page layout | happy-dom App render at `?window=first28` with 10 and 12 videos, key selection shown, markup dumped with scripts stripped, real `styles.css` and `app.css` linked, hosted in an exact-width iframe in headless Chrome at 320, 375, 414, 600, 768, 1024, 1280 and 1920px; `elementFromPoint` at every card row's centre and five points across the plot | 16 of 16 cells: all 10 rows hit the card, 5 of 5 plot points hit the plot, no ancestor clips the card, `scrollHeight` unchanged by the card. Narrowest clearance to `.video-list-scroll`: 20px at 1024px and wider with 10 videos. Control at `top: 0`: the plot is covered. |
| A later stacking context painting over the card | same harness with the list's note and column switches hidden, so the list starts above the card's bottom | the list's `th` paints over rows 9 and 10: the mechanism is real, and today about 20px of in-flow content keeps it from happening. See Dismissed. |
| Sticky controls bar still covers the card on scroll | same harness, scrolled so the card's top sits at 60px, at 375px | rows 1 to 5 hit the controls bar, rows 6 to 10 the card: correct. With `z-index: 1` on the card, the card paints over the bar, so that candidate is ruled out. |
| Other charts keep `top: 0` | `git grep launch-chart -- '*.tsx'`; grep of `app.css` for other `top` on `.chart-hover-card` | only `LaunchChart.tsx:142` (empty state, no plot) and `:197`; no other rule or media query; the new selector (0,2,0) beats `.chart-hover-card` (0,1,0) |
| A test guarding the fix | `git grep -n 'chart-hover-card' -- '*.test.ts'` | one DOM query at `app.test.ts:350`; no stylesheet assertion. Finding 1. |
| Repro files lint-clean | `pnpm exec biome check docs/reviews/creator-analytics-267/repro/` | clean |
| New tests in the delta | Phase 4.5 | the delta adds no suite test; the only new test is the review 1 repro. See Test quality. |
| Browser-only behaviour | not run in the real app | the card's placement on a real phone (Needs Further Investigation B) and the card swatch's corners (A, carried from review 1). Nick's browser walk, per the epic. |

**Overall:** Round 1's one MEDIUM is fixed and proved: on every width tried, the plot stays clear and every card row stays readable. No new defect in behaviour. Two LOWs: no suite test can go red if the placement rule is deleted or given a z-index, and four comments around the card now mis-describe it. Round 1's LOW findings 2 to 6 stay open, deferred by the remediation's scope. The PR can open.

## Approach decisions
- Mark origin (#181): the shared mark carries `by: 'row' | 'chart'`, and the chart shows its held selection only while the mark is the chart's. Round 1 finding 2 extends it: a clear (`null`) from one origin ends only a mark of that origin. Precedent: the `by` field itself, `apps/web/src/video-list.ts` `ListMark`.
- Launch chart day card placement (round 1 finding 1, landed in `16a2433`): the card sits under the plot (`top: calc(100% + 0.25rem)`), scoped to `.launch-chart` only; horizontal placement stays with `cardLeftOf`; the card takes no z-index, so the sticky controls bar covers it on scroll. Precedent: the card is already positioned by CSS in `.chart-hover-card` (`apps/web/src/app.css:1041`).
- Placement guard (this review, finding 1): the stylesheet rule is pinned in `apps/web/test/web.test.ts` through `valueIn(webOwnSheet(), …)`, the way that file already pins the stacking rules of the controls bar and the numbers table. Precedent: `apps/web/test/web.test.ts:566-576`.
- Placeholder parity (round 1 finding 3): every note the landed launch chart shows under a predictable condition gets a placeholder shape whose line counts are measured per width. Precedent: `.placeholder-total-note` and `.placeholder-note` in `apps/web/src/app.css` (now `:1585-1617`), guarded by `apps/web/test/web.test.ts:646`.
- Review repro files: `biome check .` lints `docs/reviews/**/repro/` with the code, so a repro page or test must pass `pnpm lint` before it is committed. Precedent: the lint-clean `.ts` repros under `docs/reviews/creator-analytics-253/repro/`.

## Prior-review closure
Review 1 had six confirmed findings: one MEDIUM and five LOW.
- **Fully fixed: 1.** Finding 1 (MEDIUM), `16a2433`. Verified against its intent, not only its diff: in the real page layout at eight widths the plot is clear and all ten rows are readable, other charts keep `top: 0`, `max-width: 100%` and `cardLeftOf` placement hold, and the card has no z-index.
- **Partially fixed: 0.**
- **Untouched: 5,** all LOW and all deferred by decision: review 1's closure table reads "deferred: LOW tail, Nick's call" for findings 2, 3, 4, 5 and 6. Their briefs in `pre-pr-review-1.md` stand unchanged. The one drift: line numbers in `apps/web/src/app.css` past `:1151` moved down by 5 (finding 3's `:1572-1612` is now `:1577-1617`). Finding 2's repro is still red.
- **Resolved only by a comment or doc edit: 0.**

## Confirmed Issues

### 1. No suite test can go red if the launch card's placement under the plot is deleted or given a z-index — LOW
- **Location:** `apps/web/src/app.css:1162-1164` (`.launch-chart .chart-hover-card { top: calc(100% + 0.25rem); }`); the missing case belongs in `apps/web/test/web.test.ts`
- **Attribution:** introduced by `16a2433` ("creator-analytics#267 pre-PR review 1 finding 1: on a phone the ten-row day card covers the whole launch chart plot"), which changed only `app.css` (`git show --stat 16a2433`). Its proof is the review 1 repro page, which the suite does not run.
- **Real-world trigger:** none for users today; a later edit that drops the rule, or "fixes" a stacking question with `z-index: 1` on the card, passes the whole suite and brings back review 1 finding 1 or puts the card over the sticky controls bar. CODING_STANDARDS 2 (tests that can go red). LOW, capped: no user path until such an edit.

**Evidence**
```css
.launch-chart .chart-hover-card {
  top: calc(100% + 0.25rem);
}
```
`git grep -n 'chart-hover-card' -- '*.test.ts'` finds only `apps/web/src/app.test.ts:350`, a DOM query for the card's rows.

**Failure mode** — delete the rule, or add `z-index: 1` to it: `pnpm test` stays green. Executed for the z-index half: with `z-index: 1` on the card, headless Chrome at 375px, scrolled so the card's top is at 60px, hit-tests all ten rows as the card, over the sticky controls bar, where at HEAD rows 1 to 5 hit the bar.

**Recommended fix** — a new case in `apps/web/test/web.test.ts`, beside "the numbers table's sticky heading and total rows stay below the sticky controls bar" (`:566-576`), in that test's shape:
```ts
  testWithoutDatabase(
    "the launch chart's day card sits under the plot, below the sticky controls bar, and every other chart's card over its plot (creator-analytics#267 pre-PR review 1 finding 1)",
    async () => {
      const own = await webOwnSheet()

      expect(valueIn(own, '.chart-hover-card', 'top')).toBe('0')
      expect(valueIn(own, '.launch-chart .chart-hover-card', 'top')).toBe('calc(100% + 0.25rem)')
      expect(valueIn(own, '.launch-chart .chart-hover-card', 'z-index')).toBeUndefined()
      expect(valueIn(own, '.chart-hover-card', 'z-index')).toBeUndefined()
      expect(valueIn(own, '.controls-bar', 'z-index')).toBe('1')
    },
  )
```
The comment the neighbouring tests carry about what a stylesheet test cannot see (no layout engine) is not needed here; the test name states the rule.

**Remediation brief**
- **Design intent:** `HoverLineAndCard` (`apps/web/src/ChartHover.tsx`) renders the card inside `.chart-plot` (`position: relative`) and sets only its `left` through the style property; vertical placement is pure CSS. The launch chart's card, up to ten rows, sits under its plot so the lines stay visible; every other chart's card sits over its plot at `top: 0`. The card has no z-index on purpose, so the sticky controls bar (z-index 1, earlier in the page) covers it when the page scrolls.
- **Full surface:** `apps/web/test/web.test.ts` only (a new case near `:566-576`, using the file's existing `webOwnSheet` and `valueIn`). No production change.
- **Must preserve:** every other `web.test.ts` case; the `.controls-bar` z-index assertions at `:439`, `:573` and `:625`.
- **Do not touch:** `apps/web/src/app.css:1162-1164` itself (verified correct, see Dismissed).
- **Proof:** `pnpm exec vitest run apps/web/test/web.test.ts -t "day card sits under the plot"` green; then delete the three lines of the `.launch-chart .chart-hover-card` rule locally and see it go red, and restore them. Run the whole of `apps/web/test/web.test.ts` green after.

### 2. Comment hygiene — LOW (aggregated)
- `apps/web/src/app.css:1020` — "The plot a chart's hover card sits over." → "The plot a chart's hover card is placed against: over it, or under it on the launch chart."
- `apps/web/src/app.css:1039-1040` — "The card's left edge is set through the style property, beside the line and inside the plot." → "The card's left edge is set through the style property, beside the line and inside the plot's width." (the launch card now sits outside the plot vertically)
- `apps/web/src/chart-hover.ts:84-86` (`cardLeftOf`) — "so a card with no room beside the line covers it rather than running off the chart and the page" → "so a card with no room beside the line covers it, or on the launch chart sits under it, rather than running off the chart and the page"
- `apps/web/src/app.css:1152-1155` — the sentence "The card sits under the plot rather than over it, as with ten rows it is taller than the plot." describes the separate rule at `:1162`, not `.launch-card-rows`. Move it to a comment directly above `.launch-chart .chart-hover-card` and extend it with the decision a later reader would otherwise undo: "The card sits under the plot rather than over it, as with ten rows it is taller than the plot. No z-index, so the sticky controls bar, earlier in the page at z-index 1, still covers it; it clears the video list, a later stacking context, only by the notes and the list's controls between them."

## Needs Further Investigation

### A. The card's swatch may render square where the list's is rounded — confirm in the browser
Carried from review 1, unchanged. `.chart svg { overflow: visible }` (`app.css:977-982`) also matches the card's swatch. Confirm by zooming on a card swatch beside a list swatch in Nick's browser walk; fix, if wanted, by adding `overflow: hidden` to `.chart .launch-swatch`.

### B. On a phone, the card now opens mostly below the fold and over the axis's day labels — confirm on a device
At 375px with the page at its top, the harness puts the card at y 525 to 749 (row centres 559 to 732) and over the axis labels "Day 1" and "Day 28", the notes and the list's "Videos per page" and "Show unlisted and private" controls. On a 667px-tall phone the first rows may start at the bottom edge. The card stays up while the page scrolls (a blur clears it, a scroll does not), and it has `pointer-events: none`, so the content is reachable and the controls stay usable; the loss is visual and only while the card shows. Confirm or kill in Nick's 375px walk on a real phone: if the rows read badly, the placement decision in Approach decisions is where a different one gets chosen, as review 1's brief anticipated.

## Reviewed and Dismissed
- The video list painting over the card's lower rows — `.video-list-scroll` (`position: relative; z-index: 0`, later in tree order) would paint over the card if they overlapped, and the tight harness shows it. In the real layout they never overlap: 20px clearance at its narrowest (1024px and wider, 10 videos), from the list's average-viewed note and column switches, both unconditional in after-publish windows (`VideoList.tsx:445`, `:559`). The dependence is recorded in the comment hygiene finding.
- `z-index: 1` on the card as a guard against the above — executed: it paints the card over the sticky controls bar. Rejected.
- Other charts' cards moving — the rule is scoped to `.launch-chart`, which only `LaunchChart.tsx:142` (empty state, no card) and `:197` render.
- The card being clipped or growing the page — no ancestor clips it, and `scrollHeight` is the same with and without the card at every width.
- The card no longer clamped to the plot's width — `max-width: 100%` still holds: card and plot share 68 to 355px at 375px.
- The `.launch-card-rows` comment's reason ("with ten rows it is taller than the plot") — accurate: card 224px against plot 160px at 375px and at 1280px.

## Minor / nits
- `repro/review-1-finding-1-card-375.html` gives `--window-size=375,800`, but headless Chrome's minimum window is 500px, so it renders at viewport 500 (its title prints `"vw":500`). The page pins `main` to 375px, so the measurement stands.

## Test quality
The delta adds no suite test. Its one new test file is the review 1 repro (`repro/review-1.test.ts`, finding 2, red by design while finding 2 is deferred). The fix commit `16a2433` landed with its proof outside the suite, which is finding 1. No tautology shapes in the delta. Review 1's test findings (its finding 4) are untouched and deferred.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and the full suite are green at `d0c21f7`.
- **Commit hygiene:** the branch is clean; this doc is the only addition.
- **Likely reviewer asks:** the card's placement on a real phone (B); the deferred LOWs from review 1, especially finding 2 (a keyboard selection lost to a stray mouse movement) and finding 3 (the page jumps at page sizes 25 and 50); the palette's 3:1 contrast, which no test holds (a loop proposal under #191).

## Verdict
Ready to open a PR as-is. No gate: the round 1 MEDIUM is fixed and proved against its intent, and this round confirms two LOWs (a missing guard test, comment hygiene), both cheap and neither blocking. Of review 1's six findings, 1 is fixed, 0 partially fixed, 5 untouched (all LOW, deferred by the remediation's scope), and 0 were resolved only by a comment or doc edit. The confirmed list shrank from six to two, and both are guard and comment work rather than behaviour bugs: the branch is converging.
