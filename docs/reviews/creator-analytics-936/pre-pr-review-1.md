# Pre-PR review: creator-analytics#936 stored retention curves, compared on one chart

**Branch:** `creator-analytics-936-retention-curves` vs `origin/main` (merge-base `50d695399dfd8c31e04e16050a574403b987f933`, "Merge pull request #922 from nick-vogel/release-2026.11.20-date")
**Reviewed at:** HEAD `f5f2c5ce` (creator-analytics#952 Describe the retention comparison on the upgrade screen, pricing section and FAQ) + 0 files with uncommitted changes, 54 files total, +6505 / −89. The only untracked files are this review's own, `docs/reviews/creator-analytics-936/`.
**Reviewed against:** epic nick-vogel/creator-analytics#936 and its children #950, #951 and #952 (all open, all carried by this branch); the repo's `.claude/rules/` and the global `~/.claude/rules/`; CONTEXT.md; ADRs 0002, 0004 and 0017; and the run's recorded assumptions for #950, #951 and #952. There are no plan or spec docs under `docs/`. There is no prior review doc for #936.
**Date:** 2026-11-20
**Reviewer:** 3 code-review agents (storage and worker; API, types, site and docs; web), 1 tautology-audit agent, 1 repro agent, and a verify pass.
**Gemini:** skipped, Gemini failed: an HTTP or network error, or the 10-minute timeout (exit 14). `gemini-review` printed `gemini-ask: network error: UND_ERR_INFO`.

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Lint | `pnpm lint` (biome check .), at HEAD and again with this review's repro files present | green, 840 files |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` | green |
| Unit and integration suites | `pnpm test` (Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | green: 218 files, 5433 passed, 1 expected fail |
| Browser walk | `pnpm run --if-present test:browser` | "The browser walk passed." The 401s it logs come from the signed-out states it walks. |
| Migration 0037 against the 0031 precedent | read both | Both new tables have RLS enabled, `_web` and `_worker` policies identical to `reach_history`'s, an FK to `channels` with `ON DELETE cascade`, and no grant needed (0001 default privileges) |
| RLS coverage of the new tables | read `packages/database/test/scopes.test.ts:77` (`channelOwnedTables` lists every channel-owned table) and `packages/database/test/seed.ts:86-94` | Both tables are seeded and covered by the harness's refused reads as `app` |
| Purge, deleted-videos check, delete cascade | read the diff and tests (`history-purge.test.ts`, `deleted-videos.test.ts`, `delete-user.test.ts`) | All three cover both tables |
| Prior lane findings (#950 F1, F2; #951 F1, F2, F3) | read the code and tests | 4 fixed, #951 F2 half fixed (Finding 5) |
| **Finding 1 (quota row lock)** | Executed: `pnpm exec vitest run --config docs/reviews/creator-analytics-936/repro/quota-row-lock.vitest.config.ts` | red, same result on 5 runs. A web user's Analytics read of another channel, started during the refresh, fails `55P03` (lock timeout, 2 s) on the `quota_usage` upsert. `pg_blocking_pids` names the refresh's backend. The same probe completes before the refresh (30 ms) and after it (14 ms). |
| Tautology audit | Scratch worktree at `$BASE` with the branch's 16 new or modified test files copied in, then run | 104 tests added or changed. 3 green at base, plus 1 more hidden behind an import failure. Details under Test quality. |
| Em-dashes in shipped copy | `git diff $BASE` added lines, grep for `—` | none (the one hit is a test's own `'—'` literal) |
| Gemini finder | `~/.claude/bin/gemini-review` | not run: exit 14, network error |
| Real Google behaviour (curve shapes, duplicate or missing ratios, real call latency) | | not runnable here: needs Nick's walk of a paid channel on production |

**Overall:** The storage, purge, cascade, deleted-video check and RLS mirror their precedents and hold. The API read and the web page meet the spec. The full checks are green. One defect blocks the PR: the daily curve refresh runs 100 or more Google calls in a single database transaction, and that holds the quota row every channel shares for the whole run. Every other user's Analytics read waits on it, and this is proved by execution. Before the PR opens, also correct the privacy policy, which understates how long the curves are kept, and strengthen the tests that cannot go red.

## Approach decisions
- **Finding 1, the curve refresh's transaction:** commit each video's read in its own channel scope. The handler opens one `worker.forChannel` scope to plan the run, then one per due video, as `activeUserCount` in `apps/worker/src/jobs.ts` runs two `worker.asSystem` scopes in sequence. Rejected: committing quota outside the caller's transaction in the gateway's `spend`, since it changes the "units commit with the caller's transaction" rule for every read in the product.
- **Finding 2, the privacy policy:** describe the curves on the reach history's windows, item by item. Add them to the retention, deleted-video and disconnect items rather than writing a new section. The privacy pin in `site.test.ts` follows the words, as the #950 assumption records.
- **Copy pins against `tests-state-a-rule`:** kept, by the tickets' acceptance criteria (#950, #952) and the #952 assumption, until Nick approves the words on the epic's PR. Not reopened here.
- **Remediation 1, Finding 1, where the scopes open:** as the recommended fix, the job handler hands `refreshRetentionCurves` the `WorkerDatabase`, and the module opens the plan scope and one scope per due video. The `Handler` doc in `apps/worker/src/jobs.ts` said no module code opens a scope; it now names the curve refresh as the one exception and why. Rejected: a bound scope opener passed from the handler, which has no precedent in the repo either and hides the same exception behind an extra parameter. Reverse by moving the loop into the handler with two module functions (plan, read one), as `activeUserCount` sequences `pruneActivityDaysNoRetryNeeds` and `countActiveUsers`.
- **Remediation 1, Finding 1, the fix's own failure path:** a database error in one video's scope is proved in the suite with a curve that repeats a point, which breaks `retention_curves_point_idx`. The harness runs each scope as a savepoint, so the test shows the earlier videos' scopes kept and the throw reaching the caller.
- **Remediation 1, Finding 2, proof over the policy:** the retention-section test in `apps/site/test/site.test.ts` affirms "audience retention curve(s)" in the paid-retention, deleted-video and disconnect items, the same `affirms` pattern it uses for the history's facts. It is a rule over the copy from the code (the purge, the deleted-video check and the cascade all delete the curves), not a copy pin.
- **Remediation 1, Finding 3, the self-computed backfill note:** asserted with `toContain('12 videos to go.')`, the count the answer's `unread` drives, rather than the full sentence, so no new copy pin is written.

## Confirmed Issues

### 1. The curve refresh holds the quota row every channel shares for its whole run, so every other user's Analytics read waits on it — MEDIUM
- **Location:** `apps/worker/src/jobs.ts:116-118`, `apps/worker/src/retention-curves.ts:109-176`
- **Found by:** Claude
- **Attribution:** introduced. `git log -S'refreshRetentionCurves' $BASE..HEAD` first finds `8834444c` (creator-analytics#950 Store every Pro video's retention curve...). At `$BASE`, no worker job makes an Analytics call (`git grep "gateway.read(" $BASE -- apps/worker/src` is empty). The deleted-video check already holds the shared `data` row across its `videos.list` calls at `$BASE`, at a smaller scale; it is under Minor.
- **Real-world trigger:** from 09:00 UTC each day, `retentionCurveRefresh` runs for each Pro channel. A run makes at least 100 sequential Analytics calls (`readsPerRun`'s floor), more on a large channel, all at real Google latency. Meanwhile any signed-in creator opens a video page or a dashboard that reads Analytics. Their request blocks on its quota upsert until the refresh commits, and with no `lock_timeout` set anywhere in the repo it simply waits. The runs follow one another, so the waits repeat. On a cache miss, the run's opening `uploads` read holds the `data` row too, so Data API reads wait as well (the repro agent observed this in a variant it did not keep).
- **Severity:** MEDIUM, capped, because availability is not one of the classes HIGH is reserved for. Upgrade to HIGH if a production run lasts longer than the API's or the proxy's request timeout, so that waiting requests fail. Check with `select completed_on - started_on from pgboss.job where name = 'retentionCurveRefresh' order by created_on desc limit 20` on production once it runs.

**Evidence**
```ts
// apps/worker/src/jobs.ts:116-118
retentionCurveRefresh: (worker, data) => {
  const job = retentionCurveRefreshData(data)
  return worker.forChannel(job.channelId, (tx) => refreshCurves(tx, job))
},
// packages/youtube-gateway/src/youtube-gateway.ts, spend: on the caller's tx
await tx.sql
  .insert(quotaUsage)
  .values({ api, quotaDay: quotaDayOf(tx.now), units: cost })
  .onConflictDoUpdate({ target: [quotaUsage.api, quotaUsage.quotaDay], ... })
```
`packages/database/src/scopes.ts` `enter` wraps the whole `work` in one `handle.transaction`.

**Failure mode:** The first Analytics read's `spend` takes the row lock on `quota_usage (analytics, today)`, and the run's own transaction holds it until the last of its 100 or more reads commits. Any other transaction's `spend` on that row waits. The repro shows this with the real handler, the real gateway, the fake Google and real Postgres, on separate connections. User B's `audienceRetention` read of another channel, started at A's second read with `lock_timeout = '2s'`, threw `55P03` after 2013 ms. `pg_stat_activity` showed it waiting on `insert into "quota_usage" ... on conflict ("api","quota_day") do update`, and the controls before and after completed in 30 ms and 14 ms. A second-order effect: `quotaAllows` reads committed units only, so the run's 100 or more uncommitted units are invisible to every other request's reserve check until it commits.

**Recommended fix**
```ts
// apps/worker/src/jobs.ts
retentionCurveRefresh: (worker, data) => refreshCurves(worker, retentionCurveRefreshData(data)),
```
```ts
// apps/worker/src/retention-curves.ts
export function refreshRetentionCurves({ gateway, reporter }: RetentionCurveOptions) {
  return async (worker: WorkerDatabase, { channelId }: { channelId: string }): Promise<void> => {
    const refused = (refusal: string) => {
      if (refusal !== 'google_failed') return
      reporter.report({
        message: "A channel's retention curve refresh failed",
        context: { channelId },
      })
    }
    const plan = await worker.forChannel(channelId, async (tx) => {
      if ((await entitlementOf(tx, channelId)).tier !== 'paid') return { due: [] }
      const channel = await gateway.read(tx, channelId, 'uploads', {})
      if (!channel.ok) return { refusal: channel.refusal }
      const lastReads = new Map(
        (
          await tx.sql
            .select({ videoId: retentionCurveReads.videoId, readAt: retentionCurveReads.readAt })
            .from(retentionCurveReads)
            .where(eq(retentionCurveReads.channelId, channelId))
        ).map(({ videoId, readAt }) => [videoId, readAt]),
      )
      const candidates = channel.value.uploads.flatMap(({ videoId, publishedAt }) =>
        publishedAt === null
          ? []
          : [{ videoId, publishedAt: new Date(publishedAt), lastReadAt: lastReads.get(videoId) ?? null }],
      )
      return { due: dueVideos(candidates, tx.now).slice(0, readsPerRun(candidates, tx.now)) }
    })
    if ('refusal' in plan) return refused(plan.refusal)
    for (const { videoId, publishedAt } of plan.due) {
      const refusal = await worker.forChannel(channelId, async (tx) => {
        const read = await gateway.read(tx, channelId, 'audienceRetention', {
          videoId,
          startDate: reportingDayOf(publishedAt),
          endDate: reportingDayOf(tx.now),
        })
        if (!read.ok) return read.refusal
        const readAt = read.fetchedAt
        await tx.sql
          .delete(retentionCurves)
          .where(and(eq(retentionCurves.channelId, channelId), eq(retentionCurves.videoId, videoId)))
        if (read.value.length > 0) {
          await tx.sql.insert(retentionCurves).values(
            read.value.map(({ elapsedVideoTimeRatio, audienceWatchRatio }) => ({
              channelId,
              videoId,
              elapsedVideoTimeRatio,
              audienceWatchRatio,
              readAt,
            })),
          )
        }
        await tx.sql
          .insert(retentionCurveReads)
          .values({ channelId, videoId, readAt })
          .onConflictDoUpdate({
            target: [retentionCurveReads.channelId, retentionCurveReads.videoId],
            set: { readAt },
          })
        return null
      })
      if (refusal) return refused(refusal)
    }
  }
}
```
Add `type WorkerDatabase` to the `@creator-analytics/database` import, and keep `Scoped`, which `enqueueRetentionCurveRefreshes` still uses. Run `pnpm format` on the two files, since the candidates line above runs past the formatter's width. Update the function's doc block: the run now commits each video's read in its own transaction, so a refusal ends the run and every video read before it is already stored.

**Remediation brief**
- **Design intent:** The gateway records each Google call's quota units on the caller's transaction, so they commit together with what the call stored. Its reserve check reads only committed units, and its comment accepts that only "while requests are few". That holds when every transaction is short. The refresh must therefore keep each transaction to one Google call and its writes. Each video's points and its `retention_curve_reads` row still change together, in one scope. The plan (entitlement, uploads, due order and budget) is read once per run, from the first scope's clock.
- **Full surface:** `apps/worker/src/jobs.ts:116-118` (the handler wiring); `apps/worker/src/retention-curves.ts:100-177` (the doc block and `refreshRetentionCurves`); the `RetentionCurveOptions` and imports at `apps/worker/src/retention-curves.ts:1-17`. Callers of `handlers.retentionCurveRefresh(worker, { channelId })` in `apps/worker/test/retention-curves.test.ts` keep their shape, because the handler already takes `worker`. `refreshRetentionCurves` has no other caller (`git grep -n refreshRetentionCurves`).
- **Must preserve:**
  - Every test in `apps/worker/test/retention-curves.test.ts`, especially "a reserved quota ends the run, keeps the curves read before it, and reports nothing", "a revoked connection reads nothing and reports nothing", "an Analytics outage keeps what is stored, and reports the failed refresh once, naming only the channel", and the due-order and budget tests (around :287, :348, :378).
  - The schedule test in `packages/database/test/jobs.test.ts`.
  - A free channel, and an ended one, still read nothing, not even uploads.
  - A refused read still commits its own quota units: the scope returns normally, it does not throw.
  - `readAt` is still `read.fetchedAt`.
- **The fix's own failure:** if one video's scope throws (a database error), the videos committed before it stay stored. The throw reaches the job runner in `apps/worker/src/jobs.ts`, which reports it and rethrows so pg-boss retries the job. The retry plans again from what is stored, so it does not read today's young videos twice.
- **Do not touch:** the gateway's `spend` and `quotaAllows` (see Approach decisions). Also leave the deleted-video check's single transaction alone (Minor, pre-existing).
- **Proof:** `pnpm exec vitest run --config docs/reviews/creator-analytics-936/repro/quota-row-lock.vitest.config.ts` is red now (`during: { outcome: 'threw', code: '55P03' }`) and must be green after. Then `pnpm exec vitest run apps/worker/test/retention-curves.test.ts packages/database/test/jobs.test.ts` must stay green. The repro states its own limit: the fake answers in milliseconds, so only production shows the real hold time.

### 2. The privacy policy says the curves are stored while the channel is on Pro, but they are kept until the purge date after Pro ends, and the retention section never names them — MEDIUM
- **Location:** `apps/site/privacy.html:187-191`, with the retention section at `:358`, `:367` and `:395`
- **Found by:** Claude
- **Attribution:** introduced. `git log -S'deletes them with its reach history' $BASE..HEAD` finds `8834444c`.
- **Real-world trigger:** any reader of the privacy policy whose subscription ends. Their curves stay stored and readable on `/app/retention` for 30 days after the paid period ends (`apps/api/src/retention-curves.test.ts`, "an ended channel reads its curves until its purge date"), while the storage item says they are kept "while the channel is on Stillstats Pro". The section "How long Stillstats keeps your data" names only the reach history, in its retention, deleted-video and disconnect items.
- **Severity:** MEDIUM. A published data-retention claim that understates retention sits in the consent class's cap.

**Evidence**
```html
<!-- apps/site/privacy.html:187-191 -->
For a channel on Stillstats Pro, the audience retention curve of each of its videos: how
many of the video's viewers are still watching at each point in the video, and when
Stillstats read the curve. Stillstats stores the curves while the channel is on Stillstats
Pro, and deletes them with its reach history.
```
`:358` "A Stillstats Pro channel's reach history is kept while its subscription is active. ... stays readable for 30 days, until its purge date". `:367` "When a video is deleted on YouTube, Stillstats deletes its reach history at the next daily check." `:395` "its reach history and the record of its subscription ... go with the channel's other data".

**Failure mode:** an ended channel inside its purge window holds and serves curves that the policy says it no longer stores. A video deleted on YouTube loses its curves at the next daily check (README, `apps/worker/src/deleted-videos.ts`), and a disconnect removes them through the channel cascade. The policy says neither.

**Recommended fix:** reword the storage item's last sentence so the curves follow the reach history's windows, for example "Stillstats keeps the curves for as long as it keeps the channel's reach history." Add "and its audience retention curves" to the reach-history sentences at `:358`, `:367` and `:395`. This is copy: draft it with no em-dash, mark each changed item pending Nick's word-for-word approval on the epic's PR, as `:188` already is, and update the pin at `apps/site/test/site.test.ts:1805` to the new sentence.

**Remediation brief**
- **Design intent:** the curves share every lifecycle the reach history has: stored while paid, readable until the purge date after the subscription ends, deleted by the history purge, deleted with a video that YouTube deleted, and deleted with the channel. The policy describes each lifecycle once, in "How long Stillstats keeps your data", and the storage item points there (`:202`).
- **Full surface:** `apps/site/privacy.html:187-191` (the storage item), `:358-363` (paid history retention), `:366-368` (deleted video), `:393-399` (disconnect); `apps/site/test/site.test.ts:1805` (the privacy pin and its `affirms` facts).
- **Must preserve:** `apps/site/test/site.test.ts`'s em-dash and third-party rules over the policy, and the existing reach-history wording at `:182-186`.
- **Do not touch:** the FAQ and pricing copy (Minor, "the FAQ's schedule sentence").
- **Proof:** `pnpm exec vitest run apps/site/test/site.test.ts` stays green with the updated pin. Then, by reading the policy: no sentence says the curves go before the purge date, and the deleted-video and disconnect items name them.

### 3. Four new tests pass unchanged against the base, and two compute their expected text with the production formatter — MEDIUM
- **Location:** `apps/web/src/retention-plot.test.ts:228`, `apps/web/src/route.test.ts:721`, `apps/web/src/route.test.ts:765`, `apps/web/src/app.test.ts:6981`; self-computed at `apps/web/src/retention-comparison.test.ts:114` and `apps/web/src/app.test.ts:6911-6912`
- **Found by:** Claude
- **Attribution:** introduced, all in `3b51599d` (creator-analytics#951 Compare up to 5 stored retention curves on one chart). None comes from a review-pass commit, so none is an earlier finding's proof (`git log -S '<name>' $BASE..HEAD`).
- **Real-world trigger:** none for users. These are claims of coverage the branch does not have (tautology audit default).

**Evidence and failure mode**
- `retention-plot.test.ts:228` "leaves the video page's two retention charts as they were: one ink line each". Green at base, because the branch does not touch `watchingPlotDefinitionOf` or `relativePlotDefinitionOf`.
- `route.test.ts:721` "reads curves on the retention comparison alone, and writes them nowhere else". Green at base, which has no `curves` key at all. Only its negative half is asserted.
- `route.test.ts:765` "the feedback form opened from it names the video list, the default screen". Green at base, where `routeOf('retention', ...)` is the list route and `feedbackScreenOf` falls back to `'video_list'`.
- `app.test.ts:6981` "the video page's audience retention pair renders as before, with no legend". Green at base (found by stubbing the file's one new import in the scratch worktree). Its only branch-tied assertion, that `.comparison-legend` is null, holds anywhere the comparison is not mounted.
- `retention-comparison.test.ts:114` and `app.test.ts:6911-6912` assert `.toBe(backfillNoteOf(12, ...))`. That is the production formatter, so the expectation moves with the code.

**Recommended fix**
- `retention-plot.test.ts:228`: assert the contrast it implies, that the comparison scene's strokes are `var(--launch-line-1)`..`5` and differ from the video page's `var(--ink)`, so the test can go red; or delete it.
- `route.test.ts:721`: add the positive half, `expect(searchOf({ ...defaultRoute, retention: true, curves: ['a'] })).toBe('?curves=a')`, so it is red at base.
- `route.test.ts:765`: first assert `routeOf('retention', '?window=lifetime').retention` is `true`, then the feedback screen.
- `app.test.ts:6981`: delete it. The base's video page tests already cover the pair.
- The two self-computed assertions: write the sentence out, or assert `toContain('12 videos to go.')`.

**Remediation brief**
- **Design intent:** a test the branch adds must fail on the code from before the branch (`tests-can-go-red`). A contrast assertion does that: it checks that the new path differs from the old one.
- **Full surface:** the six sites above. Keep `app.test.ts:5415` (the sidebar's 608px boundary): it is green at base only as the upper edge of a boundary pair whose 607px sibling (`:5397`) is red.
- **Must preserve:** every other test in these files. The audit ran 104 new or changed tests, and all others were red at base.
- **Do not touch:** the copy pins (see Approach decisions).
- **Proof:** in a scratch worktree at `50d695399dfd8c31e04e16050a574403b987f933`, copy in the changed files and run `pnpm exec vitest run apps/web/src/retention-plot.test.ts apps/web/src/route.test.ts`. The rewritten tests must be red there and green on the branch.

### 4. When the page drops a pick the channel no longer holds and that pick's own read fails, the comparison stays refused with no way to clear the pick, and nothing tests the prune's failing paths — LOW
- **Location:** `apps/web/src/RetentionComparison.tsx:55-65`, `apps/web/src/retention-comparison.ts:218-235`
- **Found by:** Claude
- **Attribution:** introduced in `1379fffc` (creator-analytics#951 review pass 1 finding 1: one pick the uploads read no longer holds refuses the whole comparison...), which fixed #951 F1 on its happy path.
- **Real-world trigger:** a bookmarked `/app/retention?curves=...` address names a video deleted since, and the one-pick re-read of that video fails on the network. `readAnswer` returns `{ error: 'internal' }`, which is not `video_not_found`, so `heldPicksOf` keeps the dead pick and returns null. The page shows the whole comparison's `video_not_found` refusal, and the dead pick has no row in the picker to untick. A reload or the sidebar's Retention link clears it. LOW: it is transient and needs two coincidences.

**Evidence**
```ts
const body = await read(picks)
if (picks.length > 0 && isPickNotHeld(body)) {
  const held = heldPicksOf(picks, await Promise.all(picks.map((pick) => read([pick]))))
  if (held) return { kind: 'held', picks: held }
}
return { kind: 'view', view: comparisonViewOf(body) }
```
`git grep -n "heldPicksOf\|isPickNotHeld" -- 'apps/web/**/*.test.ts'` finds nothing. The only prune test is the happy path in `app.test.ts` (around :6836).

**Recommended fix:** treat a one-pick read that does not answer the curves as "not held". Then any pick that cannot be shown to be held is dropped, and the page cannot stay stuck:
```ts
const held = picks.filter((_, index) => {
  const body = alone[index]
  return body !== undefined && 'curves' in body
})
```
Add unit tests for `heldPicksOf`: none dropped (returns null), one dropped, all dropped, and a failed one-pick read dropped. Add an app test in which the dead pick's one-pick read fails, asserting that the address loses it and the other picks draw.

**Remediation brief**
- **Design intent:** a pick the page cannot draw must never block the others. The combined read refuses every pick when one is not held, and does not say which, so the one-pick reads (cached uploads, no Analytics query) name the ones to keep.
- **Full surface:** `apps/web/src/retention-comparison.ts:218-235` (`heldPicksOf`); `apps/web/src/RetentionComparison.tsx:55-65` (`readCurves`); the tests in `apps/web/src/retention-comparison.test.ts` and `apps/web/src/app.test.ts`.
- **Must preserve:** the happy-path prune test in `app.test.ts`; the `latestOnly` cancel when picks change mid-prune; no `retention_curves_compared` event from a prune.
- **The fix's own failure:** dropping a held pick after a transient error loses that pick from the address. That is acceptable (the creator ticks it again), and it is better than a stuck page. Name it in the test.
- **Proof:** `pnpm exec vitest run apps/web/src/retention-comparison.test.ts apps/web/src/app.test.ts -t "retention comparison"`. The new tests are red before the change and green after.

### 5. On an ended channel, a video read with no curve still says YouTube has none "yet", though nothing will read it again — LOW
- **Location:** `apps/web/src/retention-comparison.ts:33`, `:142-143`
- **Found by:** Claude
- **Attribution:** introduced in `3b51599d`. `dc4f2aa5` (review pass 1 finding 2) fixed only the unread branch, so #951 F2 is half fixed.
- **Real-world trigger:** a creator whose subscription ended, inside the purge window, opens a comparison that includes a video the refresh read with no curve. LOW: a wording promise, on a narrow state.

**Evidence**
```ts
readAt === null
  ? body.unread === null ? comparisonText.notReadEnded : comparisonText.notRead
  : points.length === 0
    ? comparisonText.noCurve            // 'YouTube has no retention curve for this video yet.'
    : readLabelOf(readAt, locale),
```
**Recommended fix:** add `noCurveEnded` (drafted, no em-dash, pending Nick's approval), for example "YouTube had no retention curve for this video when Stillstats last read it.". Choose it when `body.unread === null`, and add the case beside the ended-channel test at `apps/web/src/retention-comparison.test.ts:118`.

**Remediation brief**
- **Design intent:** `unread === null` is how the answer says the refresh no longer reads the channel (an ended channel), and every legend detail that promises a future read must branch on it.
- **Full surface:** `apps/web/src/retention-comparison.ts:24-39` (`comparisonText`) and `:136-146`; `apps/web/src/retention-comparison.test.ts:~104-125`; the em-dash list at `retention-comparison.test.ts:151-159`.
- **Must preserve:** `notReadEnded` and `notRead` as they are; the paid channel's `noCurve`.
- **Proof:** `pnpm exec vitest run apps/web/src/retention-comparison.test.ts`. The new case is red before the change.

### 6. The curves read's API tests do not name the human step for what only real Google shows — LOW
- **Location:** `apps/api/src/retention-curves.test.ts:1-4`
- **Found by:** Claude
- **Attribution:** introduced (`3b51599d`).
- **Real-world trigger:** none for users. It is a repo-rule miss (`youtube-test-limits`).

**Evidence:** `// ... They cannot prove a real curve's shape against Studio's; the refresh's own tests cover what it stores.` It names no human step. The fake server's uploads read decides `unread`, which depends on which uploads a real read returns with a publish time.

**Recommended fix:** add "Nick's walk of a paid channel on production, opening /app/retention, shows the real uploads read's publish times and the stored curves against Studio's." in the style of `apps/worker/test/retention-curves.test.ts:1-6`.

**Remediation brief**
- **Design intent:** every fake-Google test file states what it cannot observe and names the human step.
- **Full surface:** `apps/api/src/retention-curves.test.ts:1-4`.
- **Must preserve:** the tests themselves.
- **Proof:** read the header. This change has no executable proof.

### 7. The curve refresh has no test of a Google failure on its uploads read — LOW
- **Location:** `apps/worker/src/retention-curves.ts:120-121`
- **Found by:** Claude
- **Attribution:** introduced (`8834444c`).
- **Real-world trigger:** a Data API outage at 09:00 UTC. The branch reports `google_failed` and stores nothing, but no test drives it. The revoked test reaches the line only through a connection refusal, and the outage test drops only the Analytics API (`grep -n "dropDataApi" apps/worker/test/retention-curves.test.ts` is empty). This is a `test-every-fallback-path` miss.

**Recommended fix:** add a test beside "an Analytics outage keeps what is stored...": seed a stored curve, call `google.dropDataApi()`, run the handler, and assert that the stored curve is unchanged, there are no Analytics requests, and one report names only the channel.

**Remediation brief**
- **Design intent:** a refusal ends the run and what is stored stays; `google_failed` is reported once, naming the channel only.
- **Full surface:** `apps/worker/test/retention-curves.test.ts` (near :605). After Finding 1's fix, the uploads read sits in the plan scope, and the test must exercise that path.
- **Must preserve:** the existing outage and revoked tests.
- **Proof:** `pnpm exec vitest run apps/worker/test/retention-curves.test.ts`. Remove the `if (!channel.ok) return refused(...)` line in a scratch worktree, and the test goes red.

### 8. Comment hygiene — LOW (aggregated)
- `apps/worker/src/retention-curves.ts:61-65`: the JSDoc "The videos due a read, in the order they are read: ..." sits on `isYoung`. Move it above `function dueVideos` at :70. (found by: Claude)
- `packages/database/src/retention-curves.ts:26`: "When Google answered the read that delivered the curve." → "When the refresh's read of the curve ran (its scope's clock), or when the cached answer it used was fetched." (found by: Claude)
- `packages/api-types/src/retention-curves.ts:36`: "when Google answered the read that stored the curve" → "when the read that stored the curve ran, or when its cached answer was fetched". (found by: Claude)
- `README.md:85`: "(when Google answered the read that stored its curve" → "(when the read that stored its curve ran" (found by: Claude)
- `packages/api-types/src/retention-curves.ts:33`: "ISO 8601, when the video was published. Null for a video not yet published." → "ISO 8601: when the video was published, or when a scheduled video will be.", as `packages/api-types/src/videos.ts:223` says, since the value comes from `publishTimeOf`. (found by: Claude)
- `apps/api/src/retention-curves.ts:13-14`: a 165-column line inside a 100-column paragraph. Reflow it. (found by: Claude)

## Needs Further Investigation

### A. A database error on one video's points (a duplicate `elapsedVideoTimeRatio`, or NaN from a missing ratio) rolls back the run, and repeats every day at the same video — confirm whether Google ever answers either
- **Found by:** Claude
- The points insert has no conflict handling, and `packages/youtube-gateway/src/reads/audience-retention.ts` does not validate. A duplicate breaks `retention_curves_point_idx`, and NaN fails the `between 0 and 1` check. Today the throw rolls back every read in the run. After Finding 1's fix, only that video's scope rolls back, but it still throws on each daily retry and spends a read each time. What would confirm it: a real Analytics `audienceRetention` answer with a repeated or missing `elapsedVideoTimeRatio`, from Nick's walk or Google's documentation of the report. What would kill it: a documented guarantee of unique, present ratios.

### B. A very large channel's run against pg-boss's job expiry — confirm the expiry setting
- **Found by:** Claude
- A channel of 30,000 older uploads makes at least 1,000 sequential reads in a run. `git grep -n "expire" packages/database/src/jobs.ts` is empty, so pg-boss's default expiry applies. What would confirm it: that default against a measured production read latency. Finding 1's fix makes an expired run keep the reads it committed.

## Reviewed and Dismissed
- The curves read refuses with a 403 `ErrorAnswer` `sort_without_history` rather than a `Refusal` in `refusalStatus`. Not a defect: it mirrors the sibling epic #934's video-list shape for the same code (`creator-analytics-934-repackaging-view:apps/api/src/video-list.ts:469`, `{ ok: false; error: 'sort_without_history' }`), as the #951 assumption records. (found by: Claude)
- "RLS on the new tables is untested." Dismissed: `packages/database/test/scopes.test.ts:77` enumerates every channel-owned table, `seed.ts:86-94` seeds both, and the policies match 0031's. (found by: Claude)
- "A thrown network error mid-run rolls back the run." Dismissed: `gateway.read` turns every non-database error into a refusal (`.catch(... refusalOf(error))`), so a network failure returns and the run ends with its reads committed. Only the database error in NFI A throws. (found by: Claude)
- A channel switch from the Retention page lands on the new channel's video list. Dismissed: a recorded #951 assumption, with a proposal filed. (found by: Claude)
- The `ids` parser duplicates the video list's `idSetOf`. Dismissed as a defect: it mirrors it exactly, as `nearest-in-repo-precedent` asks. Extracting a shared parser is under Minor. (found by: Claude)
- The backfill note counts a video uploaded today until the next 09:00 run. Dismissed: a recorded #951 assumption. (found by: Claude)
- A free channel can still tick boxes, each read refused again. Dismissed: tested on purpose. (found by: Claude)
- The FAQ's "daily for the video's first 28 days, then monthly" ignores the backfill's head start. Dismissed: it is the schedule, and the sentence is a draft for Nick's approval. (found by: Claude)

## Minor / nits
- "the refusal Pro sorts use" (`apps/api/src/retention-curves.ts:15`, `apps/api/src/retention-curves.test.ts:304`, `README.md:85`, `CONTEXT.md:173`) is true once #934 lands, and false on `main` until then. If #936 merges first, it reads wrong until #934 follows. (found by: Claude)
- The monthly re-read compares milliseconds while the daily one compares UTC days, so an older video's re-read can slip to day 31 when a run starts earlier in the day than the last. It is still monthly. (found by: Claude)
- Nothing in the schema ties a `retention_curves` row to its `retention_curve_reads` row. The single writer writes both in one scope, and `apps/worker/src/deleted-videos.ts:51` relies on it. (found by: Claude)
- The deleted-video check (at `$BASE` too) holds the shared `data` quota row across its `videos.list` calls in one transaction. This is Finding 1's shape at a smaller scale, pre-existing, and follow-up ticket material. (found by: Claude)
- `apps/site/test/screenshot/stub-api.ts:684, 1105`: the stub parses `ids` more loosely than the API and always answers `unread: 0`, so the browser walk never draws the backfill note or the refused state. (found by: Claude)
- `apps/api/src/retention-curves.test.ts:232` states three rules in one test, and does not assert that the repeated read spends no extra Data API request. (found by: Claude)
- Copy pins kept by the tickets' AC (see Approach decisions): `apps/site/test/site.test.ts:1343, 1396, 1805`, `apps/web/src/upgrade.test.ts:45`, and the upgrade card list in `app.test.ts`. Delete them after Nick approves the words. In the privacy pin, the `affirms` facts cannot fail while its `toBe` passes. (found by: Claude)
- The legend colour tests read `data-launch-position` (`app.test.ts:6788, 6833`); happy-dom evaluates no stylesheet. Add a Limits line naming the browser walk for the swatch colour. (found by: Claude)
- The old chart stays on screen during a pick change with no loading announcement, unlike Audience's `setView(null)`. (found by: Claude)
- The hover card's title and values are both bare percentages ("50%", "Video 1 25%"), and the chart has no x axis label. (found by: Claude)
- Picker rows: the label does not fill the row, so a click in its right-hand space misses the checkbox. The checkbox's name runs the title, date and average together. The 6th disabled box is unfocusable, so its `aria-describedby` limit text is never announced. (found by: Claude)
- The five lines differ by colour alone, and the hover rows have no swatch (WCAG 1.4.1). (found by: Claude)
- The em-dash test at `retention-comparison.test.ts:151-159` leaves out the sort labels, `retentionLinkText` and the upgrade card. None of them holds an em-dash today. (found by: Claude)
- `readLabelOf` uses the viewer's time zone. That is right for a timestamp, but the app test's "Nov 18" at 12:00Z would break on a runner at UTC+13 or later. (found by: Claude)
- `RetentionComparison.tsx:187`: the read's failure handler does not reset `pickChanged`. Unreachable today, since `readAnswer` never throws. (found by: Claude)
- No app test drives the picker list's own refusal (`RetentionComparison.tsx:293-295`). (found by: Claude)
- `apps/web/src/sidebar-column.ts:10` and `apps/web/test/web.test.ts:756` give "597.2px" as measured. It equals the earlier 565.2px plus 32, so record the walk's measurement or drop "proves it". (found by: Claude)
- The two id parsers (`apps/api/src/routes/videos.ts:48`, `apps/api/src/routes/retention-curves.ts:23`) could share one function (`leave-the-code-better`). (found by: Claude)

## Test quality
Tests added or changed: 104 (85 new, 18 changed, 1 new generated case). Green against `$BASE`: 3 by the procedure, plus 1 hidden behind `app.test.ts`'s import failure, plus 1 kept as a boundary pair's upper edge. Tautology shapes found: 2 self-computed expectations, 4 copy tests (kept by AC), and 3 markup-for-effect assertions (noted under Minor). Finding 3 carries the per-test briefs. The worker and API test files showed no tautology shape. A scratch worktree at `$BASE` ran 16 files there (59 failed, 495 passed); every failure had a missing-code reason, none an environmental one.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and `pnpm test` are green at `f5f2c5ce`, and the browser walk passed. The repro under `repro/` sits outside the root vitest `include` (`{apps,packages}/*/{src,test}/**/*.test.ts`), so CI never runs its red. It passes `pnpm lint`.
- **Commit hygiene:** commit this doc and `repro/quota-row-lock.{test,vitest.config}.ts` together.
- **Likely reviewer asks:** the privacy wording (Finding 2) and all the drafted copy for Nick's word-for-word approval; migration 0037's shape (the #950 assumption invites a look before merge); the refresh's per-channel Analytics budget against the project quota (#950's open proposal).

## Verdict
**Not ready.** Gate: Findings 1 (the refresh's single transaction), 2 (the privacy policy) and 3 (tests that cannot go red) must be fixed before the PR opens. Findings 4 to 8 are small and can be fixed in the same pass or filed as follow-ups. NFI A and B wait on production facts. Of the 5 lane-review findings this branch claims to resolve, 4 are fully fixed (#950 F1, #950 F2, #951 F1 on its happy path, #951 F3). One, #951 F2, is half fixed: the unread label was fixed, but the no-curve label still promises a read (Finding 5). None was resolved only by editing a comment or a doc.

## Remediation — 2026-11-20
Scope: CRITICAL, HIGH and MEDIUM (Findings 1 to 3). The LOW tail (Findings 4 to 8) is deferred, unfixed, for Nick to triage.

| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 1 (MEDIUM) | `3fd33585` creator-analytics#936 pre-PR review 1 finding 1: the curve refresh holds the quota row every channel shares for its whole run; `720f45dd` ...finding 1: format the database error test as the formatter prints it | red→green: `pnpm exec vitest run --config docs/reviews/creator-analytics-936/repro/quota-row-lock.vitest.config.ts` (red `55P03` before, green after); new test "a database error storing one curve keeps the curves read before it, and reaches the job runner" red at `ea26366d` (stored reads `{}`), green after; `apps/worker/test/retention-curves.test.ts`, `apps/worker/test/jobs.test.ts`, `apps/worker/test/worker.test.ts`, `packages/database/test/jobs.test.ts` green | 1 (the test's reason a repeated point is a database error); the `Handler` doc and the refresh's doc block were updated to stay true, not added | proved by execution |
| 2 (MEDIUM) | `008840fa` creator-analytics#936 pre-PR review 1 finding 2: the privacy policy says the curves are stored while the channel is on Pro, but they are kept until the purge date after Pro ends | red→green: `pnpm exec vitest run apps/site/test/site.test.ts` with the updated test file against the old policy, 2 red (the storage pin, the retention-section facts); green with the new policy, 101 passed. Read: no sentence says the curves go before the purge date, and the deleted-video and disconnect items name them | 0 new (one existing test comment extended to name the curves' windows) | proved by execution |
| 3 (MEDIUM) | `a0c893e5` creator-analytics#936 pre-PR review 1 finding 3: four new tests pass unchanged against the base, and two compute their expected text with the production formatter | red→green: scratch worktree at `50d69539` with the rewritten `retention-plot.test.ts` and `route.test.ts`: the three rewritten tests red there, green on the branch. The deleted test needs none. The two self-computed assertions are red at base by import (no `retention-comparison.ts`) and green after. `apps/web/src/{retention-plot,route,retention-comparison,app}.test.ts` green, 763 passed | 0 | proved by execution |
| 4 (LOW) | deferred | — | — | not worked: LOW tail |
| 5 (LOW) | deferred | — | — | not worked: LOW tail |
| 6 (LOW) | deferred | — | — | not worked: LOW tail |
| 7 (LOW) | deferred | — | — | not worked: LOW tail |
| 8 (LOW, comment hygiene) | deferred | — | — | not worked: LOW tail |

Full checks after the round, at `a0c893e5` plus `720f45dd`: `pnpm lint` green (840 files), `pnpm typecheck` green, `pnpm build` green, `pnpm test` green (218 files, 5433 passed, 1 expected fail: one test added for Finding 1, one deleted for Finding 3), `pnpm run --if-present test:browser` passed. No fix qualified for a Phase 2 verify agent: all three are MEDIUM, each proof was executed red then green, and none touched a shared computation core (the gateway's `spend` and `quotaAllows` are unchanged).

Notes for the next round:
- Finding 7's test now has to drive the uploads read in the refresh's plan scope (`apps/worker/src/retention-curves.ts`, `if (!channel.ok) return { refusal: channel.refusal }`).
- NFI A's shape changed with Finding 1: a database error now rolls back only that video's scope, and the job still throws and retries daily at the same video. The new worker test pins the rollback half.
- The privacy policy's first retention item ("On Stillstats Pro, it also keeps a channel's impressions and click-through rate as history") still names only the reach history as Pro's kept history. It says nothing false, and it was outside Finding 2's surface; read it with Nick's approval of the curve wording.

### Known regressions, deferred
- none

### Rework briefs
- none (no verify pass, no rework)
