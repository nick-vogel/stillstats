# Pre-PR review: creator-analytics#640 Daily, weekly and monthly active users from anonymous data

**Branch:** `creator-analytics-640-active-users` vs `origin/main` (merge-base `93106a5` "Merge pull request #654 from nick-vogel/release-2026.11.11.2")
**Reviewed at:** HEAD `9efe412` ("creator-analytics#658 The worker sends the daily, weekly and monthly active users to OpenPanel each day"), clean tree, no uncommitted or untracked files at review time. 46 files, +2,964 / −100 (1,824 of the added lines are the generated `packages/database/drizzle/meta/0023_snapshot.json`).
**Reviewed against:** epic nick-vogel/creator-analytics#640 (body and its two comments, the grill decisions and the split), its children #655, #656, #657 and #658 (#659 is the manual check, not code), `CODING_STANDARDS.md`, `CONTEXT.md`, `README.md`, `docs/deploy.md`. No prior review docs for this epic; `--fresh`.
**Date:** 2026-11-11
**Reviewer:** 2 code-review agents, 1 test-audit agent, and a verify pass

## What was verified and how

| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | green, lockfile unchanged |
| Lint | `pnpm lint` | green |
| Typecheck | `pnpm typecheck` | green, every package |
| Build | `pnpm build` | green |
| Full suite | `pnpm test` (Testcontainers Postgres), `TEST_DATABASE_ADMIN_URL` unset | green: 160 files, 3,999 passed, 1 expected fail |
| Browser walk | `pnpm run --if-present test:browser` | green: no content security policy violation in 59 steps |
| Tautology audit | The branch's new and modified tests copied into a scratch worktree at `93106a5` and run there; the moved relay test placed at `apps/api/src/event-relay.test.ts` against the base relay | every test of new behaviour red at base. Green at base, as expected: the moved relay timeout test, the 85 events and Stripe events tests once their import points back, the worker's `jobs.test.ts` (signature-only change), the `scopes.test.ts` exclusion list, and "every job name has a queue" (see Minor). One copy test (Finding 4) |
| Prune under a failing send (Finding 1) | Executed: `pnpm exec vitest run --config docs/reviews/creator-analytics-640/repro/prune-on-failed-send.vitest.config.ts` | red: after three days of refused sends a 2026-10-02 row is still there |
| Retry spacing of the count (Finding 2) | Executed: `pnpm exec vitest run --config docs/reviews/creator-analytics-640/repro/active-user-count-retry.vitest.config.ts`; pg-boss 12.36.0 `dist/plans.js:81-90` (`QUEUE_DEFAULTS`) read in `node_modules`, since there is no pg-boss skill or docs MCP | red: `retryLimit × retryDelay` is 0 seconds. Defaults are `retry_limit: 2, retry_delay: 0, retry_backoff: false`, and a job copies its queue's values at insert (`plans.js:2626-2629`) |
| Relay move (#655), no behaviour change | Read: `git show 93106a5:apps/api/src/event-relay.ts` against `packages/event-relay/src/index.ts` line by line; `diff` of the old and new fake OpenPanel | hold: fake byte-identical, report messages and contexts unchanged, old relay tests identical apart from imports. One strengthening only: header construction now sits inside the `try` (Dismissed) |
| Migration 0023, RLS, grants, cascade | Read: `0023_activity_days.sql`, `packages/database/src/migrate.ts:9-18` (FORCE RLS), `0001_grants.sql` default privileges; database and API tests run | hold |
| Middleware placement and the four routes | Read: `apps/api/src/app.ts:209` session check, the four `signedIn.get(...)` registrations, Hono's HEAD dispatch | hold |
| Counted day, windows, prune boundary | Read: `active-user-count.ts`, `utcDayOf`, `addDays`, scope clock; the worker test's seeds at D, D-6, D-7, D-28, D-29, D-30, D+1 | hold |
| Privacy policy copy (#657) | `gh issue view 657` against `apps/site/privacy.html` | word for word; "Last updated November 11, 2026" was already set at base by `cbde6a9`, the same day |
| Docker images | Read: both Dockerfiles' `--prod --filter "<app>..."` installs, `.dockerignore`, lockfile importers | hold; no image was built |
| Live OpenPanel, pg-boss cron firing, Dokploy settings | Not run: outside the suite by design | #659, the manual check on staging and production |

**Overall:** The relay move, the activity day record and its policies, the four routes and the count's arithmetic all hold, and every check is green. Two defects sit in the daily job's failure path: a send that keeps failing stops the prune entirely, so the policy's "kept for 30 days, then deleted" stops holding for as long as the fault lasts (Finding 1), and the queue's retries all run within seconds, so the retry the spec relies on cannot ride out even a short OpenPanel outage (Finding 2). Fix both before the PR; the rest are LOW.

## Approach decisions

- Prune under a failing send (Finding 1): the rows no retry of the counted day needs, those older than D-29, are deleted in their own committed system scope before the count; the count's transaction keeps today's count, then delete older than D-28 (the D-29 rows), then send, so a failed send still rolls back only the D-29 rows and a rerun sends the same counts. Precedent: `worker.asSystem`, which `inSystemScope` wraps (`apps/worker/src/jobs.ts:37-41`); the handler opens it twice, in order, and no existing handler does that yet. Cost: while the send fails, a row lives up to 31 days and 15 minutes, not 30. The alternative, which holds the policy to the letter, is to commit the D-28 prune before the send, at the price of a retry's `mau` missing users seen only on D-29; that breaks #658's "a rerun sends the same counts", so it is not recommended without Nick choosing it.
- Retry spacing (Finding 2): per-queue options in `packages/database/src/jobs.ts`, beside `jobSchedules`, applied by `installJobs` with `createQueue(name, options)` and, for an existing queue, `updateQueue(name, options)`. Values `{ retryLimit: 6, retryDelay: 300 }`: six retries five minutes apart, 30 minutes from the first attempt, so every retry still runs on the day after the counted day and counts the same D. Precedent: `jobSchedules`, the existing per-queue table that `installJobs` applies.
- Remediation round 1, Finding 1: applied as recorded. The new prune is `pruneActivityDaysNoRetryNeeds` in `apps/worker/src/active-user-count.ts`, and the `activeUserCount` handler in `apps/worker/src/jobs.ts` opens it and the count as two `worker.asSystem` scopes in order. The repro's rule is now a test in `apps/worker/test/active-user-count.test.ts`.
- Remediation round 1, Finding 2: applied as recorded. The `updateQueue` branch for an existing queue is pinned by a test in `packages/database/test/jobs.test.ts` that resets the queue to pg-boss's defaults through the app role, reruns `installJobs` as the migration role, and reads back six retries 300 seconds apart. Precedent for a test opening its own pools by role: `packages/database/test/open.test.ts`.

## Confirmed Issues

### 1. A send that keeps failing stops the prune, so activity days outlive 30 days with no limit — MEDIUM

- **Location:** `apps/worker/src/active-user-count.ts:41` and `:49-55`, with `apps/worker/src/jobs.ts:60`
- **Attribution:** introduced, by `63083d6` (creator-analytics#658), the only code that deletes an activity day (`git grep -n "delete(activityDays)"` finds this line and the tests only; the cascade fires only on a user's deletion).
- **Real-world trigger:** OpenPanel answers 401 every day because its client secret was rotated in OpenPanel and not in Dokploy, or the self-hosted OpenPanel is down for days. Each morning's run and both its retries fail, each failure rolls the prune back, and no activity day is ever deleted. GlitchTip shows "A activeUserCount job failed" daily, which reads as a send problem, not as a retention breach.

**Evidence**

```ts
    await tx.sql.delete(activityDays).where(lt(activityDays.day, addDays(countedDay, -28)))
    ...
    // Last, and inside the count's transaction: a failed send rolls back the delete, so a retry
    // counts the same rows, the D-29 this count's `mau` included.
    await relay.deliverServerEvent({
```

**Failure mode:** The prune and the send share one transaction (`inSystemScope` wraps the whole handler in one `worker.asSystem`). A failed send rolls back the delete of every row older than D-28, not only the D-29 rows a retry needs. The repro seeds one row on 2026-10-02, has the fake OpenPanel answer 401, and runs the job at 00:15 on 2026-11-11, 12 and 13. Three sends are received, all refused, and the 2026-10-02 row is still there, 42 days old. The published policy says "The record of the days on which you used Stillstats is kept for 30 days, then deleted"; the README (`README.md:73`) and the table's doc comment (`packages/database/src/activity-days.ts:10`) say no row lives past 30 days.

**Recommended fix**

```ts
// apps/worker/src/active-user-count.ts
export async function pruneActivityDaysNoRetryNeeds(tx: Scoped<'system'>): Promise<void> {
  const countedDay = addDays(utcDayOf(tx.now), -1)
  await tx.sql.delete(activityDays).where(lt(activityDays.day, addDays(countedDay, -29)))
}
```

```ts
// apps/worker/src/jobs.ts, in jobHandlers
    activeUserCount: async (worker) => {
      await worker.asSystem(pruneActivityDaysNoRetryNeeds)
      await worker.asSystem(countActiveUsers(activeUsers))
    },
```

`countActiveUsers` stays as it is.

**Remediation brief**

- **Design intent:** The API inserts one activity day per user and UTC day; only the worker's system scope reads and deletes them. The daily job at 00:15 UTC counts D, the UTC day that just ended, over D-29 to D, deletes what the next day's count no longer needs, and sends last, so a rerun after a failed send counts the same rows. The retention bound is a published privacy claim. It must hold whether or not OpenPanel answers, and only the D-29 rows may wait for a send to land.
- **Full surface:** `apps/worker/src/active-user-count.ts:41` (stays) and a new exported prune beside `countActiveUsers`; `apps/worker/src/jobs.ts:60` (the `activeUserCount` handler, two scopes in order); the doc comment at `apps/worker/src/active-user-count.ts:21-26` and the inline comment at `:49-50` (the rollback now covers the D-29 rows only); `packages/database/src/activity-days.ts:5-11` doc comment and `README.md:73` "so no row lives past 30 days" (say 30 days while the send lands, and at most a day more while it fails); `apps/worker/test/active-user-count.test.ts:192-245` (see Must preserve); a new test in that file, the repro's rule: refused sends on three days leave no row older than D-29.
- **Must preserve:** the count over D-29 to D, the prune of D-29 inside the count's transaction, and the send last (`apps/worker/test/active-user-count.test.ts:96`, `:152`, `:178`); the not-configured path that prunes, reports once and does not fail (`:248`); the rerun after a failed send sending the same counts (`:192`). That last test's `expect(await readDays(worker)).toEqual(before)` at `:236` changes on purpose: after a failed send the rows older than D-29 (in its seeds, `counted-user-c` on 2026-10-11 and `counted-user-g` on 2026-10-02) are gone and every other row of `before` stays. Its rerun then still sends `{ dau: 2, wau: 3, mau: 6 }`, because neither removed row is in the 30 days. If the first scope fails, the job fails before any count or send and pg-boss retries it, which is the same backstop as today.
- **Do not touch:** the D-29-inside-the-transaction rollback (Dismissed: "a retry counts the same rows"); the partial OpenPanel settings rule (Dismissed).
- **Proof:** `pnpm exec vitest run --config docs/reviews/creator-analytics-640/repro/prune-on-failed-send.vitest.config.ts`, red now, green after; then `pnpm exec vitest run apps/worker/test/active-user-count.test.ts`.

### 2. The count's retries all run within seconds, so a short OpenPanel outage loses the day's point — MEDIUM

- **Location:** `packages/database/src/jobs.ts:171`
- **Attribution:** introduced. The `activeUserCount` queue is new in `63083d6`; the `createQueue(name)` loop is pre-existing (`git show 93106a5:packages/database/src/jobs.ts`), and its defaults suit the hourly, idempotent `cacheSweep` but not a once-a-day send with no backfill.
- **Real-world trigger:** OpenPanel restarts, redeploys or is briefly unreachable around 00:15 UTC for longer than about 15 seconds. All three attempts fail, the day has no point, and the spec's story 20 ("a failed send to be reported to GlitchTip and tried again, so that a short OpenPanel outage does not leave a hole in the chart") does not hold.

**Evidence**

```ts
    for (const name of jobNames) {
      if (!(await boss.getQueue(name))) await boss.createQueue(name)
    }
```

pg-boss 12.36.0 `dist/plans.js:81-90`: `retry_limit: 2, retry_delay: 0, retry_backoff: false`.

**Failure mode:** The queue is created with pg-boss's defaults, and a job copies its queue's retry values at insert. A failed run is retried at once, twice, at the worker's polling interval: three attempts of at most 3 seconds each, all within about 15 seconds. The repro reads the stored queue after the migrate step: `retryLimit × retryDelay` is 0, against a 600-second floor.

**Recommended fix**

```ts
// packages/database/src/jobs.ts, beside jobSchedules
export const queueOptions: Partial<Record<JobName, { retryLimit: number; retryDelay: number }>> = {
  activeUserCount: { retryLimit: 6, retryDelay: 300 },
}
```

```ts
// packages/database/src/jobs.ts, in installJobs
    for (const name of jobNames) {
      const options = queueOptions[name]
      if (!(await boss.getQueue(name))) await boss.createQueue(name, options)
      else if (options) await boss.updateQueue(name, options)
    }
```

**Remediation brief**

- **Design intent:** `installJobs` runs at the migrate step as the migration role and is idempotent: it creates each missing queue and writes each schedule. The count derives D from each attempt's own clock, so every retry must run on the same UTC day as the first attempt; six retries five minutes apart end 30 minutes after 00:15. Retries exist to ride out a short outage; a failed attempt is reported once by `work` (`apps/worker/src/jobs.ts:68-85`).
- **Full surface:** `packages/database/src/jobs.ts:171` and the new `queueOptions` beside `jobSchedules` (`:28-34`); `README.md:131` "which pg-boss retries" can name the six retries five minutes apart; a new test in `packages/database/test/jobs.test.ts`, under `describe('queues')`, carrying the repro's rule.
- **Must preserve:** every other queue is created exactly as today, with no options and no `updateQueue` call (`updateQueue` asserts at least one key, so it must never run with `undefined`); "every job name has a queue after the migrate step" (`packages/database/test/jobs.test.ts:89`); the schedules test (`:103`), including `missed: 'once'`.
- **Do not touch:** `missed: 'once'` on the schedules.
- **Proof:** `pnpm exec vitest run --config docs/reviews/creator-analytics-640/repro/active-user-count-retry.vitest.config.ts`, red now, green after; then `pnpm exec vitest run packages/database/test/jobs.test.ts`.

### 3. The new privacy policy test is a copy test, which the coding standards forbid — LOW

- **Location:** `apps/site/test/site.test.ts:1247-1263`, and the header comment's sentence at `:1133-1134`
- **Attribution:** introduced, by `17ad316` (creator-analytics#657).
- **Real-world trigger:** none for a user. The test fails when Nick edits the approved sentences and never when code breaks.

**Evidence**

```ts
  // The sentences Nick approved word for word on #657, on 2026-11-11.
  test('the privacy policy names the activity record in its analytics section, and its 30 days in its retention section', async ({
    ...
    const approvedAnalytics = [
      "Stillstats also counts how many people use the product each day, each week and each month. ...",
    ]
```

**Failure mode:** `CODING_STANDARDS.md` standard 2: "No test asserts that fixed copy is present ... the privacy policy contains the Limited Use statement ... Write no new one, and delete an existing one on sight." The test restates the source's literal sentences. #657's criterion asked for a test only "if the site's tests assert the policy's copy", and the #488 and #539 word-for-word tests in the same `describe` are the precedent it followed, but those predate the standard's rule and are themselves breaches (pre-existing, untouched; follow-up material, not this branch's job).

**Recommended fix:** delete the test at `:1247-1263`. In the header comment, drop "and that the policy names the activity record in its analytics section and its 30 days in its retention section" and ", and the activity record's test the sentences #657 approves," so it no longer claims a test that does not exist; keep #657 in the list of copy approvals.

**Remediation brief**

- **Design intent:** policy copy is held by Nick's approval on its issue, not by the suite. A site test may hold a rule over the copy from elsewhere, such as no em-dash or every manifest host named.
- **Full surface:** `apps/site/test/site.test.ts:1125-1137` (header comment) and `:1247-1263` (the test).
- **Must preserve:** the em-dash rule test and every other test in `seam 1: the privacy policy and the terms`; the #488 and #539 tests stay (outside this branch).
- **Do not touch:** `apps/site/privacy.html`; its copy is approved word for word.
- **Proof:** `pnpm exec vitest run apps/site/test/site.test.ts` green, and `grep -n "The sentences Nick approved word for word on #657" apps/site/test/site.test.ts` prints nothing.

### 4. Comment hygiene — LOW (aggregated)

- `packages/event-relay/src/index.ts:4` — "The self-hosted OpenPanel project the web app sends to, with a server-side client secret." → "The self-hosted OpenPanel project the API and the worker send to, with its server-side client secret."
- `packages/event-relay/src/index.ts:18` — "The API's own events, which no client may post" → "The server's own events, the API's and the worker's, which no client may post"
- `packages/event-relay/src/index.ts:55` — "Sends one of the API's own events as `sendServerEvent` does" → "Sends one of the server's own events as `sendServerEvent` does"
- `packages/event-relay/src/index.ts:61-62` — "short enough that an outage does not hold the extension's request open." → "short enough that an outage does not hold the extension's request open. The worker's active user count waits on it too, inside its transaction, and a timeout there fails the job."
- `apps/worker/Dockerfile:25-27` — "DELETION_LOG_KEY, GLITCHTIP_DSN." → "DELETION_LOG_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, TOKEN_ENCRYPTION_KEYS (the API's own), GLITCHTIP_DSN." (`apps/worker/src/worker.ts:39-42` requires all three; the line was edited by this branch, standard 3)

## Needs Further Investigation

### A. One counted day can reach OpenPanel twice, and "Sum of property" would show it doubled

`deliverServerEvent` gives up after the relay's 3-second timeout (`packages/event-relay/src/index.ts:63`; the worker passes no `sendTimeout` at `apps/worker/src/worker.ts:47`). If OpenPanel stores the event but answers after 3 seconds, the job fails, the retry sends a second `active_users_counted` for the same D, and the day's point doubles. A send that lands followed by a failed commit has the same effect. Separately, D comes from each run's clock, not the cron slot: a worker down from before 00:15 on day R until between 00:00 and 00:15 on R+1 has `missed: 'once'` send R's job at R+1, which counts R, and then R+1's 00:15 job counts R again. What would confirm the first: whether OpenPanel's `/track` handler persists or queues an event before it answers, read from OpenPanel's source; if it does, a longer timeout for the worker's relay (`createEventRelay(openPanel, { reporter, sendTimeout: () => AbortSignal.timeout(30_000) })`) narrows it, and the README can state the send is at least once. The missed-run case needs D taken from the job's scheduled time, which is larger than this branch.

## Reviewed and Dismissed

- One or two of the three OpenPanel settings counts as not configured, with no refusal to start — a recorded #658 decision, the API's rule since base, and the worker reports it every morning.
- A failed activity-day insert fails the read with a 500 — a recorded #656 decision; the insert shares the read's database, and a swallowed failure would be a silent hole in the count. The "Delete me" race it allows ends with the user deleted anyway.
- The relay now builds its headers inside the `try` — this only strengthens the documented never-reject contract of `send` and `sendServerEvent`; no caller relies on a rejection.
- `INSERT ... ON CONFLICT DO NOTHING` under an insert-only policy — no `RETURNING`, so no select policy is needed; the database test covers a zero row count.
- Grants and FORCE RLS on `activity_days` — `0001_grants.sql` default privileges and `migrate.ts:9-18` cover a new table.
- The prune keeps the D-29 rows inside the count's transaction — the spec's rule that a rerun counts the same rows; Finding 1 keeps it.
- The transaction stays open during the send — 3 seconds at most, once a day, locking only the rows it deletes.
- A signed-in HEAD request, or `/channels/connect/videos`, records an activity day — consistent with "every signed-in request to them counts whatever it answers".
- A row can live 30 days and 15 minutes — the policy's claim is at day granularity.
- The privacy policy's "Last updated" shows no diff — set to November 11, 2026 at base by `cbde6a9`, the day of this change.

## Minor / nits

- `apps/worker/test/active-user-count.test.ts:148-149`: `toHaveProperty('payload')` and `not.toHaveProperty('payload.profileId')` repeat what the exact-body `toEqual` of `countedRequest` already proves (one rule, one test). The header assertions beside them are distinct rules and stay.
- `packages/database/test/jobs.test.ts:89`: "every job name has a queue" computes its expectation from `jobNames`, so it passes at base and pins no `activeUserCount` queue; it guards the loop only. The schedules test is what pins the new queue.
- `packages/event-relay/src/index.ts:86`: the no-options relay's `deliverServerEvent` resolves, against its doc's "rejects when OpenPanel refuses the event or never answers". Unreachable today, since the worker passes no relay when unconfigured.
- `packages/event-relay/src/index.ts:147`: `RefusedEventError` says "a server event" for every refusal, `send`'s included; only server events surface it.
- `apps/worker/src/active-user-count.ts:31`: the `= { dau: 0, wau: 0, mau: 0 }` default exists for indexed-access typing; an aggregate always answers one row.
- `packages/api-types/src/days.ts`: `utcDayOf` has no unit test beside `pacificDayOf`'s; the API's 23:59Z and 00:30Z test covers it indirectly.

## Test quality

Tests added or changed across 11 files; the audit ran 157 of them at `93106a5`: 123 green, 34 red, plus 85 events and Stripe events tests green once their import pointed back. Every test of new behaviour is red at base. Green at base and expected: the moved relay timeout test, the events and Stripe events tests (import only), the worker's `jobs.test.ts` (signature only), the `scopes.test.ts` exclusion list, and "every job name has a queue" (Minor). Tautology shapes found: 1, the copy test (Finding 3). No mocks of the unit under test, no call-shaped assertions, no snapshots, no assertion-free tests; the DAU, WAU and MAU expectations are derived by hand from the seeds.

## Before opening the PR

- **CI readiness:** lint, typecheck, build and the full suite green at `9efe412`. The two repro configs sit outside the root `include`, so `pnpm test` does not run them.
- **Commit hygiene:** this doc and `repro/` commit together as `creator-analytics#640 pre-PR review 1`.
- **Likely reviewer asks:** the migration and its policies (0023), the worker's new OpenPanel settings in Dokploy on both environments (#659), and the retention bound under a failing send (Finding 1).

## Verdict

Not ready as-is: fix Findings 1 and 2 before the PR opens. Findings 3 and 4 are LOW and can ride in the same remediation; A is follow-up material once OpenPanel's handler is read.

## Remediation — 2026-11-11

| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 1 (MEDIUM) | `bc48c58` creator-analytics#640 pre-PR review 1 finding 1: A send that keeps failing stops the prune, so activity days outlive 30 days | red→green: `pnpm exec vitest run --config docs/reviews/creator-analytics-640/repro/prune-on-failed-send.vitest.config.ts`, and the same rule as "three days of refused sends leave no activity day older than D-29" in `pnpm exec vitest run apps/worker/test/active-user-count.test.ts` (10 passed) | 1 (the new prune's doc comment: why it runs in its own scope); 3 existing comments corrected per the brief's surface | proved by execution |
| 2 (MEDIUM) | `e7d4f54` creator-analytics#640 pre-PR review 1 finding 2: The count's retries all run within seconds, so a short OpenPanel outage loses the day's point | red→green: `pnpm exec vitest run --config docs/reviews/creator-analytics-640/repro/active-user-count-retry.vitest.config.ts`, and two new tests in `pnpm exec vitest run packages/database/test/jobs.test.ts` (9 passed) | 1 (the `queueOptions` doc comment: every retry must run on the day after the counted day) | proved by execution |
| 3 (LOW) | — deferred | — | — | LOW tail, not worked at the default scope |
| 4 (LOW, comment hygiene) | — deferred | — | — | LOW tail, not worked at the default scope |

After both fixes: `pnpm lint`, `pnpm typecheck` and `pnpm build` green; `pnpm test` green, 160 files, 4,002 passed, 1 expected fail (3 tests more than the review's run). No verify agent ran: both findings are MEDIUM, both proofs were executed red then green, and neither touched a shared computation core. The browser walk was not rerun; neither fix touches the web app.

### Known regressions, deferred

- none

### Rework briefs

- none, no rework pass
