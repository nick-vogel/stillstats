# Pre-PR review: creator-analytics#237 Channel summary: upload markers

**Branch:** `creator-analytics-237-upload-markers` vs `origin/main` (merge-base `a954964c891bf73792d6f19484b14cc6469741be`, "Merge pull request #762 from nick-vogel/creator-analytics-237-upload-markers")
**Reviewed at:** HEAD `ecc21416` ("creator-analytics#237 pre-PR review 3 remediation closure table"), clean tree, no uncommitted or untracked files at review time. Whole branch against the merge-base: 15 files, +1,023 / −97, of which 11 are code and tests (the #763 lane plus the review 3 fix) and 4 are review 3's doc and repro files.
**Delta under review:** since `95de9319` ("creator-analytics#763 Upload markers: framed markers, a line on every plot, a second row, and hover cards"), the HEAD that `pre-pr-review-3.md` reviewed. The delta is 6 files, +343 / −5: `fe6e372e` (review 3's doc and repros), `289022f1` ("creator-analytics#237 pre-PR review 3 finding 1: a single upload's marker draws its frame in the body's ink instead of the axis's muted ink"), and `ecc21416` (the closure table). Its code is exactly two files, `apps/web/src/app.css` (+4 / −1) and `apps/site/test/screenshot/browser-walk.ts` (+16 / −4), both reviewed in full with their surrounding rules and step.
**Reviewed against:** creator-analytics#763 (open, read over REST after the GraphQL limit) and its item 1 as `pre-pr-review-3.md` records it; epic creator-analytics#237 (open); `pre-pr-review-3.md` (finding 1's brief and intent, its closure table, its carried findings 2 to 7, Needs Further Investigation A and B, Approach decisions); `CODING_STANDARDS.md` rules 1 to 3.
**Date:** 2026-11-16
**Reviewer:** 1 code-review agent (with a mutation walk) + verify pass (delta-scoped)

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | already up to date |
| Lint | `pnpm lint` (biome, 716 files) | green |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` | green (the existing chunk size warning only) |
| Tests | `pnpm test` (Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | 175 files, 4,581 passed, 1 expected fail |
| Browser walk | `pnpm run --if-present test:browser` | passed, no CSP violation in 109 steps |
| Prior finding 1 proof | `pnpm build && sh docs/reviews/creator-analytics-237/repro/frame-ink.sh <scratch>` at HEAD | `single=oklch(0.79 0.025 290) tile=oklch(0.79 0.025 290) same`, exit 0 |
| Walk check can go red (finder) | scratch worktree at `ecc21416` with only `color: var(--ink-soft);` removed from `.upload-marker`, then `pnpm build && pnpm run test:browser`; then the line restored and the walk re-run | red, exit 1, in exactly the four upload-marker steps (light and dark, 1280px and 375px) with "draw their frame in another ink than the axis's", 16 markers named at 1280px (both rows) and 2 at 375px (the joined tiles there kept the utility's ink and passed, a positive control on the colour-string comparison); green once restored |
| Fast suites without the fix | `sh docs/reviews/creator-analytics-237/repro/fast-ink-pin.sh <scratch>` (the same one-line removal, then `vitest` over `apps/web/test/web.test.ts` and `apps/web/src/components.test.ts`) | 269 passed with the ink gone: finding 1 |
| Cascade and surface | read `packages/visual-system/src/styles.css:183-193` (`a`, `a:hover`), `apps/web/src/app.css:21` (`--color-muted-foreground: var(--ink-soft)`), `:1530-1537` (axis), `:1560-1585` (marker rules), every `tokenClass` use in `UploadMarkers.tsx` | the new unlayered `.upload-marker` rule beats `a { color: inherit }`; `a:hover` sets only the decoration colour; `.upload-marker:hover` (0,2,0) still darkens the frame to `--ink`; the shape, the day line (`<span>`) and the tile count all still resolve to `--ink-soft` in both themes |
| Carried findings 2 to 7 | `git diff --quiet 95de9319 HEAD -- apps/api apps/web/src/UploadMarkers.tsx apps/web/src/MetricCharts.tsx apps/web/src/upload-markers.ts apps/web/src/components.test.ts apps/web/src/channel-summary.ts apps/site/test/screenshot/stub-api.ts CONTEXT.md apps/web/src/upload-marker-width.ts` | all unchanged; only the `app.css` locations below `:1567` move by 3 lines |
| Test quality | the delta adds no unit test; its one new check is the walk's `offInk`, mutation-tested above | the check goes red without the fix; see finding 1 for what the fast lane misses |
| Could not run | `gh issue view` (GraphQL rate limit; the issue's title and state read over REST, its body as review 3 records it); VoiceOver, a real touch device, a 60rem by 45rem measurement | Needs Further Investigation A and B carried |

**Overall:** Review 3's MEDIUM is fixed and proved both ways: a single upload's marker now frames itself in the axis's ink in Chrome, and the new browser walk check goes red in all four modes without the fix. Every full check is green. The delta raises one LOW: only the local browser walk holds the fix, since the fast suites pass with it removed and one unit test's title still says the token class draws the frame. The branch is ready for a PR; the LOWs can ride along or ship as follow-ups.

## Approach decisions
- Join ties: compare neighbour gaps in exact integer units (the sum of a group's first and last day index, which is twice its centre index), not in float places, so "the leftmost on a tie" and "exactly one width does not join" hold for every window. Precedent: the existing integer `index` on `MarkerPlace`, which every marker already carries.
- Visibility wiring proof: an App test over the fake API reading `api.requests` for the `/summary` path after the "Show unlisted and private" switch, as the video list's visibility test reads its list reads (`apps/web/src/app.test.ts:1608`). Landed in `03c09309`.
- The visibility predicate: one exported privacy predicate shared by the list and the summary, as `isOfFormat` already is (`apps/api/src/video-format.ts:24`).
- A marker's ink: the `.upload-marker` rule in app.css paints `color: var(--ink-soft)` itself, as `.metric-charts-axis` does (`apps/web/src/app.css:1536`), because the visual system's unlayered `a { color: inherit }` outranks any Tailwind utility on an `<a>`, so a token class cannot colour a single upload's marker. Landed in `289022f1`.
- One tile card at a time: a shared "open card" ref created in `MetricCharts` and handed to both marker rows, as the one chart cursor is created there for every plot (`apps/web/src/MetricCharts.tsx:284-285`); a hover open is cancelled while another tile's card is open. (Review 3, finding 2; unworked.)
- The frame-ink regression check: the browser walk's upload marker step compares each `.upload-marker`'s computed `borderTopColor`, both rows, with the computed `color` of the section's `.metric-charts-axis`, skipping a marker under the pointer, since only a real cascade shows the defect (happy-dom evaluates none). Precedent: the same step's computed-box checks (`secondPlotHeight`). Landed in `289022f1`.
- The marker ink's fast pin: the sheet test that already pins `.upload-marker`'s `border` (`apps/web/test/web.test.ts:1477-1485`) also pins its `color` declaration through `valueIn`, the same helper and the same line of the same test, so the commit-stage CI goes red without the declaration. The browser walk stays the cascade proof. (Added by this review, finding 1.)

## Prior-review closure
Review 3 had 7 confirmed findings: 1 MEDIUM and 6 LOW. Its remediation scoped CRITICAL to MEDIUM and left the LOW tail unworked, with no row `escalated` and its "Known regressions, deferred" list empty.
- **Fully fixed: 1.** Finding 1 (MEDIUM): `289022f1` adds the ink to the `.upload-marker` rule, corrects the row comment, and adds the walk check. Verified against its intent, not only its diff: the single's and the tile's frames match in both themes (`frame-ink.sh` prints `same`), a single's hover now darkens from `--ink-soft` to `--ink`, and the walk check fails without the fix in all four modes. The half its brief did not ask for, a fast-lane pin, is this doc's finding 1.
- **Partially fixed: 0.**
- **Untouched: 6**, all LOW: review 3's findings 2 to 7, carried below as this doc's findings 2 to 7 (deferred LOW tail, not worked).
- **Resolved only by a comment or doc edit: 0.**
- **Needs Further Investigation:** A and B carried, unchanged.

## Confirmed Issues
### 1. Only the local browser walk holds the marker ink fix; the fast suites pass without it, and a unit test's title still credits the token class — LOW
- **Location:** `apps/web/test/web.test.ts:1477-1485` (the marker frame sheet test, which pins `border` and `border-radius` only); `apps/web/src/components.test.ts:1455-1464` (the test titled "a single upload's marker carries the token class itself, so its frame draws in the axis's ink as a tile's does").
- **Attribution:** the components test was introduced in `08f00cfb` (`git log -S"carries the token class itself" a954964c..HEAD` names only it). The gap is exposed by the fix: `289022f1` moved the ink into an app.css declaration that no fast test reads, and review 3's brief told it to keep the components test's class strings and to put the regression check in the browser walk only.
- **Real-world trigger:** a later edit to `.upload-marker` (a tidy-up, a move of the frame into a token class, a merge conflict) drops `color: var(--ink-soft);`. CI runs lint, typecheck, build and `pnpm test`, all green, and the walk runs only locally (`_ci-commit-stage` rule), so the defect review 3 proved comes back unless someone runs `pnpm run test:browser` before merging. Capped at LOW: no user path today, and the fix is in place; the cost is a regression guard that lives outside the commit stage, and a test name that tells a maintainer the wrong mechanism.
**Evidence** —
```ts
expect(valueIn(own, '.upload-marker', 'border')).toBe('1px solid currentColor')
expect(valueIn(own, '.upload-marker', 'border-radius')).toMatch(/^[\d.]+rem$/)
```
```ts
test("a single upload's marker carries the token class itself, so its frame draws in the axis's ink as a tile's does (creator-analytics#763)", () => {
```
**Failure mode** — executed: `sh docs/reviews/creator-analytics-237/repro/fast-ink-pin.sh <scratch>` deletes only the ink declaration in a scratch worktree at `ecc21416` and runs both files: 269 passed, and the script prints "the fast suites pass without the marker ink: finding holds" (exit 1). The components test passed while review 3's defect was live too: on the `<a>`, `a { color: inherit }` beats the class, so the class never drew the frame; after the fix the `.upload-marker` rule paints the ink on both elements and the class on them is inert. Its title states a mechanism that is false, which is the misreading that would lead a maintainer to delete the app.css declaration as redundant (standard 1, load-bearing comments; standard 2, tests that can go red).
**Recommended fix** —
```diff
       expect(valueIn(own, '.upload-marker', 'border')).toBe('1px solid currentColor')
+      expect(valueIn(own, '.upload-marker', 'color')).toBe('var(--ink-soft)')
       expect(valueIn(own, '.upload-marker', 'border-radius')).toMatch(/^[\d.]+rem$/)
```
in `apps/web/test/web.test.ts`, with the test title widened to name the ink: "every upload marker, a single one included, is framed by a rounded border in the axis's ink, which its own rule paints (creator-analytics#763)". And in `apps/web/src/components.test.ts`:
```diff
-  test("a single upload's marker carries the token class itself, so its frame draws in the axis's ink as a tile's does (creator-analytics#763)", () => {
+  test("a single upload's marker and a tile carry the same token class as the shapes and day lines (creator-analytics#763)", () => {
```
with its two assertions unchanged.
**Remediation brief**
- **Design intent:** every marker, single or tile, in either row, is one framed square in the axis's muted ink (`--ink-soft`), and the place that ink is set is the `.upload-marker` rule in app.css, because the visual system's unlayered `a { color: inherit }` outranks any utility on the single's `<a>` (ADR 0014 keeps both sheets unlayered). The commit stage must go red when that declaration goes; the browser walk remains the only layer that proves the cascade, and its check stays as it is.
- **Full surface:** `apps/web/test/web.test.ts:1477-1485` (one assertion and the title); `apps/web/src/components.test.ts:1455` (the title only). Nothing in `apps/web/src` changes.
- **Must preserve:** the existing `border` and `border-radius` assertions; the hover test at `apps/web/test/web.test.ts:1487-1495` (`border-color: var(--ink)`); the colour policy tests in `web.test.ts`, which already pass with the declaration; the components test's two class regexes (`components.test.ts:1458-1463`) and `:1531`'s marker count regex; the browser walk's `offInk` check (`apps/site/test/screenshot/browser-walk.ts:5308-5312`, `:5353-5357`). Run `pnpm exec vitest run apps/web/test/web.test.ts apps/web/src/components.test.ts`.
- **Do not touch:** the `tokenClass` on the marker elements (`UploadMarkers.tsx:95`, `:166`): inert for the frame now, but removing it changes markup two tests and the walk read, and is not needed for this finding; the unlayered imports in `app.css:5-8` and the visual system's `a` rule (Reviewed and Dismissed in review 3, finding 1's brief).
- **Proof:** `sh docs/reviews/creator-analytics-237/repro/fast-ink-pin.sh /tmp/fast-ink-pin` exits 1 ("finding holds") now and exits 0 ("a fast test fails without the marker ink: finding fixed") after, since the new `color` assertion goes red with the declaration removed.

### 2. A hover on another tile opens a second card while a clicked one stays open — LOW
Carried forward unchanged from `pre-pr-review-3.md` finding 2, unworked by review 3's remediation (LOW tail). `UploadMarkers.tsx` and `MetricCharts.tsx` are unchanged since `95de9319`, so its locations, recommended diff, brief and proof (`sh docs/reviews/creator-analytics-237/repro/second-card.sh <scratch>`, red with `got 4`) hold as written there. Attribution: introduced in `08f00cfb`.

### 3. Of equally close markers, the right pair can join instead of the leftmost — LOW
Carried forward unchanged from `pre-pr-review-1.md` finding 2, through review 2's finding 1 and review 3's finding 3. `apps/web/src/upload-markers.ts` is unchanged since `95de9319`, so the tie code stays at `:105-129`; the brief in review 1 and its proof (`docs/reviews/creator-analytics-237/repro/tie-leftmost.case.ts`) hold. Attribution: introduced in `f6660234`.

### 4. Two of the API's upload rules have no test that can fail — LOW
Carried forward unchanged from `pre-pr-review-1.md` finding 3, through review 3's finding 4. `apps/api` is unchanged since `95de9319`; `sh docs/reviews/creator-analytics-237/repro/mutation-probes.sh <scratch dir> HEAD` is the proof. Attribution: introduced in `b0ed6a14`.

### 5. The after-publish markup test's own rule cannot go red — LOW
Carried forward unchanged from `pre-pr-review-1.md` finding 4, through review 3's finding 5 (`apps/web/src/components.test.ts:1049-1054`, unchanged); its brief there (delete the test) holds. Attribution: introduced in `b0ed6a14`.

### 6. The summary types the visibility rule again beside the list's — LOW
Carried forward unchanged from `pre-pr-review-1.md` finding 5, through review 3's finding 6 (`apps/api/src/channel-summary.ts:110` beside `apps/api/src/video-list.ts:77-79`, both unchanged); its brief there holds. Attribution: introduced in `b0ed6a14`.

### 7. Comment hygiene — LOW (aggregated)
Carried from review 3's finding 7, every entry still at its line except the `app.css` one, which moved down 3 lines:
- `apps/site/test/screenshot/stub-api.ts:137-140` — "A video every 9 days and a Short every 6 meet every 18 days, so a window of 28 days or more holds a day of two uploads, which shows as a tile." → "Every sample upload publishes on a day of its own, so no day holds two uploads; a tile shows only where markers join by width."
- `CONTEXT.md:135` (Visibility) — "It applies to the full list only." → "It applies to the full list and to the channel summary's uploads." and the closing sentence → "The channel summary's uploads, which the upload markers show, follow it too, never a scheduled upload, while the summary's numbers stay the whole channel's whatever it says."
- `apps/api/src/routes/channel-summary.ts:29-31` — "so a query with a repeat or a bad value of two is refused for the first the checks read" → "so of two repeats, or of two bad values, the first the checks read is refused; any repeat is refused before any bad value"
- `apps/web/src/channel-summary.ts:105-108` — the JSDoc wraps raggedly at "...which the upload markers show. Or a" → rewrap the paragraph.
- `apps/api/src/video-list.ts:252` — "What a publish time order reads of a video: its id and its publish time." repeats the `Pick` → delete the line.
- `apps/web/src/UploadMarkers.tsx:231-233` — "and the focused marker shows its tooltip" → "and a focused single marker shows its tooltip (a tile shows none; Enter opens its card)".
- `apps/web/src/upload-marker-width.ts:2-3` — "the `.upload-marker` rule's in app.css (a tile's box fits inside it)" → "the `.upload-marker` rule's in app.css, a tile's included".
- `apps/web/src/app.css:2316-2321` — "A chart shown alone has no sibling, so it keeps 10rem. Any later chart, since the upload marker row under the first plot can sit between engaged views and watch hours. The svg is the library's, whose height="100%" the base `.chart svg` rule outranks; the" (a sentence fragment, and a line of 116 columns) → "A chart shown alone has no sibling, so it keeps 10rem. The rule takes any later chart (`~`), not only the next (`+`), since the upload marker row under the first plot sits between engaged views and watch hours." then the svg sentence, rewrapped at 100 columns.
- `apps/site/test/screenshot/browser-walk.ts:89-93` — the header's "(creator-analytics#763). In the lifetime window at 375px, light and dark," runs to 122 columns where #763's sentence was spliced in → rewrap the paragraph at 100 columns.

New from this delta:
- `apps/web/src/UploadMarkers.tsx:26-27` — "Every shape draws in the one token class, the axis's own ink, through `currentColor`, so no marker carries a colour of its own" → "Every shape and day line draws in the one token class, the axis's own ink, through `currentColor`; a marker's frame takes the same ink from the `.upload-marker` rule in app.css. No marker carries a colour of its own".

## Needs Further Investigation
### A. The stacked charts may no longer fit the 45rem height their query asks — measure the channel summary at a 60rem by 45rem viewport
Carried from review 3's A, now at `apps/web/src/app.css:2316-2318`. Confirm with the browser walk's stub at a 960 by 720 CSS-pixel viewport, a channel with four charts shown, reading whether the section's bottom sits inside `innerHeight`.

### B. Focus falls to the page when a resize joins or splits the focused marker — resize a window with a marker focused, in Chrome
Carried from review 3's B (`apps/web/src/UploadMarkers.tsx:304-306`, unchanged). Confirm in Chrome by focusing a marker, narrowing the window until it joins, and reading `document.activeElement`.

## Reviewed and Dismissed
- The new `.upload-marker` colour changes the shape, the tile count or the day line — dismissed: the shape `<svg>` keeps its own `text-muted-foreground`, which no unlayered rule outranks there; the tile count inherits the button's colour, which was and is `--ink-soft`; the day line is a `<span>` outside the marker; all resolve to `--ink-soft` in both themes (`packages/visual-system/src/styles.css:57`, `:94`, `:119`).
- `a:hover` in the visual system re-colours a hovered single — dismissed: it sets only `text-decoration-color`; `.upload-marker:hover` sets `border-color: var(--ink)` explicitly.
- The walk's `offInk` can pass on a colour-string format mismatch — dismissed: both sides are computed styles from the same token (`oklch(...)` strings); the finder's mutation run showed the comparison failing on singles and passing on the 375px tiles in the same evaluation.
- A missing `.metric-charts-axis` lets the check pass silently — dismissed: `getComputedStyle(null)` throws in the page, and `on()` turns the exception into a thrown Error (`browser-walk.ts:508`), so the step goes red.
- The long `.filter(...)` line breaks lint — dismissed: it sits inside a template string, and `pnpm lint` is green over 716 files.

## Minor / nits
1. `apps/site/test/screenshot/browser-walk.ts:5308-5312` — `offInk` selects `.upload-marker`, while the step's marker count reads `a, button`; were the class renamed, the check would match nothing and pass at 375px (at 1280px the mirror count compares the same class and would catch it). Returning the `.upload-marker` count and requiring it to equal `placed.count` (one row) or twice it (stacked) closes that.
2. `apps/site/test/screenshot/browser-walk.ts:5425-5470` — the lifetime step, where tiles are asserted, does not run the ink check; tile coverage in the 28-day step rests on the sample joining markers at 375px, which it does today (the mutation run named only 2 of 8 there) but nothing asserts.
3. `apps/site/test/screenshot/browser-walk.ts:5353-5357` — at 1280px each off-ink marker is named twice, once per row, with no row named; prefixing `mirror:` for a marker inside `.upload-markers-mirror` would read better.
4. `apps/site/test/screenshot/browser-walk.ts:5311` — the `:hover` skip never applies in this step, since the walk sends no mouse events before the evaluation; harmless, and right if a later step moves the pointer first.
5. Review 3's Minor 1 to 10 hold unchanged; Minor 5's `.upload-marker:hover` rule is now at `apps/web/src/app.css:1577-1580`.

## Test quality
The delta adds no unit test. Its one new check, the browser walk's `offInk`, was mutation-tested: red in all four upload-marker steps without the fix, green with it, and its colour comparison passed on the tiles in the same red run, so it is neither vacuous nor brittle. Tautology shapes: 0 new. The components test at `:1455` is weaker than its name (finding 1): it asserts a class that paints no frame. Review 3's base-oracle results for the #763 tests stand, since none of those test files changed.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and test green at `ecc21416`; the browser walk green.
- **Commit hygiene:** the delta is review 3's doc, its fix and its closure table; nothing to drop. This doc and `repro/fast-ink-pin.sh` are the only additions.
- **Likely reviewer asks:** why the ink fix has no unit test (finding 1); whether two cards at once is intended (finding 2); the placeholder's layout shift on a wide screen (review 3 Minor 9); unchanged from review 1, the extra Data API and Analytics cost of a cold summary.

## Verdict
Ready to open a PR, with follow-ups. Review 3's gate, finding 1 (MEDIUM), is fully fixed and proved in Chrome and by a walk check that goes red without it; no MEDIUM-or-higher finding remains open. This round's one new finding is LOW and is about test strength, not behaviour: the fix is guarded only by the local browser walk. Findings 2 to 7 are review 3's deferred LOW tail, untouched. The confirmed count has shrunk from one MEDIUM to none, and what remains is test strength, a confusing double card, and comment polish; they can ride in one remediation pass or ship as follow-up tickets.
