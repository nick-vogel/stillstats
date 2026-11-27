# Pre-PR review: creator-analytics#638 Audience cards packed by height, re-review after review 2's remediation (creator-analytics#711)

**Branch:** `creator-analytics-638-audience-mosaic` vs `origin/main` (merge-base `40288fb` "Merge pull request #710 from nick-vogel/creator-analytics-638-audience-mosaic")
**Reviewed at:** HEAD `ba9f252` ("creator-analytics#638 pre-PR review 2 remediation closure table"). The tree was clean, with no uncommitted or untracked files at review time. Whole branch: 10 files, +882 / −136, of which 8 are product and test files and 2 are review 2's doc and repro.
**Delta under review:** since `bd488b5` ("creator-analytics#711 Audience columns: a short card can sit alone in a mostly blank column at desktop width"), the HEAD that pre-PR review 2 (`docs/reviews/creator-analytics-638/pre-pr-review-2.md`) reviewed. The delta is `0a79729` (review 2's doc), `a140c91` (its Finding 1 fix) and `ba9f252` (its closure table). The only code in it is `apps/site/test/screenshot/browser-walk.ts`, +16 / −2.
**Reviewed against:** epic creator-analytics#638 and its child creator-analytics#711 as distilled in review 2, review 2's Finding 1 brief and its Approach decisions, and `CODING_STANDARDS.md` standards 1 to 3.
**Date:** 2026-11-12
**Reviewer:** 1 code-review agent and a verify pass (delta-scoped)

## What was verified and how

| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | green, lockfile unchanged |
| Lint | `pnpm lint` | green, 679 files |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` | green |
| Full suite | `pnpm test` (Testcontainers Postgres), `TEST_DATABASE_ADMIN_URL` unset | green: 165 files, 4,152 passed, 1 expected fail |
| Browser walk at HEAD, 3 runs in a row | `pnpm test:browser` in the integration worktree at `ba9f252`, run 1 straight after the full suite | **green in 3 of 3**, 88 steps each, no content security policy violation. Review 2 saw this walk fail 3 runs in 5 at `bd488b5` |
| Coverage of the fix | finder read every `busyAudienceCards` and `aria-busy` read in the walk | every read of the Audience placeholder's geometry waits first: `:2859`→`:2861`, `:2925`→`:2926`, `:3126`→`:3128`, `:3413`→`:3414`. The other busy reads are the video, publish-day and sidebar screens, which do not pack |
| Null or wrong grid in the helper | finder traced each call site's preceding `waitFor` and the render | unreachable: each `waitFor` requires a card inside `.audience-grid[aria-busy="true"]`, and `AudiencePlaceholder` is the only busy renderer of `AudienceColumns` (`apps/web/src/Audience.tsx:120`, `:263`), one at a time |
| A held read timing out during the wait | `git grep` for `AbortSignal` and timeouts in the app's fetch code | none in the app. That Chrome never times out a paused Fetch request is not verified, and it matters only on the helper's 5s failure path |
| Count match proves the packing settled | finder traced the ResizeObserver `setColumns` and the `[columns]` layout effect's `recheck` | the recheck's write is flushed in the same commit task as the new count, so a separate CDP evaluate cannot see the count without the height packing |
| Mutation and red→green for the fix | taken from review 2's closure table, not re-run | red at `0a79729` with a 300ms ResizeObserver delay mutant, green at `a140c91` with the mutant and three times without it |
| Tautology audit | the delta adds no test and no assertion: it adds a wait before four existing reads | see Test quality |

**Overall:** review 2's one MEDIUM is closed. The walk now waits for the Audience placeholder to repack for its width before it measures it, at all four sites, and the walk passed three runs in a row with every CI check green. The delta has no correctness defect. What remains is comment hygiene, review 2's deferred entries plus two on the new helper, and none of it gates the PR.

## Approach decisions

- Layout: script packing by height into one flex container per column (`apps/web/src/audience-columns.ts`, `AudienceColumns` in `apps/web/src/Audience.tsx`), as #711 decides. This overturns review 1's "CSS multi-column, no script", by Nick's decision of 2026-11-12. Unchanged this round.
- A repack that a ResizeObserver notice causes after first paint goes through plain `setState`, not `flushSync`, to keep out the ResizeObserver loop error (`.epic-loop/tickets/711/assumptions.md`). The walk absorbs the one-task lag. Unchanged this round.
- The layout's tests are the browser walk and the pure unit tests in `apps/web/src/audience-columns.test.ts`. The walk checks the screen against the product's own `packAudienceCards` and `audienceColumnCountOf`, and the unit tests pin the rule with hand-written expectations. Unchanged this round.
- Waiting in the walk: poll a page expression with `delay(50)` up to a cap. `audiencePlaceholderPacked` (`apps/site/test/screenshot/browser-walk.ts:2733`) is now the in-repo precedent for waiting on the placeholder's packing, and a new read of placeholder geometry calls it first.

## Confirmed Issues

### 1. Comment hygiene — LOW (aggregated)

Review 2's Finding 2, deferred by its remediation's default scope and still untouched, with its line numbers brought up to date, plus two entries on this round's helper:

- `apps/site/test/screenshot/browser-walk.ts:2720`: "The landed Audience grid's width, the root font size and how many columns it renders." → "The width, the root font size and the column count of the Audience grid `selector` picks, the landed one by default." The function now reads the placeholder too.
- `apps/site/test/screenshot/browser-walk.ts:2733`: add a doc comment to `audiencePlaceholderPacked`: "After first paint a width change, such as the preferences read collapsing the sidebar, repacks the placeholder through plain setState a task later, so its places are measured only once its column count is the one its width gives. The height recheck commits in the same task as the new count, so the count is enough (creator-analytics#711)." Without it the wait reads as removable.
- `apps/web/src/app.css:995-996`: "The count is the breakdowns' 18rem column rule above, as many 18rem columns as fit" → "The count is audience-columns.ts's, as many 18rem columns as fit, the same 18rem as the breakdowns' column rule above, held in both places". The count no longer comes from any CSS rule, and the 1rem `gap` here is a second copy of `audienceGapRem`.
- `apps/web/src/app.css:1002-1003`: "so a short card no longer sits alone in a mostly blank column (creator-analytics issue 711, at a 1512px window on staging)" → "so no short card sits alone in a mostly blank column, as the fixed order of CSS columns left one at a 1512px window on staging (creator-analytics issue 711)".
- `apps/web/src/audience-columns.ts:12`: "the count CSS `columns: 18rem` gave before creator-analytics#711" → "the count CSS `columns: 18rem; column-gap: 1rem` gives".
- `apps/web/src/app.test.ts:5611-5613`: the comment "the cards stay in the one column in DOM order they render in before they are measured" and the title's "in one column before any layout packs them" → "happy-dom lays nothing out, so the grid reads 0px wide and the packing keeps one column in DOM order", with the title "...the eight cards in DOM order in one column when the grid has no width...".
- `apps/web/test/web.test.ts:1029-1030`: "from the packing's 18rem column count (audience-columns.ts, creator-analytics#711), which the browser walk holds" → "from the packing's 18rem column count, which audience-columns.test.ts holds, and the browser walk holds the screen to it (creator-analytics#711)".
- `apps/site/test/screenshot/browser-walk.ts:2800`: add the step's limit after "(creator-analytics#711)": "The expected count and columns come from the product's own audienceColumnCountOf and packAudienceCards, so this step holds the screen to them, and audience-columns.test.ts holds the rule itself." (standard 2, a test states its own limits).

## Needs Further Investigation

None.

## Reviewed and Dismissed

1. **The helper's `querySelector` returns null and throws a bare "Uncaught".** Unreachable at every call site: each follows a `waitFor` that requires a card inside the busy Audience grid, and the bars step's `places` maps over `busyAudienceCards`, so it proves the grid too.
2. **The helper picks the wrong busy grid.** Only `AudiencePlaceholder` renders `AudienceColumns` with `busy`, and only one is mounted at a time.
3. **A matching column count does not prove the packing settled.** For a width change it does: the `[columns]` layout effect's `recheck` re-measures at the new width and writes inside the same commit. A repack driven only by heights, with the count unchanged, is not covered, but no current step can meet one. The columns are equal width (`flex: 1 1 0; min-width: 0`), so the width and height reads do not depend on the column, and the second-read step navigates within the app, so `rows` does not change while the read is held. See Minor for the limit.
4. **`screen === audienceNotes` and `screen.name === 'Audience'` misidentify a screen.** `placesHoldWhatLands` has one caller, over `[audienceNotes, videoNotes]`, and only one bars entry is named `Audience`.
5. **The wait times out a held read.** The app's fetch code has no abort or timeout, and the wait is capped at about 5s, reached only when the product never repacks.
6. **Review 2's Dismissed list** (no `flushSync`, no ResizeObserver loop, the walk's own-function oracle is a real fixpoint test, card remounts hold no state, scrollbar bistability, NaN rem, the dropped card margin, trailing empty columns, cards read out of step, SSR mismatch, every busy-card reader updated) stands. The delta touches none of that code.

## Minor / nits

- `apps/site/test/screenshot/browser-walk.ts:2736`: the count check proves the placeholder repacked for a width change, not for a height-only change at the same count. A future step that compares placeholder left or top after its `rows` change would need more than this wait.
- In the bars step the helper's message is `At ${width}px: the Audience placeholder never packed...`, without the sidebar state the other messages carry. The step runs expanded only, so nothing is lost.
- Review 2's Minor list stands unchanged: the `AudienceColumns` JSDoc could state that a card must hold no state or focusable control, a few comment lines miss the 100-column width, `audience-columns.test.ts` declares `staging` twice, `audienceColumnRem` is exported but read only in its module, the inner card keys are unused, `app.test.ts:3567-3573` reads busy sections in document order, the `.audience-grid` name (review 1's Finding 2), and no check that DOM column N is Nth from the left.

## Test quality

- **Tests added or changed in the delta:** none added. Four existing walk steps gain a wait before they read the placeholder's geometry. No assertion changed, and the walk still has 88 steps.
- **Red at the prior HEAD:** shown by review 2's remediation, not re-run here. With every ResizeObserver notice delayed by 300ms, the note-places step failed at `0a79729` and passed at `a140c91`. That proves the wait is what turns the step green, and that the helper's throw is the real-browser check on the observer repack.
- **Weak tests:** review 2's note on `packs again when a card's height changes` and `stops on release` in `apps/web/src/audience-columns.test.ts` (the fake `resize()` notifies every observer) stands. It is still not strengthened, and still caught by `recheck watches the cards read now...`.
- **Tautology shapes:** 0.

## Before opening the PR

- **CI readiness:** lint, typecheck, build and the full suite are green at `ba9f252`, and `pnpm test:browser` passed three runs in a row.
- **Commit hygiene:** the branch holds the lane commit `814aba9`, its no-ff merge `bd488b5`, review 2's doc and repro (`0a79729`), the fix `a140c91`, the closure table `ba9f252`, and this doc.
- **Likely reviewer asks:**
  - A screenshot at 1512px with the staging-like heights.
  - Why the walk checks against the product's own function (review 2 Dismissed 3, and the limit statement in Finding 1 above).
  - #638's spec body still describes CSS columns and a fixed order. A proposal to rewrite it is in `.epic-loop/tickets/711/proposals.md`.

## Prior-review closure

Pre-PR review 2:

- **Finding 1 (MEDIUM), the placeholder read before it repacked:** fully fixed in `a140c91`. The recommended diff landed as written, at all four sites, and the walk passed 3 of 3 runs here.
- **Finding 2 (LOW, comment hygiene):** untouched, deferred by the remediation's default scope (CRITICAL, HIGH and MEDIUM only). Carried into Finding 1 above.

Fully fixed: 1. Partially fixed: 0. Untouched: 1, a LOW. No prior MEDIUM-or-higher finding is open, and none was resolved only by editing a comment or a doc.

## Verdict

**Ready to open the PR, with follow-ups.** Nothing gates it. Review 2's one MEDIUM is closed, and every check, the browser walk included, is green. The Confirmed list shrank from a MEDIUM and a hygiene batch to one hygiene batch. That is the expected end of the pattern, not a review short of findings. Finding 1 (LOW, comment hygiene) can ship in this PR as one batch commit, or as a follow-up.
