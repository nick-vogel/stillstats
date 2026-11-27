# Pre-PR review: creator-analytics#265 API correctness after #64, round 3 (the five close-out follow-ups)

**Branch:** `creator-analytics-265-api-correctness` vs `origin/main` (merge-base `c05d863` "creator-analytics#34 The OAuth runbook's shot list answers Google's 2026-10-19 rejection")
**Reviewed at:** HEAD `bbbbb49` ("creator-analytics#298 Spend no Analytics read on the numbers of a video awaiting processing in a first-N or lifetime window"). The tree was clean, with no uncommitted or untracked files at review time. Full branch surface: 56 files, +1383 / −303, 38 commits.
**Delta under review:** since `e30bb8a` ("creator-analytics#265 pre-PR review 1 remediation closure table"), the HEAD that `pre-pr-review-2.md` reviewed. 33 code files, +244 / −60, from #295 (`3a24b34`), #261 (`e9613b8`), #296 (`5a79015`), #297 (`ee3fda8`) and #298 (`3e4e4c2`) with their merge commits, plus `pre-pr-review-2.md` itself and `docs/oauth-verification.md`, which arrived from `origin/main` in the merge `63bfc2f` and is outside the branch surface.
**Reviewed against:** creator-analytics#295, #296, #297, #298 and #261 (their bodies and Done-when lists), `CODING_STANDARDS.md` 1 to 3, `pre-pr-review-2.md` (its findings, Approach decisions and Dismissed list), `pre-pr-review-1.md` (Approach decisions).
**Date:** 2026-10-20
**Reviewer:** 2 code-review agents, 1 checks and revert agent, 1 differential-harness agent, and a verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | ok, lockfile unchanged |
| Lint | `pnpm lint` (biome, 470 files) | pass |
| Typecheck | `pnpm typecheck` | pass |
| Build | `pnpm build` | pass (extension, site, web) |
| Full suite | `pnpm test` (Testcontainers Postgres, Docker up, `TEST_DATABASE_ADMIN_URL` unset) | 110 files, 2339 passed, 1 expected fail, 0 failed. `apps/api/src/event-relay.test.ts` passed in the run and alone (220 ms) |
| #297 differential harness | old (`e30bb8a`) and new (`bbbbb49`) `isWindowFinished`, `partialOf`, `engagedViewsByDayOf`, the `daysSincePublish` expression and the extension's `daysProcessedOf`, run in one process over every window, a null publish day and every offset from −400 to +10 days around five last processed days, Pacific-midnight times in summer and winter, compared with `util.isDeepStrictEqual` (agent; harness kept in the session scratchpad, not preserved because it proved no finding) | 80,280 cases plus 64,224 on the extra days, 0 mismatches. A planted off-by-one is caught |
| Tautology audit, `days.test.ts` | the HEAD file run at `e30bb8a` in a scratch worktree | red: all 6 new tests, `daysProcessedSince is not a function` |
| Tautology audit, `video-detail.test.ts` | the new awaiting test and the two changed since publish tests run at `e30bb8a` | all 3 red: the new test on non-zero totals, the other two on the detail's own day query `2026-10-05..2026-10-07` |
| Tautology audit, `event-relay.test.ts` | the HEAD test and `apps/api/test/fake-openpanel.ts` run at `e30bb8a` | red after 3011 ms: the old relay ignores `sendTimeout`, its own 3 s timer fires, and the reported error is not the injected reason |
| Tautology audit, type fixtures | `listWithoutRevenue`, `summaryRevenueRefusedWithCurrency`, `detailRevenueRefusedWithCurrency` in `apps/api/test/answer-types.ts`, typechecked at `e30bb8a` (agent), and against the old shapes rebuilt from HEAD's types (second agent) | all 3 red: TS2578 unused `@ts-expect-error` |
| Revert R1: the `awaiting` short-circuit in `videoDetail` dropped | scratch worktree, `video-detail.test.ts` and `video-revenue.test.ts` | 3 red, exactly the three tests above |
| Revert R2: the relay's default `sendTimeout` made a signal that never fires | scratch worktree, `event-relay.test.ts` and `events.test.ts` | **none red** (41 of 41 pass): finding 1 |
| Revert R3: the floor in `daysProcessedSince` dropped | scratch worktree, `days.test.ts`, `comparison.test.ts`, `video-detail.test.ts` | 4 red across all three files |
| #298 reach | read `rangeOf` and `customRangeOf` (`apps/api/src/calendar-range.ts:68-80`, `:113-125`), `numbersOf` (`apps/api/src/video-detail.ts:66-71`) | calendar and custom ranges end at the last processed day, so an awaiting video's range already ran backwards there; the gate changes only first-N and lifetime, as the ticket asks |
| #295 readers | grep for `'refusal' in`, `'currency' in` and `.refusal` over apps and packages (both finders) | every reader of the two unions narrows; the remaining `'refusal' in` sites test whole-answer refusals |
| #296 reachability of an answer without `revenue` | API answer site `apps/api/src/video-list.ts:463-469`; web and extension storage; the API's cache headers; `apps/api/Dockerfile:37` and `apps/api/src/server.ts:63` | the API always sets it; no stored answer; no HTTP caching; the web bundle ships in the API image. See Minor for the rollback case |
| Web and extension typecheck and suites | `tsc --noEmit` per tsconfig; `vitest run` over the touched web tests, all of `apps/extension/src` and `days.test.ts` (agent) | pass, 24 files, 829 tests |
| Not run | live OpenPanel; a Dokploy rollback with an open tab | not reachable from a review |

