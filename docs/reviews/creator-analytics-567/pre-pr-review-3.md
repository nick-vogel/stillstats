# Pre-PR review: creator-analytics#567 Versioned releases, release notes and a staging environment

**Branch:** `creator-analytics-567-releases-staging` vs `origin/main` (merge-base `149417c` "Merge pull request #591 from nick-vogel/creator-analytics-588-tip-revenue-openpanel", which is `origin/main` itself: the branch now contains main)
**Reviewed at:** HEAD `8c763a6` ("creator-analytics#567 pre-PR review 2 remediation closure table"). The tree was clean, with no uncommitted or untracked files at review time. Full branch against `149417c`: 135 files, +8,255 / −289, 30 commits.
**Delta under review:** since `8839f22` ("creator-analytics#567 pre-PR review 1 remediation closure table"), the HEAD that `pre-pr-review-2.md` reviewed: 13 files, +1,964 / −54. Commits `72670fb` (review 2), `60e5455` (review 2 finding 1, the merge of `origin/main`), `8c763a6` (closure table). Of the 13, 8 are main's #588 files brought in by the merge and byte-identical to `149417c` (`apps/api/src/event-relay.ts`, `apps/api/src/routes/stripe-events.ts`, `apps/api/src/stripe-events.test.ts`, `apps/api/src/tips.ts`, `packages/database/src/tips.ts`, `docs/adr/0015-stripe-hosted-pages-for-tips.md`, `packages/database/drizzle/0021_tips_user_id_optional.sql`, `packages/database/drizzle/meta/0021_snapshot.json`); the branch's own change is the merge resolution (`README.md`, `packages/database/drizzle/0022_preferences_whats_new_marker.sql`, `meta/0022_snapshot.json`, `meta/_journal.json`) and review 2's doc. The review also covered semantic conflicts between the branch and #588 that git could not see.
**Reviewed against:** `pre-pr-review-2.md` (finding 1, its Approach decisions and remediation closure table), `pre-pr-review-1.md` (LOW findings 3 to 16, deferred), the epic body of creator-analytics#567, `CODING_STANDARDS.md`, `packages/database/test/migrations.test.ts` (creator-analytics#238), `docs/release-notes.md`, `docs/deploy.md`.
**Date:** 2026-11-10
**Reviewer:** 1 code-review agent + verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | up to date |
| Lint | `pnpm lint` | pass, 641 files |
| Typecheck | `pnpm typecheck` | pass |
| Build | `pnpm build` | pass |
| Full suite, local | `pnpm test` (Docker up, `TEST_DATABASE_ADMIN_URL` unset) | 156 files, 3,909 passed, 1 expected fail |
| Full suite under GitHub Actions' variables | `CI=true GITHUB_ACTIONS=true GITHUB_SHA=8c763a6abc GITHUB_EVENT_NAME=pull_request pnpm test` | 156 files, 3,909 passed, 1 expected fail |
| Browser walk | `pnpm run --if-present test:browser` | pass, "No content security policy violation in 59 steps" |
| Mergeability with `origin/main` | `git fetch origin --prune`; `git merge-base --is-ancestor origin/main HEAD`; `git merge-tree --write-tree --name-only origin/main HEAD` | `origin/main` still `149417c`; ancestor of HEAD; merge-tree exit 0. Prior finding 1 closed. |
| Main's files carried untouched | `git diff --quiet 149417c HEAD -- <file>` for each of the 8 #588 files | all identical to `origin/main` |
| Branch migration unchanged by renumbering | `diff <(git show 8839f22:packages/database/drizzle/0021_preferences_whats_new_marker.sql) packages/database/drizzle/0022_preferences_whats_new_marker.sql` | identical |
| Snapshot chain | `jq -r .id meta/0021_snapshot.json`, `jq -r .prevId meta/0022_snapshot.json`, and a `diff` of both with `id`/`prevId` deleted | `prevId` of 0022 is 0021's `id` (`a5a95137-…`); the only difference is the `whats_new_marker` column and its check |
| Journal order | `jq '.entries[-3:]' meta/_journal.json` | idx 20, 21, 22 with `when` increasing (0021 `1794320603112`, 0022 `1794337330822`), so a database that applied main's 0021 (staging, after #591's merge) applies 0022 next |
| Patch of every other branch file unchanged by the merge | per-file `git diff bbba1fb 8839f22 -- <f>` against `git diff 149417c 8c763a6 -- <f>` | identical except `README.md`, the renumbered migration files and the journal |
| README resolution | patch comparison above, plus the finder's word diff against main's line | the Stripe paragraph is main's line byte for byte; the OpenPanel paragraph is main's with the branch's two intended edits (the `GET /api/client-settings` sentence and "which only the API holds") |
| Semantic conflicts with #588 | finder: `git grep` for `support_tip_completed`, `0021`, `0022`, `tips`, `user_id`, `revenue` outside `docs/reviews` and drizzle meta; read of `app.ts`, `server.ts`, `signed-in.ts`, `test/start-api.ts`, `fake-api.ts`, both stub APIs, `CONTEXT.md`, `docs/deploy.md`, ADR 0018, the three workflows, both Dockerfiles | no stale name or migration number; only main's files read or write `tips`; #588 changes no api-types; `startApi(web, { stripe, openPanel })` matches #588's tests |
| Targeted suites | finder, `pnpm exec vitest run` on `packages/database/test/migrations.test.ts`, `apps/api/src/stripe-events.test.ts`, `apps/api/src/delete-user.test.ts`, `packages/database/test/tips.test.ts`, `apps/api/src/preferences.test.ts` | 4, 33, 6, 7 and 29 passed |
| Test-quality audit | delta's test files: `git diff --name-only 8839f22 HEAD` | the only one is `apps/api/src/stripe-events.test.ts`, main's file, identical to `$BASE`; the branch adds no test in the delta, so no oracle run |
| Not run | the workflows on GitHub; the staging stack; drizzle's migrator against a local database that applied the branch's old 0021 (Minor below) | |

