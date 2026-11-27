# Pre-PR review: creator-analytics#640 Daily, weekly and monthly active users from anonymous data

**Branch:** `creator-analytics-640-active-users` vs `origin/main` (merge-base `93106a5` "Merge pull request #654 from nick-vogel/release-2026.11.11.2")
**Reviewed at:** HEAD `01f7333` ("creator-analytics#640 Delete the #657 copy test, which CODING_STANDARDS.md standard 2 forbids"), clean tree, no uncommitted or untracked files at review time. Whole branch: 54 files, +3,563 / −102.
**Delta under review:** since `7b8c12c` ("creator-analytics#640 pre-PR review 1 remediation closure table"), the HEAD that pre-PR review 2 reviewed: 4 files, +229 / −23. One is code or tests (`apps/site/test/site.test.ts`, +4 / −23, from `01f7333`). The other 3 are review 2's doc and its repro, committed in `84816cd` ("creator-analytics#640 pre-PR review 2").
**Reviewed against:** pre-PR review 2 (`pre-pr-review-2.md`), its Approach decisions and confirmed findings; the run 1 close-out decisions of 2026-11-11 (Nick's choice 3: delete the #657 copy test as a fix in this work, keep the policy's "kept for 30 days, then deleted"); `CODING_STANDARDS.md` standard 2.
**Date:** 2026-11-11
**Reviewer:** 1 code-review agent + verify pass

## What was verified and how

| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | green, lockfile unchanged |
| Lint | `pnpm lint` | green |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` | green |
| Full suite | `pnpm test` (Testcontainers Postgres), `TEST_DATABASE_ADMIN_URL` unset | green: 160 files, 4,001 passed, 1 expected fail (one fewer than review 2's 4,002, which is the deleted test) |
| Browser walk | `pnpm run --if-present test:browser` | green: no content security policy violation in 59 steps |
| Review 1's proofs | `pnpm exec vitest run --config docs/reviews/creator-analytics-640/repro/prune-on-failed-send.vitest.config.ts` and `... repro/active-user-count-retry.vitest.config.ts` | both green |
| Review 2's proof (Finding 1) | `pnpm exec vitest run --config docs/reviews/creator-analytics-640/repro/retry-crosses-midnight.vitest.config.ts` | red, as review 2 intended: the event lacks `2026-11-10T12:00:00.000Z` |
| Delta review of `01f7333` | 1 `pr-review-finder` agent over `git diff 84816cd -- apps/site/test/site.test.ts`, plus own read of `:1118-1142` | the test and both header claims are gone, #657 stays in the approvals list, the #488 and #539 tests stay, `apps/site/privacy.html` unchanged; `privacyMain` (9 uses), `textOf` (15), `sectionOf` (8) still used; no reference to the deleted test left in the repo outside `.md` files; one reflow artefact (Comment hygiene) |
| Rest of the branch unchanged since review 2 | `git diff --quiet 7b8c12c -- apps/worker packages README.md docs/deploy.md CONTEXT.md apps/api apps/site/privacy.html` | clean, so review 2's Findings 1 and 3 and Needs Further Investigation A stand as written; their lines re-read at HEAD |
| Tautology audit | not run | the delta adds no tests; it deletes one |
| Live pg-boss retries and OpenPanel | Not run: outside the suite by design | #659, the manual check |

**Overall:** The close-out fix does what Nick chose and nothing more: the #657 copy test and the header sentences that claimed it are gone, and every full check is green. The only new defect is a stray line break the comment edit left behind. Review 2's two other LOWs were not worked, since round 2 converged without remediation, so they are re-emitted unchanged. Nothing blocks the PR.

## Approach decisions

- Prune under a failing send (review 1, Finding 1): the rows no retry of the counted day needs, those older than D-29, are deleted in their own committed system scope before the count; the count's transaction keeps today's count, then delete older than D-28 (the D-29 rows), then send. Applied in `bc48c58` as `pruneActivityDaysNoRetryNeeds`. Cost: while the send fails, a row lives up to 31 days and 15 minutes, not the policy's 30. Nick kept the policy's "kept for 30 days, then deleted" at the run 1 close-out (2026-11-11), with the overrun recorded in the README; this is settled, not open.
- Retry spacing (review 1, Finding 2): per-queue options in `queueOptions` beside `jobSchedules`, applied by `installJobs` with `createQueue(name, options)` or `updateQueue(name, options)`, `{ retryLimit: 6, retryDelay: 300 }`. Applied in `e7d4f54`.
- Counted day of a retry (review 2, Finding 1, re-emitted here as Finding 1): correct the comments only in this branch. The mechanism fix, taking D from the job's scheduled occurrence rather than each attempt's clock, belongs with Needs Further Investigation A's missed-run case in one follow-up ticket, since both have the same cause and the handler receives no job metadata today (`Handler = (worker, data)` in `apps/worker/src/jobs.ts`).
- Policy copy tests (review 2, Finding 2): policy copy is held by Nick's approval on its issue, not by a test; deleted in `01f7333` per `CODING_STANDARDS.md` standard 2. The pre-existing #488 and #539 word-for-word tests stay, by Nick's close-out brief.

## Prior-review closure

Review 2 held 3 confirmed findings, all LOW: 1 fully fixed, 0 partially fixed, 2 untouched. Round 2 converged, so no remediation ran and review 2 has no closure table and no "Known regressions, deferred" list.

| Review 2 finding | Status | Evidence |
| --- | --- | --- |
| 1 (LOW) A retry after midnight counts the next day | untouched | `packages/database/src/jobs.ts:38-39` still reads "and all still run on the day after the day they count"; `apps/worker/src/active-user-count.ts:61` still reads "its retries included"; repro still red. Re-emitted as Finding 1. |
| 2 (LOW) The #657 copy test | fully fixed | `01f7333`; `grep -n "The sentences Nick approved word for word on #657" apps/site/test/site.test.ts` prints nothing; suite green. Intent holds: no test restates the #657 sentences, and the header comment claims no test that is gone. |
| 3 (LOW) Comment hygiene | untouched | all 5 entries still present at HEAD. Re-emitted inside Finding 2, with one new entry from `01f7333`. |

No finding was "resolved" by editing only a comment or a doc; Finding 2's fix was a test deletion. No subsystem has been rewritten more than once in response to review, so fix-begets-finding does not apply.

## Confirmed Issues

### 1. A retry that runs after midnight counts the next day, so a late first attempt loses its day's point and double-counts the next — LOW

- **Location:** `apps/worker/src/active-user-count.ts:30` (and `:66`), with the comments at `packages/database/src/jobs.ts:37-39` and `apps/worker/src/active-user-count.ts:61-63`
- **Attribution:** introduced. Against `$BASE`: the count and its clock-derived D are new in `63083d6` (creator-analytics#658), and `e7d4f54` widened the retry window to 30 minutes and added the comment "all still run on the day after the day they count". Against `7b8c12c`: unchanged; this is review 2's Finding 1, not worked because round 2 converged.
- **Real-world trigger:** the worker is down at 00:15 UTC and comes back between 23:45 and 00:00 UTC that same day, so `missed: 'once'` sends the day's job late, and OpenPanel refuses that first attempt. A second route: the worker stops during the 00:15 to 00:45 retry window and stays down past the next midnight. Both need two faults at once. LOW, capped: upgrade to MEDIUM if worker deploys or restarts routinely land late in the UTC day; check via the Dokploy deploy history of the worker service for deploys between 23:00 and 00:00 UTC.

**Evidence**

```ts
    const countedDay = addDays(utcDayOf(tx.now), -1)
```

```ts
 * user count's six retries five minutes apart ride out a short OpenPanel outage, and all still run
 * on the day after the day they count.
