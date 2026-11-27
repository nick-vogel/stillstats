# Pre-PR review: creator-analytics#64 Web dashboard: key metrics together, a profile screen and saved preferences

**Branch:** `creator-analytics-64-web-dashboard-metrics-profile` vs `origin/main` (merge-base `6f9caa1` "Add weekly Dependabot version updates for npm and GitHub Actions")
**Reviewed at:** HEAD `153408d` ("creator-analytics#64 pre-PR review 3 remediation closure table"). The tree was clean, with no uncommitted or untracked files at review time. Whole branch: 246 files, +33,361 / −1,918, 588 commits. Those totals include review docs 1 to 3, their repros, and 4,890 lines of drizzle snapshot JSON.
**Delta under review:** since `e011005` ("creator-analytics#61 Bring the privacy policy up to date with what the product reads"), the HEAD that `pre-pr-review-3.md` reviewed. 17 files, +744 / −88. Outside `docs/reviews`: 14 files, +313 / −88. The code delta is round 3's remediation, commits `d60c96f`, `1a5797e`, `73be928` and `a531431`.
**Reviewed against:** `pre-pr-review-3.md` (its findings, briefs, closure table, Approach decisions and dismissals), the Approach decisions of `pre-pr-review-1.md` (F5, page size in the address) and `pre-pr-review-2.md`, `CODING_STANDARDS.md` 1 to 3, and `README.md:78-104` (product events). Delta-scoped, no `--fresh`.
**Date:** 2026-10-12
**Reviewer:** 2 code-review agents, 1 test-oracle agent, and a verify pass

## What was verified and how

| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | green, lockfile unchanged |
| Lint | `pnpm lint` | green (361 files) |
| Typecheck | `pnpm typecheck` | green, every package |
| Build | `pnpm build` | green |
| Full suite | `pnpm test` (Testcontainers Postgres) | green: 83 files, 1,695 tests |
| Round 3 F1 against its intent | Read `apps/api/src/video-detail.ts:138-146`, `:193-221` against `since-publish.ts:120-147`, `revenue-part.ts:8-10` and the gateway cache key (`packages/youtube-gateway/src/reads/one-video.ts:40-42`). Executed by agent: HEAD's tests, e011005's `video-detail.ts` with HEAD's tests, and two mutants | fixed. The probe's `videoWindowRevenue` request is byte-identical to `readSincePublish`'s lifetime read (`prefix:videoId:startDate:endDate:currency`), so it adds no quota. Its gate equals `readSincePublish`'s own. Loosening the gate to `publishDay` alone turns two `video-revenue.test.ts` tests red; dropping the `isRevenueRefusal` fallback turns the YPP test and `video-detail.test.ts:1395` red |
| Round 3 F2 against its intent | Read `VideoDetail.tsx:399-414`, `App.tsx:421`, `RouteLink.follow`. Executed by agent: the old line restored, then `app.test.ts` | fixed. The new case goes red (3 events, the last open missing). StrictMode's second run returns at the `opened` guard before it clears `stepped`. Edge cases (a step to the same id, a step then a window change, A→B→C before effects, a modified click) reasoned through and hold |
| Round 3 F3 against its intent | Read `apps/site/privacy.html:90-96` against `packages/database/src/preferences.ts:26-41` and `apps/web/src/metric-charts.ts:23` | fixed. Every stored column except `user_id` is named or covered, and "daily numbers or a running total" matches the toggle's labels. `site.test.ts` pins the sentence and can go red |
| Round 3 F4 against its intent | Executed by agents: each replacement under a mutation of the rule it names, plus mutations of rules the old tests pinned | partially fixed. All four replacements can go red. Two of them leave a rule unpinned (Findings 1 and 2) |
| `currencies.test.ts` literal list | Agent diffed it against `currencies.ts` and against Google's `reports.query` page (fetched, "Last updated 2026-09-16 UTC") | identical: 90 codes, same order |
| Delta's tests at `e011005` (oracle) | 6 test files plus `fake-api.ts` copied into a scratch worktree at `e011005` and run there (API on Testcontainers) | 10 added or changed cases: 4 red, 6 green. The 6 green: the YPP guard (Finding 3), and five F4 test-only rewrites that are green by design because they pin behaviour already on the branch. See Test quality |
| Test shapes in the delta | Read by agent: production-built expectations, mocked units, call-shaped assertions, snapshots, assertion-free tests | none. `app.test.ts:376` mocks `track`, the outbound boundary, and asserts the event sequence, which is the rule |
| `fake-api.ts` routing change | Read, and `app.test.ts` run (23 tests). No other test file imports it | no behaviour change at the defaults |
| Em-dashes in shipped copy | `git diff e011005 -- . ':!docs/reviews' \| grep '^+.*—'` | 0 |
| A real browser, the live YouTube API | Not run: a review has no browser and makes no live Google calls | not run |

