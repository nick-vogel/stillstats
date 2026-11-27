# Pre-PR review: creator-analytics#238 More own-channel metrics (ratio, newest average, RPM by day and by video)

**Branch:** `creator-analytics-238-own-channel-metrics` vs `origin/creator-analytics-236-video-list-paging-daily-table` (merge-base `41b2008` "creator-analytics#236 merge origin/main (#360 shadcn and Tailwind, #359 TanStack Charts)")
**Reviewed at:** HEAD `502a58f` ("creator-analytics#264 Video list: an RPM column and sort"). The tree was clean, with no uncommitted or untracked files at review time. 29 files, +1602 / −172 against the merge-base. The branch is the #236 tip plus five lanes: #279 (`52c9365`, merge `e45719b`), #244 (`485d85d`, merge `4968dc5`), #242 (`ec38e1d`, review-pass fix `7d90054`, merge `79aed38`), #243 (`c74eb1c`, merge `be46d2f`) and #264 (`14e8a85`, merge `502a58f`).
**Reviewed against:** the epic body of creator-analytics#238 (End state, User Stories, Implementation and Testing Decisions; the 2026-11-04 amendment covers #356, #357 and #418, which this branch does not carry), the bodies of #242, #243, #244, #264 and #279 (their acceptance criteria are the requirements), the per-ticket assumptions the run recorded, and `CODING_STANDARDS.md` 1 to 3. A full review (`--fresh`), not delta-scoped; this folder held no prior review. The repo has no `CLAUDE.md`.
**Date:** 2026-11-04
**Reviewer:** 2 code-review agents + tautology-audit agent + verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | up to date |
| Lint | `pnpm lint` | green (541 files) |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` | green |
| Full suite | `pnpm test` (Testcontainers Postgres, Docker up, `TEST_DATABASE_ADMIN_URL` unset) | 125/125 files, 2849 passed, 1 expected fail |
| Browser walk | `pnpm run --if-present test:browser` (system Chrome, built app) | passed, no content security policy violation in 28 steps |
| New tests against `$BASE` (tautology oracle) | Scratch worktree at `41b2008`, the branch's 11 modified or added test files copied in, each run alone; `components.test.ts` rerun with HEAD's `newest-average.ts` dropped in for per-test signal | 83 cases added or with changed assertions: 75 red at base, 8 green. None of the 8 is a review-pass proof (`7d90054` added no test). See Test quality |
| Card row height at zero engaged views | `sh docs/reviews/creator-analytics-238/repro/card-placeholder-zero-engaged-views.sh` after `pnpm build`: the built stylesheet in headless Chrome at 1280px and 800px | Red: the row is 128.6px, its placeholder 174.6px. The recommended fix's markup measures 174.6px (finding 1) |
| `newestAverage` pick rule | Read of `newestAverageOf`, `partialOf` / `isWindowFinished`, the gateway's `scheduled` flag | Public, not scheduled, not partial, of the format (`all` admits a null format), newest first, at most 10, none under 2, only in a window after publish, from the rows before the visibility, scheduled and ids filter. An upload awaiting processing or without a publish day is partial, so never counts |
| RPM sort order | Read of `orderOf`, `hasNoValue`, `sortValueOf`; the API tests in `video-revenue.test.ts` | Partial first, then zero engaged views, then value, then newest first: complete with RPM, complete at zero, partial with RPM, partial at zero, in both directions. Consent refusal through `consentSortKeys` before any Analytics query |
| Every enumeration of sort keys | `git grep` for `revenueSortKeys`, `consentSortKeys`, `videoSortKeys`, `revenueSourceSortKeys` over `apps/` and `packages/` | `rpm` reaches the API route parser (`apps/api/src/routes/videos.ts:39`), the web route parser (`apps/web/src/route.ts:118`) and the screenshot stub. The extension enumerates no sort key |
| Numbers table total RPM equals the card | Read of `summaryViewOf` (`total` from `sourcesOf(revenue)` and `body.engagedViews`) and `headlineOf` (`totals`, `revenue`); test `numbers-table.test.ts:518` | Same inputs as `revenueCardOf`, same `moneyTextOf` |
| Revenue off while sorted by RPM | Read of `toggleColumn` and `listRouteFor` over `sortKeysOfColumn`; App test `app.test.ts:830` | Falls back to newest first from page 1. `routeWithColumnOff` takes two parameters, so passing it to `reduce` is safe |
| Em-dashes in shipped copy | Grep of every added line | none |
| OpenPanel events, Google reads | Read of the diff | No new event, no new Google query |
| VoiceOver reading "×" as "times" | Not run | No screen reader in this environment. The epic names Nick's browser walk |

**Overall:** All five tickets do what their acceptance criteria ask, and every full check is green, the browser walk included. One MEDIUM finding gates the PR: since #242, the cards row's placeholder always holds the ratio line's place, but at zero engaged views no card has a second line, so the row drops by 46px when the answer lands. That is proved in Chrome against the built stylesheet. The rest is LOW: three new tests that pass at the base, duplicate tests and exact-markup assertions under `CODING_STANDARDS.md` 2, and comments that RPM made stale.

## Approach decisions
- How the cards row keeps its height around the ratio line (#242 review pass 1, `7d90054`): the ratio line (`.card .card-detail + .card-detail`) keeps the place of two smaller lines on any card, and `.placeholder-card` counts that place. Kept. Finding 1 extends it: the engaged views card keeps that place at zero engaged views too, as an empty `dd` hidden from screen readers, so the place is always there when the placeholder counts it.
- Where RPM sits: after Estimated revenue and before the sources in the numbers table (#244 assumption), after Other sources in the video list when the sources show (#264 assumption). Kept; recorded as deliberate in both tickets.
- The RPM sort's order of the partial and zero engaged views rules (#264 assumption): partial first, then zero engaged views. Kept.
- How the browser walk proves the cards row at zero engaged views (remediation of finding 1, `fb62e46`): the step `state: engaged views card as tall as its placeholder` also measures `/app/?format=live`, the Live summary of the screenshot stub's sample channel, which has no live video and so answers zero engaged views; `engagedViewsCardHeights` takes whether the path should show a ratio line and throws when the card disagrees. A later state of the cards row gets a path in that same list rather than a new step.

## Confirmed Issues
### 1. At zero engaged views the cards row is shorter than its placeholder, so it jumps when the answer lands — MEDIUM
- **Location:** `apps/web/src/app.css:1170-1176` (`.placeholder-card`, its `--ratio` term at `:1174`), with `apps/web/src/cards.ts:84-89` and `apps/web/src/Cards.tsx:58`
- **Attribution:** introduced by #242. At the base the placeholder counted the number and the views line only (`git show 41b2008:apps/web/src/app.css`, line 1163: `height: calc(2rem + 2px + 0.875rem * 1.6 + 0.25rem + var(--number) + 0.25rem + 0.9375rem * 1.4)`), which a zero engaged views card matched. `ec38e1d` added the ratio line's term and `7d90054` ("review pass 1 finding 1") widened it to the two-line `--card-ratio-place` (`git log --oneline -S'--card-ratio-place' 41b2008..HEAD`).
- **Real-world trigger:** a video's page for an older video with no engaged views over the window, such as Last 7 days on a small channel, or the channel summary filtered to Live on a channel that never streams. In both, no card on the row has a second smaller line: the engaged views card has no ratio line, and the revenue card has no RPM line at zero engaged views. The row is drawn at the placeholder's height while the answer loads, then drops by about 46px. Capped at MEDIUM as a display defect; the #242 review rated the same mechanism MEDIUM.

**Evidence** — the placeholder always counts the ratio line's place, and the card only has it with engaged views:
```css
  --views: calc(0.25rem + 0.9375rem * 1.4);
  --ratio: calc(0.25rem + var(--card-ratio-place));
  height: calc(2rem + 2px + 0.875rem * 1.6 + 0.25rem + var(--number) + var(--views) + var(--ratio));
