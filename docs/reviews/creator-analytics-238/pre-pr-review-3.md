# Pre-PR review: creator-analytics#238 More own-channel metrics (ratio, newest average, RPM by day and by video)

**Branch:** `creator-analytics-238-own-channel-metrics` vs `origin/creator-analytics-236-video-list-paging-daily-table` (merge-base `41b2008` "creator-analytics#236 merge origin/main (#360 shadcn and Tailwind, #359 TanStack Charts)")
**Reviewed at:** HEAD `1c4424f` ("creator-analytics#238 pre-PR review 2 remediation closure table"). The tree was clean, with no uncommitted or untracked files at review time. 34 files, +2126 / −177 against the merge-base, the review folder included.
**Delta under review:** since `f7f76e8` ("creator-analytics#238 pre-PR review 1 remediation closure table"), the HEAD `pre-pr-review-2.md` reviewed: 3 commits (`ea9a6cc` the review doc, `e34441a` finding 1's fix, `1c4424f` the closure table), 4 files, +80 / −13, of which 3 are code: `apps/web/src/app.css`, `apps/site/test/screenshot/browser-walk.ts`, `apps/web/test/web.test.ts`.
**Reviewed against:** `pre-pr-review-2.md` (its finding 1 brief, the intent the delta had to meet, its Approach decisions and its Remediation closure table, including the verifier's two LOW coverage gaps), `pre-pr-review-1.md` findings 2 to 4 (still open at LOW), `CODING_STANDARDS.md` 1 to 3, the epic creator-analytics#238 as distilled in review 1 (the cards row and its placeholder must be the same height, creator-analytics#119 W24). The repo has no `CLAUDE.md`.
**Date:** 2026-11-04
**Reviewer:** 1 code-review agent + verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | up to date |
| Lint | `pnpm lint` | green (541 files) |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` | green |
| Full suite | `pnpm test` (Testcontainers Postgres, Docker up, `TEST_DATABASE_ADMIN_URL` unset) | 125/125 files, 2850 passed, 1 expected fail |
| Browser walk | `pnpm run --if-present test:browser` | passed, 29 steps, no content security policy violation; `state: wrapped cards row as tall as its placeholders` green |
| Walk step against `f7f76e8` code (tautology oracle) | Scratch worktree at `f7f76e8` under the scratchpad, HEAD's `browser-walk.ts` copied in, `pnpm build && pnpm test:browser` | Red, as it must be: `/app/` at 560px row 319.2px against placeholders 365.2px, `/app/?format=live` 294.2px; at 380px 438.7px and 413.7px against 555.8px. Green at HEAD. Review 2 finding 1 is closed by execution |
| Changed stylesheet assertions against `f7f76e8` | Same scratch worktree, HEAD's `web.test.ts` copied in, `pnpm exec vitest run apps/web/test/web.test.ts` | Red: 1 failed, 48 passed; the card number place test fails at `:521`, `--card-place` undefined at `f7f76e8` |
| Review 2's repro at HEAD | `pnpm build && sh docs/reviews/creator-analytics-238/repro/card-row-wrapped-widths.sh` | exit 0: 174.6px, 365.2px and 555.8px rows match their placeholders at 1100px, 515px and 340px content |
| The new place sums to the old placeholder height | Read of the `calc` terms, old `.placeholder-card` against new `--card-head-place + --card-number-place + --card-details-place` | Term for term identical, 60.4 + 43.2 + 71 = 174.6px at 16px |
| `min-height` counts padding and border | Read of `packages/visual-system/src/styles.css:103-106` | `*, *::before, *::after { box-sizing: border-box }`, so the place includes the 1rem padding and the 1px border, as the `calc` assumes |
| Where `--card-place` is defined | `git grep` for `className="cards"`, `placeholder-card`, `<Cards` over `apps/web/src` | `.card` renders only in `Cards.tsx:24`'s `<dl class="cards">` (used at `ChannelSummaryFigures.tsx:54`, `VideoDetail.tsx:153`); `.placeholder-card` only in `CardsPlaceholder` (`Placeholder.tsx:69`, used at `ChannelSummaryFigures.tsx:73`, `VideoDetail.tsx:269`). `app.css` is the web app's alone |
| Revenue message cards against the place | `pnpm build && sh docs/reviews/creator-analytics-238/repro/card-row-message-card.sh`: the built stylesheet in the system Chrome at 1280px, 560px and 380px windows, the revenue card in each of its three message states | exit 1: the "no revenue for this date range" card makes the row 5.8px taller at 1100px and 340px content and 53.8px at 515px; the consent sentence and its button 7.4px at 515px; "not in the Partner Program" matches at every width (finding 1) |
| Stylesheet test pins `.card`'s `min-height` | `grep -n "card-place\|'.card', 'min-height'" apps/web/test/*.ts apps/web/src/*.test.ts` | Only `web.test.ts:521-522`, the `.cards` property and the placeholder's height. Nothing reads `.card`'s `min-height` (finding 2) |
| Em-dashes in shipped copy | Read of the delta's added lines | none |
| Mutation of `.card`'s `min-height` against the fast suite | Not run | The grep above is the evidence; finding 2's Proof gives the command |

**Overall:** The delta does what review 2's finding 1 asked, and does it structurally: one shared `--card-place` that every card keeps as its least height and the placeholder takes as its height, proved red before and green after in the browser walk at the two wrap widths, with every full check green. No MEDIUM or higher this round. Three LOWs: the revenue card's message states can still outgrow the place, a pre-existing gap the new comments now claim is closed (finding 1, a split ticket by review 2's own escalation rule, plus a comment correction here); the fast suite does not pin the card's `min-height` (finding 2); and the new walk step skips the video page and repeats the placeholder-planting code (finding 3).

## Approach decisions
- The engaged views card's ratio line keeps a two-line place (`--card-ratio-place`, `.card .card-detail + .card-detail` min-height), from #242 review pass 1 `7d90054`. Kept.
- At zero engaged views the engaged views card keeps that place as an empty `aria-hidden` `card-detail` (`ratio: null`), from review 1 finding 1 `fb62e46`. Kept, though `.card`'s `min-height` now makes both this and the line above redundant for height (Minor / nits).
- Every card is at least as tall as a card placeholder, through one shared custom property that both `.card`'s `min-height` and `.placeholder-card`'s `height` read, from review 2 finding 1 `e34441a`: `--card-place` is `--card-head-place + --card-number-place + --card-details-place`, all on `.cards`. Kept, and verified.
- New, this review: a card whose content is taller than the place (the revenue card's message states) is not patched in this branch. Review 2 recorded that a fifth in-place change to this height rule becomes a split ticket with a width-by-state test matrix; finding 1 is that case. In this branch only the comments change, so they stop claiming the rule holds for every state.

## Confirmed Issues
### 1. When the revenue card shows a sentence in place of its amount, the cards row can be taller than its placeholders, and the new comments say it never is — LOW
- **Location:** `apps/web/src/app.css:187-192` (the comment above `.cards`), `:1175-1176` (the comment above `.placeholder-card`), `:295-297` (`.card .card-message`); `apps/web/src/cards.ts:127-139` (`revenueCardOf`'s three message states); `apps/web/src/revenue.ts:5-12` (their approved sentences)
- **Attribution:** the layout gap is **pre-existing, untouched**: at `41b2008` the placeholder was shorter still (`git show 41b2008:apps/web/src/app.css`, line 1163: the number and the views line only, 128.6px computed), so every message state was at least as far off; at `f7f76e8` the placeholder was already 174.6px and the message cards were the same height they are now. The branch narrowed it (computed, not measured at the base). The comments' claim is **introduced** by `e34441a` ("creator-analytics#238 pre-PR review 2 finding 1: ..."): "so a row of cards is as tall as its placeholders however the grid wraps" and "at any width". Relative to `f7f76e8`: pre-existing, not introduced by the remediation; review 2's Must preserve named "a card taller than the place ... still grows past it", so the growth is known, but no doc measured it or named it as a jump, and neither prior closure table nor `### Known regressions, deferred` lists it, so this is not a deferred item.
- **Real-world trigger:** two states. The "YouTube reports no revenue for this date range ..." sentence (`revenueText.noRevenue`, approved word for word in creator-analytics#151) shows when a date range has no reported revenue, such as a short or very recent range on a monetized channel: the row is 5.8px taller on a desktop screen and 53.8px on a 560px screen, where the revenue card sits on a row of its own. "Revenue needs your consent." with its button shows for every user who has not given revenue consent: 7.4px on a 560px screen. The page moves down by that much when the answer lands. Capped at LOW as a pre-existing display defect this branch narrowed; it would rate MEDIUM if it were introduced, as reviews 1 and 2 rated the same rule.

**Evidence** — the comments claim every state:
```css
/* ... Every card keeps it as its least height, and the card placeholder is that tall, so a row of cards is as tall as its
   placeholders however the grid wraps (creator-analytics issue 119, W24). */
/* One card's place (.cards --card-place), which every card keeps as its least height, so a row of
   cards is as tall as its placeholders at any width. */
```
`min-height` lifts a short card to the place and lets a taller card grow past it; `.card .card-message` sets `1rem / 1.5` body text, and the no revenue sentence runs to five or more lines on a card about 22rem wide or narrower.

**Failure mode** — `pnpm build && sh docs/reviews/creator-analytics-238/repro/card-row-message-card.sh` lays engaged views (views and ratio lines), watch hours, and the revenue card in each message state against three placeholders, in Chrome windows of 1280px, 560px and 380px:
```
MISMATCH content 1100px, no revenue for the date range: row 180.390625px, placeholders 174.59375px
MISMATCH content 515px, no revenue for the date range: row 418.984375px, placeholders 365.1875px
MISMATCH content 515px, consent missing, with its button: row 372.578125px, placeholders 365.1875px
MISMATCH content 340px, no revenue for the date range: row 561.578125px, placeholders 555.78125px
```
"Not in the Partner Program" and every other line is ok. The browser walk cannot catch it: the stub answers `revenue: { currency: 'USD', reported: true }` (`apps/site/test/screenshot/stub-api.ts:257`), so the walk never renders a message state.

**Recommended fix** — in this branch, only the two comments, so they no longer claim the message states:
```diff
--- a/apps/web/src/app.css
@@ .cards comment
-   least height, and the card placeholder is that tall, so a row of cards is as tall as its
-   placeholders however the grid wraps (creator-analytics issue 119, W24). */
+   least height, and the card placeholder is that tall, so a row of cards whose amounts show is as
+   tall as its placeholders however the grid wraps (creator-analytics issue 119, W24). A revenue
+   card with a sentence in place of its amount can be taller, and its row with it. */
@@ .placeholder-card comment
-/* One card's place (.cards --card-place), which every card keeps as its least height, so a row of
-   cards is as tall as its placeholders at any width. */
+/* One card's place (.cards --card-place), which every card keeps as its least height, so a row of
+   cards whose amounts show is as tall as its placeholders at any width. */
```
The layout itself goes to a follow-up ticket, not this branch: the place for a message state is a design decision for Nick (the sentences are approved copy, and the placeholder cannot know which state the answer will be), and review 2's escalation rule asks for a split ticket with a width-by-state matrix.

**Remediation brief**
- **Design intent:** the cards row and its placeholder row must be the same height at every width so nothing under them moves when the answer lands (creator-analytics#119, W24). Since `e34441a` each card keeps `--card-place` as its `min-height` and the placeholder is exactly that tall, so any card whose content fits the place matches at every width; a card whose content is taller grows, by design (`min-height`, not `height`), and its row grows with it. The comments must describe that rule, with its one exception, so a maintainer does not believe the message states are covered.
- **Full surface:** `apps/web/src/app.css:190-192` (the last two lines of the comment above `.cards`) and `:1175-1176` (the comment above `.placeholder-card`). Nothing else in this branch. For the follow-up ticket: `apps/web/src/app.css:205-214` (`.card`), `:295-297` (`.card .card-message`), `apps/web/src/Placeholder.tsx:68-70`, `apps/web/src/cards.ts:127-139`, `apps/site/test/screenshot/stub-api.ts:257` (a stub path that answers no reported revenue and one without consent), and a walk step over the width-by-state matrix.
- **Must preserve:** the rest of both comments word for word (the place's terms, the creator-analytics issue 119 W24 reference); every declaration in `app.css`; `pnpm lint` green (Biome formats CSS, and each comment line stays under 100 columns).
- **Do not touch:** `.card`'s `min-height`, `.placeholder-card`'s `height`, and the `--card-*-place` properties (Reviewed and Dismissed: the sum and box sizing are right); the approved sentences in `apps/web/src/revenue.ts`, which change only with Nick.
- **Proof:** the comment edit carries no behaviour, so `pnpm lint` green and `git diff` touching only comment lines is its proof. The layout gap stays red in `sh docs/reviews/creator-analytics-238/repro/card-row-message-card.sh` (after `pnpm build`) until the follow-up ticket closes it; that script is the follow-up's red.
- **Escalation:** fifth change to this height rule on the branch (`ec38e1d`, `7d90054`, `fb62e46`, `e34441a`, and this state), so per review 2 the layout fix is a split ticket with its own width-by-state test matrix, not an in-place change here.

### 2. The fast suite does not pin that every card keeps the placeholder's place, and its test still names the old rule — LOW
- **Location:** `apps/web/test/web.test.ts:509-524`
- **Attribution:** introduced by `e34441a`, which rewrote `:521-522` to read `--card-place` and the placeholder's `height` and added `.card`'s `min-height` at `app.css:209` without an assertion on it (`git log --oneline -S"'--card-place'" f7f76e8..HEAD -- apps/web/test/web.test.ts`). Named by review 2's closure verifier as a LOW gap left for this round.
- **Real-world trigger:** a later edit drops or renames `.card`'s `min-height` (a refactor of the card rule, a Tailwind move); `pnpm test` and CI stay green, and only the local browser walk, which is outside CI, goes red. No user path today; capped at LOW.

**Evidence**
```ts
  testWithoutDatabase(
    "a card's number keeps the place of the two lines a long amount wraps to at its least size, and the card placeholder holds that place (creator-analytics#119 W24)",
    ...
      expect(valueIn(own, '.cards', '--card-place')).toContain(' + var(--card-number-place) + ')
      expect(valueIn(own, '.placeholder-card', 'height')).toBe('var(--card-place)')
```
No assertion reads `valueIn(own, '.card', 'min-height')` anywhere in `apps/web/test/` or `apps/web/src/*.test.ts`.

**Failure mode** — remove `min-height: var(--card-place);` from `.card`: the row of three still matches (the engaged views card carries it), the wrapped rows fall short again (review 2's 46px and 117px), and the fast suite passes. The test's name states the number's place and the placeholder, not the rule the new lines defend.

**Recommended fix** — split the card's place into its own test, named for its rule, and pin both sides:
```diff
--- a/apps/web/test/web.test.ts
@@ -518,8 +518,17 @@
       expect(valueIn(own, '.cards', '--card-number-place')).toBe('calc(2 * 1.125rem * 1.2)')
       expect(valueIn(own, '.card .card-number', 'min-height')).toBe('var(--card-number-place)')
-      expect(valueIn(own, '.cards', '--card-place')).toContain(' + var(--card-number-place) + ')
-      expect(valueIn(own, '.placeholder-card', 'height')).toBe('var(--card-place)')
     },
   )
+
+  testWithoutDatabase(
+    'every card keeps one card placeholder as its least height, and the placeholder is that tall, so a wrapped row of cards is as tall as its placeholders (creator-analytics#119 W24)',
+    async () => {
+      const own = await webOwnSheet()
+      expect(valueIn(own, '.cards', '--card-place')).toContain(' + var(--card-number-place) + ')
+      expect(valueIn(own, '.card', 'min-height')).toBe('var(--card-place)')
+      expect(valueIn(own, '.placeholder-card', 'height')).toBe('var(--card-place)')
+    },
+  )
```
The existing test's name then states only the number's place: drop ", and the card placeholder holds that place" from it.

**Remediation brief**
- **Design intent:** `web.test.ts` reads the web app's own stylesheet text (`webOwnSheet`, `valueIn` from `packages/visual-system/test/testing.ts:94`, which matches a selector exactly, so `'.card'` reads only the `.card` rule); it cannot lay anything out, so it pins the declarations that make the layout hold, and the browser walk measures the layout. Standard 2: one rule per test, named for the rule.
- **Full surface:** `apps/web/test/web.test.ts:509-524` only.
- **Must preserve:** the number place assertions at `:514-520`, unchanged, in the existing test; `pnpm exec vitest run apps/web/test/web.test.ts` green; the walk step `state: wrapped cards row as tall as its placeholders`, which stays the measurement.
- **Do not touch:** `app.css`; the `toContain` form at `:521` (Reviewed and Dismissed: same pattern as its neighbours).
- **Proof:** red first, in a scratch worktree at HEAD under the scratchpad with the new test added: delete the line `  min-height: var(--card-place);` from `.card` in `apps/web/src/app.css`, run `pnpm exec vitest run apps/web/test/web.test.ts -t 'least height'`, red; restore the line, green. In the worktree itself, the same command green.

### 3. The wrapped-row walk step skips the video page and repeats the placeholder-planting code — LOW
- **Location:** `apps/site/test/screenshot/browser-walk.ts:1971` (the path list), `:1980-1985` (the planted row), `:1902-1909` (the same planting in `engagedViewsCardHeights`)
- **Attribution:** introduced by `e34441a`. The video page gap was named by review 2's closure verifier; the duplication is a refactor the change walked past (`CODING_STANDARDS.md` 3).
- **Real-world trigger:** none today: the video page renders the same `Cards` (`VideoDetail.tsx:153`) and `CardsPlaceholder count={3}` (`VideoDetail.tsx:269`) under the same stylesheet, so the fix reaches it. A later change to the video page's cards (a fourth card, a different grid) would go unmeasured at the wrap widths. Capped at LOW.

**Evidence**
```ts
        for (const path of ['/app/', '/app/?format=live']) {
...
            const holder = document.createElement('div')
            holder.className = 'cards'
            holder.innerHTML = '<div class="placeholder placeholder-card"></div>'.repeat(3)
            row.after(holder)
```
and in `engagedViewsCardHeights`, the same `div.cards` with a `.placeholder.placeholder-card`, inserted after the row, measured and removed.

**Failure mode** — coverage, not behaviour: the step never visits `/app/videos/<id>` at 560px or 380px, and two copies of the planting must both change when the placeholder's markup does.

**Recommended fix** — add the video page to the step's paths, and plant both rows through one page-side function:
```diff
-        for (const path of ['/app/', '/app/?format=live']) {
+        for (const path of [
+          '/app/',
+          '/app/?format=live',
+          `/app/videos/${encodeURIComponent(newestVideo.id)}`,
+        ]) {
```
and one constant beside `engagedViewsCardHeights`, interpolated into both page scripts, such as ``const plantedPlaceholderRowHeight = `(after, count) => { const row = document.createElement('div'); row.className = 'cards'; row.innerHTML = '<div class="placeholder placeholder-card"></div>'.repeat(count); after.after(row); const height = row.getBoundingClientRect().height; row.remove(); return height }` `` called as `(${plantedPlaceholderRowHeight})(card.parentElement, 1)` and `(${plantedPlaceholderRowHeight})(row, 3)`.

**Remediation brief**
- **Design intent:** the walk measures the real built app in the system Chrome; a planted placeholder row beside the real one gets the same parent and width (the real placeholders sit in a one-column grid in the same parent, `App.tsx:538`), so the planted height is the height the placeholder row had before the answer landed.
- **Full surface:** `apps/site/test/screenshot/browser-walk.ts:1889-1917` (`engagedViewsCardHeights`), `:1960-2006` (the new step, its comment at `:1960-1962` naming the paths if it lists them).
- **Must preserve:** both steps' assertions and messages; the older step's single placeholder measured against one card; the new step's "3 cards" and rows checks, which keep it from passing vacuously; the `finally` that resets the viewport; 29 steps green, no content security policy violation.
- **Do not touch:** the tolerance of 0.5px and the widths 560 and 380 (Reviewed and Dismissed).
- **Proof:** `pnpm build && pnpm test:browser` green with the video page path. Unverified: that the stub's newest video shows three cards at those widths; if it shows fewer, the step throws "N cards, not three", and the path should then expect that count rather than be dropped. For the red, in a scratch worktree at `f7f76e8` under the scratchpad with the new `browser-walk.ts` copied in, the step must name the video page among its mismatches.

## Prior-review closure
Review 2 (`pre-pr-review-2.md`, HEAD `f7f76e8`) confirmed one finding.
- **Finding 1 (MEDIUM), fully fixed** by `e34441a`. Verified against its intent, not its diff: the new walk step is red against `f7f76e8`'s code at 560px and 380px on `/app/` and `/app/?format=live`, and green at HEAD; review 2's repro now exits 0; the changed stylesheet assertions are red at `f7f76e8`. Every Must preserve item holds: the placeholder is 174.6px, one row of three is unchanged, a taller card still grows (finding 1 above is that growth, a state review 2 did not measure), the ratio line's two-line place and the empty `aria-hidden` place are untouched, and the chooser's `::after` still covers the whole card. The brief's Full surface missed `web.test.ts:521-522`, which the remediator found and folded in.
Review 1 (`pre-pr-review-1.md`, HEAD `502a58f`), still open at LOW:
- **Finding 2 (LOW), untouched.** Deferred by the default scope (eng-pipeline#34). Outside the delta; brief unchanged.
- **Finding 3 (LOW), untouched.** Same deferral. Outside the delta; brief unchanged.
- **Finding 4 (LOW, comment hygiene), partially fixed:** the `browser-walk.ts` entry was applied by `e34441a` (`:1921` now reads "as three cards to a row are at 800px"); the other five entries (`apps/api/src/video-list.ts:383-384`, `:419-420`, `apps/web/src/numbers-table.ts:21-25`, `:88`, `packages/api-types/src/videos.ts:332-333`) are outside the delta and untouched.
- MEDIUM-or-higher still open from review 2: 0. Deferred by decision: none (review 2's `### Known regressions, deferred` is "None").

## Needs Further Investigation
### A. An upcoming public live stream or Premiere may count in the newest average with zero engaged views — confirm what Google answers for an upcoming broadcast
Carried from review 1, item A, unchanged: the delta does not touch `apps/api/src/video-list.ts` or the gateway. `newestAverageOf` (`apps/api/src/video-list.ts:360-366`) keeps `privacy === 'public' && !scheduled && !partial`; the gateway sets `scheduled` only for a private video with a `publishAt` (`packages/youtube-gateway/src/reads/uploads.ts:136`). Confirm on Google's `videos` and `playlistItems` resource pages what `videoPublishedAt` and `snippet.liveBroadcastContent` hold for an upcoming broadcast. If `videoPublishedAt` is set before it airs, the gateway needs to flag `liveBroadcastContent === 'upcoming'` and the rule should leave it out; that would be pre-existing, exposed, since the same pick rule feeds the extension's comparison row.

## Reviewed and Dismissed
- The new `calc` changing the placeholder's height — term for term the old formula, regrouped; 174.6px measured at 1100px content.
- `min-height` missing the padding and border — `box-sizing: border-box` on every element (`packages/visual-system/src/styles.css:103-106`).
- `--card-place` undefined where a card or placeholder renders — both render only inside a `.cards` element; the old formula already read `--card-number-place` from `.cards`. `screen-ready.test.ts:31`'s bare `placeholder-card` is jsdom markup with no stylesheet.
- Another app sharing these selectors — `.card` elsewhere is only the extension's Studio fixture (`studio.css`, YouTube's `.card.ytcd-*`); `app.css` is the web app's alone.
- The planted placeholder row landing at another width — it is a sibling of `dl.cards` in the same parent, the same parent as the real placeholder row, and both are `.cards` grids with `margin: 0`; review 2's measured 365.2px and 555.8px match two and three placeholder rows exactly.
- The new step passing vacuously — it throws unless there are three cards on the expected number of rows, and a misspelt `--card-place` collapses the placeholders to 0 and fails it; red at `f7f76e8`.
- The step leaking its viewport — its `finally` resets to `{ ...viewport, mobile: false }`, as the earlier steps do.
- The card chooser below 40rem — 560px and 380px are both under 40rem, so the step measures chooser cards; the button inherits the label's font, and `.card-choose::after { inset: 0 }` covers the taller card.
- A long amount on two lines — the number's 43.2px place holds both lines; that card is about 128.6px, under the place.
- `web.test.ts:521`'s `toContain` on a `calc` string — a stylesheet-text assertion in the pattern of its neighbours, not an exact class string; its weakness is coverage (finding 2), not form.
- The 0.5px tolerance — the rows and placeholders differ by under 0.02px when they match.

## Minor / nits
- `.card .card-detail + .card-detail`'s `min-height` (`app.css:247-249`) and the empty `aria-hidden` place for `ratio: null` (`Cards.tsx:58`) no longer decide any height: with `.card`'s `min-height`, the engaged views card is at least the place without them, so removing either leaves every row the same height and the older walk step `state: engaged views card as tall as its placeholder` can now fail only when a card outgrows its placeholder. Both are recorded approaches (Approach decisions), so their removal is a cleanup for its own change, not a test to add: a test pinning them would pin a rule nothing depends on.
- `app.css:187-192`: the comment above `.cards` opens with the number's place, then the card's place, while the properties run number, ratio, head, details, place; one comment line per property would read in order.
- `browser-walk.ts:1974`: the new step names its result `heights` though it carries `rows`; `measured` would read truer.
- `repro/card-row-wrapped-widths.sh`'s second set ("with the recommended fix") now equals the first, since the fix landed; harmless.

## Test quality
Tests added or with changed assertions in the delta: 2 · green against `f7f76e8` (assert nothing new): 0 · tautology shapes found: 0. The walk step `state: wrapped cards row as tall as its placeholders` is red against `f7f76e8`'s code and green at HEAD; the card number place test in `web.test.ts` is red at `f7f76e8` (its `:521` reads a property that did not exist). Neither is self-computed, mocked, call-shaped, snapshot or prose. The stylesheet test pins one side of the card's place and not the other (finding 2). The branch's other tests are as review 1's Test quality recorded them, with its findings 2 and 3 still open at LOW.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and the suite are green at `1c4424f`; the browser walk passes.
- **Commit hygiene:** nothing to drop. This review doc and `repro/card-row-message-card.sh` are the only additions.
- **Likely reviewer asks:** the cards with revenue not yet consented and with no revenue for a range, on a phone (finding 1); a VoiceOver pass over the ratio line and the empty place; an answer on item A.

## Verdict
Ready to open the PR, with follow-ups. No finding is MEDIUM or higher, so none gates it. Review 2's one MEDIUM is fully fixed and proved by execution at both wrap widths. Finding 1's comment correction, finding 2's test and finding 3's walk paths are small and can ride a remediation pass before the PR or follow it; finding 1's layout gap (the revenue card's message states outgrowing the place) is a split ticket with a width-by-state matrix, by review 2's escalation rule, since this is the fifth state of the same height rule. Review 1's three LOWs remain open by the default scope. The confirmed count stays at three LOWs plus the carried LOWs, drifting toward coverage and comments: the real behaviour on the branch's own surface converged.
