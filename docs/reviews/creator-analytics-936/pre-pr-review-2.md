# Pre-PR review: creator-analytics#936 stored retention curves, compared on one chart (round 2)

**Branch:** `creator-analytics-936-retention-curves` vs `origin/main` (merge-base `50d695399dfd8c31e04e16050a574403b987f933`, "Merge pull request #922 from nick-vogel/release-2026.11.20-date")
**Reviewed at:** HEAD `28cb5b03` (creator-analytics#936 pre-PR review 1 remediation closure table) + 0 files with uncommitted changes, 57 files total, +7163 / −103. The only untracked file is this review's own, `docs/reviews/creator-analytics-936/repro/nested-plan-scope.patch`, beside this doc.
**Delta under review:** since `f5f2c5ce` (creator-analytics#952 Describe the retention comparison on the upgrade screen, pricing section and FAQ), the HEAD that `pre-pr-review-1.md` reviewed. The delta is the review 1 commit `ea26366d` and its remediation `3fd33585`, `008840fa`, `a0c893e5`, `720f45dd`, `28cb5b03`: 9 code files, +252 / −105 outside `docs/reviews/`.
**Reviewed against:** epic nick-vogel/creator-analytics#936 and its children #950, #951 and #952; `pre-pr-review-1.md` (its findings, Approach decisions and remediation closure table); the repo's `.claude/rules/` and the global `~/.claude/rules/`. There are no plan or spec docs under `docs/`.
**Date:** 2026-11-20
**Reviewer:** 1 code-review agent (the whole delta), 1 tautology-audit agent, Gemini, and a verify pass with one executed mutation.
**Gemini:** gemini-4-carbon, 29217 in / 21917 out+thinking tokens, est. $0.2776. Found 3: confirmed 1 (unique 0), rejected 0, NFI 0, nits 2

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | green |
| Lint | `pnpm lint` (biome check .) | green, 840 files |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` | green |
| Unit and integration suites | `pnpm test` (Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | green: 218 files, 5433 passed, 1 expected fail |
| Browser walk | `pnpm run --if-present test:browser` | "The browser walk passed." The 401s it logs come from the signed-out states it walks. |
| Prior Finding 1's repro | `pnpm exec vitest run --config docs/reviews/creator-analytics-936/repro/quota-row-lock.vitest.config.ts` | green (red `55P03` in round 1). The Analytics quota row is no longer held across the run. |
| Prior Finding 2's facts against the code | read `packages/retention-engine/src/history-purge.ts:52-53`, `apps/worker/src/deleted-videos.ts:52-90`, `apps/api/src/retention-curves.ts:33-34` (`historyReadable`), the `tier !== 'paid'` gate at `apps/worker/src/retention-curves.ts:125`, and the channel cascade | every sentence of the rewritten policy items matches the code |
| Tautology audit of the delta's tests | scratch worktrees at `$BASE` (`50d69539`), at `f5f2c5ce` and at HEAD, with HEAD's six changed test files copied in | all 8 audited cases red at the oracle their brief names, for the stated reason. Two mutations of the new worker test stay green (Findings 1 and 2). |
| **Finding 1 (nested scopes mutant)** | executed: scratch worktree at HEAD, `git apply docs/reviews/creator-analytics-936/repro/nested-plan-scope.patch`, then `pnpm typecheck`, `pnpm exec vitest run apps/worker/test/retention-curves.test.ts` and the quota-row repro | typecheck green, 19 of 19 worker tests green, repro green, on a mutant that runs every video's read inside the plan's transaction |
| **Finding 2 (unrelated throw mutant)** | executed by the audit agent: `if (videoId === 'oldest') throw new Error('an unrelated failure, not a database error')` at the top of the per-video scope | the new database error test stays green |
| Em-dashes in shipped copy | delta's added lines in `apps/site/privacy.html` | none |
| Gemini finder | `~/.claude/bin/gemini-review f5f2c5ce` | ran, 3 findings |
| Real Google behaviour and production hold times | | not runnable here: needs Nick's walk of a paid channel on production |

**Overall:** The remediation holds. The curve refresh now commits each video's read in its own transaction, the preserved repro is green, the privacy policy's new sentences match the code, and the rewritten web tests go red at the base. All full checks are green. One gap is left before the PR opens: nothing that CI runs can tell a correct refresh from one that runs every read inside the plan's transaction, so the round 1 defect could come back with the suite green (Finding 1). Findings 2 and 3 are small and belong in the same pass.

## Approach decisions
- **Round 1, Finding 1, the curve refresh's transaction:** commit each video's read in its own channel scope, after one plan scope, as `activeUserCount` in `apps/worker/src/jobs.ts` runs two scopes in sequence. Rejected: committing quota outside the caller's transaction in the gateway's `spend`. Unchanged.
- **Round 1, Finding 2, the privacy policy:** describe the curves on the reach history's windows, item by item. Unchanged.
- **Copy pins against `tests-state-a-rule`:** kept, by the tickets' acceptance criteria (#950, #952) and the #952 assumption, until Nick approves the words on the epic's PR. Not reopened here.
- **Remediation 1, Finding 1, where the scopes open:** the job handler hands `refreshRetentionCurves` the `WorkerDatabase`, and the module opens the plan scope and one scope per due video. Rejected: a bound scope opener passed from the handler. Unchanged, and the finder's suggestion to narrow it is dismissed below on this decision.
- **Remediation 1, Finding 1, the fix's own failure path:** a database error in one video's scope is proved with a curve that repeats a point. Unchanged; Finding 2 tightens what the test accepts.
- **Remediation 1, Finding 2, proof over the policy:** the `affirms` facts name the curves in the paid-retention, deleted-video and disconnect items. Unchanged.
- **Remediation 1, Finding 3, the self-computed backfill note:** asserted with `toContain('12 videos to go.')`. Unchanged.
- **Round 2, Finding 1, how the suite holds the per-read commit:** a test in `apps/worker/test/retention-curves.test.ts` hands the handler a `WorkerDatabase` that counts how many of the run's scopes are open, and asserts the run opens one scope to plan and one per read, never one inside another. It wraps `forChannel` the way the harness's own `worker` fixture does (`packages/database/test/harness.ts:193-199`). The file's Limits note says the test transaction cannot show a lock being released, and names the repro. Rejected: moving the real-connection repro into the CI suite, because its rows (users, a paid channel, today's quota rows) commit to the container every test file shares while they run, and roster tests in system scope would see them.
- **Remediation 2, Finding 1:** applied as recommended: the counted `WorkerDatabase` wraps the fixture's `forChannel` and passes `asSystem` through, and the Limits sentence was added word for word. No production file changed.

## Confirmed Issues

### 1. Nothing CI runs can tell the per-read commit from a run that reads inside the plan's transaction, so round 1's defect can come back with the suite green — MEDIUM
- **Location:** `apps/worker/test/retention-curves.test.ts:1-6` (the Limits note) and `:636-663` (the new database error test); the code it should hold is `apps/worker/src/retention-curves.ts:122-188`
- **Found by:** both
- **Attribution:** introduced by the remediation. `3fd33585` (creator-analytics#936 pre-PR review 1 finding 1: the curve refresh holds the quota row every channel shares for its whole run) added the test as the fix's in-suite proof. `$BASE` has neither the refresh nor the test. Not a known regression: the prior doc's "Known regressions, deferred" reads "none".
- **Real-world trigger:** none for users today; the code is right and the repro is green. It is a claim of coverage the branch does not have. A later refactor that moves the per-video loop inside the plan scope's callback (for example to reuse its `tx.now` or its candidates) keeps every CI test green, and in production the plan transaction then holds the shared Data API quota row, which its uploads read upserts on a cache miss, and a pooled connection, for the whole run.
- **Severity:** MEDIUM, capped, by the tautology audit's default for a coverage claim the branch does not have, as round 1's Finding 3 was rated. It is the only guard on round 1's one blocking defect.

**Evidence**
```ts
// apps/worker/test/retention-curves.test.ts:656-662
await expect(handlers.retentionCurveRefresh(worker, { channelId })).rejects.toThrow()

expect(await storedReads(worker, channelId)).toEqual({
  newest: today.toISOString(),
  older: today.toISOString(),
})
```
`packages/database/test/harness.ts:62-66`: "A test runs every scope as a savepoint on its one connection ... A scope opened inside a running scope ... runs at once, as a savepoint inside its parent." The audit agent traced why nesting is invisible: every scope is opened from the test's one transaction handle, so drizzle names each savepoint `sp1` (`drizzle-orm` node-postgres `session.js:206`), and the throwing inner scope's `rollback to savepoint sp1` leaves the outer scope's earlier writes in place.

**Failure mode:** with `docs/reviews/creator-analytics-936/repro/nested-plan-scope.patch` applied (it moves the `for ... of plan.due` loop inside the plan scope's callback and returns `{ due: [] }`), `pnpm typecheck` is green, all 19 tests in `apps/worker/test/retention-curves.test.ts` are green, and the quota-row repro is green too: the repro's probe is an Analytics read, and the mutant holds the Data API row, not the Analytics one. The repro also sits outside the root vitest `include` (`{apps,packages}/*/{src,test}/**/*.test.ts`), so CI never runs it. The file's Limits note says the handlers run "inside the test's transaction", but not that this hides every lock and every nesting.

**Recommended fix**
```ts
// apps/worker/test/retention-curves.test.ts, beside the database error test
test('a run opens one scope to plan and one per read, never one inside another', async ({
  web,
  worker,
  clock,
  google,
  keys,
  handlers,
}) => {
  setNow(clock, google, today)
  const channelId = await connectedChannel(web, google, keys, 'curves-scopes', 'UC-scopes')
  await subscribe(worker, channelId)
  uploadsAt(google, 'UC-scopes', [
    published('newest', daysBefore(40)),
    published('older', daysBefore(50)),
  ])
  let open = 0
  const openAtEntry: number[] = []
  const counted: WorkerDatabase = {
    forChannel: async (id, work) => {
      open += 1
      openAtEntry.push(open)
      try {
        return await worker.forChannel(id, work)
      } finally {
        open -= 1
      }
    },
    asSystem: (work) => worker.asSystem(work),
  }

  await handlers.retentionCurveRefresh(counted, { channelId })

  expect(openAtEntry).toEqual([1, 1, 1])
  expect(Object.keys(await storedReads(worker, channelId)).sort()).toEqual(['newest', 'older'])
})
```
Add to the Limits note at `:1-6`, after "inside the test's transaction;": "that transaction holds every scope's locks to its end, and a scope opened inside another becomes a savepoint, so these tests cannot show a run releasing the quota rows every channel shares between reads. The scope count test holds the shape that releases them, and the repro in `docs/reviews/creator-analytics-936/repro/quota-row-lock.test.ts` shows the release on separate connections." Import `type WorkerDatabase` if the file does not already. Run `pnpm format` on the file.

**Remediation brief**
- **Design intent:** the gateway records each Google call's quota units by upserting the shared `quota_usage (api, quota_day)` row on the caller's transaction, so a transaction that spans several Google calls holds that row for all of them. The refresh therefore opens one plan scope (entitlement, uploads read, stored read times, due order and budget) and closes it, then one scope per due video holding one Google call and its writes. "Closed before the next opens" is the property the suite must hold, because the harness cannot observe the lock itself.
- **Full surface:** `apps/worker/test/retention-curves.test.ts:1-6` (Limits note) and a new test beside `:638`. The wrapper mirrors the harness fixture at `packages/database/test/harness.ts:193-199`, whose `forChannel: (channelId, work) => ...` arrow already checks against `WorkerDatabase`'s generic signature. No production file changes.
- **Must preserve:** every test in `apps/worker/test/retention-curves.test.ts`, the database error test included (Finding 2 tightens it); `apps/worker/test/jobs.test.ts`; the repro config and test under `docs/reviews/creator-analytics-936/repro/`, unchanged.
- **The fix's own failure:** if the counted wrapper stops forwarding `asSystem`, or a later change makes the refresh call `asSystem`, the count test still covers only `forChannel`; name `forChannel` in the test's assertion target, as above, and leave `asSystem` a plain pass-through.
- **Do not touch:** `apps/worker/src/retention-curves.ts` and `apps/worker/src/jobs.ts` (correct today; see Reviewed and Dismissed for the scope-opener suggestion); the gateway's `spend` and `quotaAllows`.
- **Proof:** in a scratch worktree at the remediated HEAD, `git apply docs/reviews/creator-analytics-936/repro/nested-plan-scope.patch` and run `pnpm exec vitest run apps/worker/test/retention-curves.test.ts -t "one scope to plan"`: it must be red there (`openAtEntry` is `[1, 2, 2]`). On the branch it must be green. The patch applies cleanly at `28cb5b03`; if the remediation reflows `apps/worker/src/retention-curves.ts`, regenerate the same mutation by hand.

### 2. The new database error test passes for any throw from the last video's scope — LOW
- **Location:** `apps/worker/test/retention-curves.test.ts:656`
- **Found by:** Claude
- **Attribution:** introduced by the remediation, in `3fd33585`.
- **Real-world trigger:** none for users. A `test-every-fallback-path` miss: the rule asks that the original error still surfaces, and `rejects.toThrow()` accepts any error.
- **Severity:** LOW. The stored-reads assertions narrow the hole to a throw from the third video's scope.

**Evidence**
```ts
await expect(handlers.retentionCurveRefresh(worker, { channelId })).rejects.toThrow()
```
The audit agent probed the real rejection: `Failed query: insert into "retention_curves" ...`, whose `cause` carries code `23505`, `duplicate key value violates unique constraint "retention_curves_point_idx"`. With `if (videoId === 'oldest') throw new Error('an unrelated failure, not a database error')` inserted at the top of the per-video scope, the test stayed green.

**Recommended fix**
```ts
await expect(handlers.retentionCurveRefresh(worker, { channelId })).rejects.toMatchObject({
  cause: { code: '23505', constraint: 'retention_curves_point_idx' },
})
```
This mirrors `packages/database/test/consent-states.test.ts:68`. Rename the test to "a database error storing one curve keeps the curves read before it, and throws to the job runner", since the test drives the handler, not `work`.

**Remediation brief**
- **Design intent:** a database error in one video's scope rolls back that scope only, and the error itself reaches the job runner in `apps/worker/src/jobs.ts`, which reports it and rethrows so pg-boss retries.
- **Full surface:** `apps/worker/test/retention-curves.test.ts:636-663`.
- **Must preserve:** the stored-reads and stored-curves assertions at `:658-662`; the comment above the test naming why a repeated point is a database error.
- **Do not touch:** the production refresh.
- **Proof:** `pnpm exec vitest run apps/worker/test/retention-curves.test.ts -t "a database error"` green. Then, in a scratch worktree, insert `if (videoId === 'oldest') throw new Error('unrelated')` as the first line of the per-video scope in `apps/worker/src/retention-curves.ts` (just after `await worker.forChannel(channelId, async (tx) => {` at `:154`): the test must be red.

### 3. Comment hygiene — LOW (aggregated)
- `apps/site/privacy.html:187` — `<!-- Pending Nick's word-for-word approval on the epic's PR, creator-analytics#950. -->` → `<!-- Pending Nick's word-for-word approval on the epic's PR, creator-analytics#936. -->`. #950 is the ticket; the three markers the delta added name #936 as the epic. (found by: Claude)

## Needs Further Investigation

### A. A database error on one video's points repeats on every retry and every day, and loses that call's quota units — confirm whether Google ever answers a repeated or missing `elapsedVideoTimeRatio`
- **Found by:** Claude
- Carried from round 1's NFI A, reshaped by the fix. Now only the failing video's scope rolls back, with its `quota_usage` units and its cache row, so each attempt spends one real Analytics call that is not counted. The queue has no retry setting of its own (`packages/database/src/jobs.ts` sets none for `retentionCurveRefresh`), so pg-boss's default applies: 2 immediate retries, per the finder's reading of pg-boss 12.36.0 `plans.js:85-86`. A video that always fails to store is due first among its channel's never-read videos, so it blocks every video after it in due order, daily. What would confirm it: a real `audienceRetention` answer with a repeated or missing ratio. What would kill it: a documented guarantee of unique, present ratios.

### B. A very large channel's run against pg-boss's job expiry — confirm the expiry setting
- **Found by:** Claude
- Carried from round 1. A run now commits each read, so an expired run keeps what it read. What would confirm it: the default expiry against a measured production read latency.

## Reviewed and Dismissed
- Hand the module a scope opener bound to one channel instead of the whole `WorkerDatabase`. Dismissed: Approach decisions, "Remediation 1, Finding 1, where the scopes open", rejected exactly this, and the code it was recorded against is unchanged. (found by: Claude)
- The rewritten route test's `expect(retention.retention).toBe(true)` repeats the parse assertion near `apps/web/src/route.test.ts:706`. Dismissed: it is the precondition that makes the feedback test red at the base (the audit saw `expected undefined to be true` there). (found by: Claude)
- The storage item's word-for-word pin in `apps/site/test/site.test.ts:1812` is a copy test. Dismissed: kept by the tickets' acceptance criteria until Nick approves the words (Approach decisions). (found by: Claude)
- The new `affirms` facts at `apps/site/test/site.test.ts:1848, 1856, 1868` are copy presence checks. Dismissed as a defect: Approach decisions record them as the proof over the policy for round 1's Finding 2. That they do not bind the curves to the deleting verb is under Minor. (found by: Claude)
- The privacy policy overstates or understates the curves' lifecycle. Dismissed by reading the code: the purge deletes both tables (`history-purge.ts:52-53`), the deleted-video check deletes a deleted video's curve and read and keeps a private or unlisted one (`deleted-videos.ts`), an ended channel reads its curves until its purge date (`historyReadable`) and reads no new ones (the `tier !== 'paid'` gate), a renewed subscription clears the purge date, and every channel-owned table cascades on the channel delete. (found by: Claude)

## Minor / nits
- Each per-video scope now takes its own clock for `endDate`, the quota day and `fetchedAt`, while the due order and budget use the plan's. A run crossing a reporting-day boundary would mix days. The roster runs at 09:00 UTC, so a crossing is unlikely, and each read landing on its own quota day is arguably more correct. (found by: Claude)
- A channel deleted between a per-video scope's Google read and its insert now raises a foreign-key error, reported as "A retentionCurveRefresh job failed" and retried; the retry sees a free channel and stops. Before, the run's lock on the channel row made the delete wait. Report noise only. (found by: Claude)
- The ended-channel test (`apps/worker/test/retention-curves.test.ts:466`) asserts no Analytics request but not "not even uploads", as the free-channel test does. Both states take the one `tier !== 'paid'` gate, so the free test covers it. (found by: Claude)
- The new `affirms` facts for the curves pass for any affirmative mention, such as "audience retention curves are kept forever", and do not tie the curves to "deletes". Revisit with Nick's approval of the words. (found by: Claude)
- `apps/web/src/retention-plot.test.ts:228`: the rewritten contrast test's comparison half restates the pick-colour rule the test near `:172` already covers. It is round 1's recommended contrast and is red at the base, so it stays. (found by: Claude)
- `docs/reviews/creator-analytics-936/repro/quota-row-lock.test.ts:1-5`: the header reads "Red until the refresh commits per read", which is now history, and the test keeps its diagnostic `console.log` and unasserted `pg_stat_activity` read. It is a review proof, preserved as written. (found by: Gemini)
- The same repro commits fixed-id users, a paid channel and today's quota rows with no cleanup. It runs in its own throwaway container through its own config, so nothing else sees them; it would collide on a second run against a persistent `TEST_DATABASE_URL`. This is why Finding 1 does not move it into CI. (found by: Gemini)
- The round 1 LOW tail stays as deferred: Finding 4 (`heldPicksOf`), 5 (the ended channel's "yet"), 6 (the API test's human step), 7 (no test of a Google failure on the uploads read, which now sits in the plan scope's `{ refusal }` return) and 8 (comment hygiene). (found by: Claude)

## Test quality
Tests added or changed in the delta: 8 cases across 6 files (1 new worker test, 3 rewritten web tests, 2 changed backfill assertions, 2 changed site tests), and 1 web test deleted. All 8 are red at `$BASE` (`50d69539`): 1 by a missing helper, 4 by a missing module or function, 3 by their new assertion. Against `f5f2c5ce`, the worker test is red for its stated reason (`expected {} to deeply equal { newest, older }`) and both site tests are red against the old policy. The rewritten web tests are green there, which is right, since round 1 asked only that they go red at the base. Tautology shapes: none of the self-computed, mocked-unit, call-shaped, snapshot, no-assertion or prose kinds. Two weaknesses in the worker test, both proved by mutation: it cannot see nesting (Finding 1) and it accepts any throw (Finding 2). The site pin and its `affirms` facts are copy checks, kept by decision.

## Prior-review closure
- **Fully fixed: 3.** Finding 1 (the refresh's single transaction): the repro is green and the code meets the brief point by point; the guard that keeps it fixed is this round's Finding 1. Finding 2 (the privacy policy): every new sentence matches the code. Finding 3 (tests green at base): all three rewrites red at the base, the fourth test deleted, both formatter expectations replaced.
- **Partially fixed: 0.**
- **Untouched: 5, all LOW and deferred by decision** (the closure table reads "deferred, not worked: LOW tail"): Findings 4, 5, 6, 7 and 8. NFI A and B carry forward.
- None of the three fixes was "resolved" by editing only a comment or a doc.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and `pnpm test` are green at `28cb5b03`, and the browser walk passed. `repro/nested-plan-scope.patch` is not a file biome checks.
- **Commit hygiene:** commit this doc with `repro/nested-plan-scope.patch`.
- **Likely reviewer asks:** the drafted privacy wording, marked pending Nick's word-for-word approval; migration 0037's shape; the refresh's per-channel Analytics budget against the project quota (#950's open proposal); the retry setting of the `retentionCurveRefresh` queue (NFI A).

## Verdict
**Not ready, one small gate.** Finding 1 must be fixed before the PR opens: it is a test and a Limits sentence, with no production change. Findings 2 and 3 are one-line fixes for the same pass. The confirmed count fell from 8 (3 MEDIUM) to 3 (1 MEDIUM), and the content moved from a behaviour bug toward test strength and one marker. That is the expected shrink, not a branch failing to improve. Of round 1's 3 gated findings, all 3 are fully fixed, 0 partly, 0 only by a comment. The 5 deferred LOW findings are unchanged and remain Nick's to triage. The refresh has been rewritten once in response to review, so no split ticket is called for.

## Remediation — 2026-11-20
| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 1 (MEDIUM) | `798b359b` creator-analytics#936 pre-PR review 2 finding 1: nothing CI runs can tell the per-read commit from a run that reads inside the plan's transaction | red→green: in a scratch worktree at `ef071689` with the new test file and `repro/nested-plan-scope.patch` applied, `pnpm exec vitest run apps/worker/test/retention-curves.test.ts -t "one scope to plan"` red (`expected [ 1, 2, 2 ] to deeply equal [ 1, 1, 1 ]`); green on the branch | 1 (the Limits note's new sentences, a test-limit statement `tests-state-a-rule` requires) | proved by execution |
| 2 (LOW) | — deferred, not worked: LOW tail | — | — | — |
| 3 (LOW) | — deferred, not worked: LOW tail | — | — | — |

Preserve suites: `apps/worker/test/retention-curves.test.ts` (20 of 20) and `apps/worker/test/jobs.test.ts` green. Full checks at `798b359b`: `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` (218 files, 5434 passed, 1 expected fail) and the browser walk, all green. Phase 2 sent no verify agent: the one worked fix is MEDIUM, its proof was executed, and it touched no shared core.

### Known regressions, deferred
- none

### Rework briefs
- none