```
```ts
  if (engagedViews === 0) return null
  ...
    ...(ratio === null ? {} : { ratio }),
```

**Failure mode** — at 1280px and at 800px, in headless Chrome against the built stylesheet: a row of an engaged views card at 0 with its views line, a watch hours card, and optionally a revenue card at $0.00 with no RPM line, measures 128.6px; its row of placeholders measures 174.6px. The same row with an empty `card-detail` after the views line measures 174.6px, as does the control row with the ratio line. The comment above `.placeholder-card` (`app.css:1166-1169`) states the card has the ratio line "whenever there are engaged views, so a row of cards is that tall", which is the false invariant. The browser walk's step cannot catch it, since it throws on a card with no ratio line (`browser-walk.ts:1899`).

**Recommended fix** — the engaged views card always answers its ratio, `null` at zero engaged views, and `Cards` renders `null` as an empty place:
```diff
--- a/apps/web/src/cards.ts
-  ratio?: RatioLine
+  ratio?: RatioLine | null
@@ engagedViewsCardOf
-  const ratio = ratioLineOf(views, engagedViews, locale)
   return {
     label: labels.engagedViews,
     text: engagedViews.toLocaleString(locale),
     detail: viewsLineOf(views, locale),
-    ...(ratio === null ? {} : { ratio }),
+    ratio: ratioLineOf(views, engagedViews, locale),
     chart: 'engagedViews',
   }
