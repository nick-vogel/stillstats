# Pre-PR review: creator-analytics#567 Versioned releases, release notes and a staging environment

**Branch:** `creator-analytics-567-releases-staging` vs `origin/main` (merge-base `bbba1fb` "Merge pull request #566 from nick-vogel/creator-analytics-337-retention-numbers-table"; `origin/main` is now `149417c` "Merge pull request #591 from nick-vogel/creator-analytics-588-tip-revenue-openpanel", three commits past the merge-base)
**Reviewed at:** HEAD `8839f22` ("creator-analytics#567 pre-PR review 1 remediation closure table"). The tree was clean, with no uncommitted or untracked files at review time. Full branch: 134 files, +8,133 / −289, 27 commits.
**Delta under review:** since `023050a` ("creator-analytics#579 Rollback to a named version"), the HEAD that `pre-pr-review-1.md` reviewed: 5 files, +454 / −15, of which 4 are code (`apps/site/test/screenshot/browser-walk.ts`, `apps/site/test/screenshot/stub-api.ts`, `packages/reporter/src/index.test.ts`, `packages/reporter/src/index.ts`) and 1 is review 1's doc. Commits `9b1e833` (review 1), `b5f75f9` (finding 1), `8609e38` (finding 2), `8839f22` (closure table). Plus the branch's mergeability against the current `origin/main`.
**Reviewed against:** `pre-pr-review-1.md` (findings 1 and 2, their Approach decisions and the remediation closure table), the epic body of creator-analytics#567 (Testing Decisions), `CODING_STANDARDS.md`, and `packages/database/test/migrations.test.ts` (creator-analytics#238, the repo's rule for two branches numbering one migration).
**Date:** 2026-11-10
**Reviewer:** 1 code-review agent + verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | up to date |
| Lint | `pnpm lint` | pass, 641 files |
| Typecheck | `pnpm typecheck` | pass |
| Build | `pnpm build` | pass |
| Full suite, local | `pnpm test` (Docker up, `TEST_DATABASE_ADMIN_URL` unset) | 156 files, 3,910 passed, 1 expected fail |
| Full suite under GitHub Actions' variables | `CI=true GITHUB_ACTIONS=true GITHUB_SHA=8839f22abc GITHUB_EVENT_NAME=pull_request pnpm test` | 156 files, 3,910 passed, 1 expected fail. Prior finding 1 closed. |
| Browser walk | `pnpm run --if-present test:browser` | pass, "No content security policy violation in 59 steps"; the site is built with the fixture notes (`dist/releases/2026.11.2.html`, `2026.11.9.html`, `2026.11.9.1.html`, `index.html`). Prior finding 2 closed. |
| Reporter rule can go red | scratch worktree at `8839f22`, `initErrorTracking` mutated to `release: release ?? "reporter-default"`, `GITHUB_SHA=abc123 pnpm exec vitest run packages/reporter/src/index.test.ts` | red: `expected 'reporter-default' to be undefined`. The rewritten test holds the reporter's rule. |
| SDK release sources | finder read `@sentry/node` 11.4.0 `sdk/api.js` `getSentryRelease` and `sdk/index.js:156-164` `getRelease` | `SENTRY_RELEASE`, `GLOBAL_OBJ.SENTRY_RELEASE.id`, `GITHUB_SHA`, then about 40 other CI and host variables; of these GitHub Actions sets `GITHUB_SHA` only |
| Stub page mapping against the API's | finder ran the real `startStubApi` over a path matrix; the API side read from `apps/api/src/app.ts:324-333` and `@hono/node-server` 2.1.3 `serve-static.mjs` | same answer for every row: 200 at `/`, `/releases`, `/releases/`, `/releases/index`, `/releases/2026.11.9`, `/privacy`, `/app/whats-new`; 404 at `/index`, `/404`, `*.html`, `/releases/2026.11.9/`, `/releases/2099.1.1`, `/api/nope`, encoded `..` |
| Mergeability with `origin/main` | `git merge-tree --write-tree --name-only origin/main HEAD` | **exit 1**: conflicts in `README.md`, `packages/database/drizzle/meta/0021_snapshot.json`, `packages/database/drizzle/meta/_journal.json`. Finding 1. |
| The resolution in finding 1's brief | scratch worktree at `8839f22`: merge `origin/main`, take main's journal and `0021_snapshot.json`, remove the branch's `0021_preferences_whats_new_marker.sql`, `pnpm --filter @creator-analytics/database generate --name preferences_whats_new_marker`, `pnpm exec vitest run packages/database/test/migrations.test.ts` | generate writes `0022_preferences_whats_new_marker.sql`, byte-identical to the branch's 0021 SQL; migrations test 4 passed |
| The naive resolution | same scratch worktree, both `0021_*.sql` kept with the branch's journal and snapshot | migrations test red: "holds one SQL file for each journal entry and no other" and "leaves no change in the schema for drizzle-kit generate to write" |
| Tests green at the prior HEAD | not run as an oracle: the only modified test is the one prior finding 1 rewrote, and `index.ts` changed only in a comment, so it is green at `023050a` by construction. The mutation row above is the evidence it can go red. | see Test quality |
| Not run | the workflows on GitHub; the staging stack; whether main's `0021_tips_user_id_optional` has already been applied on staging (`gh run list --workflow ci.yml --branch main` and the `migrate-staging` job of #591's merge run would tell) | the brief treats main's 0021 as applied either way |

