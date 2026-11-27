# Pre-PR review: creator-analytics#64 Web dashboard: key metrics together, a profile screen and saved preferences

**Branch:** `creator-analytics-64-web-dashboard-metrics-profile` vs `origin/main` (merge-base `6f9caa1` "Add weekly Dependabot version updates for npm and GitHub Actions")
**Reviewed at:** HEAD `60c0bff` ("creator-analytics#64 Write the partial label of a one-day window in the singular"), clean tree, no uncommitted or untracked files at review time. 188 files, +22,987 / −1,764 (4,890 of those lines are drizzle snapshot JSON), 406 commits across #64, #65 to #82, #110 and #119.
**Reviewed against:** epic nick-vogel/creator-analytics#64 (body as of 2026-10-11) and its sub-issues, `CODING_STANDARDS.md`, `CONTEXT.md`, ADR 0013, `docs/oauth-verification.md`, Nick's answers to the run's end report (walk items W1 to W36). Every child ticket was reviewed on its own lane; this review looks for whole-branch and cross-ticket defects. No prior review doc for #64; run with `--fresh`.
**Date:** 2026-10-11
**Reviewer:** 3 code-review agents, 1 test-audit agent, and a verify pass

## What was verified and how

| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | green, lockfile unchanged |
| Lint | `pnpm lint` | green (321 files) |
| Typecheck | `pnpm typecheck` | green, every package |
| Build | `pnpm build` | green |
| Full suite | `pnpm test` (Testcontainers Postgres), run 6 times, 5 of them back to back while the test-audit agent ran its own suites | green every time: 70 files, 1,338 tests |
| Flaky `video_not_found` test (`apps/api/src/video-detail.test.ts:1094`, stage 2 proposal) | 6 full runs above, plus a read of the uploads, cache and quota write path | not reproduced; the test is unchanged from `$BASE` (line 507 there). NFI B |
| Tautology audit | Branch tests copied into a scratch worktree at `6f9caa1` and run there | 1,202 tests: 816 red, 386 green. 330 of the green are unchanged from base; of the 56 new or modified green ones, 4 are real gaps (Finding 8), the rest are negative guards, regression cover or mechanical edits |
| Zero revenue display (Finding 1) | Executed: `pnpm exec vitest run --config docs/reviews/creator-analytics-64/repro/web-display.vitest.config.ts` | 2 of 2 red for Finding 1 (the card control test passes) |
| Sort on a switched-off column (Finding 2) | Executed: same command | 1 of 1 red |
| `?pageSize=10` vs a saved size, single-day hover x, route round trip, money formats (JPY, KRW, BHD, UZS), shares, RPM | Executed by an agent in a scratch vitest probe against the real modules | Findings 5 and 6; the rest hold |
| Preferences RLS, cascade, grants; migration 0015 `claim_channel` | Read: `0013_preferences.sql`, `0001_grants.sql` default privileges, `0015_claim_channel_disconnecting.sql` | hold |
| Cache keys vs value shapes | Read every changed gateway read against `$BASE` | hold: every changed shape has a new versioned key, every revenue key carries the currency |
| Tenancy, repeated query refusal, default window `last28`, visibility before paging, partial-after-complete | Read by agent | hold |
| Product events | `grep` of every `track(` call against README's event list and `landing.ts` | hold: names match, no id or email in any payload |
| Em-dashes in shipped copy | `git diff 6f9caa1 -- apps packages docs CONTEXT.md README.md \| grep '^+.*—'` | none |
| React state races, failed-save revert, StrictMode events | Read by agent | Findings 3 and 4; the list, summary and detail read guards and the failed-save revert hold |
| Live Google behaviour (403 reasons, zeros for non-partner channels) | Not run: no live Google call from a review | NFI A |
| Real browser (stacking, sticky bar, hover by touch) | Not run: no browser in a review; Nick's walk covers it | n/a |

**Overall:** The branch is in good shape. All four CI checks pass and the suite was stable across six runs. The epic's server rules hold: tenancy, row-level security on preferences, cache keys, windows, sorts, refusals and currency. So do its arithmetic rules and its event privacy. Two MEDIUM web defects should be fixed before the PR opens, and both are small and web-only. First, a channel that Google answers with zeros still shows "$0.00" everywhere except the revenue card. Second, the list can stay sorted by a column that is switched off. The rest are LOW and can ship as follow-ups.

## Approach decisions

