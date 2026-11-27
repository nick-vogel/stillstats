# Pre-PR review: creator-analytics#359 Move the web app's charts to TanStack Charts (round 5, fourth PR)

**Branch:** `creator-analytics-359-tanstack-charts` vs `origin/main` (merge-base `c7d20c1` "Merge pull request #407 from nick-vogel/creator-analytics-359-tanstack-charts", which already holds this epic's first three PRs)
**Reviewed at:** HEAD `1a2391c` ("creator-analytics#406 Bugs and follow-ups from #359, 2026-11-04, sixth run", the lane merge of `a4ff631`, same tree). The tree was clean, with no uncommitted or untracked files at review time. 1 file, +14 / −10 against the merge-base, test-only: `apps/web/src/cursor-plot.test.ts`.
**Delta under review:** none. A `--fresh` review of the whole surface against `origin/main`, which is only #406 (`a4ff631`, lane merge `1a2391c`).
**Reviewed against:** the epic #359 body (its end state and "no chart loses a behaviour"), the body of #406 (one item: no unit test sends a pen through the touch filter), #406's plan and recorded assumptions (only the pen half of review 4 finding 1 is in scope; the cancel half is proposed), `CODING_STANDARDS.md` 1 to 3, and the finding headings, Approach decisions and full finding 1 and 3 text of `pre-pr-review-4.md`. The repo has no `CLAUDE.md`.
**Date:** 2026-11-04
**Reviewer:** 1 code-review agent and a verify pass (mutation matrix run by the orchestrator)

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | up to date |
| Lint | `pnpm lint` | pass, 539 files |
| Typecheck | `pnpm typecheck` | pass (exit 0) |
| Build | `pnpm build` | pass (no production code in the diff) |
| Full suite | `pnpm test` (Docker up, Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | 124 files, 2,767 passed, 1 expected fail, first run |
| Touched test file | `pnpm exec vitest run apps/web/src/cursor-plot.test.ts` | 4 of 4 green |
| Browser walk | not run here | the diff changes no production code and no walk step; the lane ran it green at `a4ff631` (27 steps, no content security policy violation), and `1a2391c` has the same tree |
| New pen row at `$BASE` | `apps/web/src/CursorPlot.tsx` is byte-identical at `c7d20c1` and HEAD (`git diff --stat c7d20c1 HEAD -- apps/web/src/CursorPlot.tsx` empty), so HEAD's run is the base run | green, as expected: the row pins a filter `$BASE` already has. Mutation is the oracle |
| The pen row can go red | mutants of `CursorPlot.tsx:167` in a scratch worktree: `!== 'mouse'` (pen stopped too); a pen's `pointermove` only stopped; a pen's `pointercancel` only stopped | pen row red under all three, every other test green. So the row observes the move and the cancel separately |
| The pen row stays green when it should | mutant `!== 'pen'` (mouse stopped, pen passes) | mouse row red, pen row green |
| The mouse row still guards | mutants: stop every type; stop every type's move only; stop every type's cancel only | mouse row and pen row red under all three |
| Old suite misses the pen | `c7d20c1`'s test file with the `!== 'mouse'` mutant | 3 of 3 green, so #406's item was real before this change |
| The finger test's cancel half | mutant: delete the `'pointercancel', stopTouch` lines | **every test green** (finding 1, pre-existing and deferred) |
| Finding 1's fix | `sh docs/reviews/creator-analytics-359/repro/cancel-stop-unpinned.sh <scratch-dir>` at `1a2391c` | with the two-line change: 4 of 4 green on HEAD; finger test red without the cancel listener; pen row red with a pen stopped |
| Launch chart pen path | `sh docs/reviews/creator-analytics-359/repro/launch-pen-unpinned.sh <scratch-dir>`: `LaunchChart.tsx`'s move and leave filters narrowed to `=== 'mouse'` | every `apps/web` unit test green, 51 files, 1,390 tests (finding 2) |
| Pointer probe (finder) | scratch worktree, single events after `placedOnWatching` | placed `[["1","0:06"],…]`; a move with no coordinates reads as (0, 0) and keeps the card on point 1; move then cancel hides it; cancel alone leaves it; a move to (320, 128) moves it to point 3 |
| Real phone or pen | not run | jsdom-class environment and headless Chrome only; no production code changed |

**Overall:** #406 does what it says. The pen row goes red when a pen is stopped on its move, on its cancel, or on both, and stays green when only a mouse is stopped, so it pins exactly the rule the filter's doc states. Everything is green on the first run. Three LOW findings remain, none from this diff's logic: the finger test's cancel half (deferred by #406's own decision), the launch chart's pen path (pinned by no test, pre-existing), and comment hygiene on the test file's header. The PR can open.

## Approach decisions
Carried forward from pre-PR reviews 1 to 4 unchanged:
- Library live region and second name: the library chart sits inside an `aria-hidden` wrapper in the app's slider (#369 assumption); recommended fixes keep the wrapper.
- Keys: the library's keyboard is off and the app's `useChartSlider` drives the cursor (#369).
- Series colour rule: one unit test walks each definition's rendered scene (`apps/web/src/chart-colours.test.ts`, `straysAmong`).
- `ChartPoint` keeps only `day` (#372 assumption).
- Point count rule: pinned by a happy-dom test on a mounted `AudienceRetention` (`apps/web/src/cursor-plot.test.ts`, #391).
- Touch filter: a native capture-phase listener on `.cursor-plot`, set in a ref callback, stopping touch `pointermove` and `pointercancel` (#396).
- Card width: `max-width: calc(100% - 16px) !important` on `.cursor-plot .ts-chart-tooltip` (#397).
- #396's test seam: `apps/web/src/cursor-plot.test.ts` holds a happy-dom pin of the touch filter beside the browser walk (review 3 finding 1, landed as #400 item 1).
- A tapped card clears on a later tap off the charts through the slider's blur rule (`apps/web/src/ChartSlider.tsx:105-111`); the library's `mouseleave` clear stays unstopped (#400 item 2, dropped by decision).
- The tap steps' focus and name checks share one walk helper, `tapLeavesFocusOnSlider` (#398).
- Pinning the cancel stop: a pen's move gives the library a cursor of its own before the finger's cancel arrives, so the cancel has something to clear when it is not stopped (review 4 finding 1). Still the recommended fix; see finding 1.

Recorded by this branch's ticket, and kept:
- A pen's passing is pinned by running the mouse control as `test.each(['mouse', 'pen'])` (#406 assumption), not by a separate pen test.

This round adds one:
- The launch chart's pointer behaviour is the browser walk's to pin, as `apps/web/src/launch-chart.test.ts:4` and `apps/web/src/app.test.ts:406-410` state (happy-dom resolves no launch point). A pen on the launch chart gets a walk step mirroring `state: stacked charts pen` (`apps/site/test/screenshot/browser-walk.ts:999-1029`), not a unit test (finding 2).

## Confirmed Issues

### 1. The finger test's cancel half is still pinned by no unit test, though the test's name claims the cancel — LOW
- **Location:** `apps/web/src/cursor-plot.test.ts:137-149` (the finger test); the stop under test is `apps/web/src/CursorPlot.tsx:170` (`plot.addEventListener('pointercancel', stopTouch, { capture: true })`) and its removal at `:173`.
- **Attribution:** pre-existing, untouched. The finger test came in with `694da48` ("creator-analytics#400 Bugs and follow-ups from #359, 2026-11-04"), on `$BASE`; this branch does not change it. It is the cancel half of `pre-pr-review-4.md` finding 1. **Deferred by decision:** #406's recorded assumption scopes the ticket to the pen half only, and the orchestrator holds a proposal for the cancel half ("Pin the touch cancel stop: the finger test stays green without the pointercancel listener", `.epic-loop/tickets/406/proposals.md`).
- **Real-world trigger:** a later change drops the `pointercancel` listener, and `pnpm test`, CI and the browser walk all stay green (review 4 ran the walk under that mutant). LOW, capped: no creator path today puts a library-owned cursor under a finger's cancel, because the finger's `pointerdown` places the card through the app first (`CursorPlot.tsx:177-181`). The risk is coverage the test name overstates.

**Evidence**
```ts
    sendTo(watching, 'touch', [
      ['pointerdown', watchingPoint.first],
      ['pointermove', watchingPoint.third],
      ['pointermove', watchingPoint.last],
    ])
    expect(shown()).toEqual(placed)

    sendTo(watching, 'touch', [['pointercancel', watchingPoint.last]])
    expect(shown()).toEqual(placed)
```

**Failure mode** — the library's cancel handler (`clearPointerFocus`, `apps/web/node_modules/@tanstack/charts/dist/renderer.js:539-547`) clears only when the pointer owns the focus (`focusOwner === "pointer"`, set only by `handlePointerMove` and `handlePointerDown`, `:516-537`). The finger's moves are stopped, so at its cancel the cursor is the keys', and the cancel is a no-op whether or not it is stopped. Executed at `1a2391c` with `repro/cancel-stop-unpinned.sh`: as committed, all 4 tests pass with the `pointercancel` listener deleted.

**Recommended fix** — give the library a cursor at the placed point through a pointer type that passes, then send the finger's cancel.
```diff
     expect(shown()).toEqual(placed)
 
+    sendTo(watching, 'pen', [['pointermove', watchingPoint.first]])
+    expect(shown()).toEqual(placed)
     sendTo(watching, 'touch', [['pointercancel', watchingPoint.last]])
     expect(shown()).toEqual(placed)
   })
```

**Remediation brief**
- **Design intent:** `keepTouchFromLibrary` (`CursorPlot.tsx:160-175`) stops a finger's `pointermove` and `pointercancel` in the capture phase on the plot, before the library's container sees them; a mouse's and a pen's pass. The library's cancel clears only a cursor its own pointer set, so a cancel test must first let the library own the cursor. A pen's move onto `watchingPoint.first` does, and leaves the card where the keys put it (point 1), so the card is unchanged before the cancel and must stay unchanged after it.
- **Full surface:** `apps/web/src/cursor-plot.test.ts:145-147` only (two lines inserted between the move assertion and the cancel). No production change.
- **Must preserve:** the finger test's assertion after the moves (red when `ref={keepTouchFromLibrary}` or the `pointermove` listener is removed, review 4 row "#400 finger test can go red"); the `test.each(['mouse', 'pen'])` row and its red under `!== 'mouse'`, a pen's move only stopped, a pen's cancel only stopped, and the three "stop every type" mutants (this doc's table); `the chart cursor` test and `renderRetention` unchanged; `pnpm lint` clean.
- **Do not touch:** the finger's `pointerdown` on `watchingPoint.first` (review 4 Dismissed: it is the pan's start, not a tap test); `sendTo`'s signature (see Minor, bare strings); header lines 2-13 except through finding 3.
- **Proof:** `sh docs/reviews/creator-analytics-359/repro/cancel-stop-unpinned.sh <scratch-dir>` from the repo root. At `1a2391c` its "recommended" matrix applies exactly these two lines (its second edit no longer matches, because the mouse control is already a `test.each`) and shows the finger test red under "no cancel listener". After the fix, `pnpm exec vitest run apps/web/src/cursor-plot.test.ts` passes 4 tests, and the script's "committed: no cancel listener" block shows the finger test red.

### 2. No test sends a pen to the launch chart, so its move and leave filters can stop a pen unseen — LOW
- **Location:** `apps/web/src/LaunchChart.tsx:276-278` (`if (event.pointerType !== 'touch') pointAt(event)`) and `:204-206` (`if (pointerType !== 'touch') leave.current()`).
- **Attribution:** pre-existing, untouched. The move filter is from `5b0e086` ("creator-analytics#85 Launch chart: each video's first days…") and the leave filter from `142257b` ("creator-analytics#371 Charts: the launch chart on TanStack Charts"), both on `$BASE`. This branch closes the same gap for `CursorPlot` (#406) and walks past the launch chart's twin, two modules away, so by `CODING_STANDARDS.md` 3 it belongs in an issue, not this diff.
- **Real-world trigger:** a later change narrows either filter to a mouse (`=== 'mouse'`), and `pnpm test`, CI and the browser walk stay green. A creator with an iPad and a Pencil then hovers the launch chart and gets no card, or a card that stays after the pen leaves. LOW: no defect today; a coverage gap with a plausible user path once it regresses.

**Evidence**
```tsx
            onPointerMove={(event) => {
              if (event.pointerType !== 'touch') pointAt(event)
            }}
```
```ts
    const onLeave = ({ pointerType }: globalThis.PointerEvent) => {
      if (pointerType !== 'touch') leave.current()
    }
```

**Failure mode** — executed with `repro/launch-pen-unpinned.sh` at `1a2391c`: with both filters narrowed to `=== 'mouse'`, all 51 `apps/web` test files (1,390 tests) pass. The only unit test that sends a launch pointer event is `apps/web/src/app.test.ts:398-404`'s `pointer` helper, fixed to `pointerType: 'mouse'`. The walk sends a pen only in `state: stacked charts pen` (`browser-walk.ts:1011`, `:1027`); the launch steps (`:1359`, `:1490`, `:1536`, `:1582`, `:1613`, `:1845`) drive a mouse, keys and touch.

**Recommended fix** — a follow-up ticket: add a walk step `state: launch chart pen` beside `state: launch chart pointer`, built like `state: stacked charts pen` (`browser-walk.ts:999-1029`): `Input.dispatchMouseEvent` `mouseMoved` with `pointerType: 'pen'` onto the launch plot shows a card and a second point moves it, and a pen move off the plot hides it. Its red is by mutant: `launch-pen-unpinned.sh`'s narrowing turns the step red.

**Remediation brief**
- **Design intent:** the launch chart's pointer is two-dimensional (nearest line and day). A mouse's and a pen's move select through `pointAt`; a finger selects on `pointerdown` (a tap) and its moves are ignored, so a scroll keeps the card. A non-touch `pointerleave` clears the selection; a touch's does not, so a tapped card stays. happy-dom resolves no launch point (`app.test.ts:406-410`), so which point a pointer selects is the walk's to pin.
- **Full surface:** `apps/site/test/screenshot/browser-walk.ts` (a new step near `:1359`); no production change. `LaunchChart.tsx:204-206` and `:276-278` stay as they are.
- **Must preserve:** every existing walk step green under `pnpm run test:browser` (27 steps today), the content security policy check, and the step order that leaves the screen in the state the next launch step expects (each launch step's own setup).
- **Do not touch:** `LaunchChart.tsx:278-280` (`onPointerDown`, touch only: the tap path, pinned by `state: launch chart tap`).
- **Proof:** `sh docs/reviews/creator-analytics-359/repro/launch-pen-unpinned.sh <scratch-dir>` shows the gap now (all green under the mutant). After the fix, `pnpm run test:browser` passes with the new step, and the same narrowing applied in a scratch worktree turns `state: launch chart pen` red.

### 3. Comment hygiene — LOW (aggregated)
Attribution: the first entry extends a pre-existing sentence to the pen in `a4ff631` (#406); the second is on `$BASE`, from `694da48` (#400), and is review 4 finding 3's last entry, left out of #406 by its plan.
- `apps/web/src/cursor-plot.test.ts:11-12` — "…and the mouse's and the pen's carry none, so they show only which pointer types reach the library." (they carry no coordinates, which a `PointerEvent` reads as (0, 0), beside the first point the card already sits on; the move takes the library's cursor there and only the cancel shows it, because the library clears only a cursor its pointer set) → "…and the mouse's and the pen's give none, so they land at (0, 0) beside the first point the card already sits on: the move gives the library the cursor without moving the card, and the cancel then hides it, which a cancel alone would not, so they show only which pointer types reach the library."
- `apps/web/src/cursor-plot.test.ts:2-5` — "…so the cursor is placed by the app's own key handler (focus, then `ArrowRight`), not by the library's pointer; the browser walk is where that pointer is exercised, in Chrome." (the second describe block sends pointer events that the library resolves) → "…so each test places the cursor with the app's own key handler (focus, then `ArrowRight`); the pointer tests below show only which events reach the library, and the browser walk is where a real pointer is exercised, in Chrome."

## Needs Further Investigation
None.

## Reviewed and Dismissed
- The pen row might pass on a mouse's behaviour alone, as a duplicate of the mouse row. Mutants separate them: `!== 'mouse'` turns only the pen row red, `!== 'pen'` only the mouse row.
- The pen row might observe only the cancel. Stopping only a pen's `pointermove` turns it red, because the cancel then finds a keys-owned cursor and clears nothing; stopping only its `pointercancel` turns it red too.
- Two rows of one `test.each` might break `CODING_STANDARDS.md` 2's "one rule, one test". Each row states one pointer type's passing, two rules the filter's doc names separately (`CursorPlot.tsx:163`).
- The pen sends no `pointerdown`, so the touch-only `onPointerDown` (`CursorPlot.tsx:177-181`) cannot confound the row.
- The test name says the move reaches the library, yet the card does not move on it. The probe shows the move takes the library's cursor at point 1 (the placed point); a move to (320, 128) moves the card to point 3, so a non-touch move does reach the library. The comment wording is finding 3.
- The `%s` names render as "lets a mouse's …" and "lets a pen's …", so each row names its rule.
- The pen row is green at `$BASE`. Expected: `CursorPlot.tsx` is unchanged since `c7d20c1`, and the row is a guard for an existing rule, proven live by mutation.
- The header's finger claim ("a finger's carry the coordinates of the watching line's points") holds: `watchingPoint` matches the watching path (review 4, verified table).

## Minor / nits
- `apps/web/src/cursor-plot.test.ts:114` and `:151`: the pointer types are bare strings (`pointerType: string`), so a typo such as `'pne'` passes the touch filter and runs as a silent second mouse row while the pen goes unguarded. `test.each(['mouse', 'pen'] as const)` with `sendTo` taking `'mouse' | 'pen' | 'touch'` makes it a type error (#406 lane review F1.1).
- `apps/web/src/cursor-plot.test.ts:151-163`: nothing at the row says the move is observed only through the cancel. Finding 3's first corrected text carries it; a remediator who takes that entry needs nothing more.

## Test quality
Tests added: 1 row (`test.each(['mouse', 'pen'])` turns the mouse control into a mouse row and a pen row). Green against `$BASE`: 1, the pen row, as expected for a guard of a filter `$BASE` already has; mutation is the oracle. Under the mutation matrix the pen row is red for a pen stopped on both events, on its move only and on its cancel only, and green when only a mouse is stopped; the mouse row keeps its red under every "stop every type" mutant. Tautology shapes found: 0 in the diff (no self-computed expectation, mock, call-shaped assertion, snapshot or assertion-free test; `sliderTextOf(null)` maps null to a constant, review 4 Dismissed). The pre-existing prose-shaped assertion after the finger's cancel stays (finding 1).

## Prior-review closure
This is a fresh review of the fourth PR's surface, not a delta from review 4, so no prior finding is under re-verification. For the record: review 4 finding 1's pen half is fully fixed by `a4ff631` (proved above); its cancel half is untouched and deferred by #406's decision (finding 1 here). Review 4 finding 2 (walk hygiene) and finding 3's `browser-walk.ts` entries are untouched and outside this surface; finding 3's `cursor-plot.test.ts:2-5` entry is untouched and repeats as finding 3 here.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and test are green at `1a2391c`. The browser walk was green at `a4ff631` (same tree) and is not in CI.
- **Commit hygiene:** one implement commit and its lane merge, nothing to drop. This review adds `docs/reviews/creator-analytics-359/pre-pr-review-5.md` and `repro/launch-pen-unpinned.sh`.
- **Likely reviewer asks:** a one-file test PR, so the asks are small: whether the cancel half (finding 1) should ride along since its fix is two lines, and the upstream issue #373, still not filed (ready-for-human).

## Verdict
Ready to open the PR with follow-ups. Zero CRITICAL, HIGH or MEDIUM findings and three LOW, so nothing gates the PR. #406's item is closed with a proved guard. Finding 1 was deferred by #406's own decision and has a ready two-line fix with an executed proof; finding 2 is follow-up ticket material (a walk step); finding 3 is two header-comment edits.