**Overall:** Round 3's remediation holds. All four CI checks pass, and the MEDIUM (Since publish revenue under a custom range before the publish day) is fixed against its intent, with no extra quota and a gate that matches the read it stands in for. The three LOW fixes hold too. This round confirms four LOW findings, all in tests and comments: round 3's F4 rewrite deleted the only test guarding round 1's page size rule, the new step-pages test runs only on default preferences, the YPP guard beside F1 does not show the probe ran, and five comments drifted. Nothing blocks the PR; fix them now or file them.

## Approach decisions

Carried forward from rounds 1 to 3. None is overturned here.

- **No revenue reported (round 1 F1):** `revenueReportedIn` in `apps/web/src/cards.ts` is the one predicate.
- **Sort on a hidden column (round 1 F2):** `listRouteFor(route, switches, sourcesShown)`.
- **First read vs local change (round 1 F3):** `preferencesAfterRead(read, local)`.
- **Page size in the address (round 1 F5):** any valid size, the default 10 included, stays in the route and the address. `routeWithControl` keeps the chosen size.
- **A failed save that switches a column back off (round 2 F1):** `revertAddressAfterFailedSave` through `listRouteFor` (#145).
- **The channel screen's wait for the preferences (round 2 F2):** its own `preferencesRead` state (#145).
- **Since publish revenue under an empty window (round 3 F1):** probe with one `videoWindowRevenue` read over the lifetime range (`lifetimeRevenueCurrencyOf`), only for a video with a processed day (`publishDay && publishDay <= processedThrough`). Precedent: `sincePublishDaysOf`'s read-then-`isRevenueRefusal` fallback.
- **Product event once per arrival (round 3 F2):** a ref that marks a step is consumed by the next open effect, after the StrictMode `opened` guard.
- **Testing what App wires (round 3 F4):** a rule that lives in a hook is pinned through `app.test.ts` against the fake API, which takes `videos` and `pageCount`.

## Confirmed Issues

### 1. Round 3's test rewrite deleted the only test guarding round 1's page size rule — LOW

- **Location:** `apps/web/src/route.test.ts:301-314`
- **Attribution:** introduced by `73be928` ("creator-analytics#64 pre-PR review 3 finding 4: Make four tests able to fail on the rule they name"), following round 3's brief. `git log -S"a page size change keeps the chosen size"` shows the test was written by `814c59f` ("pre-PR review 1 finding 5: Let an address with pageSize=10 win over a saved page size") and deleted by `73be928`. Round 3 judged it vacuous because it was green at `6f9caa1`. It was green there, but the branch itself broke the rule mid-way (`routePageSizeOf` dropped 10 from the route) and this test was round 1 F5's red→green proof.
- **Real-world trigger:** none today, because the code is correct. A future change that drops the default size from the route again, as `routePageSizeOf` once did, passes the whole suite. Rated LOW: coverage, no wrong output.

**Evidence** (the deleted test, as at `e011005`)
```ts
  test('a page size change keeps the chosen size in the route, the default, 10, included', () => {
    expect(routeWithControl(route, { pageSize: 25 })).toStrictEqual({ ... pageSize: 25 })
    expect(routeWithControl({ ...route, pageSize: 50 }, { pageSize: 10 })).toStrictEqual({
      ..., pageSize: 10,
    })
  })
```
`route.test.ts:201-204` pins only that `searchOf` writes `pageSize=10` when the route holds it, not that a control change keeps it in the route.

**Failure mode:** executed by agent. Mutate `routeWithControl` (`apps/web/src/route.ts:232-238`) so a change to `{ pageSize: 10 }` leaves `pageSize` out of the route. With `e011005`'s `route.test.ts`, the deleted test goes red. With HEAD's tests, all of `apps/web/src` stays green (1,013 tests). In the app, `VideoList.changeControl` (`VideoList.tsx:374-378`) navigates to `routeWithControl(route, control)` and saves the preference separately, so a route without `pageSize=10` falls back to the saved size until the save lands, or for good if it fails.

**Recommended fix:** add back a test in the `describe('the route after a control changes')` block of `apps/web/src/route.test.ts`, beside the rewritten one:
```ts
  test('a page size change keeps the chosen size in the route, the default, 10, included', () => {
    expect(routeWithControl(route, { pageSize: 25 }).pageSize).toBe(25)
    expect(routeWithControl({ ...route, pageSize: 50 }, { pageSize: 10 }).pageSize).toBe(10)
  })
```

**Remediation brief**
- **Design intent:** a value in the address wins over the saved preference (round 1 F5). The page size works like the visibility: any valid size, 10 included, stays in the route after a control change and is written to the address, so a creator who picks 10 with 50 saved sees 10 at once and after a failed save.
- **Full surface:** `apps/web/src/route.test.ts`, in the `describe` that opens at `:282`. No production change.
- **Must preserve:** the rewritten test at `:301` ("a window change from a custom range keeps the page size and the visibility, and drops the range"); `:201-204` (`searchOf` carries the page size); `preferences.test.ts:98` (`pageSizeOf(listRouteOf('?pageSize=10'), { pageSize: 25 })` is 10).
- **Do not touch:** `routeWithControl` itself. It is correct.
- **Proof:** in a scratch copy, change `apps/web/src/route.ts:236` to `: { ...route, ...change, page: 1, ...('pageSize' in change && change.pageSize === 10 ? { pageSize: undefined } : {}) }`, then `pnpm exec vitest run apps/web/src/route.test.ts`: the new test is red. Revert, and it is green.

### 2. The step-pages test only checks the query when every preference is the default — LOW

- **Location:** `apps/web/src/app.test.ts:399-417`
- **Attribution:** introduced by `73be928`, as round 3 F4's replacement for the deleted `video-list.test.ts:1068` quota test.
- **Real-world trigger:** none today. The test's rule is that the detail screen reads its neighbouring list pages with the list's own query, so the API answers from the list's cached read. The parts of that query most likely to drift are the ones `listReadOf` merges from the saved preferences (page size, visibility). This test renders with no saved preferences, so those parts are the defaults on both sides. Rated LOW: coverage, no wrong output.

**Evidence**
```ts
    const api = installFakeApi()
    api.videos = [fakeVideo, { ...fakeVideo, id: 'video-2', title: 'Another video' }]
    api.pageCount = 2
    const { container } = await render('?window=last90&sort=-views')
```

**Failure mode:** executed by agent. In `useListPages` (`apps/web/src/VideoDetail.tsx:327`), hard-code the step reads' `pageSize: 10, visibility: 'public'` in `queryOf`: the test stays green (23/23). A creator with 25 saved would then step with a query that misses the list's cache and costs a fresh read per step. A mutation that builds `queryOf` from `route` instead of `listRoute` also stays green.

**Recommended fix:** give the test non-default inputs, saved and in the address:
```diff
-    const api = installFakeApi()
+    const api = installFakeApi({ pageSize: 25 })
     api.videos = [fakeVideo, { ...fakeVideo, id: 'video-2', title: 'Another video' }]
     api.pageCount = 2
-    const { container } = await render('?window=last90&sort=-views')
+    const { container } = await render('?window=last90&sort=-views&visibility=all')
```
Then check the list's own read really carries `pageSize=25` and `visibility=all` (add `expect(new URLSearchParams(listQuery).get('pageSize')).toBe('25')`), so the comparison is not two defaults again.

**Remediation brief**
- **Design intent:** `useListPages` reads the list pages through `listReadOf(route, channel, saved)` and `videoListQueryOf`, the same path the list uses, so the gateway's cache key matches and a step costs no quota (`VideoDetail.tsx:312-345`). The test should fail whenever the step reads' query differs from the list's in any part but `page`.
- **Full surface:** `apps/web/src/app.test.ts:399-417`. No production change.
- **Must preserve:** the test's two existing assertions (pages `['1', '2']`, and equality with the list's query apart from `page`); `app.test.ts:143-152` (the list read with default preferences after a failed preferences read, which reads `pageSize: 50` saved).
- **Do not touch:** `fake-api.ts`'s page echo and `videos`/`pageCount` defaults; the other 22 `app.test.ts` cases rely on them.
- **Proof:** in a scratch copy, change `VideoDetail.tsx:327` to `const queryOf = (page: number) => videoListQueryOf({ ...listRoute, page, pageSize: 10, visibility: 'public' })`, then `pnpm exec vitest run apps/web/src/app.test.ts`: the rewritten test is red. Revert, and it is green. Optional: a case with a sort on a column a saved switch hides would also catch the `route`-for-`listRoute` mutation; add it only if it goes red under that mutation.

