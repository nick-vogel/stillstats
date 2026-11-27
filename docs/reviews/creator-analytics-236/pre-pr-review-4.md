# Pre-PR review: creator-analytics#236 Video list paging and the daily table

**Branch:** `creator-analytics-236-video-list-paging-daily-table` vs `origin/main` (merge-base `ed67816`, Merge pull request #438 from nick-vogel/creator-analytics-267-launch-chart-color-per-video)
**Reviewed at:** HEAD `2575ed7` (creator-analytics#447 Video list: keep focus on the list when a sort read is refused) + 0 files with uncommitted changes, 0 untracked files. 25 files total, +1650 / −345, of which 21 are code and test files (+1152 / −345) and 4 are earlier review records (`pre-pr-review-1.md` to `-3.md` and one repro).
**Delta under review:** none. This is a fresh full review (`--fresh`), round 1 of /epic-loop run 3. It covers the whole branch, including #447 (`ae893c4`, merged as `2575ed7`) and the merge of origin/main at `281b36d`, which no earlier review saw.
**Reviewed against:** epic creator-analytics#236 (body and the 2026-11-04 amendment) and its closed children #239, #240, #241, #340, #341, #351, plus #447 (open, landed on this branch); `CODING_STANDARDS.md`; `CONTEXT.md`; the Approach decisions and dismissals of `pre-pr-review-1.md` to `pre-pr-review-3.md`, including Nick's run 1 close-out (review 1's findings kept as a record only) and his close-out decision 3 (review 2's findings 3 and 4 deferred).
**Date:** 2026-11-05
**Reviewer:** 2 code-review agents + 1 tautology-audit agent + verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Dependencies | `pnpm install --frozen-lockfile` | already up to date |
| Lint | `pnpm lint` (biome check .) | green, 540 files |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` | green (the existing 500 kB chunk warning only) |
| Unit and integration suites | `pnpm test` (Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | 124/124 files, 2808 passed, 1 expected fail, 31 s, no flake |
| Local browser walk | `pnpm run --if-present test:browser` | passed, no content security policy violation in 28 steps |
| Pager, landing and focus files | finder agent A over `VideoList.tsx`, `RouteLink.tsx`, `heading-hold.ts`, `video-list.ts` and their tests, in a scratch worktree at HEAD | 527 tests green; mutants below |
| Tables, CSS, walk and extension harness | finder agent B over the other 14 files, in a scratch worktree at HEAD | 317 tests green, `test:browser` green; 2 probe mutations (below) |
| New tests against `$BASE` | tautology agent: HEAD's 7 web test files copied into a scratch worktree at `ed67816`, run there | 656 tests: 583 green at base, 73 red. Every added test green at base is a preservation or boundary pin the spec names (see Test quality) |
| #447 mutants, `VideoList.tsx` at `2575ed7`, run against `app.test.ts` | one at a time in a scratch worktree | `onTableRead()` dropped from the sort heading: 2 red. Dropped from the pager's `land`: 3 red. The clear on a `list` answer dropped: 1 red. `document.activeElement === document.body` half dropped: 5 red. `tabIndex={-1}` dropped from the refusal: 4 red. `if (!tableRead.current) return` dropped: 2 red. Focus condition forced true: 2 red. The clear inside `if (refused)` dropped: **survives** (see Minor / nits) |
| Self-computed pager hrefs | agent B dropped `'sort'` from the query `route.ts` writes | `components.test.ts` "First page and Last page carry the route with only its page changed" stayed green; the App test "%s opens its page and keeps …" went red. Review 1's finding 1, already decided |
| Walk's fixed-column check reads paint | agent B added `position: relative; z-index: 2` to `.video-list td` | `test:browser` still passed. Review 2's nit, already known |
| Merge with the current origin/main | `git merge-tree --write-tree HEAD origin/main` (origin/main at `9c73a81`, #338 support button, PR #448) | **conflict** in `apps/site/test/screenshot/browser-walk.ts`; `app.css`, `app.test.ts`, `components.test.ts` and `web.test.ts` auto-merge |
| Real Safari and Chrome, VoiceOver, 375px pager | not run: no browser automation for VoiceOver here | still owned by Nick's walk, #342 |

**Overall:** Every child does what its acceptance criteria ask, the four full checks and the local browser walk are green, and #447's change (a refused sort read moves focus to the refusal message) is pinned: each of its load-bearing lines but one is killed by a mutant, and that one was recorded as a nit in reviews 2 and 3. The only confirmed finding is LOW comment hygiene: three comments that #447 left describing only the pager, or loosely. Origin/main has moved since the last merge, and merging it conflicts in the browser walk script, so the PR needs that merge first.

## Approach decisions
- Where a pager link lands (#239): `RouteLink` takes an optional `land` callback, defaulting to `window.scrollTo(0, 0)`; `Pager` passes `land`, which calls `onTableRead()` and then `landOnList(table, controlsBar, window)` synchronously right after `navigate`. Kept.
- Keeping the summary's place steady while another page reads (#239 review pass 1 finding 1, `189dbd9`): `readsAnotherPageOf` and `summaryPlaceListOf`, under "Publish day" only. Kept.
- The daily table (#241): `mode` removed from the numbers table's functions and component; `ViewsTable.total` required, `tfoot` unconditional. Kept.
- Focus on a refused list read (#341, review 2 finding 1 `e93a179`, #447 `ae893c4`): a `tableRead` ref in `VideoList` (named `landed` before #447), set through `onTableRead` by the pager's `land` and by a sort heading's `onSort` before `changeControl`; it clears on a `list` answer in the read effect's answer callback (the non-redirect branch, `VideoList.tsx:408-411`) and when the refusal shows (`:468-469`), never on `!shown.busy`. An effect on `[refused]` focuses the `role="alert"` message (`tabIndex={-1}`, `preventScroll`) when the flag is set, the read is refused, and focus fell to the body or nowhere. Kept.
- A line between every column (#351): each `th` and `td` of the four tables draws `border-inline-start: 1px solid var(--line)`, the first column's cells reset it, the sticky video column draws the line after it as `box-shadow: 1px 0 0 var(--line)`. Kept.
- Pinning a programmatic focus target (review 2 finding 2, `43b4cd6`): a test that asserts focus lands on an element also reads that element's `tabindex`, because happy-dom focuses an element no browser would. #447's sort tests follow it. Kept.

## Confirmed Issues

### 1. Comment hygiene — LOW (aggregated)
Attribution: introduced. The `app.css` sentence came with `b446411` (#341) and went stale when `ae893c4` (#447) let a sort heading's refused read take focus too; the two `VideoList.tsx` comments came with `ae893c4`. The pager is rendered after the table's scroll box, not inside the table, so "in the table" fits the sort headings only, and the flag survives a first answer that redirects through `routeAfterListAnswerOf`.
- `apps/web/src/app.css:155-156` — "and the video list's table a pager link focuses, or the refusal message in its place when that page's read is refused" → "and the video list's table a pager link focuses, or the refusal message in its place when the read a pager link or a sort heading started is refused"
- `apps/web/src/VideoList.tsx:357` — "A pager link or a sort heading in the table started the read, until it answers or is refused." → "A pager link or one of the table's sort headings started the read, until a list answer lands (after any redirect) or the refusal shows."
- `apps/web/src/VideoList.tsx:571` — "Told when a pager link or a sort heading in the table starts a read" → "Told when a pager link or one of the table's sort headings starts a read"

## Needs Further Investigation
Carried for Nick's walk, #342, unchanged by this round: review 1's A (the summary's height in after-publish windows other than "Publish day") and B (VoiceOver reading the new caption), and review 2's A (a screen reader reading the refusal message twice, now also after a refused sort) and B (the fixed column's line at a fractional zoom).

## Reviewed and Dismissed
- The sort heading's "focus the creator moved stays" test (`app.test.ts:2197`) duplicates the pager's (`:2126`) (agent A finding 1) — #447 names this rule for the sort read, and the test would catch a sort refusal routed through a focus path without the `activeElement` check, which the pager twin would not. Forcing the focus condition true turns both red. Keep both.
- `heading.focus(); expect(document.activeElement).toBe(heading)` in the sort refusal test (agent A finding 2) — a precondition guard, the same as the #341 test the issue wrote out word for word; it fails loudly if happy-dom stops focusing the button, which would otherwise make the final assertion meaningless.
- No test targets "a sort heading pressed while a pager read is pending, then refused" (agent A finding 3) — it holds by construction now that both set the flag, and review 3 dismissed it the same way. Do not add a clear in `changeControl` or `toggleColumn`.
- The sort tests sit under `describe("the pager's landing on the video list")` (agent A finding 4) — the describe already held refusal and focus cases for the pager before #447; renaming it is cosmetic.
- `video-list.test.ts` caption unit tests, the `components.test.ts:1361-1377` test that builds its hrefs with `hrefOf`, and the duplicate "only its page changed" rule (agent A findings 5 and 6, agent B finding 1) — review 1's finding 1. Nick's run 1 close-out kept it as a record only. Agent B's mutation (dropping `sort` from the written query leaves that components test green while the App test goes red) confirms review 1's reasoning, and changes nothing about the decision.
- No automated check of the 375px pager rule (`app.css:580-587`) and no limits note (agent B finding 3) — review 1's finding 3, kept as a record only; the epic assigns the 375px pager to Nick's walk, #342.
- The `advanceWhileRunning` comment (`apps/extension/src/surfaces/testing.ts:52`) promises more than the helper does (agent B finding 4) — review 1's finding 4, kept as a record only. Agent B adds that an abort mid-advance relies on `afterEach`'s `stop()` to clear the timers (unverified), which is the same point.
- `numbers-table-group` and `video-list-group` classes no rule styles (agent B finding 6) — review 2's finding 3, deferred by Nick's close-out decision 3.
- Exact class strings in `components.test.ts:1354` and `placeholder.test.ts:50` (agent B finding 8) — review 1's finding 2, kept as a record only.
- `followInPlace` taking two optional positional callbacks (agent A finding 7) — its only callers are `RouteLink` (passes both) and `AccountMenu.tsx:65` (passes neither), so no caller writes `undefined` for `onFollow`; not a walked-past refactor.
- A pending read, then a click on something non-focusable (or a Safari mouse click on a button), then a refusal, moves focus to the message (agent A finding 9) — focus was on the body by then, so the message is the better place, with `preventScroll` so nothing jumps; the same class as review 2's dismissed "`landed` outlives a route change that is not the pager's".
- Every #447 code path the agents traced (a refusal after a refusal, StrictMode's double effects, a redirect through `routeAfterListAnswerOf`, modified clicks, the column switches and sources button outside the table) — the flag is set only by a press that always starts a read, `refused` always returns to false through placeholder rows before the next refusal, and modified clicks return before `land`.

## Minor / nits
- The clear inside the refused branch (`VideoList.tsx:469`) still has no test; dropping it survives the suite, as reviews 2 and 3 recorded. The tautology agent built a red that needs a blur to the body after the first refusal, in a test it then reverted: Next page with the read refused (focus on the alert), blur to the body, `failNext`, click "Show unlisted and private", expect focus not on the alert. A Safari mouse click on the checkbox may reach that state for real (unverified), so a remediator who wants the gap closed has the test shape here.
- `test:browser` reads the fixed column's computed `box-shadow` and geometry, not paint: a stacking change that covers the shadow passes it (agent B finding 2, proved by mutation). Review 2 recorded the same nit.
- `web.test.ts:620-628` compares the reset rule's selectors to a hard-coded list, so regrouping them with `:is()` fails it with no change in behaviour (agent B finding 8).
- The walk checks every column's line only at the wide viewport, so the Views cells that show only at 375px have their line by the CSS but not by Chrome (agent B finding 9).
- `daysIn` (`views-chart.ts:64`) is now private with one caller and could be inlined (agent B finding 7).

## Test quality
Tests added: 49 · changed: about 26 (signature edits after `mode` was dropped and `listKey` added) · green against `$BASE`: 11 added cases, every one a preservation or boundary pin the spec names: the title link still asks for the top (`app.test.ts:2051`), the five modified-click cases (`:2080`, #239 and #340), focus the creator moved stays for a pager read and for a sort read (`:2126`, `:2197`), a refusal no pager link led to takes no focus (`:2145`), and a refused visibility-switch read after Next page answers takes no focus (`:2217`, the only test that kills the clear on a `list` answer). Each goes red under a mutant that over-applies the fix. The changed tests green at base hold behaviour that already held. Tautology shapes found: the `hrefOf`-built expectation and two exact class strings, all review 1 findings kept as a record. No snapshot, no assertion-free test, no mocked unit under test. The `content-list.test.ts` change alters the harness only (`test.for`, a 30 s timeout, `advanceWhileRunning(signal)`), no assertion.

## Before opening the PR
- **CI readiness:** `pnpm lint`, `pnpm typecheck`, `pnpm build` and `pnpm test` green at `2575ed7`, and `test:browser` green.
- **Commit hygiene:** the tree was clean at review. Commit this doc. The three comment edits go in one commit if they are made.
- **Merge first:** origin/main has moved to `9c73a81` (Merge pull request #448, #338 support button), and merging it conflicts in `apps/site/test/screenshot/browser-walk.ts`. Merge and re-run the full checks before the PR opens.
- **Likely reviewer asks:** the open walk, #342 (VoiceOver after a page change and after a refused read, the 375px pager, the fixed column at a fractional zoom); #339 (the empty list's screen reader name) stays open on the epic.

## Verdict
**Ready to open the PR as-is**, after the merge of the current origin/main and its conflict in the browser walk script. No finding gates it: the one confirmed finding is LOW comment hygiene, which can ride in the PR or be dropped. 0 CRITICAL, 0 HIGH, 0 MEDIUM, 1 LOW.
