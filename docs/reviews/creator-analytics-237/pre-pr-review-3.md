# Pre-PR review: creator-analytics#237 Channel summary: upload markers

**Branch:** `creator-analytics-237-upload-markers` vs `origin/main` (merge-base `a954964c891bf73792d6f19484b14cc6469741be`, "Merge pull request #762 from nick-vogel/creator-analytics-237-upload-markers")
**Reviewed at:** HEAD `95de9319` ("creator-analytics#763 Upload markers: framed markers, a line on every plot, a second row, and hover cards", the merge of the #763 lane), clean tree, no uncommitted or untracked files at review time. Whole branch against the merge-base: 11 files, +684 / −96, from `08f00cfb` ("creator-analytics#763 Upload markers: framed markers, a line on every plot, a second row, and hover cards") and `59546280` ("creator-analytics#763 review pass 1 finding 1: a click on a tile's hover card after 500ms closes it instead of pinning it open").
**Delta under review:** since `0517c9ce` ("creator-analytics#237 pre-PR review 1 remediation closure table"), the HEAD that `pre-pr-review-2.md` reviewed. Between the two, `30ef2176` (review 2's doc) and `a954964c` (PR #762's merge into main) add no code, so the delta's code is exactly the 11-file merge-base surface above, and every file in it was reviewed in full.
**Reviewed against:** creator-analytics#763 (open; its four items and acceptance criteria), epic creator-analytics#237 (open; its body is the spec, sub-issues #281 and #283 closed), `pre-pr-review-2.md` (its carried findings, Needs Further Investigation and Approach decisions), `pre-pr-review-1.md` (the briefs review 2 carried), `CODING_STANDARDS.md` rules 1 to 3, `CONTEXT.md` "Upload marker".
**Date:** 2026-11-16
**Reviewer:** 2 code-review agents + 1 base-oracle agent + verify pass (delta-scoped)

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | up to date |
| Lint | `pnpm lint` (biome, 715 files) | green |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` | green (the existing chunk size warning only) |
| Tests | `pnpm test` (Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | 175 files, 4,581 passed, 1 expected fail |
| Browser walk | `pnpm run --if-present test:browser` | passed, no CSP violation in 109 steps |
| Base oracle | the HEAD versions of `app.test.ts`, `components.test.ts`, `upload-markers.test.ts` and `web.test.ts` run in a scratch worktree at `a954964c` | 24 added or modified tests: 21 red at base, 3 green at base (each kept, see Test quality); all 24 green at HEAD |
| Pin mutations (finder B) | each of the two `details.cancel()` branches in `TileMarker`'s `onOpenChange` removed in a scratch worktree | each turns the 600ms App test red; the 600ms test is not vacuous (Base UI 1.9.0's patient-click window is a `setTimeout` the fake timers advance) |
| New App tests stable | the three `creator-analytics#763` App tests, 5 runs | 5 of 5 green |
| Finding 1 proof | `sh docs/reviews/creator-analytics-237/repro/frame-ink.sh <scratch>` against `apps/web/dist` after `pnpm build`, headless Chrome | `single=oklch(0.93 0.018 292) tile=oklch(0.79 0.025 290) differ`, exit 1; with `.upload-marker { color: var(--ink-soft) }` appended to the built sheet, `same` |
| Finding 2 proof | `sh docs/reviews/creator-analytics-237/repro/second-card.sh <scratch>` | red: `expected [ …(4) ] to have a length of 2 but got 4` |
| Carried findings 3 to 6 | `git diff --quiet 0517c9ce HEAD -- apps/api apps/web/src/channel-summary.ts apps/site/test/screenshot/stub-api.ts`; the hunks of `upload-markers.ts` and `components.test.ts` since `0517c9ce` | API and summary files unchanged; `upload-markers.ts` gains one import line at the top and a block after `uploadMarkersOf`, so the tie code moved one line, to `:105-129`; `components.test.ts` gains a block at `:1452`, after the after-publish test at `:1049-1054` |
| Could not run | VoiceOver over both rows and a tile's card; a real touch device for a tap on a tile; a 60rem by 45rem viewport measurement | Needs Further Investigation A and B, Minor 5 |

**Overall:** The #763 delta does what its ticket asks, every full check and the browser walk are green, and its new tests mostly go red at base. One MEDIUM: a single upload's marker draws its new frame in the body's ink instead of the muted token a tile's frame uses, so the two kinds of marker look different and a single's hover does not darken its frame; this was proved against the built stylesheet in Chrome. One new LOW: two tile cards can show at once. Fix the MEDIUM before opening the PR; the LOWs can ride along or ship as follow-ups.

## Approach decisions
- Join ties: compare neighbour gaps in exact integer units (the sum of a group's first and last day index, which is twice its centre index), not in float places, so "the leftmost on a tie" and "exactly one width does not join" hold for every window. Precedent: the existing integer `index` on `MarkerPlace`, which every marker already carries.
- Visibility wiring proof: an App test over the fake API reading `api.requests` for the `/summary` path after the "Show unlisted and private" switch, as the video list's visibility test reads its list reads (`apps/web/src/app.test.ts:1608`). Landed in `03c09309`.
- The visibility predicate: one exported privacy predicate shared by the list and the summary, as `isOfFormat` already is (`apps/api/src/video-format.ts:24`).
- A marker's ink: the `.upload-marker` rule in app.css paints `color: var(--ink-soft)` itself, as `.metric-charts-axis` does (`apps/web/src/app.css:1536`), because the visual system's unlayered `a { color: inherit }` outranks any Tailwind utility on an `<a>`, so a token class cannot colour a single upload's marker. (Added by this review, finding 1.)
- One tile card at a time: a shared "open card" ref created in `MetricCharts` and handed to both marker rows, as the one chart cursor is created there for every plot (`apps/web/src/MetricCharts.tsx:284-285`); a hover open is cancelled while another tile's card is open. (Added by this review, finding 2.)
- The frame-ink regression check: the browser walk's upload marker step compares each `.upload-marker`'s computed `borderTopColor`, both rows, with the computed `color` of the section's `.metric-charts-axis`, skipping a marker under the pointer, since only a real cascade shows the defect (happy-dom evaluates none). Precedent: the same step's computed-box checks (`secondPlotHeight`). (Added by remediation, finding 1.)

## Prior-review closure
Review 2 had 5 confirmed findings, all LOW, and 2 Needs Further Investigation. No remediation ran after review 2, so it has no closure table; #763 was worked as a new ticket on the integration branch.
- **Fully fixed: 0** of the numbered findings. Two entries of review 2's finding 5 (Comment hygiene) are fixed by #763's rewrite: the `UploadMarkers` JSDoc that ran past 100 columns is rewrapped, and the `MarkerProps` line that only restated its props now carries the mirror row's role.
- **Partially fixed: 0.**
- **Untouched: 4** numbered findings plus the rest of finding 5, all LOW. Review 2's findings 1 to 4 are this doc's findings 3 to 6, re-located below; review 2's finding 5 entries that still hold join this doc's finding 7. None was escalated, and no "Known regressions, deferred" list exists.
- **Resolved only by a comment or doc edit: 0** of the numbered findings.
- **Needs Further Investigation:** review 2's A (the walk's "no tile shows here" claim at 375px) is closed: the walk's comment now claims only that the second marker in the last28 step is a single upload with its tooltip, and the walk's tooltip check on that marker passes at both widths, in both themes, at `95de9319`. Review 2's B (focus lost on a resize that joins or splits the focused marker) is carried as this doc's B.

## Confirmed Issues
### 1. A single upload's marker draws its frame in the body's ink, not the muted token a tile uses, and its hover does not darken it — MEDIUM
- **Location:** `apps/web/src/app.css:1558-1572` (the `.upload-marker` rule, `border: 1px solid currentColor`), with `apps/web/src/UploadMarkers.tsx:95` (the `<a>`'s `upload-marker text-muted-foreground`) and `packages/visual-system/src/styles.css:183-184` (`a { color: inherit; }`).
- **Attribution:** introduced in `08f00cfb`. At `a954964c` the single marker's `<a>` had `className="upload-marker"`, `border: 0` and no token class, so its own colour never painted anything; the shape's `<svg>` carried the token and still does. `08f00cfb` gave the `<a>` a `currentColor` frame and the token class, and the token class loses there.
- **Real-world trigger:** every channel summary with a window holding at least one single-upload day, in both rows, in the Light and the Dark theme. A creator sees the single markers' frames in the full body ink beside the tiles' muted frames, and hovering a single changes only its fill.
**Evidence** — app.css loads Tailwind's utilities in a layer and the visual system unlayered (`apps/web/src/app.css:5-8`); an unlayered rule outranks a layered one whatever its specificity:
```css
@layer theme, base, components, utilities;
@import "tailwindcss/utilities.css" layer(utilities) source(".");
@import "@creator-analytics/visual-system/styles.css";
```
```css
a {
  color: inherit;
```
```css
.upload-marker {
  ...
  border: 1px solid currentColor;
```
**Failure mode** — on the `<a>`, `a { color: inherit }` beats `.text-muted-foreground`, so `currentColor` is the section's inherited `--ink`; the tile is a `<button>`, which no unlayered colour rule matches, so its utility wins and its frame is `--ink-soft`. Executed against the built sheet in headless Chrome (`repro/frame-ink.sh`): `single=oklch(0.93 0.018 292) tile=oklch(0.79 0.025 290) differ`. The `.upload-marker:hover` rule sets `border-color: var(--ink)`, which is the single's resting frame colour already, so #763 item 1's "hover darkens the frame" does not hold for a single, and its "the same bordered rounded square as a tile" does not hold in colour. The row comment at `app.css:1540-1542` ("Every marker draws in the axis's ink through `text-muted-foreground`") is false for a single's frame. No test sees it: `components.test.ts:1459` asserts the class is present, and happy-dom evaluates no cascade.
**Recommended fix** —
```diff
 .upload-marker {
   position: absolute;
   top: 0;
   display: grid;
   place-items: center;
   width: 1.5rem;
   height: 1.5rem;
   padding: 0;
   border: 1px solid currentColor;
   border-radius: 0.25rem;
+  color: var(--ink-soft);
   background: none;
```
and correct the row comment at `app.css:1540-1542` to say the marker rule paints the axis's ink (`--ink-soft`) itself, since a utility cannot colour the `<a>`. Then add the regression check to the browser walk's #281/#763 marker step (`apps/site/test/screenshot/browser-walk.ts`, inside the `drawn` evaluation near `:5291`): every `.upload-marker` in the section, in both rows, has a computed `borderTopColor` equal to the computed `color` of `.metric-charts-axis`, failing with the step's `where` and the offending markers' `aria-label`s.
**Remediation brief**
- **Design intent:** shape is the cue, not colour: every marker, single or tile, in either row, is one framed square in the axis's muted ink, through a visual-system token and never an inline colour (the content security policy and the colour policy test forbid inline colour). Hover darkens the frame to the body ink (`--ink`) over the `--line` fill. app.css and the visual system's sheet stay unlayered on purpose (ADR 0014, `app.css:1-4`), so an element rule in the visual system beats any utility on that element; an app.css rule is the place a marker's colour can be set reliably.
- **Full surface:** `apps/web/src/app.css:1558-1572` (add the declaration); `apps/web/src/app.css:1540-1542` (the comment); `apps/site/test/screenshot/browser-walk.ts` near `:5291` (the new check) and its step comment at `:5228-5236`, plus the file header at `:86-93` if the check is named there. The token class on the `<a>` (`UploadMarkers.tsx:95`), the `<button>` (`:166`), the shape (`Shape`) and the day line (`:208`) stays.
- **Must preserve:** the tile's frame and count colour (already `--ink-soft`, unchanged by the fix); the shape's colour through its own token class; the `:hover` rule (`app.css:1574-1577`) and `:focus-visible` outline; the token class strings `components.test.ts:1451`, `:1459`, `:1462` and `:1508` assert (`pnpm exec vitest run apps/web/src/components.test.ts`); `apps/web/test/web.test.ts`'s marker-frame, box-width and colour policy tests (`pnpm exec vitest run apps/web/test/web.test.ts`); the browser walk's CSP check.
- **Do not touch:** the unlayered imports in `app.css:5-8` and the visual system's `a` rule (moving either into a layer re-ranks every rule in the app); see Reviewed and Dismissed, "the day line takes the token class".
- **Proof:** `pnpm build && sh docs/reviews/creator-analytics-237/repro/frame-ink.sh /tmp/frame-ink` prints `differ` and exits 1 now, `same` and exit 0 after. The new walk check fails at `95de9319` and passes after: `pnpm build && pnpm run test:browser`.

### 2. A hover on another tile opens a second card while a clicked one stays open — LOW
- **Location:** `apps/web/src/UploadMarkers.tsx:136-158` (`TileMarker`'s `opened` ref, `onOpenChange` and the `Popover` root), with `apps/web/src/MetricCharts.tsx:307-308` and `:316` (two `UploadMarkers` rows, each tile its own `Popover`).
- **Attribution:** introduced in `08f00cfb`. At `a954964c` a tile's card opened only on a click or Enter, so a second card needed a press, which is an outside press for the first and closes it; there was also one row. Hover opening (`openOnHover delay={0}`) and the second row arrived together in `08f00cfb`.
- **Real-world trigger:** on a wide screen, a creator clicks a tile under the axis to keep its card open, then moves the mouse up across the charts and rests on the same day's tile in the row under the first plot (or on any other tile): a second card opens beside the first. Both show until Escape or a press outside. Capped at LOW: a confusing display, no wrong data, and no work lost.
**Evidence** —
```tsx
    if (details.reason === 'trigger-hover' && opened.current === 'pinned') {
      details.cancel()
      return
    }
```
Only the tile's own hover close is cancelled; nothing stops another tile's hover open, and each tile is a separate `Popover` root.
**Failure mode** — executed in the App harness (`repro/second-card.sh`): a click on the tile under the axis shows its 2 card rows; a hover on the mirror row's tile for the same day then shows 4 rows, two cards. The ticket's "keeps it open until Escape or a click outside" holds for the first card; the second card is the defect.
**Recommended fix** — create one ref in `MetricCharts` beside the chart cursor and hand it to both `UploadMarkers` rows and on to each `TileMarker`:
```diff
   const group = useChartCursor(xs)
+  const openCard = useRef<object | null>(null)
```
```diff
-            <UploadMarkers uploads={uploads} days={days} route={route} navigate={navigate} mirror />
+            <UploadMarkers uploads={uploads} days={days} route={route} navigate={navigate} openCard={openCard} mirror />
```
```diff
-      {uploads && <UploadMarkers uploads={uploads} days={days} route={route} navigate={navigate} />}
+      {uploads && <UploadMarkers uploads={uploads} days={days} route={route} navigate={navigate} openCard={openCard} />}
```
and in `TileMarker`, with `const self = useRef({})` as the tile's identity:
```diff
   function onOpenChange(open: boolean, details: PopoverRootChangeEventDetails) {
     if (open) {
+      if (details.reason === 'trigger-hover' && openCard.current && openCard.current !== self.current) {
+        details.cancel()
+        return
+      }
+      openCard.current = self.current
       if (opened.current !== 'pinned') {
         opened.current = details.reason === 'trigger-hover' ? 'hover' : 'other'
       }
       return
     }
     if (details.reason === 'trigger-press' && opened.current === 'hover') {
       details.cancel()
       opened.current = 'pinned'
       return
     }
     if (details.reason === 'trigger-hover' && opened.current === 'pinned') {
       details.cancel()
       return
     }
     opened.current = null
+    if (openCard.current === self.current) openCard.current = null
   }
```
`openCard` is optional on `UploadMarkers` and `MarkerProps` only if another caller renders `UploadMarkers` without `MetricCharts`; `git grep '<UploadMarkers'` finds only the two in `MetricCharts.tsx`, so make it required.
**Remediation brief**
- **Design intent:** a tile's card opens on hover and closes when the mouse leaves; a click, a tap or Enter opens it and keeps it open until Escape or a press outside (#763 item 2). One card shows at a time across both rows: a hover does not open a card while another tile's card is open, and a press on another tile still works as before (the press is outside the first card, which closes, and opens the second). The pin logic (cancel the press close of a hover-opened card, then cancel hover closes while pinned) stays as it is; this adds a guard before it.
- **Full surface:** `apps/web/src/MetricCharts.tsx:284-285` (create the ref), `:307-308` and `:316` (pass it); `apps/web/src/UploadMarkers.tsx` `MarkerProps` (`:57-72`), `UploadMarkers`'s props (`:238-251`) and its `propsOf` (`:283-298`, both branches), and `TileMarker` (`:124-158`). Add the repro's case as a real test in the `"the channel summary's upload markers"` describe of `apps/web/src/app.test.ts`, named for the rule ("a hover on another tile while a card is open shows one card").
- **Must preserve:** the three `creator-analytics#763` App tests (`pnpm exec vitest run apps/web/src/app.test.ts -t 'creator-analytics#763'`), including the 600ms pin test, which finder B's mutations show depends on both existing `cancel()` branches; a card closing when the mouse leaves an unpinned tile; Escape and an outside press closing a card and clearing `opened`; the mirror tile's `finalFocus={false}` and `keepFocusOut`; a press on a second tile opening its card. If the close path is cancelled or never fires (an unmount while open, a resize that joins the tile away), `openCard` must not stay pointing at a dead tile and block every hover: clear it in a cleanup when the tile unmounts while it holds the ref, and say so in the new test or a second one.
- **Do not touch:** the pin logic's two `cancel()` branches (see Reviewed and Dismissed, "the pin cancels").
- **Proof:** `sh docs/reviews/creator-analytics-237/repro/second-card.sh /tmp/second-card` fails now (`got 4`) and passes after.

### 3. Of equally close markers, the right pair can join instead of the leftmost — LOW
Carried forward unchanged from `pre-pr-review-1.md` finding 2, through review 2's finding 1. The tie code in `apps/web/src/upload-markers.ts` is unchanged except for one import line added above it, so its location is now `:105-129`; the evidence, recommended diff, brief and proof (`docs/reviews/creator-analytics-237/repro/tie-leftmost.case.ts`) in review 1 hold. Attribution: introduced in `f6660234`.

### 4. Two of the API's upload rules have no test that can fail — LOW
Carried forward unchanged from `pre-pr-review-1.md` finding 3, through review 2's finding 2. `apps/api` is unchanged since `0517c9ce`, so its locations and brief there hold, and `sh docs/reviews/creator-analytics-237/repro/mutation-probes.sh <scratch dir> HEAD` still prints `F3a ... survived` and `F3b ... survived` as review 2 recorded. Attribution: introduced in `b0ed6a14`.

### 5. The after-publish markup test's own rule cannot go red — LOW
Carried forward unchanged from `pre-pr-review-1.md` finding 4, through review 2's finding 3 (`apps/web/src/components.test.ts:1049-1054`, unchanged; #763's additions start at `:1452`); its brief there (delete the test) holds. Attribution: introduced in `b0ed6a14`.

### 6. The summary types the visibility rule again beside the list's — LOW
Carried forward unchanged from `pre-pr-review-1.md` finding 5, through review 2's finding 4 (`apps/api/src/channel-summary.ts:110` beside `apps/api/src/video-list.ts:77-79`, both unchanged); its brief there holds. Attribution: introduced in `b0ed6a14`.

### 7. Comment hygiene — LOW (aggregated)
Carried from review 2's finding 5, still at the same lines (files unchanged since `0517c9ce`):
- `apps/site/test/screenshot/stub-api.ts:137-140` — "A video every 9 days and a Short every 6 meet every 18 days, so a window of 28 days or more holds a day of two uploads, which shows as a tile." → "Every sample upload publishes on a day of its own, so no day holds two uploads; a tile shows only where markers join by width."
- `CONTEXT.md:135` (Visibility) — "It applies to the full list only." → "It applies to the full list and to the channel summary's uploads." and the closing sentence → "The channel summary's uploads, which the upload markers show, follow it too, never a scheduled upload, while the summary's numbers stay the whole channel's whatever it says."
- `apps/api/src/routes/channel-summary.ts:29-31` — "so a query with a repeat or a bad value of two is refused for the first the checks read" → "so of two repeats, or of two bad values, the first the checks read is refused; any repeat is refused before any bad value"
- `apps/web/src/channel-summary.ts:105-108` — the JSDoc wraps raggedly at "...which the upload markers show. Or a" → rewrap the paragraph.
- `apps/api/src/video-list.ts:252` — "What a publish time order reads of a video: its id and its publish time." repeats the `Pick` → delete the line.

New from the #763 delta:
- `apps/web/src/UploadMarkers.tsx:231-233` — "and the focused marker shows its tooltip" → "and a focused single marker shows its tooltip (a tile shows none; Enter opens its card)".
- `apps/web/src/upload-marker-width.ts:2-3` — "the `.upload-marker` rule's in app.css (a tile's box fits inside it)" → "the `.upload-marker` rule's in app.css, a tile's included".
- `apps/web/src/app.css:2313-2318` — "A chart shown alone has no sibling, so it keeps 10rem. Any later chart, since the upload marker row under the first plot can sit between engaged views and watch hours. The svg is the library's, whose height="100%" the base `.chart svg` rule outranks; the" (a sentence fragment, and a line of 116 columns) → "A chart shown alone has no sibling, so it keeps 10rem. The rule takes any later chart (`~`), not only the next (`+`), since the upload marker row under the first plot sits between engaged views and watch hours." then the svg sentence, rewrapped at 100 columns.
- `apps/site/test/screenshot/browser-walk.ts:89-93` — the header's "(creator-analytics#763). In the lifetime window at 375px, light and dark," runs to 122 columns where #763's sentence was spliced in → rewrap the paragraph at 100 columns.

## Needs Further Investigation
### A. The stacked charts may no longer fit the 45rem height their query asks — measure the channel summary at a 60rem by 45rem viewport
`apps/web/src/app.css:2313-2315` says "each chart below it ... takes 6rem, so four stacked charts fit the 45rem the query asks" (`stackedChartsQuery`, `(min-width: 60rem) and (min-height: 45rem)`, `apps/web/src/stacked-charts.ts:7`). #763 adds a 1.5rem row and a 0.75rem grid gap under the first plot and grows the row under the axis by 0.25rem, about 2.5rem in all, and the comment was not re-checked. If four stacked charts now overflow a 45rem viewport, the comment is a stale load-bearing claim (standard 1) and the query or a height needs a decision. Confirm with the browser walk's stub at a 960 by 720 CSS-pixel viewport, a channel with four charts shown, reading whether the section's bottom sits inside `innerHeight`.

### B. Focus falls to the page when a resize joins or splits the focused marker — resize a window with a marker focused, in Chrome
Carried forward from review 2's B. `apps/web/src/UploadMarkers.tsx:304-306` keys a marker by its first day, and a resize that turns a single into a tile (or back) swaps the element type, so the focused element unmounts. #763's larger 1.5rem box makes joins happen at wider tracks, not less often. Confirm in Chrome by focusing a marker, narrowing the window until it joins, and reading `document.activeElement`.

## Reviewed and Dismissed
- The `.metric-chart ~ .metric-chart` selector widens the stacked heights to other screens — dismissed: `.metric-chart` is rendered at `MetricCharts.tsx:204` (one per plot), `LaunchChart.tsx:260` (one per section) and `Placeholder.tsx:126`, `:131`, `:202`; `~` matches what `+` did everywhere except the new mirror-row case it was changed for. The walk's `secondPlotHeight` check (6rem within 0.5px) covers that case.
- The mirror row joins differently from the row under the axis — dismissed: both rows use `.upload-markers` (3rem start padding) and `.upload-markers-track`, and run the same `useLayoutEffect` and `markerSpanOf`, so their tracks measure the same width; the walk compares their marker counts at 1280px.
- The day lines' `key={place}` can collide — dismissed: `uploadDayPlacesOf` dedupes the day indexes through a `Set`, and `placeOf` gives each index its own place.
- The day line paints over the series instead of under it — dismissed: it comes before the library's positioned host, exactly as the retention playhead does (`app.css:1330-1342`), whose ordering the walk covers (#647).
- The day line takes the token class, so finding 1 also hits it — dismissed: it is a `<span>`, and no unlayered visual-system rule sets a `span`'s colour, so its utility wins.
- `preventDefault` on the mirror markers' mousedown stops their click — dismissed: cancelling `mousedown` cancels focus, not the `click` that follows; Base UI's `useClick` listens for `click` (read in Base UI 1.9.0's source), and `followInPlace` runs on the `<a>`'s `onClick`. Untested, which the lane's own review records.
- The pin cancels in `onOpenChange` do nothing, since Base UI already keeps a card open on a click within 500ms — dismissed: finder B removed each `cancel()` in turn and the 600ms App test went red both times.
- The `upload-markers-mirror` class has no CSS rule — dismissed: it is the hook `components.test.ts:1519` and the browser walk find the mirror row by.
- Three of the 24 new or modified tests pass at base — dismissed as tautologies, kept: "with one chart shown, there is one marker row" is #763's acceptance criterion, a guard that goes red if the mirror row shows with one plot; "a screen that passes no uploads draws no day line" states `MetricCharts`' rule for the video detail; "a click on a hovered tile keeps its card open ..." states the click-keeps-open criterion, which base also met through a click-only card. None is the proof of an earlier finding (`git log -S` names only `08f00cfb`).
- "a chart shown alone plots at 10rem" passes with either combinator — dismissed: a pre-existing test (`044fffa0`, #418), untouched by the branch except through the shared selector constant, stating that no rule outside the stacked query shortens a chart.

## Minor / nits
1. `apps/web/src/upload-markers.test.ts:307` — the "joins at the 1.5rem box" case uses `markerSpanOf(120, 16)`, where two neighbours sit exactly one 1.25rem width apart, so it tells the new width from the old only through `joinedOf`'s strict `apart < gap`. A track of 132px (22px apart: joins at 24px, stays single at 20px) sits strictly between the two.
2. `apps/web/src/components.test.ts:1476-1503` — "one line per upload day" uses a fixture where per-day and per-marker lines give the same places (SSR has no span, so only a same-day tile forms). The per-day rule is held by `uploadDayPlacesOf`'s unit tests (`upload-markers.test.ts:341`) and by construction (`MetricCharts` never sees the measured markers). A `narrowTrack` App test asserting two lines per plot under a joined tile would hold the wiring.
3. `apps/web/src/components.test.ts:1517-1540` — with two plots, "a second row under the first plot" cannot tell `index === 0` from `index < plots.length - 1`. A third metric in the fixture would.
4. `apps/site/test/screenshot/browser-walk.ts` near `:5306-5315` — `within(line, plot)` accepts a zero-height line, and `unlined` asks only for at least one line per plot; requiring the plot's full height and a count equal to the window's upload days would make "shows the lines" visible.
5. `apps/web/src/app.css:1574-1577` — `.upload-marker:hover` has no `(hover: hover)` guard, so on a phone the tapped tile keeps its hover fill while its card shows. A tap on a single navigates away, and no rule in app.css guards a hover today; unmeasured on a real device.
6. `apps/web/src/app.test.ts:2711` — beyond the lane's note that it asserts several rules, finder B showed its pin and Escape halves are held by Base UI itself (green with either `cancel()` removed); its own rule is "a row in the card opens its video's page".
7. `apps/web/test/web.test.ts:1465-1475` — "a tile draws no second border" checks only the `border` shorthand; `paintedBy(own, /\.upload-marker-tile\b/)` would also catch an `outline` or `box-shadow` frame. The day line's "faint dashed" test accepts `solid|dashed|dotted` and no opacity, and the hover test's "darkens" lightens in the Dark theme.
8. Two markers just over one 1.5rem width apart stay single and their 1px frames touch, reading as one double-bordered box; before #763 the unframed shapes left a gap. A design call, not a defect.
9. The charts placeholder holds no place for either marker row, and the row under the first plot now moves every later plot when the summary lands. The #763 lane raised it as a proposal (it needs a decision: hold a row's place always, or accept the shift).
10. The #763 lane's own review left 19 LOW findings open (focus not entering a pinned card, Base UI focus guards in the aria-hidden row, a second click closing a pinned card, the `opened` ref's `'other'`, duplicated day-index lookups, the `mirror` flag's branching and name, `useUploadDayPlaces` as a thin wrapper, the CSS tests that restate the stylesheet, among others). Not re-derived here; the comment entries among them are in finding 7, and items 6 and 7 above extend two of them.

## Test quality
Tests added or modified: 24 (22 new or changed tests across `app.test.ts` (3), `components.test.ts` (7), `upload-markers.test.ts` (8) and `web.test.ts` (4, the box-width test among them, modified), plus two `web.test.ts` tests changed only through the shared `belowEngagedViews` selector). Red at `$BASE`: 21. Green at `$BASE`: 3, each kept with its rule (Reviewed and Dismissed). Tautology shapes: 0 (no mocked unit, no call-shaped assertion, no generated snapshot, no expectation computed with the production helper). Weaker than their names: Minor 1 to 4, 6 and 7. The finding 1 defect sits exactly where the suite cannot see: `components.test.ts:1459` asserts the token class is present, which is true and paints nothing; the browser walk is the only layer that evaluates the cascade, which is where finding 1's new check belongs.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and test green at `95de9319`; the browser walk green.
- **Commit hygiene:** the delta is the #763 lane's two commits and its merge; nothing to drop. This doc and its three repro files (`frame-ink.sh`, `second-card.sh`, `second-card.case.ts`) are the only additions.
- **Likely reviewer asks:** why the single markers look darker than the tiles (finding 1); whether two cards at once is intended (finding 2); the placeholder's layout shift on a wide screen (Minor 9); unchanged from review 1, the extra Data API and Analytics cost of a cold summary.

## Verdict
Not ready as-is; ready once finding 1 is fixed. Finding 1 (MEDIUM) is the gate: #763's framed marker draws in two inks, and its hover does not darken a single, a visible miss of the ticket's item 1, proved in Chrome against the built stylesheet. Finding 2 (LOW, new) and the carried findings 3 to 7 (all LOW) can ride in the same remediation pass or ship as follow-up tickets. Of review 2's findings, none was worked (none was in #763's scope), two comment entries were fixed by #763's rewrite, and its Needs Further Investigation A is closed by the passing walk. The delta raised one MEDIUM and one LOW in about 680 lines, and the rest of what the finders reported is test strength and polish, not behaviour.

## Remediation — 2026-11-16
Scope: CRITICAL, HIGH and MEDIUM, at the skill's default; the LOW tail (findings 2 to 7) is deferred to Nick, unworked.

| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 1 (MEDIUM) | `289022f1` creator-analytics#237 pre-PR review 3 finding 1: a single upload's marker draws its frame in the body's ink instead of the axis's muted ink | red→green: `pnpm build && sh docs/reviews/creator-analytics-237/repro/frame-ink.sh <scratch>` printed `single=oklch(0.93 0.018 292) tile=oklch(0.79 0.025 290) differ` (exit 1) at `fe6e372e`, `single=oklch(0.79 0.025 290) tile=oklch(0.79 0.025 290) same` (exit 0) after; the new walk check, applied alone in a scratch worktree at `fe6e372e`, failed "draw their frame in another ink than the axis's" in all four modes (light and dark, 1280px and 375px), and `pnpm run test:browser` passes after (no CSP violation in 109 steps) | 0 new; the gate's 6 printed lines rewrite the walk step's two existing comments the brief named, and the `app.css` row comment is corrected as the brief asked | proved by execution |
| 2 (LOW) | — deferred | — | — | LOW tail, not worked |
| 3 (LOW) | — deferred | — | — | LOW tail, not worked |
| 4 (LOW) | — deferred | — | — | LOW tail, not worked |
| 5 (LOW) | — deferred | — | — | LOW tail, not worked |
| 6 (LOW) | — deferred | — | — | LOW tail, not worked |
| 7 (LOW, comment hygiene) | — deferred | — | — | LOW tail, not worked |

Preserve suites after the fix: `pnpm exec vitest run apps/web/src/components.test.ts apps/web/test/web.test.ts` (269 passed); full checks `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` (175 files, 4,581 passed, 1 expected fail) and `pnpm run test:browser`, all green at `289022f1`. No fix qualified for a verify agent (one MEDIUM, its proof executed red then green, no shared computation core), so Phase 2 dispatched none and Phase 2.5 did not run.

### Known regressions, deferred
None.

### Rework briefs
None.