```

**Failure mode:** each attempt takes D from its own clock. A first attempt at 23:50 on 2026-11-11 counts 2026-11-10 and is refused; its retry at 00:05 on 2026-11-12 counts 2026-11-11 and lands, stamped `2026-11-11T12:00:00.000Z` with `dau: 0` (repro, re-run red this round). 2026-11-10 then has no point, and the regular 00:15 job counts 2026-11-11 again, so that day gets two points. The two comments state the opposite as an invariant, which is how a maintainer would miss it.

**Recommended fix:** correct the two comments in this branch, and move the mechanism fix into the follow-up ticket with Needs Further Investigation A.

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

- **Design intent:** the daily job at 00:15 UTC counts D, the UTC day before the attempt's clock, over D-29 to D, prunes in two steps (older than D-29 in its own scope, then the D-29 rows inside the count's transaction) and sends last. pg-boss copies the queue's six retries 300 s apart onto each cron-sent job and reruns the whole handler on each. The comments must say that D is per attempt, so nobody relies on "every retry counts the same day" until a follow-up takes D from the job itself.
- **Full surface:** `packages/database/src/jobs.ts:36-40`; `apps/worker/src/active-user-count.ts:60-64`. No code line changes in this branch. The follow-up (one ticket with Needs Further Investigation A) would touch `apps/worker/src/jobs.ts` (`Handler` gets the job's created time or scheduled occurrence), `apps/worker/src/active-user-count.ts:30` and `:66`, and `apps/worker/test/active-user-count.test.ts`, with `docs/reviews/creator-analytics-640/repro/retry-crosses-midnight.test.ts` as its red.
- **Must preserve:** `queueOptions` values `{ retryLimit: 6, retryDelay: 300 }` and the tests that pin them (`packages/database/test/jobs.test.ts:98`, `:104`); the two-scope order in the `activeUserCount` handler (`apps/worker/src/jobs.ts:64-67`) and the tests at `apps/worker/test/active-user-count.test.ts:192` and `:247`.
- **Do not touch:** the D-29-inside-the-transaction rollback (review 1, Dismissed); `missed: 'once'` on the schedules; `updateQueue` only when options exist (review 2, Dismissed).
- **Proof:** `grep -n "all still run" packages/database/src/jobs.ts` prints nothing; `pnpm lint` green. The repro `pnpm exec vitest run --config docs/reviews/creator-analytics-640/repro/retry-crosses-midnight.vitest.config.ts` stays red in this branch, on purpose; it is the follow-up's red.

### 2. Comment hygiene — LOW (aggregated)

Review 2's Finding 3, unchanged since `7b8c12c`, plus one entry introduced by `01f7333`.

- `apps/site/test/site.test.ts:1125-1135` — the `01f7333` edit left a 35-character line, "// sends rests on the extension's", between two full lines, and two short lines at `:1125-1126` → rewrap the comment from `:1125` through "the worker's tests (#640)." at `:1135` to the file's line width, words unchanged, so ":1133" reads "// sends rests on the extension's event tests, and whether the activity record is kept as the ..." on one line.
- `packages/event-relay/src/index.ts:4` — "The self-hosted OpenPanel project the web app sends to, with a server-side client secret." → "The self-hosted OpenPanel project the API and the worker send to, with its server-side client secret."
- `packages/event-relay/src/index.ts:18` — "The API's own events, which no client may post" → "The server's own events, the API's and the worker's, which no client may post"
- `packages/event-relay/src/index.ts:55` — "Sends one of the API's own events as `sendServerEvent` does" → "Sends one of the server's own events as `sendServerEvent` does"
- `packages/event-relay/src/index.ts:61-62` — "short enough that an outage does not hold the extension's request open." → "short enough that an outage does not hold the extension's request open. The worker's active user count waits on it too, inside its transaction, and a timeout there fails the job."
- `apps/worker/Dockerfile:25-27` — "DELETION_LOG_KEY, GLITCHTIP_DSN." → "DELETION_LOG_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, TOKEN_ENCRYPTION_KEYS (the API's own), GLITCHTIP_DSN."

## Needs Further Investigation

### A. One counted day can reach OpenPanel twice, and "Sum of property" would show it doubled

Carried unchanged from review 2. A send that OpenPanel stores but answers after the relay's 3-second timeout (`packages/event-relay/src/index.ts:63`; the worker passes no `sendTimeout` at `apps/worker/src/worker.ts:47`) can repeat up to six times before one is answered in time. The missed-run case (D from each run's clock, `missed: 'once'` sending a day's job late) is the same cause as Finding 1. What would confirm the first: whether OpenPanel's `/track` handler persists or queues an event before it answers, read from OpenPanel's source. One follow-up ticket should take D from the job's scheduled occurrence (covering Finding 1 and the missed-run case) and decide the worker relay's timeout.

## Reviewed and Dismissed

- Helpers left unused by the deleted test — `privacyMain`, `textOf` and `sectionOf` each have other callers in `apps/site/test/site.test.ts`; the test brought no imports of its own; lint green.
- A dangling reference to the deleted test — "activity record" now appears in the file only in the #640 claim at `:1134`, which names the API's and the worker's tests, still true; the test's title appears nowhere else in the repo outside review docs.
- The #488 and #539 word-for-word test (about `:1198`) and the tip sentence `toContain` at `:1243` — pre-existing on `$BASE`, outside this branch; Nick's close-out brief keeps them. A separate cleanup, if ever, is his call.
- `apps/site/privacy.html` — unchanged since `7b8c12c`; its #657 copy stands on Nick's approval.
- Review 2's dismissals (pg-boss `updateQueue` COALESCE, `createQueue(name, undefined)`, cron jobs taking the queue's retry values, no jitter, the `jobs.test.ts` queue reset, GlitchTip volume, the two scopes straddling midnight, the 31-day bound, "no row lives past 31 days") — the code they cover is unchanged since `7b8c12c`, so they stand.

## Minor / nits

- `apps/site/test/site.test.ts:1137-1138` — a 126-character comment line then a 22-character "// own <main> alone."; pre-existing on `$BASE` (`git show 93106a5:apps/site/test/site.test.ts`, line 1136). Can ride with Finding 2's rewrap if convenient.
- Review 2's nits stand unchanged: `packages/database/test/jobs.test.ts:98-102` pins only a lower bound on the retry span; no test fails the first scope of `apps/worker/src/jobs.ts:64-67`; `packages/database/test/jobs.test.ts:104-124` opens its own pool where the `boss` fixture would serve; `pruneActivityDaysNoRetryNeeds` reads awkwardly.

## Test quality

The delta adds no tests; it deletes one, the #657 copy test, as Nick chose. Tautology audit not run for that reason. Review 2's recommendation to strengthen "three days of refused sends leave no activity day older than D-29" (`apps/worker/test/active-user-count.test.ts:247-265`) by seeding `2026-10-12` still stands; that test is review 1 Finding 1's proof, so strengthen it, never delete it.

## Before opening the PR

- **CI readiness:** lint, typecheck, build, the full suite and the browser walk green at `01f7333`. The three repro configs sit outside the root `include`; `retry-crosses-midnight` is red on purpose and `pnpm test` does not run it.
- **Commit hygiene:** this doc commits alone as `creator-analytics#640 pre-PR review 3`; it adds no repro.
- **Likely reviewer asks:** the migration and its policies (0023), the worker's OpenPanel settings in Dokploy on both environments (#659), and the 31-day bound while OpenPanel refuses (settled at close-out, recorded in the README).

## Verdict

Ready to open the PR with follow-ups. Review 2's one worked finding (the #657 copy test) is fully fixed against its intent; review 2's other 2 LOWs were left open because round 2 converged, and none of its findings was resolved by a comment or doc edit alone. This round has 2 confirmed LOWs and no MEDIUM or higher: the retry window's late-start edge (Finding 1), whose comment fix can ride in the PR and whose mechanism fix joins Needs Further Investigation A in one follow-up ticket, and the comment hygiene batch (Finding 2), whose only new entry is a line break the close-out fix left. The confirmed list is shrinking toward comment drift, so the branch has converged.