### 3. The YPP guard beside round 3 F1 does not show the probe ran — LOW

- **Location:** `apps/api/src/video-detail.test.ts:1441-1464`
- **Attribution:** introduced by `d60c96f` ("pre-PR review 3 finding 1: Keep the since publish revenue when a custom range ends before the publish day").
- **Real-world trigger:** none at runtime. Executed by agent: the test passes against `e011005`'s `video-detail.ts`, because before the fix such a range never carried Since publish revenue, so "without revenue" held anyway. It does go red when the probe's `isRevenueRefusal` fallback is removed, so it is not vacuous, but its rule (a `not_monetized` probe leaves the rows without revenue and does not refuse) is only proved if the probe actually ran.

**Evidence**
```ts
    expect(beforePublish.status).toBe(200)
    expect(beforePublish.body).not.toHaveProperty('revenue')
    expect(beforePublish.body.sincePublish).not.toHaveProperty('revenueCurrency')
```

**Failure mode:** a change that skips the probe for this case (for example, a gate that is never true) leaves the test green, while the rule it names is no longer exercised.

**Recommended fix:** assert that the lifetime revenue read was asked of Google. The fake records refused queries too (`packages/fake-google/src/index.ts:537-538` pushes before the partner program check at `:553`).
```ts
    expect(
      metricQueriesOf(api, noonToday)
        .filter((query) => query.get('metrics')?.startsWith('estimatedRevenue'))
        .map((query) => [query.get('startDate'), query.get('endDate')]),
    ).toEqual([['2026-09-01', '2026-10-07']])
```
`metricQueriesOf` is in `apps/api/test/custom-range.ts:56`; check whether `video-detail.test.ts` already imports it, and how `:1468`'s test reads `analyticsRequests`, and match that shape. The dates are the lifetime range the test at `:1468` pins (`:1495-1497`).