--- a/apps/web/src/Cards.tsx
             {detail && <dd className="card-detail">{detail}</dd>}
+            {ratio === null && <dd className="card-detail" aria-hidden="true" />}
             {ratio && (
```

**Remediation brief**
- **Design intent:** the cards row and its placeholder (`CardsPlaceholder`, three `.placeholder-card` in a `.cards` grid) must be the same height so the row does not move when the answer lands (creator-analytics#119, W24). The row's height is its tallest card. Since `7d90054` the second smaller line keeps a two-line place (`--card-ratio-place`) via `.card .card-detail + .card-detail`, and the placeholder counts number, views line and that place. The fix makes the place unconditional on the engaged views card, the one card that always has a views line, so the placeholder's count is always true for it.
- **Full surface:** `apps/web/src/cards.ts:23` (the `ratio` field's type; its JSDoc at `:19-22` must say that `null` keeps the line's place, empty, at zero engaged views), `apps/web/src/cards.ts:84-89` (`engagedViewsCardOf`), `apps/web/src/Cards.tsx:58` (render the empty place before the ratio branch), `apps/web/src/app.css:1166-1169` (the comment's "whenever there are engaged views" becomes "always, empty at zero engaged views"), `apps/web/src/cards.test.ts:55-58` (the second assertion becomes `toHaveProperty('ratio', null)`; the rule, no ratio line, holds), `apps/site/test/screenshot/browser-walk.ts:1884-1950` (the walk step: add the zero engaged views state, below). No other code reads `Card.ratio`: `git grep -n "ratio" -- apps/web/src ':!*.test.ts' ':!*.css'` finds only `Cards.tsx:25-62` and `cards.ts`.
- **Must preserve:** no visible ratio line and nothing read by a screen reader at zero engaged views (`components.test.ts:685` "at zero engaged views, the card has the views line and no ratio line" must stay green unchanged: its regex matches `<dd class="card-detail">` exactly, so the `aria-hidden` place is not counted); the ratio line's markup and placement on both screens (`components.test.ts:665`, `:669`); `ratioLineOf`'s null at zero (`cards.test.ts:55`); cards other than engaged views carry no `ratio` key and render no extra `dd` (the revenue and watch hours cards); the walk step's existing checks at 1280px and 800px on `/app/` and the newest video's page.
- **Do not touch:** the two-line `--card-ratio-place` and its `min-height` rule (`app.css:238`), which is `7d90054`'s fix and the recorded approach; the stacked layout below about 26rem, where three placeholders never matched the cards (pre-existing, outside this finding).
- **Proof:** red now: `pnpm build && sh docs/reviews/creator-analytics-238/repro/card-placeholder-zero-engaged-views.sh` exits 1 (its first two card sets model today's markup at zero engaged views; its third set models the fix and is already ok). Green after: extend the walk step `state: engaged views card as tall as its placeholder` with the path `/app/?format=live` (the screenshot stub's sample channel has no live video, so the summary answers zero engaged views), letting `engagedViewsCardHeights` accept a card with no ratio line on that path; `pnpm build && pnpm test:browser` is red before the code change and green after. Add one component markup test that the zero engaged views card holds an `aria-hidden` `card-detail` with no text.

### 2. Three new tests pass unchanged at the base, so they cannot tell the RPM behaviour from its absence — LOW
- **Location:** `apps/web/src/video-list.test.ts:1345`, `apps/web/src/video-list.test.ts:1315` (the `'?sort=rpm&window=first7'` row), `apps/web/src/numbers-table.test.ts:546`
- **Attribution:** introduced, by `14e8a85` (the two video list cases) and `485d85d` (the numbers table case). Neither commit fixed a review finding.
- **Real-world trigger:** none for users; a claim of coverage. Capped at LOW because the rules are pinned elsewhere: the RPM sort staying with Revenue on by `app.test.ts:808` "the RPM heading sorts the list by RPM", and the RPM fallback by the `'?sort=-rpm&page=3'` row of `video-list.test.ts:1315` and `app.test.ts:830`.

**Evidence** — at the base, `listRouteOf('?sort=-rpm&page=3')` parses to `{ sort: '-publishedAt', page: 3 }`, because `rpm` is no sort key there:
```ts
    const byRpm = listRouteOf('?sort=-rpm&page=3')
    expect(listRouteFor(byRpm, allOn, false)).toBe(byRpm)
```
```ts
    const unrated = [rated('2026-09-01', 0, 1), rated('2026-09-02', 0, 2)]
```

**Failure mode** — `video-list.test.ts:1345`: the identity holds for a route that never carried an RPM sort. `:1315`'s `rpm&window=first7` row: the parser drops the sort and there is no page to reset, so the expected route equals the parsed one at the base. `numbers-table.test.ts:546`: both days have no RPM, and an unknown sort column at the base falls back to newest first, the same order.

**Recommended fix** — in `:1345`, assert `expect(byRpm.sort).toBe('-rpm')` before the two identities. In the `:1315` table, change `'?sort=rpm&window=first7'` to `'?sort=rpm&window=first7&page=2'`. In `:546`, add a rated day: `[rated('2026-09-01', 0, 1), rated('2026-09-02', 0, 2), rated('2026-09-03', 1000, 5)]`, expecting `['Sep 3, 2026', 'Sep 2, 2026', 'Sep 1, 2026']` in both directions, and rename it for the rule: the days with no RPM run after the rated one, newest first, in either direction.

**Remediation brief**
- **Design intent:** the route parser (`route.ts:116-121`) drops a sort that is not in `videoSortKeys`, so any test of an RPM route must first show that the route carries the RPM sort. The numbers table's `compareValues` puts a null last in either direction and returns 0 for two nulls, so ties fall to newest first.
- **Full surface:** `apps/web/src/video-list.test.ts:1315-1330`, `:1345-1353`; `apps/web/src/numbers-table.test.ts:546-556`.
- **Must preserve:** every other row of the `:1315` table; the source sort assertions in `:1345`; `numbers-table.test.ts:537-544` (the sorted RPM column with one empty day).
- **Do not touch:** the absence-only tests that are green at base but pair with a red positive test (`video-list.test.ts:222`, `components.test.ts:685`, `:1342`, `:1370`, `:1590`, `:1723`) and the `-estimatedRevenue` row of `video-list.test.ts:1276`, which covers base behaviour that had no test. See Reviewed and Dismissed.
- **Proof:** copy each strengthened file into a scratch worktree at `41b2008` (`git worktree add --detach <scratchpad>/base 41b2008`, `pnpm install --frozen-lockfile`) and run `pnpm exec vitest run apps/web/src/video-list.test.ts apps/web/src/numbers-table.test.ts -t 'RPM'`: the three cases are red there, and green with `pnpm exec vitest run apps/web/src/video-list.test.ts apps/web/src/numbers-table.test.ts` at HEAD.

### 3. Duplicate tests and exact-markup assertions break the one-rule-one-test rule — LOW
- **Location:** `apps/web/src/components.test.ts:678`, `apps/web/src/numbers-table.test.ts:558`, `apps/web/src/numbers-table.test.ts:507`, `apps/web/src/tables.test.ts:22-30`, `apps/web/src/components.test.ts:1685-1686`, `:1719`, `:1583`, `apps/web/src/video-list.test.ts:1261`
- **Attribution:** introduced, by `ec38e1d` (`components.test.ts:678`), `485d85d` (the numbers table tests) and `14e8a85` (the rest).
- **Real-world trigger:** none for users; `CODING_STANDARDS.md` 2 ("A duplicate that covers a rule an existing test already covers", "an exact class string").

**Evidence and failure mode** — each is a rule stated twice, or an assertion on an implementation string:
- `components.test.ts:678` "hides the "×" sign from a screen reader" asserts the same two spans that `:665` and `:669` already assert through `toEqual(['1,920 views', ratioLine])`.
- `numbers-table.test.ts:558` "shows with the sources hidden or shown" asserts `toContain('rpm')`; the exact column lists at `:325` and `:336` already include `'rpm'` in both states.
- `numbers-table.test.ts:507` "is in the currency of the total, as the locale writes it" (de-DE `'4,57 €'`) repeats the de-DE RPM cells the modified revenue columns test asserts at `:392` and `:399`.
- "No line between Revenue and RPM" is stated three times: `tables.test.ts:22-30` (`startsColumnGroup`), `video-list.test.ts:198` (the lined columns of `listColumnsShownOf`) and `components.test.ts:1685` (`not.toContain('column-group-start')`, an exact class string; `:1719` likewise).
- `components.test.ts:1686` matches `/<button type="button" class="sortable-heading">RPM<span/`, an exact class string; `:1689`'s `aria-sort` test already shows the heading sorts.
- `components.test.ts:1583` builds its expected sentence with `newestAverageTextOf`, the helper the component calls. The rule is placement, and the text is pinned by `newest-average.test.ts`, so it fails safe, but it is the self-computed shape.
- `video-list.test.ts:1261` "the %s switch names the keys its headings sort by" pins `sortKeysOfColumn`'s array order; its rule is pinned by the route tests (`:1315`, `:1345`) and `app.test.ts:830`.

**Recommended fix** — delete `components.test.ts:678`, `numbers-table.test.ts:558`, `numbers-table.test.ts:507` and `video-list.test.ts:1261`. Keep the vertical-line rule in `video-list.test.ts:198` and `tables.test.ts:22-30` (one per unit) and drop the `column-group-start` assertions at `components.test.ts:1685` and `:1719`. Replace `:1686`'s regex with a check that the RPM `<th>` holds a `<button>`. At `:1583`, assert `expect(newestAverageTextOf(answer)).not.toBeNull()` before using it.

**Remediation brief**
- **Design intent:** one rule, one test, observed through rendered output or returned values, never through class names (`CODING_STANDARDS.md` 2).
- **Full surface:** the locations above, nothing in production code.
- **Must preserve:** `components.test.ts:665`, `:669`, `:685`; `numbers-table.test.ts:325`, `:336`, `:392`, `:399`, `:496`, `:518`, `:526`; `video-list.test.ts:198`; `tables.test.ts:22-30`; `components.test.ts:1689`; `app.test.ts:791`, `:808`, `:830`.
- **Do not touch:** `newest-average.test.ts:39`, `:54`, `:72`, which observe each format and window branch through its text (allowed by standard 2).
- **Proof:** `pnpm exec vitest run apps/web/src/components.test.ts apps/web/src/numbers-table.test.ts apps/web/src/tables.test.ts apps/web/src/video-list.test.ts` green, with the case count down by the deleted tests.

### 4. Comment hygiene — LOW (aggregated)
- `apps/api/src/video-list.ts:383-384` — "A revenue sort without revenue consent is refused with `consent_missing`." → "A revenue or RPM sort without revenue consent is refused with `consent_missing`."
- `apps/api/src/video-list.ts:419-420` — "A channel outside the program has no revenue to sort by, so every video ties and the list runs newest first." → "A channel outside the program has no revenue to sort by, so every video ties and the list runs newest first, an RPM sort still putting zero engaged views last."
- `apps/web/src/numbers-table.ts:21-25` — "Named here, not taken from the video list's revenue sorts, so a sort the list gains never becomes a column of this table." → "Named here, not taken from the video list's revenue sorts, so a revenue sort the list gains beyond the sources never becomes a column of this table."
- `apps/web/src/numbers-table.ts:88` — "The columns the table shows, in order: the day, then its numbers." → "The columns the table shows, in order: the day, its numbers, then the revenue columns with RPM when revenue shows."
- `packages/api-types/src/videos.ts:332-333` — "of the list's format (under `all`, of any format, those Google gives none too)" → "of the list's format (under `all`, any format, including uploads Google gives no format)"
- `apps/site/test/screenshot/browser-walk.ts:1918-1919` — "wraps on a card narrower than about 18rem, as two and three cards to a row are at 800px" → "wraps on a card narrower than about 18rem, as three cards to a row are at 800px" (a two-card row at 800px gives each card about 23rem; the step's own assertion only needs one wrapped case)

## Needs Further Investigation
### A. An upcoming public live stream or Premiere may count in the newest average with zero engaged views — confirm what Google answers for an upcoming broadcast
`newestAverageOf` (`apps/api/src/video-list.ts:360-366`) keeps `privacy === 'public' && !scheduled && !partial`. The gateway sets `scheduled` only for a private video with a `publishAt` (`packages/youtube-gateway/src/reads/uploads.ts:136`), so a public upcoming broadcast is not scheduled. If its playlist item's `videoPublishedAt` is set before it airs, then once that day is a window's length back it is not partial, and it counts as a complete upload with 0 engaged views, lowering the `all` and `live` averages. The glossary's Latest upload rule names scheduled videos as never counting. Confirm on Google's `videos` and `playlistItems` resource pages what `videoPublishedAt` and `snippet.liveBroadcastContent` hold for an upcoming broadcast. If it is set, the gateway needs to flag `liveBroadcastContent === 'upcoming'` and the rule should leave it out; the same pick rule feeds the extension's comparison row, so that would be pre-existing, exposed.

## Reviewed and Dismissed
- RPM sits in different places in the numbers table and the video list — deliberate, recorded in the #244 and #264 assumptions with their reasons.
- The average sentence shows the last answer's text while a new read is in flight — intended: `VideoListRows`' docstring and the #243 assumption that the answer echoes its format; the other notes behave the same.
- The numbers table's total RPM could differ from the revenue card — both read the same revenue and engaged views and format through `moneyTextOf` (`numbers-table.test.ts:518`).
- `reduce(routeWithColumnOff, route)` passes extra arguments — `routeWithColumnOff` takes two parameters (`route.ts:227`).
- Views below engaged views would read "0.x×" — YouTube's views are never below its engaged views (#242 assumption), and the spec names zero engaged views as the only case without a line.
- Outside the YouTube Partner Program every video's RPM is 0 and ties newest first — the #264 assumption, with zero engaged views still last.
- An upload awaiting processing, or with no publish day, enters the average — `isWindowFinished` makes it partial, so it is left out.
- Absence-only tests green at base (`video-list.test.ts:222`, `components.test.ts:685`, `:1342`, `:1370`, `:1590`, `:1723`) — each pairs with a positive test that is red at base, so each guards a real branch.
- `video-list.test.ts:1276`'s `-estimatedRevenue` row is green at base — new coverage of base behaviour that had no test; its `-rpm` row is red.

## Minor / nits
- `apps/web/src/newest-average.ts:36` writes N with Latin digits and X in the locale's; `count.toLocaleString(locale)` would match. The spec asks only for X in the locale's digits.
- `apps/api/src/video-list.ts:280` `isRevenueSortKey` now also admits `rpm`; `isConsentSortKey` would name what it checks.
- `packages/api-types/src/index.ts:95` still exports `revenueSortKeys`, which nothing outside `videos.ts` reads now.
- `apps/api/src/video-list.ts:363` `!video.scheduled` is redundant with `privacy === 'public'` given the gateway's rule (kept on purpose by the #243 assumption), and `video-list.test.ts:1872`'s scheduled fixture is also private, so the test does not pin the scheduled clause on its own.
- A multiple of 1,000× or more would wrap the ratio line to three lines on a 12rem card, past its two-line place. Implausible.
- The screenshot stub answers no `newestAverage` and has no partial-first rule in its sorts (the latter pre-existing for every metric). No screenshot is asked to show the sentence.

## Test quality
Tests added or with changed assertions: 83 · green against `$BASE` (assert nothing new): 8 · tautology shapes found: 3 green-at-base cases that cannot tell RPM from its absence (finding 2), 1 self-computed expectation (`components.test.ts:1583`, finding 3), 4 duplicates and 3 exact-markup assertions (finding 3). Per file, red / green at base: `apps/api/src/video-list.test.ts` 6/0, `apps/api/src/video-revenue.test.ts` 6/0, `apps/web/src/app.test.ts` 3/0, `apps/web/src/cards.test.ts` 5/0, `apps/web/src/channel-summary.test.ts` 2/0, `apps/web/src/components.test.ts` 14/3 (all 17 red as the file stands at base, since `newest-average.ts` is missing), `apps/web/src/newest-average.test.ts` 4/0, `apps/web/src/numbers-table.test.ts` 11/1, `apps/web/src/tables.test.ts` 1/0, `apps/web/src/video-detail.test.ts` 2/0, `apps/web/src/video-list.test.ts` 21/4. Six further cases only changed their names, with assertions identical to base. The green-at-base cases: finding 2's three, and five absence-only or base-behaviour cases kept per Reviewed and Dismissed. No mocked unit under test, snapshot, assertion-free or prose test was found.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and the suite are green at `502a58f`; the browser walk passes.
- **Commit hygiene:** the five lanes merged cleanly; nothing to drop. This review doc and its `repro/` script are the only additions.
- **Likely reviewer asks:** a VoiceOver check of the ratio line, and the card row at zero engaged views (finding 1), both in Nick's browser walk; an answer on item A.

## Verdict
Ready with follow-ups once finding 1 is fixed. The gate is finding 1, the cards row's 46px drop at zero engaged views, a regression of the row-height rule #242's own review pass set out to keep. Findings 2 to 4 are LOW test and comment hygiene that can go in the same remediation pass or a follow-up. Item A is a question for Google's documentation, and by the same pick rule as the extension's comparison row it is not this branch's to gate.

## Remediation — 2026-11-04
| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 1 (MEDIUM) | `fb62e46` creator-analytics#238 pre-PR review 1 finding 1: at zero engaged views the cards row is shorter than its placeholder, so it drops when the answer lands | red→green: `pnpm build && pnpm test:browser` (red before the code change: `/app/?format=live` at 1280px and 800px, card 128.6px against placeholder 174.6px; green after, 28 steps, no content security policy violation); `pnpm exec vitest run apps/web/src/cards.test.ts apps/web/src/components.test.ts` red (2 cases) before, green after. `repro/card-placeholder-zero-engaged-views.sh` still exits 1 by construction, since its first two sets model the old markup; its third set, the fix's markup, is ok | 4 new (the walk's note that the sample channel has no live video, and the component test's statement of its limits under `CODING_STANDARDS.md` 2); 7 more reword existing doc comments to stay true (`cards.ts` `ratio` and `engagedViewsCardOf`, the walk's `engagedViewsCardHeights`, the `.placeholder-card` comment in `app.css`) | proved by execution (MEDIUM, preserve suites green), no verify agent |
| 2 (LOW) | — deferred | — | — | LOW tail, deferred by the default scope (eng-pipeline#34) |
| 3 (LOW) | — deferred | — | — | LOW tail, deferred by the default scope (eng-pipeline#34) |
| 4 (LOW, comment hygiene) | — deferred | — | — | LOW tail, deferred by the default scope (eng-pipeline#34) |

Preserve suites after the round, at `fb62e46`: `pnpm lint` green (541 files), `pnpm typecheck` green, `pnpm build` green, `pnpm test` 125/125 files, 2850 passed, 1 expected fail (one more than the review's 2849: the new component case), `pnpm test:browser` passed. `components.test.ts` "at zero engaged views, the card has the views line and no ratio line" is green unchanged. Item A (Needs Further Investigation) is not a confirmed finding and was not worked.

### Known regressions, deferred
- None.

### Rework briefs
- None: no verify pass ran, so no rework.
