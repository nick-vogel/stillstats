# Pre-PR review: creator-analytics#936 stored retention curves, compared on one chart (round 3)

**Branch:** `creator-analytics-936-retention-curves` vs `origin/main` (merge-base `50d695399dfd8c31e04e16050a574403b987f933`, "Merge pull request #922 from nick-vogel/release-2026.11.20-date")
**Reviewed at:** HEAD `21d5df57` (creator-analytics#936 pre-PR review 2 remediation closure table) + 0 files with uncommitted changes, 0 untracked files, 59 files total, +7437 / −103.
**Delta under review:** since `28cb5b03` (creator-analytics#936 pre-PR review 1 remediation closure table), the HEAD that `pre-pr-review-2.md` reviewed. The delta is the review 2 commit `ef071689`, its one remediation commit `798b359b` (creator-analytics#936 pre-PR review 2 finding 1: nothing CI runs can tell the per-read commit from a run that reads inside the plan's transaction) and the closure table `21d5df57`. Outside `docs/reviews/` that is 1 file, `apps/worker/test/retention-curves.test.ts`, +41 / −1. No production file changed.
**Reviewed against:** epic nick-vogel/creator-analytics#936 and its children #950, #951 and #952; `pre-pr-review-2.md` (its Finding 1 brief, Approach decisions and remediation closure table); the repo's `.claude/rules/` and the global `~/.claude/rules/`. There are no plan or spec docs under `docs/`.
**Date:** 2026-11-20
**Reviewer:** 1 code-review agent (the whole delta), 1 tautology-audit agent, Gemini, and a verify pass.
**Gemini:** gemini-4-carbon, 15157 in / 5946 out+thinking tokens, est. $0.0898. Found 0: confirmed 0 (unique 0), rejected 0, NFI 0, nits 0

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | green, already up to date |
| Lint | `pnpm lint` (biome check .) | green, 840 files |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` | green |
| Unit and integration suites | `pnpm test` (Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | green: 218 files, 5434 passed, 1 expected fail |
| Browser walk | `pnpm run --if-present test:browser` | "The browser walk passed." The 401s it logs come from the signed-out states it walks. |
| Prior Finding 1's proof | scratch worktree at HEAD, `git apply docs/reviews/creator-analytics-936/repro/nested-plan-scope.patch`, `pnpm exec vitest run apps/worker/test/retention-curves.test.ts -t "one scope to plan"` | red, `expected [ 1, 2, 2 ] to deeply equal [ 1, 1, 1 ]` at `:701`; green on the branch (run by both the finder and the audit agent) |
| Tautology audit, oracle at `$BASE` | scratch worktree at `50d69539` with HEAD's test file copied in, same command | red: `TypeError: subscribe is not a function` at `:679` (missing helper; the refresh does not exist at the base) |
| Tautology audit, stability at HEAD | the one test twice, then the whole file | green twice; 20 of 20 |
| Mutant b: every read inside the plan scope's own `tx` (round 1's one-transaction shape) | executed by the audit agent | red, `expected [ 1 ]` |
| Mutant c: per-video scopes run with `Promise.all` | executed by the audit agent | red, `expected [ 1, 1, 2 ]` |
| Mutant d: the plan scope also reads and stores the first due video | executed by the audit agent | red, `expected [ 1, 1 ]` |
| Mutant: a second real Analytics read inside each per-video scope | executed by the finder | the new test stays green; 9 other tests in the file go red, because they count Analytics requests per video (see Dismissed) |
| Does an uncounted `asSystem` hide a held quota row? | read `packages/youtube-gateway/src/youtube-gateway.ts:325` | no: `spend` and `quotaAllows` take `Scoped<'user' \| 'channel'>`, so a system scope cannot record quota without a cast |
| Production scopes are separate transactions | read `apps/worker/src/jobs.ts:128-145`, `packages/database/src/scopes.ts` (`enter`) | each `forChannel` opens its own pooled transaction |
| Limits note against the repro | read `docs/reviews/creator-analytics-936/repro/quota-row-lock.test.ts:1-30` | the repro probes the Analytics quota row only (Finding 1) |
| Gemini finder | `~/.claude/bin/gemini-review 28cb5b03` | ran, `NO FINDINGS` |
| Real Google behaviour and production hold times | | not runnable here: needs Nick's walk of a paid channel on production |

**Overall:** The round 2 remediation holds. The new scope count test is red at the base, green on the branch, and red on all four mutants that move a read into a held transaction or run two reads at once, so round 1's blocking defect can no longer come back with the suite green. All full checks are green. The only confirmed finding is two wording fixes in the file's Limits note. The branch is ready to open a PR.

## Approach decisions
- **Round 1, Finding 1, the curve refresh's transaction:** commit each video's read in its own channel scope, after one plan scope, as `activeUserCount` in `apps/worker/src/jobs.ts` runs two scopes in sequence. Rejected: committing quota outside the caller's transaction in the gateway's `spend`. Unchanged.
- **Round 1, Finding 2, the privacy policy:** describe the curves on the reach history's windows, item by item. Unchanged.
- **Copy pins against `tests-state-a-rule`:** kept, by the tickets' acceptance criteria (#950, #952) and the #952 assumption, until Nick approves the words on the epic's PR. Not reopened here.
- **Remediation 1, Finding 1, where the scopes open:** the job handler hands `refreshRetentionCurves` the `WorkerDatabase`, and the module opens the plan scope and one scope per due video. Unchanged.
- **Remediation 1, Finding 1, the fix's own failure path:** a database error in one video's scope is proved with a curve that repeats a point. Unchanged.
- **Remediation 1, Finding 2, proof over the policy:** the `affirms` facts name the curves in the paid-retention, deleted-video and disconnect items. Unchanged.
- **Remediation 1, Finding 3, the self-computed backfill note:** asserted with `toContain('12 videos to go.')`. Unchanged.
- **Round 2, Finding 1, how the suite holds the per-read commit:** a test hands the handler a `WorkerDatabase` that counts open `forChannel` scopes and asserts one to plan and one per read, never one inside another, wrapping `forChannel` the way the harness's `worker` fixture does (`packages/database/test/harness.ts:193-199`). Rejected: moving the real-connection repro into CI. Unchanged; this round confirms it by four mutants.
- **Round 2, Finding 1, one Google call per scope:** held by the existing read-count tests in `apps/worker/test/retention-curves.test.ts`, not by the scope count test. Added this round, so a later round does not ask the scope counter to count Google calls too.

## Confirmed Issues

### 1. Comment hygiene — LOW (aggregated)
- `apps/worker/test/retention-curves.test.ts:7` — "The scope count test holds the shape that releases them" → "The test 'a run opens one scope to plan and one per read, never one inside another' holds the shape that releases them". No test is titled "scope count", and the roster test at `:150` also names scopes ("each in its own scope"), so the pointer can be read as either. (found by: Claude)
- `apps/worker/test/retention-curves.test.ts:7-9` — "the repro in `docs/reviews/creator-analytics-936/repro/quota-row-lock.test.ts` shows the release on separate connections" → "the repro in `docs/reviews/creator-analytics-936/repro/quota-row-lock.test.ts` shows the Analytics quota row released between reads on separate connections; it does not probe the Data API row the plan's uploads read takes". The repro's only probe is another user's Analytics read (`quota-row-lock.test.ts:1-5`), so the plural "quota rows" overstates what it shows. The CI guard on the nesting shape is the scope count test, which the same note names. (found by: Claude)

Run `pnpm format` and `pnpm lint` after the edit. Proof: none needed beyond a green `pnpm exec vitest run apps/worker/test/retention-curves.test.ts`.

## Needs Further Investigation

### A. A database error on one video's points repeats on every retry and every day, and loses that call's quota units — confirm whether Google ever answers a repeated or missing `elapsedVideoTimeRatio`
- **Found by:** Claude
- Carried unchanged from round 2's NFI A; the delta does not touch the refresh. What would confirm it: a real `audienceRetention` answer with a repeated or missing ratio. What would kill it: a documented guarantee of unique, present ratios.

### B. A very large channel's run against pg-boss's job expiry — confirm the expiry setting
- **Found by:** Claude
- Carried unchanged from round 2. What would confirm it: the default expiry against a measured production read latency.

## Reviewed and Dismissed
- The scope counter cannot see two Google calls inside one per-video scope, so a run that holds the Analytics row across two calls passes the new test. Dismissed as a gap: the finder's executed mutant (a second real Analytics read per scope) turned 9 other tests in the same file red, because they count Analytics requests per video. One call per scope is held by those tests (Approach decisions). (found by: Claude)
- Not counting `asSystem` could hide a read moved to a system scope. Dismissed: the gateway's `spend` and `quotaAllows` accept only a user or channel scope (`packages/youtube-gateway/src/youtube-gateway.ts:325`), and a read moved out of `forChannel` changes the count array anyway (mutant b shows `[ 1 ]`). (found by: Claude)
- Counting scopes asserts the order of database calls, which `tests-state-a-rule` deletes. Dismissed: the rule asserted is that each Google call's quota upsert commits in its own transaction, which is why a scope, the unit of transaction, is what the test counts; it is round 2's recorded approach (Approach decisions), and four mutants that break that rule turn it red. (found by: Claude)
- The Limits note's repro path goes stale if `docs/reviews/` is pruned. Dismissed: the repo already points code at review repros (`apps/web/src/placeholder.test.ts:716`, `apps/web/test/web.test.ts:19`, `apps/web/src/app.css:2205`, all at `docs/reviews/creator-analytics-268/repro/`). (found by: Claude)

## Minor / nits
- The test name states the mechanism ("one scope to plan and one per read, never one inside another") rather than the reason ("the run holds the shared quota row for one read at a time"), and its assertion is also stronger than "never one inside another", since it refuses two sibling scopes open at once (`[ 1, 1, 2 ]`). A rename could say both. (found by: Claude)
- `[ 1, 1, 1 ]` is an exact count, so a harmless refactor such as giving the entitlement check its own scope turns it red. Asserting every entry is 1 and the count is at least one plus the due videos would hold the same rule with less coupling. The exact count is what round 2's brief recommended, so this is a choice, not a defect. (found by: Claude)
- "a scope opened inside another becomes a savepoint" (`:5-6`) is true but partial: in the harness every scope is a savepoint on the test's one connection (`packages/database/test/harness.ts:62-66`), and that is why nesting is invisible there. (found by: Claude)
- The repro's own header (`docs/reviews/creator-analytics-936/repro/quota-row-lock.test.ts:1-5`) still reads "Red until the refresh commits per read", which is now history. Carried from round 2's Minor; it is a review proof, preserved as written. (found by: Claude)
- Round 2's Findings 2 (the database error test's `rejects.toThrow()`, `apps/worker/test/retention-curves.test.ts:660`) and 3 (the `creator-analytics#950` marker, `apps/site/privacy.html:187`) are unchanged, deferred by decision as the LOW tail, as is round 1's LOW tail (Findings 4 to 8). (found by: Claude)

## Test quality
Tests added in the delta: 1 (`apps/worker/test/retention-curves.test.ts:669`). Green against `$BASE`: 0; it is red there by a missing helper, since the refresh does not exist at the base. Against `28cb5b03` it would be green, which is right: it guards code that was already correct. Red on all four mutants (the nested patch, one transaction for the run, parallel reads, the plan doing the first read), each with a distinct array. Tautology shapes: none. Its expected values are literals, the unit under test is the real handler against the fake Google boundary, the wrapper only counts and passes through, and the second assertion reads stored rows. The file states its limits, now including the harness's lock and savepoint blindness.

## Prior-review closure
- **Fully fixed: 1.** Finding 1 (MEDIUM, nothing CI runs could tell the per-read commit from a read inside the plan's transaction): the test and the Limits sentences landed as recommended in `798b359b`, red under `repro/nested-plan-scope.patch` and green on the branch, verified against the intent by three further mutants. The two wording slips in the added Limits sentences are this round's Finding 1.
- **Partially fixed: 0.**
- **Untouched: 2, both LOW and deferred by decision** (the closure table reads "deferred, not worked: LOW tail"): Findings 2 and 3. NFI A and B carry forward.
- None of the fixes was "resolved" by editing only a comment or a doc.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and `pnpm test` are green at `21d5df57`, and the browser walk passed.
- **Commit hygiene:** commit this doc. Nothing else is in the tree.
- **Likely reviewer asks:** the drafted privacy wording, marked pending Nick's word-for-word approval; migration 0037's shape and its number against #934 and #938; the refresh's per-channel Analytics budget against the project quota (#950's open proposal); the retry setting of the `retentionCurveRefresh` queue (NFI A).

## Verdict
**Ready to open the PR.** No finding gates it. Finding 1 is two wording fixes in a test file's Limits note and can ride with the PR or a follow-up. The confirmed count fell from 3 (1 MEDIUM) to 1 (LOW, aggregated comment hygiene), and its content is now wording only: the expected shrink, and the review reports it as that rather than backfilling. Of round 2's 1 gated finding, 1 is fully fixed, 0 partly, 0 only by a comment. The deferred LOW tail from rounds 1 and 2 (7 findings) is unchanged and remains Nick's to triage. The refresh has been rewritten once in response to review, and this round touched only its test, so no split ticket is called for.
