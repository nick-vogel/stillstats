# Pre-PR review: creator-analytics#236 Video list paging and the daily table

**Branch:** `creator-analytics-236-video-list-paging-daily-table` vs `origin/main` (merge-base `3de6a3d`, Merge pull request #449 from nick-vogel/creator-analytics-267-launch-chart-color-per-video)
**Reviewed at:** HEAD `4a75957` (creator-analytics#236 merge origin/main (#267 and #311 launch chart, PR #449)) + 0 files with uncommitted changes, 0 untracked files. 26 files total, +1735 / −351, of which 21 are code and test files and 5 are earlier review records (`pre-pr-review-1.md` to `-4.md` and one repro).
**Delta under review:** since `2575ed7` (creator-analytics#447 Video list: keep focus on the list when a sort read is refused), the HEAD that `pre-pr-review-4.md` reviewed. The delta is `ecf8213` (review 4 itself) and two merges of origin/main: `225ad62` (merges `9c73a81`, PR #448, #338 support button, one conflict in `apps/site/test/screenshot/browser-walk.ts`) and `4a75957` (merges `3de6a3d`, PR #449, #267 and #311 launch chart, no conflict). `git diff 2575ed7` spans 65 files, but nearly all of that is main's own reviewed work. A per-file interdiff of the branch's net change (`git diff ed67816 2575ed7` against `git diff 3de6a3d HEAD`, hunk headers stripped) shows exactly one file whose branch contribution changed: `browser-walk.ts`, the conflict resolution's header comment and the #351 step's place after #338's 375px step. This review covers that resolution and the semantic interactions between main's new code and the branch's code that a textual auto-merge cannot catch.
**Reviewed against:** epic creator-analytics#236 and its children #239, #240, #241, #340, #341, #351, #447; `CODING_STANDARDS.md`; the Approach decisions, dismissals and close-out decisions carried in `pre-pr-review-1.md` to `pre-pr-review-4.md`; `.epic-loop/closeout.md` decision 2 (accept the origin/main merge, keep the walk steps from both sides).
**Date:** 2026-11-05
**Reviewer:** 1 code-review agent + verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Dependencies | `pnpm install --frozen-lockfile` | already up to date |
| Lint | `pnpm lint` (biome check .) | green, 552 files |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` | green (the existing 500 kB chunk warning only) |
| Unit and integration suites | `pnpm test` (Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | 127/127 files, 2900 passed, 1 expected fail, 29 s, no flake |
| Local browser walk | `pnpm run --if-present test:browser` | passed, no content security policy violation in 31 steps (28 at review 4, plus #338's profile Support step and its two sidebar support item steps) |
| Branch's own change since review 4 | per-file interdiff of the branch's net diff before and after the merges | only `browser-walk.ts` differs: header comment wording and the #351 step's position |
| Conflict resolution | `git show --cc 225ad62 -- apps/site/test/screenshot/browser-walk.ts`, and the `walk(...)` call order from top to bottom | every step from both sides kept, helpers each defined once, #351 step last; the header's order claim is off by one clause (finding 1) |
| State one step leaves for the next | finder agent read the #413 375px step and the #351 step | the 375px step restores the viewport in `finally` and leaves emulated media alone; #351 navigates to `/app/` fresh, sets and resets light and dark itself, and fails if the line colour is the same in both modes; no step clicks Hide |
| #351 column-line CSS reach over main's new markup | finder agent grep of `<table` and the column-line selectors | the rules hit only `.video-list`, `.chart-numbers`, `.numbers-table` and `.since-publish`; main added no table, and `.profile-section` and `.sidebar-support` hold no `th` or `td` |
| #338 focus against the refused-read focus effect | finder agent read `Sidebar.tsx`'s Hide and `VideoList.tsx:466-474` | Hide focuses the `nav` (`tabIndex={-1}`) before it saves, so focus never falls to the body and the refusal effect never fires from it; sidebar links use `RouteLink` without `land`, so they keep `window.scrollTo(0, 0)` |
| Main's tests against this branch's behaviour | finder agent diffed `app.test.ts`, `components.test.ts`, `placeholder.test.ts`, `web.test.ts` on both sides | none of main's additions asserts the caption, the daily table and its `tfoot`, the pager's `land`, or the column lines; all pass at HEAD |
| Independent re-run in a scratch worktree at `4a75957` | finder agent: `apps/web` unit files, `web.test.ts`, `placeholder.test.ts`, both typechecks, `node apps/site/test/screenshot/browser-walk.ts` | 1385 web unit tests and 85 web/placeholder tests green, walk passed in 31 steps; worktree removed |
| New tests in the delta | tautology audit | not run: the delta adds or changes no test assertion; the walk script moved one step and rewrote its header comment |
| Real Safari and Chrome, VoiceOver, 375px pager | not run: no browser automation for VoiceOver here | still owned by Nick's walk, #342 |

**Overall:** The merges are clean. The conflict resolution keeps every walk step from both sides, the full checks and the 31-step browser walk are green, and nothing main brought in reaches the branch's column lines, pager landing, or refused-read focus. The one new finding is LOW comment hygiene: the merged header comment says the desktop support item step runs after the 375px chart card steps, when it runs right after the list's route. Review 4's three stale comments are still there, unremediated by the LOW-tail rule, and are carried into the same aggregated finding.

## Approach decisions
- Where a pager link lands (#239): `RouteLink` takes an optional `land` callback, defaulting to `window.scrollTo(0, 0)`; `Pager` passes `land`, which calls `onTableRead()` and then `landOnList(table, controlsBar, window)` synchronously right after `navigate`. Kept. Main's #338 sidebar links use `RouteLink` without `land` and keep the default.
- Keeping the summary's place steady while another page reads (#239 review pass 1 finding 1, `189dbd9`): `readsAnotherPageOf` and `summaryPlaceListOf`, under "Publish day" only. Kept.
- The daily table (#241): `mode` removed from the numbers table's functions and component; `ViewsTable.total` required, `tfoot` unconditional. Kept.
- Focus on a refused list read (#341, review 2 finding 1 `e93a179`, #447 `ae893c4`): a `tableRead` ref in `VideoList`, set through `onTableRead` by the pager's `land` and by a sort heading's `onSort`; it clears on a `list` answer and when the refusal shows; an effect on `[refused]` focuses the `role="alert"` message (`tabIndex={-1}`, `preventScroll`) only when focus fell to the body or nowhere. Kept. Main's #338 Hide moves focus to the `nav`, never to the body, so the two do not interact.
- A line between every column (#351): each `th` and `td` of the four tables draws `border-inline-start: 1px solid var(--line)`, the first column's cells reset it, the sticky video column draws the line after it as `box-shadow: 1px 0 0 var(--line)`. Kept.
- Pinning a programmatic focus target (review 2 finding 2, `43b4cd6`): a test that asserts focus lands on an element also reads that element's `tabindex`. Kept.
- Merging origin/main's walk steps (`.epic-loop/closeout.md` decision 2, `225ad62`): keep every step from both sides; #338's profile and desktop sidebar steps stay where main put them, #338's 375px sidebar step runs after #399, and #351's column-line step runs last. Kept.

## Prior-review closure
Review 4 (`pre-pr-review-4.md`, at `2575ed7`) had one confirmed finding, finding 1, Comment hygiene, LOW. It has no remediation closure table: the LOW tail is left unfixed by default, and no scope note asked for it. Its three entries are untouched at HEAD (`app.css:155-156`, `VideoList.tsx:357`, `VideoList.tsx:571`, the same text) and are carried into finding 1 below. Fully fixed: 0. Partially fixed: 0. Untouched: 1 (LOW). Prior MEDIUM-or-higher findings left open: 0. Review 2's findings 3 and 4 (LOW) stay deferred by Nick's close-out decision 3, unchanged.

## Confirmed Issues

### 1. Comment hygiene — LOW (aggregated)
Attribution: the `browser-walk.ts` entry was introduced by the conflict resolution in `225ad62`. Main's version (`git show 3de6a3d:apps/site/test/screenshot/browser-walk.ts`, lines 19-21) joined the support item clause with "and" and ended it "at 375px last"; the merge turned it into "then the sidebar's support item ... at the desktop width after the list's route and at 375px", which reads as a sequence after #399. The desktop step (`state: sidebar support item`, `browser-walk.ts:400`) runs right after `visit('/app/')` and before `state: account menu open` (`:449`); only the 375px step (`:1927`) runs after #399 (`:1890`). The three other entries are review 4's finding 1, untouched: the `app.css` sentence came with `b446411` (#341) and went stale with `ae893c4` (#447), and the two `VideoList.tsx` comments came with `ae893c4`. None is a behavioural trap.
- `apps/site/test/screenshot/browser-walk.ts:7-8` — "every route, the profile with its Support section and its thanks line after Stripe's return (creator-analytics#411), then the account menu open" → "every route, the profile with its Support section and its thanks line after Stripe's return (creator-analytics#411), the sidebar's support item, its link and its Hide button at the desktop width after the list's route (creator-analytics#413), then the account menu open"
- `apps/site/test/screenshot/browser-walk.ts:19-20` — "then the sidebar's support item, its link and its Hide button, at the desktop width after the list's route and at 375px (creator-analytics#413), and last a line" → "then the sidebar's support item at 375px (creator-analytics#413), and last a line"
- `apps/web/src/app.css:155-156` — "and the video list's table a pager link focuses, or the refusal message in its place when that page's read is refused" → "and the video list's table a pager link focuses, or the refusal message in its place when the read a pager link or a sort heading started is refused"
- `apps/web/src/VideoList.tsx:357` — "A pager link or a sort heading in the table started the read, until it answers or is refused." → "A pager link or one of the table's sort headings started the read, until a list answer lands (after any redirect) or the refusal shows."
- `apps/web/src/VideoList.tsx:571` — "Told when a pager link or a sort heading in the table starts a read" → "Told when a pager link or one of the table's sort headings starts a read"

The two `browser-walk.ts` edits are one change: rewrap lines 7-26 of the header after making them, so the paragraph keeps its 100-column wrap, and keep "Neither support item step clicks Hide" as it stands. `pnpm lint` and `pnpm run --if-present test:browser` must stay green.

## Needs Further Investigation
Carried for Nick's walk, #342, unchanged by this round: review 1's A (the summary's height in after-publish windows other than "Publish day") and B (VoiceOver reading the new caption), and review 2's A (a screen reader reading the refusal message twice, also after a refused sort) and B (the fixed column's line at a fractional zoom).

## Reviewed and Dismissed
- An earlier walk step leaves state that makes the #351 step pass vacuously — the 375px support step restores the viewport in `finally` and does not touch emulated media; #351 navigates to `/app/` fresh, sets light and dark itself and resets both in `finally`, throws when the revenue sources fail to show or hide in both tables, and throws when the line colour matches in both modes.
- The support item in the 375px sidebar shifts the video list so the fixed-column check misreads — at 375px the sidebar is a flow block above the content, and `fixedColumnLineLost` measures against the table's own scroll box rect and `scrollLeft`, which the sidebar's height does not change. The walk passed at HEAD in two separate runs.
- Duplicate or shadowed walk helpers after the merge — `tableNamed`, `lineColour`, `wrongColumnLines`, `fixedColumnLineLost`, `sidebarSupportItem`, `narrow` and `viewport` are each defined once; the #351 step's locals are block-scoped.
- #351's column-line rules reach main's new markup — main added no table, and the rules are scoped to the four table classes. Main's `.sidebar-support button` rule is scoped and cannot reach the pager.
- #338's Hide drops focus to the body and triggers the refused-read focus effect — Hide focuses the `nav` (`tabIndex={-1}`) before saving, and the effect fires only when a pager link or sort heading started the read.
- Main's added tests contradict this branch's behaviour — none asserts the caption, the daily table, the pager's landing, or the column lines, and all pass at HEAD.
- The `nav` that Hide focuses may draw a focus ring for a keyboard user (finder agent, unverified in Chrome) — main's #338 code, outside this branch's surface and unchanged by the merge.
- Everything review 4 dismissed stands; the delta touches none of that code.

## Minor / nits
- Review 4's nit (the clear inside `if (refused)` in `VideoList.tsx` survives its mutant) and review 2's nits (the walk's fixed-column check reads `box-shadow`, not paint; column lines checked only at the wide viewport) stand unchanged.

## Test quality
The delta adds or changes no test assertion. The branch's only change since review 4 in a test file is the walk script's header comment and the #351 step's position after #338's 375px step, so the tautology audit had nothing to run on. Review 4's test-quality record covers the branch's tests and still holds.

## Before opening the PR
- **CI readiness:** `pnpm lint`, `pnpm typecheck`, `pnpm build` and `pnpm test` green at `4a75957`, and `test:browser` green in 31 steps.
- **Commit hygiene:** the tree was clean at review. Commit this doc. The five comment edits go in one commit if they are made.
- **Merge state:** HEAD contains origin/main at `3de6a3d`, the newest fetched at review time.
- **Likely reviewer asks:** the open walk, #342 (VoiceOver after a page change and after a refused read, the 375px pager, the fixed column at a fractional zoom); #339 (the empty list's screen reader name) stays open on the epic.

## Verdict
**Ready to open the PR as-is.** The two origin/main merges hold: the conflict resolution keeps every walk step from both sides, every full check and the browser walk are green, and no semantic interaction between main's support button or launch chart work and this branch was found. The only confirmed finding is LOW comment hygiene (one new header clause from the merge, plus review 4's three untouched comments), which can ride in the PR or be dropped. 0 CRITICAL, 0 HIGH, 0 MEDIUM, 1 LOW. Prior MEDIUM-or-higher findings left open: 0. The confirmed count stays at one LOW aggregate, and the delta was a merge, so there was no behaviour change to find.
