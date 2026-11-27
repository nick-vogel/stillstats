# Pre-PR review: creator-analytics#238 More own-channel metrics (ratio, newest average, RPM by day and by video)

**Branch:** `creator-analytics-238-own-channel-metrics` vs `origin/creator-analytics-236-video-list-paging-daily-table` (merge-base `41b2008` "creator-analytics#236 merge origin/main (#360 shadcn and Tailwind, #359 TanStack Charts)")
**Reviewed at:** HEAD `f7f76e8` ("creator-analytics#238 pre-PR review 1 remediation closure table"). The tree was clean, with no uncommitted or untracked files at review time. 31 files, +1874 / −172 against the merge-base, the review folder included.
**Delta under review:** since `502a58f` ("creator-analytics#264 Video list: an RPM column and sort"), the HEAD `pre-pr-review-1.md` reviewed: 3 commits (`0d61973` the review doc, `fb62e46` finding 1's fix, `f7f76e8` the closure table), 8 files, +291 / −19, of which 6 are code: `apps/web/src/cards.ts`, `apps/web/src/Cards.tsx`, `apps/web/src/app.css`, `apps/web/src/cards.test.ts`, `apps/web/src/components.test.ts`, `apps/site/test/screenshot/browser-walk.ts`.
**Reviewed against:** `pre-pr-review-1.md` (its finding 1 brief, the intent the delta had to meet, and its Remediation closure table), `CODING_STANDARDS.md` 1 to 3, the epic creator-analytics#238 as distilled in review 1 (the cards row and its placeholder must be the same height, creator-analytics#119 W24). The repo has no `CLAUDE.md`.
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
| Browser walk | `pnpm run --if-present test:browser` | passed, no content security policy violation in 28 steps; `state: engaged views card as tall as its placeholder` green on `/app/`, the newest video's page and `/app/?format=live` at 1280px and 800px |
| Delta tests against `502a58f` (tautology oracle) | Scratch worktree at `502a58f`, HEAD's `cards.test.ts` and `components.test.ts` copied in, `-t 'zero engaged views'` | Both changed cases red: `cards.test.ts` "shows no ratio line at zero engaged views", `components.test.ts` "at zero engaged views, the card keeps the ratio line's place, empty and hidden from a screen reader". The unchanged "at zero engaged views, the card has the views line and no ratio line" stays green, as review 1 required |
| Walk step against `502a58f` code | Same scratch worktree, HEAD's `browser-walk.ts` copied in, `pnpm build && pnpm test:browser` | Red: `/app/?format=live` at 1280px and 800px, card 128.6px against placeholder 174.6px. Green at HEAD. Finding 1 of review 1 is closed by execution |
| Consumers of `Card.ratio` | `git grep` for `.ratio`, `ratio:`, `engagedViewsCardOf`, `labels.engagedViews` over `apps/` and `packages/` | Only `Cards.tsx:25` reads it; only `engagedViewsCardOf` sets it, called from `channel-summary.ts:107` and `video-detail.ts:84`. No spread, `in` check or snapshot. Watch hours and revenue cards carry no `ratio` key, so they render no empty place |
| Live is zero engaged views in the stub | Read of `apps/site/test/screenshot/sample-channel.ts:216-222` | The sample channel uploads only videos and Shorts, so the Live summary sums to 0 |
| Cards row against its placeholders where the cards wrap | `pnpm build && sh docs/reviews/creator-analytics-238/repro/card-row-wrapped-widths.sh`: the built stylesheet in the system Chrome, a box as wide as the app's content at 1280px, 560px and 380px screens | Red: at 515px content (two and one) the row is 319.2px, its placeholders 365.2px; at 340px (one to a row) 438.7px against 555.8px. One row at 1100px matches. The recommended fix's set is ok at all three (finding 1) |
| Em-dashes in shipped copy | Read of the delta's added lines | none |
| VoiceOver on the empty place | Not run | No screen reader here. The place is `aria-hidden` with no text, which `components.test.ts:697` pins |

**Overall:** The delta does what review 1's finding 1 asked: at zero engaged views the engaged views card keeps an empty, hidden place for the ratio line, so on one row of three the cards are as tall as their placeholders, proved red before and green after in the browser walk. Every full check is green. One new MEDIUM gates the PR, and it is the same rule at narrower widths: where the three cards do not fit on one row (a screen under about 660px), the revenue card on a row of its own is 46px shorter than its placeholder, and stacked one to a row the drop grows to about 117px. Review 1 scoped widths under 800px out and missed the two-and-one layout.

## Approach decisions
- The engaged views card's ratio line keeps a two-line place (`--card-ratio-place`, `.card .card-detail + .card-detail` min-height), from #242 review pass 1 `7d90054`. Kept.
- At zero engaged views the engaged views card keeps that place as an empty `aria-hidden` `card-detail` (`ratio: null`), from review 1 finding 1 `fb62e46`. Kept.
- New, this review: every card is at least as tall as a card placeholder, through one shared custom property that both `.card`'s `min-height` and `.placeholder-card`'s `height` read. This replaces patching the placeholder per line, and it is the guard for every layout the grid can wrap to. The precedent is in the same file: `.card .card-number` already keeps a `min-height` place (`--card-number-place`) that the placeholder counts.
- Remediation of finding 1, `e34441a`: `--card-place` is the sum of `--card-head-place` (padding, border, label, the gap under it), `--card-number-place` and `--card-details-place` (the views line, the ratio line's place, and the gap above each), all on `.cards`. The split exists only so each line fits the formatter's 100 columns; Biome otherwise breaks a long `calc` one term per line. The placeholder's own `--number`, `--views` and `--ratio` are gone. A change to a card's lines changes these parts, never the placeholder.

## Confirmed Issues
### 1. Where the three cards do not fit on one row, a card on a row of its own is shorter than its placeholder, so the page jumps when the answer lands — MEDIUM
- **Location:** `apps/web/src/app.css:187-195` (`.cards`), `:197-206` (`.card`), `:1166-1177` (`.placeholder-card`); `apps/web/src/Placeholder.tsx:68-70` (`CardsPlaceholder`, three `.placeholder-card` in a `.cards` grid, used at `ChannelSummaryFigures.tsx:73` and `VideoDetail.tsx:269`)
- **Attribution:** relative to `$BASE`: the two-and-one layout is **introduced** by #242, and the one-to-a-row layout is **pre-existing, exposed** and widened. At `41b2008` the placeholder counted the number and the views line only (`git show 41b2008:apps/web/src/app.css`, line 1163: `height: calc(2rem + 2px + 0.875rem * 1.6 + 0.25rem + var(--number) + 0.25rem + 0.9375rem * 1.4)`), the height of a revenue card with its RPM line (`git show 41b2008:apps/web/src/cards.ts`, line 107), so a lone revenue card matched; stacked, only the watch hours card fell short, by its missing views line (about 25px, from the CSS, not measured). `ec38e1d` ("creator-analytics#242 Engaged views card: views are N× engaged views") added the ratio line's term and `7d90054` ("creator-analytics#242 review pass 1 finding 1: ...") widened it to two lines (`git log --oneline -S'--ratio:' 41b2008..HEAD -- apps/web/src/app.css`). Relative to `502a58f`: pre-existing, not introduced by the remediation. Review 1 named the stacked layout as pre-existing and outside its finding 1 (its Do not touch line), and did not name the two-and-one layout; neither is in its closure table or `### Known regressions, deferred`, so this is a new finding, not a deferred one.
- **Real-world trigger:** the channel summary with revenue on (three cards) on any screen from about 440px to 660px wide: a phone held sideways, a small tablet, a browser window at half a laptop screen. The `.cards` grid (`repeat(auto-fit, minmax(min(100%, 12rem), 1fr))`, gap 1rem) needs 38rem (608px) of content for three columns and 25rem (400px) for two; the app's content is the screen less two gutters of `clamp(1.25rem, 4vw, 2.5rem)` (`packages/visual-system/src/styles.css:74`). The revenue card drops to a second row of its own, at its own height. Below about 440px (a phone held upright) the cards stack one to a row, and the watch hours and revenue cards each fall short. Capped at MEDIUM as a display defect; review 1 rated the same rule MEDIUM.

**Evidence** — the placeholder always counts the views line and the two-line ratio place, which only the engaged views card has:
```css
.placeholder-card {
  --number: var(--card-number-place);
  --views: calc(0.25rem + 0.9375rem * 1.4);
  --ratio: calc(0.25rem + var(--card-ratio-place));
  height: calc(2rem + 2px + 0.875rem * 1.6 + 0.25rem + var(--number) + var(--views) + var(--ratio));
```
A grid row is as tall as its tallest card, so on one row of three the engaged views card carries the row; on a row of its own a card is only as tall as its own lines. The watch hours card has no smaller line (`cards.ts` `watchHoursCardOf`), the revenue card at most its RPM line.

**Failure mode** — `sh docs/reviews/creator-analytics-238/repro/card-row-wrapped-widths.sh` after `pnpm build` lays engaged views (with views and ratio lines), watch hours, and revenue with its RPM line, the control state with every line a card can have, against three placeholders:
```
ok content 1100px, the cards as they render today: row 174.578125px, placeholders 174.59375px
MISMATCH content 515px, the cards as they render today: row 319.15625px, placeholders 365.1875px
MISMATCH content 340px, the cards as they render today: row 438.734375px, placeholders 555.78125px
```
515px is the content of a 560px screen, 340px that of a 380px screen. The content under the cards moves up 46px and 117px when the answer lands. A revenue card without an RPM line (zero engaged views) falls 26px further. The browser walk cannot catch it: its step measures the engaged views card alone, at 1280px and 800px only (`browser-walk.ts:1930`).

**Recommended fix** — one place a card and its placeholder share, a `min-height` on every card:
```diff
--- a/apps/web/src/app.css
@@ .cards
 .cards {
   --card-number-place: calc(2 * 1.125rem * 1.2);
   --card-ratio-place: calc(2 * 0.9375rem * 1.4);
+  --card-place: calc(2rem + 2px + 0.875rem * 1.6 + 0.25rem + var(--card-number-place) + 0.25rem + 0.9375rem * 1.4 + 0.25rem + var(--card-ratio-place));
   display: grid;
@@ .card
 .card {
   display: grid;
   align-content: start;
   gap: 0.25rem;
+  min-height: var(--card-place);
   padding: 1rem 1.25rem;
@@ .placeholder-card
 .placeholder-card {
-  --number: var(--card-number-place);
-  /* The views line and the gap above it, then the ratio line's place and the gap above it. */
-  --views: calc(0.25rem + 0.9375rem * 1.4);
-  --ratio: calc(0.25rem + var(--card-ratio-place));
-  height: calc(2rem + 2px + 0.875rem * 1.6 + 0.25rem + var(--number) + var(--views) + var(--ratio));
+  height: var(--card-place);
   border-radius: 1rem;
 }
```
The comment that the diff removes moves, reworded, to the comment above `.cards` or `.card`, per Full surface; the diff itself carries no comment line.

**Remediation brief**
- **Design intent:** the cards row and its placeholder row (`CardsPlaceholder`, three `.placeholder-card` in a `.cards` grid) must be the same height at every width, so nothing under them moves when the answer lands (creator-analytics#119, W24). The grid wraps to two and one, or one to a row, on narrow screens, so matching the tallest card is not enough: each card has to be as tall as one placeholder. `.card` is `box-sizing: border-box` (`packages/visual-system/src/styles.css:103-107`), so the same `calc` that gives the placeholder its full height gives the card its full `min-height`. `align-content: start` keeps a card's lines at its top, with the spare place under them. Both rows sit in a `.cards` element, so a custom property on `.cards` reaches both. This is the fourth change to this height rule on the branch (`ec38e1d`, `7d90054`, `fb62e46`, and now this one), each patching one more line or state; the shared `min-height` ends the per-line patching. If it fails a review again, split the cards row's height into its own ticket with a width-by-state test matrix instead of a fifth in-place change.
- **Full surface:** `apps/web/src/app.css:187-195` (`.cards`, add `--card-place`), `:197-206` (`.card`, add `min-height`), `:1166-1177` (`.placeholder-card` and its comment: the comment above it at `:1166-1169` and the inline one at `:1172` describe the per-line sum and must be rewritten to say the placeholder is one card's place, `--card-place`, which every card keeps as its least height, so a row is as tall at any width); `apps/site/test/screenshot/browser-walk.ts:1920-1958` (the walk step; add widths, below, and correct its comment at `:1920-1921`, "as two and three cards to a row are at 800px", which is review 1 finding 4's entry). `.card` is used only by `apps/web/src/Cards.tsx` (`git grep` over `apps/web/src/*.tsx` and `apps/site/src`). `--number`, `--views` and `--ratio` are read nowhere else in `app.css`.
- **Must preserve:** the placeholder's height, 174.6px at the default font size (the repro's 1100px line, and the walk's step at 1280px and 800px on `/app/`, the newest video's page and `/app/?format=live`); one row of three cards unchanged in height, since every card there already stretches to the engaged views card's 174.6px; a card taller than the place (a revenue card's consent message and button, a long amount on two lines) still grows past it; the ratio line's two-line place and the empty `aria-hidden` place at zero engaged views, with `components.test.ts:669`, `:673`, `:689`, `:697` and `cards.test.ts:55` green unchanged; the card chooser below 40rem (`.card-chooser`), whose button stretches over the whole card, now a taller card.
- **Do not touch:** `.card .card-detail + .card-detail`'s `min-height` (`app.css:238`) and the empty place `Cards.tsx:58` renders for `ratio: null`. With the card's `min-height` they no longer decide the row's height, but they are the recorded approach of `7d90054` and `fb62e46` and still true; removing them is a separate cleanup, not this fix.
- **Proof:** red now: `pnpm build && sh docs/reviews/creator-analytics-238/repro/card-row-wrapped-widths.sh` exits 1 on the 515px and 340px lines; its "with the recommended fix" set already models the fix and is ok. Green after, in the suite: extend the walk with a step that, at two more screen widths, 560px (two and one) and 380px (one to a row), on `/app/` with revenue on, measures the whole `.cards` row against a planted `CardsPlaceholder` row of three (`<div class="cards">` holding three `<div class="placeholder placeholder-card">`) and fails on a difference over 0.5px; `pnpm build && pnpm test:browser` is red before the CSS change and green after. Confirm in the stub that `/app/` shows the revenue card; if it does not, use the stub's revenue-on path the walk already visits for the revenue card.

## Prior-review closure
Review 1 (`pre-pr-review-1.md`, HEAD `502a58f`) confirmed four findings.
- **Finding 1 (MEDIUM), fully fixed** by `fb62e46`. Verified against its intent, not its diff: the walk step it added is red against `502a58f`'s code and green at HEAD, both changed unit cases are red at `502a58f`, and every Must preserve item holds (no visible ratio line or spoken text at zero engaged views, the ratio line's markup unchanged with engaged views, no `ratio` key or extra `dd` on the other cards, the walk's 1280px and 800px checks). Its fix holds at the widths it was scoped to; finding 1 above is the same rule at widths review 1 left out, a gap in review 1's scope rather than a half-fix.
- **Finding 2 (LOW), untouched.** Deferred by the default scope (eng-pipeline#34, LOW tail). Still present: `video-list.test.ts:1320`'s `'?sort=rpm&window=first7'` row and the other two locations are outside the delta. The brief in `pre-pr-review-1.md` finding 2 stands unchanged.
- **Finding 3 (LOW), untouched.** Same deferral. `components.test.ts:678` is now `:682`; the other locations are outside the delta. Brief unchanged in `pre-pr-review-1.md` finding 3.
- **Finding 4 (LOW, comment hygiene), untouched.** Same deferral. Every entry still reads as listed; `browser-walk.ts:1918-1919` is now `:1920-1921`, which finding 1 above also touches.
- MEDIUM-or-higher still open from review 1: 0. Deferred by decision: none (review 1's `### Known regressions, deferred` is "None").

## Needs Further Investigation
### A. An upcoming public live stream or Premiere may count in the newest average with zero engaged views — confirm what Google answers for an upcoming broadcast
Carried from review 1, item A, unchanged: the delta does not touch `apps/api/src/video-list.ts` or the gateway. `newestAverageOf` (`apps/api/src/video-list.ts:360-366`) keeps `privacy === 'public' && !scheduled && !partial`; the gateway sets `scheduled` only for a private video with a `publishAt` (`packages/youtube-gateway/src/reads/uploads.ts:136`). Confirm on Google's `videos` and `playlistItems` resource pages what `videoPublishedAt` and `snippet.liveBroadcastContent` hold for an upcoming broadcast. If `videoPublishedAt` is set before it airs, the gateway needs to flag `liveBroadcastContent === 'upcoming'` and the rule should leave it out; that would be pre-existing, exposed, since the same pick rule feeds the extension's comparison row.

## Reviewed and Dismissed
- `ratio: null` reaching a consumer that expects a missing key — the only reader is `Cards.tsx:25`, whose `ratio === null` and `ratio &&` branches cover `RatioLine | null | undefined`; no spread, `in` check, equality or snapshot reads a card.
- The empty place taking no height — `.card` is a grid with `gap: 0.25rem`, so an empty `dd` keeps its row and gap, and `.card .card-detail + .card-detail` matches it because the views line (`viewsLineOf`, never empty, "0 views" at zero) always comes first. Measured by the walk at `/app/?format=live`.
- The walk's `${withRatio}` inside the page script — interpolated in Node first, so the page receives `true && !ratio` or `false && ratio`, valid script; the selector `.card-detail [aria-hidden="true"]` is a descendant selector, so the empty `aria-hidden` `dd` is not counted as a ratio line.
- `/app/?format=live` not being a zero engaged views state, or leaking into the next path — the stub's sample channel has no live upload, and `route.ts` reads the format from the URL alone, so `/app/` returns to All.
- The new component test matching `<dd class="card-detail" aria-hidden="true">` as an exact class string (`CODING_STANDARDS.md` 2) — the `card-detail` class is what gives the place its height, so the rule cares about it, and the file's existing `engagedViewsDetailsOf` matches the same way. Its dependence on attribute order is a nit, below.
- `Card` carrying a layout concern in `ratio: null` — `null` is defined in the field's doc comment and only the engaged views card sets it; a design preference, not a defect.

## Minor / nits
- `apps/web/src/components.test.ts:697-705` depends on React writing `class` before `aria-hidden`; `/<dd[^>]*aria-hidden="true"[^>]*>(.*?)<\/dd>/` would not.
- `apps/web/src/Cards.tsx:58-59` could be one branch on `ratio !== undefined`; the two conditions read clearly as they are.
- No unit or walk case shows the video page at zero engaged views; it builds the card with the same `engagedViewsCardOf` and renders the same `Cards`, so the channel summary's case covers it.

## Test quality
Tests added or with changed assertions in the delta: 2 · green against `502a58f` (assert nothing new): 0 · tautology shapes found: 0. `cards.test.ts:55` "shows no ratio line at zero engaged views" (its assertion changed to `toHaveProperty('ratio', null)`) and `components.test.ts:697` (new) are both red against `502a58f`; the walk step's new `/app/?format=live` path is red against `502a58f`'s code. None is self-computed, mocked, call-shaped, snapshot or prose. The branch's other tests are as review 1's Test quality recorded them, with its findings 2 and 3 still open at LOW.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and the suite are green at `f7f76e8`; the browser walk passes.
- **Commit hygiene:** nothing to drop. This review doc and `repro/card-row-wrapped-widths.sh` are the only additions.
- **Likely reviewer asks:** the cards on a phone, upright and sideways (finding 1), in Nick's browser walk; a VoiceOver pass over the ratio line and the empty place; an answer on item A.

## Verdict
Not ready until finding 1 is fixed. The gate is finding 1, a MEDIUM: on screens narrower than about 660px the cards row is shorter than its placeholder and the page jumps 46px to 117px when the answer lands, the rule #242's review pass and review 1's finding 1 each patched at the widths they looked at. Review 1's one MEDIUM is fully fixed and proved by execution; its three LOW findings remain open, deferred by the default scope, and can ride the same pass or a follow-up. The confirmed count fell from four to one plus the three carried LOWs, and the one is a real layout defect, not drift. This is the fourth change to the same height rule on this branch, so the brief prescribes a structural fix, one shared place for a card and its placeholder, and a split ticket with a width-by-state matrix if that fails again.

## Remediation — 2026-11-04
| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 1 (MEDIUM) | `e34441a` creator-analytics#238 pre-PR review 2 finding 1: where the three cards wrap, a card on a row of its own is shorter than its placeholder, so the page jumps when the answer lands | red→green: `pnpm build && pnpm test:browser`, new step "state: wrapped cards row as tall as its placeholders" (red before the CSS change: `/app/` at 560px row 319.2px against placeholders 365.2px, `/app/?format=live` 294.2px; at 380px 438.7px and 413.7px against 555.8px; green after, 29 steps, no content security policy violation). `pnpm build && sh docs/reviews/creator-analytics-238/repro/card-row-wrapped-widths.sh` exit 1 before, exit 0 after (placeholder still 174.59375px at 1100px). The brief's Full surface missed `apps/web/test/web.test.ts:521-522`, which read the placeholder's removed `--number`; `pnpm test` found it red, and its two assertions now read `.cards --card-place` and `.placeholder-card` `height: var(--card-place)`, folded into the same commit | 3 new (the walk step's note on the two wrap widths); 1 reworded (the 800px walk comment drops "two and", review 1 finding 4's entry); the `.placeholder-card` comment moved, reworded, above `.cards` (5 lines added there, 4 plus the inline one removed at the placeholder, which keeps 2) | fixed (one `pr-review-finder` disprove agent, since the fix spans the card and placeholder pair): no introduced defect; placeholder height, one row of three, cards that outgrow the place, the ratio place and `.card-chooser` all preserved |

Preserve suites after the round, at `e34441a`: `pnpm lint` green (541 files), `pnpm typecheck` green, `pnpm build` green, `pnpm test` 125/125 files, 2850 passed, 1 expected fail, `pnpm test:browser` passed (29 steps). Review 1's findings 2, 3 and 4 (LOW) stay deferred by the default scope (eng-pipeline#34), apart from finding 4's `browser-walk.ts` entry, which this brief's Full surface named and `e34441a` applied. Item A (Needs Further Investigation) is not a confirmed finding and was not worked.

The verifier also named two LOW coverage gaps in the guard, not in the fix, left for the next round: the new walk step visits `/app/` and `/app/?format=live` but not the video page (`browser-walk.ts:1971`; the video page renders the same `Cards` and `CardsPlaceholder`, so the fix reaches it), and no stylesheet assertion pins `.card`'s `min-height: var(--card-place)` (`apps/web/test/web.test.ts:521-522`), so removing it is caught only by the browser walk, which is outside CI.

### Known regressions, deferred
- None.

### Rework briefs
- None: the verify pass reported the fix as fixed with no introduced defect, so no rework.