**Remediation brief**
- **Design intent:** when the window has no day and Google has processed one of the video's, the API learns the channel's revenue status from one `videoWindowRevenue` read over the lifetime range. A `not_monetized` answer means rows without revenue and status 200; `consent_missing` is refused by the gateway before the cache or Google.
- **Full surface:** `apps/api/src/video-detail.test.ts:1441-1464`. No production change.
- **Must preserve:** the test's three existing assertions; `:1418` (rows equal lifetime's, revenue included) and `:1468` (a failed lifetime revenue read refuses with 502 and asks nothing after it).
- **Do not touch:** `lifetimeRevenueCurrencyOf` and its gate (`video-detail.ts:138-146`, `:203-211`). They are correct; see Minor for the optional simplification and why it is not recommended.
- **Proof:** `pnpm exec vitest run apps/api/src/video-detail.test.ts -t "outside the YouTube Partner Program, a custom range"` green at HEAD. Then copy the test file into a scratch worktree at `e011005` (`git worktree add --detach <scratchpad>/wt e011005`, `pnpm install --frozen-lockfile`) and run the same command there: red, because no revenue request is made. Remove the worktree after.

### 4. Comment hygiene — LOW (aggregated)

- `apps/web/src/VideoDetail.tsx:406-407` — "The ref outlives StrictMode's second effect." → "`opened` outlives StrictMode's second effect, which returns before it clears `stepped`."
- `apps/api/src/since-publish.ts:93` — "With a currency, the detail's revenue answered, and every row carries revenue in it." → "With a currency, the channel's revenue reads answered (the detail's own, or the lifetime revenue read when the window has no day), and every row carries revenue in it."
- `apps/api/src/video-detail.test.ts:1480` — "Video 2's read leaves the last processed day in the cache, so video 1's reads its revenue first." → "Video 2's read leaves the uploads and the last processed day in the cache, so video 1's first Google query is its lifetime revenue read."
- `apps/web/src/fake-api.ts:145` — "The channel's videos, on one page, each with its detail" → "The videos every page of the list answers, each with its detail; with more than one page, each page repeats them"
- `apps/web/src/video-step.test.ts:1-5` — "…so none shows … that the screen reads the adjacent page, or that a step moves focus…" → drop "that the screen reads the adjacent page", and add "`app.test.ts` shows the adjacent page read and its query."

