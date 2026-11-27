# Pre-PR review: creator-analytics#265 API correctness after #64, round 2 (the finding 1 remediation)

**Branch:** `creator-analytics-265-api-correctness` vs `origin/main` (merge-base `d34e9f2` "creator-analytics#253 The OG image for the marketing site")
**Reviewed at:** HEAD `e30bb8a` ("creator-analytics#265 pre-PR review 1 remediation closure table"). The tree was clean, with no uncommitted or untracked files at review time. Full branch surface: 38 files, +1003 / −261, 22 commits.
**Delta under review:** since `d04fa0c` ("creator-analytics#167 Since publish revenue for a video published after the last processed day differs by window"), the HEAD that `pre-pr-review-1.md` reviewed. 4 code files, +54 / −45 (`apps/api/src/video-detail.ts`, `apps/api/src/video-detail.test.ts`, `packages/api-types/src/video-detail.ts`, `packages/fake-google/src/reports/video-window-summary.ts`) in `caeee90` and `dd85aaa`, plus the review doc and its `repro/`.
**Reviewed against:** the epic body of creator-analytics#265, `CODING_STANDARDS.md` 1 to 3, `pre-pr-review-1.md` (its findings, Remediation scope of 2026-10-20, closure tables and Approach decisions).
**Date:** 2026-10-20
**Reviewer:** 1 code-review agent (with 4 revert experiments) and a verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | ok, lockfile unchanged |
| Lint | `pnpm lint` (biome, 470 files) | pass |
| Typecheck | `pnpm typecheck` | pass |
| Build | `pnpm build` | pass |
| Full suite | `pnpm test` (Testcontainers Postgres, Docker up, `TEST_DATABASE_ADMIN_URL` unset) | 110 files, 2332 passed, 1 expected fail, 0 failed |
| Round 1 repro | `cd docs/reviews/creator-analytics-265/repro && ../../../../node_modules/.bin/vitest run --config vitest.config.ts` | red on its last assertion ("expected 1001 to be +0"), as round 1 said it must be once finding 1 is fixed |
| Detail code against main | `git show d34e9f2:apps/api/src/video-detail.ts` read beside HEAD | `videoRangeOf`, `lifetimeRange` and `range` are byte-identical to main; the one behaviour change against main is the revenue gate's `\|\| unprocessed` |
| `!unprocessed` equals the old `publishDay && publishDay <= processedThrough` | reduced by hand (agent), `publishDayOf` returns null or YYYY-MM-DD, never `''` | equal for every input |
| Revert A: `video-detail.ts` at `d04fa0c`, HEAD tests | scratch worktree (agent) | the rewritten no-publish-day test goes red on its last28 totals; nothing else fails |
| Revert B: `\|\| unprocessed` dropped from the revenue gate | scratch worktree (agent) | 3 tests red: `video-revenue.test.ts:946`, `:982`, and the detail's "a video YouTube has not processed yet carries no revenue in any stage" |
| Revert D: `unprocessed` without its `!publishDay \|\|` half | scratch worktree (agent) | `video-revenue.test.ts:982` red, so finding 2's null half is pinned |
| Revert C: only the fake's `video-window-summary.ts` at `d04fa0c`, whole suite | scratch worktree (agent) | exactly 1 failure, the rewritten detail test on its lifetime assertion; no other test observes the fake change |
| Web and extension consumers of a draft's detail | read `apps/web/src/video-detail.ts:85-86`, `apps/web/src/VideoDetail.tsx:138`, `apps/extension/src/surfaces/analytics.ts:54` (agent) | no revenue card when `revenue` is absent, no consent prompt, no "not processed yet"; the extension only links to the detail page |
| Tautology audit | revert A above, and `git log -S` on the rewritten test | red against `d04fa0c`; green against `d34e9f2`'s numbers by design, because it is round 1 finding 1's red-to-green proof restoring main's behaviour. Keep |
| Not run | live Google | whether Google omits `videoPublishedAt` for a public video later made private (see Dismissed) |

