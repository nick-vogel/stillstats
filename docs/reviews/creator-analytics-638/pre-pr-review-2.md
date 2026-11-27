# Pre-PR review: creator-analytics#638 Audience cards packed by height (creator-analytics#711)

**Branch:** `creator-analytics-638-audience-mosaic` vs `origin/main` (merge-base `40288fb` "Merge pull request #710 from nick-vogel/creator-analytics-638-audience-mosaic")
**Reviewed at:** HEAD `bd488b5` ("creator-analytics#711 Audience columns: a short card can sit alone in a mostly blank column at desktop width", the no-ff merge of lane commit `814aba9` with the same subject). The tree was clean, with no uncommitted or untracked files at review time. 8 files, +584 / −136.
**Reviewed against:** epic creator-analytics#638, its open child creator-analytics#711 (its body is the rule and the acceptance criteria, and it supersedes #638's "CSS columns, card order kept, no layout script" by Nick's decision of 2026-11-12), the closed child #689, and `CODING_STANDARDS.md` standards 1 to 3. I read pre-PR review 1 (the #689 round) only for its Approach decisions and its finding headings.
**Date:** 2026-11-12
**Reviewer:** 2 code-review agents and a verify pass (`--fresh`, not delta-scoped)

## What was verified and how

| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | green, lockfile unchanged |
| Lint | `pnpm lint` | green, 679 files |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` | green |
| Full suite | `pnpm test` (Testcontainers Postgres), `TEST_DATABASE_ADMIN_URL` unset | green: 165 files, 4,152 passed, 1 expected fail |
| Touched test files | the finders ran `pnpm exec vitest run` on `apps/web/src/audience-columns.test.ts`, `apps/web/src/app.test.ts`, `apps/web/src/placeholder.test.ts` and `apps/web/test/web.test.ts` | green |
| Browser walk at HEAD, 5 runs | `pnpm test:browser` in a scratch worktree at `bd488b5` | **red in 3 of 5 runs**. Run 1 was under the full suite's load, run 2 was 60s later on an idle machine, and diagnostic run 2 was alone. All three failed the same step with the same numbers (Finding 1). Run 3, beside the base walk, and diagnostic run 1, alone, were green. 88 steps, no content security policy violation |
| Browser walk at base | `pnpm test:browser` in a scratch worktree at `40288fb` | green, 88 steps |
| Mechanism of the red (Finding 1) | `docs/reviews/creator-analytics-638/repro/placeholder-packed-diag.py` patched the scratch walk to log the busy grid's state at the moment it reads the places, over 2 runs | red run: the placeholder rendered **1 column on a 658.56px grid** (cards 658.56px wide) with the sidebar already `collapsed`, then landed in 2 columns of 321.28px. Green run: 2 columns of 321.28px at both reads |
| React-level harness | finder A bundled the real `AudienceColumns` with esbuild and ran it in happy-dom under `StrictMode`, with a fake ResizeObserver and card heights that depend on column width | it lands on the staging packing, a no-op resize writes nothing, it repacks for 592px and back, it disconnects every observer on unmount, a moved card remounts, and the first-mount chain settles inside layout effects |
| Count boundaries | finder A's node script on `audienceColumnCountOf` | 591→1, 592→2, and no floating-point off-by-one at the 2- and 3-column boundaries for rem 10 to 24 |
| Mutation of the hold's tests | finder A removed the card `observe`, the `observe()` in `recheck`, and the `disconnect()` in `observe`, one at a time | each mutant fails `recheck watches the cards read now...`, and none fails the test named for it (Test quality) |
| Tautology audit | read the new tests, plus the base oracle above | see Test quality |
| Real displays and classic scrollbars | not run on hardware | the walk's emulated widths stand in. Scrollbar bistability is reasoned only (Dismissed 5) |

**Overall:** the product does what #711 asks. The packing function, the count and the hold are right, the CSS gives each column the same width CSS columns did, and every CI check is green. The branch's own browser walk is not reliably green, though. One step reads the Audience placeholder before it has repacked for the width the collapsed sidebar gives it, and it fails 3 runs in 5 (Finding 1, MEDIUM). That breaks #711's last acceptance criterion and needs fixing in the walk before the PR opens. The rest is comment hygiene.

## Approach decisions

- Layout: script packing by height into one flex container per column (`apps/web/src/audience-columns.ts`, `AudienceColumns` in `apps/web/src/Audience.tsx`), as #711 decides. This overturns review 1's "CSS multi-column, no script", by Nick's decision of 2026-11-12. No finding below changes the packing rule or the render.
- A repack that a ResizeObserver notice causes after first paint goes through plain `setState`, not `flushSync`. A synchronous render inside the observer callback risks the browser's ResizeObserver loop error (`.epic-loop/tickets/711/assumptions.md`). Finding 1 keeps this, so its fix is in the walk, which waits for the placeholder to finish packing. The product is not changed.
- The layout's tests are the browser walk (happy-dom lays out nothing) and the pure unit tests in `apps/web/src/audience-columns.test.ts`. The walk checks the screen against the product's own `packAudienceCards` and `audienceColumnCountOf`, and the unit tests pin the rule with hand-written expectations. Both halves stay. No fix adds a stylesheet-value test.
- Waiting in the walk: poll a page expression with `delay(50)` up to a cap, as `placesHoldWhatLands` does for the held read (`apps/site/test/screenshot/browser-walk.ts:3106`).

## Confirmed Issues

### 1. The walk's note-places step reads the Audience placeholder before it repacks for the collapsed sidebar's width, so `pnpm test:browser` fails 3 runs in 5 — MEDIUM

- **Location:** `apps/site/test/screenshot/browser-walk.ts:3110-3115` (in `placesHoldWhatLands`). The same read-after-wait pattern appears at `:2841-2850`, `:2910-2915` and `:3395-3400`.
- **Attribution:** introduced. At base the placeholder is one `.audience-grid` with `columns: 18rem` (`git show 40288fb:apps/web/src/app.css | grep -n -A3 '^.audience-grid {'`), so the browser lays the columns out again in the same frame as any width change, and nothing runs late. In `814aba9` the columns are React state, written from a ResizeObserver callback through `setState`, so they lag a width change by at least a task. The base walk is green on this step.
- **Real-world trigger:** in the walk, `state: notes, the Audience headings and a video page's section headings, wrapped or not, land in their places at 320px to 2560px` runs at 768px with the sidebar collapsed. A fresh page opens the sidebar until the preferences read lands. The placeholder first renders beside the open sidebar on a 482.56px grid (1 column). The preferences then collapse the sidebar, the grid grows to 658.56px (2 columns), and the walk's `waitFor` returns as soon as `data-state` reads `collapsed`. That can land before the observer's repack has rendered.
  - For a creator, the user path is the same sequence: a saved collapsed sidebar, at a window where the collapse crosses a column-count boundary. The placeholder then shows one full-width column for at least a frame before it jumps to two. The decision above accepts that frame.
  - The rating comes from the gate: AC4 requires `pnpm test:browser` green. The walk runs nowhere but the full checks, and a step that fails 3 runs in 5 trains everyone to re-run past real reds. It stays at MEDIUM because no wrong number reaches a user.