## Needs Further Investigation

### A. A video with no publish day gets Since publish revenue in some windows and not others
`packages/youtube-gateway/src/reads/uploads.ts:136-151` sets `publishedAt` to `contentDetails.videoPublishedAt ?? null`, so a private, unscheduled upload may have no publish day. Then a calendar, lifetime or custom window keeps its full range (`videoRangeOf(span.calendar, null)`), reads revenue, and `readSincePublish` answers zero rows with revenue; an after-publish window (`first7`) has an empty range and the probe's gate is false, so the rows have no revenue. Pre-existing (`videoRangeOf`'s null case predates round 3), and not the deferred "published after the last processed day" item. To confirm: find whether Google omits `videoPublishedAt` for a real private upload (a live `videos.list` read on a private draft). If it does, it is LOW: treat a null publish day as "no day" in `videoRangeOf`, matching `rangeAfterPublish`'s `today + 1` fallback.

Carried from round 3: NFI A (the old launch chart for one frame on return) and NFI B (a 403 log may carry an email). Carried from round 1: NFI A and B.

## Reviewed and Dismissed

- **The probe and `readSincePublish`'s lifetime read are two quota-costing calls:** no. The cache key is `prefix:videoId:startDate:endDate:currency` (`one-video.ts:40-42`) and both requests are `{ startDate, endDate, videoId, currency }` from the same `lifetimeRange`.
- **The probe's gate differs from round 3's brief:** on purpose and correct. The brief's non-empty-lifetime gate would probe a video published between the last processed day and today, where `readSincePublish` never reads. Two `video-revenue.test.ts` tests pin the remediation's gate.
- **Back or Forward right after a step, before its effect runs, leaves `stepped` set:** not reachable. A click is a discrete event; React commits and flushes passive effects before any popstate.
- **A step to the current video's own id leaves `stepped` set:** harmless. Leaving the video either clears it or unmounts `VideoDetail`.
- **The privacy policy's new approval comment ships in the page source:** follows the three existing `#61` comments. It is the round 3 nit, not a new one; see Minor.
- **`fake-api.ts`'s detail route moved from an exact route match to `path` plus `method === 'GET'`:** equivalent, and all 23 `app.test.ts` cases pass at the defaults.
- **`content-security-policy.test.ts` deletion:** correct. `hostSourcesAdmit` ignores paths, so the deleted cases duplicated `:33`.
- **Since publish rows still differ by window for a video published after the last processed day:** recorded in round 3's "Notes from verification" as a stage 2 proposal. Not reported again.
- **Carried from round 3:** every dismissal in `pre-pr-review-3.md` stands.

## Minor / nits