**Overall:** Finding 1 (MEDIUM) and finding 2 (LOW) from round 1 are fully fixed and proved by revert: the detail reads a draft's numbers over the window's own range in a calendar, lifetime or custom window, counts no day in a window after publish, and makes no revenue call in any window, all four checks green. The delta introduces no behaviour defect. What remains is LOW: round 1's deferred findings 3 and 4, carried forward unchanged, and one comment hygiene batch that now also corrects four comments the remediation wrote or left stale.

## Approach decisions
- No-processed-day rule in `videoDetail` (carried forward, applied in `caeee90`): one named predicate, `unprocessed = !publishDay || isAwaitingProcessing(publishDay, processedThrough)`, gates the detail's revenue read and the lifetime revenue currency read. The answer's `awaitingProcessing` stays `isAwaitingProcessing` alone. Precedent: `readSincePublish`'s `!publishDay || daysSincePublish === undefined` guard.
- A null publish day's numbers (carried forward, Nick's 2026-10-20 scope note, applied in `caeee90`): in a calendar, lifetime or custom window the detail reads them over the window's own range, as `d34e9f2` did. A window after publish counts no day (a backwards range from `today + 1`). The #189 decision covers revenue and the Since publish rows only.
- The fake's per-video lifetime numbers for a video with no `publishedAt` (carried forward, `caeee90`): a range starting on or before the channel's creation day covers its lifetime. Precedent: `videoTotals` in `packages/fake-google/src/reports/video-totals.ts`, through `coversLifetime` in `report.ts`. The branch keys on `publishedAt`, so a scheduled upload takes it too; that is unreachable through the app (a scheduled upload's publish day is in the future, so every detail range runs backwards) and this round keeps the code and corrects the doc (finding 3) rather than branching on `scheduledFor`.

## Prior-review closure
Round 1 had 5 findings. Fully fixed: 2 (finding 1 MEDIUM by `caeee90` and `dd85aaa`; finding 2 LOW, carried by the same diff). Partially fixed: 1 (finding 5, comment hygiene: its `packages/api-types/src/video-detail.ts:115-117` entry closed by `caeee90`, six entries untouched). Untouched: 2 (findings 3 and 4, both LOW, deferred as LOW tail by the round 1 closure table). No MEDIUM-or-higher prior finding is left open, and none was "resolved" by editing only a comment.

## Confirmed Issues
### 1. The general error log's "reason none" fallback has no test — LOW
- **Location:** `packages/youtube-gateway/src/youtube-gateway.ts:186-188`, used at `:253-256`
- **Attribution:** introduced by `3208e08` ("creator-analytics#174 Log Google's error reason on the non-revenue error path too"). Carried forward unchanged from round 1 finding 3; neither file changed since `d04fa0c`. `git grep "reason none" -- '*.test.ts'` finds no assertion.
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
- **Design intent:** `spend` logs every unexpected Google error at error level with Google's reason and message in the masked message and the status in the context; the revenue 403 is logged at warn by `googleCalls` instead (`expectedStatus` keeps `spend` from logging it twice).
- **Full surface:** `apps/api/src/channel-summary.test.ts` (new test after the test that starts at `:930`, beside it in the same `describe`).
- **Must preserve:** the `failAnalytics(500)` body (`googleError(status, 'Backend Error')` in `packages/fake-google/src/index.ts`) that `channel-summary.test.ts`, `video-detail.test.ts` and `video-list.test.ts` already use for their 502 tests.
- **Do not touch:** the revenue 403 warn line, which keeps its text.
- **Proof:** `pnpm exec vitest run apps/api/src/channel-summary.test.ts -t "reason none"` passes; replacing `reason ?? 'none'` with `reason` in `youtube-gateway.ts:187` turns it red.

### 2. Three assertions pass on wrong output — LOW
- **Location:** `packages/api-types/src/days.test.ts:57-60`; `apps/api/src/video-revenue.test.ts:968-978` and `:1006-1016`
- **Attribution:** introduced by `33b24ea` (#173), `2fa72a3` (#167) and `3072952` (#189). Carried forward unchanged from round 1 finding 4; neither file changed since `d04fa0c`. All three tests are red at base, so each guards something; these assertions inside them do not.
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
**Failure mode** — a `pacificDayOf` that returns a constant passes `days.test.ts:59`. In both video-revenue tests, a `readSincePublish` that answered `rows: []` passes: the row loop asserts nothing and every window equals every other. In the #167 test (`:946`), `last7` and the custom range end before the publish day, so they passed at base whatever the guard does; the comment says where they end but not that they cannot go red.

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
- **Full surface:** `packages/api-types/src/days.test.ts:57-60`; `apps/api/src/video-revenue.test.ts:953-954` (comment), `:968-975`, `:1006-1015`.
- **Must preserve:** the existing assertions (no `revenue`, no `revenueCurrency`, `revenueQueriesOf(api)` empty, cross-window equality). Do not delete either video-revenue test: both are the red-to-green proofs of #167 and #189, and revert experiments B and D in this round show they are the only tests pinning the `unprocessed` gate's two halves.
- **Do not touch:** `video-detail.test.ts`'s `unprocessedRows()` tests, green at base by design (a helper cleanup).
- **Proof:** `pnpm exec vitest run packages/api-types/src/days.test.ts apps/api/src/video-revenue.test.ts` green; replacing `pacificDayOf`'s body with a constant `return '2026-10-07'` keeps the old `days.test.ts` assertion green and turns the new one red.

### 3. Comment hygiene — LOW (aggregated)
Round 1 finding 5's six untouched entries, carried forward, plus four from this delta. One batch commit.
- `apps/api/src/video-detail.ts:194-195` — "and neither has a video Google has processed no day of since publish, one with no publish day included, in any window (#167, #189)." → "and neither has a video with no publish day, or one published after the last day Google has processed, in any window (#167, #189)." (the same answer now carries Google's processed numbers for a draft, so "Google has processed no day of" is false for the case the comment names)
- `apps/api/src/video-detail.ts:206-207` — "A video Google has processed no day of since publish has no revenue to read in any window." → "A video with no publish day, or one published after the last processed day, has no revenue to read in any window."
- `apps/api/src/video-detail.ts:39-40` — "A video not yet published has none, so the range runs backwards." → "A video scheduled for a later day has none, so the range runs backwards; a video with no publish day keeps the window's own days." (a never-published draft is "not yet published", yet its range is the window's, not backwards)
- `packages/api-types/src/video-detail.ts:148` — "and, in every window, for a video Google has processed no day of since publish." → "and, in every window, for a video with no publish day or one published after the last processed day." (the delta updated the interface doc above but left this field doc, so a consumer seeing a draft with totals and no `revenue` finds no contract for it)
- `packages/fake-google/src/reports/video-window-summary.ts:26` — "or for a video with no publish time on or before the channel's creation day," → "or for a video with no `publishedAt` (never published, a scheduled upload included) on or before the channel's creation day," (the check reads `upload?.publishedAt` only; `FakeUpload.scheduledFor` is a publish time too, `packages/fake-google/src/channel-data.ts:33-36`)
- `apps/api/src/since-publish.ts:94` — "With a currency, the detail's revenue answered, and every row carries revenue in it." → "With a currency, which a video with no publish day or one published after the last processed day never gets, the detail's revenue answered, and every row carries revenue in it."
- `apps/api/src/since-publish.ts:89-91` — "makes no query and has zeros, with no revenue on any row whatever the currency." → "makes no query and has zeros, with no revenue on any row." (the caller never passes a currency for such a video)
- `packages/api-types/src/days.ts:4-8` — keep, and add that the module also holds the Pacific reporting day and the finished stage rule that the gateway, the fake Google server, the web app and the extension read.
- `packages/youtube-gateway/src/youtube-gateway.ts:134-135` — "`pacificDayOf` from api-types, which the fake Google server and the web app read too." → "`pacificDayOf` from api-types." (the consumer list already omits the extension and will rot)
- `apps/web/src/VideoList.tsx:360-361` — "The page's rows go last, so a row wins, though both come from this one answer." → delete the sentence (both entries carry the same values, so the order has no effect)
- `apps/web/src/since-publish.ts:150` — "Remembers each video's publish date from an answer, replacing what an earlier answer said." → "Remembers each video's publish date from an answer (a list row or a publish day top video), replacing what an earlier answer said."

## Needs Further Investigation
None.

## Reviewed and Dismissed
- A draft's list row carries revenue in a calendar window (`apps/api/src/video-list.ts:395-410` reads `videoRevenue` for every upload) while its detail carries no `revenue` and shows no revenue card — this is the decided #189 rule as narrowed by Nick's 2026-10-20 scope note (no revenue and no revenue call for a null publish day), each list row's own revenue is out of the epic's scope (round 1 Dismissed), and `d04fa0c` already had the detail half. It would matter only if a once-public video loses `videoPublishedAt` when made private; check via a live `playlistItems.list` read of a public test upload switched to private. Not a merge gate.
- The fake's draft branch also catches a scheduled upload (keys on `publishedAt`, not `scheduledFor`) — unreachable through the app: a scheduled upload's publish day is in the future, so every detail range runs backwards and `numbersOf` returns before any read, and `readSincePublish` reads only for a publish day on or before the last processed day; the scheduled fixtures carry no `metrics`, and revert C shows no other test observes the branch. The doc is corrected in finding 3.
- `videoRangeOf`, `lifetimeRange` and `range` read back to main's code — intended by option (b); main is the precedent.
- The rewritten detail test is green against `d34e9f2`'s numbers — it is round 1 finding 1's red-to-green proof, red against `d04fa0c` (revert A). Keep.
- The rewritten test dropped the old no-call assertion for calendar, lifetime and custom windows — that rule was the one overturned; the no-revenue-call half is pinned by `video-revenue.test.ts:982` (revert B and D).
- Round 1's Dismissed list stands unchanged: none of its files changed in this delta.

## Minor / nits
- The fake's new draft branch has no fake-level test in `packages/fake-google/src/fake-google.test.ts`; it is exercised only through `apps/api/src/video-detail.test.ts`'s lifetime assertion, which goes red without it (revert C). The precedent for a direct test is the `dimensions=video` creation-day test near `fake-google.test.ts:714`.
- In the rewritten detail test, `first28` runs after `last28`, `lifetime` and `custom` have warmed the gateway cache, so `.slice(before)` would not see a regression that made `first28` reread one of those ranges. The zero-totals assertion carries the rule today, since each cached range answers non-zero numbers. Calling `first28` first and dropping the slice would state it alone.
- The round 1 repro under `repro/` is now red by design (its own header says green means the defect is present); it is outside `pnpm test`'s file set (110 files run).
- Round 1's Minor / nits list stands unchanged.

## Test quality
Tests added or changed in the delta: 1 (`apps/api/src/video-detail.test.ts`, "a video with no publish day counts the window's own days in a calendar, lifetime or custom window, and no day in a window after publish") · green against `d04fa0c`: 0 (red on its last28 totals) · green against `d34e9f2`: by design, as finding 1's proof · tautology shapes found: none new (the cache-order weakness is a nit above); round 1's three remain as finding 2.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and test all green at `e30bb8a`.
- **Commit hygiene:** commit this doc. `.epic-loop/` is gitignored.
- **Likely reviewer asks:** why a draft shows views but no revenue on its page (the #189 rule, narrowed by the 2026-10-20 scope note); the epic body edit narrowing the #189 Implementation Decision is Nick's at close-out.

## Verdict
Ready to open the PR, with follow-ups. The round 1 MEDIUM is fixed and proved, no MEDIUM-or-higher finding is open, and the delta introduced no behaviour defect. The three remaining findings are LOW (a missing fallback test, three weak assertions, a comment batch) and can be remediated in this branch or ship as follow-ups. The Confirmed list shrank from five to three and drifted toward test and comment polish, which is the expected shape of a converging branch.