**Evidence**

```ts
      await waitFor(
        `(${width < 768} || document.querySelector('[data-slot="sidebar"]')?.getAttribute('data-state') === '${state}') && (${screen.places}).flat().length > 0`,
        `${screen.path} at ${width}px, sidebar ${state}: no place shows beside the sidebar`,
        100,
      )
      const places = (await evaluate(screen.places)) as number[][]
```

```ts
  const resizes = new ResizeObserver(pack)
```

`pack` ends in `write(...)`, which is `setColumns` (`apps/web/src/audience-columns.ts:91`, `apps/web/src/Audience.tsx:61`).

**Failure mode:** three of five runs at `bd488b5` failed with the identical message:

```
/app/audience?format=short at 768px, sidebar collapsed: the places are not their texts' height: [{"at":0,"places":[18.89,64],"notes":[18.89,88]}, ... {"at":7,"places":[18.89],"notes":[37.78]}]
```

The diagnostic patch shows the cause. On the red run, at the moment of the places read, the state was `{"busy":"true","side":"collapsed","grid":658.5625,"cols":1,"cards":[658.56, ...]}`. At the notes read it was `{"busy":null,"side":"collapsed","grid":658.5625,"cols":2,"cards":[321.28, ...]}`. The places were measured at a card width of 658.56px and the notes landed at 321.28px, so every wrapped note is a line taller than its place. On the green run both reads show `"cols":2`. The other three sites run with the sidebar expanded, where the preferences read leaves the width alone, and they were green in every run. They share the same exposure if a later step saves a collapsed state first.

