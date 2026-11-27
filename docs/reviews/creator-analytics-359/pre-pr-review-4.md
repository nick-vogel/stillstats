# Pre-PR review: creator-analytics#359 Move the web app's charts to TanStack Charts (round 4, third PR)

**Branch:** `creator-analytics-359-tanstack-charts` vs `origin/main` (merge-base `e9eba04` "Merge pull request #403 from nick-vogel/creator-analytics-359-tanstack-charts", which already holds this epic's first two PRs)
**Reviewed at:** HEAD `1fc8989` ("creator-analytics#400 Bugs and follow-ups from #359, 2026-11-04", the lane merge of `9a769d4`). The tree was clean, with no uncommitted or untracked files at review time. 2 files, +213 / −18 against the merge-base, both test-only: `apps/site/test/screenshot/browser-walk.ts` and `apps/web/src/cursor-plot.test.ts`.
**Delta under review:** none. A `--fresh` review of the whole surface against `origin/main`, which is only the three tickets landed since PR #403 merged: #398 (`7b1a609`, lane merge `a3202f3`), #399 (`2c4ac2c`, lane merge `08a15ab`) and #400 (`694da48`, `9a769d4`, lane merge `1fc8989`).
**Reviewed against:** the epic #359 body (its end state and "no chart loses a behaviour"), the bodies of #398, #399 and #400, each ticket's recorded assumptions (including #400 item 2's drop), `CODING_STANDARDS.md` 1 to 3, and the finding headings, Approach decisions and Minor list of `pre-pr-review-3.md`. The repo has no `CLAUDE.md`.
**Date:** 2026-11-04
**Reviewer:** 1 code-review agent, 1 tautology and mutation agent, and a verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | up to date |
| Lint | `pnpm lint` | pass, 539 files |
| Typecheck | `pnpm typecheck` | pass (exit 0) |
| Build | `pnpm build` | pass; `apps/web` JS 747.34 kB / 245.76 kB gzip, unchanged from review 3 (no production code in the diff) |
| Full suite | `pnpm test` (Docker up, Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | 124 files, 2,758 passed, 1 expected fail, first run |
| Browser walk | agent: `pnpm run test:browser` in a scratch worktree at `1fc8989` | pass, first run: 27 steps, no content security policy violation |
| New unit tests at `$BASE` | agent: scratch worktree at `e9eba04`, HEAD's `cursor-plot.test.ts` copied in, `pnpm exec vitest run apps/web/src/cursor-plot.test.ts` | 3 of 3 green. Expected: both new tests pin #396's filter, which `$BASE` already has (#400 item 1) |
| #400 finger test can go red | agent mutants in `apps/web/src/CursorPlot.tsx`: delete `ref={keepTouchFromLibrary}`; remove only the `pointermove` listener; touch stops only the cancel | finger test red under all three, `expected [['4','10:00'],…] to deeply equal [['1','0:06'],…]` |
| #400 cancel stop | agent mutants: remove only the `pointercancel` listener; touch stops only the move | **every unit test green, and the walk green too** (finding 1) |
| #400 pen | agent mutant: `pointerType !== 'mouse'` (a pen stopped too) | every unit test green (finding 1); the walk red on `state: stacked charts pen`, "A pen 15% across did not show a card" |
| #400 mouse control | agent mutants: stop every type; stop every type's move only; stop every type's cancel only | mouse control red under all three, so it observes the move and the cancel separately |
| #399 step goes red | agent mutant: delete `.cursor-plot .ts-chart-tooltip { max-width: … }` (`apps/web/src/app.css:799-802`), walk | `state: launch chart card at 375px` red at the first day: card right 391.19 against the plot's 355, longest title `scrollWidth` 245 = `clientWidth` (not cut); `state: chart cards inside the plot at 375px` red as in review 3 |
| #398 step goes red | agent mutant: delete `onMouseDown={onMouseDown}` (`CursorPlot.tsx:190`), walk; then the same with `eachNamesOneSlider` in `tapLeavesFocusOnSlider` commented out | `state: stacked charts tap` red: `"Watch hours. …" names ["slider","image"], not one slider`; with the name check out, `A tap 15% across left focus off the slider: {"slider":false,"svg":true}`. The walk records each step's failure and carries on, so no earlier step masked it |
| Finding 1's recommended tests | `sh docs/reviews/creator-analytics-359/repro/cancel-stop-unpinned.sh <scratch-dir>` | as committed: 3 of 3 green on HEAD, without the cancel listener, and with a pen stopped. With the change: 4 of 4 green on HEAD; the finger test red without the cancel listener; the pen control red with a pen stopped |
| Comment claims in the new test block | finder: happy-dom 21.0.1 `getScreenCTM()` returns `new DOMMatrix()`; the library's `svg-coordinates.js` uses it; the svg's viewBox is `0 0 640 320`; the watching path is `M6.4,0L12.8,32L320,128L640,192` | true: `watchingPoint`'s first, third and last match the path |
| Mergeability | `git merge-tree --write-tree HEAD origin/main` | clean; `origin/main` has moved to `c3dbe5f` ("Merge pull request #405 …360-shadcn-tailwind-migration") since the merge-base |
| Real phone | not run | the walk emulates touch in headless Chrome; this diff changes no production code, so nothing new needs a phone |

**Overall:** The three tickets do what they say. Each new walk check goes red for its own rule when its fix is removed, and all checks are green on the first run. The finger test pins #396's move stop. But its second half, the finger's cancel, passes even with the cancel stop removed, and no test sends a pen. Both are fixed with a four-line change that this review executed. The other two findings are walk hygiene and comment hygiene. All three are LOW, and the PR can open.

## Approach decisions
Carried forward from pre-PR reviews 1 to 3 unchanged:
- Library live region and second name: the library chart sits inside an `aria-hidden` wrapper in the app's slider (#369 assumption); recommended fixes keep the wrapper.
- Keys: the library's keyboard is off and the app's `useChartSlider` drives the cursor (#369).
- Series colour rule: one unit test walks each definition's rendered scene (`apps/web/src/chart-colours.test.ts`, `straysAmong`).
- `ChartPoint` keeps only `day` (#372 assumption).
- Point count rule: pinned by a happy-dom test on a mounted `AudienceRetention` (`apps/web/src/cursor-plot.test.ts`, #391).
- Touch filter: a native capture-phase listener on `.cursor-plot`, set in a ref callback, stopping touch `pointermove` and `pointercancel` (#396).
- Card width: `max-width: calc(100% - 16px) !important` on `.cursor-plot .ts-chart-tooltip` (#397).
- #396's test seam: `apps/web/src/cursor-plot.test.ts` holds a happy-dom pin of the touch filter beside the browser walk (review 3 finding 1, landed as #400 item 1).

Recorded by this branch's tickets, and kept:
- A tapped card clears on a later tap off the charts through the slider's blur rule (`apps/web/src/ChartSlider.tsx:105-111`), as the epic's spec asks; the library's `mouseleave` clear stays unstopped (#400 item 2, dropped by decision, `.epic-loop/tickets/400/assumptions.md`).
- The tap steps' focus and name checks share one walk helper, `tapLeavesFocusOnSlider` (#398).

This round adds one:
- Pinning the cancel stop: a pen's move gives the library a cursor of its own before the finger's cancel arrives, so the cancel has something to clear when it is not stopped; the mouse control runs for a pen too (finding 1). This follows the file's existing seam (events sent to the library's svg through `sendTo`) and adds no production code.

## Confirmed Issues

### 1. The finger test's cancel half and a pen's passing are pinned by no unit test, though the test's name claims the cancel — LOW
- **Location:** `apps/web/src/cursor-plot.test.ts:136-149` (the finger test) and `:151-160` (the mouse control); the stops under test are `apps/web/src/CursorPlot.tsx:165-175`.
- **Attribution:** introduced by `694da48` ("creator-analytics#400 Bugs and follow-ups from #359, 2026-11-04"), which added both tests; `git log -S'placedOnWatching' e9eba04..HEAD` names only it. `9a769d4` moved the finger's moves onto the watching line's points, which pinned the move stop but not the cancel. The cancel stop itself is from #396 and on `$BASE`, where review 3's Minor list noted it "has no observable effect while the move is stopped". This branch's test is the first to claim it.
- **Real-world trigger:** a later change drops the `pointercancel` listener or widens the filter to stop a pen (`!== 'mouse'`), and `pnpm test` stays green. The pen half is caught by the local browser walk (`state: stacked charts pen`), but the walk stays out of CI. The cancel half is caught by nothing. LOW, capped: today no creator path puts a library-owned cursor under a finger's cancel, because a finger's `pointerdown` places the card through the app first (`CursorPlot.tsx:177-181`). The real risk is coverage that the test name overstates.

**Evidence**
```ts
    sendTo(watching, 'touch', [['pointercancel', watchingPoint.last]])
    expect(shown()).toEqual(placed)
  })

  test("lets a mouse's move and cancel reach the library, which hides the card on both plots", () => {
    const { watching, shown } = placedOnWatching()

    sendTo(watching, 'mouse', [['pointermove'], ['pointercancel']])
```

**Failure mode** — the library's cancel handler (`clearPointerFocus`, `apps/web/node_modules/@tanstack/charts/dist/renderer.js:539-547`) calls `clearOwnedTransient`, which clears only a cursor the library itself set. The finger's moves are already stopped, so when the finger's cancel arrives the cursor is the app's (placed by the keys), and the cancel is a no-op whether or not it is stopped. Executed with `repro/cancel-stop-unpinned.sh`: as committed, all three tests pass on HEAD, on HEAD without the `pointercancel` listener, and on HEAD with a pen stopped too.

**Recommended fix** — in the finger test, give the library a cursor at the placed point through a pointer type that passes, then send the finger's cancel. Run the mouse control for a pen as well. Then run `pnpm format` (biome wraps the `test.each` call).
```diff
     expect(shown()).toEqual(placed)
 
+    sendTo(watching, 'pen', [['pointermove', watchingPoint.first]])
+    expect(shown()).toEqual(placed)
     sendTo(watching, 'touch', [['pointercancel', watchingPoint.last]])
     expect(shown()).toEqual(placed)
   })
 
-  test("lets a mouse's move and cancel reach the library, which hides the card on both plots", () => {
+  test.each(['mouse', 'pen'])(
+    "lets a %s's move and cancel reach the library, which hides the card on both plots",
+    (pointerType) => {
     const { watching, shown } = placedOnWatching()
 
-    sendTo(watching, 'mouse', [['pointermove'], ['pointercancel']])
+    sendTo(watching, pointerType, [['pointermove'], ['pointercancel']])
```
(and close the `test.each` body with `},\n  )` in place of `})`).

**Remediation brief**
- **Design intent:** `keepTouchFromLibrary` stops a finger's `pointermove` and `pointercancel` in the capture phase on the plot, before the library's container sees them; a mouse's and a pen's pass. The library's cancel clears only a cursor its own pointer set (`clearOwnedTransient`), so a cancel test must first let the library own the cursor (a pen's move onto the placed point does, and leaves the card where the keys put it) and then show the finger's cancel does not clear it. The mouse control's move at (0, 0) hovers the first point, the one the keys placed, and its cancel then clears it.
- **Full surface:** `apps/web/src/cursor-plot.test.ts:136-149` and `:151-160` only. No production change: `apps/web/src/CursorPlot.tsx:160-175` stays as it is.
- **Must preserve:** the finger test's first assertion after the moves (red when `ref={keepTouchFromLibrary}` or the `pointermove` listener is removed, review row "#400 finger test can go red"); the mouse control's red under "stop every type", "stop every type's move" and "stop every type's cancel"; the existing `the chart cursor` test and `renderRetention` unchanged; `pnpm lint` clean.
- **Do not touch:** the finger's `pointerdown` on `watchingPoint.first` (Dismissed: it is the pan's start, not a tap test); the expectation through `sliderTextOf(null)` (Dismissed); the `mouseleave` path (#400 item 2, dropped by decision).
- **Proof:** `sh docs/reviews/creator-analytics-359/repro/cancel-stop-unpinned.sh <scratch-dir>` from the repo root. After the fix, `pnpm exec vitest run apps/web/src/cursor-plot.test.ts` passes 4 tests at HEAD. In a scratch worktree, deleting the `'pointercancel', stopTouch` lines from `CursorPlot.tsx` turns the finger test red, and changing `=== 'touch'` to `!== 'mouse'` turns the pen control red. The script's "recommended" matrix shows exactly this.

### 2. Walk and test hygiene: the edited tap steps keep hand copies of `tapAt`, the moved focus check's `svg` field names the wrapper and adds nothing, and the new code copies two setups — LOW
- **Location:** `apps/site/test/screenshot/browser-walk.ts:1043-1046` and `:1185-1188` (hand-dispatched taps beside `tapAt` at `:1071-1075`); `:755-756` (the `svg` field in `tapLeavesFocusOnSlider`); `:1728-1781` (`launchCardFits`'s poll and throw, copied from `cardInsidePlot` at `:1691-1716`); `apps/web/src/cursor-plot.test.ts:126-134` (`placedOnWatching`, copying the existing test's render, focus and `ArrowRight` at `:75-80`).
- **Attribution:** introduced. `7b1a609` (#398) edited both tap functions and moved the `svg` read into the helper (`git log -S'tapLeavesFocusOnSlider' e9eba04..HEAD`); `2c4ac2c` (#399) added `launchCardFits`; `694da48` (#400) added `placedOnWatching`. The copies of `tapAt` and the `svg` read are on `$BASE` in the retention step, and the diff walked past them on lines it touched (`CODING_STANDARDS.md` 3).
- **Real-world trigger:** none for a creator. A maintainer changing how the walk taps or polls a card edits four places and misses one. LOW.

**Evidence**
```ts
        const { x, y } = await across(second as string, share)
        await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
        await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
        // The card stays after the finger lifts.
        await delay(settleMs)
```
```js
        const svg = this.querySelector('.cursor-plot-chart')
        return { slider: document.activeElement === this, svg: !!svg?.contains(document.activeElement) }
```

**Failure mode** — maintenance only. `tapAt` does exactly the three dispatch lines. `svg` holds the `.cursor-plot-chart` wrapper, not the svg. When `slider` is true, `svg` is false, because the wrapper is the slider's descendant and cannot contain the slider. Mutant 3c' shows the two fields flip together (`{"slider":false,"svg":true}`).

**Recommended fix** — replace both hand-dispatched taps with `await tapAt({ x, y })` (the comment "The card stays after the finger lifts." is `tapAt`'s doc and goes with it). Rename `svg` to `wrapper` in the helper's read and keep both fields, since the error prints them. Let `placedOnWatching` serve the existing test's setup only if that test's two `ArrowRight` presses and its `spoken()` read stay as they are; otherwise leave it. Leave `launchCardFits` and `cardInsidePlot` separate unless one poll helper takes the in-page predicate as an argument, since their checks differ.

**Remediation brief**
- **Design intent:** the walk drives each control through Chrome DevTools Protocol input events and finds controls by role and name. Shared helpers (`tapAt`, `cardInsidePlot`, `eachNamesOneSlider`) carry each input and check once, and a step's error names the state it could not reach.
- **Full surface:** `apps/site/test/screenshot/browser-walk.ts:1043-1046`, `:1185-1188`, `:755-756`; optionally `apps/web/src/cursor-plot.test.ts:75-80`.
- **Must preserve:** the 200 ms (`settleMs`) wait after each tap, before the state read; the order in `tapLeavesFocusOnSlider` (name check, then focus read) and its error text; the retention step's retry loop after a tap (`:1190-1199`); every walk step green under `pnpm run test:browser`.
- **Do not touch:** the stacked click step's own inline checks (`:1648-1684`), which are on lines this branch did not touch.
- **Proof:** `pnpm run test:browser` green, 27 steps; in a scratch worktree, deleting `onMouseDown={onMouseDown}` from `apps/web/src/CursorPlot.tsx` still turns `state: stacked charts tap` red.

### 3. Comment hygiene — LOW (aggregated)
Attribution: introduced by `2c4ac2c` (#399), `7b1a609` (#398) and `694da48` (#400).
- `apps/site/test/screenshot/browser-walk.ts:1646-1647` — "…the one step after it loads the screen afresh." (two steps follow it now, `state: chart cards inside the plot at 375px` and `state: launch chart card at 375px`, and both navigate) → "…each step after it loads the screen afresh."
- `apps/site/test/screenshot/browser-walk.ts:742-744` — "…names one slider: the checks `state: stacked charts click` makes for a press, which the stacked and retention tap steps make after each tap." (the click step makes the name check and checks the slider has focus, but never reads the wrapper) → "…names one slider and nothing inside the slider's `.cursor-plot-chart` wrapper holds focus. The stacked and retention tap steps make these checks after each tap."
- `apps/site/test/screenshot/browser-walk.ts:1842` — "…and a long title now cuts short with an ellipsis…" (narrates the change) → "…and a long title cuts short with an ellipsis…"
- `apps/site/test/screenshot/browser-walk.ts:1722` — "…with every title inside the card…" (`titlesInside` reads each title's border box, which the `minmax(0, 1fr)` column at `apps/web/src/app.css:882` keeps inside the card. The ellipsis checks carry the claim) → "…with the card inside the plot's width and the longest title cut short under an ellipsis…", and drop `titlesInside` from `fits` and the returned object.
- `apps/web/src/cursor-plot.test.ts:2-5` — "…so the cursor is placed by the app's own key handler (focus, then `ArrowRight`), not by the library's pointer; the browser walk is where that pointer is exercised, in Chrome." (the second block sends pointer events that the library resolves) → "…so each test places the cursor with the app's own key handler (focus, then `ArrowRight`); the pointer tests below show only which events reach the library, and the browser walk is where a real pointer is exercised, in Chrome."

## Needs Further Investigation
None.

## Reviewed and Dismissed
- The #399 first-day check could pass without the width rule, since a tooltip at `left: 8px` might shrink to fit. Mutant 3b turns it red at the first day: card right 391.19 against the plot's 355, title not cut.
- `second` might not be the slider the stacked tap targets. `across(second, share)` places the tap, and `tapLeavesFocusOnSlider(second, …)` checks the same slider. `this` is the `cursor-plot` div carrying `slider.plotProps` (`CursorPlot.tsx:186-195`).
- The retention tap step's refactor might change behaviour. It keeps the same order (`eachNamesOneSlider(retentionLabels)`, then the focus read) and byte-identical error text.
- The stacked tap's second focus check starts with focus already on `second`. The first tap starts blurred (`:1038`), and mutant 3c turns it red.
- The tap step now runs the accessibility check that the click step's comment keeps "late". `walk()` records a failure and carries on, and a failing tap step fails the run anyway. On a pass, nothing in the tree changes.
- The ArrowDown loop in `state: launch chart card at 375px` sends its presses with no wait between them. React handles each keydown synchronously, `launchStateWhere` waits on the result, and the step was green on every walk run (the ticket's, the agent's 3a, and the 3b and 3c runs, where it was not the mutated rule).
- The 375px launch step might leave state behind. It restores the viewport in `finally`, presses Escape and blurs, and it is the last step before `browser.close()`.
- `launchCardFits` might measure the wrong box. `this` is the launch plot (`LaunchChart.tsx:270-272`, `className="chart-plot cursor-plot"`). The card-below-plot test matches `.launch-chart .ts-chart-tooltip { top: calc(100% + 0.25rem) !important }` (`app.css:875-878`). With no titles, `cut` is null and `fits` is false, so the step cannot pass on an empty card.
- The finger's `pointerdown` lands on the placed point, so the test cannot tell a tap from no tap. It is the start of the pan, not a tap test, and `state: retention charts tap` pins the tap path in Chrome.
- `sliderTextOf(null)` in the expectations is not self-fulfilling. It maps null to a constant, and mutant 2e shows the assertion separates `0:06` from "No point selected".
- The new comments' coordinates claim (`getScreenCTM` is the identity, viewBox `0 0 640 320`, the watching points) holds. See the verified table.
- #400 item 2 (a tapped card cleared by a later tap elsewhere) was dropped by decision. The blur rule the spec asks for clears it in Chrome. Not re-raised.

## Minor / nits
- `apps/site/test/screenshot/browser-walk.ts:1736-1739`: `longest` is picked by character count, not rendered width. With a sample whose most-characters title fits while a wider one is cut, the step would fail falsely. It can never pass falsely.
- `apps/site/test/screenshot/browser-walk.ts:1052`: a second `second as string` cast inside the nested `tap`. Narrowing once, outside it, would serve both.
- `apps/site/test/screenshot/browser-walk.ts:1755-1757`: `titlesInside` checks only the right edge (see the comment hygiene entry, which drops it).
- `apps/web/src/CursorPlot.tsx:170`: the cancel stop still has no creator-visible effect today (review 3 Minor list). Finding 1 pins it as #396's criteria name it. It does not argue for removing it.

## Test quality
Tests added: 2 unit tests (`cursor-plot.test.ts`), 1 new walk step (`state: launch chart card at 375px`), and 2 walk steps extended through one helper (`state: stacked charts tap` gains the focus and name checks; `state: retention charts tap` moves its own onto the helper). At `e9eba04`, both unit tests are green, as expected: #400 item 1 pins #396's filter, which `$BASE` already has (`694da48`). Mutation is the oracle here. The finger test is red without the ref or the move stop, and the mouse control is red under every widening of the filter to a mouse. The cancel stop and a pen's passing survive every unit test (finding 1). Each walk check goes red for its own rule: #399 at the first day without the width rule, and #398 at the first tap without `onMouseDown`, through both halves of its helper. Tautology shapes found: 1 prose-shaped assertion, the finger test's assertion after the cancel (finding 1). No mocked units, call-shaped assertions, snapshots or assertion-free tests.

## Prior-review closure
This is a fresh review of the third PR's surface, not a delta from review 3, so no prior finding is under re-verification here. For the record, review 3 finding 1 (the #396 filter unpinned in `pnpm test`) is closed by #400 item 1 for the move stop. Its cancel half was a review 3 Minor, and it stays open as finding 1 here.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and test are all green at `1fc8989`, and the browser walk is green (it is not in CI).
- **Commit hygiene:** per-ticket implement commits and lane merges, with nothing to drop. This review adds `docs/reviews/creator-analytics-359/pre-pr-review-4.md` and `repro/cancel-stop-unpinned.sh`.
- **Likely reviewer asks:** `origin/main` has moved to `c3dbe5f` (#360's PR #405). It merges cleanly (`git merge-tree`), and the PR may want it merged first. Two more asks: the JS gzip size, unchanged at 245.76 kB, and the upstream issue #373, still not filed (ready-for-human).

## Verdict
Ready to open the PR with follow-ups. There are zero CRITICAL, HIGH or MEDIUM findings and three LOW findings, so nothing gates the PR. Finding 1 is worth taking first: it is a four-line test change with an executed proof, and it makes the finger test's name true. Findings 2 and 3 are walk and comment cleanup. They can ride in the same remediation or a follow-up.
