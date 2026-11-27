# Pre-PR review: creator-analytics#64 Web dashboard: key metrics together, a profile screen and saved preferences

**Branch:** `creator-analytics-64-web-dashboard-metrics-profile` vs `origin/main` (merge-base `6f9caa1` "Add weekly Dependabot version updates for npm and GitHub Actions")
**Reviewed at:** HEAD `e011005` ("creator-analytics#61 Bring the privacy policy up to date with what the product reads"). The tree was clean, with no uncommitted or untracked files at review time. Whole branch: 244 files, +32,705 / −1,918, 581 commits. Those totals include review docs 1 and 2, their repros, and 4,890 lines of drizzle snapshot JSON.
**Delta under review:** none. This is a full review (`--fresh`). Code changed since `a704a70` ("creator-analytics#64 pre-PR review 1 remediation closure table"), the HEAD that `pre-pr-review-2.md` reviewed, got the closest reading: 161 commits across #61, #85, #116, #118, #144 to #146, #148 to #160, about +10,000 / −1,150.
**Reviewed against:** the epic body of #64 (Solution, User Stories 1 to 88, Implementation and Testing Decisions); the bodies of #118, #145 and #158; `CODING_STANDARDS.md` 1 to 3; ADR 0013; `CONTEXT.md`; and the Approach decisions and dismissals of `pre-pr-review-1.md` and `pre-pr-review-2.md`.
**Date:** 2026-10-12
**Reviewer:** 3 code-review agents, 1 test-oracle agent, and a verify pass

## What was verified and how

| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | green, lockfile unchanged |
| Lint | `pnpm lint` | green (359 files) |
| Typecheck | `pnpm typecheck` | green, every package |
| Build | `pnpm build` | green |
| Full suite | `pnpm test` (Testcontainers Postgres) | green: 83 files, 1,691 tests |
| Custom range before the publish day (Finding 1) | Executed: `pnpm exec vitest run --config docs/reviews/creator-analytics-64/repro/round-3-detail.vitest.config.ts` | red. Under `window=custom&from=2025-01-01&to=2025-01-31`, every Since publish row loses `estimatedRevenue` and the answer loses `revenueCurrency`, which `window=lifetime` carries for the same video |
| Step, then Back and Forward (Finding 2) | Read: `VideoDetail.tsx:398-411` and `:441-449`. `App.tsx:421` mounts `VideoDetail` with no key, so it stays mounted across videos | holds as described |
| Privacy policy against the preferences table (Finding 3) | Read: `apps/site/privacy.html:91-93` against `packages/database/src/preferences.ts:26-41` | chart mode is stored and not named |
| Branch tests against `$BASE` (oracle) | 28 modified test files and 4 helpers copied into a scratch worktree at `6f9caa1` and run there (API on Testcontainers). The 32 new files were run as a group | modified: 971 run, 574 red, 397 green. New: every file red (import failure or missing `happy-dom`) except one negative guard. See Test quality |
| Test shapes in the new files | Read by agent: expectations built from production, mocked units, call-shaped assertions, snapshots, assertion-free tests | Finding 4. No mocked unit, snapshot or assertion-free test |
| Tenancy, RLS, cache keys, currency on every revenue read, lowercase format filters, visibility before paging, partial videos last, `consent_missing` revenue sort, repeated query refusal, `login_hint` and `prompt` values | Read by agent across `apps/api/src`, `packages/youtube-gateway/src` and `packages/database/src` | hold |
| Product events | `grep` of every `track(` and `name: '...'` in `apps/web/src` and `apps/site/src`, against `README.md:78-104` | every event is in the README, and none carries an id or email |
| Em-dashes in shipped copy | `git diff 6f9caa1 -- . ':!docs/reviews' ':!pnpm-lock.yaml' \| grep '^+.*—'` | 0 |
| No new library | `git diff 6f9caa1 -- package.json apps/*/package.json packages/*/package.json` | one dev dependency, `happy-dom` (#145, for App's render test). Nothing new reaches the bundle |
| A real browser, the live YouTube API | Not run: a review has no browser and makes no live Google calls. The countries read is grounded in Google's channel reports page (#158), and its test file states that limit | not run |

**Overall:** The branch holds up. All four CI checks pass. Tenancy, RLS, caching, currency, the event payloads and the copy rules hold. The App render seam added by #145 closes the area that review 2 flagged as most fragile. This round confirms one MEDIUM finding and three LOW ones. The MEDIUM is in the custom date range (#118): a range that ends before a video was published drops revenue from that video's Since publish table, a table the contract says does not depend on the window. Fix it before the PR opens. It is a contained change to one API function. The three LOWs can be fixed now or filed as follow-ups. Finding 3 needs Nick's word-for-word approval of the privacy text.

## Approach decisions

Carried forward from rounds 1 and 2. None is overturned here.

- **No revenue reported (round 1 F1):** `revenueReportedIn` in `apps/web/src/cards.ts` is the one predicate. The view builders apply it, and the consumers follow through `daysCarryRevenue`.
- **Sort on a hidden column (round 1 F2):** `listRouteFor(route, switches, sourcesShown)`.
- **First read vs local change (round 1 F3):** `preferencesAfterRead(read, local)`.
- **Page size in the address (round 1 F5):** any valid size stays in the route.
- **A failed save that switches a column back off (round 2 F1):** the address revert runs through `listRouteFor` with the lost switches off (`revertAddressAfterFailedSave(onView, change, navigate, settle)`, #145).
- **The channel screen's wait for the preferences (round 2 F2):** tracked as its own `preferencesRead` state (#145).

Added by this review:

- **Since publish revenue under an empty window (F1):** the Since publish rows decide their revenue from the channel's revenue status, never from whether the window had a day to read. When the window's range is empty, the API probes that status with one `videoWindowRevenue` read over the lifetime range. That is the same read, with the same cache key, that `readSincePublish` makes for its lifetime row. Precedent: `sincePublishDaysOf` (`apps/api/src/since-publish.ts:71-83`), which already decides "with revenue" by reading and falling back on `isRevenueRefusal`.

## Confirmed Issues

### 1. A custom date range that ends before a video's publish day drops revenue from its Since publish table — MEDIUM

- **Location:** `apps/api/src/video-detail.ts:183-201`
- **Attribution:** pre-existing, exposed. The guard `range.startDate > range.endDate ? null` arrived with `d7cb5b3` ("creator-analytics#80 Revenue per video"). Its case then was a video not yet published, whose Since publish rows are zeros anyway. `b48a1cb` ("creator-analytics#118 Custom date range") made the guard reachable for a published, processed video. A custom range is bounded only by the channel's creation day, so it can end before the video's publish day.
- **Real-world trigger:** a creator with revenue consent picks a past custom range on the channel screen, such as January of last year. The video list still lists every upload, including newer ones with zero numbers. The creator opens a video published after that range, or steps to one with "Next video" (#154). The Since publish table then shows no revenue column for that video, though the same video under any other date range shows one. Rated MEDIUM because revenue is hidden, not misstated.

**Evidence**
```ts
  const revenue =
    range.startDate > range.endDate
      ? null
      : await revenuePartOf(readChannel, request, await readCurrency(tx))
  if (revenue && !revenue.ok) return revenue
  // The since publish rows carry revenue only when the detail's did, ...
  const sincePublish = await readSincePublish(
    ...
    revenue && 'currency' in revenue.revenue ? revenue.revenue.currency : null,
  )
```

**Failure mode:** the repro reads one video under `window=lifetime` and under `window=custom&from=2025-01-01&to=2025-01-31`. The video was published 2026-09-01, revenue consent is given, and the last processed day is 2026-10-04. Under lifetime, `sincePublish.revenueCurrency` is `'USD'` and each stage carries `estimatedRevenue` (1.5 in `first7` and `first28`). Under the custom range, `revenueCurrency` is gone and `estimatedRevenue` is missing from every row. The API contract (`packages/api-types/src/video-detail.ts:150`) says the stages "do not depend on the window".

**Recommended fix**
```diff
-  const revenue =
-    range.startDate > range.endDate
-      ? null
-      : await revenuePartOf(readChannel, request, await readCurrency(tx))
+  const currency = await readCurrency(tx)
+  const revenue =
+    range.startDate > range.endDate ? null : await revenuePartOf(readChannel, request, currency)
   if (revenue && !revenue.ok) return revenue
-  // The since publish rows carry revenue only when the detail's did, so a channel without revenue
-  // consent or outside the YouTube Partner Program spends no revenue call on them.
+  const sincePublishCurrency = revenue
+    ? { ok: true as const, currency: 'currency' in revenue.revenue ? revenue.revenue.currency : null }
+    : await lifetimeRevenueCurrencyOf(readChannel, { ...lifetimeRange, videoId }, currency)
+  if (!sincePublishCurrency.ok) return sincePublishCurrency
   const sincePublish = await readSincePublish(
     readChannel,
     videoId,
     publishDay,
     lifetimeRange,
     processedThrough,
     today,
-    revenue && 'currency' in revenue.revenue ? revenue.revenue.currency : null,
+    sincePublishCurrency.currency,
   )
```
Add this helper beside `revenuePartOf`, and import `isRevenueRefusal` from `./revenue-part.ts`. `ReadRefusal`, `RevenueCurrency` and `OneVideoRequest` are already in scope or imported in the file; check before adding them.
```ts
async function lifetimeRevenueCurrencyOf(
  readChannel: ReadChannel,
  lifetimeRequest: OneVideoRequest,
  currency: RevenueCurrency,
): Promise<{ ok: true; currency: RevenueCurrency | null } | { ok: false; refusal: ReadRefusal }> {
  if (lifetimeRequest.startDate > lifetimeRequest.endDate) return { ok: true, currency: null }
  const read = await readChannel('videoWindowRevenue', { ...lifetimeRequest, currency })
  if (read.ok) return { ok: true, currency }
  return isRevenueRefusal(read.refusal) ? { ok: true, currency: null } : read
}
```
Rewrite the two comments the diff touches (see Full surface) so they say what the code now does. The recommended diff deliberately carries no comment lines.

**Remediation brief**
- **Design intent:** a video's Since publish rows are the video's own life by stage, the same in every date range. Whether they carry revenue depends only on the channel: revenue consent, and Google answering a revenue read rather than refusing it as `not_monetized`. The detail's window revenue is one way to learn that status. When the window has no day to read, the status has to come from somewhere else, and the lifetime range is the natural source because `readSincePublish` reads it anyway. The gateway refuses a read without revenue consent before its cache or Google, so a channel without consent still spends no revenue query.
- **Full surface:**
  - `apps/api/src/video-detail.ts:183-201`: the revenue read, the new probe, and the `readSincePublish` call.
  - `apps/api/src/video-detail.ts:125` (beside `revenuePartOf`): the new helper.
  - `apps/api/src/video-detail.ts:30`: add `isRevenueRefusal` to the `./revenue-part.ts` import.
  - `apps/api/src/video-detail.ts:183-185`: the comment "A video with no day to count yet, one not yet published, has no revenue to read either." Name the custom range that ends before the publish day as the other case.
  - `apps/api/src/video-detail.ts:191-192`: the comment "The since publish rows carry revenue only when the detail's did". This becomes false. Say the rows follow the channel's revenue status, read over the lifetime range when the window has no day.
  - `apps/api/src/video-detail.ts:52`: the `noNumbers` doc "one not yet published". Add the custom range that ends before the publish day.
  - `packages/api-types/src/video-detail.ts:145-148`: the `revenue` doc "Absent only for a video with no day to count in the window: one not yet published, or, in a calendar window, one published after the last processed day". Add the custom range that ends before the publish day.
  - A new API test in `apps/api/src/video-detail.test.ts`, beside `:1395` ("a custom range that ends before the publish day answers no days…"). It asserts that `sincePublish` equals the lifetime window's for a consented channel. Port it from the repro.
- **Must preserve:**
  - `apps/api/src/video-detail.test.ts:1395`: no Google query whose `endDate` is the custom range's end.
  - `:1052` ("with revenue consent, a video YouTube has not processed yet carries zero revenue in every stage, in the saved currency, and makes no query for them") and its exact `dayQueriesOf` list.
  - `apps/api/src/video-revenue.test.ts:954` ("in a calendar window, a video published after the last processed day carries no revenue and makes no revenue call").
  - Every test in `apps/api/src/video-detail.test.ts` and `apps/api/src/video-revenue.test.ts` that counts quota or queries. On the normal path, the probe is skipped because `revenue` is non-null. On the empty-window path with a processed video, the probe's cache key equals `readSincePublish`'s own lifetime `videoWindowRevenue` read, so it adds no quota.
  - A not-yet-published video: `lifetimeRange` runs backwards, so the probe answers null, as today.
  - A refusal other than a revenue refusal, such as `quota_exhausted` or `google_failed`, still refuses the whole detail. That matches what `readSincePublish` does on its own lifetime revenue read.
- **Do not touch:** the `range.startDate > range.endDate` guard on the window's own revenue. A window with no day must still make no revenue call (`:1395`, `video-revenue.test.ts:954`). Do not touch the early zeros path in `readSincePublish` (`since-publish.ts:120-123`) either: it trusts the currency it is given, which is why the probe decides the currency rather than passing `readCurrency` straight through.
- **Proof:** `pnpm exec vitest run --config docs/reviews/creator-analytics-64/repro/round-3-detail.vitest.config.ts` is red now and must be green after. Then run `pnpm exec vitest run apps/api/src/video-detail.test.ts apps/api/src/video-revenue.test.ts`.

### 2. Back and Forward after "Next video" miscount `video_detail_opened` — LOW

- **Location:** `apps/web/src/VideoDetail.tsx:398-411`, `:445-449`
- **Attribution:** introduced by `c7176dd` ("creator-analytics#154 Previous and next video on the detail screen").
- **Real-world trigger:** on video A, the creator presses "Next video" to reach B, then the browser's Back to return to A, then Forward to B. `App.tsx:421` mounts `VideoDetail` with no key, so the component and its refs live across all three videos.

**Evidence**
```ts
  useEffect(() => {
    if (opened.current === video || channelId === null) return
    opened.current = video
    if (stepped.current !== video) track({ name: 'video_detail_opened' })
  }, [video, channelId])
  ...
      onStep={({ id }) => {
        stepped.current = id
      }}
```

**Failure mode:** `stepped.current` is set on a step and never cleared. Back to A sends `video_detail_opened`, because `stepped.current` is `'B'`. Forward to B then sends nothing at all: neither `video_detail_opened` (`stepped.current === 'B'`) nor `video_stepped`. The same history move is counted on one side and silently dropped on the other. README:91 defines the event as "once each time a video's detail screen opens, not on each window or on a step". The opened and stepped counts drift apart by however often creators use the browser's history.

**Recommended fix**
```diff
   useEffect(() => {
     if (opened.current === video || channelId === null) return
     opened.current = video
-    if (stepped.current !== video) track({ name: 'video_detail_opened' })
+    const wasStepped = stepped.current === video
+    stepped.current = null
+    if (!wasStepped) track({ name: 'video_detail_opened' })
   }, [video, channelId])
```

**Remediation brief**
- **Design intent:** a step sends `video_stepped` from the stepper (`VideoStepper.tsx:77`), and the step's own arrival suppresses `video_detail_opened` exactly once. Any other arrival at a video, a history move included, is an open.
- **Full surface:** `apps/web/src/VideoDetail.tsx:404-411` (the effect) and `:400` (the ref's comment, which should say the ref is consumed by the next open). Also check whether README:91 should say that Back and Forward count as opens.
- **Must preserve:**
  - StrictMode's second effect run must still send nothing. The `opened` ref guards that, and the fix leaves it first.
  - A step must still send exactly one `video_stepped` and no `video_detail_opened`.
  - A window change must send neither.
  - `apps/web/src/app.test.ts` renders App under StrictMode with a fake API, so a test can drive a step and then `history.back()`.
- **Do not touch:** `VideoStepper.tsx`'s `track(videoSteppedEvent(direction))`.
- **Proof:** a new `apps/web/src/app.test.ts` case. Spy on the analytics `track`, the way the file reaches other boundaries, open video A, step to B, call `history.back()`, then `history.forward()`, and assert the event names in order: `video_detail_opened`, `video_stepped`, `video_detail_opened`, `video_detail_opened`. It is red now, because the last open is missing.

### 3. The privacy policy's list of stored display preferences leaves out the chart mode — LOW

- **Location:** `apps/site/privacy.html:91-93`
- **Attribution:** introduced by `39505ab` ("creator-analytics#72 Preferences on the server, with reset"), which added both the sentence and the `chart_mode` column. `#61` kept the sentence.
- **Real-world trigger:** every reader of the public privacy policy, including Google's OAuth verification review. The policy enumerates what is stored.

**Evidence**
```html
          Your display preferences: page size, which columns and charts show, your currency, and
          whether the video list shows unlisted and private videos.
```
`packages/database/src/preferences.ts:30-35` stores `revenue_sources`, `chart_mode` (`daily` or `aggregate`) and `chart_card` beside the page size, the columns, the currency and the visibility.

**Failure mode:** "Which charts show" covers `chart_card`. "Columns" plausibly covers `revenue_sources`. Nothing covers `chart_mode`, whether the charts show daily numbers or a running total. The list reads as complete, so a reader is told less than the table stores. This is not personal data, which is why the rating is LOW. The policy's claims still have to be true and complete.

**Recommended fix:** the copy was approved word for word (#61), so Nick approves the new wording before it lands. Draft: "Your display preferences: page size, which columns and charts show, whether the charts show daily numbers or a running total, your currency, and whether the video list shows unlisted and private videos."

**Remediation brief**
- **Design intent:** the privacy policy names every class of stored data. Preferences are one row per user, with typed columns (`packages/database/src/preferences.ts`).
- **Full surface:**
  - `apps/site/privacy.html:91-93`.
  - `apps/site/test/site.test.ts`, if it pins this sentence. `grep -n "display preferences" apps/site/test/site.test.ts`.
- **Must preserve:** the rest of the sentence, and every other approved clause.
- **Do not touch:** the reads clause at `privacy.html:45-60`. It was checked against `packages/youtube-gateway/src/reads/` and holds.
- **Proof:** read the sentence against `packages/database/src/preferences.ts:26-41`. Every column except `user_id` is named or covered.
- **Escalation:** copy needs Nick's word-for-word approval (park, per the run's rules).

### 4. Four tests claim coverage they do not add — LOW

- **Location:**
  - `apps/web/src/profile.test.ts:37-42`
  - `apps/web/src/content-security-policy.test.ts:47-53`
  - `apps/web/src/route.test.ts:301`
  - `apps/api/src/video-list.test.ts:1068`
- **Attribution:** introduced by #79 (currencies), #156 (srcset), round 1 F5 and #154 respectively.
- **Real-world trigger:** none at runtime. Each test reads as proof of a rule it cannot fail on (CODING_STANDARDS 2).

**Evidence and failure mode, per test:**
- `profile.test.ts:37`, "offers exactly the currencies Google's Analytics API documents, each once". Its expectation is `[...revenueCurrencies].toSorted()`, the same list `currencyOptionsOf` maps (`profile.ts:37`). Only `toHaveLength(90)` can fail, so swapping one code for another passes. No other test pins the list (`packages/api-types/src/currencies.test.ts` tests only `currencyOf`).
- `content-security-policy.test.ts:47`, "loads each larger size … a srcset offers from i.ytimg.com (creator-analytics#156)". `hostSourcesAdmit` ignores paths, so the three file names reduce to the existing test at `:33` (`mqdefault.jpg` on the same host). It duplicates a rule already pinned, and it passes unchanged at `$BASE`. The branch never touched `content-security-policy.ts`.
- `route.test.ts:301`, "a page size change keeps the chosen size in the route, the default, 10, included". It is green at `$BASE`, because a non-window change still goes through `{ ...route, ...change, page: 1 }`. The branch's new route logic, the `'window' in change` path through `controlsOf` that drops the custom range, is pinned elsewhere only for the range.
- `video-list.test.ts:1068`, "a detail screen's step within 6 hours of the list read, on the same page or across its edge, costs no quota". It is green at `$BASE`, because the base API already served repeated pages from cache. The risk the stepper adds is on the web side: its adjacent-page read (`adjacentPagesOf`, `videoListQueryOf`) sending a query that differs from the list's and so missing the cache. No test covers that.

**Recommended fix:**
- Pin the 90 currency codes literally in `packages/api-types/src/currencies.test.ts`, as the list in `currencies.ts` was checked against Google's documentation, and drop the identity line from `profile.test.ts:41`. Keep its length check, or move it.
- Delete `content-security-policy.test.ts:47-53`, or replace it with one that feeds every URL `thumbnailSrcSetOf` emits through `hostSourcesAdmit(imageSources, …)`.
- Rewrite `route.test.ts:301` against the branch's change: `routeWithControl({ ...route, pageSize: 25, visibility: 'all', window: 'custom', range }, { window: 'last7' })` keeps `pageSize` and `visibility` and drops `range`. Delete it instead if `route.test.ts` already pins exactly that.
- Replace `video-list.test.ts:1068` with a web test: the query `adjacentPagesOf` reads for page n±1 equals `videoListQueryOf` for that page, apart from `page`. Or delete it, if Nick prefers to keep API quota tests to API changes.

**Remediation brief**
- **Design intent:** CODING_STANDARDS 2. A test states one rule and must be able to go red when that rule breaks. A duplicate of a rule already pinned is deleted.
- **Full surface:** the four sites above, plus `packages/api-types/src/currencies.test.ts` and `apps/web/src/video-step.test.ts`, which take the replacements.
- **Must preserve:** `profile.test.ts`'s locale-name tests (`:44` on). `content-security-policy.test.ts:33`. `route.test.ts`'s other `routeWithControl` cases.
- **Do not touch:** `apps/web/test/web.test.ts:158` and `:806`. They are green at `$BASE` too, but they are standing invariant guards over the current sheet and page, and the branch's own tokens and markup are inside their reach (see Reviewed and Dismissed).
- **Proof:** for each replacement, mutate the rule it pins and see it go red. Swap one code in `revenueCurrencies`; make `controlsOf` keep `range`; make `adjacentPagesOf` add a stray key. Then revert the mutation.

## Needs Further Investigation

### A. Returning from a video's detail screen to a window after publish shows the old launch chart for one frame
`App.tsx:200` keeps `summaryPlaceList` after `VideoList` unmounts. On return, `AfterPublishPlace` may draw the last list's launch chart, then the placeholder once `VideoList`'s `onShown` effect reports `reading`, then the new chart. To confirm, use `apps/web/src/app.test.ts`: open the channel screen in `first7`, open a video, go back, and assert no `.launch-chart` renders before the list read settles. If confirmed, it is LOW: reset `summaryPlaceList` when `VideoList` unmounts.

### B. The 403 warning log on a revenue read may carry an email address
`packages/youtube-gateway/src/youtube-gateway.ts:~301` (#144) logs Google's 403 `message`. `maskSecrets` (`packages/reporter/src/scrub.ts`) masks tokens, channel ids, video paths, query strings and numbers, but not email addresses. To confirm, find a logged Google 403 `reports.query` body, or Google's documented error messages, that names the account. Until then this is theoretical.

Carried from round 1: NFI A (every 403 on a monetary read becomes a cached `not_monetized`; #144 now logs the reason, so the first real 403 settles it) and NFI B (the flaky `video_not_found` test).

## Reviewed and Dismissed

- **A custom range has no maximum length:** by design. #118 says "No maximum length".
- **The countries read has no live check:** #158 grounds it in Google's channel reports page ("User activity by country" with `video==` allows `engagedViews` and `views`). `apps/api/src/video-detail.test.ts:1-14` states the limit and the human step.
- **`ViewsTable.columns`' doc "the day, then its numbers" omits revenue:** no. `ValueColumn` is `NumberColumn | RevenueColumn` (`numbers-table.ts:28`).
- **`signInEvent` counts a returning sign-in as a connection consent continue:** documented on purpose (README:87).
- **`useRangeFallback` replaces the same address twice:** one extra `replaceState`, no loop and no extra read. Both web finders reached that conclusion.
- **`web.test.ts:158` (no cream background token) and `:806` (no inline style on the page) are green at `$BASE`:** standing invariant guards over the whole current sheet and page. They cover what the branch adds, and they hold at base only because the rule held there too.
- **ADR 0013 and `CONTEXT.md` cite the latest video card's "3 of 10 Shorts" (#94), which this branch does not render:** a decision record for the studio extension epic's card (#116 wrote it on purpose). It is not a claim about this branch's UI.
- **`happy-dom` contradicts the epic's "No component tests … adding it adds dependencies":** #145 asked for App rendered in a test. It is a root dev dependency that only `app.test.ts` and `main.test.ts` opt into, and nothing in the bundle or CSP changes. The epic body's sentence is stale; see Before opening the PR.
- **`channel-summary.ts:117-119` writes `everyFormatRevenue !== 0` beside `revenueReportedIn`:** `6abec5a` (#153) replaced a made-up day passed to the predicate. The two agree for every finite amount, and the comment above it explains why the format path cannot use the days.
- **Carried from earlier rounds:** traffic and country share denominators are the sum of the answered rows. `processedThroughOf`'s four-day floor. React style props versus CSP. Preferences RLS, cascade and grants, and `claim_channel` 0015. `signOut` ignoring an HTTP error (pre-existing).

## Minor / nits

- **A reset before the first preferences read lands is undone by that read** (`App.tsx:245-249`, `:339-347`). Recorded in rounds 1 and 2. Opening `/app/profile` directly makes it reachable, because the profile screen does not wait on `preferencesRead`. It still needs "Reset preferences" pressed and confirmed before one GET returns. A `resetSinceRead` ref checked in the read handler would close it, and `app.test.ts` can now drive it.
- **The Since publish table can keep a revenue sort over a hidden revenue column** (`since-publish.ts:90-98`). It does not fall back the way `viewsTableOf` does (`numbers-table.ts:150`). Round 1 recorded it with reachability unverified. It is still unverified, because the sections may unmount behind the placeholder between videos.
- **A toast mounts its `role="status"` element together with its text** (`Toast.tsx:47`), which some screen readers do not announce. The pattern predates the branch, but the branch widened what goes through it. Check it on Nick's VoiceOver pass.
- **The launch chart's blur and a list row's `pointerleave` both clear the one `mark`** (`LaunchChart.tsx:143`, `VideoList.tsx:140-141`). A touch scroll over the list can unmark a row the chart still accents.
- **The launch chart draws an empty, focusable slider** when no row on the page has a processed day (`launch-chart.ts:86-89`). This happens only on a page of very young uploads.
- **A channel with no creation time accepts a custom range from `0001-01-01`** (`apps/api/src/calendar-range.ts:92`). Google's answer to that is unknown. Real channels carry `snippet.publishedAt`.
- **`revenueAfterPublish`'s doc says Google answers "a row of 0 for a video that earned nothing"** (`apps/api/src/video-list.ts:~217`). The fake answers no row for a video with no `rangeMetrics` outside lifetime, so the fake and the comment model Google differently. Settle it with a live check.
- **Toast `release` restarts the timer after `stop()`** (`toast.ts:35-38`). It is reachable only if a handler fires after unmount.
- **A launch chart arrow key on a stale selection does nothing** (`launch-chart.ts:160-165`).
- **Compact axis labels round the data maximum**, so 1,549 is labelled "1.5K" (#152). Accepted as the ticket's design.
- **`apps/site/privacy.html:45,61,113` ship `<!-- Approved word for word in creator-analytics#61 … -->` in the public page source.** This is process metadata in a legal page. Strip HTML comments in the site's include transform, or move the notes to the issue.
- **Lines over 100 characters in comments:**
  - `apps/api/src/window-query.ts:11` (120)
  - `packages/youtube-gateway/src/reads/uploads.ts:74` (108)
  - `apps/web/src/app.css:380` (122)
  - the #144 warn string at `packages/youtube-gateway/src/youtube-gateway.ts:~301` (136)

  Biome does not wrap comments, so these pass lint.
- **Walked-past refactors (CODING_STANDARDS 3):**
  - `apps/api/src/video-detail.ts:95-106`: the countries comparator copies the traffic sources comparator. A `byEngagedViewsThenViews(keyOf)` would serve both.
  - `launch-chart.ts:65` declares a private `runningTotalOf(values: number[])` beside `views-chart.ts:53`'s exported `runningTotalOf(days)`.
  - `Placeholder.tsx`'s after-publish `first1` branch inlines the three bar rows that `PlaceholderBarRows` already draws in `VideoDetail.tsx`.
- **`GET /api/channels/connect/after-sign-in` writes a consent state.** Recorded in round 1, and a cross-site navigation only reaches the victim's own Google consent screen.

## Test quality

- **Tests added or changed:** 60 files (32 new, 28 modified) plus 5 helpers.
- **Oracle at `$BASE`:**
  - Modified files: 971 tests ran; 574 were red and 397 green. All 32 new files are red: 26 fail to import, 2 have no `happy-dom` at base, and the rest have failing assertions. The one exception is `video-revenue.test.ts:954`, a negative guard whose partners are red.
  - The 397 green split as follows:
    - 339 are unchanged in substance.
    - 36 are mechanical fixture or signature edits.
    - 17 are negative guards with a red partner: `sign-in.test.ts:121`, `api video-list.test.ts:461`, `route.test.ts:61,140,151,534`, `thumbnail.test.ts:80,171`, `views-chart.test.ts:78`.
    - 2 are artifacts of copying the `visual-system` test helper; they are red with the base helper.
    - 5 add nothing new. Three are Finding 4. `web.test.ts:158` and `:806` are dismissed as invariant guards.
- **Tautology shapes:**
  - Expected value from production code: `profile.test.ts:41` (Finding 4).
  - `app.test.ts:183` and `:242` assert `toBe(currencySavedNotice)` and `toBe(preferencesResetNotice)`, and no test pins those two strings. Pin them literally in `profile.test.ts`, as `preferences.test.ts:178` does for `failedSaveNotice`. This is a nit beside Finding 4.
  - `components.test.ts:557-561` takes the selected path from `launchChartOf`. That is low risk, because the rule is which line is selected.
  - No mocked unit under test. `fetch`, `confirm` and the heading-hold browser fakes stand in for boundaries.
  - No snapshot and no assertion-free test.
  - `toast.test.ts` is call-shaped on `onEnd`, which is the effect itself, under a fake clock.
- **`app.test.ts`:** the #145 review already rated its 17 tests that are green at base by mutation, because they pin wiring that existed before. Its three finding tests are red at base.

## Before opening the PR

- **CI readiness:** lint, typecheck, build and the full suite are green at `e011005`.
- **Commit hygiene:**
  - Commit this doc together with `docs/reviews/creator-analytics-64/repro/round-3-detail.test.ts` and `round-3-detail.vitest.config.ts`. They sit outside the root vitest include, so only their own config runs them. They pass `pnpm lint`.
  - The branch is 581 commits. Squash or keep as Nick prefers.
- **Spec drift to settle in the PR description:**
  - The epic body still says "No component tests: the repo has no DOM test tooling, and adding it adds dependencies", and "no new library". #145 added `happy-dom` as a dev dependency on purpose. #145's proposals file asks for the epic text to be updated. Do that, or state it in the PR body.
- **Follow-up tickets:**
  - Findings 2 to 4, if they are not fixed now.
  - NFI A and B.
  - Round 1's NFI A and B.
  - The happy-dom spec note.
- **Likely reviewer asks:**
  - The three migrations and their RLS.
  - The overlap on `apps/site/privacy.html` with `creator-analytics-3`.
  - The new dev dependency.
  - The size of the branch.

## Verdict

**Not ready as-is: fix Finding 1, then open the PR. Findings 2 to 4 are LOW and can be fixed now or filed as follow-ups. Finding 3 waits on Nick's approval of the privacy wording.**

- No CRITICAL or HIGH finding was confirmed. Round 2 ended with 4 LOWs. This full re-review of the whole branch, and of the 161 commits since, found 1 MEDIUM and 3 LOWs. The MEDIUM sits in code added after round 2 (#118 meeting #80's guard).
- Rounds 1 and 2's Approach decisions hold. Their open LOW findings were taken into #145, which renders App in a test, and the code is consistent with them.
- Fix-begets-finding does not apply. Finding 1 is a new interaction between two tickets, not a repeat in a subsystem fixed before.

## Remediation: 2026-10-12

Scope: every confirmed finding, the LOW tail included (epic-loop rule: a round with a MEDIUM-or-higher finding fixes every confirmed finding). Finding 3 was blocked on Nick's word-for-word approval of the privacy copy, per its Escalation line; Nick approved the text on 2026-10-12 and it landed in `a531431`, so all four findings are closed. Full checks after the round, rerun after finding 3: `pnpm lint` (361 files), `pnpm typecheck` and `pnpm build` green. `pnpm test` green: 83 files, 1,695 tests (1,691 at review: +6 new, −2 deleted; finding 3 rewrote one test in place).

| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 1 (MEDIUM) | `d60c96f` finding 1: Keep the since publish revenue when a custom range ends before the publish day | red→green: `pnpm exec vitest run --config docs/reviews/creator-analytics-64/repro/round-3-detail.vitest.config.ts`, and the new "with revenue consent, a custom range that ends before the publish day answers the same since publish rows as lifetime, revenue included" in `apps/api/src/video-detail.test.ts`. Two fallback-path tests beside it: a channel outside the YouTube Partner Program (rows without revenue, status 200), and a failed lifetime revenue read (502 `google_failed`, refused at the probe with no later query; red under a mutation that swallows the refusal). `video-detail.test.ts` and `video-revenue.test.ts` green, 91 tests | 1 (the test's why line); 3 existing comments and 2 docs rewritten per the brief | fixed (agent) |
| 2 (LOW) | `1a5797e` finding 2: Count Back and Forward after a step as video_detail_opened | red→green: "counts an arrival by Back or Forward after a step as an open, and the step alone as a step" in `apps/web/src/app.test.ts` (red with 3 events, the last open missing) | 0 net (the ref's comment rewritten per the brief) | fixed (agent) |
| 3 (LOW) | `a531431` finding 3: Name the chart mode among the stored display preferences in the privacy policy | red→green: "the privacy policy says it stores display preferences, the chart mode included, until a reset or a deletion, word for word as approved in creator-analytics#64 pre-PR review 3" in `apps/site/test/site.test.ts` (the old pinned sentence rewritten; red before the copy changed). The sentence read against `packages/database/src/preferences.ts:26-41`: every column except `user_id` is named or covered | 1 (the "Approved word for word in creator-analytics#64 pre-PR review 3" marker over the sentence) | fixed after Nick approved the text word for word on 2026-10-12 (`.epic-loop/stage2/approvals.md`) |
| 4 (LOW) | `73be928` finding 4: Make four tests able to fail on the rule they name | Each replacement goes red under its mutation, then reverted: one code swapped in `revenueCurrencies`; `controlsOf` keeping `range`; the detail's page-2 list query given a stray key. The CSP duplicate and the API quota test are deleted | 0 (2 field docs on the test-only fake API) | proved by execution |

Notes on the round:
- Finding 1 departs from the brief's diff in one place. The brief's helper probed whenever the lifetime range was non-empty. That made a revenue call for a calendar window over a video published after the last processed day, because the lifetime range ends today, not on the last processed day. It broke `apps/api/src/video-revenue.test.ts` "in a calendar window, a video published after the last processed day carries no revenue and makes no revenue call", which the brief's Must preserve names. The probe now runs only for a video with a processed day (`publishDay && publishDay <= processedThrough`), the same condition under which `readSincePublish` makes its own lifetime revenue read. The verify agent confirmed the brief's gate fails exactly that test, and that no case in the finding's scope is left unfixed. Recorded as a run assumption.
- Finding 4's stepper replacement lives in `apps/web/src/app.test.ts`, not in `apps/web/src/video-step.test.ts` as the brief's surface listed. The detail builds its page queries inside `VideoDetail`'s `useListPages` hook, not in a pure function, so only a render of App observes them. `apps/web/src/fake-api.ts` gained `videos` and `pageCount`, both defaulting to the previous single video and page.

### Known regressions, deferred
- None. The verify pass reported no introduced defect.

### Notes from verification, not defects
- Predates this round and is outside the finding's scope: for a video published after the last processed day, the Since publish rows still depend on the window. A first-N or lifetime window answers zero-revenue rows in the saved currency, and a calendar window answers rows without revenue. The processed-day gate above keeps this on purpose. It is recorded as a stage 2 proposal.
- No committed test asserts that a detail without revenue consent, whose window ends before the publish day, makes zero revenue calls. The verifier's scratch test showed that it holds.

### Rework briefs
- None. No rework pass was needed.

## Approach decisions (remediation round 3)
- **Since publish revenue under an empty window (F1):** probe the channel's revenue status with one `videoWindowRevenue` read over the lifetime range (`lifetimeRevenueCurrencyOf`), only for a video with a processed day. Precedent: `sincePublishDaysOf`'s read-then-`isRevenueRefusal` fallback.
- **Product event once per arrival (F2):** a ref that marks a step is consumed by the next open effect, after the StrictMode `opened` guard.
- **Testing what App wires (F4):** a rule that lives in a hook is pinned through `app.test.ts` against the fake API, which takes `videos` and `pageCount` when a test needs more than one video or page.