**Recommended fix:** in the walk, wait for the busy grid to render the column count its width gives before reading any Audience placeholder measurement. Generalise `audienceGridOf` to take its grid selector, add one waiting helper, and call it at the four sites. The product is not changed.

```diff
--- a/apps/site/test/screenshot/browser-walk.ts
-  const audienceGridOf = async () =>
+  const audienceGridOf = async (selector = '.audience-grid:not([aria-busy])') =>
     (await evaluate(
       `(() => {
-        const grid = document.querySelector('.audience-grid:not([aria-busy])')
+        const grid = document.querySelector(${JSON.stringify(selector)})
         return {
           width: grid.getBoundingClientRect().width,
           rem: parseFloat(getComputedStyle(document.documentElement).fontSize),
           columns: grid.querySelectorAll(':scope > .audience-column').length,
         }
       })()`,
     )) as { width: number; rem: number; columns: number }
+
+  const audiencePlaceholderPacked = async (what: string) => {
+    for (let attempt = 0; attempt < 100; attempt++) {
+      const grid = await audienceGridOf('.audience-grid[aria-busy="true"]')
+      if (grid.columns === audienceColumnCountOf(grid.width, grid.rem)) return
+      await delay(50)
+    }
+    throw new Error(`${what}: the Audience placeholder never packed into the columns that fit`)
+  }
@@ placeholder step, after the held-read loop (:2849)
       if (pausedAudienceRead === null) throw new Error('The Audience read was never held')
+      await audiencePlaceholderPacked('The first Audience placeholder')
       const places = (await evaluate(
@@ second-read step (:2914)
           )
+          await audiencePlaceholderPacked(`At ${metrics.width}px the second Audience placeholder`)
           const places = (await evaluate(`${busyAudienceCards}.map(${placeOf})`)) as Place[]
@@ placesHoldWhatLands (:3114)
       )
+      if (screen === audienceNotes)
+        await audiencePlaceholderPacked(`${screen.path} at ${width}px, sidebar ${state}`)
       const places = (await evaluate(screen.places)) as number[][]
@@ bar names step (:3399)
             )
+            if (screen.name === 'Audience') await audiencePlaceholderPacked(`At ${width}px`)
             const places = (await evaluate(screen.places)) as number[][]
```

Audit of the diff:

- **What it keeps:** it removes no line. `audienceGridOf()` with no argument reads the landed grid exactly as before, so `audienceCardFaults` (`:2749`) is unchanged. Every existing `waitFor` keeps its condition and its message.
- **When its own path fails:** if the placeholder never packs, which is a product regression in the observer path, the helper throws a named error after 5s and the step goes red. That turns the real-browser ResizeObserver repack, which no walk check held before, into a checked behaviour.
- **What it does not cover:** a count match is enough. Once the repack renders, the `[columns]` layout effect's `recheck` reads the heights at the new width and writes again before that task ends, so a matching count means the packing has settled. A height change after paint, such as a web font swap, is outside it, and `readyCheck` waits for `document.fonts` before the walk reaches these steps.
- **Scope:** `audienceNotes` is declared at `:3043`, `placesHoldWhatLands` at `:3097` and the helper at about `:2732`, all inside the same `try` block, so every name is in scope.

**Remediation brief**

- **Design intent:** the Audience placeholder and the landed screen render through one `AudienceColumns` component. It renders one column in DOM order, then packs in layout effects before first paint, from the grid's width and the cards' heights. After paint, a ResizeObserver notice (the grid's width or a card's height changed) repacks through plain `setState`, so the DOM keeps the old columns until React renders, a task later. The walk's places steps measure the placeholder while the DevTools Fetch domain holds the read, and compare those measurements with what lands. A measurement is only valid once the placeholder's packing matches its current width.
- **Full surface:**
  - `apps/site/test/screenshot/browser-walk.ts:2720-2731`: `audienceGridOf` takes a selector, and the new helper goes right after it.
  - Calls at `:2849/2850` (first-visit placeholder step), `:2914/2915` (second-read step), `:3114/3115` (`placesHoldWhatLands`, Audience only) and `:3399/3400` (bar names step, Audience only).
  - The video screens' places (`videoNotes` and the bar names step's `video` entry) are not packed, so they take no call.