**Overall:** The five follow-ups do what their tickets ask, and every new test goes red against `e30bb8a`. #297 is proved behaviour-preserving by a differential harness, and #298 changes only the first-N and lifetime reads it targets. One new LOW: #261's fix moved the relay's real timer out of every test, so a default that never fires passes the suite. The two LOW findings carried from round 2 and its comment batch are untouched by this delta. Nothing here blocks the PR.

## Approach decisions
- No-processed-day rule in `videoDetail` (carried forward): `unprocessed = !publishDay || awaiting` gates the detail's revenue read and the lifetime revenue currency read; `awaitingProcessing` is `awaiting` alone.
- A null publish day's numbers (carried forward): read over the window's own range in a calendar, lifetime or custom window; a window after publish counts no day.
- An awaiting video's numbers (#298, `3e4e4c2`): `awaiting` alone, not `unprocessed`, short-circuits `numbersOf` to `noNumbers` in every window. A video with no publish day keeps reading its numbers. Precedent: the revenue gate beside it.
- Revenue union discrimination (#295, `3a24b34`): `refusal?: never` on `ChannelRevenue` and `VideoRevenue`, as on #172's `VideoListRevenue`; readers narrow on a truthy `revenue.refusal`. `'currency' in` readers that still narrow stay.
- The list's revenue (#296, `5a79015`): required on `VideoListAnswer`; a fixture that does not exercise revenue carries `{ refusal: 'consent_missing' }`.
- Days processed since publish (#297, `ee3fda8`): `daysProcessedSince` in `packages/api-types/src/days.ts`, 0 for a null publish day; the extension's `daysProcessedOf` stays as a thin time-to-day adapter.
- The relay's send timeout (#261, `e9613b8`): an injected signal factory, `sendTimeout?: () => AbortSignal`, defaulting to `AbortSignal.timeout(defaultSendTimeoutMs)`; the flake test aborts only once the fake has recorded the request. Finding 1 adds a test of the default and does not reopen this decision.
- The fake's per-video lifetime numbers for a video with no `publishedAt` (carried forward, `caeee90`).

## Prior-review closure
Round 2 had 3 findings, all LOW, and no remediation ran after it (stage 2 converged at round 2). Fully fixed: 0. Partially fixed: 0. Untouched: 3 (findings 1, 2 and 3, carried forward below as findings 2, 3 and 4; no file they name changed in this delta). No MEDIUM-or-higher prior finding is open, and none was "resolved" by editing only a comment.

## Confirmed Issues
### 1. No test shows the relay's default send timeout ending an unanswered send — LOW
- **Location:** `apps/api/src/event-relay.ts:35`; the only timeout test is `apps/api/src/event-relay.test.ts:10`
- **Attribution:** introduced by `e9613b8` ("creator-analytics#261 Event relay: the send timeout test fails at random in a full run"). At `e30bb8a` the test passed `sendTimeoutMs: 50` into the same `AbortSignal.timeout(sendTimeoutMs)` call production makes, so a relay that sent with no timer went red. Now the test injects its own signal, and `apps/api/src/events.test.ts` drives the default only on sends OpenPanel answers.
- **Real-world trigger:** a later edit to the default factory (a wrong constant in ms vs s, a signal that never fires, a dropped default) during an OpenPanel outage. The API would then hold each event request open until the extension's own bound frees it, with every check green. No user-visible wrong number, so LOW.

**Evidence**
```ts
    sendTimeout = () => AbortSignal.timeout(defaultSendTimeoutMs),
```
**Failure mode** — revert R2 (default `() => new AbortController().signal`) keeps all 41 tests in `event-relay.test.ts` and `events.test.ts` green. The bound rule "a test for every fallback path" is unmet for the default.

**Recommended fix** — add a second test to `apps/api/src/event-relay.test.ts`, after the existing one:
```ts
test('an event OpenPanel never answers is given up after the default 3 s send timeout, and the failure is reported', {
  timeout: 10_000,
}, async () => {
  const openPanel = await startFakeOpenPanel()
  openPanel.answerNothing()
  const reporter = recordingReporter()
  const relay = createEventRelay(
    {
      apiUrl: openPanel.apiUrl,
      clientId: openPanel.clientId,
      clientSecret: openPanel.clientSecret,
    },
    { reporter },
  )

  const startedAt = Date.now()
  await relay.send({ name: 'extension_installed' }, { userAgent: undefined, ip: undefined })

  expect(Date.now() - startedAt).toBeGreaterThanOrEqual(2_900)
  expect(openPanel.received).toHaveLength(1)
  expect(reporter.reports).toEqual([
    {
      message: 'The event relay could not reach OpenPanel',
      error: expect.objectContaining({ name: 'TimeoutError' }),
    },
  ])
})
```
and amend the file's Limits header (`event-relay.test.ts:1-5`) so it no longer says the file does not show how long the real 3 s timer waits: the second test shows the default fires after about 3 s against a fake that never answers, and still not that 3 s suits the self-hosted OpenPanel.

**Remediation brief**
- **Design intent:** the relay forwards one event per `send` and ends a send OpenPanel never answers by the signal `sendTimeout()` returns, reporting "The event relay could not reach OpenPanel" with the abort reason (undici rejects `fetch` with `signal.reason`; the round 3 audit saw `TimeoutError` "The operation was aborted due to timeout" from the real timer). Production uses the default (`apps/api/src/modules.ts:86` passes only `reporter`). The real 3 s timer cannot race the fake's read the way #261's 50 ms timer did, since the fake records the request within milliseconds.
- **Full surface:** `apps/api/src/event-relay.test.ts` (new test after the one at `:10`; Limits header `:1-5`). No production change.
- **Must preserve:** the existing injected-signal test as it is, including its busy loop and identity assertion (#261's red-to-green proof, red at `e30bb8a`); `apps/api/test/fake-openpanel.ts`'s `answerNothing` and `untilReceived`; `events.test.ts` unchanged. The test adds about 3 s of wall time to one file, which runs in parallel with the suite.
- **Do not touch:** the `sendTimeout` option and its default (Approach decisions); the busy loop (Minor / nits).
- **Proof:** `pnpm exec vitest run apps/api/src/event-relay.test.ts` passes both tests; changing the default at `event-relay.ts:35` to `() => new AbortController().signal` turns the new test red on its 10 s timeout.

### 2. The general error log's "reason none" fallback has no test — LOW
- **Location:** `packages/youtube-gateway/src/youtube-gateway.ts:186-188`
- **Attribution:** introduced by `3208e08` ("creator-analytics#174 Log Google's error reason on the non-revenue error path too"). Carried forward unchanged from round 2 finding 1 and round 1 finding 3; neither file changed since `e30bb8a`. `git grep "reason none" -- '*.test.ts'` finds no assertion.
- **Real-world trigger:** Google answers a 5xx with no `errors` array (the fake's `failAnalytics(500)` body). A change that dropped the `?? 'none'` would log "reason undefined" with every check green. LOW (log legibility).

**Evidence**
```ts
function reasonText({ reason, message }: GoogleError): string {
  return `reason ${reason ?? 'none'}: ${message ?? 'none'}`
}
```
**Failure mode** — the only test of the line (`apps/api/src/channel-summary.test.ts:930`) sends a body with a reason. The bound rule "a test for every fallback path" is unmet.

**Recommended fix** — add a test after the one that starts at `channel-summary.test.ts:930`, in the same `describe`:
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
- **Design intent:** `spend` logs every unexpected Google error at error level with Google's reason and message in the masked message and the status in the context; the revenue 403 is logged at warn by `googleCalls` instead (`expectedStatus` keeps `spend` from logging it twice).
- **Full surface:** `apps/api/src/channel-summary.test.ts` (new test after `:930`).
- **Must preserve:** the `failAnalytics(500)` body (`googleError(status, 'Backend Error')` in `packages/fake-google/src/index.ts`) that `channel-summary.test.ts`, `video-detail.test.ts` and `video-list.test.ts` already use for their 502 tests.
- **Do not touch:** the revenue 403 warn line, which keeps its text.
- **Proof:** `pnpm exec vitest run apps/api/src/channel-summary.test.ts -t "reason none"` passes; replacing `reason ?? 'none'` with `reason` in `youtube-gateway.ts:187` turns it red.

### 3. Three assertions pass on wrong output — LOW
- **Location:** `packages/api-types/src/days.test.ts:63-66`; `apps/api/src/video-revenue.test.ts:972-974` and `:1013-1015`
- **Attribution:** introduced by `33b24ea` (#173), `2fa72a3` (#167) and `3072952` (#189). Carried forward unchanged from round 2 finding 2; `video-revenue.test.ts` did not change since `e30bb8a`, and `days.test.ts` changed only by the new `daysProcessedSince` block below these lines.
- **Real-world trigger:** none for users; a regression the tests claim to catch would pass. LOW.

**Evidence**
```ts
    expect(pacificDayOf(time)).toBe(pacificDayOf(time.toISOString()))
    ...
      for (const row of detail.body.sincePublish.rows) {
        expect(row).not.toHaveProperty('estimatedRevenue')
      }
```
**Failure mode** — a `pacificDayOf` that returns a constant passes `days.test.ts:65`. In both video-revenue tests (`:946` and `:982`), a `readSincePublish` that answered `rows: []` passes: the row loop asserts nothing and every window equals every other. In the #167 test, `last7` and the custom range end before the publish day, so they passed at base whatever the guard does; the comment at `:953-954` says where they end but not that they cannot go red.

**Recommended fix**
```diff
-  test('a time and its ISO text fall in the same day', () => {
-    const time = new Date('2026-10-07T05:00:00Z')
-    expect(pacificDayOf(time)).toBe(pacificDayOf(time.toISOString()))
+  test('a time given as a Date falls in its Pacific day, as its ISO text does', () => {
+    expect(pacificDayOf(new Date('2026-10-07T05:00:00Z'))).toBe('2026-10-06')
   })
```
and in each of `video-revenue.test.ts`'s two row loops, add `expect(detail.body.sincePublish.rows.map(({ stage }) => stage)).toEqual(['first1', 'first7', 'first28', 'first90', 'first365', 'lifetime'])`. Extend the #167 test's comment (`:953-954`) to say `last7` and the custom range already carried no revenue before #167, and that `first7` and `lifetime` are the windows the rule changed.

**Remediation brief**
- **Design intent:** each test states one rule against a hand-written expectation (CODING_STANDARDS.md 2, "a test builds only its input, and observes only real output").
- **Full surface:** `packages/api-types/src/days.test.ts:63-66`; `apps/api/src/video-revenue.test.ts:953-954` (comment), the loop at `:972-974`, the loop at `:1013-1015`.
- **Must preserve:** the existing assertions (no `revenue`, no `revenueCurrency`, `revenueQueriesOf(api)` empty, cross-window equality). Do not delete either video-revenue test: both are the red-to-green proofs of #167 and #189, and round 2's reverts B and D show they are the only tests pinning the `unprocessed` gate's two halves. Do not touch the new `daysProcessedSince` block below `:66`.
- **Do not touch:** `video-detail.test.ts`'s `unprocessedRows()` tests, green at base by design.
- **Proof:** `pnpm exec vitest run packages/api-types/src/days.test.ts apps/api/src/video-revenue.test.ts` green; replacing `pacificDayOf`'s body with a constant `return '2026-10-07'` keeps the old `days.test.ts` assertion green and turns the new one red.

### 4. Comment hygiene — LOW (aggregated)
Round 2 finding 3's eleven entries, carried forward at their current lines, plus four from this delta (marked "new"). One batch commit.
- `apps/api/src/video-detail.ts:199-200` — "and neither has a video Google has processed no day of since publish, one with no publish day included, in any window (#167, #189)." → "and neither has a video with no publish day, or one published after the last day Google has processed, in any window (#167, #189)."
- `apps/api/src/video-detail.ts:211-212` — "A video Google has processed no day of since publish has no revenue to read in any window." → "A video with no publish day, or one published after the last processed day, has no revenue to read in any window."
- `apps/api/src/video-detail.ts:39-40` — "A video not yet published has none, so the range runs backwards." → "A video scheduled for a later day has none, so the range runs backwards; a video with no publish day keeps the window's own days."
- `packages/api-types/src/video-detail.ts:154` — "and, in every window, for a video Google has processed no day of since publish." → "and, in every window, for a video with no publish day or one published after the last processed day."
- `packages/fake-google/src/reports/video-window-summary.ts:26` — "or for a video with no publish time on or before the channel's creation day," → "or for a video with no `publishedAt` (never published, a scheduled upload included) on or before the channel's creation day,"
- `apps/api/src/since-publish.ts:95` — "With a currency, the detail's revenue answered, and every row carries revenue in it." → "With a currency, which a video with no publish day or one published after the last processed day never gets, the detail's revenue answered, and every row carries revenue in it."
- `apps/api/src/since-publish.ts:90-92` — "makes no query and has zeros, with no revenue on any row whatever the currency." → "makes no query and has zeros, with no revenue on any row."
- `packages/api-types/src/days.ts:4-8` — keep, and add that the module also holds the Pacific reporting day, the finished stage rule and the days processed since publish (`daysProcessedSince`) that the API, the gateway, the fake Google server, the web app and the extension read.
- `packages/youtube-gateway/src/youtube-gateway.ts:134-135` — "`pacificDayOf` from api-types, which the fake Google server and the web app read too." → "`pacificDayOf` from api-types."
- `apps/web/src/VideoList.tsx:361-362` — "The page's rows go last, so a row wins, though both come from this one answer." → delete the sentence (both entries carry the same values, so the order has no effect)
- `apps/web/src/since-publish.ts:150` — "Remembers each video's publish date from an answer, replacing what an earlier answer said." → "Remembers each video's publish date from an answer (a list row or a publish day top video), replacing what an earlier answer said."
- new: `packages/api-types/src/videos.ts:310` — "outside the YouTube Partner Program. Always present." → "outside the YouTube Partner Program." (the field is required now, so the sentence restates the type, CODING_STANDARDS.md 1)
- new: `packages/api-types/src/channel-summary.ts:82` and `packages/api-types/src/video-detail.ts:79` — "Never present, so `refusal` tells this from a `RevenueRefusal`:" → "Never present, so a truthy `refusal` tells this from a `RevenueRefusal` (an `in` check does not narrow):" (a scratch harness showed `if ('refusal' in r) { const x: RevenueRefusal = r }` fails to compile; #172's `packages/api-types/src/videos.ts:290` carries the same wording and takes the same correction)
- new: `apps/web/src/video-list.ts:626-627` — "and none, so the cells are empty rather than $0.00, when YouTube reports no revenue for the channel." → "and none, so the cells are empty rather than $0.00, when the list carries no revenue: no consent, a channel outside the YouTube Partner Program, or no revenue reported." (#296 made a refusal the normal input in place of an absent revenue, and the doc names only one of the three reasons)

## Needs Further Investigation
None.

## Reviewed and Dismissed
- #298 changes an awaiting video's answer beyond the numbers fields: `fetchedAt` and `fromCache` now draw only on the uploads and last-processed-day reads, and `days` can no longer hold a row Google answered past the last processed day — `git grep` finds no reader of `fetchedAt` or `fromCache` in `apps/web/src` outside tests and the fake, the web app returns "not processed yet" on `awaitingProcessing` before it reads any number (`apps/web/src/VideoDetail.tsx:138`), and the extension only links to the detail page (round 2). The ticket's "the answer the web app reads is unchanged" holds.
- `daysProcessedSince('', day)` answers `NaN` where the old `partialOf` answered 0 for an empty-string publish day — unreachable: `publishDayOf` (`apps/api/src/uploads.ts`) returns a Pacific day or null, never `''`. The four other functions match on `''` too.
- The #295 readers narrow on a truthy `revenue.refusal` — `RevenueRefusal` is exactly `{ refusal: 'consent_missing' | 'not_monetized' }` (`packages/api-types/src/channel-summary.ts:93-95`), both non-empty, and the web reads revenue only from parsed JSON, so no falsy refusal reaches a reader.
- `video-detail.ts:94`'s `revenue &&` guard survives #296's guard removal — `VideoDetailAnswer.revenue` is still optional; only the list's is required.
- `dayAfterPublishOf` might be orphaned by #297 — it still has callers at `apps/api/src/video-detail.ts:240` and `apps/api/src/window-after-publish.ts:73`; `since-publish.ts` dropped its now-unused import.
- `engagedViewsByDayOf`'s `if (!publishDay) return []` might be redundant after #297 — it still guards the `dayAfterPublishOf(publishDay, day)` call in the loop.
- `untilReceived` might race or drop a waiter — it filters into a copy before splicing, resolves every waiter whose count is met, and resolves before the answer branch; the server closes in `onTestFinished`.
- The new type fixtures might pass at the old types — all three are red at `e30bb8a` and against the rebuilt old shapes (TS2578).
- Round 2's Dismissed list stands: none of its files changed in this delta.

## Minor / nits
- **A list answer without `revenue` now throws in the web app instead of degrading** (`apps/web/src/video-list.ts:600`, `:621`, `:630`): `'currency' in undefined` throws during render, and the web app has no error boundary. Every answer the API sends carries `revenue`, no answer is stored or HTTP-cached, and the web bundle ships inside the API image, so the only path is a tab opened on this bundle followed by an API rollback to `main`, whose list answer has no `revenue` key. #296 removed the guard on purpose (Nick reversed #172's assumption 3). Worth one line in the PR's rollback notes; a boundary check in `videoListViewOf` (`apps/web/src/video-list.ts:61-66`) would fail soft if that case ever matters.
- The two changed since publish tests (`apps/api/src/video-detail.test.ts:1136` and `:1154`) now assert `dayQueriesOf(api)` is empty, which also restates #298's rule that the new test at `:549` states more strongly; each still goes red if the since publish rows start reading.
- The new awaiting test (`video-detail.test.ts:549`) also pins `sincePublish` and `partial`, which #298 did not change; they read as "the answer the web app reads is unchanged", not as the ticket's rule.
- `days.test.ts`'s first floor case (`['2026-10-06', '2026-10-05']`) answers 0 without the floor; only the second row exercises `Math.max` (revert R3 confirms the second row goes red).
- `event-relay.test.ts:27-29`'s 200 ms busy loop guards the test against a short real timer coming back, not the relay; the identity assertion already catches that relay. It costs 200 ms per run (#261 assumption 2 keeps it).
- The list readers touched by #296 (`apps/web/src/video-list.ts:600`, `:630`) still narrow on `'currency' in revenue` while #295's readers use a truthy `refusal`; both are correct.
- `sourcesButtonShownOf` has no `consent_missing` case (`apps/web/src/video-list.test.ts:1282-1293`); the note and the currency do. The Revenue column is offered only with consent, so the case is unreachable in the app.
- Round 2's Minor / nits list stands unchanged.

## Test quality
Tests added or changed in the delta: 6 new `daysProcessedSince` tests, 1 new and 2 changed `video-detail.test.ts` tests, 1 rewritten `event-relay.test.ts` test, 3 new type fixtures, and fixture-only `revenue` lines in 13 web and extension test files · green against `e30bb8a`: 0 · tautology shapes found: none (no mocked unit, no self-computed expectation, no call-shaped-only assertion; the duplicates are nits above). The one coverage gap is the untested default, finding 1. Round 2's three weak assertions remain as finding 3.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and test all green at `bbbbb49`.
- **Commit hygiene:** commit this doc. `.epic-loop/` is gitignored.
- **Likely reviewer asks:** why a draft shows views but no revenue on its page (the #189 rule, narrowed by the 2026-10-20 scope note); what a rollback of the API does to an open tab now that the list's `revenue` is required (Minor); #261's cause and failing output, which the orchestrator posts to #261 at close-out.

## Verdict
Ready to open the PR, with follow-ups. No MEDIUM-or-higher finding is open, and the five follow-ups introduced no behaviour defect: every new test is red against `e30bb8a`, #297 is proved equivalent over 144,504 cases, and #298 changes only the first-N and lifetime reads it targets. The four confirmed findings are all LOW (one new test gap in #261, two carried test gaps, one comment batch) and can be remediated in this branch or ship as follow-ups. The new finding count is one, against three carried, which is the expected shape of a converging branch rather than a reason for another round.
