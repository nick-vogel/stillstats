# Pre-PR review: creator-analytics#268 Channel audience screen, third PR (#476, #477, #469, #463, #468), round 3

**Branch:** `creator-analytics-268-channel-audience-screen` vs `origin/main` (merge-base `a187286` "Merge pull request #475 from nick-vogel/creator-analytics-238-own-channel-metrics")
**Reviewed at:** HEAD `454254f` ("creator-analytics#268 The revenue card's RPM line stays under the stuck date range bar"). The tree was clean, with no uncommitted or untracked files at review time. Against the merge-base: 32 files, +2,770 / −796, in 16 commits.
**Delta under review:** since `56391d7` ("creator-analytics#268 pre-PR review 6 remediation closure table"), the HEAD pre-PR review 7 reviewed. The delta is 4 files, +208 / −17: review 7 itself (`41d5af9`) and one fix from Nick's phone walk, `454254f`, which touches `apps/web/src/app.css`, `apps/web/test/web.test.ts` and `apps/site/test/screenshot/browser-walk.ts`. Review 7 had no remediation round (no closure table), so its one finding is carried as it stood.
**Reviewed against:** pre-PR review 7 (its finding 1, Approach decisions, Minor list and deferred MEDIUMs); the fix's own intent from `454254f` (Nick's phone walk on 2026-11-06: the RPM line painted over the stuck date range bar); `CODING_STANDARDS.md` 1 to 3 and the five binding review rules; the in-repo stacking-context precedents `.numbers-table` (`app.css:1234`) and `.video-list-scroll` (`app.css:474`).
**Date:** 2026-11-06
**Reviewer:** 1 code-review agent (delta) + base-oracle and mutant checks + verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | up to date |
| Lint | `pnpm lint` (biome) | pass; pass again with this doc added |
| Typecheck | `pnpm typecheck` | pass |
| Build | `pnpm build` | pass |
| Full suite | `pnpm test` (Docker up, Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | 131 files, 3,147 passed, 1 expected fail, first run; no flake |
| Browser walk | `pnpm run --if-present test:browser` | passed, "No content security policy violation in 44 steps" |
| The new web test at the pre-fix code | finder agent: scratch worktree at `56391d7` with HEAD's `apps/web/test/web.test.ts` copied in, `pnpm exec vitest run apps/web/test/web.test.ts -t "raised RPM line"` (worktree removed after) | red: `expected undefined to be '0'` at `web.test.ts:1503`; green at `454254f` |
| The new walk step can go red | finder agent: scratch worktree at `454254f` with the one `z-index: 0;` line under `.card-chooser` deleted, `pnpm build`, `pnpm run test:browser` (worktree removed after) | only "state: RPM line under the stuck date range bar" failed, in all four cells ("on /app/ at 375px the RPM line paints over the stuck date range bar: "RPM: $4.37"", and the same on the video page and at 1280x640). In each cell the line's centre was under the stuck bar, so only the hit test failed |
| `z-index: 0` breaks nothing else | finder agent: read of the #356 press (line z 1 still above the label's `::after` inside the card's context, confirmed by the mutant's hit tests finding the button), focus rings (no `overflow` on `.card`, so nothing clips; the context paints in the same z-0/auto layer in tree order as before), hover and chosen borders, popups (none in `Cards.tsx`; menus and tooltips are portals at z 2, the toast at z 3) | no change outside the line's stacking |
| Anything else raised over the bar | `z-index` in `app.css` and `git grep` for `z-[`, `zIndex`, `isolate` in `apps/web/src` | every other raised element sits inside `.video-list-scroll` or `.numbers-table`, each its own z-0 context; the chart hover card, `.chart-label` and `.thumbnail-length` carry no z-index |
| 1280x640 makes the cards choose | `stackedChartsQuery` is `'(min-width: 60rem) and (min-height: 45rem)'` (`stacked-charts.ts:7`); 640px is under 720px | the cards choose, so the step exercises the desktop case it names |
| Walk header order | header lists #356, #268, #399; `walk(...)` calls at `browser-walk.ts:2718`, `:2774`, `:2840` | in run order |
| Comment lines over 100 columns in the delta | `git diff -U0 56391d7` filtered to added comment lines longer than 100 | four (finding 1) |
| Review 7's carried entries still stand | `grep` of each quoted text at HEAD | all present; line numbers past the walk's header moved by 2, and `app.css`'s past line 265 by 4 (finding 1 gives HEAD's) |
| Not run | a real phone; Safari; Chrome's minimum font size setting | Nick's walk (#335) |

**Overall:** The phone walk's fix is the right one and the smallest: `.card-chooser` takes its own stacking context, the shape `.numbers-table` and `.video-list-scroll` already use against the same sticky bar, and it holds by a stylesheet test red at the pre-fix code and a walk step that goes red, in all four cells, without the one line. Every full check passes. No CRITICAL, HIGH or MEDIUM. What remains is the one aggregated comment hygiene LOW, review 7's untouched entries plus four over-long comment lines the fix added, and Minor items. The branch is ready for its PR.

## Approach decisions
- Carried from reviews 1 to 7, unchanged: copy with no approval is Nick's decision, recorded and not fixed by remediation; test gaps close with a test in the existing describe for their rule, never with a production change; duplication inside the branch's own new code folds into the rule or helper it copies; the walk's header lists the steps in the order the `walk(...)` calls run; #477's container queries hold the placeholders; the column shows only where the window holds every row, by `sidebarColumnQuery`; the account row's avatar keeps its size with `flex-shrink: 0`; width-only wording says "in the column" or "from `sidebarColumnQuery`" (review 7).
- New, landed in `454254f`: content raised with a z-index inside the scrolled screen is held under the sticky controls bar by giving its nearest positioned box `position: relative; z-index: 0`, never by raising the bar. Precedent `.numbers-table` (`app.css:1234`) and `.video-list-scroll` (`app.css:474`). Each such rule gets a stylesheet test beside `web.test.ts:1111`'s shape and, where only hit testing shows it, a walk step.

## Prior-review closure
Review 7 named one finding. **Fully fixed: 0.** **Partially fixed: 0.** **Untouched: 1 (LOW).**
- 1 (LOW, comment hygiene): **untouched**. Review 7 had no remediation round, so every entry still stands; each is carried into this doc's finding 1, at HEAD's line numbers.

Review 7 named no MEDIUM-or-higher finding, so none is left open. Its "Known MEDIUMs, deferred by decision at the ticket reviews" (#463 F1.1 and #468 F1.1) are ticket-review findings, not review 7's, and stay as it listed them.

## Confirmed Issues

### 1. Comment hygiene — LOW (aggregated)
New in `454254f`, comment lines past 100 columns (introduced; rewrap each, moving the last word or words to the next line):
- `apps/site/test/screenshot/browser-walk.ts:33` (105 columns): "...where the bar paints on top (creator-analytics#268), the" → end the line after "(creator-analytics#268)," and start line 34 with "the".
- `apps/site/test/screenshot/browser-walk.ts:2769` (101): "...so a line" → move "line" to line 2770.
- `apps/web/src/app.css:268` (101): "...The card's own" → move "own" to line 269 and rewrap the comment's tail.
- `apps/web/test/web.test.ts:1494` (101): "...in the page's stacking" → move "stacking" to line 1495.

Carried from review 7 finding 1, untouched (review 6 finding 3's entries):
- `apps/web/src/AccountMenu.tsx:28-30`: "in the sidebar's footer, at the window's bottom, it opens beside the sidebar, its bottom at the avatar's, where there is room for it" → "in the sidebar's footer, at the window's bottom, it opens to the avatar's right, its bottom at the avatar's, where there is room for it: over the email beside the avatar while the sidebar is open, and beside the sidebar when it is collapsed". Introduced, `f699430`.
- `apps/web/src/App.tsx:600-601`: "The screen's top heading; the wordmark and the channel picker name it on sight." → "The screen's top heading. With more than one channel the picker names it on sight; collapsed in the sidebar's column, the channel icon's tooltip names it on a hover or a focus." Pre-existing at `a187286`, exposed by `f699430`.
- `apps/web/test/web.test.ts:150-153` (`lineCountsIn`): "Outside any block first, then the @media blocks, then the @container blocks, each in the sheet's order, which is the order a later rule wins in." → "Outside any block first, then the @media blocks, then the @container blocks, each in the sheet's order. That is the cascade's order only while no `--lines` rule sits under @media, which the 'no placeholder's lines follow the window' test holds, and each @container rule follows in the sheet the rule outside any block that it overrides." Introduced, `fc5f5f4`.
- `apps/site/test/screenshot/browser-walk.ts:23-24`: the header leaves out the #469 step between the #468 clause and the date range bar inset. After "(creator-analytics#468)," insert "then each publish day bar row as tall as its place, a long title cut short to one line, at 320px to 1440px (creator-analytics#469)," and rewrap the clause at 100 columns (line 24 is 145 characters). Introduced, `fbdf227` and `5b6c4a1`.
- Other comment lines the branch added past 100 columns in `apps/site/test/screenshot/` (`screen-ready.ts:2` and `:4`, the #469 comment, and the rewrapped `browser-walk.ts:24`). Rewrap each. To list them all, the four above included: `git diff a187286 -- apps/ | grep -E '^\+ *(//|\*|/\*)' | awk 'length > 101'`.

Carried from review 7 finding 1, the width-only wording (introduced by `f699430` or `b345f83`'s partial sweep):
- `apps/web/src/app.css:1799-1801`: "Below the tablet width they stack, the sidebar's links in a row under the header with no menu button; from it the sidebar is a column at the window's left edge" → "Outside the sidebar's column they stack, the sidebar's links in a row under the header with no menu button; in it, from 48rem on a window tall enough for its rows, the sidebar is a column at the window's left edge".
- `apps/web/src/app.css:1823`: "and 3rem holds the 2.5rem avatar" → "and 3rem holds the 2.5rem avatar, 1px of it in the panel's padding beside the 1px border".
- `apps/web/src/app.test.ts:3793-3794`: "1024px wide unless a test sets it, so these tests render the sidebar as the column it is from 48rem, and the ones at 375px the row below it" → "1024x768 unless a test sets it, so these tests render the sidebar as the column `sidebarColumnQuery` gives, and the ones at 375px, or too short, the row".
- `apps/web/src/app.test.ts:4746`: "the x from 48rem and "Hide" below" → "the x in the column and "Hide" in the row".
- `apps/web/test/web.test.ts:302`: "its row below 48rem" → "its row outside the column".
- `apps/web/test/web.test.ts:543` test name: "written for the width the sidebar renders its column from" → "written for the window the sidebar renders its column on".
- `apps/site/test/screenshot/browser-walk.ts:369`: "the x from 48rem and "Hide" below" → "the x in the column and "Hide" in the row". `:581`: "from 48rem the sidebar runs the window's full height" → "in its column the sidebar runs the window's full height". `:2331-2332` and `:2395` describe walk windows 900px tall, where width alone decides; add "on the walk's tall windows" to each rather than changing the code.
- `apps/site/test/screenshot/screen-ready.ts:2`: "or from 48rem the sidebar's nav in its place" → "or, in the sidebar's column, its nav in its place" (with the rewrap above). `screen-ready.test.ts:28` test name: "from 48rem a signed-in screen" → "beside the sidebar's column a signed-in screen".
- The describe names `app.test.ts:3894` 'the sidebar from 48rem (creator-analytics#476)' and `:4021` 'the sidebar below 48rem (creator-analytics#476)' run at 1024x768 and 375x812. Leave them, or rename to 'the sidebar as a column' and 'the sidebar as a row'.

## Needs Further Investigation
None.

## Reviewed and Dismissed
- `z-index: 0` on `.card-chooser` trapping the #356 RPM line under the label's stretched `::after`: both now sit in the card's own context, where the line's z 1 still paints and hit-tests above the `::after` (z auto). The #356 walk step passes at HEAD, and the mutant's hit tests found the button itself. Do not raise the line's z-index or move the `::after`.
- The card's focus ring (`.card-choose:focus-visible::after`, 5px outside the card) now clipped or painted under a neighbour: a stacking context does not clip, `.card` has no `overflow`, and the context paints in the same z-0/auto positioned layer in tree order as the z-auto card did, so its order against neighbours is unchanged.
- Raising `.controls-bar` instead: the repo's two precedents contain the raised content, and a higher bar would change its order against the portals at z 2 and the toast at z 3 for no gain.
- Another raised element painting over the stuck bar: every other `z-index` in the screen is inside `.video-list-scroll` or `.numbers-table`, each a z-0 context already; the chart hover card, `.chart-label` and `.thumbnail-length` carry none.
- The new web test reading back the stylesheet's values: the file's norm for stacking rules (`web.test.ts:1111-1121` for `.numbers-table`, `:1191-1192` for `.video-list-scroll`), and it is red at `56391d7`. Its `.controls-bar` z-index assertion repeats `:1117`, as the precedent does. The walk step is the behavioural check. Keep the test.
- The walk step passing vacuously: a hidden line has no accessibility node, so `rpmLine` throws; a page too short to scroll or a bar that does not stick fails the `stuck.top <= 0.5 && under in (top, bottom)` check and throws; and the mutant went red in all four cells.
- The long template-string lines in the walk step (`browser-walk.ts:2801`, `:2810`) and the 141-character test name: code, formatted by biome, which passes. Not comment hygiene.

## Minor / nits
- The new walk step (`browser-walk.ts:2774-2834`) throws at once when a cell's line is not under the bar or the date range sits in no sticky bar, but collects paint failures and runs on. One cell with a bad position hides the other cells' results. Diagnostics only; it never passes wrongly. Pushing those to `failures` and `continue` would match the paint branch.
- The new comment's precedent: `app.css:265-271` names no precedent, and `.video-list-scroll` (`app.css:474`) is nearer than `.numbers-table`. No action.
- Carried from review 7, unchanged: `components/ui/sidebar.tsx:164`'s dead `max-md:hidden` (needs Nick's word, review 6 finding 1's Do not touch); the 5.6px headroom above 24rem at 1024x384 with no walk step holding it; the short-window app test (`app.test.ts:3944-3966`) not checking "Hide" or an ignored saved `sidebarOpen: false`; the collapsed avatar's 1px past its content box.

### Known LOWs from the ticket reviews, still open
As review 6 listed (`.epic-loop/tickets/<n>/review-1.md`): #476 F1.2 to F1.11; #477 F1.1 to F1.10; #469 F1.1 to F1.8; #463 F1.2 to F1.10; #468 F1.2 to F1.7.

### Known MEDIUMs, deferred by decision at the ticket reviews
Unchanged from reviews 6 and 7: #463 F1.1 (the Audience placeholder's three bar rows against up to eleven bars), to the proposal "The Audience placeholder's bar rows"; #468 F1.1 (a wrapped video page section heading skipped), to the proposal "A video page section heading's place holds the lines its heading wraps to on a phone". Neither is a finding here.

## Test quality
Tests added or changed in the delta: 1 web test case (`web.test.ts:1494-1505`) and 1 walk step (`browser-walk.ts:2768-2834`), plus the `rpmLine` helper extracted from the #356 step unchanged in behaviour (its message is now a parameter, and the #356 call keeps "at 375px"). Red without the fix: the web test at `56391d7` (`expected undefined to be '0'`); the walk step on the one-line mutant, all four cells. Green at the pre-fix code: 0. Shapes found: none. The web test is a stylesheet read-back, the file's own shape for stacking rules, and the walk step measures Chrome's hit testing. Its `finally` scrolls to the top and restores `viewport`, so the next step inherits neither.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and the full suite pass at `454254f`, and the browser walk passes. This doc passes biome.
- **Commit hygiene:** this doc is the only new file. Nothing to drop.
- **Likely reviewer asks:** the open children #329 (Privacy Policy wording) and #335 (Nick's walk in Chrome and Safari, which found this round's fix); the deferred MEDIUMs as follow-up issues; whether any other raised content can meet the sticky bar (none today, and the Approach decision names the shape for the next one).

## Verdict
**Ready to open the PR as-is.** No CRITICAL, HIGH or MEDIUM. The one new commit fixes Nick's phone walk finding with the repo's own stacking-context shape, holds by a test red at the pre-fix code and a walk step red without the line, and introduced no defect this round could find beyond four over-long comment lines. The confirmed list stays at one aggregated comment hygiene LOW, the floor review 7 already reached: what grew is wording, not behaviour. The LOW and the Minor items can ride along or follow. Prior findings: review 7 named no MEDIUM-or-higher finding; its LOW finding 1 is untouched, with no remediation round between, and is carried in full.
