# Pre-PR review: creator-analytics#268 Channel audience screen, second PR, after the merge of origin/main

**Branch:** `creator-analytics-268-channel-audience-screen` vs `origin/main` (merge-base `4a7488c` "Merge pull request #454 from nick-vogel/creator-analytics-236-video-list-paging-daily-table")
**Reviewed at:** HEAD `13475ae` ("Merge remote-tracking branch 'origin/main' into creator-analytics-268-channel-audience-screen"). The tree was clean, with no uncommitted or untracked files at review time. 40 files, +4,514 / −217 against the merge-base, 1,733 of the added lines in `packages/database/drizzle/meta/0018_snapshot.json`.
**Delta under review:** since `bb93809` ("creator-analytics#417 Sidebar: the shadcn Sidebar, collapsing to icons"), the HEAD that pre-PR review 4 (`pre-pr-review-4.md`, committed as `f9d9b6d`) reviewed. The delta is review 4's doc and repro, and the merge `13475ae` of `origin/main` (PR #453 and #454, creator-analytics#236: video list paging that lands the table under the controls bar, a daily-only numbers table, a line between every table column). A per-file comparison of the branch's diff before the merge (`3de6a3d..bb93809`) and after it (`4a7488c..13475ae`) shows one source file changed: `apps/site/test/screenshot/browser-walk.ts`, whose header comment conflicted and was resolved by hand. Every other file's branch diff is line for line the one review 4 read. The review therefore covers that resolution and the places where the branch's changes and #236's changes now meet.
**Reviewed against:** the epic creator-analytics#268 and its children as distilled in review 4; `CODING_STANDARDS.md` 1 to 3; the finding headings and Approach decisions of pre-PR review 4; the run's close-out decisions (`.epic-loop/closeout.md`).
**Date:** 2026-11-06
**Reviewer:** 1 code-review agent + verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | up to date |
| Lint | `pnpm lint` (biome, 556 files) | pass, before and after this doc was added |
| Typecheck | `pnpm typecheck` | pass |
| Build | `pnpm build` | pass (web JS 766.9 kB, 252.2 kB gzip; vite's 500 kB chunk warning) |
| Full suite | `pnpm test` (Docker up, Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | 128 files, 2,951 passed, 1 expected fail, first run; no flake |
| Browser walk | `pnpm run --if-present test:browser` (real Chrome, built app, stub API) | passed, "No content security policy violation in 35 steps" |
| Which branch diffs the merge changed | for each file in `git diff --name-only 4a7488c HEAD`, the sorted `+`/`-` lines of `git diff 3de6a3d bb93809 -- f` against `git diff 4a7488c 13475ae -- f` | only `browser-walk.ts` (and review 4's own files) differ |
| The conflict resolution | `git show --remerge-diff 13475ae`; agent read of the header against every `walk(...)` call | the content of every clause is kept from both sides; the order is wrong in one place (finding 1) |
| State the walk's steps leave behind | agent read of the collapse step (`browser-walk.ts:429-489`), the 375px sidebar step (`:2173`), the column lines step (`:2314`) | each resets its viewport, color scheme or sidebar; nothing a later step depends on leaks |
| #236's landing and heading hold against #350's inset bar | `heading-hold.ts:41-46`, `:55-70`, `:100-105` against `app.css:380-388` (`position: sticky; top: 0`, 1px border all round, no margin) | `offsetHeight` and `getBoundingClientRect().bottom` both include the new top border; the stuck bar's bottom is still its height. Holds by reasoning; not observed in a browser (Minor) |
| `followInPlace`'s new `land` parameter (#236) against the sidebar | `RouteLink.tsx:10-25`; `Sidebar.tsx:51` | the sidebar passes no `land`, so a screen switch still lands at the top |
| #351's column lines against the collapsed sidebar and the measured places | `app.css` `border-inline-start` rules and the fixed column's `box-shadow` (`:465-468`); the branch's CSS diff | width independent; the branch touches no table selector; no measured place sits in a table |
| #327 against #236's paging | `routeAfterLostSwitches` in `video-list.ts`, `listRouteFor`; `git grep -n 'startsColumnGroup\|column-group-start'` | consistent; no reference to #236's removed names is left |
| Prior findings at HEAD | `grep` for each of review 4's locations | findings 1 to 5 unchanged; finding 6's walk header entry closed by the merge (below) |
| Tests the delta adds | none: the merge resolution edits a comment, and the branch's test files are textually unchanged | tautology audit not re-run; review 4's stands |
| Browser-only behaviour | not run beyond the walk | NFI B (the stuck bar's corners), a pager landing in real Chrome, Nick's walk #335 |

**Overall:** The merge of `origin/main` is clean in effect. The hand-resolved header of the browser walk keeps every clause from both sides, all five full checks pass on the merged tree, and none of #236's paging, landing, daily table or column lines breaks against the branch's inset controls bar, collapsible sidebar, Audience cards or placeholders. The one new finding is the walk's header placing the two desktop sidebar steps near the end of the walk, when they run second and third. Review 4's six LOWs are carried, untouched apart from one comment entry the merge fixed. The branch is ready to open its PR.

## Approach decisions
- Carried from reviews 1 to 4, unchanged: copy with no approval is Nick's decision, recorded and not fixed by remediation; test gaps close with a test in the existing describe for their rule, never with a production change; duplication inside the branch's own new code folds into the rule or helper it copies.
- Carried from review 4: the collapsed sidebar's placeholders (its finding 1) take a collapsed band scoped to `.signed-in-shell:has(> .sidebar[data-collapsible="icon"])` beside each "beside the sidebar" band, measured with `repro/collapsed-sidebar-placeholders.sh`, not container queries; the Audience grid's track (its finding 3) is one declaration for both grids, a selector list.
- The walk's header (finding 1 here): the header lists the steps in the order the `walk(...)` calls run, as it does for every other clause.

## Confirmed Issues

### 1. Comment hygiene — LOW (aggregated)
- `apps/site/test/screenshot/browser-walk.ts:7-8` and `:22-27` — the header lists the sidebar's desktop support item step (creator-analytics#413) and the collapse step (creator-analytics#417) after the 375px launch chart card, but they run second and third, right after the routes and the profile (`walk('state: sidebar support item')` at `:406`, `walk('state: sidebar collapsed to icons')` at `:429`, before `walk('state: account menu open')` at `:539`). Correct to: at `:7-8`, "every route, the profile with its Support section and its thanks line after Stripe's return (creator-analytics#411), then the sidebar's support item, its link and its Hide button, at the desktop width (creator-analytics#413), and the sidebar collapsed to its icons from its button, a collapsed icon's tooltip on a focus and the sidebar expanded again (creator-analytics#417), then the account menu open, ..."; at `:22-27`, "(creator-analytics#399), then the sidebar's support item at 375px (creator-analytics#413), with its links in one row and no collapse button (creator-analytics#417). Last comes ...". Attribution: the #413 clause's place is pre-existing on `origin/main` (`git show 4a7488c:apps/site/test/screenshot/browser-walk.ts | sed -n 19,21p`); the #417 sentence beside it is introduced, `65306bc`, and kept by the merge `13475ae`.

## Needs Further Investigation
### A. The support answer read on a tab's return can land after a newer read and bring the item back — confirm with two held reads
Carried from review 4, unchanged at HEAD: `App.tsx:391` calls `readSupport().then(setSupport, () => {})` on every `visibilitychange` to visible, with no guard on order, beside the first read (`:314`) and the reset's (`:439`). Confirm in `apps/web/src/app.test.ts` with the fake API's `api.hold('GET /api/me/support')` twice, releasing the second before the first. Fix shape if it holds: `latestOnly` (`apps/web/src/api.ts:18-31`), the guard the Audience read uses. In the run's collector as B3.

### B. Scrolled content may show through the stuck controls bar's rounded corners — confirm by a screenshot
Carried from review 4: `app.css:380-388` gives the sticky bar a 0.75rem radius on the page's background, so the corner areas outside the radius are transparent once it sticks. #236 makes the case routine on the list: every pager link now scrolls the page so the table's top sits right under the bar (`heading-hold.ts:41-46`), and the held heading rows sit at its bottom edge (`:100-105`), so rows are under the bar after every page change. Confirm with a headless Chrome screenshot of `/app/` after "Next page", and of the channel screen scrolled by 400px, at 1280px. Nick accepted proposal P1 ("screenshot first") for filing under #268 in the close-out of 2026-11-06.

## Reviewed and Dismissed
- `listLandingTopOf` (`heading-hold.ts:41-46`) uses the bar's `offsetHeight`, written for the base bar with a bottom border only — `offsetHeight` is the border box, so the new top border is counted, and the bar still sticks at `top: 0` with no margin now that #350 dropped `.app .controls-bar`'s gutter margin, so "its bottom is its height" holds.
- `headingOffsetOf`'s `barBottom` (`heading-hold.ts:102`) against the inset bar — `getBoundingClientRect().bottom` includes the border; the inset changes the bar's width only, and that width is now the screen column the table sits in.
- `SidebarProvider`'s wrapper becoming a scroll container that breaks `window.scrollTo` or the sticky bar — it is a plain `div` with class `signed-in-shell`; the only `overflow` rules are on descendants (`.video-list-scroll`, the numbers box, the collapsed link text).
- `followInPlace` gained `land` (#236) while `Sidebar.tsx:51` calls it with three arguments — `land` undefined scrolls to the top, which a screen switch wants; the base sidebar's `RouteLink` passed no `onFollow` or `land` either.
- #351's `border-inline-start` on every non-first cell, and the fixed column's `box-shadow: 1px 0 0 var(--line)`, inside the collapsed sidebar's wider column — neither depends on the column's width; the branch's CSS diff touches no `.video-list`, table, `th` or `td` selector; at 375px the sidebar is a row above the screen.
- #351's 1px cell borders invalidating the branch's measured places — the measured places (the video head's title, the notes, the Audience cards) sit in no table; the video list title measurement at `app.css:1248` is `origin/main`'s, below 40rem where the sidebar plays no part.
- `routeAfterLostSwitches` (#327) against #236's paging — it delegates to `listRouteFor`, which #236 did not change in meaning; #236's `listKey` and `readsAnotherPageOf` are not on its path.
- `web.test.ts`'s #351 rule scans seeing the branch's rules — they filter to selectors under `.video-list `, `.numbers-table `, `.since-publish ` and `.chart-numbers `, and the branch adds no table or rule under them; the suite passes.
- The collapse step's `finally` (`browser-walk.ts:485-488`) re-expands only when "Expand the sidebar" is on view, so a failure after the save of `sidebarOpen: false` but before the button shows would leave later steps collapsed — the save is optimistic (`App.tsx:337`), so the collapsed sidebar and its Expand button render with the click, before the save lands; a failure after the Expand click leaves the sidebar open. The window is not reached, and the step itself fails first in any case.

## Minor / nits
- Nothing observes a pager link's landing in a real browser: the walk has no pager step, and `heading-hold.test.ts` and `app.test.ts` run under fakes or happy-dom, where `offsetHeight` is 0. The branch changed the bar box that geometry reads; the reasoning above holds, but a walk step that clicks "Next page" on `/app/` and checks `|table top − bar bottom| < 1` with the sidebar open and collapsed would observe it. `offsetHeight` rounds to a whole pixel while the hold reads the fractional bottom, so a fractional bar height could land the table up to half a pixel off; that is the same on `origin/main` with the old bar. Pre-existing coverage of #236.

## Prior-review closure
Review 4 (at `bb93809`) confirmed six LOWs and no MEDIUM or above. The run converged on it, so no remediation ran.
- Fully fixed: none.
- Partially fixed: finding 6 (Comment hygiene), one of its six entries: the 130-character header line at `browser-walk.ts:27` is gone, re-wrapped by the merge's resolution (`awk 'length > 100'` on the header's first 45 lines finds nothing at HEAD). The other five entries are untouched.
- Untouched: findings 1 to 5. They are LOW, so none is a MEDIUM-or-higher finding left open.

### Carried forward from review 4, still open
Unchanged and not re-rated; review 4's briefs apply as written, with these locations at HEAD (`app.css` lines moved by #236's merge, +11 around the grids and +28 from the placeholder bands on):
- Finding 1, the collapsed sidebar's placeholder notes: `app.css:1893-1895` (the collapsed column), against the bands at `:1312`, `:1400`, `:1406`, `:1461`, `:1586`, `:1598`, `:1653` and `:1714`. Repro: `pnpm --filter @creator-analytics/web build && sh docs/reviews/creator-analytics-268/repro/collapsed-sidebar-placeholders.sh`. Accepted for filing as proposal P3 in the close-out.
- Finding 2, `RouteLink`'s `ariaCurrent` with no caller: `RouteLink.tsx:36`, `:47`, `:59`.
- Finding 3, the Audience grid's copied track rule: `app.css:690` beside `:677` (`.video-detail-breakdowns` at `:675`, `.audience-grid` at `:688`).
- Finding 4, copy and repeated-rule tests: `app.test.ts:3823`; `sidebar.test.ts:30`, `:42`, `:54`, `:66`; `components.test.ts:1436`, `:1508`, `:1525`, `:1635`; `app.test.ts:3490`.
- Finding 5, the walk's blind spots: `browser-walk.ts:439` (collapsed width only), `:2009` (`left` and `width` only).
- Finding 6, the five remaining entries: `app.css:376-378` (two entries), `web.test.ts:495`, `web.test.ts:431`'s test title, `video-step.ts:71`.
- Review 3's still-open findings 2, 4, 5 and 6 (third entry), carried by review 4: now `app.css:1297`, `placeholder.test.ts:473`, `app.css:1484` beside `:1356`, and `app.css:1295`.

## Test quality
The delta adds no test: the merge resolution edits a comment, and every branch test file's diff is line for line the one review 4 audited (about 80 cases in 11 files, 8 green at its base, none a finding's proof). The suite grew from 2,913 to 2,951 passing cases through #236's tests from `origin/main`, all green on the merged tree. Coverage gap: the pager landing under the inset bar (Minor).

## Before opening the PR
- **CI readiness:** lint, typecheck, build, the full suite and the browser walk pass at `13475ae`. `origin/main` is the merge-base, so the PR has no conflict.
- **Commit hygiene:** this doc is the only new file. Nothing to drop.
- **Likely reviewer asks:** the open children #329 (Privacy Policy wording) and #335 (Nick's walk in Chrome and Safari, which should now include the collapsed sidebar at 768px to 1100px and a pager click on the list); the proposals accepted in the close-out (P1 to P3, P5 to P7) as follow-up issues; review 3's head title list and bar count for #326 in the PR body.

## Verdict
**Ready to open the PR, with follow-ups.** No CRITICAL, HIGH or MEDIUM, and one LOW: a comment hygiene entry in the walk's header, a one-commit edit. The merge of `origin/main`, review 4's one precondition, is done and green. Review 4's six LOWs stay open as carried, none a gate, and their follow-ups are the proposals Nick accepted in the close-out. The count has fallen from six to one, and the one is a comment: the delta was a merge, and the branch's own code did not change.