- **`lifetimeRevenueCurrencyOf` could go** (`video-detail.ts:138-146`, `:203-211`). An agent's mutant that passes the saved currency straight to `readSincePublish` under the same gate passes 90 of 91 detail and revenue tests, and costs the same quota: `sincePublishDaysOf` already reads with revenue and falls back on `isRevenueRefusal`. Only `:1468` fails, because it pins which query fails first. Not recommended now: it would overturn round 3's Approach decision for no behaviour change, and the probe makes the "rows follow the channel's revenue status" rule explicit. Nick's call.
- **`route.test.ts:301`'s "drops the range" half repeats `:698`** ("a move to any other window drops the range, on the list and the detail screen"). Only "keeps the page size and the visibility" is new. Rename it to that rule, or drop `range` from its input.
- **`profile.test.ts:36`'s name says "the 90 currencies Google's Analytics API documents"**, but it checks only the count and uniqueness. Google's list is pinned in `packages/api-types/src/currencies.test.ts:20`. Rename to "offers each currency of the list once, dropping none".
- **`currencies.test.ts:20` does not say where its literal list came from.** `currencies.ts:4-7` does ("read 2026-10-09", page "Last updated 2026-09-16"). A one-line pointer would let a reader re-check it.
- **`apps/site/privacy.html:45,61,91,115` ship `<!-- Approved word for word … -->` in the public page source.** Round 3's nit, now four comments.
- Every other round 3 nit stands.

## Test quality

- **Tests added or changed in the delta:** 10 cases in 6 files, plus the `fake-api.ts` helper. Two tests deleted (`video-list.test.ts:1068`, `content-security-policy.test.ts:47-53`), both on round 3's brief.
- **Oracle at `e011005`:** 4 red (`video-detail.test.ts:1418` and `:1468`, `app.test.ts:376`, `site.test.ts:583`), 6 green:
  - `video-detail.test.ts:1441`: a negative guard with red partners, but see Finding 3.
  - `app.test.ts:400`, `route.test.ts:301`, `profile.test.ts:36`, `currencies.test.ts:20`: round 3 F4's test-only rewrites. Green by design, because they pin behaviour the branch already had. Each goes red under a mutation of its rule. Findings 1 and 2 are what they leave unpinned.
- **Tautology shapes:** none. `currencies.test.ts:20` is a literal from Google's page, checked against it this round. `app.test.ts:400` shares `videoListQueryOf` on both sides only through the app's own reads, which is the rule.

## Before opening the PR

- **CI readiness:** lint, typecheck, build and the full suite are green at `153408d`.
- **Commit hygiene:** commit this doc. It adds no repro: Findings 1 to 3 are proved by mutation, and their commands are in the briefs.
- **Spec drift to settle in the PR description:** round 3's note stands. The epic body still says "No component tests" and "no new library"; #145 added `happy-dom` as a dev dependency.
- **Follow-up tickets:** Findings 1 to 4 if not fixed now; NFI A; round 3's NFI A and B; round 1's NFI A and B.
- **Likely reviewer asks:** the three migrations and their RLS; the overlap on `apps/site/privacy.html` with `creator-analytics-3`; the new dev dependency; the size of the branch.

## Prior-review closure

Round 3 (`pre-pr-review-3.md`) had 4 confirmed findings.

| Prior finding | Status | Note |
| --- | --- | --- |
| 1 (MEDIUM) Since publish revenue under a custom range before the publish day | fully fixed | Verified against intent, with mutants. Finding 3 here is a test-strength note on one of its fallback tests |
| 2 (LOW) Back and Forward after a step | fully fixed | |
| 3 (LOW) privacy policy omits the chart mode | fully fixed | |
| 4 (LOW) four tests that could not fail | partially fixed | Each replacement can go red. The route rewrite dropped round 1 F5's guard (Finding 1), and the step-pages test checks only defaults (Finding 2) |

No prior finding was "resolved" only by a comment or doc edit. Round 3 deferred nothing ("Known regressions, deferred: None").

## Verdict

**Ready to open the PR. Findings 1 to 4 are LOW and can be fixed now or filed as follow-ups.**

- No CRITICAL, HIGH or MEDIUM finding. Round 3's MEDIUM is fixed against its intent.
- The Confirmed list shrank from 1 MEDIUM and 3 LOWs to 4 LOWs, and its content has moved from a behaviour bug to test strength and comment drift. That is the review reaching the bottom of the barrel, not the branch failing to improve.
- Fix-begets-finding: Findings 1 and 2 come from round 3's own F4 brief, which judged a test vacuous from a green run at `6f9caa1` without checking whether the branch had once broken its rule. It is a one-off in tests, not a subsystem rewritten three times, so no split ticket.