- **Must preserve:**
  - `audienceCardFaults`' landed-grid read through `audienceGridOf()` with its default selector.
  - Every existing `waitFor` condition, including the sidebar-state guard at `:3111` and `:3396`.
  - The first-visit step compares widths only, and the second-read step compares left, top and height within 1px.
  - `pnpm test:browser` stays at 88 steps and stays green.
- **Do not touch:**
  - `AudienceColumns` and `holdAudienceColumnsOn`: no `flushSync` (Approach decisions; Dismissed 1).
  - The walk's use of the product's own functions as its oracle (Dismissed 3).
- **Proof:**
  - Red now: run `pnpm test:browser` in a scratch worktree at `bd488b5`. It fails the note-places step at 768px collapsed in about 3 runs of 5. The cause shows by running `docs/reviews/creator-analytics-638/repro/placeholder-packed-diag.py` per its header: on a red run, `DIAG places collapsed 768` prints `"cols":1` on a `658.5625` grid.
  - Green after: in a scratch worktree at the fix commit, `pnpm test:browser` passes three runs in a row, and with the diagnostic patch applied, `DIAG places collapsed 768` prints `"cols":2` on every run.
  - Then run `pnpm lint`.

### 2. Comment hygiene — LOW (aggregated)

- `apps/web/src/app.css:995-996`: "The count is the breakdowns' 18rem column rule above, as many 18rem columns as fit" → "The count is audience-columns.ts's, as many 18rem columns as fit, the same 18rem as the breakdowns' column rule above, held in both places". The count no longer comes from any CSS rule, and the 1rem `gap` here is a second copy of `audienceGapRem`.
- `apps/web/src/app.css:1002-1003`: "so a short card no longer sits alone in a mostly blank column (creator-analytics issue 711, at a 1512px window on staging)" → "so no short card sits alone in a mostly blank column, as the fixed order of CSS columns left one at a 1512px window on staging (creator-analytics issue 711)". This keeps the reason CSS columns were dropped, and drops the narration of the change.
- `apps/web/src/audience-columns.ts:12`: "the count CSS `columns: 18rem` gave before creator-analytics#711" → "the count CSS `columns: 18rem; column-gap: 1rem` gives".
- `apps/web/src/app.test.ts:5610-5613`: the comment "the cards stay in the one column in DOM order they render in before they are measured" and the title's "in one column before any layout packs them" → "happy-dom lays nothing out, so the grid reads 0px wide and the packing keeps one column in DOM order", with the title "...the eight cards in DOM order in one column when the grid has no width...". happy-dom has `ResizeObserver` and a 16px root font, so the layout effect does measure (zeros) and does pack.
- `apps/web/test/web.test.ts:1029-1030`: "from the packing's 18rem column count (audience-columns.ts, creator-analytics#711), which the browser walk holds" → "from the packing's 18rem column count, which audience-columns.test.ts holds, and the browser walk holds the screen to it (creator-analytics#711)".
- `apps/site/test/screenshot/browser-walk.ts:2787-2791`: add the step's limit after "(creator-analytics#711)": "The expected count and columns come from the product's own audienceColumnCountOf and packAudienceCards, so this step holds the screen to them, and audience-columns.test.ts holds the rule itself." (standard 2, a test states its own limits).

## Needs Further Investigation

None.

## Reviewed and Dismissed