**Overall:** Both MEDIUM findings from review 1 are fixed against their intent: the reporter test passes under GitHub Actions' variables and still goes red when the reporter adds a release of its own, and the browser walk now builds the site, loads `/releases/` and `/releases/2026.11.9` through a stub that maps pages as the API does, and holds each page's `h1`. The remediation introduced no defect. One new MEDIUM gates the PR: `origin/main` gained its own migration `0021` (creator-analytics#588) after the merge-base, so the branch no longer merges, and the obvious conflict resolution leaves a migrations folder drizzle cannot run. The fix is a merge of `origin/main` with the branch's migration regenerated as `0022`, proved in a scratch worktree.

## Approach decisions
- Carried forward from review 1: reporter release in tests (`vi.stubEnv` in the test, `vi.unstubAllEnvs()` in the file's `afterEach`, production keeps the SDK's detection); the release page in the browser walk (site built with the web app's `buildEnvironment()`, `serveSite` mapping the API's pages, `visitPage` readiness, a page heading by role and name held to be the `H1`); repro files in `docs/reviews/**` must pass `pnpm lint`. This review commits no repro file; each proof is a command.
- A migration number taken on both sides of a merge (finding 1): main's migration keeps its number and file untouched, and the branch's migration is regenerated by drizzle-kit at the next number, never renamed by hand and never merged as two entries with one number. Precedent: `packages/database/test/migrations.test.ts` and its commit `3c9112e` ("creator-analytics#238 Fail the suite on a migrations folder that drizzle cannot run, as two branches numbering the same migration leave it"), written after #356, #357 and #338 each took 0016 or 0017.

## Prior-review closure
Review 1 (`pre-pr-review-1.md`, at `023050a`) confirmed 16 findings: 2 MEDIUM and 14 LOW.
- **Fully fixed: 2.** Finding 1 (`b5f75f9`): the test clears `GITHUB_SHA` and `SENTRY_RELEASE` with `vi.stubEnv`, restores them in `afterEach`, is renamed to the reporter's rule with a Limits comment, and `index.ts:29-32` states the SDK's fallback; verified by the full suite under GitHub Actions' variables and by the mutation above. Finding 2 (`8609e38`): verified by the walk's 59 steps, the finder's path matrix, and review 1's own closure (an inline script in `apps/site/templates/release.html` failed the walk with 2 violations). Finding 16's `packages/reporter/src/index.ts:29` entry is closed with finding 1.
- **Partially fixed: 0.**
- **Untouched: 14,** findings 3 to 16, all LOW, deferred by the remediation's scope note ("The LOW findings 3 to 16 are deferred to Nick, unworked"). None is MEDIUM or higher, and none is re-reported here; they stand as written in review 1.

## Confirmed Issues

### 1. The branch no longer merges into main, and the obvious resolution leaves two migrations numbered 0021 — MEDIUM (merge gate)
- **Location:** `packages/database/drizzle/0021_preferences_whats_new_marker.sql`, `packages/database/drizzle/meta/0021_snapshot.json`, `packages/database/drizzle/meta/_journal.json:152-158` (the `idx: 21` entry), `README.md:132` (the OpenPanel paragraph)
- **Attribution:** introduced by `8f52c0a` ("creator-analytics#580 The \"What's new\" banner and its marker"), the only commit that adds the branch's 0021 (`git log --oneline --diff-filter=A bbba1fb..HEAD -- packages/database/drizzle/0021_preferences_whats_new_marker.sql`), and exposed by `origin/main` moving: `1883737` ("creator-analytics#588 Support: a tip reaches OpenPanel as revenue, with or without an owner") added main's `meta/0021_snapshot.json`, `ac9ce5f` named it `0021_tips_user_id_optional`, and `149417c` merged it after this branch's merge-base `bbba1fb`. Not in the delta since `023050a`: main moved after review 1 ran. The README conflict is the same move: main renamed the API's own event `support_tip_completed` to `revenue` in the paragraph the branch rewrote for `GET /api/client-settings`.
- **Real-world trigger:** opening the PR. GitHub reports the branch as conflicting and runs no `pull_request` CI on a merge ref it cannot build. The trap is the resolution: keeping both `0021_*.sql` files, or either side's journal and snapshot alone, is a tree git accepts and drizzle does not. With the branch's snapshot kept, the next `drizzle-kit generate` re-emits main's `tips.user_id` change; with main's kept, it re-emits `whats_new_marker`, which then fails on a database that has it. No user path until a resolution ships, so MEDIUM as a merge gate, like review 1's finding 1. Upgrade to HIGH if a resolution with two 0021 entries reaches main, since `migrate-staging` then runs against a journal drizzle's migrator reads in order and skips any entry older than the last applied.

**Evidence**
```
$ git merge-tree --write-tree --name-only origin/main HEAD    # exit 1
CONFLICT (content): Merge conflict in README.md
CONFLICT (add/add): Merge conflict in packages/database/drizzle/meta/0021_snapshot.json
CONFLICT (content): Merge conflict in packages/database/drizzle/meta/_journal.json
```
Branch journal: `"idx": 21, "when": 1794331010222, "tag": "0021_preferences_whats_new_marker"`. Main's journal: `"idx": 21, "when": 1794320603112, "tag": "0021_tips_user_id_optional"`.

**Failure mode** — in a scratch worktree at `8839f22` merged with `origin/main`, keeping both `0021_*.sql` files with the branch's journal and snapshot, `pnpm exec vitest run packages/database/test/migrations.test.ts` fails 2 of 4: "holds one SQL file for each journal entry and no other" and "leaves no change in the schema for drizzle-kit generate to write". With the resolution below, the same test passes 4 of 4, and generate writes `0022_preferences_whats_new_marker.sql` byte-identical to the branch's 0021 SQL.

**Recommended fix** — in the integration worktree, one merge commit:
```sh
git fetch origin
git merge --no-edit origin/main            # stops on the three conflicts
git checkout origin/main -- packages/database/drizzle/meta/_journal.json packages/database/drizzle/meta/0021_snapshot.json
git rm packages/database/drizzle/0021_preferences_whats_new_marker.sql
pnpm --filter @creator-analytics/database generate --name preferences_whats_new_marker
diff <(git show 8839f22:packages/database/drizzle/0021_preferences_whats_new_marker.sql) packages/database/drizzle/0022_preferences_whats_new_marker.sql
```
For `README.md`, keep the branch's side of the conflicted paragraph (it adds the `OPENPANEL_CLIENT_ID` sentence and says "which only the API holds") and change its `support_tip_completed` to `revenue`, main's rename; nothing else in the paragraph differs. Then `git add README.md packages/database/drizzle` and `git commit --no-edit`.

**Remediation brief**
- **Design intent:** drizzle's migrator applies `drizzle/` in journal order and records each by its `when`; drizzle-kit chains each `NNNN_snapshot.json` on the one before by `prevId` and diffs the schema against the last. So a migration number is a slot in one chain, and two branches that both took 0021 need one of them regenerated at 0022 against the other's snapshot. Main's 0021 has merged and deployed staging (or will on its next run), so it is the fixed one; the branch's migration has run nowhere outside tests, because staging deploys from `main` only and production from release tags only (`docs/deploy.md`).
- **Full surface:** `packages/database/drizzle/0021_preferences_whats_new_marker.sql` (removed), `packages/database/drizzle/0022_preferences_whats_new_marker.sql` and `packages/database/drizzle/meta/0022_snapshot.json` (generated), `packages/database/drizzle/meta/_journal.json` and `meta/0021_snapshot.json` (main's), `README.md:129-135` (the conflicted paragraph). `git grep -n "0021_preferences_whats_new_marker" -- ':!docs/reviews'` finds no code, test or doc that names the file; review docs stay as written.
- **Must preserve:** main's `0021_tips_user_id_optional.sql` and its snapshot byte for byte; the branch migration's two statements unchanged (the `diff` above prints nothing); `packages/database/test/migrations.test.ts` (all 4); the preferences suites that read the column, `apps/api/src/preferences.test.ts` and `apps/api/src/delete-user.test.ts`; main's #588 suites, `apps/api/src/stripe-events.test.ts`; then every full check from the repo entry (`pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm run --if-present test:browser`).
- **Do not touch:** `packages/database/src/schema.ts` and `packages/database/src/preferences.ts`; the generate reads them as they are. Do not hand-edit `_journal.json` or rename the SQL file, and do not rebase the branch.
- **When the fix itself fails:** if generate prompts (a rename question), or writes anything besides the `whats_new_marker` column and its check, or touches `tips`, stop: main's snapshot is not the one taken, or the schema differs from both sides. Do not commit a partial merge; `git merge --abort` returns the tree to `8839f22`.
- **Proof:** `git merge-tree --write-tree --name-only origin/main HEAD` exits 1 now and exits 0 after (and `git merge-base --is-ancestor origin/main HEAD` exits 0); `pnpm exec vitest run packages/database/test/migrations.test.ts` 4 passed after; the `diff` above prints nothing.

## Needs Further Investigation
None new. Review 1's A (a pending release cancelled by a third run in the `production` group), B (a promoted pre-release never deploys) and C (release pages under `vite dev`) stand as written there.

## Reviewed and Dismissed
- The index step checks the release link's name and not its `href` (`browser-walk.ts:508-511`) — `apps/site/test/site.test.ts:1310` "the index links every release page, newest first" pins every `href` in the index's `main` to its release's clean path; the walk's job is the in-browser policy, and the next step loads the page at its clean path.
- `serveSite` diverging from the API's mapping — the finder's path matrix gives the API's answer for every row; the only differences are a JSON 404 body instead of `404.html` and `application/octet-stream` for image types the site build holds none of at a page path.
- The new GET branch in the stub's router shadowing a route — it sits after every specific route and admits only GET outside `/api/`.
- `take-screenshot.ts` breaking with no site build — it navigates only under `/app`; any other path now reaches `serveSite`, which falls through to `missing()` with no `dist`, as before.
- `walk-report.ts` treating `route:` steps specially — it does not parse step names; violations are keyed on step membership.
- `pageReadyCheck` passing on a redirect or the wrong document — the stub never redirects, and a 404 is a JSON page with no `h1`, so the heading step fails and `unanswered` fails the run.
- The walk building `apps/site/dist` with fixture notes — the web app's `dist` was already built that way by the walk; the API image builds both inside its own `frontends` stage (`apps/api/Dockerfile:47`).

## Minor / nits
- `packages/reporter/src/index.test.ts:79-84` clears only `GITHUB_SHA` and `SENTRY_RELEASE`; on a machine with another of the SDK's variables set (the finder ran `GIT_COMMIT=cafef00d`) it fails with the reporter correct. Its Limits comment says so, and neither GitHub Actions nor this Mac sets one. If it ever bites: assert `toBe(getSentryRelease())` (exported from `@sentry/node`), keeping the two stubs so the usual case still asserts `undefined`.
- The walk never confirms the site page asked for `GET /api/client-settings` during its step; the stub answers it and `unanswered` catches a failed request, so only a regression where the site stops asking slips by.
- Review 1's Minor on `/releases`, `/releases/` and `/releases/index` all answering the index holds for the stub too, by design: it mirrors the API.

## Test quality
Tests added or changed since `023050a`: 1 (`packages/reporter/src/index.test.ts` "with no release given, the reporter adds none of its own", prior finding 1's red to green proof) · green against the prior HEAD: by construction, since production code changed only in a comment; review 1 lists it as the negative control of `:64` at `$BASE` · tautology shapes found: 0. A mutation that makes the reporter add a release of its own turns it red. The browser walk is a harness, not a vitest test; its two site steps went red under review 1's planted inline script.

## Before opening the PR
- **CI readiness:** lint, typecheck, build, the suite (local and under GitHub Actions' variables) and the browser walk pass at `8839f22`. After finding 1's merge, run them all again: the merge brings main's #588 code (`apps/api/src/event-relay.ts`, `apps/api/src/routes/stripe-events.ts`, `apps/api/src/tips.ts`, `packages/database/src/tips.ts`) under this branch's tests for the first time.
- **Commit hygiene:** the tree is clean; this doc is the only addition from this review.
- **Likely reviewer asks:** as in review 1 (copy approvals for #575, #577 and #580; production's `STILLSTATS_ENVIRONMENT`; the first note and #581's walk after the merge; #593 open), plus: the preferences migration is now `0022`, still expand-only.

## Verdict
Not ready to open as-is, on one gate: finding 1, the merge with `origin/main` and the branch's migration regenerated as `0022`. Review 1's two MEDIUMs are fully fixed and the remediation introduced nothing; the confirmed count fell from 16 to 1, and that one comes from main moving, not from the branch's code. Review 1's LOW findings 3 to 16 remain deferred to Nick and can ride a later pass or become follow-up tickets.

## Remediation: 2026-11-10
| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 1 (MEDIUM) | `60e5455` creator-analytics#567 pre-PR review 2 finding 1: merge origin/main, the branch's preferences migration regenerated as 0022 after main's 0021 | red→green: `git merge-tree --write-tree --name-only origin/main HEAD` exit 1 at `72670fb`, exit 0 at `60e5455`; `git merge-base --is-ancestor origin/main HEAD` exit 0; `diff <(git show 72670fb:packages/database/drizzle/0021_preferences_whats_new_marker.sql) packages/database/drizzle/0022_preferences_whats_new_marker.sql` prints nothing; `pnpm exec vitest run packages/database/test/migrations.test.ts` 4 passed | 0 | proved by execution (MEDIUM, proof executed, preserve suites green; no verify agent) |

Resolution as the brief wrote it, at `origin/main` = `149417c`: main's `_journal.json` and `meta/0021_snapshot.json` taken, the branch's `0021_preferences_whats_new_marker.sql` removed, `pnpm --filter @creator-analytics/database generate --name preferences_whats_new_marker` run with no prompt. It wrote `0022_preferences_whats_new_marker.sql` and `meta/0022_snapshot.json`, and one journal entry, `idx: 22`. `meta/0022_snapshot.json` chains on main's 0021 (`prevId` `a5a95137-…`) and differs from it only by the `whats_new_marker` column and its check; `tips` is untouched. Main's `0021_tips_user_id_optional.sql` and `meta/0021_snapshot.json` are byte-identical to `origin/main`. README: the branch's side of the OpenPanel paragraph kept, with `support_tip_completed` changed to `revenue`; `git grep support_tip_completed -- ':!docs/reviews'` finds nothing.

Must preserve, after the merge at `60e5455`: `pnpm install --frozen-lockfile` up to date; `pnpm lint` pass, 641 files; `pnpm typecheck` pass; `pnpm build` pass; `pnpm test` 156 files, 3,909 passed, 1 expected fail; the same under `CI=true GITHUB_ACTIONS=true GITHUB_SHA=60e5455abc GITHUB_EVENT_NAME=pull_request`, 156 files, 3,909 passed, 1 expected fail; `pnpm run --if-present test:browser` pass, "No content security policy violation in 59 steps". The suite holds one test fewer than at `72670fb` (3,910 against 3,911): a per-test JSON diff of the two runs puts the whole change in `apps/api/src/stripe-events.test.ts`, where main's #588 replaced the three `support_tip_completed` and no-user tests with two `revenue` tests, so the merge carries main's suite as main has it. `apps/api/src/preferences.test.ts`, `apps/api/src/delete-user.test.ts` and `apps/api/src/stripe-events.test.ts` pass within the full run.

### Known regressions, deferred
None.

### Rework briefs
None. Phase 2 dispatched no verify agent, so no rework pass ran.

### Approach decisions (this round)
- A migration number taken on both sides of a merge: resolved as this doc's Approach decisions section records, main's migration fixed and the branch's regenerated by drizzle-kit at the next number, in one merge commit whose subject names the finding. Precedent: `packages/database/test/migrations.test.ts` and `3c9112e` (creator-analytics#238).
