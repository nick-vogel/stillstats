# Pre-PR review: creator-analytics#359 Move the web app's charts to TanStack Charts

**Branch:** `creator-analytics-359-tanstack-charts` vs `origin/main` (merge-base `73f7952` "Merge pull request #388 from nick-vogel/creator-analytics-360-shadcn-tailwind-migration")
**Reviewed at:** HEAD `73a1c3f` ("creator-analytics#372 Charts: remove the hand-written hover and path geometry", the lane merge of `bf3d534`). The tree was clean, with no uncommitted or untracked files at review time. 39 files, +3,615 / −1,249 against the merge-base. The branch carries #368 (`bea4aca`, `9f57f5e`), #378 (`ef6087a`, `9ae9288`), #379 (`68e597e`, `87e96ea`), the main merge `65d78e8`, #369 (`7618c23`, `6719a68`, `3234d9f`, `744563d`, `abb13ae`), #370 (`8ef454d`, `1907438`), #371 (`142257b`, `a86c4c7`, `0d507c4`, `a7de263`, `fc84f44`) and #372 (`bf3d534`, `73a1c3f`).
**Reviewed against:** the epic body of creator-analytics#359 (End state, Implementation Decisions and Testing Decisions are the spec), the bodies of #368 to #372, #378 and #379, `CODING_STANDARDS.md` 1 to 3, ADR 0014's charts amendment, and the assumptions the loop recorded for each ticket. No prior review doc for this epic. A full review (`--fresh`).
**Date:** 2026-11-03
**Reviewer:** 3 code-review agents, 1 test-oracle agent, and a verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | up to date |
| Lint | `pnpm lint` | pass, 537 files |
| Typecheck | `pnpm typecheck` | pass |
| Build | `pnpm build` | pass |
| Full suite | `pnpm test` (Docker up, Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | 122 files, 2,744 passed, 1 expected fail, first run |
| Browser walk | `pnpm run --if-present test:browser` | pass: 20 steps, no content security policy violation. The walk prints JS 746.9 kB / 242.6 kB gzip, CSS 29.9 kB / 7.1 kB gzip |
| JS gzip before and after (#372's criterion) | `pnpm build` in a scratch worktree at `73f7952`, Vite's own gzip line for `apps/web` | `main` before #359: 621.55 kB / 202.92 kB gzip. HEAD: 746.94 kB / 245.68 kB gzip. +42.8 kB gzip, close to the #358 spike's 40 kB estimate |
| Dependency and patch | `apps/web/package.json`, `pnpm-workspace.yaml`, `patches/@tanstack__charts@1.2.1.patch`, the installed `svg-renderer.js` | `@tanstack/charts` pinned to exactly `1.2.1`; the patch is keyed to that version and applied (the installed renderer has no `style="display:block;overflow:visible"`); `.ts-chart` in `packages/visual-system/src/styles.css` carries both declarations |
| Other inline style writes in the library | grep of every file in `apps/web/node_modules/@tanstack/charts/dist` for `style="`, `"style"` and `setAttribute("style")` (agent) | only `canvas.js` (the canvas renderer, unused) and a read in `export.js`. Tooltip, host and surface write through CSSOM, which `style-src 'self'` allows. The app mounts with `createRoot` (`apps/web/src/main.tsx`), so no server markup with a `style` attribute ships |
| Tab stops and second names | `adapter-shared.js` (`resolveChartHostTabIndex`), `CursorPlot.tsx`, `LaunchChart.tsx` | `keyboard: false` gives the library svg a tab index of -1; the library chart sits in an `aria-hidden` wrapper, so its `role="img"` name and its tooltip's `role="status"` stay off the tree; a press focuses the slider (`onMouseDown`) |
| One cursor per group | `MetricCharts.tsx`, `AudienceRetention.tsx`, `LaunchChart.tsx` | each group creates its cursor in `useState` in the component that renders it; no module-level cursor |
| Keys, blur, live region, #343, preventDefault | `ChartSlider.tsx`, `chart-slider.ts`, the happy-dom tests in `apps/web/src/app.test.ts` (1421 to 1633), the walk's `stacked charts pointer after a key` step (`browser-walk.ts:803`) | keys, Escape, the blur rule, "only the plot whose key moved it speaks", exact announcement text and #343 on the stacked and launch charts all pinned; preventDefault pinned on all four plots (#378, #379) |
| Product events | `chart_metric_changed` and `views_chart_mode_changed` traced through `MetricCharts.tsx` and `ChartModes` | unchanged names and properties, none new |
| Series colour test can go red | 8 mutations in a scratch worktree at HEAD (agent); `sh docs/reviews/creator-analytics-359/repro/plant-colour-strays.sh <scratch-dir>` | literal colours, a misspelt token, a `var()` fallback and a crosshair literal all go red. A non-colour token (`var(--gutter)`, `var(--font-body)`) and a `none` stroke stay green: finding 1 |
| Recommended fix for finding 1 | applied in a scratch worktree at HEAD, `pnpm exec vitest run apps/web/src/chart-colours.test.ts`, `pnpm exec biome check` on the file, then the four plants | 10 tests pass, biome clean, every plant exits 1 |
| Tests green at `$BASE` | scratch worktree at `73f7952`, the branch's 8 changed test files copied in, run there (agent; `chart-slider.test.ts` and three others re-run with their import pointed at `chart-hover.ts`) | every changed test that is green at base is an unchanged body, an explicit pin of kept behaviour (#368, #378, #379, the pre-port pins in `components.test.ts`), or a refactor-preserved test. None is vacuous. Duplicates: finding 3 |
| Real touch, narrow screens, screen reader | not run | needs a phone and VoiceOver: Needs Further Investigation A and B |

**Overall:** The port holds. Every chart behaviour the epic lists is pinned either in happy-dom (the app's own keys, blur, value text and live region) or in the Chrome walk (the library's pointer, tap, shared cursor, group independence and zero policy violations), and all five full checks are green on the first run. No finding is above LOW: the one with teeth is that the series colour test admits any custom property the visual system declares, not only colour tokens. The rest is dead CSS the port left behind, duplicate tests, and stale comments. The PR can open now, with the four findings remediated first or carried as one follow-up.

## Approach decisions
- Library live region and second name: the library chart sits inside an `aria-hidden` wrapper in the app's slider (#369 assumption); recommended fixes keep the wrapper.
- Keys: the library's keyboard is off and the app's `useChartSlider` drives the cursor (#369); nothing here moves a key into the library.
- Series colour rule: one unit test walks each definition's rendered scene, not the marks' options, because 1.2.1 keeps options in a closure (#369 implement assumption). Finding 1 keeps that walk and narrows only which `var()` names it accepts, to the tokens the visual system's own dark-scheme test already treats as colour tokens (`packages/visual-system/test/styles.test.ts:40-50`, `declarationsIn` plus `lightTokensIn`).
- `ChartPoint` keeps only `day` (#372 assumption). Not reopened here; see Reviewed and Dismissed.
- Series colour rule's own proof (remediation, 2026-11-04): the stray rule is one module-level function, `straysAmong` in `apps/web/src/chart-colours.test.ts`, over a module-level colour token set computed once with top-level await, as `packages/visual-system/test/styles.test.ts` reads its sheet. The shipped definitions and a planted-stroke `test.each` both run through it, so the repro's plants (`var(--gutter)`, `var(--font-body)`, `none`) are a committed test that goes red if the rule widens again. A later rule change edits `straysAmong`, never a copy inside a test body.

## Remediation scope

Nick's decision at the end report close-out, 2026-11-04: fix finding 1 only, this round, by its remediation brief. Finding 1 is LOW, so this is the opt-in to that one LOW finding. Leave findings 2, 3 and 4 unfixed: they stay in the end report as the record.

## Confirmed Issues

### 1. The series colour test accepts any custom property the visual system declares, and `none` on any key, so a line drawn with a spacing or font token, or with no stroke, passes — LOW
- **Location:** `apps/web/src/chart-colours.test.ts:124` and `:134-140`
- **Attribution:** introduced, in `6719a68` (#369), which added the file; `git log --oneline 73f7952..HEAD -- apps/web/src/chart-colours.test.ts` shows it first there, and #370 to #372 only add definitions to its list.
- **Real-world trigger:** a later chart (#352's comparison ranges, #237's upload markers) gives a mark `stroke: 'var(--line-width)'`-style typo of a non-colour token, or `stroke: 'none'` while experimenting. No user path today, since every shipped stroke is a real colour token, so capped at LOW: upgrade to MEDIUM if any shipped definition uses a non-colour token, check via the repro after the fix lands (it runs the real definitions).

**Evidence**
```ts
const tokens = new Set(lightTokensIn(await visualSystemSheet()))
...
if (colour === 'none') return false
const token = /^var\((--[\w-]+)\)$/.exec(colour)?.[1]
return token === undefined || !tokens.has(token)
```
`lightTokensIn` returns every custom property of the light `:root`, which includes `--grain`, `--font-body`, `--font-display`, `--font-mono`, `--measure` and `--gutter`.

**Failure mode** — With the retention lines' stroke planted as `var(--gutter)`, `var(--font-body)` or `none`, `chart-colours.test.ts` passes; with `#ff0000` it fails. Executed: `sh docs/reviews/creator-analytics-359/repro/plant-colour-strays.sh <scratch-dir>` prints `control-hex: vitest exit 1`, `spacing-token: vitest exit 0`, `font-token: vitest exit 0`, `stroke-none: vitest exit 0` at `73a1c3f`. The browser would draw such a line with an invalid colour (falling back to no paint or the inherited colour), and the epic's criterion "a test fails when a series colour is not a `var()` of a token" exists to catch exactly that.

**Recommended fix**
```diff
-import { lightTokensIn, visualSystemSheet } from '@creator-analytics/visual-system/testing'
+import {
+  declarationsIn,
+  lightTokensIn,
+  visualSystemSheet,
+} from '@creator-analytics/visual-system/testing'
@@
-/** Every string a colour-valued key holds anywhere under `value`, functions aside. */
-function coloursUnder(value: unknown, seen = new Set<unknown>()): string[] {
+/** Every colour-valued key and the string it holds anywhere under `value`, functions aside. */
+function coloursUnder(
+  value: unknown,
+  seen = new Set<unknown>(),
+): { key: string; colour: string }[] {
   if (value === null || typeof value !== 'object' || seen.has(value)) return []
   seen.add(value)
   return Object.entries(value).flatMap(([key, held]) =>
-    colourKeys.has(key) && typeof held === 'string' ? [held] : coloursUnder(held, seen),
+    colourKeys.has(key) && typeof held === 'string'
+      ? [{ key, colour: held }]
+      : coloursUnder(held, seen),
   )
 }
@@
-      const tokens = new Set(lightTokensIn(await visualSystemSheet()))
+      const sheet = await visualSystemSheet()
+      const writesAColour = new Set(
+        declarationsIn(sheet)
+          .filter(({ colours }) => colours.length > 0)
+          .map(({ property }) => property),
+      )
+      const tokens = new Set(lightTokensIn(sheet).filter((token) => writesAColour.has(token)))
@@
-      const strays = colours.filter((colour) => {
-        if (colour === 'none') return false
+      const strays = colours.filter(({ key, colour }) => {
+        if (key === 'fill' && colour === 'none') return false
@@
-    expect(coloursUnder(scene.focusGuides)).toContain('var(--ink-soft)')
+    expect(coloursUnder(scene.focusGuides).map(({ colour }) => colour)).toContain('var(--ink-soft)')
```
The existing comment above the `none` line ("`none` is no colour: the library's own fill under a line.") stays and now matches the code exactly.

**Remediation brief**
- **Design intent:** ADR 0014's charts amendment makes every chart colour a `var()` of a visual system token, because the library sets no class per mark and the dark scheme reaches a chart only through those tokens. The test renders each shipped definition's scene with no DOM and walks every `stroke`, `fill` and `color` string under `nodes`, `points` and `focusGuides`. A colour token is a light-scheme custom property whose declared value is a colour, the same set the visual system's dark-scheme parity test uses, so a token that passes here is one the dark scheme also sets.
- **Full surface:** `apps/web/src/chart-colours.test.ts:6` (import), `:112-118` (`coloursUnder`), `:124` (the token set), `:134-140` (the stray filter), `:146` (the cursor guide test). `declarationsIn` is already exported from `packages/visual-system/test/testing.ts` (re-exported from `colour.ts:125`); no production file changes.
- **Must preserve:** every one of the 10 cases in `chart-colours.test.ts` stays green on the shipped definitions (verified with the diff applied: 10 passed); the library's own `fill: 'none'` under a line stays exempt; the test still fails on a literal colour and on a `var()` with a fallback (the anchored regex is unchanged); `include the line the cursor draws` still finds `var(--ink-soft)`. All shipped tokens (`--ink`, `--ink-soft`, `--line`, `--accent`, `--launch-line-1` to `--launch-line-10`) are colour-valued, so the narrower set rejects none of them.
- **Do not touch:** the walk's choice of `nodes`, `points` and `focusGuides` and of the three keys (Reviewed and Dismissed: a dump of every colour-like key across all 9 scenes found nothing else the app paints).
- **Proof:** `sh docs/reviews/creator-analytics-359/repro/plant-colour-strays.sh <scratch-dir>` from the repo root. Now: `control-hex` exits 1, the other three exit 0. After the fix is committed: all four exit 1. Then `pnpm exec vitest run apps/web/src/chart-colours.test.ts` green.

### 2. Dead chart CSS the port left behind: six tooltip custom properties on `.cursor-plot` and the two old line-stroke rules — LOW
- **Location:** `apps/web/src/app.css:783-793` (`.cursor-plot`) and `:902-910` (`.views-chart-engaged`, `.views-chart-views`)
- **Attribution:** introduced, both in `6719a68` (#369): `git log -S'--ts-chart-tooltip-max-width' 73f7952..HEAD` and `git log -S'views-chart-engaged' 73f7952..HEAD -- apps/web/src` both name it. At `73f7952` the two stroke classes were on the hand-drawn paths (`MetricCharts.tsx:126-127`); the port removed the paths and kept the rules.
- **Real-world trigger:** none for a creator; CODING_STANDARDS.md standard 3 (dead code on the path is removed on the path). The risk is a maintainer trusting the rules: tuning `--ts-chart-tooltip-max-width` to fix a card's width, or editing `.views-chart-views` to change the dash, and seeing nothing change.

**Evidence**
```css
/* A plot TanStack Charts draws: as tall as the hand-drawn plot, with its tooltip a bare surface,
   since the card inside it draws its own border and background. */
.cursor-plot {
  height: 10rem;
  --ts-chart-tooltip-background: transparent;
  ...
  --ts-chart-tooltip-max-width: 100%;
}
```
The library reads those properties only in `tooltipCardStyle` (`apps/web/node_modules/@tanstack/charts/dist/tooltip.js:302-311`). Once a custom body renders, which `renderTooltipBody` makes true on every paint (`tooltip.js:197-232`; both `CursorPlot.tsx:178` and `LaunchChart.tsx` pass `renderTooltipBody`), it assigns `customTooltipCardStyle` instead (`tooltip.js:69-74`), whose values are literals (`maxWidth: "none"`, `padding: "0"`, `border: "none"`, `background: "transparent"`, `boxShadow: "none"`, `font: "inherit"`, `tooltip.js:292-301`). `git grep -n "views-chart-engaged\|views-chart-views" -- apps packages` finds only the two CSS rules; the dash now lives in `metric-plot.ts` (`soft-dashed`).

**Failure mode** — None at runtime; the declarations never apply to a visible tooltip and no element carries the two classes. The `.cursor-plot` comment also says "as tall as the hand-drawn plot", which #372 deleted.

**Recommended fix**
```diff
-/* A plot TanStack Charts draws: as tall as the hand-drawn plot, with its tooltip a bare surface,
-   since the card inside it draws its own border and background. */
 .cursor-plot {
   height: 10rem;
-  --ts-chart-tooltip-background: transparent;
-  --ts-chart-tooltip-border: none;
-  --ts-chart-tooltip-padding: 0;
-  --ts-chart-tooltip-shadow: none;
-  --ts-chart-tooltip-font: inherit;
-  --ts-chart-tooltip-max-width: 100%;
 }
@@
-/* The two lines differ in dash as well as colour, so neither depends on colour alone. */
-.views-chart-engaged {
-  stroke: var(--accent);
-}
-
-.views-chart-views {
-  stroke: var(--ink-soft);
-  stroke-dasharray: 6 4;
-}
-
 .views-chart-legend {
```

**Remediation brief**
- **Design intent:** the library draws every line and the tooltip box; the app's CSS styles only the card markup inside the tooltip (`.chart-hover-card`), the plot's box (`.cursor-plot`, 10rem, which `CursorPlot.tsx:17` names as the height the library reads), and the launch card's placement under the plot (`.launch-chart .ts-chart-tooltip`). A line's colour and dash come from its definition (`metric-plot.ts`, `retention-plot.ts`, `launch-plot.ts`), never from a class.
- **Full surface:** `apps/web/src/app.css:783-793` and `:902-910`. No TSX or test references either; `git grep` for `ts-chart-tooltip-` in `apps/web/src` should return only the `.launch-chart .ts-chart-tooltip` selector afterwards.
- **Must preserve:** `.cursor-plot { height: 10rem }`; `.views-chart-legend` and the legend's `views-chart-key-*` rules (the legend still draws the dashed key); the dashed views line, pinned by `apps/web/src/metric-plot.test.ts:99`; the walk's card checks (`pnpm test:browser`), which see the tooltip in Chrome.
- **Do not touch:** `.launch-chart .ts-chart-tooltip { top: ... !important }` (live: the library sets `top` on the element and collides a tall card back over the lines); `.chart svg` (still sizes the library svg; see Minor); `.chart .launch-swatch` (depends on `.chart svg`).
- **Proof:** `git grep -n -- "--ts-chart-tooltip-\|views-chart-engaged\|views-chart-views" -- apps/web/src` returns nothing but the `.launch-chart .ts-chart-tooltip` line; `pnpm lint`, `pnpm build` and `pnpm test:browser` green.

### 3. Test hygiene: duplicate assertions, a dead fallback, a dead helper parameter, and a test file with no Limits header — LOW
- **Location:** `apps/web/src/retention.test.ts:50-53`; `apps/web/src/metric-charts.test.ts:46-50`; `apps/web/src/launch-plot.test.ts:91-103`; `apps/web/src/launch-plot.test.ts:246-250` and `:4`; `apps/web/src/launch-plot.test.ts:1`; `apps/web/src/components.test.ts:750-765`
- **Attribution:** introduced. `retention.test.ts` and `metric-charts.test.ts` lost their geometry tests in `8ef454d`, `6719a68` and `bf3d534`, leaving the duplicates; `launch-plot.test.ts` arrived in `142257b`, its pointer helper in `a86c4c7`; `components.test.ts`'s only callers passing a third argument (base lines 780 and 864, the launch accent markup tests) went in `142257b`.
- **Real-world trigger:** none for a creator; CODING_STANDARDS.md standard 2 ("one rule, one test"; "a test states its own limits") and standard 3 (dead code on the path).

**Evidence and fixes, one entry each**
- `retention.test.ts:52`: `expect(retentionChartsOf([point(0.01, 0.9), point(0.5, 1.25), point(1, 0.5)])?.top).toBe(1.25)` repeats `:37`'s `toEqual({ top: 1.25, fullLineY: 20, halfLineY: 60 })` on the same fixture. Delete line 52 and rename the test to `has its top at 1 with no point above 1`.
- `metric-charts.test.ts:46-50`: the `['many days', days]` row of `with %s, every chart reads one point per day` asserts the same days that `:62-69` (`daily, each chart reads its own number on its own scale`) pins with `points: [{ day: days[0] }, { day: days[1] }, { day: days[2] }]`. Delete the `many days` row; keep `one day` and `two days`.
- `launch-plot.test.ts:91-103` (`run from day 1 through each line's last processed day...`): `launchSeriesOf`'s `rows` are a field-for-field copy of `launchChartOf`'s `points`, so this restates `launch-chart.test.ts:68-76`, which holds the rule. Delete it, or cut it to the one rule the series adds, if any, that `launch-chart.test.ts` does not hold.
- `launch-plot.test.ts:246-250`: `resolveChartPointerFocus` returns `strategy.resolve(...)` for a strategy object (`apps/web/node_modules/@tanstack/charts/dist/interaction.js:19-28`), and the launch definition's `focus` is the strategy `launchPointerFocus` (`launch-plot.ts:147`), so `findNearestPoint` never runs. Replace the return with `return launchSelectionOf(chart, resolveChartPointerFocus(scene, definition.focus, x, y, maxDistance)?.[0])` and drop `findNearestPoint` from the `@tanstack/charts/scene` import on `:4`. Keep the test it serves (`reaches a partial line past its end only at its last point`, `:253`): it is the proof of `a86c4c7` (#371 review pass 1 finding 1).
- `launch-plot.test.ts:1`: every sibling chart test file opens with a Limits header (`launch-chart.test.ts`, `views-chart.test.ts`, `components.test.ts`, `chart-slider.test.ts`); this one does not. Add one stating that the pointer tests resolve against the scene's points as `selectedAt` reproduces the renderer's path, with no layout, and that the real pointer in Chrome is the browser walk's (`pnpm test:browser`, the launch chart's past-the-end step added in `a7de263`).
- `components.test.ts:750-765`: no call of `placeOf` passes `markedVideoId` (all 16 calls are two-argument), so the parameter and `markedBy: markedVideoId === null ? null : 'row'` are dead. Drop the parameter and pass `markedVideoId: null, markedBy: null`.

**Remediation brief**
- **Design intent:** pure modules keep one test per rule (`launch-chart.ts`'s lines and days in `launch-chart.test.ts`; the plot definitions' drawing in `*-plot.test.ts`; `retentionChartsOf`'s top and guide lines in `retention.test.ts`). A test file whose environment cannot see the real behaviour says so in a Limits header and names the human or browser step that does.
- **Full surface:** the six sites above; nothing in production changes.
- **Must preserve:** `retention.test.ts:34-38` (the raised top, both guide lines), `metric-charts.test.ts:62-69`, `launch-chart.test.ts:68-76`, `launch-plot.test.ts:253-258` (a review proof), every other `placeOf` caller in `components.test.ts`.
- **Do not touch:** the pre-port pins that are green at base on purpose: `app.test.ts:1421`, `:1443`, `:1454`, `:1584`, `:1633` (the #378 and #379 `preventDefault` pin), `components.test.ts:553` and `:674` (Reviewed and Dismissed).
- **Proof:** `pnpm exec vitest run apps/web/src/retention.test.ts apps/web/src/metric-charts.test.ts apps/web/src/launch-plot.test.ts apps/web/src/components.test.ts` green, with the test count down by the deleted tests and rows; `pnpm typecheck` and `pnpm lint` green (the dropped import must not leave an unused symbol).

### 4. Comment hygiene — LOW (aggregated)
- `apps/web/src/app.css:724` — "The SVG stretches to the chart's box; each stroke keeps its width as it stretches." (the `vector-effect` rules it described are gone, and the library draws in pixels) → "The scale labels sit in the gutter before the plot."
- `apps/web/src/app.css:745` — "The plot a chart's hover card sits over." (the card is in the library's tooltip now) → "The box the plot's scale labels and the library's tooltip are placed against."
- `apps/web/src/CursorPlot.tsx:83-84` — "The state is the app's, so the library's clear when the finger lifts leaves it, and the card stays until the next tap." (the library has no clear on a finger lift; it clears only on `pointercancel` and `mouseleave`, `renderer.js:695-696`, and its `click` after the tap publishes a pointer state at the same point, `renderer.js:569-617`) → "The library's click after the tap publishes the same point as the pointer's, and nothing clears it when the finger lifts, so the card stays until the next tap."
- `apps/web/src/chart-cursor.ts:15-16` — "The library's pointer clears only the state it wrote itself, so this one stays when a finger lifts." (unverified claim about the library; the load-bearing fact is the source) → "Its source is not the pointer's, so `fromPointer` never reads a key step or a tap as the pointer moving the card."
- `apps/web/src/launch-plot.ts:75` — "A tie goes to the line painted last, the accented one." (true only when the accented line is among the tied points) → "A tie goes to the point drawn later, so the accented line, drawn last, wins any tie it is in."
- `apps/web/src/launch-plot.ts:101-102` — "`launchSelectionOf`), and draws the line" / " * at the selected day and the tooltip..." (a reflow left a short line mid-sentence) → rejoin as "`launchSelectionOf`), and draws the line at the selected day and the tooltip that holds the card, under the plot, as ten rows are taller than it."
- `apps/web/src/chart-slider.ts:49-51` — "from the id of the hover the plot shows and the id of the hover of the plot focus moves to ... between plots that share a hover" (the hover is gone; the concept is the slider group) → "from the id of the plot's slider group and the id of the group of the plot focus moves to ... between plots of one group"
- `apps/web/src/metric-charts.ts:40`, `:47`, `:52` — "One number's line on its own scale", "The engaged views chart's two lines, on one scale", "The three charts' lines over the same drawn days" (the types hold scales, no lines) → "One number's scale: the number at its top edge.", "The engaged views chart's scale, which its two lines share: the number at its top edge.", "The three charts' scales over the same drawn days, which share one x axis."

## Needs Further Investigation

### A. A touch drag that starts on a stacked or retention plot may now clear the card — confirm on a phone
The base hover ignored touch moves. In 1.2.1, `handlePointerMove` has no pointer-type filter, and `pointercancel` runs `clearPointerFocus` (`renderer.js:693-695`). A finger that lands on a plot to scroll the page fires the app's touch `pointerdown` (which places the card at that point through `tap`), then library pointer moves, then `pointercancel` when the pan starts, which may clear the card. The walk taps with no drag. Confirm on an iPhone and an Android phone: tap a stacked chart, then scroll the page with a finger that starts on the chart. If the card vanishes and Nick wants it kept, the brief is to stop touch `pointermove` before the library sees it (a capture-phase listener on `.cursor-plot`), and add a walk step that dispatches a touch drag.

### B. Whether the relative retention card still wraps to the plot's width at 375px — confirm in the walk's narrow viewport
The `.chart-hover-card` comment (`app.css:750-751`) says a card wider than the plot wraps to its width. The library sets `max-width: none` on the tooltip whenever a custom body renders (finding 2), so the card's `max-width: 100%` is measured against a shrink-to-fit absolutely positioned box, not the plot. This is today's shipped behaviour either way (finding 2's fix changes nothing visible). Confirm with a 375px screenshot of the relative card at the last point; if it overflows, constrain `.cursor-plot .ts-chart-tooltip` in the stylesheet.

### C. A retention cursor survives a same-length change of x values — confirm whether the video detail screen remounts the pair between videos
`useChartCursor` clears the cursor only when the point count changes (`CursorPlot.tsx:61-67`). If the retention pair stays mounted from one video to another with the same number of points but different ratios, the cursor keeps an x that names no point: the value text reads "No point selected" while the crosshair may still draw. With YouTube's usual even grid the ratios match and the card simply stays on the same position, as the base's `hoverOn` did. Confirm by navigating between two videos' detail screens with a card shown; if it persists, key the layout effect on the x values rather than their count.

## Reviewed and Dismissed
- The #343 rule has no automated test on the stacked charts — it does: the walk's `stacked charts pointer after a key` step (`browser-walk.ts:803-832`, added in `744563d` as #369 review pass 1 finding 2's proof) asserts the live region empties when the pointer moves the card. The retention pair runs the same `CursorPlot` subscription.
- The walk's speaker checks pass on a stale announcement (`browser-walk.ts:767`, `:899`, `:1300`) — the walk checks which region speaks; what it says is pinned exactly in happy-dom (`app.test.ts:507-627`, `:1454-1471`, `:1554-1608`), where the app's own key handler needs no layout.
- The walk's group-independence check reads once with no settle (`browser-walk.ts:951`) — the cursor is read through `useSyncExternalStore`, so a cross-group write would show in the same render.
- A blur clears a list row's mark while the pointer is on the row (`LaunchChart.tsx:174-177`) — the same `select(null)` → `onMark(null)` path is at `73f7952` (`LaunchChart.tsx:175-178`); pre-existing and untouched.
- `launch-plot.test.ts`'s `selectedAt` reimplements the renderer's pointer path — kept as `a86c4c7`'s proof; the real path is the walk's past-the-end step (`a7de263`).
- `metric-plot.test.ts:68` supplies its own `yDomainOf(3, -1)` — it holds that the plot honours a domain below zero; the bottom's derivation is pinned in `metric-charts.test.ts:103-115`, and `MetricCharts.tsx:151` composes the two.
- `components.test.ts:567` and `:692` assert `valueText: 'No point selected'` — a behaviour test observing the no-point branch through its text, which CODING_STANDARDS.md standard 2 keeps.
- The colour test checks light tokens only — dark-scheme parity of every colour token is held by `packages/visual-system/test/styles.test.ts:40-50`, which the file's header names as "the colour tests that hold the tokens".
- The colour walk skips `scene.colors` and `scene.theme` — a dump of every colour-like key across all 9 scenes found nothing painted outside `stroke`, `fill` and `color` except the library's default `background: "transparent"`.
- A one-point retention curve draws no line — the base's `linePathOf` drew a bare `M` path too; Google sends about 100 points.
- `ChartPoint` is a one-field wrapper — kept by #372's recorded decision ("`ChartPoint` keeps only `day`"); reopening it is a separate refactor.
- The `JSON.stringify` cursor comparison in `LaunchChart.tsx` — executed: `createChartCursor().setState(s)` round-trips the app's shape byte for byte, and `null` too, so no redundant write or loop.
- NaN or Infinity in `launchPointerFocus` — `Math.max(0, Infinity) ** 2` admits every finite point; a NaN distance never passes `<=`, so it returns `[]` and `pointAt` returns early.
- A stale launch selection after a window change — unreachable: `ChannelSummaryFigures.tsx:108-110` shows the placeholder while the list's window differs, so `LaunchChart` unmounts.
- The inline `style={{ top }}` on the scale labels (`MetricCharts.tsx:178`, `AudienceRetention.tsx:63`) — present at `73f7952`, and React sets it through CSSOM, which the policy allows.

## Minor / nits
- `apps/web/src/app.css:730-735`: `.chart svg { display: block; width: 100%; height: 10rem; overflow: visible }` now hits only the library's svg and the launch card's swatch, which needs `.chart .launch-swatch` to undo it; `display` and `overflow` repeat `.ts-chart`. Deleting it with the swatch override is cleaner, but only with a browser check that the plot height holds.
- `apps/web/src/metric-charts.ts:47-50`: `EngagedViewsLines` is `MetricLine` without `bottom`; one type would do.
- `apps/web/src/metric-plot.ts:96`: `Math.max(1, rows.length - 1)` matters only for zero rows, which no caller passes (`viewsChartOf` returns null for no days).
- `apps/web/src/ChartSlider.tsx:79-82`: `hide()` calls `group.quiet()` after `move(null)`, which `CursorPlot`'s `show(null)` already did; harmless, since `emptied` is one object.
- `apps/web/src/CursorPlot.tsx:49-50`: `quiet.current = group.quiet` is written during render.
- `apps/web/src/AudienceRetention.tsx:62-69`: both retention definitions are built when `charts` is null and nothing renders.
- `apps/web/src/LaunchChart.tsx:237-246`: every `pointermove` calls `select` and `onMark` even when the nearest point is unchanged.
- `apps/site/test/screenshot/stub-api.ts:313-319`: the after-publish list ignores the API's rule that a partial video follows every complete one in a metric sort (`packages/api-types/src/videos.ts:161-162`); the walk sorts by `-publishedAt`, so nothing reads it today.
- `apps/site/test/screenshot/browser-walk.ts:1307-1311`: the launch walk drives up, down, Home, End and Escape but not left and right, nor a row hover; both are pinned in happy-dom and `launch-chart.test.ts`.
- `apps/web/src/app.test.ts` retention `spoken()` helpers: `?.textContent` lets a missing region read as `undefined`, which passes `not.toBe('')`; sibling `toEqual(['', ''])` assertions in the same tests catch a missing region.
- `apps/web/src/retention-plot.test.ts:86`: `expect(half?.style?.stroke).toBe(full?.style?.stroke)` would pass on two `undefined` strokes; the opacity comparison beside it would not.
- `apps/web/src/chart-cursor.test.ts:12`: `toMatchObject` leaves `source` to the `fromPointer` test; asserting `source: 'programmatic'` would be direct.
- `apps/web/src/retention.test.ts:7`, `metric-charts.test.ts:5-6`: Limits comment lines run past 100 characters; biome does not reflow comments.

## Test quality
Tests added or changed: 5 new files (`chart-colours`, `chart-cursor`, `launch-plot`, `metric-plot`, `retention-plot`) and 8 changed (`app`, `components`, `launch-chart`, `metric-charts`, `retention`, `views-chart`, `chart-slider`, `web`). At `73f7952`: app 150 pass / 12 fail, components 72 / 7, launch-chart 30 / 5, chart-slider 21 / 0, retention 22 / 2, views-chart 17 / 2, metric-charts 27 / 6, web 49 / 0. Every changed test green at base is an unchanged body, an explicit pin of kept behaviour (#368 `bea4aca`, #370 `8ef454d`, #378 `ef6087a`, #379, the pre-port pins in `components.test.ts`), or a refactor-preserved test; none is vacuous. Tautology shapes found: 0 self-fulfilling, 0 mocked units, 0 snapshots; 3 duplicates and 1 dead fallback (finding 3). `chart-colours.test.ts` went red on 7 of 7 literal and misspelt-token mutations, and stays green on non-colour tokens (finding 1). The new `launch-plot.test.ts:190` round trip went red when `group` was dropped from `launchCursorStateOf`, so it is not an identity.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and test all green at `73a1c3f`; the browser walk green (it is not in CI).
- **Commit hygiene:** the branch history is per ticket with review-pass commits; nothing to drop. This review adds `docs/reviews/creator-analytics-359/pre-pr-review-1.md` and `repro/plant-colour-strays.sh`.
- **Likely reviewer asks:** the JS gzip size (202.9 kB before #359, 245.7 kB at HEAD by Vite's measure, 242.6 kB by the walk's); the upstream issue (#373, not filed yet, ready-for-human), which the epic links to; a phone check of tap and scroll (Needs Further Investigation A).

## Verdict
Ready to open the PR with follow-ups. Zero CRITICAL, HIGH or MEDIUM findings; four LOW. None gates the PR. Finding 1 is the one worth fixing before it lands, because it is the guard the epic's colour criterion asks for and #352 and #237 will add definitions behind it. Findings 2 to 4 are a cleanup pass that can ride in the same remediation or a follow-up ticket. Needs Further Investigation A to C need a phone or a real navigation and do not block.

## Remediation — 2026-11-04
Scope per the Remediation scope note: finding 1 only (Nick's opt-in to that one LOW). Findings 2, 3 and 4 are left unfixed on purpose and stay in the end report as the record.

| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 1 (LOW) | `a3a7f25` creator-analytics#359 pre-PR review 1 finding 1: the series colour test accepts any custom property and none on any key | red→green: `sh docs/reviews/creator-analytics-359/repro/plant-colour-strays.sh <scratch-dir>` printed `control-hex` 1 and the other three 0 at `ac925c2`, and all four 1 at `a3a7f25`. The repro is now also a committed test, `count a line stroked with %s as a stray` in `apps/web/src/chart-colours.test.ts`: 3 failed against the old rule, 13 of 13 pass with the fix. `pnpm exec vitest run apps/web/src/chart-colours.test.ts packages/visual-system/test` 43 passed; `pnpm typecheck` and `pnpm lint` pass | 0 new. The gate prints 2 lines, both carried text: the `coloursUnder` doc comment reworded by the brief's own diff, and the `none` line moved unchanged with the filter, as the brief says it stays | proved by execution (LOW, test file only, no shared core), no verify agent |
| 2 (LOW) | — deferred | — | — | out of this round's scope (Remediation scope note) |
| 3 (LOW) | — deferred | — | — | out of this round's scope (Remediation scope note) |
| 4 (LOW, comment hygiene) | — deferred | — | — | out of this round's scope (Remediation scope note) |

### Known regressions, deferred
- None. No verify pass ran, and no rework.

### Rework briefs
- None.