1. **Make the repack synchronous (`flushSync`) instead of fixing the walk.** The plan rejected it on purpose: rendering inside the ResizeObserver callback changes the grid's height, which is an observed box, within the same delivery, and that raises the loop error the walk catches as a page error. The one-frame lag is the accepted cost.
2. **A ResizeObserver loop or an infinite repack.** `pack` writes only when the count or a height changed. A `recheck` after a remount re-observes, the observer's first notice reads the same heights, and nothing is written. finder A's harness showed a no-op resize causes 0 writes, and the walk saw no page error in 5 runs.
3. **The walk's rule check is self-fulfilling.** It packs from the landed cards' heights with the product's own function. Every column is equally wide (`flex: 1 1 0; min-width: 0`), so a card's height does not depend on which column it sits in, and the check is a real fixpoint test. It goes red on a product that never packs (0 or 1 `.audience-column` against a count of 2 or more), on one that packs in DOM order, and on one that packs from the one-column heights. The rule itself is pinned by hand-written expectations at `apps/web/src/audience-columns.test.ts:26-66`. Finding 2 adds the limit statement.
4. **A moved card remounts and loses its state.** True: React does not move a keyed child to a new parent. But no card holds state or a focusable control. A grep of `Countries.tsx`, `Cities.tsx`, `UsStates.tsx`, `Devices.tsx`, `ViewerShares.tsx` and `SubscriberSplitFigures.tsx` for `useState`, `<button`, `href=`, `tabIndex` or `onClick` finds nothing. See Minor for the constraint to state.
5. **The column count oscillates when a classic scrollbar appears or disappears at a boundary.** More columns make the page shorter, so a count that drops the scrollbar can only widen the grid toward the same or a higher count. That cannot cycle back. CSS multicol had the same bistability near a boundary.
6. **A NaN or zero rem drops every card or throws.** Real browsers and happy-dom return a px root font size (`"16px"` in happy-dom, checked), so the path is unreachable.
7. **Removing the cards' `margin-block-end: 1rem` takes 1rem off the bottom of the screen.** Review 1 measured 0px under the last card at base at every width from 1280px, because multicol drops the margin at an unforced column break. Nothing visible changes.
8. **Trailing empty columns.** Eight cards need a grid wider than 151rem (2416px at 16px) before a ninth column box appears. The walk's widest grid is 2432px (2560px, sidebar collapsed), which gives 8 columns with one card each. Even then, tallest-first packing puts the first cards in empty columns.
9. **The hold reads cards out of step with the DOM.** `cards()` maps through `placed.current`, which the `[columns]` layout effect updates in the same commit as the DOM. An observer callback cannot run between the two.
10. **SSR or hydration mismatch.** `apps/web` has no `hydrateRoot`, React is 19.3, and SSR renders the same one-column initial state that `placeholder.test.ts` reads.
11. **Every walk site that read busy-grid children as cards in section order was updated.** Lines 2842, 2851, 2911, 2915, 3047 and 3367 use `busyAudienceCards`. The other `aria-busy` reads are the sidebar, video and publish-day screens.

## Minor / nits

- `apps/web/src/Audience.tsx:43-49`: the `AudienceColumns` JSDoc could state the constraint Dismissed 4 depends on: a card that changes column remounts, so a card must hold no state or focusable control.
- `apps/web/src/Audience.tsx:209` (105 characters), `apps/site/test/screenshot/browser-walk.ts:2830` (109) and `:2878` (a ragged 62-character line): the rewrapped comments run past, or fall short of, the files' 100-column comment width. Biome does not flag comments.
- `apps/web/src/audience-columns.test.ts:24` and `:114` declare `staging` twice. The `[100, 100, 100]` assertion at `:37` repeats what `:45` proves.
- `apps/web/src/audience-columns.ts:7`: `audienceColumnRem` is exported but read only inside its module.
- The inner card keys (`key="countries"` and so on) in `Audience.tsx` are never used, because each card renders inside a `Fragment` keyed by its index.
- `apps/web/src/app.test.ts:3567-3573` reads the busy grid's sections in document order as section order. That holds only because happy-dom's 0px grid packs to one column. Find each card by its heading place, as the walk does, if this test ever runs with layout.
- `audienceGridOf` throws a bare TypeError when the landed grid is missing. That is still red, but the message does not name the width.
- The class and the step still say grid (`.audience-grid`, `state: audience grid columns`) for a flex row of column containers. This is review 1's Finding 2, still untouched.
- The walk does not check that DOM column N is the Nth from the left. Only a `row-reverse` would break that.

## Test quality

- **Tests added or changed:**
  - 13 new vitest tests in `apps/web/src/audience-columns.test.ts`.
  - 4 walk steps changed: the grid columns check, the first-visit placeholder, the second read, and the busy-card finders in the note-places and bar names steps.
  - 1 vitest test retitled (`app.test.ts:5613`), and the markup prefix of `placeholder.test.ts` updated.
