# Pre-PR review: creator-analytics#265 API correctness after #64, round 4 (the #299 harness fix)

**Branch:** `creator-analytics-265-api-correctness` vs `origin/main` (merge-base `72b39d4` "creator-analytics#253 Run CI and the deploy for the #292 merge")
**Reviewed at:** HEAD `67edd35` ("creator-analytics#299 Preferences: the saved-values tests fail at random in a full run", the merge of `62cf5cb`). The tree was clean, with no uncommitted or untracked files at review time. Full branch surface: 60 files, +1659 / −311, 42 commits (21 non-merge).
**Delta under review:** since `bbbbb49` ("creator-analytics#298 Spend no Analytics read on the numbers of a video awaiting processing in a first-N or lifetime window"), the HEAD that `pre-pr-review-3.md` reviewed. Branch-owned delta: 3 files, +56 / −8, all from `62cf5cb` (#299): `packages/database/test/harness.ts`, `packages/database/test/scopes.test.ts`, `apps/api/src/preferences.test.ts`. The rest of `git diff bbbbb49` arrived from `origin/main` `72b39d4` (#253, the marketing site) in the merge `b6a1cc4`, which resolved cleanly (`git show --cc b6a1cc4` shows no hunk) and overlaps the branch surface only in `README.md` and `packages/api-types/src/index.ts`, whose branch lines are unchanged; it is outside the branch surface.
**Reviewed against:** creator-analytics#299 (body and Done-when list), `62cf5cb`'s commit message (cause and failing output), `CODING_STANDARDS.md` 1 to 3, `pre-pr-review-3.md` (findings, Approach decisions, Dismissed list).
**Date:** 2026-10-20
**Reviewer:** 1 code-review agent, 1 checks and revert agent, and a verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | ok, already up to date |
| Lint | `pnpm lint` (biome, 474 files) | pass |
| Typecheck | `pnpm typecheck` | pass |
| Build | `pnpm build` | pass |
| Full suite | `pnpm test` (Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | 110 files, 2366 passed, 1 expected fail, 0 failed; no unhandled errors |
| Tautology audit, `scopes.test.ts` | HEAD's file run against `bbbbb49`'s harness in a scratch worktree, `-t "work a test leaves running"` | red as intended: "a scope opened on an earlier test's web is refused..." fails with `promise resolved "{ userId: 'user-a', channelId: '' }" instead of rejecting`; the first test of the pair is green (it is the pair's setup, see Minor) |
| Tautology audit, `preferences.test.ts` | HEAD's file run at `bbbbb49` | green, 17 of 17: expected, the change is a robustness change, not a new rule |
| Revert D: harness.ts back to `bbbbb49` at HEAD | scratch worktree, the scopes pair | red, same assertion; green again with HEAD's harness |
| #299's cascade forced, HEAD | scratch worktree, the slow test's timeout set to 300 ms, `apps/api/src/preferences.test.ts`, 11 runs | 11 of 11: only the slow test fails (timeout); the VEF test and the other 15 pass; no 3B001 or 25P02 |
| #299's cascade forced, base | scratch worktree at `bbbbb49`, same edit, 10 runs | the VEF test fails in 5 of 10 (`Unexpected end of JSON input`, Better Auth 25P02, 3B001 in two runs); one run logged `SAVEPOINT can only be used in transaction blocks`, i.e. leftover work running in autocommit on a pooled connection |
| A statement in flight at teardown | scratch test (agent, real harness and container): test A runs `select pg_sleep(2)` past a 300 ms timeout after seeding a user, test B seeds the same user | B blocked 1713 ms and 1749 ms in two runs: finding 1 |
| drizzle 0.45.3 with a `PoolClient`, pg 8.23.1 / pg-pool 3.14.0 `release(true)` | read `node_modules/drizzle-orm/node-postgres/session.js`, `pg/lib/client.js`, `pg-pool/index.js` (agent) | drizzle does not release a client it was handed; `end()` sets `_ending` synchronously, so drizzle's ROLLBACK and any later scope query are refused; no `'error'` is emitted while ending |
| The preferences PUT answer | `apps/api/src/routes/preferences.ts:34`, `savePreferences` (`insert ... onConflictDoUpdate ... returning()`) | the answer is the stored row, not an echo; asserting on it still observes the database's checks |
| Turn queue after the connection ends | scratch run (agent) | a leftover scope rejects and frees its turn; the queue is per transaction; no hang, no unhandled rejection |
| Prior findings | `git diff --quiet bbbbb49 HEAD` over every file findings 3 to 6 name | none changed |
| Not run | a loaded full run with another lane testing at once (the #296 sighting) | not reproducible on demand; the forced-timeout runs stand in for it |

**Overall:** #299's fix does what the ticket asks: the cause is written up in the commit (to be posted to #299), the new harness test is red against the old harness, the forced timeout no longer cascades into the next test (0 of 11 against 5 of 10 at base), and every check is green. One new LOW: the fixture ends the connection without waiting for Postgres to finish with it, so in the narrow case of a statement still running at a timeout, the next test waits on its locks inside its own timeout. One new LOW test-strength gap. The four LOW findings from round 3 are untouched. Nothing here blocks the PR.

## Approach decisions
- The test transaction's connection (#299, `62cf5cb`): each test takes its own `pool.connect()` client, and teardown destroys it with `client.release(true)` before drizzle sends ROLLBACK, so leftover scopes fail on a closed client and nothing runs in autocommit. Finding 1 adds a wait for the old backend to exit and does not reopen this decision.
- Every Approach decision in `pre-pr-review-3.md` stands unchanged: the no-processed-day rule in `videoDetail` (`unprocessed = !publishDay || awaiting`), a null publish day's numbers, an awaiting video's numbers (#298), revenue union discrimination on a truthy `refusal` (#295), the list's required revenue (#296), `daysProcessedSince` in api-types (#297), the relay's injected `sendTimeout` signal factory (#261), the fake's per-video lifetime numbers for a video with no `publishedAt`.

## Prior-review closure
Round 3 had 4 findings, all LOW, and no remediation ran after it. Fully fixed: 0. Partially fixed: 0. Untouched: 4 (findings 1, 2, 3 and 4, carried forward below as findings 3, 4, 5 and 6; no file they name changed since `bbbbb49`). No MEDIUM-or-higher prior finding is open, and none was "resolved" by editing only a comment.

## Confirmed Issues
### 1. A statement still running when a test times out holds its locks into the next test — LOW
- **Location:** `packages/database/test/harness.ts:151-154` (`end()`), `:157-159`, `:163-165`; the comment at `:144`
- **Attribution:** introduced by `62cf5cb` (#299). At `bbbbb49` teardown awaited drizzle's ROLLBACK, which queued behind a running statement on the same connection, so the wait happened inside teardown under `hookTimeout: 120_000` (root `vitest.config.ts`). Now `client.release(true)` calls `client.end()` unawaited; with a query in flight pg 8.23 destroys the socket (`pg/lib/client.js:822-824`), teardown returns at once, and the Postgres backend keeps running the statement, and holding the old transaction's locks, until it finishes and notices the disconnect.
- **Real-world trigger:** a test times out while one of its statements is still running (a slow query or a lock wait, not the short requests of #299's sightings), and the next test in the file writes the same rows, which the shared seed ids make common. The next test then waits inside its own 5 s timeout and can fail. Test infrastructure only, no user path: LOW, capped. Upgrade to MEDIUM if a full run shows a test timing out right after another test's timeout, check via the full-run log (`pnpm test 2>&1 | grep -B2 -A2 'Test timed out'`).

**Evidence**
```ts
    const end = () => {
      ended = true
      client.release(true)
    }
    try {
      await drizzle({ client }).transaction(async (tx) => {
        await use(tx)
        end()
        tx.rollback()
      })
```
**Failure mode** — test A seeds a user and runs `select pg_sleep(2)` past a 300 ms timeout; test B seeds the same user id and waits 1713 ms (1749 ms on a second run) before its insert proceeds. The comment's "teardown ends that connection: Postgres rolls back the open transaction" is true only once the statement finishes, after the next test has begun.

**Recommended fix** — record the backend's pid at setup, and after the connection ends wait until Postgres has let that backend go:
```diff
   transaction: async ({ pool }, use) => {
     const client = await pool.connect()
+    const {
+      rows: [{ pid }],
+    } = await client.query<{ pid: number }>('select pg_backend_pid() as pid')
     let ended = false
@@
     } finally {
       if (!ended) end()
+      await untilBackendEnds(pool, pid)
     }
   },
```
with, beside `turnQueueOf`:
```ts
async function untilBackendEnds(pool: pg.Pool, pid: number): Promise<void> {
  while ((await pool.query('select 1 from pg_stat_activity where pid = $1', [pid])).rowCount) {
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}
```
and change the comment at `:144` from "teardown ends that connection: Postgres rolls back the open transaction, and every later query on it fails" to "teardown ends that connection, and every later query on it fails; Postgres rolls the transaction back once a statement still running finishes, so teardown waits for the backend to exit before the next test starts".

**Remediation brief**
- **Design intent:** a test's transaction lives on one dedicated connection. At teardown the connection is destroyed before any ROLLBACK, so leftover scopes from a timed-out body fail on a closed client and nothing they queue can run in autocommit. Postgres then rolls back on disconnect, but a backend busy with a statement finishes it first, still holding its locks. The fix moves that wait back into teardown, where `hookTimeout` (120 s) governs it, as it was before #299.
- **Full surface:** `packages/database/test/harness.ts:148-166` (the `transaction` fixture: pid at setup, wait in `finally`), a new helper beside `turnQueueOf` (`:88-96`), the comment at `:140-147`. No other fixture: `web`, `worker`, `jobs` and `findJobs` all build on `transaction`.
- **Must preserve:** `end()` runs before `tx.rollback()` (the ROLLBACK must be refused on the ended client); `if (!ended) throw error` (a BEGIN failure or a rejecting `use` still surfaces); `finally { if (!ended) end() }`; the wait runs after `end()`, never before (waiting on a live backend of our own would hang). Suites that pin it: `packages/database/test/scopes.test.ts` "the test harness: work a test leaves running" (both tests), `apps/api/src/preferences.test.ts`, and the full `pnpm test`.
- **Failure of the fix:** a backend that never exits (a statement blocked forever) hangs teardown until `hookTimeout` and fails that test's teardown loudly, which is the pre-#299 behaviour and is the backstop. Do not terminate the backend with `pg_terminate_backend` instead: a terminated client can emit `'error'` events (seen in a scratch probe: "terminating connection due to administrator command"), and neither the client nor the pool fixture (`harness.ts:122-131`) has an `'error'` listener, so they would throw. The wait adds one query at setup and usually one at teardown per database test.
- **Do not touch:** the pool and boss fixtures; the `oneAtATime` turn queue (Reviewed and Dismissed: it frees a refused scope's turn).
- **Proof:** save this as `docs/reviews/creator-analytics-265/repro/harness-teardown-blocks-next-test.repro.ts` (the review could not write it into the repo; it was executed from the scratchpad against the real harness and container, 2 passed and 1 expected fail, B blocked 1749 ms):
```ts
// Pre-PR review 4 finding 1: the transaction fixture ends a test's connection without waiting for
// Postgres to finish with it, so a statement still running when a test times out keeps its
// transaction's locks into the next test. Test A is declared with test.fails because its timeout is
// the setup, not the verdict. Green means the defect is present; it goes red once teardown waits for
// the old backend to end before the next test starts.
import { sql } from 'drizzle-orm'
import { describe, expect } from 'vitest'
import { test } from '../../../../packages/database/test/harness.ts'
import { seedUser } from '../../../../packages/database/test/seed.ts'

const userId = 'repro-265-teardown'

describe('a statement running when a test times out', () => {
  test.fails('A: seeds a user, then runs a 2 s statement past a 300 ms timeout', { timeout: 300 }, async ({
    web,
  }) => {
    await seedUser(web, userId)
    await web.asAnonymous((scope) => scope.sql.execute(sql`select pg_sleep(2)`))
  })

  test('B: seeding the same user waits on the timed-out test transaction', async ({ web }) => {
    const started = Date.now()
    await seedUser(web, userId)

    expect(Date.now() - started).toBeGreaterThan(1000)
  })
})
```
  Run `pnpm exec vitest run --config docs/reviews/creator-analytics-265/repro/vitest.config.ts docs/reviews/creator-analytics-265/repro/harness-teardown-blocks-next-test.repro.ts`: green now, B red after the fix. If the bare `drizzle-orm` import does not resolve from `docs/reviews`, import from `'../../../../packages/database/node_modules/drizzle-orm'`. Then `pnpm exec vitest run packages/database/test/scopes.test.ts apps/api/src/preferences.test.ts` and `pnpm test` stay green.

### 2. The new refusal test passes on any rejection — LOW
- **Location:** `packages/database/test/scopes.test.ts:672`
- **Attribution:** introduced by `62cf5cb` (#299).
- **Real-world trigger:** none for users. A later change that broke `readScopeIds`, the row-level security on the scope, or the turn queue would make the leftover scope reject for the wrong reason and keep the test green, so the rule "a scope on an ended test's connection is refused" would no longer be shown. LOW.

**Evidence**
```ts
    await expect(leftBehind.asUser('user-a', readScopeIds)).rejects.toThrow()
```
**Failure mode** — the real rejection today is the right one (captured in a scratch run: `DrizzleQueryError: Failed query: savepoint sp1`, cause `Client was closed and is not queryable`), but `rejects.toThrow()` with no argument accepts every error. CODING_STANDARDS.md 2: the test states its rule only if a wrong cause turns it red.

**Recommended fix**
```diff
-    await expect(leftBehind.asUser('user-a', readScopeIds)).rejects.toThrow()
+    await expect(leftBehind.asUser('user-a', readScopeIds)).rejects.toMatchObject({
+      cause: { message: 'Client was closed and is not queryable' },
+    })
```
**Remediation brief**
- **Design intent:** the pair stands in for a timed-out test followed by the next one: the first test keeps its `web`, and the second shows a scope on it is refused because that test's connection ended, while the second test's own transaction still works.
- **Full surface:** `packages/database/test/scopes.test.ts:672`. If finding 1's fix lands first, the cause text is unchanged (the client is still ended by `release(true)`).
- **Must preserve:** the second assertion (`web.asUser('user-b', ...)` answers `{ userId: 'user-b', channelId: '' }`) and the first test as the pair's setup; this pair is #299's red-to-green proof (red against `bbbbb49`'s harness), so do not delete or merge it.
- **Do not touch:** the in-file order dependency (Minor / nits).
- **Proof:** `pnpm exec vitest run packages/database/test/scopes.test.ts -t "work a test leaves running"` passes both tests; replacing `readScopeIds` in that one call with `async () => { throw new Error('unrelated') }` turns the new assertion red and leaves the old one green.

### 3. No test shows the relay's default send timeout ending an unanswered send — LOW
- **Carried forward:** unchanged from `pre-pr-review-3.md` finding 1; no file it names changed since `bbbbb49`.
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

### 4. The general error log's "reason none" fallback has no test — LOW
- **Carried forward:** unchanged from `pre-pr-review-3.md` finding 2; no file it names changed since `bbbbb49`.
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

### 5. Three assertions pass on wrong output — LOW
- **Carried forward:** unchanged from `pre-pr-review-3.md` finding 3; no file it names changed since `bbbbb49`.
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

### 6. Comment hygiene — LOW (aggregated)
Carried forward unchanged from `pre-pr-review-3.md` finding 4, fifteen entries at their current lines (no file they name changed since `bbbbb49`). One batch commit.
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
- `packages/api-types/src/videos.ts:310` — "outside the YouTube Partner Program. Always present." → "outside the YouTube Partner Program." (the field is required now, so the sentence restates the type, CODING_STANDARDS.md 1)
- `packages/api-types/src/channel-summary.ts:82` and `packages/api-types/src/video-detail.ts:79` — "Never present, so `refusal` tells this from a `RevenueRefusal`:" → "Never present, so a truthy `refusal` tells this from a `RevenueRefusal` (an `in` check does not narrow):" (a scratch harness showed `if ('refusal' in r) { const x: RevenueRefusal = r }` fails to compile; #172's `packages/api-types/src/videos.ts:290` carries the same wording and takes the same correction)
- `apps/web/src/video-list.ts:626-627` — "and none, so the cells are empty rather than $0.00, when YouTube reports no revenue for the channel." → "and none, so the cells are empty rather than $0.00, when the list carries no revenue: no consent, a channel outside the YouTube Partner Program, or no revenue reported." (#296 made a refusal the normal input in place of an absent revenue, and the doc names only one of the three reasons)


## Needs Further Investigation
### A. No test shows the connection ending before drizzle's ROLLBACK — confirm by swapping the order and running the scopes pair
The comment at `harness.ts:144-146` makes the order load-bearing: a statement a leftover scope queued behind the ROLLBACK would run in autocommit and could commit. The finder reasoned, without executing, that letting drizzle ROLLBACK first and calling `release(true)` only in `finally` keeps the scopes pair green, since its leftover scope opens after teardown has finished either way. Confirm with that swap in a scratch worktree and `pnpm exec vitest run packages/database/test/scopes.test.ts -t "work a test leaves running"`. If it stays green, the rule "a test for every fallback path" wants a test that queues a scope during teardown; if no harness seam allows that, a Limits line in the harness comment saying the order is unproved by test is enough.

## Reviewed and Dismissed
- The fixture might swallow a real error now that it drops the `TransactionRollbackError` check — after `end()` the only errors possible are drizzle's refused ROLLBACK and `TransactionRollbackError`; a BEGIN failure (`session.js:184`, outside drizzle's try) or a rejecting `use` happens with `ended === false` and is rethrown; COMMIT is unreachable because the callback always throws.
- Drizzle might release the client it was handed, double-releasing it — `isPool` (`session.js:181`) is false for a `PoolClient`, so drizzle never calls `release()`; the fixture owns the client and releases it once.
- A ROLLBACK or leftover query might run in autocommit after `release(true)` — `Client.end` sets `_ending` synchronously (`client.js:800`) and `query()` refuses on it (`client.js:772-775`).
- The destroyed client might emit an unhandled `'error'` — the `end` handler emits none while `_ending` (`client.js:210`), and both the graceful and the mid-query destroy paths produced none in scratch runs and in 11 forced-timeout runs.
- A refused leftover scope might hang the turn queue or leak into the next test — `previous = turn.catch(() => undefined)` frees the turn, the queue is per transaction (`turnQueues` WeakMap), and runs showed no hang or unhandled rejection.
- The preferences test might have weakened by asserting the PUT answer instead of a GET — the PUT answers with the row `insert ... returning()` gave back (`apps/api/src/routes/preferences.ts:34`), the assertion now also checks `status: 200` for every value, and "PUT of one value saves it and leaves the other saved values" (`preferences.test.ts:49`) shows a GET answers the same, as the new comment says.
- The scopes pair might run out of order — the root `vitest.config.ts` sets no shuffle, concurrency or retry, there are no per-package configs, and `pnpm test` is plain `vitest run`.
- Round 3's Dismissed list stands: none of its files changed since `bbbbb49`.

## Minor / nits
- **The first test of the scopes pair states no rule of its own** (`scopes.test.ts:661-666`): "a test keeps its web past its end" asserts that a scope works during the test, and exists to hand its `web` to the next test; run alone, the second test throws "the earlier test kept no web". The coupling is inherent to showing "after a test ends" without a seam to end a transaction mid-test. A name that says its role (for example "a test whose web outlives it") and a guard message such as "run with the preceding test" would read better.
- **The pair's second assertion was green before the fix**: before #299 the leftover scope ran awaited on the same pooled connection with nothing in parallel, so "leaves this test's transaction sound" could not go red there; only the `rejects` assertion is the proof.
- **The error path still sends ROLLBACK on a live connection** (`harness.ts:163-165`): if `use(tx)` rejects, drizzle's catch (`session.js:189-191`) sends ROLLBACK before `finally` destroys the connection, the autocommit hazard the comment describes. Reachable only when Vitest's `use` rejects, which a failing test does not cause.
- **A forced timeout leaves Better Auth stderr against the next test** (4 of 11 runs): `ERROR [Better Auth]: INTERNAL_SERVER_ERROR DrizzleQueryError: Failed query: rollback to savepoint sp1 … Client was closed and is not queryable` printed under the VEF test, which passes. It is the timed-out body being refused, as intended, but reads as noise in a log.
- Round 3's Minor / nits list stands unchanged (a list answer without `revenue` throws in the web app after an API rollback, worth one line in the PR's rollback notes; duplicated assertions in the awaiting and since publish tests; `days.test.ts`'s first floor case; the relay test's busy loop; mixed `'currency' in` and truthy `refusal` narrowing; no `consent_missing` case for `sourcesButtonShownOf`).

## Test quality
Tests added or changed in the delta: 2 new harness tests in `scopes.test.ts`, 1 changed test in `preferences.test.ts` · green against `bbbbb49`: the first harness test (the pair's setup, Minor) and the preferences test (a robustness change, expected) · tautology shapes found: none (no mocked unit, no self-computed expectation, no call-shaped-only assertion); one loose matcher, finding 2. Revert D (old harness) turns the new pair red. Round 3's carried test gaps remain as findings 3, 4 and 5.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and test all green at `67edd35`.
- **Commit hygiene:** commit this doc. `.epic-loop/` is gitignored.
- **Likely reviewer asks:** why the test harness changed in an API-correctness PR (#299: a flaky full run blocks landings); what a rollback of the API does to an open tab now that the list's `revenue` is required (round 3 Minor); #261's and #299's causes and failing output, which the orchestrator posts at close-out.

## Verdict
Ready to open the PR, with follow-ups. No MEDIUM-or-higher finding is open. #299's fix meets its Done-when list: the forced timeout no longer cascades (0 of 11 runs against 5 of 10 at base), the new harness test is red against the old harness, and all four checks are green. The six confirmed findings are all LOW: two new from #299 (the unawaited backend exit, finding 1, and a loose matcher, finding 2), three carried test gaps and one carried comment batch. They can be remediated in this branch or ship as follow-ups. Two new LOWs against four carried is the shape of a converging branch, not a reason for another round.
