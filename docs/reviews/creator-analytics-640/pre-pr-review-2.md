# Pre-PR review: creator-analytics#640 Daily, weekly and monthly active users from anonymous data

**Branch:** `creator-analytics-640-active-users` vs `origin/main` (merge-base `93106a5` "Merge pull request #654 from nick-vogel/release-2026.11.11.2")
**Reviewed at:** HEAD `7b8c12c` ("creator-analytics#640 pre-PR review 1 remediation closure table"), clean tree, no uncommitted or untracked files at review time. Whole branch: 51 files, +3,357 / −102.
**Delta under review:** since `9efe412` ("creator-analytics#658 The worker sends the daily, weekly and monthly active users to OpenPanel each day"), the HEAD that pre-PR review 1 reviewed: 12 files, +405 / −14, of which 7 are code, tests or docs (`README.md`, `apps/worker/src/active-user-count.ts`, `apps/worker/src/jobs.ts`, `apps/worker/test/active-user-count.test.ts`, `packages/database/src/activity-days.ts`, `packages/database/src/jobs.ts`, `packages/database/test/jobs.test.ts`) and 5 are review 1's doc and repros.
**Reviewed against:** pre-PR review 1 (`pre-pr-review-1.md`), its Approach decisions and remediation closure table; epic nick-vogel/creator-analytics#640 and child #658 as distilled in review 1; `CODING_STANDARDS.md`.
**Date:** 2026-11-11
**Reviewer:** 1 code-review agent + verify pass

## What was verified and how

| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | green, lockfile unchanged |
| Lint | `pnpm lint` | green |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` | green |
| Full suite | `pnpm test` (Testcontainers Postgres), `TEST_DATABASE_ADMIN_URL` unset | green: 160 files, 4,002 passed, 1 expected fail |
| Browser walk | `pnpm run --if-present test:browser` | green: no content security policy violation in 59 steps |
| Review 1's proofs | `pnpm exec vitest run --config docs/reviews/creator-analytics-640/repro/prune-on-failed-send.vitest.config.ts` and `... repro/active-user-count-retry.vitest.config.ts` | both green (red at `9efe412` per review 1) |
| Tautology audit of the delta's tests | HEAD's `apps/worker/test/active-user-count.test.ts` and `packages/database/test/jobs.test.ts` copied into a scratch worktree at `9efe412` and run there | all 5 new or changed tests red at `9efe412`; the other 14 green, as expected |
| pg-boss 12.36.0 queue semantics | Read in `node_modules`: `plans.js:1426-1451` (`updateQueue`), `:2626-2629` (job insert copies the queue's retry values), `:2836-2844` (fail sets `start_after`), `timekeeper.js:591-601` (`missedOccurrence`), `manager.js:2150`; no pg-boss skill or docs MCP exists | `updateQueue` COALESCEs every column, so only the two keys change; a cron-sent job takes the queue's retry values; with `retry_backoff` false the delay is a fixed 300 s, no jitter; a missed occurrence is sent on the first cron pass after the worker returns, at any time of day |
| Retry after midnight (Finding 1) | Executed: `pnpm exec vitest run --config docs/reviews/creator-analytics-640/repro/retry-crosses-midnight.vitest.config.ts` | red: the 00:05 retry of a 23:50 attempt sends `__timestamp` 2026-11-11T12:00 with `dau: 0`, not the first attempt's 2026-11-10 |
| Parallel interference of the new `jobs.test.ts` queue reset | Read: `git grep` for readers of the `activeUserCount` queue and for committed `activeUserCount` jobs; `startJobRunner` defaults; `installJobs` callers | none found (Dismissed) |
| Live pg-boss retries and OpenPanel | Not run: outside the suite by design | #659, the manual check |

**Overall:** Both of review 1's MEDIUM findings are fixed against their intent, proved red at `9efe412` and green now, and every full check is green. The retry spacing has one edge its doc comment denies: a first attempt that starts late in the UTC day has retries after midnight, and those count the next day (Finding 1, LOW, two coincident faults needed). Review 1's two LOWs were deferred and remain. Nothing blocks the PR.

## Approach decisions

- Prune under a failing send (review 1, Finding 1): the rows no retry of the counted day needs, those older than D-29, are deleted in their own committed system scope before the count; the count's transaction keeps today's count, then delete older than D-28 (the D-29 rows), then send. Applied in `bc48c58` as `pruneActivityDaysNoRetryNeeds`. Cost, recorded in review 1 and still standing: while the send fails, a row lives up to 31 days and 15 minutes, not the policy's 30. Changing the policy copy or committing the D-28 prune before the send is Nick's choice, not a remediation's.
- Retry spacing (review 1, Finding 2): per-queue options in `queueOptions` beside `jobSchedules`, applied by `installJobs` with `createQueue(name, options)` or `updateQueue(name, options)`, `{ retryLimit: 6, retryDelay: 300 }`. Applied in `e7d4f54`.
- Counted day of a retry (this review, Finding 1): this round corrects the comments only. The mechanism fix, taking D from the job's scheduled occurrence rather than each attempt's clock, belongs with Needs Further Investigation A's missed-run case in one follow-up ticket, since both have the same cause and the handler receives no job metadata today (`Handler = (worker, data)` in `apps/worker/src/jobs.ts`).

## Prior-review closure

Review 1 held 4 confirmed findings: 2 fully fixed, 0 partially fixed, 2 untouched.

| Review 1 finding | Status | Evidence |
| --- | --- | --- |
| 1 (MEDIUM) A send that keeps failing stops the prune | fully fixed | `bc48c58`; repro green; "three days of refused sends leave no activity day older than D-29" and the changed rerun test (`apps/worker/test/active-user-count.test.ts:236`, rows from 2026-10-12 stay, older go) red at `9efe412`, green now. Intent holds: the retention bound no longer depends on OpenPanel, and only the D-29 rows wait for the send. |
| 2 (MEDIUM) The count's retries all run within seconds | fully fixed | `e7d4f54`; repro green; both new `packages/database/test/jobs.test.ts` tests red at `9efe412`. Intent holds for a first attempt at 00:15; the late-start edge is this review's Finding 1, LOW. |
| 3 (LOW) Copy test of the privacy policy | untouched | deferred by remediation ("LOW tail, not worked at the default scope"); re-emitted as Finding 2 |
| 4 (LOW) Comment hygiene | untouched | deferred the same way; re-emitted as Finding 3 |

No finding was "resolved" by editing only a comment or a doc. The subsystem has been rewritten once in response to review, so fix-begets-finding does not apply.

## Confirmed Issues

### 1. A retry that runs after midnight counts the next day, so a late first attempt loses its day's point and double-counts the next — LOW

- **Location:** `apps/worker/src/active-user-count.ts:30` (and `:66`), with the comments at `packages/database/src/jobs.ts:37-39` and `apps/worker/src/active-user-count.ts:61-63`
- **Attribution:** introduced. Against `$BASE`: the count and its clock-derived D are new in `63083d6` (creator-analytics#658). Against `9efe412`: the remediation `e7d4f54` widened the retry window from seconds to 30 minutes and added the comment "all still run on the day after the day they count"; the clock-derived D was already named at `9efe412` by review 1's Needs Further Investigation A (missed-run case), which is not a deferred-regression entry.
- **Real-world trigger:** the worker is down at 00:15 UTC on day R+1 and comes back between 23:45 and 00:00 UTC that same day, so `missed: 'once'` sends the day's job late, and OpenPanel refuses that first attempt. A second route: the worker stops during the 00:15 to 00:45 retry window and stays down past the next midnight, so the pending retry runs on R+2. Both need two faults at once. LOW, capped: upgrade to MEDIUM if worker deploys or restarts routinely land late in the UTC day; check via the Dokploy deploy history of the worker service for deploys between 23:00 and 00:00 UTC.

**Evidence**

```ts
    const countedDay = addDays(utcDayOf(tx.now), -1)
```

```ts
 * user count's six retries five minutes apart ride out a short OpenPanel outage, and all still run
 * on the day after the day they count.