- **Red at base:**
  - The new test file fails to import at base (no module).
  - HEAD's walk fails to import at base for the same reason. With the module copied in, the columns step would fail on 0 `.audience-column` against a count of 2 or more. That is reasoned from the selector, as Dismissed 3 argues, and was not executed.
- **Weak tests:** `packs again when a card's height changes` and `stops on release`. The fake observer's `resize()` (`audience-columns.test.ts:106-108`) notifies every connected observer whatever element changed, so the first test would pass if the hold never observed the cards. Mutation showed the suite still catches that, through `recheck watches the cards read now...`.
  - **To strengthen:** have `resize(target)` notify only observers that target it, call `resize(usStates)` in the height test, and assert in the release test that no observer still targets the grid.
- **Tautology shapes:** 0. No unit under test is mocked: the fakes are the browser's boxes and observer, which the file's Limits header states. No snapshot, and no call-only assertion. The walk's own-function oracle is Dismissed 3.

## Before opening the PR

- **CI readiness:** lint, typecheck, build and the full suite are green at `bd488b5`. `pnpm test:browser` is not reliably green (Finding 1), and it is in #711's acceptance criteria.
- **Commit hygiene:** the branch holds the lane commit `814aba9` and its no-ff merge `bd488b5`, plus this review doc and `repro/placeholder-packed-diag.py`.
- **Likely reviewer asks:**
  - A screenshot at 1512px with the staging-like heights.
  - Why the walk checks against the product's own function (Finding 2, Dismissed 3).
  - #638's spec body still describes CSS columns and a fixed order. A proposal to rewrite it is in `.epic-loop/tickets/711/proposals.md`.

## Prior-review closure

Pre-PR review 1 covered #689 and shipped in PR #710.

- **Its Finding 1** (the blank trailing column from 2560px) is closed by the redesign: at 2560px the packing fills all 7 columns, as the walk measured.
- **Its Finding 2** (the `audience-grid` name) is untouched (Minor).
- **Its Finding 3** (comment hygiene): two entries went with the CSS comments the branch deleted. The third entry, "this step holds the width, and the second read's step holds the left edge", is untouched at `browser-walk.ts:2829-2830`.

None of these was MEDIUM or higher.

## Verdict

**Not ready as-is.** Finding 1 (MEDIUM) gates the PR: #711's acceptance criteria require `pnpm test:browser` green, and the walk fails 3 runs in 5 on a step that measures the placeholder before it repacks. The fix is in the walk only, a wait for the placeholder's column count at four sites. Finding 2 (LOW, comment hygiene) and the Minor items can ship in the same remediation or as follow-ups.

## Remediation — 2026-11-12

| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 1 (MEDIUM) | `a140c91` creator-analytics#638 pre-PR review 2 finding 1: the walk read the Audience placeholder before it repacked for the collapsed sidebar's width | red→green: `pnpm test:browser` with `repro/placeholder-packed-diag.py` applied, in scratch worktrees. To make the timing red deterministic rather than 3 runs in 5, both the red and the first green run also delayed every ResizeObserver notice in `AudienceColumns` by 300ms (scratch-only mutant of `apps/web/src/Audience.tsx`). Red at `0a79729` plus the mutant: the note-places step failed at 768px, 1440px and 2560px collapsed, and `DIAG places collapsed 768` read `"cols":1` on the `658.5625` grid. Green at `a140c91` plus the mutant: 88 steps passed, `"cols":2`. Then green at `a140c91` without the mutant three runs in a row, `"cols":2` on each. `pnpm lint` and `pnpm typecheck` green, `pnpm test` green after (165 files, 4,152 passed, 1 expected fail) | 0 | proved by execution (MEDIUM, test-only diff, no shared core), no verify agent |
| 2 (LOW, comment hygiene) | — deferred | — | — | deferred by the default scope (CRITICAL, HIGH and MEDIUM only); carried to the end report |

No approach decision was new this round. Finding 1 followed the recorded ones: the fix is in the walk, the product's plain `setState` repack is unchanged, and the wait polls with `delay(50)` up to a cap, as the held-read waits do.

### Known regressions, deferred

None.

### Rework briefs

None. No verify pass ran, so no rework was needed.
