# Pre-PR review: creator-analytics#265 API correctness after #64: shared day rules, one revenue union, and Since publish revenue

**Branch:** `creator-analytics-265-api-correctness` vs `origin/main` (merge-base `d34e9f2` "creator-analytics#253 The OG image for the marketing site")
**Reviewed at:** HEAD `d04fa0c` ("creator-analytics#167 Since publish revenue for a video published after the last processed day differs by window"). The tree was clean, with no uncommitted or untracked files at review time. 35 files, +642 / −262, 16 commits (#172, #173 and its api-types dependency commit, #174, #189, #167, #178, and their merges).
**Reviewed against:** the epic body of creator-analytics#265 (its End state, Implementation Decisions and Testing Decisions are the spec), `CODING_STANDARDS.md` 1 to 3. No plan or spec docs under `docs/`, no prior review of this epic, `--fresh`.
**Date:** 2026-10-19
**Reviewer:** 3 code-review agents, 1 test-oracle agent, and a verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | ok |
| Lint | `pnpm lint` (biome, 468 files) | pass |
| Typecheck | `pnpm typecheck` (every package and app) | pass |
| Build | `pnpm build` | pass |
| Full suite | `pnpm test` (Testcontainers Postgres, Docker up) | 110 files, 2332 passed, 1 expected fail, 0 failed |
| No local Pacific day copy left | `git grep "America/Los_Angeles\|en-CA" -- apps packages` | only `packages/api-types/src/days.ts:62`; extension `states.ts` and `sample-studio.ts` hits are display locale formatters, not day keys |
| Old list revenue fields gone | `git grep "revenueCurrency\|revenueReported\|revenueRefusal"` | no reader of the old `VideoListAnswer` trio; remaining `revenueCurrency` hits are `SincePublish.revenueCurrency`, a different type |
| `isWindowFinished` equals base `partialOf` | read against `git show d34e9f2:apps/api/src/window-after-publish.ts` | identical: `daysFrom(p, lpd) + 1 >= of`, publish day as day 1; `!== null` vs falsy differs only for `''`, which `publishDayOf` never returns |
| Web list revenue reads equal the old trio | truth table over absent, `consent_missing`, `not_monetized`, `reported: false`, `reported: true` | `reportsNoRevenue`, `revenueNoteOf`, `listRevenueCurrencyOf` agree with base on every input |
| `refusal?: never` makes the union reject a refusal with a currency | scratch tsc check (agent) | plain union accepts `{ refusal, currency, reported }`; the branch's type rejects it as a literal |
| Gateway error log masking | read `spend` and `packages/reporter` | message goes through the logger's masking; `packages/reporter/src/logger.test.ts` "a log line holds no token and no analytics value" pins it |
| Finding 1 | executed repro, `repro/no-publish-day-list-vs-detail.repro.ts` | confirmed: list row 1001 views, detail 0, same video, same window |
| Tautology audit | branch tests copied into a scratch worktree at `d34e9f2`, run with vitest and `tsc` | 58 test runs plus 2 type fixtures; 6 green at base on both checks, each a mechanical rewrite whose partner is red; 1 self-comparison and 2 comparison-only assertions (finding 4) |
| Web whole-app tests with the branch's fake | the 4 new `app.test.ts` tests run at base with the branch's `fake-api.ts` | all 4 red on production behaviour ("expected '' to be '$12.50'", "expected '7' to be '3'") |
| Not run | live Google | cannot observe whether Google omits `videoPublishedAt` for a private upload, which decides finding 1's severity |

**Overall:** Every requirement of the epic holds, and all four CI checks are green. The union, the shared day and predicate, the publish day top's `publishedAt`, the error reason log and the no-processed-day revenue rule all behave as the spec asks, and every reader moved with the contract. One MEDIUM (capped) finding: the spec's decision that a video with no publish day counts no day makes its detail show zeros in a calendar or lifetime window, while its list row shows Google's numbers for the same window. That needs Nick's call before the PR opens, because the fix reverses a written decision. The rest is LOW.

## Approach decisions
- No-processed-day rule in `videoDetail`: one named predicate, `!publishDay || isAwaitingProcessing(publishDay, processedThrough)`, gates both revenue reads; the answer's `awaitingProcessing` stays `isAwaitingProcessing` alone (false for a null publish day). Precedent: `readSincePublish`'s `!publishDay || daysSincePublish === undefined` guard, which already states both halves.
- A null publish day's numbers (finding 1): recommended to read over the window's own range in a calendar, lifetime or custom window, as `d34e9f2` did, and to gate only revenue and the Since publish rows. This overturns the epic's #189 decision ("the video detail's range treats a null publish day as no day"), so it waits on Nick.

## Confirmed Issues
### 1. A video with no publish day shows zeros in its detail and Google's numbers on its list row, in the same calendar or lifetime window — MEDIUM
- **Location:** `apps/api/src/video-detail.ts:177` (`firstDay`), `:43-46` (`videoRangeOf`), `:183-194`
- **Attribution:** introduced by `3072952` ("creator-analytics#189 Since publish revenue for a video with no publish day differs by window"). At base, `git show d34e9f2:apps/api/src/video-detail.ts` line 42-45: `videoRangeOf(range, publishDay: string | null)` used `range.startDate` for a null publish day, so the detail read the window's own days, as the list does. The list (`apps/api/src/video-list.ts:414-419`) reads `videoMetrics` over `span.calendar` for every upload and is unchanged.
- **Real-world trigger:** a creator lists with visibility "all" and a private upload that was never published or scheduled, for which YouTube gives no `videoPublishedAt` while Analytics answers views (the owner's own plays). The list shows its views; opening it shows 0 views in last28, lifetime or a custom range. MEDIUM, capped (wrong result silently delivered, no proven user path): upgrade to HIGH if a live `playlistItems.list` or `videos.list` read of such a private upload returns no `videoPublishedAt` while the Analytics API answers numbers for it. Check via a private never-published test upload on Nick's channel.

**Evidence**
```ts
  // A video with no publish day has no day, as a window after publish counts it, so every window
  // agrees (#189).
  const firstDay = publishDay ?? addDays(today, 1)
  ...
      : videoRangeOf(span.calendar, firstDay)
```
**Failure mode** — upload `video-1`, private, no `publishedAt`, lifetime metrics 1000 engaged views / 1001 views. `GET /videos?window=lifetime&visibility=all` row: `publishedAt: null`, `views: 1001`. `GET /videos/video-1?window=lifetime`: `totals.views: 0`, `days: []`. Proved by `repro/no-publish-day-list-vs-detail.repro.ts` (green = defect present). The epic premise was that the rule "is correct whether or not Google omits `videoPublishedAt`"; it is correct for revenue and the Since publish rows, not for the window's numbers.

**Recommended fix** — Decision required from Nick (it reverses the #189 implementation decision). Options: (a) keep the detail as-is and make the list count no day for a null publish day too (widens the epic into the list); (b) recommended: revert the numbers to the window's own range and keep the revenue rule, so the detail and list agree on numbers and the no-revenue-call rule still holds; (c) keep both as-is and record the asymmetry in the `VideoDetailAnswer` doc. Diff for (b):
```diff
-function videoRangeOf(range: DateRange, firstDay: string): DateRange {
-  const startDate = firstDay > range.startDate ? firstDay : range.startDate
+function videoRangeOf(range: DateRange, publishDay: string | null): DateRange {
+  const startDate = publishDay && publishDay > range.startDate ? publishDay : range.startDate
   return { startDate, endDate: range.endDate }
 }
@@
   const publishDay = publishDayOf(upload)
-  // A video with no publish day has no day, as a window after publish counts it, so every window
-  // agrees (#189).
-  const firstDay = publishDay ?? addDays(today, 1)
   const lastProcessed = await readChannel('lastProcessedDay', lastProcessedDaySearch(today))
   if (!lastProcessed.ok) return lastProcessed
   const processedThrough = processedThroughOf(lastProcessed.value, today)
+  const unprocessed = !publishDay || isAwaitingProcessing(publishDay, processedThrough)
@@
   const lifetimeRange = videoRangeOf(
     rangeOf('lifetime', today, createdAt, processedThrough),
-    firstDay,
+    publishDay,
   )
@@
-      ? rangeAfterPublish(span.afterPublish, firstDay, today)
-      : videoRangeOf(span.calendar, firstDay)
+      ? rangeAfterPublish(span.afterPublish, publishDay ?? addDays(today, 1), today)
+      : videoRangeOf(span.calendar, publishDay)
@@
   const revenue =
-    range.startDate > range.endDate || isAwaitingProcessing(publishDay, processedThrough)
+    range.startDate > range.endDate || unprocessed
       ? null
       : await revenuePartOf(readChannel, request, currency)
@@
-    : publishDay && publishDay <= processedThrough
+    : !unprocessed
       ? await lifetimeRevenueCurrencyOf(readChannel, { ...lifetimeRange, videoId }, currency)
```
The `videoRangeOf` doc goes back to its base wording ("from the later of the window's first day and the video's publish day. A video not yet published has none, so the range runs backwards."), and the revenue comment above `const currency` must say the no-processed-day rule covers a video with no publish day.

**Remediation brief**
- **Design intent:** `videoDetail` reads one window's numbers over `range` (the window clipped to the video's days) and, separately, revenue and the Since publish rows, which do not depend on the window. Since publish already returns zero rows with no revenue for a null publish day (`readSincePublish`'s early return). The #265 rule is about revenue: a video Google has processed no day of (published after the last processed day, or no publish day) carries no revenue and costs no revenue call in any window. Numbers in a calendar, lifetime or custom window are whatever Google answers for those days, the same reads the list makes.
- **Full surface:** `apps/api/src/video-detail.ts:38-46` (`videoRangeOf` and its doc), `:175-177` (`firstDay` and its comment), `:183-186` (`lifetimeRange`), `:190-193` (`range`), `:197-205` (revenue guard and its comment), `:206-218` (`sincePublishCurrency` branch and its comment); `apps/api/src/video-detail.test.ts:549` (the test that pins the overturned rule, rewrite to: a video with no publish day counts the window's own days in a calendar, lifetime or custom window, and no day in a first-N window); `packages/api-types/src/video-detail.ts:114-117` (`VideoDetailAnswer` doc, should say a window after publish counts no day for a video with no publish day). Option (a) instead touches `apps/api/src/video-list.ts:414-419` and the list's revenue read at `:396-403`.
- **Must preserve:** no revenue call and no `revenue` for a null-publish-day video in any window, `apps/api/src/video-revenue.test.ts:982` ("a video with no publish day answers the same since publish rows, with no revenue, ..."); no revenue for an awaiting video in any window, `video-revenue.test.ts:946`; `awaitingProcessing: isAwaitingProcessing(publishDay, processedThrough)` at `:252` stays false for a null publish day (the web shows "not processed yet" only for an awaiting answer); the first-N range for a null publish day stays backwards (`rangeAfterPublish(..., today + 1, today)`); `partialOf(afterPublish, publishDay, ...)` unchanged; `lifetimeRange` stays the range the lifetime window reads, so the Since publish lifetime row shares its cache entry (with a null publish day `readSincePublish` returns before reading it).
- **Do not touch:** `readSincePublish`'s forced `false` in its early return (`apps/api/src/since-publish.ts:124-126`), see Dismissed; the list's per-row revenue for an awaiting video (Dismissed, spec scope).
- **Proof:** `cd docs/reviews/creator-analytics-265/repro && ../../../../node_modules/.bin/vitest run --config vitest.config.ts` is green now (defect present) and must go red on its last assertion (`detail.totals.views` is 1001) after option (b); then `pnpm exec vitest run apps/api/src/video-detail.test.ts apps/api/src/video-revenue.test.ts`.

### 2. `videoDetail` spells the no-processed-day rule three ways, and the null publish day half rests on ranges running backwards — LOW
- **Location:** `apps/api/src/video-detail.ts:203`, `:216`, `:252`
- **Attribution:** introduced by `2fa72a3` ("creator-analytics#167 ...") at `:203`, beside `:216` and `:252`, which `d34e9f2` already had. CODING_STANDARDS.md 3 (a walked-past refactor on a line the change touches).
- **Real-world trigger:** none today; every window range ends on or before today, so `firstDay = today + 1` makes the null case backwards. A later window ending after today would read revenue for a draft with no test of the guard's wording to say why. LOW, no user path.

**Evidence**
```ts
    range.startDate > range.endDate || isAwaitingProcessing(publishDay, processedThrough)
    ...
    : publishDay && publishDay <= processedThrough
    ...
      awaitingProcessing: isAwaitingProcessing(publishDay, processedThrough),
```
**Failure mode** — `isAwaitingProcessing(null, ...)` is false, so the comment's "neither has a video Google has processed no day of since publish, in any window" is carried for a null publish day only by `range.startDate > range.endDate`. The rule exists once in `readSincePublish` (`!publishDay || daysSincePublish === undefined`) and in pieces here.

**Recommended fix** — when finding 1 takes option (b), its diff already carries this. Otherwise:
```diff
   const processedThrough = processedThroughOf(lastProcessed.value, today)
+  const unprocessed = !publishDay || isAwaitingProcessing(publishDay, processedThrough)
@@
-    range.startDate > range.endDate || isAwaitingProcessing(publishDay, processedThrough)
+    range.startDate > range.endDate || unprocessed
@@
-    : publishDay && publishDay <= processedThrough
+    : !unprocessed
```
**Remediation brief**
- **Design intent:** one predicate names "Google has processed no day of this video since publish" and gates the detail's revenue read and the lifetime revenue currency read. The answer's `awaitingProcessing` is a different fact (published after the last processed day) and keeps its own call.
- **Full surface:** `apps/api/src/video-detail.ts:180` (new const after `processedThrough`), `:203`, `:216`.
- **Must preserve:** `:252` unchanged; `!unprocessed` equals `publishDay && publishDay <= processedThrough` for every input, so `video-revenue.test.ts:946`, `:982` and `video-detail.test.ts:549` stay green.
- **Do not touch:** `isAwaitingProcessing` in `apps/api/src/calendar-range.ts:49-51` (the list and the answer field depend on it being false for a null publish day).
- **Proof:** `pnpm exec vitest run apps/api/src/video-detail.test.ts apps/api/src/video-revenue.test.ts` stays green; `pnpm typecheck`.

### 3. The general error log's "reason none" fallback has no test — LOW
- **Location:** `packages/youtube-gateway/src/youtube-gateway.ts:186-188`, used at `:253-256`
- **Attribution:** introduced by `3208e08` ("creator-analytics#174 Log Google's error reason on the non-revenue error path too"). `git grep "reason none\|Backend Error" -- '*.test.ts'` finds no assertion.
- **Real-world trigger:** Google answers a 5xx with no `errors` array (the fake's `failAnalytics(500)` body). A change that dropped the `?? 'none'` would log "reason undefined" with every check green. LOW (log legibility).

**Evidence**
```ts
function reasonText({ reason, message }: GoogleError): string {
  return `reason ${reason ?? 'none'}: ${message ?? 'none'}`
}
```
**Failure mode** — the only test of the line (`apps/api/src/channel-summary.test.ts:930`) sends a body with a reason. The bound rule "a test for every fallback path" is unmet.

**Recommended fix** — add a test beside `channel-summary.test.ts:930`:
```ts
  test("Google's error with no reason is logged as an error with reason none, and its status", async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    api.google.failAnalytics(500)

    const summary = await readSummary(browser, channelId)

    expect(summary).toEqual({ status: 502, body: { refusal: 'google_failed' } })
    expect(api.logs.map((line) => JSON.parse(line))).toContainEqual({
      level: 'error',
      message: 'The YouTube analytics API answered a call with an error, reason none: Backend Error',
      context: { status: '500' },
    })
  })
```
**Remediation brief**
- **Design intent:** `spend` logs every unexpected Google error at error with Google's reason and message in the masked message and the status in the context; the revenue 403 is logged at warn by `googleCalls` instead (`expectedStatus` keeps `spend` from logging it twice).
- **Full surface:** `apps/api/src/channel-summary.test.ts` (new test after `:951`).
- **Must preserve:** the `failAnalytics(500)` body (`googleError(status, 'Backend Error')`, `packages/fake-google/src/index.ts:621-628`) that `channel-summary.test.ts:1227`, `video-detail.test.ts:1523` and `video-list.test.ts:2366` use.
- **Do not touch:** the revenue 403 warn line, which keeps its text.
- **Proof:** `pnpm exec vitest run apps/api/src/channel-summary.test.ts -t "reason none"` passes; replacing `reason ?? 'none'` with `reason` turns it red.

### 4. Three new assertions pass on wrong output — LOW
- **Location:** `packages/api-types/src/days.test.ts:57-60`; `apps/api/src/video-revenue.test.ts:968-978` and `:1006-1016`
- **Attribution:** introduced by `33b24ea` (#173), `2fa72a3` (#167) and `3072952` (#189). All three tests are red at base (the tautology audit), so each guards something; these assertions inside them do not.
- **Real-world trigger:** none for users; a regression the tests claim to catch would pass. LOW.

**Evidence**
```ts
    expect(pacificDayOf(time)).toBe(pacificDayOf(time.toISOString()))
    ...
      for (const row of detail.body.sincePublish.rows) {
        expect(row).not.toHaveProperty('estimatedRevenue')
      }
    ...
      expect(detail.body.sincePublish).toEqual(first?.body.sincePublish)
```
**Failure mode** — a `pacificDayOf` that returns a constant passes `days.test.ts:59`. In both video-revenue tests, a `readSincePublish` that answered `rows: []` passes: the row loop asserts nothing and every window equals every other. In the #167 test, `last7` and the custom range end before the publish day, so they passed at base whatever the guard does; the comment says where they end but not that they cannot go red.

**Recommended fix**
```diff
-  test('a time and its ISO text fall in the same day', () => {
-    const time = new Date('2026-10-07T05:00:00Z')
-    expect(pacificDayOf(time)).toBe(pacificDayOf(time.toISOString()))
+  test('a time given as a Date falls in its Pacific day, as its ISO text does', () => {
+    expect(pacificDayOf(new Date('2026-10-07T05:00:00Z'))).toBe('2026-10-06')
   })
```
and in each of `video-revenue.test.ts`'s two loops, add `expect(detail.body.sincePublish.rows.map(({ stage }) => stage)).toEqual(['first1', 'first7', 'first28', 'first90', 'first365', 'lifetime'])`. Extend the #167 test's comment to say `last7` and the custom range already carried no revenue before #167, and that `first7` and `lifetime` are the windows the rule changed.

**Remediation brief**
- **Design intent:** each test states one rule against a hand-written expectation (CODING_STANDARDS.md 2, "a test builds only its input, and observes only real output").
- **Full surface:** `packages/api-types/src/days.test.ts:57-60`; `apps/api/src/video-revenue.test.ts:953-954` (comment), `:968-975`, `:1006-1015`.
- **Must preserve:** the existing assertions (no `revenue`, no `revenueCurrency`, `revenueQueriesOf(api)` empty, cross-window equality). Do not delete either test: both are the red-to-green proofs of #167 and #189.
- **Do not touch:** `video-detail.test.ts`'s `unprocessedRows()` tests, green at base by design (a helper cleanup).
- **Proof:** `pnpm exec vitest run packages/api-types/src/days.test.ts apps/api/src/video-revenue.test.ts` green.

### 5. Comment hygiene — LOW (aggregated)
- `apps/api/src/since-publish.ts:94-96` — "With a currency, the detail's revenue answered, and every row carries revenue in it." → "With a currency, which a video Google has processed no day of never gets, the detail's revenue answered, and every row carries revenue in it."
- `apps/api/src/since-publish.ts:89-91` — "makes no query and has zeros, with no revenue on any row whatever the currency." → "makes no query and has zeros, with no revenue on any row." (the caller never passes a currency for such a video)
- `packages/api-types/src/video-detail.ts:115-117` — "counted from the later of the window's first day and the video's publish day." → add "A video with no publish day counts no day in any window." (or, after finding 1 option (b), "in a window after publish")
- `packages/api-types/src/days.ts:4-8` — "Days as the API and the web app write them ... Both apps read a custom range's `from` and `to` with `customRangeOfDays`" → keep, and add that the module also holds the Pacific reporting day and the finished stage rule that the gateway, the fake Google server, the web app and the extension read.
- `packages/youtube-gateway/src/youtube-gateway.ts:133-136` — "`pacificDayOf` from api-types, which the fake Google server and the web app read too." → "`pacificDayOf` from api-types." (the consumer list already omits the extension and will rot)
- `apps/web/src/VideoList.tsx:360-362` — "The page's rows go last, so a row wins, though both come from this one answer." → delete the sentence (both entries carry the same values, so the order has no effect)
- `apps/web/src/since-publish.ts:150` — "Remembers each video's publish date from an answer" → "Remembers each video's publish date from an answer, a list row or a publish day top video"

## Needs Further Investigation
None.

## Reviewed and Dismissed
- A revenue read answered with a non-403 error now logs the reason text through `spend` — intended and documented at `youtube-gateway.ts:289`; the spec's "the revenue path doesn't change" refers to the revenue 403 warn, which is byte-identical.
- `refusal?: never` rejects a refusal with a currency only as a literal — the type's doc claims only the literal check, and `video-list.ts:407-413` builds both members as literals.
- An awaiting video's list row carries `estimatedRevenue: 0` in lifetime while its detail carries no revenue — the spec puts each row's own revenue out of scope.
- `VideoListAnswer.revenue` is optional though `listVideos` always sets it — the spec's AC names `revenue?`, and every fixture relies on it.
- The extension's test fixture did not move to the union — it never read the trio at `d34e9f2` (`git grep revenueCurrency d34e9f2 -- apps/extension` is empty); only the site stub did, and it moved.
- The #174 test's no-token and no-channel-id assertions cannot go red for this change — masking of the message is pinned by `packages/reporter/src/logger.test.ts` ("a log line holds no token and no analytics value").
- `isWindowFinished` checks `!== null` where `partialOf` checked falsy — differs only for `''`, never produced.
- `readSincePublish`'s early return forces `false` where it read `currency !== null` — unreachable with a currency from its one caller, but it keeps the rule in the module that owns the rows. Keep; only its doc changes (finding 5).
- List and detail read `lastProcessedDay` separately, so a rollover between them can shift the placeholder by a row — pre-existing for list rows.
- `knownVideos` keeps a top video's entry with an older `lastProcessedDay` after a calendar-window answer — pre-existing for page rows; a Back to an after-publish list re-remembers.

## Minor / nits
- `apps/web/src/VideoDetail.tsx:350-351` remembers only `view.answer.videos` from the detail screen's step reads, not `publishDayTop`, so a deep link to a top-only video holds 7 rows until its answer lands. A recorded #178 assumption; a deep link is not "opened from the top".
- `packages/youtube-gateway/src/quota-day.test.ts` now drives the same function as the new DST tests in `days.test.ts`; it states a different rule (the quota day), so it stays, but `expect(quotaDayOf).toBe(pacificDayOf)` would state it with no duplicate arithmetic.
- The new whole-app list revenue tests in `apps/web/src/app.test.ts:164-211` overlap the edited unit tests in `apps/web/src/video-list.test.ts:1211-1360`. The spec prefers the app tests; the unit cases they cover could go.
- `apps/web/src/fake-api.ts:197` builds `channelPath` from `fakeChannel.id` while `api.channel` is now settable; a test that changes the id would 404 on every channel route. `summaryOf` (`:69`) answers `consent_missing` even when `api.channel` carries consent.
- `pacificDayOf('2026-10-07')` returns `2026-10-06` (day text parses as UTC midnight), as every replaced copy did; no caller passes day text. Its doc could say "an ISO 8601 time". A module-level formatter would save one `Intl.DateTimeFormat` per call.
- No type fixture pins `PublishDayVideo.publishedAt` as required; a `@ts-expect-error` literal without it would.
- The #174 test sits in `describe('seam 1: revenue in the channel summary')` though it is about a read without revenue.

## Test quality
Tests added or changed: 58 runs plus 2 type fixtures · green against `d34e9f2` on both vitest and tsc: 6 (web `sourcesButtonShownOf` and `sourceColumnsShownOf` positive halves and the `unreported` cells case from `167c7f4`, the two `unprocessedRows()` tests from `2fa72a3`, and the `publishDayVideoWithoutTitle` fixture from `ef89df1`), each a mechanical rewrite or a finding's proof whose partner is red; keep all six · tautology shapes found: 3 assertions (finding 4) · no mocked unit, no snapshot, no assertion-free test, no copy test (the two literal note strings in `video-list.test.ts` observe a branch through its text).

## Before opening the PR
- **CI readiness:** lint, typecheck, build and test all green at `d04fa0c`.
- **Commit hygiene:** commit this doc and `repro/`. `.epic-loop/` is gitignored.
- **Likely reviewer asks:** finding 1 (why does a draft show views in the list and none on its page); the flaky `apps/api/src/event-relay.test.ts` send-timeout test seen at the run's start gate (passed here).

## Verdict
Ready with follow-ups. No finding blocks the PR against the epic's spec. Finding 1 should be settled by Nick before the PR opens, because its recommended fix reverses the #189 decision; findings 2 to 5 are LOW and can be remediated in this branch or ship as follow-ups.

## Remediation — 2026-10-19
| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 1 (MEDIUM) | — blocked | repro re-run at HEAD `3a5f5f3` (tree unchanged in code since `d04fa0c`): `cd docs/reviews/creator-analytics-265/repro && ../../../../node_modules/.bin/vitest run --config vitest.config.ts` is green, so the defect is still present | — | blocked: needs Nick's decision. Every option reverses or widens a written decision: the #189 "Decision, 2026-10-18" on the issue ("`videoRangeOf` treats a null publish day as "no day"") and the #265 Implementation Decision "A null publish day (#189). The video detail's range treats a null publish day as no day", which this doc's own Approach decisions line says "waits on Nick". The brief's recommended option (b) is fully briefed and unblocked once Nick picks it. |
| 2 (LOW) | — deferred | — | — | LOW tail, default scope (eng-pipeline#34). Option (b) for finding 1 carries this fix in its diff. |
| 3 (LOW) | — deferred | — | — | LOW tail, default scope (eng-pipeline#34) |
| 4 (LOW) | — deferred | — | — | LOW tail, default scope (eng-pipeline#34) |
| 5 (LOW, comment hygiene) | — deferred | — | — | LOW tail, default scope (eng-pipeline#34). Its `packages/api-types/src/video-detail.ts:115-117` entry depends on the finding 1 option chosen. |

No code changed this round, so no verify pass ran and no regressions were introduced.

### Known regressions, deferred
None.

### Rework briefs
None.

### Decision needed from Nick (finding 1)
A private, never-published upload with no publish day shows Google's numbers on its list row and zeros on its detail page in a calendar, lifetime or custom window. Pick one: (a) the list also counts no day for such a video (widens the epic into the list, `apps/api/src/video-list.ts:396-419`, and matches the open proposal in `.epic-loop/tickets/189/proposals.md`); (b) recommended: the detail reads the window's own days for its numbers again and keeps the no-revenue rule, so list and detail agree and no revenue call is made (the diff in finding 1, which amends the #265 Implementation Decision for #189 to cover revenue and the Since publish rows only); (c) keep both and document the asymmetry on `VideoDetailAnswer`. The next remediation round can run (b) from finding 1's brief as written once the decision is recorded in a Remediation scope note.

## Remediation scope, 2026-10-20
Nick chose option (b) for finding 1. The next remediation round fixes finding 1 by its brief as written: in a calendar, lifetime or custom window, the detail reads a null publish day video's numbers over the window's own range, as `d34e9f2` did, and keeps no revenue and no revenue call. This narrows the #265 Implementation Decision for #189 to revenue and the Since publish rows, and reverses #189 assumption 17. Findings 2 to 5 (LOW) stay deferred, except where finding 1's fix closes part of finding 2 or a finding 5 entry on its own. The epic body edit for the narrowed decision is Nick's, at close-out, not the remediation's.

## Remediation — 2026-10-20
| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 1 (MEDIUM) | `caeee90` creator-analytics#265 pre-PR review 1 finding 1: a video with no publish day shows zeros in its detail and Google's numbers on its list row | red→green: the rewritten `apps/api/src/video-detail.test.ts` test "a video with no publish day counts the window's own days in a calendar, lifetime or custom window, and no day in a window after publish" (`pnpm exec vitest run apps/api/src/video-detail.test.ts -t "no publish day"`), red before the fix; the repro `cd docs/reviews/creator-analytics-265/repro && ../../../../node_modules/.bin/vitest run --config vitest.config.ts` goes red on its last assertion ("expected 1001 to be +0"), as the brief said it must. Preserve suites `apps/api/src/video-detail.test.ts`, `apps/api/src/video-revenue.test.ts`, `packages/fake-google` green; full checks green (lint, typecheck, build, `pnpm test` 110 files, 2332 passed, 1 expected fail) | 0 new (the comment gate prints only the brief-directed rewrites of the existing `videoRangeOf` doc, the revenue comment above `const currency`, the `VideoDetailAnswer` doc, and the fake summary's doc) | fixed (1 `pr-review-finder` disprove agent, run because the fix reached the shared fake Google server). Three LOW notes, none blocking: the fake doc said "publish day" where its check reads a publish time (fixed in `dd85aaa`); the rewritten test leaves its no-revenue-call assertion to `video-revenue.test.ts:982`, which now covers the calendar, lifetime and custom windows for real; the `videoRangeOf` doc does not spell out the null case (base wording, as the brief directs) |
| 1 rework follow-up | `dd85aaa` creator-analytics#265 pre-PR review 1 finding 1 rework: the fake's one-video summary doc names a missing publish time, which its check reads, not a missing publish day | prose only, read against the code it describes (`upload?.publishedAt`); `pnpm lint`, `apps/api/src/video-detail.test.ts` and `packages/fake-google` green | 0 new (a reworded existing doc line) | prose correction, no re-verify (comment hygiene rule) |
| 2 (LOW) | closed by `caeee90` | the finding's own recommended diff is part of finding 1's option (b) diff: one `unprocessed` predicate gates both revenue reads, `awaitingProcessing` unchanged | — | closed by finding 1, as the scope note allows |
| 3 (LOW) | — deferred | — | — | LOW tail, default scope (eng-pipeline#34) |
| 4 (LOW) | — deferred | — | — | LOW tail, default scope (eng-pipeline#34) |
| 5 (LOW, comment hygiene) | partly closed by `caeee90` | its `packages/api-types/src/video-detail.ts:115-117` entry, in the option (b) wording ("no day for a video with no publish day" in a window after publish) | — | the other six entries stay deferred, LOW tail (eng-pipeline#34) |

Finding 1 reached one site its brief did not list: `packages/fake-google/src/reports/video-window-summary.ts`. The fake's one-video summary answered a video's lifetime numbers only when the video had a publish time. After the option (b) fix, the detail and the list ask for the same lifetime range for a draft, but the fake answered the list and not the detail, so neither the brief's repro nor the new test could go red against real behaviour. A video with a publish time keeps the old check unchanged. One with none now uses `coversLifetime(query, channel)`, as the fake's list report `videoTotals` already does. That site is the whole extra surface: `videoWindowSummary` is the only fake report with that check.

### Known regressions, deferred
None.

### Rework briefs
- Fake one-video summary doc (`dd85aaa`): must say that the draft branch keys on a missing publish time (`publishedAt`), which also covers a scheduled upload. It must keep the code and the old check for a video with a publish time unchanged. Proof: read the doc against `upload?.publishedAt`, then `pnpm lint`.

## Approach decisions
- No-processed-day rule in `videoDetail` (finding 1, carried forward and applied in `caeee90`): one named predicate, `unprocessed = !publishDay || isAwaitingProcessing(publishDay, processedThrough)`, gates the detail's revenue read and the lifetime revenue currency read. The answer's `awaitingProcessing` stays `isAwaitingProcessing` alone. Precedent: `readSincePublish`'s `!publishDay || daysSincePublish === undefined` guard.
- A null publish day's numbers (finding 1, settled by Nick's 2026-10-20 scope note, applied in `caeee90`): in a calendar, lifetime or custom window the detail reads them over the window's own range, as `d34e9f2` did. A window after publish counts no day (a backwards range from `today + 1`). This narrows the #189 decision to revenue and the Since publish rows.
- The fake's per-video lifetime numbers for a video with no publish time (`caeee90`): a range starting on or before the channel's creation day covers its lifetime. Precedent: `videoTotals` in `packages/fake-google/src/reports/video-totals.ts`, through `coversLifetime` in `report.ts`. A video with a publish time keeps "a range starting on or before its publish day".