**Overall:** Review 2's one MEDIUM is fixed against its intent: the branch contains `origin/main`, main's migration 0021 and its #588 code are carried byte for byte, and the branch's preferences migration is now 0022, identical in SQL, chained on main's snapshot and later in the journal. Every full check passes, locally and under GitHub Actions' variables, and the browser walk passes. The merge introduced no semantic conflict. One LOW is confirmed: the release-note guide's hint to read migrations "for `DROP`" now matches main's `DROP NOT NULL` in the next release's range, which could mark a release `removes: true` that removes nothing. Nothing gates the PR.

## Approach decisions
- Carried forward from reviews 1 and 2: reporter release in tests (`vi.stubEnv` in the test, `vi.unstubAllEnvs()` in `afterEach`, production keeps the SDK's detection); the release page in the browser walk (site built with the web app's `buildEnvironment()`, `serveSite` mapping the API's pages); repro files in `docs/reviews/**` pass `pnpm lint`; a migration number taken on both sides of a merge is resolved by keeping main's migration and regenerating the branch's with drizzle-kit at the next number (precedent `packages/database/test/migrations.test.ts`, `3c9112e`, creator-analytics#238). This review commits no repro file; each proof is a command.
- The `removes` rule in `docs/release-notes.md` (finding 1): the guide's search hint is narrowed to the statements that remove something, and the rule's own wording ("drops a column or a table") stays the test. `packages/releases` keeps no code that reads migrations; `removes` stays a human field, as `docs/deploy.md:99` and ADR 0018 describe it.

## Prior-review closure
Review 2 (`pre-pr-review-2.md`, at `8839f22`) confirmed 1 finding, MEDIUM.
- **Fully fixed: 1.** Finding 1 (`60e5455`): verified by `git merge-base --is-ancestor origin/main HEAD` (exit 0), `git merge-tree` (exit 0), main's 8 files identical to `149417c`, the 0022 SQL identical to the old 0021, the snapshot chain and journal order above, and the full checks.
- **Partially fixed: 0.**
- **Untouched: 0.** Review 2's closure table lists no escalation and its "Known regressions, deferred" is "None".
- Review 1's LOW findings 3 to 16 remain deferred to Nick, as review 2 recorded; none is re-reported here.

## Confirmed Issues

### 1. The release-note guide says to read new migrations "for `DROP`", and the next release's range holds main's `DROP NOT NULL`, which removes nothing — LOW
- **Location:** `docs/release-notes.md:64`
- **Attribution:** introduced by `86eb97c` ("creator-analytics#576 Release note drafting from the PRs merged since the last release"), which adds `docs/release-notes.md` (`git show 149417c:docs/release-notes.md` fails: the file is absent at `$BASE`); exposed by `60e5455`, the merge that brought main's `0021_tips_user_id_optional.sql` (`ALTER TABLE "tips" ALTER COLUMN "user_id" DROP NOT NULL;`) into the first release this branch drafts. `0007` (`DROP DEFAULT`) and `0019` (`DROP CONSTRAINT`) already matched the hint; whether they fall in a release range depends on that release's `base`.
- **Real-world trigger:** drafting the first release note after this PR merges, by Nick or by an agent following `docs/release-notes.md` step 4 literally. `git diff --name-only <base> HEAD -- packages/database/drizzle/` lists `0021_tips_user_id_optional.sql` and `0022_preferences_whats_new_marker.sql`; a grep for `DROP` hits 0021, and the note gets `removes: true`. `checkRollback` (`packages/releases/src/rollback-check.ts:30-33`) then refuses every rollback to a version older than that release. The failure is a refused rollback that should have run, which fails safe and names the release in the way (`docs/deploy.md:54`), and the rule's own prose ("drops a column or a table") gives the right answer to a careful reader. No wrong result reaches a user, so LOW.

**Evidence**
```
- `removes`: `true` when a change in the range removed something, otherwise `false`. ... Look for:
  - a migration in the range that drops a column or a table: `git diff --name-only <base> HEAD -- packages/database/drizzle/`, where `<base>` is the tag or commit the command printed as `base`, then read each new migration for `DROP`;
```
`grep -n DROP packages/database/drizzle/*.sql` prints `0007_…:3: … DROP DEFAULT;`, `0019_…:1: … DROP CONSTRAINT "preferences_chart_card";` and `0021_tips_user_id_optional.sql:1: … DROP NOT NULL;`. None drops a column or a table.

**Failure mode** — a range holding a migration that only loosens a rule, with the hint applied literally, gives a note marked `removes: true`; the rollback check reads it as a remove release (`product === 'app' && removes && compareVersions(version, target) > 0`), and a rollback past it is refused though the older images run against that schema (main's 0021 only widens what `tips.user_id` accepts).

**Recommended fix** — in `docs/release-notes.md:64`, replace
```
then read each new migration for `DROP`;
```
with
```
then read each new migration for `DROP TABLE` or `DROP COLUMN`. A `DROP NOT NULL`, `DROP DEFAULT` or `DROP CONSTRAINT` only loosens a rule, so on its own it removes nothing;
```

**Remediation brief**
- **Design intent:** `removes` is a human-set frontmatter field (`packages/releases/src/read-release-content.ts:15-16`, validated as a boolean at `:178-179`). It marks a remove release, the second half of the expand and remove pair in `docs/deploy.md:99`, and `checkRollback` refuses to go back past any app release that sets it. Marking too few breaks a rollback against a removed column; marking too many blocks a rollback that would have worked. The guide's search hint should find the first without producing the second.
- **Full surface:** `docs/release-notes.md:64` only. `git grep -n "DROP" -- packages/releases docs README.md` finds no other place that tells a drafter how to set `removes`; `docs/deploy.md:54` and `:99` describe the field's effect and stay as they are.
- **Must preserve:** the bullet's first clause ("a migration in the range that drops a column or a table"), the `git diff --name-only <base> HEAD -- packages/database/drizzle/` command and its `<base>` explanation, the second bullet ("a removed route, screen or setting"), and the "When it is `true`" line; no em-dash in the new text (the guide's own rule, `docs/release-notes.md` step 5). `pnpm lint` stays green.
- **Do not touch:** `packages/releases/src/rollback-check.ts` and `read-release-content.ts`; `removes` stays a human field, so no migration parser goes into the package (Approach decisions). Main's `0021_tips_user_id_optional.sql`.
- **Proof:** documentation, so no red test. After: `sed -n 64p docs/release-notes.md` shows `DROP TABLE` or `DROP COLUMN` and names `DROP NOT NULL`; `for f in packages/database/drizzle/*.sql; do grep -lE 'DROP (TABLE|COLUMN)' "$f"; done` prints nothing, which is the answer the narrowed hint gives for every migration on the branch today.

## Needs Further Investigation

### A. A tip whose owner deleted their account is counted as revenue a second time if Stripe delivers its session again — pre-existing, untouched (main's #588)
`apps/api/src/tips.ts:26-29` records an ownerless tip only when the user is already gone at delivery; a tip recorded with a user cascades away on "Delete me" (`packages/database/src/tips.ts`, `onDelete: 'cascade'`). A later delivery of the same Checkout Session (a manual resend from Stripe's dashboard) then finds no row with that session ID, inserts an ownerless tip and sends `revenue` again, against the README's "once per Checkout Session". Reasoned by the finder, not reproduced. Every line is main's, identical at `149417c`, so it is outside this branch and not a merge gate. Confirm with a test in `apps/api/src/stripe-events.test.ts` that records a tip for a user, deletes the user, delivers the same signed event again and counts `revenue` sends; kill it if Stripe never redelivers a session that once answered 200 (automatic retries stop at a 2xx; only a manual resend remains). Follow-up ticket material for #588's owner: the candidate fix (`onDelete: 'set null'`) needs a migration and changes README's "The row goes with its user".

Review 1's A (a pending release cancelled by a third run in the `production` group), B (a promoted pre-release never deploys) and C (release pages under `vite dev`) stand as written there.

## Reviewed and Dismissed
- A stale `support_tip_completed` anywhere in the branch — `git grep -n support_tip_completed -- ':!docs/reviews'` prints nothing; README now says `revenue` in both paragraphs, matching main's `apps/api/src/event-relay.ts`.
- A doc, test or workflow that names the preferences migration as 0021, or 0021 as the latest — `git grep -nE '\b0021\b|\b0022\b' -- ':!docs/reviews' ':!packages/database/drizzle'` matches only a YouTube HTML fixture; `ci.yml`, `release.yml` and `rollback.yml` name no migration.
- Main's 0021 breaking the rollback rule in `docs/deploy.md:97-99` — dropping NOT NULL only widens what `tips.user_id` accepts; pre-#588 images check the user before inserting and read tips through the user scope.
- The branch's API wiring diverging from #588's tests — `app.ts`, `server.ts`, `signed-in.ts` and `test/start-api.ts` leave the Stripe and relay wiring as main has it; `apps/api/src/stripe-events.test.ts` passes 33 of 33 in the branch.
- `fake-api.ts` and the screenshot stub APIs missing ownerless tips — neither answers anything about tips; #588 changes no api-types (`MeAnswer`, `SupportAnswer`, preferences).
- ADR 0015's new-tab change conflicting with the branch's UI — `Sidebar.tsx`, `Profile.tsx` and `App.tsx` already open Stripe in a new tab.

## Minor / nits
- A local database that ran this branch's migrations before `60e5455` (old 0021 `whats_new_marker`, `when` `1794331010222`) will not migrate cleanly now: by the finder's reading of drizzle's pg migrator (not run), it applies only entries whose `when` is later than the newest recorded, so it would skip main's 0021 and then fail on 0022's `ADD COLUMN "whats_new_marker"`. Test databases are recreated every run (`packages/database/test/global-setup.ts`), and staging and production migrate only from `main`, which never held the old 0021, so no shared database is affected. Worth a line in the PR description: recreate such a local database.

## Test quality
Tests added or changed since `8839f22`: 1, `apps/api/src/stripe-events.test.ts`, which is main's #588 file carried by the merge and identical to `$BASE` (`149417c`), so it is not this branch's test and the base oracle does not apply · tests the branch itself added in the delta: 0 · tautology shapes found: 0. The merge's resolution is pinned by `packages/database/test/migrations.test.ts` (one SQL file per journal entry, no pending generate), which went red on the naive resolution in review 2.

## Before opening the PR
- **CI readiness:** lint, typecheck, build, the suite (local and under GitHub Actions' variables) and the browser walk pass at `8c763a6`. `origin/main` is still `149417c`; re-run the merge check if it moves before the PR opens.
- **Commit hygiene:** the tree is clean; this doc is the only addition from this review.
- **Likely reviewer asks:** as in reviews 1 and 2 (copy approvals for #575, #577 and #580; production's `STILLSTATS_ENVIRONMENT`; the first note and #581's walk after the merge; #593 open; the preferences migration is `0022`, expand-only), plus: the first release note's `removes` should be `false` for main's `DROP NOT NULL` (finding 1); a local database migrated from this branch before `60e5455` needs recreating (Minor).

## Verdict
Ready to open the PR as-is, with one LOW follow-up. Review 2's single MEDIUM is fully fixed, against its intent, and the merge with `origin/main` introduced no defect and no semantic conflict. The confirmed count went from 16 (review 1) to 1 (review 2) to 1 LOW here, a documentation hint that matters only when the first release note is drafted; fix it in this branch or carry it as a follow-up. Needs Further Investigation A is main's #588 code, untouched by this branch, and is follow-up ticket material, not a gate.