```

pg-boss `plans.js:2837`: `WHEN NOT retry_backoff THEN ${schema}.job_now() + retry_delay * interval '1'`, so the retry runs 300 s after the failure whatever the time of day.

**Failure mode:** each attempt takes D from its own clock. A first attempt at 23:50 on 2026-11-11 counts 2026-11-10 and is refused; its retry at 00:05 on 2026-11-12 counts 2026-11-11 and lands. The repro shows the retry's event stamped `2026-11-11T12:00:00.000Z` with `dau: 0`. 2026-11-10 then has no point, and the regular 00:15 job on 2026-11-12 counts 2026-11-11 again, so that day gets two points ("Sum of property" doubles it), the second with a smaller `mau` because the retry already pruned the 2026-10-13 rows. The two comments state the opposite as an invariant, which is how a maintainer would miss it.

**Recommended fix:** correct the two comments this round, and move the mechanism fix into the follow-up ticket with Needs Further Investigation A.

```diff
- * The queues whose retries differ from pg-boss's defaults, two retries with no delay. The active
- * user count's six retries five minutes apart ride out a short OpenPanel outage, and all still run
- * on the day after the day they count.
+ * The queues whose retries differ from pg-boss's defaults, two retries with no delay. The active
+ * user count's six retries five minutes apart ride out a short OpenPanel outage. Each attempt takes
+ * its counted day from its own clock, so the retries of an attempt at 00:15 all count the same day,
+ * and a retry after midnight, of an attempt sent late, counts the next.
```

```diff
- * Deletes every activity day older than D-29, which no count of D, its retries included, reads. It
- * runs in its own scope before the count, so it commits whether or not the send lands, and while
- * OpenPanel refuses no row lives past 31 days.
+ * Deletes every activity day older than D-29, which no count of D, its same-day retries included,
+ * reads. It runs in its own scope before the count, so it commits whether or not the send lands,
+ * and while OpenPanel refuses no row lives past 31 days.
```

**Remediation brief**

- **Design intent:** the daily job at 00:15 UTC counts D, the UTC day before the attempt's clock, over D-29 to D, prunes in two steps (older than D-29 in its own scope, then the D-29 rows inside the count's transaction) and sends last. pg-boss copies the queue's six retries 300 s apart onto each cron-sent job and reruns the whole handler on each. The comments must describe that D is per attempt, so nobody relies on "every retry counts the same day" until a follow-up takes D from the job itself.
- **Full surface:** `packages/database/src/jobs.ts:36-40`; `apps/worker/src/active-user-count.ts:60-64`. No code line changes this round. The follow-up (one ticket with Needs Further Investigation A) would touch `apps/worker/src/jobs.ts` (`Handler` gets the job's created time or scheduled occurrence), `apps/worker/src/active-user-count.ts:30` and `:66`, and `apps/worker/test/active-user-count.test.ts`, with `docs/reviews/creator-analytics-640/repro/retry-crosses-midnight.test.ts` as its red.
- **Must preserve:** `queueOptions` values `{ retryLimit: 6, retryDelay: 300 }` and the tests that pin them (`packages/database/test/jobs.test.ts:98`, `:104`); the two-scope order in the `activeUserCount` handler (`apps/worker/src/jobs.ts:64-67`) and the tests at `apps/worker/test/active-user-count.test.ts:192` and `:247`.
- **Do not touch:** the D-29-inside-the-transaction rollback (review 1, Dismissed); `missed: 'once'` on the schedules; `updateQueue` only when options exist (Dismissed below).
- **Proof:** `grep -n "all still run" packages/database/src/jobs.ts` prints nothing; `pnpm lint` green. The repro `pnpm exec vitest run --config docs/reviews/creator-analytics-640/repro/retry-crosses-midnight.vitest.config.ts` stays red this round, on purpose; it is the follow-up's red.

### 2. The new privacy policy test is a copy test, which the coding standards forbid — LOW

- **Location:** `apps/site/test/site.test.ts:1247-1263`, and the header comment at `:1133-1134`
- **Attribution:** introduced, by `17ad316` (creator-analytics#657). Review 1's Finding 3, unchanged since `9efe412` (`git diff --quiet 9efe412 -- apps/site` is clean).
- **Real-world trigger:** none for a user. The test fails when Nick edits the approved sentences and never when code breaks.

**Evidence**

```ts
  // The sentences Nick approved word for word on #657, on 2026-11-11.
  test('the privacy policy names the activity record in its analytics section, and its 30 days in its retention section', async ({
```

**Failure mode:** `CODING_STANDARDS.md` standard 2: "No test asserts that fixed copy is present ... Write no new one, and delete an existing one on sight." The test restates the policy's literal sentences. The #488 and #539 word-for-word tests in the same `describe` are pre-existing breaches and out of scope.

**Recommended fix:** delete the test at `:1247-1263`. In the header comment, drop "and that the policy names the activity record in its analytics section and its 30 days in its retention section" and ", and the activity record's test the sentences #657 approves," so it claims no test that does not exist; keep #657 in the list of copy approvals.

**Remediation brief**

- **Design intent:** policy copy is held by Nick's approval on its issue, not by the suite. A site test may hold a rule over the copy from elsewhere, such as no em-dash.
- **Full surface:** `apps/site/test/site.test.ts:1125-1137` (header comment) and `:1247-1263` (the test).
- **Must preserve:** the em-dash rule test and every other test in `seam 1: the privacy policy and the terms`; the #488 and #539 tests stay.
- **Do not touch:** `apps/site/privacy.html`; its copy is approved word for word.
- **Proof:** `pnpm exec vitest run apps/site/test/site.test.ts` green, and `grep -n "The sentences Nick approved word for word on #657" apps/site/test/site.test.ts` prints nothing.

### 3. Comment hygiene — LOW (aggregated)

Review 1's Finding 4, unchanged since `9efe412` (`git diff --quiet 9efe412 -- packages/event-relay apps/worker/Dockerfile` is clean).

- `packages/event-relay/src/index.ts:4` — "The self-hosted OpenPanel project the web app sends to, with a server-side client secret." → "The self-hosted OpenPanel project the API and the worker send to, with its server-side client secret."
- `packages/event-relay/src/index.ts:18` — "The API's own events, which no client may post" → "The server's own events, the API's and the worker's, which no client may post"
- `packages/event-relay/src/index.ts:55` — "Sends one of the API's own events as `sendServerEvent` does" → "Sends one of the server's own events as `sendServerEvent` does"
- `packages/event-relay/src/index.ts:61-62` — "short enough that an outage does not hold the extension's request open." → "short enough that an outage does not hold the extension's request open. The worker's active user count waits on it too, inside its transaction, and a timeout there fails the job."
- `apps/worker/Dockerfile:25-27` — "DELETION_LOG_KEY, GLITCHTIP_DSN." → "DELETION_LOG_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, TOKEN_ENCRYPTION_KEYS (the API's own), GLITCHTIP_DSN."

## Needs Further Investigation

### A. One counted day can reach OpenPanel twice, and "Sum of property" would show it doubled

Carried from review 1, with one change: a failed attempt now has six retries, not two, so a send that OpenPanel stores but answers after the relay's 3-second timeout (`packages/event-relay/src/index.ts:63`; the worker passes no `sendTimeout` at `apps/worker/src/worker.ts:47`) can repeat up to six times before one is answered in time. The missed-run case (D from each run's clock, `missed: 'once'` sending a day's job late) is the same cause as Finding 1. What would confirm the first: whether OpenPanel's `/track` handler persists or queues an event before it answers, read from OpenPanel's source. One follow-up ticket should take D from the job's scheduled occurrence (covering Finding 1 and the missed-run case) and decide the worker relay's timeout.

## Reviewed and Dismissed

- `updateQueue(name, { retryLimit, retryDelay })` resetting other queue settings — `plans.js:1426-1451` COALESCEs every column with the existing value; policy, backoff, expiration, retention and dead letter stay.
- `createQueue(name, undefined)` for the other queues — the `options = {}` default makes it identical to `createQueue(name)`; `updateQueue` never runs without options (`else if (options)`), so its at-least-one-key assertion (`manager.js:2150`) cannot fire.
- A cron-sent job ignoring the queue's retry values — the insert takes `COALESCE("retryLimit", q.retry_limit)` and the same for delay and backoff (`plans.js:2626-2629`); the schedule's options carry no retry keys. A job inserted before a deploy's `updateQueue` keeps the old values, once.
- Jitter or a cap on the 300 s delay — only the backoff branch applies jitter and `retry_delay_max`; the queue's `retry_backoff` is false.
- The new `jobs.test.ts` test resetting the shared `activeUserCount` queue interfering with parallel files — no other test reads that queue's retry values or works a committed `activeUserCount` job; `startJobRunner` defaults to no cron pass and no supervision; global setup recreates the database each run. Its only reader in the same file runs before it.
- Up to 7 GlitchTip reports per failed day instead of 3 — volume only, one message, one grouped issue.
- The two scopes of one attempt straddling midnight — the prune then computes an earlier D, which only narrows it; the count's own D-28 delete covers the rest.
- The privacy policy's "kept for 30 days, then deleted" (`apps/site/privacy.html:272`) against a 31-day bound while OpenPanel refuses — the cost recorded in review 1's Approach decisions; `README.md:73` and `packages/database/src/activity-days.ts:10-11` state it. Whether the copy changes is Nick's call (see Verdict).
- "while OpenPanel refuses no row lives past 31 days" — accurate for a 00:15 run: a row of day X goes at 00:15 on X+31.

## Minor / nits

- `packages/database/test/jobs.test.ts:98-102`: "span at least ten minutes" pins a lower bound only; `{ retryLimit: 100, retryDelay: 3600 }` would pass while every retry crosses midnight. An upper bound such as `retryLimit * retryDelay <= 23 * 3600` would pin the other half of review 1 Finding 2's intent.
- `apps/worker/src/jobs.ts:64-67`: no test makes the first scope (`pruneActivityDaysNoRetryNeeds`) fail and asserts the job rejects with no send. The sequential awaits are correct today.
- `packages/database/test/jobs.test.ts:104-124`: the test opens its own app pool and `startJobRunner` where the file's `boss` fixture would serve; only the migrator pool is new.
- `apps/worker/src/active-user-count.ts:65`: `pruneActivityDaysNoRetryNeeds` reads awkwardly; something like `pruneActivityDaysNoCountReads` says what it does.

## Test quality

Tests added or changed in the delta: 5, across 2 files. Green at `9efe412` (assert nothing new): 0; all 5 red there. Tautology shapes found: 0. One test to strengthen, not delete, since it is review 1 Finding 1's proof (`bc48c58`): "three days of refused sends leave no activity day older than D-29" (`apps/worker/test/active-user-count.test.ts:247-265`) seeds a row below D-29 on its first run, so runs two and three add nothing, and the changed rerun test at `:236` already proves the same rule. Seeding `2026-10-12` instead, asserting it survives the 2026-11-11 run and is gone after the 2026-11-12 run, would prove the "at most a day more" bound that `README.md:73` and `packages/database/src/activity-days.ts:10-11` now state.

## Before opening the PR

- **CI readiness:** lint, typecheck, build, the full suite and the browser walk green at `7b8c12c`. The three repro configs sit outside the root `include`; `retry-crosses-midnight` is red on purpose and is not run by `pnpm test`.
- **Commit hygiene:** this doc and `repro/retry-crosses-midnight.test.ts` with its config commit together as `creator-analytics#640 pre-PR review 2`.
- **Likely reviewer asks:** the migration and its policies (0023), the worker's OpenPanel settings in Dokploy on both environments (#659), and the 31-day bound while OpenPanel refuses.

## Verdict

Ready to open the PR with follow-ups. Both of review 1's MEDIUM findings are fixed against their intent; 0 left open; 0 resolved by a comment or doc edit alone. This round's confirmed list is 3 LOWs, one new: the retry window's late-start edge (Finding 1), whose comment fix can ride in the PR and whose mechanism fix joins Needs Further Investigation A in one follow-up ticket. Findings 2 and 3 are review 1's deferred LOW tail. One question for Nick before the PR: keep the policy's "kept for 30 days, then deleted" with the recorded one-day overrun during an OpenPanel outage, or change the copy.
