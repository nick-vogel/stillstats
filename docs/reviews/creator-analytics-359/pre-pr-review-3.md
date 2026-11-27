# Pre-PR review: creator-analytics#359 Move the web app's charts to TanStack Charts (round 3, second PR)

**Branch:** `creator-analytics-359-tanstack-charts` vs `origin/main` (merge-base `582aeeb` "Merge pull request #395 from nick-vogel/creator-analytics-360-shadcn-tailwind-migration", which already holds the first PR of this epic, `bbed62a` "Merge pull request #393 from nick-vogel/creator-analytics-359-tanstack-charts")
**Reviewed at:** HEAD `0dac71b` ("creator-analytics#397 Charts: the relative retention card does not wrap to the plot's width at 375px", the lane merge of `69dddbc`). The tree was clean, with no uncommitted or untracked files at review time. 7 files, +550 / −23 against the merge-base.
**Delta under review:** none. A `--fresh` review of the whole surface against `origin/main`, which is only the five tickets landed since PR #393 merged: #392 (`9fc46ff`, `8a4e4a0`), #391 (`08a7e45`, `ff0abf4`), #390 (`ddf1718`, `a0837e0`), #396 (`96db9c5`, `7c6bdff`) and #397 (`69dddbc`, `0dac71b`).
**Reviewed against:** the epic #359 body (its end state, testing decisions and "no chart loses a behaviour"), the bodies of #390, #391, #392, #396 and #397, each ticket's recorded assumptions, `CODING_STANDARDS.md` 1 to 3, and the finding headings and Needs Further Investigation of `pre-pr-review-1.md` and `pre-pr-review-2.md`. The repo has no `CLAUDE.md`.
**Date:** 2026-11-04
**Reviewer:** 2 code-review agents, 1 tautology and mutation agent, and a verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | up to date |
| Lint | `pnpm lint` | pass, 539 files |
| Typecheck | `pnpm typecheck` | pass (exit 0) |
| Build | `pnpm build` | pass; `apps/web` JS 747.34 kB / 245.76 kB gzip (245.68 kB at review 2) |
| Full suite | `pnpm test` (Docker up, Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | 124 files, 2,756 passed, 1 expected fail, first run |
| Browser walk | `pnpm run --if-present test:browser` | pass, first run: 26 steps, no content security policy violation; JS 242.7 kB gzip by the walk's measure |
| New tests at `$BASE` | agent: `git worktree add` at `582aeeb`, HEAD's `cursor-plot.test.ts`, `launch-plot.test.ts`, `components.test.ts` copied in, `pnpm exec vitest run` on them | 1 red (the zeros guide test, `expected 160 not to be 160`), 3 green: the #391 pin, the non-zero guides pin and the zeros labels pin, each an explicit pin of kept behaviour (see Test quality) |
| #391 pin can go red | agent mutant: delete `cursor.setState(null)` (`CursorPlot.tsx:66`); and separately `quiet.current()` | both red in `cursor-plot.test.ts` (`:90` and `:94`) |
| #392 tests can go red | agent mutants: `ruleY([0, chart.top], …)`; y domain `[0, chart.top]`; `[0, chart.top + 1]`; top label `axisCountTextOf(chart.top > 0 ? chart.top : 1)` | zeros guide red; unguarded domain red (zeros guide and the existing bottom-edge test); `+ 1` red (the non-zero guides test and 3 existing); the relabel red in `components.test.ts:851` |
| #396 fix is held | agent mutant: remove `ref={keepTouchFromLibrary}`; run `pnpm test` (whole web suite, 1,381 tests) and `pnpm test:browser` | every unit test green (finding 1); the walk red on `state: stacked charts touch drag` and `state: retention charts touch drag`, "cleared the card"; `state: launch chart touch drag` green (its own handler, `pointer: false`) |
| #396 halves | agent mutants: stop only `pointermove`; stop only `pointercancel`; probe logging each touch `pointercancel` at the plot | stop only `pointermove`: walk green. Stop only `pointercancel`: `retention charts touch drag` red, "moved the card off point 20". The probe logs a touch `pointercancel` in both drag steps, so the walk's drag does reach the plot and does end in a cancel |
| #396 in happy-dom | `sh docs/reviews/creator-analytics-359/repro/touch-stop-unpinned.sh <scratch-dir>` | HEAD: 3 of 3 pass. Without the ref: `a touch move then cancel keeps the card` fails. Without the `pointercancel` listener: 3 of 3 pass (finding 1) |
| Finding 1's recommended tests | scratch worktree at HEAD, the brief's diff appended to `cursor-plot.test.ts`, `pnpm exec vitest run apps/web/src/cursor-plot.test.ts`, `biome check` | HEAD 3 passed, biome clean; without the ref the finger test fails; with `stopTouch` stopping every pointer type the mouse test fails |
| #397 fix is held | agent mutant: delete the `.cursor-plot .ts-chart-tooltip` rule, rebuild, `pnpm test:browser` | `state: chart cards inside the plot at 375px` red: the relative card at End, right 386.0 against the plot's 355, 310 px wide in a 287 px plot |
| #390 tap step goes red | agent mutant: `onPointerDown` returns at once | `state: retention charts tap` red, "did not keep a card on both charts" (and the stacked tap and both drag steps) |
| `pointerType: 'pen'` on `Input.dispatchMouseEvent` | the Chrome DevTools Protocol's `Input.pdl` (github.com/ChromeDevTools/devtools-protocol) | `optional enum pointerType mouse pen`, default `mouse`, not experimental |
| Library listeners | `apps/web/node_modules/@tanstack/charts/dist/renderer.js:533-548`, `:693-708` | the container listens to `pointermove`, `pointerdown`, `pointercancel`, `mouseleave`, `click`, `keydown`, `focusin`, `focusout`, and the document to a capture `pointerdown`; nothing on `pointerleave` or `pointerout` |
| Real phone | not run | the walk emulates touch in headless Chrome; #396 and #397 were seen on a phone by Nick, and a phone re-check of both is the human step |

**Overall:** The five tickets do what they say, and each goes red when its fix is removed: the zeros guide, the point count pin, the retention tap, the finger scroll and the 375px card. All five full checks are green on the first run. The three findings are LOW: the finger scroll fix is held only by the local browser walk, though happy-dom can hold it in `pnpm test`; the walk's new steps leave a helper's three copies and two weaker-than-claimed checks; and one stylesheet comment overstates where the launch card sits. The PR can open.

## Approach decisions
Carried forward from pre-PR reviews 1 and 2 unchanged:
- Library live region and second name: the library chart sits inside an `aria-hidden` wrapper in the app's slider (#369 assumption); recommended fixes keep the wrapper.
- Keys: the library's keyboard is off and the app's `useChartSlider` drives the cursor (#369); nothing here moves a key into the library.
- Series colour rule: one unit test walks each definition's rendered scene (`apps/web/src/chart-colours.test.ts`, `straysAmong`); a later rule change edits `straysAmong`.
- `ChartPoint` keeps only `day` (#372 assumption).

Recorded by this branch's tickets, and kept:
- Point count rule: pinned, not removed, by a happy-dom test on a mounted `AudienceRetention` (`apps/web/src/cursor-plot.test.ts`, #391 assumption).
- Guides and y scale share `yDomainOf` from `apps/web/src/metric-plot.ts`; the launch chart's labels stay "0" top and bottom on only zeros (#392 assumptions).
- Touch filter: a native capture-phase listener on `.cursor-plot`, set in a ref callback, stopping touch `pointermove` and `pointercancel` (#396 assumption).
- Card width: `max-width: calc(100% - 16px) !important` on `.cursor-plot .ts-chart-tooltip`, after the `.launch-chart .ts-chart-tooltip` precedent (#397 assumption).

This round adds one:
- #396's test seam: the browser walk stays, and `apps/web/src/cursor-plot.test.ts` adds a happy-dom pin of the touch filter (finding 1). This takes the reversal #396's assumption names ("adding an `app.test.ts` case … if happy-dom turns out to clear the card there without the fix"), in the file that already mounts `AudienceRetention`, since `app.test.ts` renders the whole app and its Limits header keeps the charts out.

## Confirmed Issues

### 1. The finger scroll fix has no test in `pnpm test`, though happy-dom can observe it, so CI stays green when it is dropped — LOW
- **Location:** `apps/web/src/CursorPlot.tsx:165-175` and `:187`; the test belongs in `apps/web/src/cursor-plot.test.ts`.
- **Attribution:** introduced by `96db9c5` ("creator-analytics#396 Charts: a finger scroll that starts on a chart clears the card"); `git log -S'keepTouchFromLibrary' 582aeeb..HEAD` names only it. Its assumption chose "the browser walk only, with no happy-dom case … Reverse by: adding an `app.test.ts` case … if happy-dom turns out to clear the card there without the fix". The repro shows happy-dom does.
- **Real-world trigger:** a later change drops the ref, narrows the listener, or swaps it for a React prop that runs after the library's container. `pnpm test` and CI stay green; only `pnpm test:browser`, which runs locally and stays out of CI by the commit-stage rule, goes red. LOW, capped: it is a coverage gap, not a creator-visible defect today.

**Evidence**
```tsx
const keepTouchFromLibrary = useCallback((plot: HTMLDivElement) => {
  const stopTouch = (event: globalThis.PointerEvent) => {
    if (event.pointerType === 'touch') event.stopPropagation()
  }
  plot.addEventListener('pointermove', stopTouch, { capture: true })
  plot.addEventListener('pointercancel', stopTouch, { capture: true })
```
**Failure mode** — with `ref={keepTouchFromLibrary}` removed, all 1,381 web unit tests pass, and in the browser the card clears on a finger scroll (the walk's two drag steps go red). In happy-dom, the library's `pointermove` sets `focusOwner = "pointer"` and takes the cursor even with no point under it, and its `pointercancel` then clears (`renderer.js:516-548`), so no layout is needed to see it: `sh docs/reviews/creator-analytics-359/repro/touch-stop-unpinned.sh <scratch-dir>` prints a failing `a touch move then cancel keeps the card` without the ref and a pass at HEAD.

**Recommended fix** — append to `apps/web/src/cursor-plot.test.ts`, after the existing `describe('the chart cursor', …)`:
```ts
describe('a pointer on a retention plot', () => {
  function sendTo(plot: HTMLElement, pointerType: string, types: string[]) {
    const svg = plot.querySelector('.cursor-plot-chart svg')
    if (!svg) throw new Error('No library svg in the plot')
    for (const type of types) {
      act(() => {
        svg.dispatchEvent(new PointerEvent(type, { pointerType, bubbles: true }))
      })
    }
  }

  function placedOnWatching() {
    const retention = renderRetention(fourPoints)
    const [watching] = retention.plots
    if (!watching) throw new Error('No audience retention plot')
    act(() => watching.focus())
    retention.press(watching, 'ArrowRight')
    const placed = retention.shown()
    expect(placed.every(([, valueText]) => valueText !== sliderTextOf(null))).toBe(true)
    return { watching, placed, shown: retention.shown }
  }

  test('keeps the card on both plots when a finger lands on one, moves, and its pan cancels it', () => {
    const { watching, placed, shown } = placedOnWatching()

    sendTo(watching, 'touch', ['pointerdown', 'pointermove', 'pointercancel'])

    expect(shown()).toEqual(placed)
  })

  test("lets a mouse's move and cancel reach the library, which hides the card on both plots", () => {
    const { watching, shown } = placedOnWatching()

    sendTo(watching, 'mouse', ['pointermove', 'pointercancel'])

    expect(shown().map(([, valueText]) => valueText)).toEqual([
      sliderTextOf(null),
      sliderTextOf(null),
    ])
  })
})
```
Then extend the file's Limits header (lines 2 to 9) by one sentence: the pointer events here are sent to the library's svg with no coordinates, so they hit no point; they show which pointer types reach the library, and the browser walk's drag steps are where a real finger scroll is exercised. Executed: 3 of 3 pass at HEAD and biome is clean; without the ref the finger test fails; with `stopTouch` stopping every pointer type the mouse test fails.

**Remediation brief**
- **Design intent:** The card's state is the app's (`useChartCursor`'s `tap` and `show` write it with `cursor.setState`). The library may move or clear the cursor only from a mouse or a pen. A finger places the card through the app's own `onPointerDown` (`CursorPlot.tsx:177-181`), and every touch `pointermove` and `pointercancel` stops at `.cursor-plot` in the capture phase, before the library's container (`renderer.js:693-695`), so a pan neither moves nor clears it. The unit test pins which pointer types reach the library; the walk pins the real gesture.
- **Full surface:** `apps/web/src/cursor-plot.test.ts` only (the new `describe` after line 96, and one sentence in the header at lines 2 to 9). No production change.
- **Must preserve:** the existing `the chart cursor` test in the same file and its `renderRetention` helper unchanged; the walk steps `state: stacked charts touch drag`, `state: retention charts touch drag`, `state: stacked charts pen` and `state: launch chart touch drag` (`apps/site/test/screenshot/browser-walk.ts:975-1002`, `:1069-1087`, `:1194-1212`, `:1584-1612`), which stay the proof of the real gesture.
- **Do not touch:** the `pointercancel` listener at `CursorPlot.tsx:170` and `:173` (see Minor / nits: it has no observable effect while the move is stopped, but #396's criteria name it); `LaunchChart`, which needs no filter (Reviewed and Dismissed).
- **Proof:** `sh docs/reviews/creator-analytics-359/repro/touch-stop-unpinned.sh <scratch-dir>` shows the red without the ref today. After the fix, `pnpm exec vitest run apps/web/src/cursor-plot.test.ts` passes 3 of 3, and fails `keeps the card on both plots when a finger lands on one…` with `ref={keepTouchFromLibrary}` deleted from `CursorPlot.tsx:187` in a scratch worktree.

### 2. Walk hygiene: the new `tapAt` sits beside three inline copies, the retention target is computed twice, and the 375px step checks less than it claims — LOW
- **Location:** `apps/site/test/screenshot/browser-walk.ts:1013-1016`, `:1146-1149`, `:1560-1563` (the copies of `tapAt`, `:1032-1036`); `:1182` and `:1196` (the target); `:1692-1704` (`cardsInsideAtBothEnds`); `:1727-1735` (the stacked loop).
- **Attribution:** introduced. `tapAt` and the drag steps by `96db9c5` (#396); the retention tap step by `ddf1718` (#390); the 375px step by `69dddbc` (#397). The copies at `:1013` and `:1560` are on `$BASE`, and `tapAt` was added beside them (`CODING_STANDARDS.md` 3, a refactor walked past).
- **Real-world trigger:** none for a creator. A maintainer changing how the walk taps (a longer settle, a second touch point) edits one of four copies. And the 375px step would stay green if End or Home stopped one point short, or if a CDP error on a drawn stacked chart were taken for "not drawn" while another drew. LOW, capped: no user path.

**Evidence**
```ts
await pressKey(key, keyCode)
await samePointOnEvery(sliders, `${key} on the ${name} showed no card`)
for (const slider of sliders) {
  await cardInsidePlot(slider, `At the ${point} point of the ${name}`)
}
```
```ts
try {
  shown.push(await control('slider', label))
} catch {
  // Not drawn on a narrow screen.
}
```
**Failure mode** — `samePointOnEvery` checks only that the charts agree, so the box is measured wherever the card is and still reported as "At the last point". The bare `catch` swallows every error from `control`, which throws `No slider named "<label>" on screen` (`:288`) when the slider is missing, and other errors when CDP fails, and the step accepts any count from 1 to 3 though `stackedChartsQuery` (`apps/web/src/stacked-charts.ts:7`) draws one at 375px.

**Recommended fix**
- Replace the `touchStart` / `touchEnd` / `delay(settleMs)` lines at `:1013-1016`, `:1146-1149` and `:1560-1563` with `await tapAt({ x, y })`. `tapAt` is a function declaration in the same block, so it is hoisted to the earlier stacked tap step.
- Hoist `const retentionTarget = (count: number) => Math.min(count - 1, Math.max(1, Math.round(count * 0.2) - 1))` beside `retentionRatios` and call it at `:1182` (`first`) and `:1196` (`target`).
- In `cardsInsideAtBothEnds`, keep the states and require the point:
```ts
const states = await samePointOnEvery(sliders, `${key} on the ${name} showed no card`)
const max = await on(sliders[0] as string, `function () { return this.getAttribute('aria-valuemax') }`)
const expected = key === 'Home' ? '1' : max
if (!states.every((state) => state.valueNow === expected)) {
  throw new Error(`${key} on the ${name} did not reach the ${point} point: ${JSON.stringify(states)}`)
}
```
- In the stacked loop, rethrow unless the error is a missing slider, and require one chart:
```ts
} catch (error) {
  if (!(error instanceof Error) || !error.message.startsWith('No slider named')) throw error
}
```
and `if (shown.length !== 1) throw new Error(\`${shown.length} stacked charts show at 375px, not one\`)` in place of the `=== 0` check.

**Remediation brief**
- **Design intent:** each walk step proves one creator-visible behaviour in Chrome and fails loudly when it cannot reach its state (the file header, `:20-25`: "a step that silently did nothing cannot pass"). Shared gestures (a tap, a drag) are one helper each, so a change to how the walk touches the screen is made once.
- **Full surface:** `apps/site/test/screenshot/browser-walk.ts:1013-1016`, `:1146-1149`, `:1560-1563`, `:1182`, `:1196`, `:1692-1704`, `:1727-1735`.
- **Must preserve:** each tap step's own check after the tap (the stacked `samePointOnEvery` at `:1017`, the retention retry loop and focus check at `:1150-1177`, the launch `launchStateWhere` at `:1564`); `tapAt`'s `delay(settleMs)` ("the card stays after the finger lifts"); the 375px step restoring `viewport` in its `finally`; the step order, with the 375px step last before `browser.close()`.
- **Do not touch:** the drag steps' design of tapping then dragging from the tapped point (#396 assumption); `cardInsidePlot`'s 0.5 px tolerance and `:not([hidden])` selector (Reviewed and Dismissed).
- **Proof:** `pnpm test:browser` green after the change, 26 steps. In a scratch worktree, delete the `.cursor-plot .ts-chart-tooltip` rule in `apps/web/src/app.css` and `pnpm test:browser` still fails `state: chart cards inside the plot at 375px`; and change `case 'End': return { index: last }` in `apps/web/src/chart-slider.ts:39-40` to `{ index: last - 1 }` and the step fails on "did not reach the last point" (other steps that press End fail too; the check is that this one does).

### 3. Comment hygiene — LOW (aggregated)
Attribution: introduced by `69dddbc` (#397); the pen line copies a `$BASE` comment at `:844`.
- `apps/web/src/app.css:795-798` — "…so a tooltip no wider than the plot less 16px is always placed wholly inside it." (the launch plot also carries `cursor-plot`, and `.launch-chart .ts-chart-tooltip` at `:875-878` places its tooltip under the plot) → "…so a tooltip no wider than the plot less 16px always fits across it. The launch chart's tooltip sits under its plot (`.launch-chart .ts-chart-tooltip`), and is bounded to the same width."
- `apps/site/test/screenshot/browser-walk.ts:980` — "A pen onto a share of the way across the second plot, from just left of it." (it starts 20 px left of the point, still on the plot) → "A pen onto a share of the way across the second plot, from 20 pixels left of that point."

## Needs Further Investigation
None. Review 1's three open items are now settled by this branch: A (a finger drag clears the card) by #396, B (the relative card at 375px) by #397, and C (a retention cursor across a same-length change of x values) by #391's finding that every screen remounts the pair.

## Reviewed and Dismissed
- The drag steps could pass with no pointer event reaching the plot — they go red without the fix (`ref` removed: both "cleared the card"), and a probe logged a touch `pointercancel` at the plot in both, so the drag reaches the plot in today's Chrome.
- The pen step may send mouse events — the protocol defines `pointerType: pen` on `Input.dispatchMouseEvent` (`Input.pdl`), and the step needs the card to move from 15% to 85%, which a pen does through the library.
- A finger can no longer scrub the card along the plot — parity with `$BASE`'s hand-written charts, which ignored touch moves ("a touch points where it lands", #396 assumption); #396 asks for exactly this.
- The launch chart has no touch filter — its definition sets `pointer: false` (`launch-plot.ts:153`), so the library's move and cancel return early (`renderer.js:524`, `:540`); `state: launch chart touch drag` pins it and stays green with the `CursorPlot` filter removed.
- The ref callback's cleanup — React `^19.3.0` runs a ref callback's returned cleanup; `useCallback(…, [])` keeps it stable, and `slider.plotProps` (`ChartSlider.tsx:113-124`) carries no `ref` to override it.
- Stopping touch events at the plot starves another listener — no React `onPointerMove` or `onPointerCancel` sits under or above a `CursorPlot` plot (the one at `LaunchChart.tsx:275` is on the launch plot); `pointerdown` and `click` are not stopped, so the tap path and the library's `handleClick` run as before.
- `max-width: calc(100% - 16px) !important` against the wrong box — `100%` resolves against the library's container (the `position: relative` chart surface, the plot's width); a stylesheet `!important` beats the library's inline `maxWidth: "none"` (`tooltip.js:69-73`); the placement keeps 8 px from each edge (`tooltip-placement.js:8-12`); `box-sizing: border-box` (`packages/visual-system/src/styles.css:103-107`) keeps the card's padding inside its `max-width`.
- Removing `--ts-chart-tooltip-max-width` — read only by `tooltipCardStyle`, which a custom body replaces; it never applied.
- `cardInsidePlot` measures the wrong boxes — `this` is the `CursorPlot` plot that carries `plotProps`, the tooltip is appended inside it, the library hides it with the `hidden` attribute, and with the fix removed the card is 23 px wider than the plot, far past the 0.5 px tolerance.
- The retention tap geometry — the x domain is `[0, 1]` with no margin (`retention-plot.ts:38`) and the library picks the nearest point by x, so `retentionTapAt`'s nearest-by-x model holds; `first` and `second` are distinct for any count of 2 or more.
- The retention ratios fetch outside any `walk()` (`browser-walk.ts:1093-1099`) — a failure there aborts the run loudly in the outer `finally`; `launchList` has the same shape on `$BASE`.
- `sliderTextOf(null)` in the #391 test's expectation — it maps null to a constant, and the mutant shows the assertion separates `0:12` from "No point selected".

## Minor / nits
- `apps/web/src/CursorPlot.tsx:170`, `:173`: the `pointercancel` stop has no observable effect while the move is stopped. With only `pointermove` stopped, the walk stays green and the happy-dom probe keeps the card, because the library's cancel clears only a state its own move set. #396's criteria name the cancel, so keep it; nothing pins it.
- `apps/web/src/CursorPlot.tsx:115`: one line of the reflowed doc comment runs to 117 characters; the paragraph needs a reflow.
- `apps/web/src/launch-plot.test.ts:174-177`: `expect(top?.y1).not.toBe(bottom?.y1)` follows from the lines either side of it (from #392's issue text, kept as written).
- `apps/web/src/launch-plot.test.ts:32-41` copies `rulesOf` from `apps/web/src/retention-plot.test.ts:17-31`; a shared scene helper would serve both.
- `apps/web/src/launch-plot.ts:27` imports `yDomainOf` from `metric-plot.ts`, which pulls the metric charts' modules into the launch chart for a two-line helper; `plot-definition.ts`, which both already reach, is a neutral home. No import cycle.
- `apps/site/test/screenshot/browser-walk.ts:1059-1064`, `:1205`: `cardStaysAt` also checks the retention drag step's fresh tap, with no retry and a "moved the card off point N" message that reads backwards there.
- `apps/site/test/screenshot/browser-walk.ts:1120`: `retentionTapAt`'s error reads "on its -1 side"; "left" or "right" would read better.
- `apps/site/test/screenshot/browser-walk.ts:975-1002`: the pen step does not record the `pointerType` it received; a capture listener that sees `'pen'` would make it self-evident.
- `apps/site/test/screenshot/browser-walk.ts:1705-1708`: the 375px step places cards with the keys only, and its comment does not say so.
- The 375px failure message names the pair, not which slider failed.

## Test quality
Tests added: 4 unit tests (`cursor-plot.test.ts` 1, `launch-plot.test.ts` 2, `components.test.ts` 1) and 7 walk steps (`stacked charts pen`, `stacked charts touch drag`, `retention charts tap`, `retention charts touch drag`, `launch chart touch drag`, `chart cards inside the plot at 375px`, and the tap helper's use in the retention tap). At `582aeeb`: the zeros guide test is red; 3 are green, each an explicit pin of kept behaviour: the #391 point count pin (`08a7e45`, "pinned rather than removed", red when `cursor.setState(null)` or `quiet.current()` is deleted), the non-zero guides pin (`9fc46ff`, the only test red on a `+ 1` domain), and the zeros labels pin (`9fc46ff`, red on a top label of 1). Each walk step goes red for its rule when its fix is removed (What was verified), except `launch chart touch drag`, a pin of the launch chart's own path that the `CursorPlot` filter does not touch. Tautology shapes found: 0 self-fulfilling, 0 mocked units, 0 call-shaped assertions, 0 snapshots, 0 assertion-free tests. The gap is finding 1: the #396 fix is unpinned in `pnpm test`.

## Prior-review closure
This is a fresh review of the second PR's surface, not a delta from review 2, so no prior finding is under re-verification here. For the record: review 1's findings 2 (dead chart CSS), 3 (test hygiene) and 4 (comment hygiene), and review 2's finding 1 (comment hygiene in `chart-colours.test.ts`), stay deferred by Nick's decision of 2026-11-04 and their text is unchanged at HEAD, except that #397 removed one of review 1 finding 2's dead properties, `--ts-chart-tooltip-max-width`. Review 1's Needs Further Investigation A to C are settled by #396, #397 and #391.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and test all green at `0dac71b`; the browser walk green (it is not in CI).
- **Commit hygiene:** per-ticket implement commits and lane merges; nothing to drop. This review adds `docs/reviews/creator-analytics-359/pre-pr-review-3.md` and `repro/touch-stop-unpinned.sh`.
- **Likely reviewer asks:** the JS gzip size (245.68 kB at the first PR's review, 245.76 kB at HEAD by Vite's measure); a phone re-check of the finger scroll (#396) and the 375px card (#397), since both were found on a phone and the walk emulates touch; the upstream issue #373, still not filed (ready-for-human).

## Verdict
Ready to open the PR with follow-ups. Zero CRITICAL, HIGH or MEDIUM findings; three LOW. Nothing gates the PR. Finding 1 is the one worth taking first, since it puts the #396 fix under `pnpm test` with a tested diff; findings 2 and 3 are walk and comment cleanup that can ride in the same remediation or a follow-up.
