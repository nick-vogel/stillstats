# Pre-PR review: creator-analytics#268 Channel audience screen, third PR (#476, #477, #469, #463, #468), round 2

**Branch:** `creator-analytics-268-channel-audience-screen` vs `origin/main` (merge-base `a187286` "Merge pull request #475 from nick-vogel/creator-analytics-238-own-channel-metrics")
**Reviewed at:** HEAD `56391d7` ("creator-analytics#268 pre-PR review 6 remediation closure table"). The tree was clean, with no uncommitted or untracked files at review time. Against the merge-base: 31 files, +2,562 / −779, in 14 commits.
**Delta under review:** since `9eea5ca` ("creator-analytics#468 Placeholders: a section heading's place is as tall as the section's heading"), the HEAD pre-PR review 6 reviewed. The delta is 10 files, +400 / −30: review 6 and its repro (`866c2ea`), the two remediation commits `b345f83` ("pre-PR review 6 finding 1: the sidebar's column needs a window tall enough for its rows") and `80a48f4` ("pre-PR review 6 finding 2: the account row's avatar keeps its round size beside the email"), and the closure table (`56391d7`). Code files in the delta: `apps/site/test/screenshot/browser-walk.ts`, `apps/web/src/App.tsx`, `apps/web/src/Sidebar.tsx`, `apps/web/src/app.css`, `apps/web/src/app.test.ts`, `apps/web/src/components/ui/sidebar.tsx`, `apps/web/src/sidebar-column.ts`, `apps/web/src/support.ts`, and the repro `docs/reviews/creator-analytics-268/repro/sidebar-column-footer.ts`.
**Reviewed against:** pre-PR review 6 (its findings 1 to 3, its Approach decisions, its Remediation table and the verify agent's three LOW leftovers); the epic creator-analytics#268 and #476 as distilled in review 6; `CODING_STANDARDS.md` 1 to 3; ADR 0011 and 0014 as review 6 applied them.
**Date:** 2026-11-06
**Reviewer:** 1 code-review agent (delta) + base-oracle check + verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | up to date |
| Lint | `pnpm lint` (biome) | pass, 564 files; pass again with this doc added |
| Typecheck | `pnpm typecheck` | pass |
| Build | `pnpm build` | pass |
| Full suite | `pnpm test` (Docker up, Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | 131 files, 3,146 passed, 1 expected fail, first run; no flake |
| Browser walk | `pnpm run --if-present test:browser` | passed, "No content security policy violation in 43 steps" |
| Review 6's repro | `node docs/reviews/creator-analytics-268/repro/sidebar-column-footer.ts` against the built app | exit 0: 915x340 and 844x340 "no column, the row of links green"; 1280x800 `"avatarWidth":40,"avatarHeight":40` green |
| The new app test against the pre-fix code | scratch worktree at `9eea5ca` with HEAD's `apps/web/src/app.test.ts` copied in, `pnpm exec vitest run apps/web/src/app.test.ts -t "too short"` (worktree removed after) | red: "No header or no sidebar" at `app.test.ts:3953` |
| The column's breakpoints in Chrome | finder agent, headless Chrome against the built app | column at 1024x384 and 768x384; row at 1024x383, 844x340, 915x340 and 767x800 (header with the account menu, sidebar not fixed, "Hide", no collapse button) |
| A saved collapsed state across the height | finder agent: collapse at 1280x800, resize to 1024x340 without a reload, then back | `data-state` expanded with the header and "Hide" at 1024x340; collapsed again at 1280x800 |
| The walk's avatar check can go red | finder agent: `flex-shrink: 1` set back on the avatar through the CSSOM at 1280x800 | 32.70x40 with the stub's email, 15.5x40 with a 483px email; 40x40 for both with the fix, the email still cut short |
| Anything else that decides the column by width alone | `grep` of `apps/web/src` for `48rem`, `md:`, `matchMedia`, `innerWidth`; finder read of the sticky bar, heading-hold and the account menu's side | only `components/ui/sidebar.tsx:164` `max-md:hidden`, unreachable (Minor). Every other switch reads the JS `column` value or the one CSS block |
| Placeholders in the new wide-and-short row layout | read of `app.css`: every place's lines are `@container` bands on fixed-size text (the h1 title is 1.5rem, notes 15px, h2 18px), and the row layout caps the screen at the 76rem measure | inside the widths the #477 sweep measured; not swept at a short window (see Reviewed and Dismissed) |
| Repro and changed files pass biome | `pnpm exec biome check` on the repro, `browser-walk.ts`, `app.test.ts`, `sidebar.tsx`, `sidebar-column.ts` | pass |
| Not run | a real phone in landscape; Safari; Chrome's minimum font size setting | Nick's walk (#335) |

**Overall:** Both of review 6's MEDIUMs are fixed as their briefs asked, and each holds by a test that goes red without its fix. The column now renders only where the window holds its rows, JS and CSS agree on one condition, and below it the app falls back to the whole row layout, the collapsed state included. The avatar keeps its circle beside any email. Every full check passes. What remains is one aggregated comment hygiene LOW (review 6's untouched finding 3 plus the width-only wording the remediation left) and four Minor items. The branch is ready for its PR.

## Approach decisions
- Carried from reviews 1 to 6, unchanged: copy with no approval is Nick's decision, recorded and not fixed by remediation; test gaps close with a test in the existing describe for their rule, never with a production change; duplication inside the branch's own new code folds into the rule or helper it copies; the walk's header lists the steps in the order the `walk(...)` calls run.
- Carried from review 6, now landed: #477's container queries hold the placeholders (review 4's `:has(...)` bands stay overturned); the column shows only where the window holds every row, by a height in the one `sidebarColumnQuery` that `app.css` writes again (precedent `stackedChartsQuery`, `apps/web/src/stacked-charts.ts:7`), keeping #476 A17's unscrolled panel; the account row's avatar keeps its size with `flex-shrink: 0`, after `.sidebar-support button`.
- The width-only wording: a comment or test name that says the column shows "from 48rem" says "in the column" or "from `sidebarColumnQuery`" instead, the wording `support.ts:14` took in `b345f83`. A test name whose test only runs at windows 768px tall or more may keep "from 48rem" when it also says "on a tall window"; the comment hygiene entries below give each one's text.

## Prior-review closure
Review 6 named three findings. **Fully fixed: 2.** **Partially fixed: 0.** **Untouched: 1 (LOW).**
- 1 (MEDIUM), the column past a short window's bottom: **fixed** by `b345f83`. The query is `'(min-width: 48rem) and (min-height: 24rem)'` in `sidebar-column.ts:11` and in `app.css:1883`, character for character (`web.test.ts`'s equality test passes). The new app test `app.test.ts:3944` is red at `9eea5ca` and green at HEAD. Verified against its intent, not only its diff: below the height the provider's `state` is `expanded` (the collapsed preference does not apply), the support button reads "Hide", and no collapse button renders, in Chrome on a live resize.
- 2 (MEDIUM), the squeezed avatar: **fixed** by `80a48f4`. `.sidebar-account .avatar { flex-shrink: 0; }` at `app.css:2029`; the walk check at `browser-walk.ts:584-593` reads the `Account menu` button, which is the `.avatar` element itself (`AccountMenu.tsx:54`, no padding or border), and goes red with the old shrink.
- 3 (LOW, comment hygiene): **untouched**, deferred by the default LOW scope (review 6's Remediation table). Every entry still stands and is carried into this doc's finding 1, with the verify agent's leftovers.

Review 6's "Known regressions, deferred" list was "None", with three LOW leftovers named for this round: the width-only comments (finding 1 below), the `max-md:hidden` tooltip class (Minor), and the collapsed avatar's 1px (Minor). Its one unmeasured question, whether 24rem holds the column when the support label wraps, is answered in Minor: it does not, and today's copy does not wrap.

## Confirmed Issues

### 1. Comment hygiene — LOW (aggregated)
Carried from review 6 finding 3, untouched:
- `apps/web/src/AccountMenu.tsx:28-30`: "in the sidebar's footer, at the window's bottom, it opens beside the sidebar, its bottom at the avatar's, where there is room for it" → "in the sidebar's footer, at the window's bottom, it opens to the avatar's right, its bottom at the avatar's, where there is room for it: over the email beside the avatar while the sidebar is open, and beside the sidebar when it is collapsed". Introduced, `f699430`.
- `apps/web/src/App.tsx:600-601`: "The screen's top heading; the wordmark and the channel picker name it on sight." → "The screen's top heading. With more than one channel the picker names it on sight; collapsed in the sidebar's column, the channel icon's tooltip names it on a hover or a focus." Pre-existing at `a187286`, exposed by `f699430`.
- `apps/web/test/web.test.ts:150-153` (`lineCountsIn`): "Outside any block first, then the @media blocks, then the @container blocks, each in the sheet's order, which is the order a later rule wins in." → "Outside any block first, then the @media blocks, then the @container blocks, each in the sheet's order. That is the cascade's order only while no `--lines` rule sits under @media, which the 'no placeholder's lines follow the window' test holds, and each @container rule follows in the sheet the rule outside any block that it overrides." Introduced, `fc5f5f4`.
- `apps/site/test/screenshot/browser-walk.ts:23-24`: the header leaves out the #469 step between the #468 clause and the date range bar inset. After "(creator-analytics#468)," insert "then each publish day bar row as tall as its place, a long title cut short to one line, at 320px to 1440px (creator-analytics#469)," and rewrap the clause at 100 columns (line 24 is 145 characters). Introduced, `fbdf227` and `5b6c4a1`.
- Comment lines the branch added past 100 columns: `apps/site/test/screenshot/screen-ready.ts:2` and `:4` (`f699430`), `browser-walk.ts:42`, and the rewrapped `browser-walk.ts:24`. Rewrap each. To list them: `git diff a187286 -- apps/site/test/screenshot/ | grep -E '^\+ *(//|\*)' | awk 'length > 101'`.

The width-only wording that `b345f83` left, from review 6's verify leftovers and this round's finder (each introduced by `f699430` or `b345f83`'s partial sweep):
- `apps/web/src/app.css:1795-1797`: "Below the tablet width they stack, the sidebar's links in a row under the header with no menu button; from it the sidebar is a column at the window's left edge" → "Outside the sidebar's column they stack, the sidebar's links in a row under the header with no menu button; in it, from 48rem on a window tall enough for its rows, the sidebar is a column at the window's left edge".
- `apps/web/src/app.css:1819`: "and 3rem holds the 2.5rem avatar" → "and 3rem holds the 2.5rem avatar, 1px of it in the panel's padding beside the 1px border".
- `apps/web/src/app.test.ts:3793-3794`: "1024px wide unless a test sets it, so these tests render the sidebar as the column it is from 48rem, and the ones at 375px the row below it" → "1024x768 unless a test sets it, so these tests render the sidebar as the column `sidebarColumnQuery` gives, and the ones at 375px, or too short, the row".
- `apps/web/src/app.test.ts:4746`: "the x from 48rem and "Hide" below" → "the x in the column and "Hide" in the row".
- `apps/web/test/web.test.ts:302`: "its row below 48rem" → "its row outside the column".
- `apps/web/test/web.test.ts:543` test name: "written for the width the sidebar renders its column from" → "written for the window the sidebar renders its column on".
- `apps/site/test/screenshot/browser-walk.ts:367`: "the x from 48rem and "Hide" below" → "the x in the column and "Hide" in the row". `:579`: "from 48rem the sidebar runs the window's full height" → "in its column the sidebar runs the window's full height". `:2329-2330` and `:2393` describe walk windows 900px tall, where width alone decides; add "on the walk's tall windows" to each rather than changing the code.
- `apps/site/test/screenshot/screen-ready.ts:2`: "or from 48rem the sidebar's nav in its place" → "or, in the sidebar's column, its nav in its place" (with the rewrap above). `screen-ready.test.ts:28` test name: "from 48rem a signed-in screen" → "beside the sidebar's column a signed-in screen".
- The describe names `app.test.ts:3894` 'the sidebar from 48rem (creator-analytics#476)' and `:4021` 'the sidebar below 48rem (creator-analytics#476)' run at 1024x768 and 375x812. Leave them, or rename to 'the sidebar as a column' and 'the sidebar as a row'; the new short-window test sits in the first and reads correctly under either.

## Needs Further Investigation
None.

## Reviewed and Dismissed
- The placeholders in the wide-and-short row layout (a 768px to 3000px window under 24rem tall, which before `b345f83` showed the column): every place's line count is an `@container` band on the box its text wraps in, and the text sizes are fixed (the head title `1.5rem`, notes 15px, h2 18px; the only `vw` font size is `.app h1` at `app.css:61`, which no place holds). The row layout caps the screen at the 76rem measure (`app.css:55`), so its boxes are no wider than the #477 sweep's (up to the 2256px screen). A box width maps to the same lines whatever the window's height. Not swept at a short window, as the sweep only lays out the column from 48rem.
- `apps/web/test/web.test.ts`'s "stylesheet the web app serves" and "writes no colour" tests failing in the finder's own `vitest run`: an environment artifact of running that file alone without the suite's setup. `pnpm test` runs them green (131 files passed).
- The walk's `width < 768` checks (`browser-walk.ts:2331`, `:2393`) deciding the column by width: every walk window is at least 800px tall (`viewport`, `wideAt`), so width alone is right there. Only their comments change (finding 1).
- `.sidebar`'s missing `overflow`: #476 A17, kept by review 6's Approach decision. Still deliberate.
- The account menu opening over the email: #476 A7 and A8, accepted (review 6, Reviewed and Dismissed).

## Minor / nits
- `apps/web/src/components/ui/sidebar.tsx:164` `className="max-md:hidden"` on the collapsed tooltip is Tailwind's width-only breakpoint and never applies: `Tooltip` is `disabled={state !== 'collapsed'}`, and `state` is collapsed only in the column. Dead, and the last condition in the sidebar's files that says "below 48rem" a different way from `sidebarColumnQuery`. Dropping it is an opportunistic tidy (standard 3); review 6 finding 1's Do not touch kept it, so remediation needs Nick's word.
- 24rem leaves 5.6px over the column's 378.4px at 1024x384. A support label wrapping to two lines (its row 40px → 67.2px) or another footer row would overflow it, and nothing in CI or the walk measures a short window from 48rem: the walk's short window (667x320) is below 48rem, and only `repro/sidebar-column-footer.ts` looks, at 340px tall. Today's "Support Stillstats" does not wrap. Unverified: Chrome's minimum font size setting at 16px or more would enlarge the 0.875rem footer text without moving 24rem. A walk step at 768x384 that fails when the collapse button's bottom is past `innerHeight + 0.5` would hold the margin.
- The new short-window app test (`app.test.ts:3944-3966`) checks the header's wordmark and avatar, the row's three links and no toggle. It does not check the support button's "Hide" text, or that a saved `sidebarOpen: false` is ignored at the short window. Both hold in Chrome (verified above).
- Collapsed, the 40px avatar now sits 1px past the 39px content box into the 4px padding (x 4 to 44, the content edge at 43), unclipped, its centre the column's centre. Before `80a48f4` it was 39x40. No action beyond the `app.css:1819` comment in finding 1.

### Known LOWs from the ticket reviews, still open
As review 6 listed (`.epic-loop/tickets/<n>/review-1.md`): #476 F1.2 to F1.11; #477 F1.1 to F1.10; #469 F1.1 to F1.8; #463 F1.2 to F1.10; #468 F1.2 to F1.7.

### Known MEDIUMs, deferred by decision at the ticket reviews
Unchanged from review 6: #463 F1.1 (the Audience placeholder's three bar rows against up to eleven bars), to the proposal "The Audience placeholder's bar rows"; #468 F1.1 (a wrapped video page section heading skipped), to the proposal "A video page section heading's place holds the lines its heading wraps to on a phone". Neither was in review 6's confirmed findings, and neither is a finding here.

## Test quality
Tests added or changed in the delta: 1 app test case (`app.test.ts:3944`) and 1 walk check (`browser-walk.ts:584-593`). Red against `9eea5ca`, the code before the fixes: the app test, run in a scratch worktree ("No header or no sidebar"); the walk check, by the remediation's own red run ("The avatar beside the email is not round: {"width":32.703125,"height":40}") and again by the finder's CSSOM revert. Green at the pre-fix code: 0. Shapes found: none. The app test's expectations are the app's real link texts and `supportHeading`, not values computed by the code under test; the walk check measures the rendered box. The test restores the viewport to happy-dom's 1024x768 default in a `finally`, so no later test inherits the short window. The coverage gap is in Minor.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and the full suite pass at `56391d7`, and the browser walk passes. This doc passes biome.
- **Commit hygiene:** this doc is the only new file. Nothing to drop.
- **Likely reviewer asks:** the open children #329 (Privacy Policy wording) and #335 (Nick's walk in Chrome and Safari, now with a phone held sideways, which shows the header and the row of links); the deferred MEDIUMs as follow-up issues; the 5.6px headroom above 24rem if the support copy changes.

## Verdict
**Ready to open the PR as-is.** No CRITICAL, HIGH or MEDIUM. Review 6's two MEDIUMs are fixed against their intent, each with a test that is red without its fix, and neither fix introduced a defect this round could find. The confirmed list shrank from three to one, and what remains is comment and test-name wording: the delta has reached the comment-hygiene floor, which is the expected end of a remediation round, not a branch failing to improve. The comment hygiene LOW and the Minor items can ride along or follow. Prior findings: 2 of 2 MEDIUMs closed in code, none closed only by a comment; review 6's LOW finding 3 is untouched, by the default scope.
