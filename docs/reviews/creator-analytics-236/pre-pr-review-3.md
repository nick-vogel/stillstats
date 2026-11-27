# Pre-PR review: creator-analytics#236 Video list paging and the daily table

**Branch:** `creator-analytics-236-video-list-paging-daily-table` vs `origin/main` (merge-base `4c032ab` "Merge pull request #409 from nick-vogel/creator-analytics-359-tanstack-charts")
**Reviewed at:** HEAD `6e05aa4` ("creator-analytics#236 pre-PR review 2 remediation closure table"). The tree was clean, with no uncommitted or untracked files at review time. Against the merge-base: 24 files, +1524 / −344, three of them this folder's review docs and repro.
**Delta under review:** since `3944fd5` ("creator-analytics#341 Video list: keep focus on the list when a page read is refused"), the HEAD that pre-PR review 2 named. The delta is 4 files, +312 / −9: review 2 itself (`54115db`), its remediation scope note (`351afdb`), finding 1's fix (`e93a179`), finding 2's fix (`43b4cd6`) and the closure table (`6e05aa4`). The code part is 2 files, +49 / −9: `apps/web/src/VideoList.tsx` and `apps/web/src/app.test.ts`.
**Reviewed against:** pre-PR review 2's findings 1 and 2 (their intent and briefs), its Approach decisions and Reviewed and Dismissed list, Nick's close-out decision 3 (`.epic-loop/closeout.md`, 2026-11-05), the #341 acceptance criteria as carried in review 2, and `CODING_STANDARDS.md` 1 to 3. The repo has no `CLAUDE.md`.
**Date:** 2026-11-05
**Reviewer:** 1 code-review agent + verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | up to date |
| Lint | `pnpm lint` | green (540 files, the review 2 repro included) |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` | green |
| Full suite | `pnpm test` (Testcontainers Postgres, Docker up, `TEST_DATABASE_ADMIN_URL` unset) | 124/124 files, 2800 passed, 1 expected fail |
| Local browser walk | `pnpm run --if-present test:browser` | passed, no content security policy violation in 28 steps |
| New tests against `3944fd5` (the last reviewed code) | Scratch worktree at `3944fd5`, HEAD's `app.test.ts` copied in, `-t "pager's landing"` | 1 of 20 red: "a refused re-read of the first page after Next then Previous keeps focus in the list" (finding 1's red). The rest green, as expected: the status and network cases already focused a `tabIndex={-1}` message, and the sort heading case pins the new clear (mutant M1 below) |
| New tests against `$BASE` | Scratch worktree at `4c032ab`, same file | 11 of 20 red, including both refused page read cases and the Next then Previous case. "after Next page answers, a refused read a sort heading starts takes no focus" is green at base, which has no landing focus at all; it is a guard, killed by M1 |
| M1: drop the new `if (next.kind === 'list') landed.current = false` | Scratch worktree, HEAD's `VideoList.tsx` with the line deleted | killed: "after Next page answers, a refused read a sort heading starts takes no focus" |
| M2: clear `landed` on every non-redirect answer, refusals included | Same | killed: the status and network cases and the Next then Previous case |
| M3: drop the clear inside the refused branch (`VideoList.tsx:467`) | Same | survived; review 2's nit, still unreachable through a real user path (see Minor / nits) |
| Agent mutants | `pr-review-finder` in its own scratch worktree: old effect restored, `tabIndex={-1}` dropped, the `next.kind` guard dropped | each killed by the case meant to kill it; the agent's M4 is M3 above |
| The removed duplicate `failNext` lines | Agent read `fake-api.ts:360-372` (first in, first out per route) and the read effect's run count | a pager click re-runs the read once, so one `failNext` is consumed by the read under test; not vacuous |
| `refused` staying true across two reads (the effect now depends on `[refused]` only) | Read `video-list.ts:178-183` | a key change always passes through `loading`, so `refused` goes false and the effect runs again |
| Em-dashes in shipped copy | Grep of the delta's added lines under `apps/` | none |
| Browser behaviour | Not run | happy-dom has no layout, paint or screen reader. Review 2's items A and B and review 1's A and B stay with Nick's walk, #342 |

**Overall:** Both fixes do what review 2's briefs asked. The landing flag now clears only when a read answers with a list or the refusal shows, the Next then Previous case is red at the last reviewed code and green now, and every load-bearing line of the change is killed by a mutant except the refused branch's clear, which review 2 already recorded as a nit. The full checks and the local browser walk are green. No new finding.

## Approach decisions
- Where a pager link lands (#239): `RouteLink` takes an optional `land` callback, defaulting to `window.scrollTo(0, 0)`; `Pager` passes `land`, which calls `onLand()` and then `landOnList(table, controlsBar, window)` synchronously right after `navigate`. Kept.
- Keeping the summary's place steady while another page reads (#239 review pass 1 finding 1, `189dbd9`): `readsAnotherPageOf` and `summaryPlaceListOf`, under "Publish day" only. Kept.
- The daily table (#241): `mode` removed from the numbers table's functions and component; `ViewsTable.total` required, `tfoot` unconditional. Kept.
- Focus on a refused page read (#341, review 2 finding 1, `e93a179`): a `landed` ref in `VideoList`, set through `onLand` by the pager's `land`; it clears on a `list` answer in the read effect's answer callback (the non-redirect branch, `VideoList.tsx:407-410`) and when the refusal shows (`:466-467`), never on `!shown.busy`. An effect on `[refused]` focuses the `role="alert"` message (`tabIndex={-1}`, `preventScroll`) when `landed` is set, the read is refused, and focus fell to the body or nowhere. Kept.
- A line between every column (#351): each `th` and `td` of the four tables draws `border-inline-start: 1px solid var(--line)`, the first column's cells reset it, the sticky video column draws the line after it as `box-shadow: 1px 0 0 var(--line)`. Kept.
- Pinning a programmatic focus target (review 2 finding 2, `43b4cd6`): a test that asserts focus lands on an element also reads that element's `tabindex`, because happy-dom focuses an element no browser would. Kept.

## Prior-review closure
Review 2 confirmed 4 findings, all LOW.
- **Finding 1 (LOW), fully fixed** by `e93a179`. The intent was that a refused re-read after Next then Previous keeps focus in the list, and that the flag clears on a list answer and on the refusal only. Both hold: the case is red at `3944fd5` and green at HEAD, and M1 and M2 show both the new clear and its `list` guard are pinned.
- **Finding 2 (LOW), fully fixed** by `43b4cd6`. The status and network cases read `tabindex="-1"` on the alert (dropping `tabIndex={-1}` turns both red), the duplicate `failNext` lines are gone without making a case vacuous, and the header carries the happy-dom limit.
- **Finding 3 (LOW), untouched, deferred by decision.** `NumbersTable.tsx:89` and `VideoList.tsx:638` still carry the unstyled `numbers-table-group` and `video-list-group` classes. Review 2's remediation scope and Nick's close-out decision 3 left it unfixed. Not renumbered here.
- **Finding 4 (LOW), untouched, deferred by decision.** The `app.css:1056-1057` comment still says "a sticky row or column keeps its lines". Same decision. Not renumbered here.

No prior finding at MEDIUM or higher, so none is left open at that level. None was "resolved" only by editing a comment or doc.

## Confirmed Issues
None. A clean round: the delta's two fixes hold, and nothing they introduced survived the disprove pass.

## Needs Further Investigation
None new. Review 2's items A (a screen reader may read the refusal twice) and B (the fixed column's line at a fractional zoom), and review 1's A and B, stay open for Nick's browser walk, #342.

## Reviewed and Dismissed
- A sort heading clicked while a pager link's page is still reading, then refused, moves focus to the refusal message (agent's finding 1, reproduced in a throwaway test) — the read the pager opened is dropped by `latestOnly`, so `landed` survives, and the refusal unmounts the heading, so focus fell to the body and the effect catches it. This is review 2's dismissed "`landed` outlives a route change that is not the pager's" (lane review F1.2): the old code did the same, and the outcome keeps focus in the list, #341's goal. Do not add a clear in `changeControl` or `toggleColumn` for it.
- A pager page that answers `invalid-range` keeps `landed` through `fallBackFromRefusedRange` (`VideoList.tsx:391-394`) — the pager started that chain, so the fallback read's refusal taking focus is intended.
- `page2.release()` at the end of the Next then Previous case (`app.test.ts:2139`) — the released read was superseded, so it sets no state; each test's `installFakeApi` re-stubs `fetch`, so nothing leaks when an earlier assertion throws. It mirrors `nextPage.release()` at `:2014`.
- The header sentence at `app.test.ts:53-55` — the agent confirmed in happy-dom that `focus()` on a `<p>` with no tabindex makes it the active element, so the stated limit is true.

## Minor / nits
- The clear inside the refused branch (`VideoList.tsx:467`) has no test (M3 survives), carried from review 2. The agent built a red only by blurring the page size select before changing it, a state no mouse or keyboard user reaches, since the select keeps focus.
- The comment at `VideoList.tsx:356`, "A pager link landed on the list, until the page it opened answers or is refused.", is loose in one case only: a sort read that supersedes the pager's read also clears it, by answering with a list. That is the dismissed case above, and no maintainer reading the comment would change behaviour from it.

## Test quality
Tests added or modified in the delta: 2 added ("a refused re-read of the first page after Next then Previous keeps focus in the list", "after Next page answers, a refused read a sort heading starts takes no focus") and 3 modified (the status and network cases now read the alert's `tabindex`, and the initial-load refusal case lost its duplicate `failNext`). The first added test is red at `3944fd5` and at `$BASE`. The second is green at both, as a guard, and M1 kills it, so it asserts the new clear. Tautology shapes found: none: no expectation computed with production helpers, no mock of the unit under test, no call-shaped, snapshot, assertion-free or prose test. The branch's earlier tests were audited in review 2 and are unchanged here.

## Before opening the PR
- **CI readiness:** lint, typecheck, build, the full suite and `test:browser` are green at `6e05aa4`.
- **Commit hygiene:** commit this doc. No scratch files in the tree.
- **Likely reviewer asks:** the #342 browser walk, carrying review 2's items A and B and review 1's A and B, the 375px pager, the focus ring, and the column lines in light and dark mode with the fixed column scrolled sideways.

## Verdict
Ready to open the PR. No confirmed finding this round. Review 2's findings 1 and 2 are fully fixed with executed red-to-green proofs, and findings 3 and 4 stay deferred by Nick's close-out decision 3. The confirmed count went from 4 to 0, and what remains is two nits and the browser walk, #342.