- **No revenue reported (F1):** one predicate decides it, the one `revenueCardOf` already applies: some day of the span the card reads carries a non-zero `estimatedRevenue`. The view builders (`summaryViewOf`, and the detail screen's `detail*Of` helpers) apply it once. When it is false they strip the revenue from the days and the total and drop the currency note, so every downstream consumer follows through the existing `daysCarryRevenue` check with no change of its own: the charts, the chooser, the numbers table, the sources button and the Other sources note. Precedent: the `not_monetized` refusal already reaches those consumers the same way, by leaving revenue off the days and the total. The video list's half needs an API contract change and goes to a follow-up ticket.
- **Sort on a hidden column (F2):** `listRouteFor` resets a sort whose column is switched off, the same way `toggleColumn` does when the creator switches it off. It does this for watch hours and revenue only, because a narrow screen always shows views and its heading. Precedent: `listRouteFor` already resets a revenue sort without consent and a source sort with the sources hidden.

## Confirmed Issues

### 1. A channel Google answers with zeros still shows "$0.00" in the charts, the numbers table, the notes and the video list — MEDIUM

- **Location:** `apps/web/src/channel-summary.ts:85-120` (`summaryViewOf`), `apps/web/src/video-detail.ts:44-75` (`headlineOf`, `detailCurrencyNoteOf`, `detailTotalOf`), `apps/web/src/VideoDetail.tsx:70,102-103`, `apps/web/src/views-chart.ts:44-46` (`daysCarryRevenue`), `apps/web/src/cards.ts:87-89`; list half: `apps/api/src/video-list.ts:318-324`, `apps/web/src/video-list.ts:469-484`
- **Attribution:** Introduced. The revenue chart, the numbers table's revenue columns and the list's Revenue column are all new on this branch (#78, #80, #82). #119's W21 fix changed only the revenue card. #119's plan records the rest as a known gap ("W21 changes only the revenue card. For a channel outside the YouTube Partner Program the revenue chart, the numbers table's revenue columns and the list's Revenue column still show zeros."), and no ticket owns it.
- **Real-world trigger:** Nick's walk on 2026-10-10. A non-monetized channel with revenue consent got 200 and zeros from Google on every monetary read, not a 403 (W21). On that channel's summary, the revenue card says "YouTube reports no revenue for this date range. Revenue shows only for channels in the YouTube Partner Program." Below it, the revenue chart is a flat line labelled "$0.00", every revenue cell of the numbers table and its total row reads "$0.00", and the "Show revenue sources" button, the currency note and the "Other sources include..." note all show. On a narrow screen with the revenue card saved as the chart choice, the screen draws the flat revenue chart, but the card is a message and cannot be chosen or shown as chosen. In the video list, every row's Revenue cell reads "$0.00".

**Evidence** — the card applies the rule, and the charts and table check only that the key is present:
```ts
// apps/web/src/cards.ts:87
if (days.every(({ estimatedRevenue }) => !estimatedRevenue)) {
  return { label, text: revenueText.noRevenue, message: true }
}
// apps/web/src/views-chart.ts:44
export function daysCarryRevenue(days: ChartDay[]): boolean {
  return days.length > 0 && days.every((day) => 'estimatedRevenue' in day)
}
```

**Failure mode** — Executed. `docs/reviews/creator-analytics-64/repro/web-display.test.ts` feeds two days with every revenue field at 0. Results: the card is the message (control, passes), `metricChartsOf(days,'daily').revenue` is `{ line: 'M0,100 L100,100', top: 0 }` (red), and `viewsTableOf` columns include `estimatedRevenue` (red). An agent probe of the same input gives the hover card "$0.00" and a total row of "$0.00" in all four revenue columns.

**Recommended fix** — in the view layer, for the summary and the detail screen:
```diff
// apps/web/src/cards.ts
+export function revenueReportedIn(days: Pick<ChannelDay, 'estimatedRevenue'>[]): boolean {
+  return days.some(({ estimatedRevenue }) => !!estimatedRevenue)
+}
@@ revenueCardOf
-  if (days.every(({ estimatedRevenue }) => !estimatedRevenue)) {
+  if (!revenueReportedIn(days)) {
// apps/web/src/channel-summary.ts, summaryViewOf
-  const answered = !('refusal' in revenue)
+  const answered = !('refusal' in revenue) && revenueReportedIn(revenueDays)
@@
-    daily: body.daily,
+    daily: answered ? body.daily : body.daily.map(withoutRevenue),
```
Here `withoutRevenue` drops `estimatedRevenue`, `estimatedAdRevenue` and `estimatedRedPartnerRevenue` from a day. `noFormatNote`, `currencyNote` and `total` already key on `answered`. On the detail screen, apply the same predicate over `answer.days`. Add a `detailDaysOf(answer)` beside `detailTotalOf` and `detailCurrencyNoteOf`, and use it for both `useChartChoice` (`VideoDetail.tsx:70`) and `MetricCharts` (`VideoDetail.tsx:102`). Make `detailTotalOf` and `detailCurrencyNoteOf` return the no-revenue form when the predicate is false.

**Remediation brief**
- **Design intent:** The API puts revenue on the days and the total exactly when the revenue part answered. Every web consumer keys on that through `daysCarryRevenue` or `total.currency`. Google answers a non-partner channel with zeros as often as with a 403, and no API says which channel is which. So the card's rule decides it: no day with non-zero revenue in the span the card reads means "no revenue reported". For one format's summary, that span is the channel's revenue in every format (`everyFormatRevenue`), never that format's own days. The fix makes the views agree with the card by removing revenue before it reaches the consumers, never by teaching each consumer the rule.
- **Full surface:** `apps/web/src/cards.ts:87` (extract the predicate); `apps/web/src/channel-summary.ts:94-120` (`revenueDays` already computed at :96-99; `answered` at :106; `daily` at :113); `apps/web/src/video-detail.ts:52` (`headlineOf` passes `days`), `:60-75` (`detailCurrencyNoteOf`, `detailTotalOf`); `apps/web/src/VideoDetail.tsx:68,70,102-103`. Consumers that must then follow with no edit: `apps/web/src/metric-charts.ts:93-99,136-141`, `apps/web/src/numbers-table.ts:152`, `apps/web/src/MetricCharts.tsx:83-84,294`, `apps/web/src/NumbersTable.tsx:79`. The Since publish table (`apps/web/src/since-publish.ts:96-98`) shows a revenue column whenever `revenueCurrency` is set. Give it the same rule over its own rows (some stage with non-zero revenue), not the window's, because a video can earn nothing in `last7` and still have lifetime revenue.
- **Out of this finding's scope (follow-up ticket):** the video list. Its answer carries no channel-level "no revenue" signal. `apps/api/src/video-list.ts:318-324` gives every row `noRevenue` zeros with `revenueCurrency`, and `revenueNoteOf` and `sourcesButtonShownOf` (`apps/web/src/video-list.ts:469-484`) react only to `not_monetized`. The fix there is an API contract change: when no upload has a revenue row, the answer says so, and the web shows `revenueText.noRevenue` the way it shows the `not_monetized` note.
- **Must preserve:** A monetized channel filtered to a format that earned nothing (Live on a channel that never streams) keeps its revenue card amount and draws real zeros, because `revenueDays` there is `everyFormatRevenue`. This is #119 review pass 3 finding 6, pinned in `apps/web/src/channel-summary.test.ts`. The `not_monetized` and `consent_missing` cards are unchanged (`apps/web/src/cards.test.ts`). The card's no-revenue text is approved word for word (W21). The numbers table's total row stays YouTube's total, never a sum (`apps/web/src/numbers-table.test.ts`).
- **Do not touch:** the 403 to `not_monetized` mapping in `packages/youtube-gateway/src/youtube-gateway.ts:268-272` (NFI A). Also the video detail card's no-revenue text for a video that earned nothing, which is approved (Dismissed).
- **Proof:** `pnpm exec vitest run --config docs/reviews/creator-analytics-64/repro/web-display.vitest.config.ts -t "finding 1"` is red now and must be green after the fix. Also add red-first unit tests in `apps/web/src/channel-summary.test.ts` and `apps/web/src/video-detail.test.ts`: a summary answer with every revenue field 0 gives `daily` days with no `estimatedRevenue` key, a `total` with no `currency`, and `currencyNote` null.

### 2. The video list can stay sorted by a column that is switched off — MEDIUM

- **Location:** `apps/web/src/video-list.ts:445-452` (`listRouteFor`), call site `apps/web/src/VideoList.tsx:284`
- **Attribution:** Introduced (#75 heading sort, #77 optional columns, #119 W33). At `$BASE` the list had no optional columns.
- **Real-world trigger:** The creator sorts by Watch hours, then presses "Reset preferences" on the profile. The reset switches the Watch hours column off but leaves `sort=-estimatedMinutesWatched` in the address (`routeWithoutPreferences` touches only chart, card, page size and visibility). Back on the list, the rows stay ordered by watch hours, no column shows them, and the live region still says "Watch hours, highest first". A bookmark or a Back entry with a watch hours or revenue sort does the same once that column is off.

**Evidence**
```ts
export function listRouteFor(route: Route, revenueConsented: boolean, sourcesShown: boolean): Route {
  if (!revenueConsented) return routeWithSourcesOff(routeWithColumnOff(route, 'estimatedRevenue'))
  return sourcesShown ? route : routeWithSourcesOff(route)
}
```
Only `toggleColumn` (`apps/web/src/VideoList.tsx:338-347`) resets a sort when its column goes off.

**Failure mode** — Executed: `listRouteFor(listRouteOf('?sort=-estimatedMinutesWatched&page=2'), true, false).sort` is `-estimatedMinutesWatched` (repro test "finding 2", red).

**Recommended fix**
```diff
-export function listRouteFor(
-  route: Route,
-  revenueConsented: boolean,
-  sourcesShown: boolean,
-): Route {
-  if (!revenueConsented) return routeWithSourcesOff(routeWithColumnOff(route, 'estimatedRevenue'))
-  return sourcesShown ? route : routeWithSourcesOff(route)
-}
+export function listRouteFor(route: Route, switches: ColumnSwitches, sourcesShown: boolean): Route {
+  const sorted = (['watchTime', 'revenue'] as const).reduce((each, column) => {
+    const key = sortKeyOfColumn(column)
+    return switches[column] || !key ? each : routeWithColumnOff(each, key)
+  }, route)
+  return switches.revenue && sourcesShown ? sorted : routeWithSourcesOff(sorted)
+}
```
and at `apps/web/src/VideoList.tsx:284`: `listRouteFor(addressRoute, switches, sources)`.

**Remediation brief**
- **Design intent:** The list reads the address's route through `listRouteFor`, which replaces a sort the screen cannot show with newest first from page 1. It does not rewrite the address. `listColumnsOf(saved, consented)` already forces `switches.revenue` off without revenue consent, so the switches carry the consent rule and the `revenueConsented` argument becomes redundant.
- **Full surface:** `apps/web/src/video-list.ts:439-452` (the function and its doc comment), `apps/web/src/VideoList.tsx:284`, and the tests at `apps/web/src/video-list.test.ts:1008-1041`, rewritten to the new signature with the same cases.
- **Must preserve:** The old behaviour, case by case. Without consent, a revenue or source sort runs newest first from page 1 (`video-list.test.ts:1009-1022`). With consent and the sources shown, a revenue or source sort stays, and the same route object is returned (`toBe`, `:1025-1030`). With the sources hidden, a source sort resets (`:1032-1035`). Any other sort stays, as the same object (`:1037-1041`). A **views** sort stays whatever the views switch says, because a narrow screen always shows the views column and its heading (`shownOf`, `apps/web/src/video-list.ts:350-366`). With `channel === null` the address route passes through unchanged (`VideoList.tsx:284`).
- **Do not touch:** `toggleColumn`'s own reset (`VideoList.tsx:338-347`). It also navigates, so the address loses the sort, which is still wanted.
- **Proof:** `pnpm exec vitest run --config docs/reviews/creator-analytics-64/repro/web-display.vitest.config.ts -t "finding 2"` is red now. After the fix, its call no longer matches the signature, so the remediator writes the red-first case in `apps/web/src/video-list.test.ts`: `listRouteFor(listRouteOf('?sort=-estimatedMinutesWatched&page=2'), { views: false, watchTime: false, revenue: true }, true)` gives `sort: '-publishedAt', page: 1`. Add a second case for a views sort with views off, which stays.

### 3. A preference changed before the first preferences read lands is overwritten on screen — LOW

- **Location:** `apps/web/src/App.tsx:216-226`
- **Attribution:** Introduced (#72, with #119's failed-save tracking).
- **Real-world trigger:** On a slow connection, the creator flips a Columns switch or picks a currency on the profile before `GET /api/me/preferences` answers. The controls render and work from the first paint (`screenShown` includes `channelWaiting`; `VideoList.tsx` "Its controls show from the first render"). The GET then lands with the old values, `setSaved(read)` puts the switch back, and the PUT succeeds anyway. The server holds the new value while the screen shows the old one until the next visit. Columns, revenue sources and currency have no address key, so nothing masks it.

**Evidence**
```ts
readPreferences().then(
  (read) => {
    confirmed.current = read
    setSaved(read)
  },
```
**Failure mode** — Proved by reading. `save` sets `saved` to `{...null, ...change}` before the read; the read's `setSaved(read)` replaces it outright.

**Recommended fix**
```diff
   (read) => {
-    confirmed.current = read
-    setSaved(read)
+    confirmed.current = { ...read, ...confirmed.current }
+    setSaved((current) => ({ ...read, ...current }))
   },
   (reason: unknown) => {
     showError(reason)
-    setSaved({})
+    setSaved((current) => current ?? {})
   },
```
**Remediation brief**
- **Design intent:** `saved` is the screen's view of the preferences, and `confirmed` is what the server last acknowledged. A failed save reverts to `confirmed`. A local change made before the first read is newer than the read, so it wins in both.
- **Full surface:** `apps/web/src/App.tsx:216-226` only.
- **Must preserve:** With no local change, the read sets `saved` and `confirmed` to exactly the read (`current` is null). A failed read still ends the wait with the defaults. The failed-save revert (`preferencesAfterFailedSave`, `saveTracker`, pinned in `apps/web/src/preferences.test.ts`) is unchanged.
- **Do not touch:** `writeQueue` serialisation.
- **Proof:** App has no DOM test seam (CODING_STANDARDS 2, no component tests). If the merge moves into a pure helper in `apps/web/src/preferences.ts`, test that helper red-first. Otherwise the proof is a browser check: throttle the network in devtools, flip a column before the preferences request finishes, and the switch stays on.

### 4. The failed-save notice outlives "Reset preferences" and sign-out — LOW

- **Location:** `apps/web/src/App.tsx:302-317` (`resetPreferences`), `:319-322` (`signOut`), `:342-346` (notice render), `:363-366` (profile notice choice)
- **Attribution:** Introduced (#119 W13).
- **Real-world trigger:** A currency save fails on the profile, then the creator presses "Reset preferences". The address carries no preference key, so it does not change and `failedSave` is not cleared. The notice "Your change did not save. Try again." stays under Currency after a reset that cleared that preference, and it hides the reset's own notice, because the currency notice wins the `notice` prop. Separately, a save fails, then the creator signs out from the avatar menu: the signed-out screen shows the failed-save notice, because the render is not gated on the session.

**Evidence**
```tsx
{failedSaveOnView && !(route.profile && failedSaveOnView.place === 'currency') && (
  <p role="status" className="status-notice">{failedSaveNotice}</p>
```
**Recommended fix** — `setFailedSave(null)` in `resetPreferences` after `setSaved({})`, and gate the render at `:342` on `session.state === 'signed-in'`.
**Remediation brief**
- **Design intent:** A failed-save notice belongs to the address it was raised on, until the route changes or a later save of the lost values succeeds (`failedSaveOn`, `failedSaveAfterSuccessOf`). A reset clears every preference, so nothing is lost any more. A signed-out screen has no preferences.
- **Full surface:** `apps/web/src/App.tsx:306` (after it), `:342`.
- **Must preserve:** The notice for a failure followed by a route change (`apps/web/src/preferences.test.ts`, the `failedSaveOn` cases), and `deleteYourself`'s signed-out notice (`SignedOut notice`).
- **Proof:** browser check, as Finding 3. If the clearing moves into a pure helper, test it red-first.

### 5. An address with `pageSize=10` loses to a saved page size — LOW

- **Location:** `apps/web/src/route.ts:139-146` (`routePageSizeOf`), `:51` (Route doc), `:184`, `:212-218`
- **Attribution:** Introduced (#75).
- **Real-world trigger:** Only a hand-typed or hand-edited address. A creator with 25 saved opens `/app?pageSize=10` and gets 25. The app never writes `pageSize=10` itself, so its own links are consistent. This breaks the spec's "An address that carries a value wins over my preference for that view". Visibility gets this right: `searchOf` writes it "the default included".
- **Failure mode** — Executed by agent probe: `listRouteOf('?pageSize=10')` has no `pageSize`, and `pageSizeOf(route, { pageSize: 25 })` is 25.
- **Recommended fix** — treat `pageSize` like `visibility`. `listRouteOf` keeps any valid size, 10 included, `routeWithControl` keeps the chosen size, and `routePageSizeOf` goes. Update the Route doc at `:51`.
- **Remediation brief**
  - **Design intent:** address beats preference beats default, for every preference the address can carry (`settingOf`).
  - **Full surface:** `apps/web/src/route.ts:51,124,133,144-146,212-218`, and the tests that pin the old rule, `apps/web/src/route.test.ts:137-141` (`?pageSize=10` drops) and any `routeWithControl` case that expects 10 to leave the route.
  - **Must preserve:** invalid sizes (`20`, empty, `025`) are still dropped (`route.test.ts:137`). `searchOf({...defaultRoute, pageSize: 25})` is still `?pageSize=25` (`:199`).
  - **Proof:** red-first `listRouteOf('?pageSize=10').pageSize === 10` in `apps/web/src/route.test.ts`.

### 6. On a one-day chart the hover line and card sit at the left edge of a full-width line — LOW

- **Location:** `apps/web/src/views-chart.ts:76-78` (`dayXOf`), `:101`
- **Attribution:** Introduced (#74 hover, #82 stacked charts).
- **Real-world trigger:** Every video's "Publish day" (`first1`) window on the detail screen has one day. `pathOf` draws that day across the whole plot (`M0,y L100,y`), but its hover point is at `x: 0`, so the hover line (`ChartHover.tsx:169`, `x1={x * 100}`) and the card anchor at the far left.
- **Recommended fix** — `dayXOf(index, count)` returns `0.5` when `count === 1`. `pathOf` calls it with two points for one day, so the line is unaffected.
- **Remediation brief**
  - **Full surface:** `apps/web/src/views-chart.ts:76-78`; nothing else calls `dayXOf`.
  - **Must preserve:** the line's path for one day (`views-chart.test.ts` single-day path cases), and every multi-day x.
  - **Proof:** red-first in `apps/web/src/views-chart.test.ts`: one day gives `points[0].x === 0.5`.

### 7. The OAuth verification video script still walks the old dashboard — LOW

- **Location:** `docs/oauth-verification.md:159-165`
- **Attribution:** Introduced. These rows were rewritten on this branch and still describe screens the branch removed.
- **Real-world trigger:** #34 records the verification video from this table. Row 6 says the app is "showing the signed-in email", but the header now shows the email's first letter, and the email appears only inside the avatar menu. Row 7 says "The channel listed by its name, then a click on the link", but the dashboard no longer lists channels: the list and its YouTube link are on `/app/profile`. Row 9 says "Pick 'First 7 days after publish' in the Window control" and "its views chart", but the control is "Date range" in the sticky bar, and there are three charts. Rows 10 and 12 put "Give revenue consent" and the consent date "on the channel", but both live on the profile screen (or the revenue card's button).
- **Recommended fix** — Rewrite rows 6, 7, 9, 10 and 12. Open the avatar menu to show the email, open Profile to show the channel by name with its YouTube link, rename the control "Date range", and name the three charts.
- **Remediation brief**
  - **Full surface:** `docs/oauth-verification.md:159,160,162,163,165`.
  - **Must preserve:** the scope, `login_hint` and `prompt` claims, which match `packages/token-vault/src/token-vault.ts:604-608`.
  - **Proof:** read the rows against `apps/web/src/Header.tsx`, `apps/web/src/Profile.tsx` and `apps/web/src/controls-bar.ts:8`.

### 8. Four new or renamed tests do not separate the rule they name — LOW

- **Location / shape:**
  - `apps/api/src/video-detail.test.ts:469`: renamed from "three days" to "four days", body unchanged. Its fixtures (published 2026-10-05 and 2026-08-01) answer the same under both floors.
  - `apps/api/src/video-list.test.ts:1227`: the same rename, with fixtures 2026-06-29 and 2026-10-05.
  - `apps/api/src/video-detail.test.ts:965` "the stages answer the same in every window": passes when `sincePublish` is absent, because `[undefined, undefined]` equals `[undefined, undefined]`.
  - `apps/web/src/components.test.ts:108`: `indexOf(notice) < indexOf('Account')` passes when the notice is absent (-1).
  - Identity shapes: `apps/web/src/preferences.test.ts:275-277,288` build the expected route with `routeAfterFailedSave` and `addressOf`, the helpers under test.
- **Attribution:** Introduced.
- **Why LOW:** the four-day floor itself is pinned in `apps/api/src/channel-summary.test.ts:244-285`, and other detail tests assert `sincePublish.rows`. So these are names that claim more than their test shows (CODING_STANDARDS 2), not missing coverage.
- **Recommended fix:**
  - Add a video published 2026-10-04 to `:469` and `:1227`. It awaits processing on the branch and not at `$BASE`.
  - Add `expect(answers[0]?.rows).toHaveLength(7)`, or a literal stage list, to `:965`.
  - Assert `toContain` before the index comparison at `components.test.ts:108`.
  - Use literal routes and addresses at `preferences.test.ts:275-288`.
- **Proof:** each strengthened test goes red when its fixture is reverted to the old one, or its production rule is reverted.

### 9. Comment hygiene — LOW (aggregated)

- `packages/youtube-gateway/src/reads/channel-metrics.ts:41-42` — "A read of every format keeps the key it had before a read could take a format, so the cache rows written then still answer it." → "A read of every format carries no format in its key." (both callers pass a `:v2` read name, so no older row answers)
- `apps/web/src/app.css:1382-1384` — "which the collapsed borders would otherwise join" → "which the separate borders would otherwise stack" (the table sets `border-collapse: separate` at `:1094`)
- `apps/web/src/channel-picker.ts:17-18` — "with the window, sort, format and chart mode kept" → "with the list's controls and chart choices kept"
- `apps/web/src/route.ts:352-353` — "a chart mode it does not know is dropped" → "a value it does not know is dropped"
- `apps/web/src/VideoList.tsx:262-263` — "With no channel yet, while the channels are read" → "With no channel yet, while the channels or the preferences are read"
- `apps/web/src/AccountMenu.tsx:93` — "a failed request leaves it" → "a request that never reaches the server leaves it" (`signOut` ignores an HTTP error status)

## Needs Further Investigation

### A. Every 403 on a monetary read becomes a cached `not_monetized` — confirm with Google's 403 reasons
`packages/youtube-gateway/src/youtube-gateway.ts:268-272` maps any 403 on a monetary read to `not_monetized`, cached for 6 hours, with the log suppressed. If the Analytics API answers a partner channel with a 403 for quota or rate limits (`quotaExceeded`, `rateLimitExceeded`), revenue would show "not in the YouTube Partner Program" for 6 hours. Nobody has seen a real `not_monetized` 403 yet: Nick's non-partner channel got 200 and zeros (W21), so the reason that would tell the cases apart is unknown. This is #78 proposal 25. It would be confirmed by Google's documented error reasons for `reports.query`, fetched from developers.google.com, or by a logged 403 body. Until then, MEDIUM, capped.

### B. The flaky `video_not_found` test
`apps/api/src/video-detail.test.ts:1094` failed once in stage 2 and passed in six full runs here. The test is unchanged from `$BASE`. An agent traced the cold-cache path and found no race that answers other than 404. Three concurrent requests serialise on the `quota_usage` row lock in `spend`, and their `read_cache` writes are `ON CONFLICT DO UPDATE` upserts. The remaining candidates are Better Auth session writes under concurrent requests and pool exhaustion. To settle it, loop the file under full-suite load and keep the failing output.

## Reviewed and Dismissed

- Traffic source share uses the sum of the sources as its denominator — the epic defines a share as one source's engaged views "divided by the video's engaged views across all sources".
- The video detail's revenue card says "YouTube reports no revenue..." for a video that earned nothing in a window — Nick approved it word for word for the video card too (W21, "Same rule for a video's revenue card").
- `processedThroughOf`'s four-day floor can end a calendar window on a day Google has not processed — intended and documented (#119 review pass 3 F3.1, the floor is pinned in `channel-summary.test.ts:244-285`).
- `lastProcessedDay` sends one more metric under an unchanged key — the value shape is unchanged and expires in 6 hours. Stage 2's cache key check already judged it.
- The charts placeholder reserves the sources button by the saved choice — its doc comment states the compromise.
- A zero-width plot gives NaN in `positionOf` — `nearestIndexOf` answers null and no card shows; no crash.
- React `style` props versus CSP `style-src 'self'` — the app is client-rendered, so styles go through CSSOM, and `web.test.ts:678-685` states that limit.
- Preferences RLS, cascade and grants; `claim_channel` 0015; tenancy on every channel route; repeated query refusal on all three routes; visibility before paging; cache keys and currency in keys — read and hold.
- A race behind the three-request `video_not_found` test — none found (NFI B).

## Minor / nits

- `signOut` (`apps/web/src/App.tsx:319-322`) treats an HTTP error as signed out and leaves a network rejection unhandled. Pre-existing, untouched (same code at `$BASE`).
- Two changes overlap a reset: a change made while the reset's DELETE is in flight is wiped from the screen by `setSaved({})` and `routeWithoutPreferences`, while its PUT still lands.
- A Columns switch or the sources button within the 300 ms row-click wait does not cancel the pending open (`apps/web/src/video-list.ts:589-617` cancels only on an address change or a second row).
- The Since publish table keeps a revenue sort if `revenueCurrency` disappears while it stays mounted (`apps/web/src/since-publish.ts:79-85`); reachability unverified.
- The video list answers `revenueCurrency` when it made no revenue read at all: zero uploads, or an after-publish window with nothing published yet (`apps/api/src/video-list.ts:305-316`).
- For a video awaiting processing, `readSincePublish` attaches zero revenue in `lifetime` but not in `last28` (`apps/api/src/since-publish.ts:121-124`), against its "same in every window" doc.
- `GET /api/channels/connect/after-sign-in` writes a consent state on a GET. A cross-site navigation only reaches the victim's own Google consent screen.
- `spend` holds the global `quota_usage` row lock across later Google calls, serialising cold reads across users. Pre-existing, untouched.
- Accessibility: `SincePublishTable.tsx:34` has an empty `<td />` corner heading cell. `RevenueSourcesButton.tsx:14` uses `aria-expanded` with no `aria-controls` (`aria-pressed` fits). Check that the avatar's accessible name (`AccountMenu.tsx:69`) contains the visible letter (WCAG 2.5.3).
- The web app's controls show their defaults while the preferences are read, then jump to the saved values.

## Test quality

1,202 branch tests in 45 files were run against `$BASE`: 816 red, 386 green.
- 330 of the green tests are unchanged from base.
- Of the 56 new or modified green tests, 4 are real gaps (Finding 8). The rest are negative guards whose positive partners are red at base, regression cover for behaviour base had, or mechanical edits (explicit `window: 'lifetime'` after the default moved to `last28`).
- No snapshots, no mocks of a unit under test, no call-shaped-only assertions, and no assertion-free tests were found.
- Most new stylesheet tests in `apps/web/test/web.test.ts` read `src/app.css` as text and restate one literal (for example `:276-277`, `:320`, `:401-408`). They act as change detectors with no rendered effect behind them. The file's header records that no stylesheet evaluator exists, and Nick kept that approach (#74 F3.8), so this is not a finding.

## Before opening the PR

- **CI readiness:** lint, typecheck, build and the full suite are green at `60c0bff`.
- **Commit hygiene:** commit this doc and `docs/reviews/creator-analytics-64/repro/`. `.epic-loop/` and `docs/HANDOFF-*.md` are excluded by `.git/info/exclude` and stay out.
- **Follow-up tickets:**
  - the video list half of Finding 1, an API contract change;
  - NFI A, the 403 reason;
  - NFI B, the flaky test;
  - the LOW findings not fixed in this round.
- **Likely reviewer asks:**
  - The three migrations (0013 to 0015) and their RLS.
  - The PR touches `apps/site/privacy.html`, which `creator-analytics-3` also changes (W14), so the merge needs a look.
  - The size: 406 commits. Squash or keep is Nick's call.

## Verdict

**Not ready as-is; ready once Findings 1 (summary and detail screens) and 2 are fixed.**

- Both are MEDIUM and web-only. Each has an executed red repro, and each is a few lines in the view layer.
- No CRITICAL or HIGH finding was confirmed.
- The video list half of Finding 1, Findings 3 to 9, and NFI A and B can ship as follow-up tickets.

## Remediation: 2026-10-11

Scope: every confirmed finding, the LOW tail included (epic-loop rule: a round with a MEDIUM-or-higher finding fixes every confirmed finding). Full checks after the round: `pnpm lint`, `pnpm typecheck`, `pnpm build` green; `pnpm test` green, 70 files, 1,351 tests (1,338 at review).

| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 1 (MEDIUM) | `f89e7db` finding 1: Show no revenue in the charts, table and notes when YouTube reports none | red→green: new cases in `apps/web/src/channel-summary.test.ts`, `apps/web/src/video-detail.test.ts`, `apps/web/src/since-publish.test.ts`; `pnpm exec vitest run --config docs/reviews/creator-analytics-64/repro/web-display.vitest.config.ts -t "finding 1"` green | 0 (3 existing doc lines corrected) | fixed (agent) |
| 2 (MEDIUM) | `966a665` finding 2: Sort the list newest first when its sort's column is switched off; `41dd4a3` repro formatting | red→green: "the route the list reads" in `apps/web/src/video-list.test.ts`; repro `-t "finding 2"` green | 0 (existing doc rewritten, +1 line) | proved by execution |
| 3 (LOW) | `6e63651` finding 3: Keep a preference changed before the first preferences read lands | red→green: "the preferences once the first read lands" in `apps/web/src/preferences.test.ts` (pure helper `preferencesAfterRead`); App wiring not executable (no App render seam) | 3 (the helper's why, and the test file's limits line) | fixed (agent) |
| 4 (LOW) | `ec8557a` finding 4: Clear the failed-save notice on Reset preferences and hide it when signed out | not executable: no App render seam; browser check per the brief | 0 | fixed (agent) |
| 5 (LOW) | `814c59f` finding 5: Let an address with pageSize=10 win over a saved page size | red→green: `listRouteOf('?pageSize=10')` and `routeWithControl` cases in `apps/web/src/route.test.ts`, `pageSizeOf` case in `apps/web/src/preferences.test.ts` | 0 (existing docs corrected) | proved by execution |
| 6 (LOW) | `caaacc6` finding 6: Put a one-day chart's hover point in the middle of its line | red→green: one-day point in `apps/web/src/views-chart.test.ts`; `apps/web/src/metric-charts.test.ts` shared-axis case also pinned x 0 (missed by the brief's surface) and moved with it | 0 (existing doc corrected) | proved by execution |
| 7 (LOW) | `d5c275d` finding 7; rework `1601ec7`; rework follow-up `99b456f` | read against `AccountMenu.tsx`, `Profile.tsx`, `controls-bar.ts`, `windows.ts`, `metric-charts.ts` | n/a (docs) | half-fixed, then fixed after rework (scoped re-verify) |
| 8 (LOW) | `4df73c0` finding 8: Make four tests separate the rule they name | the two four-day tests went red with `processedThroughOf`'s floor set to three days (reverted); the others assert literals or presence | 0 | proved by execution |
| 9 (LOW, comment hygiene) | `2efcea5` finding 9: Correct six comments that drifted from their code | read against the code each describes | n/a (corrections only) | excluded from verify |

Out of scope, recorded as a stage 2 proposal: the video list half of Finding 1 (an API contract change).

The repro at `docs/reviews/creator-analytics-64/repro/web-display.test.ts` was updated. Its finding 1 cases now feed the charts and table what `summaryViewOf` hands them, since the fix strips revenue in the view builder rather than in each consumer, and its finding 2 case uses the new `listRouteFor` signature. It sits outside the root vitest include, so only its own config runs it.

### Known regressions, deferred
- None. The one introduced defect (row 9 of `docs/oauth-verification.md` promised an "Estimated revenue" chart before revenue consent, introduced by `d5c275d`) was reworked in `1601ec7`, and the scoped re-verify's one-line wording nit ("given in row 10" to "given in rows 10 to 12") was applied in `99b456f`.

### Notes from verification, not defects
- Finding 1: with an answered revenue and an empty `daily` (all formats), the currency and no-format notes are now null. The card already read "no revenue" there.
- Finding 1: on the detail screen, a monetized channel's video that earned nothing in the window loses its zero revenue chart, matching its card. The "keep real zeros" rule covers only one format's summary, by design.
- Finding 3: "Reset preferences" while the first read is still in flight is still overwritten by that read. Pre-existing and reachable only on a very slow read.

### Rework briefs
- Finding 7, row 9: name only the charts a viewer sees before revenue consent ("Engaged views and views" and "Watch hours"), and say the revenue chart joins once consent is given. Preserve the rest of row 9 and every scope, `login_hint` and `prompt` claim. Proof: read against `chartsDrawnOf` (`apps/web/src/metric-charts.ts`) and the shot order, where consent runs from row 10 to row 12.

## Approach decisions (remediation round 1)
- **No revenue reported (F1):** `revenueReportedIn` in `apps/web/src/cards.ts` is the one predicate, shared by the card. `withoutRevenue` strips the three revenue amounts from a day. The summary applies it in `summaryViewOf` over the card's span, and the detail screen applies it through `revenueShownOf` in `apps/web/src/video-detail.ts` (`detailDaysOf`, `detailTotalOf`, `detailCurrencyNoteOf`). The since publish table applies it over its own stage rows. Precedent: the `not_monetized` refusal reaching consumers by leaving revenue off the days and the total.
- **Sort on a hidden column (F2):** `listRouteFor(route, switches, sourcesShown)` takes the column switches in place of the consent flag. Before the preferences land, VideoList gets no channel, so the address route passes through untouched. Precedent: `toggleColumn`.
- **First read vs local change (F3):** `preferencesAfterRead(read, local)` merges the read under the local values, for both `saved` and `confirmed`. Precedent: `preferencesAfterFailedSave` as the pure helper behind App's preference state.
- **Page size in the address (F5):** the same as the visibility. Any valid size, the default included, stays in the route and the address.
