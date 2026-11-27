# Pre-PR review: creator-analytics#5 Paid tier: CTR and impressions history

**Branch:** `creator-analytics-5-paid-tier-impressions-ctr` vs `origin/main` (merge-base `d3553bea`, "Merge pull request #778 from nick-vogel/release-2026.11.17")
**Reviewed at:** HEAD `db2e8416` (creator-analytics#5 pre-PR review 1 remediation closure table) + 0 files with uncommitted changes, 0 untracked files, 174 files total, +26,282 / −507 (review docs and repros included)
**Delta under review:** since `7b640f3b` (creator-analytics#790 The terms, privacy policy, pricing and release note for the paid tier), the HEAD that `pre-pr-review-1.md` reviewed: 18 files, +724 / −34, of which 14 are code, tests and README, and 4 the review 1 doc and repros. Commits `a2ff962e` (pre-PR review 1), `016d8cad` (finding 1), `69df5fcd` (finding 3), `db2e8416` (closure table).
**Reviewed against:** epic creator-analytics#5 (its body is the spec), `pre-pr-review-1.md` (its findings 1 and 3 briefs, its closure table and Known regressions, deferred), CODING_STANDARDS.md, `.epic-loop/stage2/proposals.md`.
**Date:** 2026-11-17
**Reviewer:** 1 code-review agent + verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | green |
| Lint | `pnpm lint` (biome, 770 files) | green. This review's new repro passes `pnpm exec biome check docs/reviews/creator-analytics-5/repro/older-live-event-on-incomplete.case.ts` |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` | green |
| Test suite | `env -u TEST_DATABASE_ADMIN_URL pnpm test` | green: 194 files, 4,910 passed, 1 expected fail |
| Browser walk | `pnpm run --if-present test:browser` | green, no content security policy violation in 112 steps |
| Base oracle (Phase 4.5) | the four changed test files copied from `db2e8416` into a scratch worktree at `7b640f3b`, run together | 7 added or changed tests: 3 red (the three fixes' proofs), 4 green, each a Must preserve pin the briefs asked for (see Test quality) |
| Fix A against its intent | read `readVideoHistory` (`apps/api/src/video-history.ts:210`), its two callers (`video-list.ts:381`, `video-detail.ts:195`), `historyReadable` and `entitlementOf` (`packages/entitlements/src/entitlements.ts:34-51`), `git grep -nE "tier (!==\|===) 'paid'"` over `apps packages` | holds. No API history read gates on paid alone. The purge boundary is the same strict `purgeAfter > tx.now` for summary, list and video screen. The worker's download gate (`apps/worker/src/reach-history.ts:59`) is unchanged |
| Fix B against its intent | read `record_subscription` in full (`packages/database/drizzle/0033_subscription_end.sql:30-140`), `git grep -n "recordSubscription\|RecordedSubscription\|other_subscription"` | holds for a paid row: the new branch splits only cases that answered `unchanged` before, never touches `updated_at`, and the webhook is its one consumer, reporting the Stripe object's ID only |
| Finding 1 | `repro/older-live-event-on-incomplete.case.ts` appended to `packages/database/test/subscriptions.test.ts` in a scratch worktree at `db2e8416` | red: `Expected: "other_subscription"`, `Received: "unchanged"`. Green with the recommended one-line change and the pinned test at `subscriptions.test.ts:258` updated; `packages/database apps/api packages/entitlements packages/retention-engine apps/worker` then 54 files, 1,008 passed |
| Finding 2 | read `apps/web/src/sample-history.ts:146`, `sample-history.test.ts`, and every `detailHistory` use in `apps/web/src/app.test.ts` | no test drives `withSampleDetail` with a history on a free or ended channel |
| Prior finding 4 | read `apps/api/src/stripe-events.ts:105` | still present, escalated by decision |
| Live Stripe, real webhook ordering | not run | no access from a review |

**Overall:** Both review 1 fixes reach their intent, every check is green, and no new MEDIUM or higher defect survived. The one new defect is a narrow ordering path the second-subscription report still misses (finding 1, LOW). The rest is a known coverage gap and comment drift the fix walked past. The branch is ready to open a PR, with finding 4 of review 1 still blocking any price change.

## Approach decisions
- Which history reads an ended channel gets (review 1): every history read goes through `historyReadable(entitlementOf(...))`. No read gates on `tier === 'paid'` alone. Downloads stay paid-only (`apps/worker/src/reach-history.ts:59`). Landed in `016d8cad`.
- A second live subscription for a channel is surfaced, not acted on (review 1, remediation 1): `record_subscription` answers `other_subscription`, and the webhook reports it to GlitchTip with the Stripe object's ID only. It fires for every non-canceled event of another subscription, whatever its time, because missing a real second charge is worse than a false alarm Nick clears in Stripe. Cancelling or refunding it automatically is Nick's call (`.epic-loop/stage2/proposals.md`).
- This review extends that decision to a stored `incomplete` row (finding 1): an event of another subscription that the `incomplete` guard refuses to re-point answers `other_subscription` too, rather than `unchanged`. It accepts one more false alarm of the same kind, a late live event of the subscription the new one replaced.
- `0033_subscription_end.sql` is edited in place, not in a new `0034`, while no deployed database has run it (`git log origin/main -- packages/database/drizzle/0033_subscription_end.sql` is empty).
- Which subscriptions are the Paid tier's (review 1 finding 4): waits for Nick, as a follow-up ticket that blocks any price change.

## Confirmed Issues

### 1. A second subscription whose events arrive after a newer, still incomplete one is charged and never reported — LOW
- **Location:** `packages/database/drizzle/0033_subscription_end.sql:107-110`
- **Attribution:** pre-existing at `7b640f3b`, exposed by this delta. Against `$BASE` the whole function is the branch's. The `incomplete` guard `(stored.status <> 'incomplete' OR event_created >= stored.updated_at)` came in `e746f18a` (creator-analytics#787 review pass 1 finding 2: a late event of an old subscription re-pointed a channel whose new subscription was still incomplete), per `git log -S"stored.status <> 'incomplete'" d3553bea..HEAD`. The delta's `69df5fcd` added the `other_subscription` report for a paid row only, and its README sentence now says every live subscription other than the channel's own "reports to GlitchTip", which this path does not.
- **Real-world trigger:** the owner pays two Checkouts in two tabs, C first and B a moment later. C's webhook deliveries fail or lag (an API deploy, a 500, a Stripe delay) while B's `customer.subscription.created` (status `incomplete`, so null) lands first and stores B as `incomplete`. Every C event then lands older than the row's `updated_at`. C is charged, and Stillstats neither records nor reports it until C's next event, its first renewal a month or a year later. Until then a channel deletion cancels only B. If B never pays (`incomplete_expired`), the channel reads free while C charges. LOW, capped for attainability, because it needs two paid Checkouts and out-of-order delivery across them. Upgrade to MEDIUM if Stripe's webhook log shows deliveries to `/api/stripe/events` retried past a later event: Stripe dashboard, Developers, Webhooks, the endpoint's failed attempts.

**Evidence**
```sql
  ELSIF NOT (stored.status = ANY (paid_statuses))
    AND subscription_status IS DISTINCT FROM 'canceled'
    AND (stored.status <> 'incomplete' OR event_created >= stored.updated_at) THEN
    ...
  ELSIF stored.status = ANY (paid_statuses)
    AND subscription_status IS DISTINCT FROM 'canceled' THEN
    RETURN 'other_subscription';
  ELSE
    RETURN 'unchanged';
```
A stored `incomplete` row fails the re-point branch for an older event and is not paid, so another subscription's live event falls to `ELSE`.

**Failure mode:** row B `incomplete` with `updated_at` 12:05, then C's `active` event created at 12:00 answers `unchanged`, writes nothing, and `receiveSubscription` (`apps/api/src/routes/stripe-events.ts:73-85`) reports nothing. Repro `repro/older-live-event-on-incomplete.case.ts`: red at `db2e8416`, `Expected: "other_subscription"`, `Received: "unchanged"`.

**Recommended fix**
```diff
-  ELSIF stored.status = ANY (paid_statuses)
+  ELSIF (stored.status = ANY (paid_statuses) OR stored.status = 'incomplete')
     AND subscription_status IS DISTINCT FROM 'canceled' THEN
     RETURN 'other_subscription';
```
```diff
-  test('an older event of another subscription never replaces a new one not paid yet', async ({
+  test('an older event of another subscription never replaces a new one not paid yet, and answers that it is another subscription', async ({
@@
-    expect(await web.asAnonymous(record(channelId, late))).toBe('unchanged')
+    expect(await web.asAnonymous(record(channelId, late))).toBe('other_subscription')
```
Then move the repro into `packages/database/test/subscriptions.test.ts` as a named test, and update the `0033` header bullet at `:24-26` and the `recordSubscription` docblock (`packages/entitlements/src/entitlements.ts:174-177`) to say a stored paid or `incomplete` row answers `other_subscription`.

**Remediation brief**
- **Design intent:** one channel has one subscriptions row, and the webhook never re-points it at another subscription with an event older than a new subscription whose first payment is under way (`e746f18a`). That stays. A live subscription the row does not hold is money Stripe takes, so every event of one that the function refuses to record must answer `other_subscription`, which the webhook reports to GlitchTip with the Stripe object's ID only. Only a canceled other subscription, or one on a row that is canceled or unpaid (an ended channel's, where a late event is the old subscription's own), stays `unchanged`.
- **Full surface:**
  - `packages/database/drizzle/0033_subscription_end.sql:107` (the condition) and its header bullets `:20-28`.
  - `packages/entitlements/src/entitlements.ts:172-178`, the `recordSubscription` docblock (also listed in finding 3).
  - `packages/database/test/subscriptions.test.ts:246-261`, the pinned test, which must expect `other_subscription` with the row unchanged.
  - README.md:93, the sentence "another subscription's event for a paid channel, not canceled, changes nothing and answers that it is another subscription": extend it to a channel whose new subscription is still incomplete.
  - `apps/api/src/routes/stripe-events.ts:80-85` needs no change: it already reports every `other_subscription`.
- **Must preserve:**
  - A newer event of another subscription still re-points a stored `incomplete`, `canceled` or `unpaid` row (branch 3 comes first): `subscriptions.test.ts` re-point tests and `apps/api/src/subscription-changes.test.ts`.
  - The stored row and its `updated_at` are untouched on the new path, as on the paid path (`subscription-changes.test.ts:407`).
  - A canceled other subscription answers `unchanged` and reports nothing (`subscriptions.test.ts:234`, `:290`; `subscription-changes.test.ts:434`).
  - Another product's sale still records and reports nothing (`apps/api/src/subscription-events.test.ts:159-183`).
  - The fix's own failure case, accepted by the Approach decision: a late live event of the subscription the incomplete one replaced (the test at `:246`) now reports a false alarm, with nothing written.
  - Review 1 finding 2's still-open change (another subscription replaces a stored row only with an event no older than `updated_at`, whatever the stored status) composes with this one: under it, a stored `canceled` or `unpaid` row's older event stays `unchanged`, which is intended. Do not widen this condition to those statuses.
- **Do not touch:** the Checkout gate (`apps/api/src/routes/billing.ts:67`), which refuses only a paid channel. Refusing an `incomplete` row was considered and left out in review 1: it locks out an owner whose 3D Secure step failed.
- **Proof:** in a scratch worktree, append `docs/reviews/creator-analytics-5/repro/older-live-event-on-incomplete.case.ts` to `packages/database/test/subscriptions.test.ts`, then from its root `env -u TEST_DATABASE_ADMIN_URL pnpm exec vitest run packages/database/test/subscriptions.test.ts -t 'repro:'`. Red before, green after. Then `env -u TEST_DATABASE_ADMIN_URL pnpm exec vitest run packages/database apps/api packages/entitlements packages/retention-engine apps/worker` (54 files, 1,008 passed in this review's trial of the fix).

### 2. No test covers an ended channel's video screen in the web app, or the video screen's history pass-through at all — LOW
- **Location:** `apps/web/src/sample-history.ts:146` (`if (answer.history) return answer`), `apps/web/src/app.test.ts:8268`
- **Attribution:** known regression, deferred. Review 1's closure, Known regressions, deferred: "Coverage only, LOW: no web test covers an ended channel's video screen (the list one does; the path in `sample-history.ts` is symmetric)." This review adds one fact: no test anywhere drives `withSampleDetail` with a history. `sample-history.test.ts:54` checks the pass-through for `withSampleSummary` only, `:103` checks the detail sample without a history, and every `api.detailHistory` in `app.test.ts` (`:7910`, `:7952`) runs on the default fake API, a paid channel, where `withSampleDetail` never runs.
- **Real-world trigger:** none today; the code is right. A later change that makes `withSampleDetail` always sample would show an ended channel's video screen as "(Sample)" with the upgrade action, and pass every test.

**Evidence**
```ts
export function withSampleDetail(answer: VideoDetailAnswer): Sampled<VideoDetailAnswer> {
  if (answer.history) return answer
```

**Failure mode:** a mutant deleting that line survives the suite (by reading; not executed).

**Recommended fix:** in `describe('an ended channel and the Customer Portal (creator-analytics#787)')`, add a sibling of `:8268` on the video route: `endedApi('owner')`, `api.detailHistory` set, render the video screen, and assert the traffic sources carry no `(${upgradeText.sampleMark})` heading and no link reads `upgradeText.action`.

**Remediation brief**
- **Design intent:** the API decides readability. The web app fills the sample only when an answer carries no `history`, for the summary, the list and the video screen alike, so an ended channel (a `free` entitlement with a purge date) shows its real history once the API answers it.
- **Full surface:** `apps/web/src/app.test.ts`, the `describe` at `:8172`, beside `:8268`.
- **Must preserve:** `:8268` and `sample-history.test.ts:54-62`, `:85`, `:103`.
- **Do not touch:** `paidPreviewOf` and the sample builders in `sample-history.ts` (review 1 Dismissed: the web fill-when-absent rule is right).
- **Proof:** the new test green, and red with `sample-history.ts:146` deleted in a scratch worktree: `pnpm exec vitest run apps/web/src/app.test.ts -t 'ended channel'`.

### 3. Comment hygiene — LOW (aggregated)
- `apps/api/src/video-history.ts:187` — "A paid channel's history as the video list and the video screen read it." → "A paid or ended channel's history as the video list and the video screen read it."
- `packages/api-types/src/video-detail.ts:60` — "from a paid channel's stored history" → "from a paid or ended channel's stored history"
- `packages/api-types/src/video-detail.ts:91` — "A paid channel's impressions and CTR history for one video" → "A paid or ended channel's impressions and CTR history for one video"
- `packages/api-types/src/videos.ts:266` — "from a paid channel's stored history" → "from a paid or ended channel's stored history"
- `packages/api-types/src/videos.ts:374` — "The two ends of a paid channel's stored impressions and CTR history." → "The two ends of a paid or ended channel's stored impressions and CTR history."
- `apps/web/src/sample-history.ts:14-16` — "sample numbers for a free channel" → "sample numbers for a free channel, where an answer carries no history, so an ended one shows its own"
- `apps/web/src/video-list.ts:387`, `:400` — "a paid channel's history" → "a paid or ended channel's history"
- `apps/web/src/traffic-sources.ts:59`, `:61`, `:70` — "a paid channel's history" → "a paid or ended channel's history"
- `apps/web/src/fake-api.ts:320`, `:333` — "A paid channel's history" → "A paid or ended channel's history"
- `packages/entitlements/src/entitlements.ts:174-175` — "`unchanged` for ... an event older than the newest the row holds, or a late event of an ended or an old subscription" → "`unchanged` for ... an older event of the stored subscription that fills nothing, or an event of a canceled subscription or of one an ended channel no longer holds" (and per finding 1, `other_subscription` for a paid or incomplete row)
- `apps/api/src/video-history.test.ts:556` — test title "..., though its rows are still stored" → drop the clause: nothing asserts the rows survive
- `packages/database/test/subscriptions.test.ts:290` — "a canceled other subscription says nothing of the channel" → "a canceled other subscription says nothing of an ended channel", so it reads apart from `:234` "... of a paid channel"

## Needs Further Investigation
Carried from review 1, unchanged by this delta:
### A. The Reporting API traffic source codes past 28 may be mapped to the wrong names — what would confirm it: the Traffic Source Dimensions list on developers.google.com/youtube/reporting/v1/reports/dimensions, compared with `apps/web/src/traffic-sources.ts` and `apps/api/src/video-history.ts`'s code map.
### B. The CTR column's scale (fraction or percent) — what would confirm it: one real `channel_reach_combined_a1` file from the #791 walk (`apps/worker/src/reach-report.ts:105-108` rejects a CTR above 1).
### C. Whether Stripe keeps collecting a `past_due` subscription's open invoice after the immediate cancel on a channel deletion — what would confirm it: Stripe's docs on cancelling a subscription with open invoices, against `packages/retention-engine/src/subscription-cancellation.ts:82-84`.

## Reviewed and Dismissed
- The list and the video screen of an ended channel carry no purge date, so only the summary shows the purge note (`apps/web/src/channel-summary.ts:171`). #787 put the note on the summary, and review 1 finding 1's intent was the history itself, not the note.
- The new `other_subscription` branch's order: it requires a stored paid status, and the re-point branch a stored status that is not paid, so they cannot overlap. Same-subscription events are caught first. No case that answered `recorded` or re-pointed now answers `other_subscription`.
- `updated_at` on the new path: the branch returns before the no-change bump and the UPDATE. `subscription-changes.test.ts:407` checks it through `storedSubscription`, which selects `updatedAt`.
- A two-tab race with no row yet: the second insert hits `ON CONFLICT`, re-reads the stored paid row `FOR UPDATE`, and answers `other_subscription`.
- The remaining `tier === 'paid'` gates: `apps/api/src/routes/billing.ts:49` (canManage) and `:67` (the Checkout refusal), `portalCustomerOf` (`packages/entitlements/src/entitlements.ts:71`), and the worker's download gate. Each is meant to be paid-only. `apps/site/test/screenshot/stub-api.ts:1073` is a screenshot fixture, not a read gate.
- The four tests green at `7b640f3b` (Test quality): each is a Must preserve pin the review 1 briefs asked for.
- The report sends `context: { stripeObject }` only: the `cs_` ID for a Checkout, the `sub_` ID for a subscription event. No email, name or amount.

## Minor / nits
- `packages/database/test/subscriptions.test.ts:219`'s `stored()` selects no `updated_at`, so the "changes nothing" half of the rule is held at the API seam (`subscription-changes.test.ts:407`) only. Adequate.

## Test quality
- **Tests added or changed in the delta:** 7, across 4 files.
- **Red at `7b640f3b` (the oracle for this delta):** 3. `subscriptions.test.ts` "a live event of another subscription never re-points a paid channel, and answers that it is another subscription"; `video-history.test.ts` "an ended channel's list and video screen carry its history, as its summary does"; `subscription-changes.test.ts` "a second paid Checkout for a paid channel records nothing and reports its session ID to GlitchTip".
- **Green at `7b640f3b`:** 4, each a pin of behaviour the fixes had to keep, which review 1's briefs named in Must preserve:
  - `video-history.test.ts` "past its purge date, an ended channel's list and video screen carry no history..." (the past-purge pin finding 1 asked for)
  - `subscriptions.test.ts:234` "a canceled other subscription says nothing of a paid channel"
  - `subscription-changes.test.ts:434` "another subscription's deletion for a paid channel records and reports nothing"
  - `app.test.ts:8268` "the owner of an ended channel sees its list's impressions and CTR columns with no sample mark and no upgrade action". The web code did not change, so it guards the web half only; the API test is the red-first proof.
- **Tautology shapes found:** none. Each test builds its input and observes the stored row, the reporter, or the rendered DOM.
- **Limits comments:** both API test files keep their `// Limits:` headers; no new test file.

## Before opening the PR
- **CI readiness:** lint, typecheck, build, the suite and the browser walk are green at `db2e8416`. The new repro is not a `*.test.ts`, so vitest does not collect it, and it passes biome.
- **Commit hygiene:** the tree was clean at review. Commit this doc and `repro/older-live-event-on-incomplete.case.ts` together.
- **Likely reviewer asks:** migrations `0029` to `0033` are new on this branch, and `0033` was edited in place, so any local or preview database that ran an earlier `0033` needs a rebuild. Review 1 finding 4 blocks any price change. The #791 production walk covers Needs Further Investigation A and B.

## Prior-review closure
Review 1 confirmed 10 findings (findings 1, 3 and 4 MEDIUM; 2 and 5 to 10 LOW). Remediation 1 scoped MEDIUM and above.

| Prior finding | State | Evidence |
| --- | --- | --- |
| 1 (MEDIUM) ended channel's list and video screen | fully fixed | `016d8cad`; `readVideoHistory` gates on `historyReadable`; red-first test and past-purge pin; doc comments and README updated. The web video-screen coverage gap is this review's finding 2 (known regression, deferred) |
| 3 (MEDIUM) second paid Checkout unreported | fully fixed against its brief | `69df5fcd`; `other_subscription` reported. Its accepted false alarms stay in review 1's Known regressions, deferred. The out-of-order path on an `incomplete` row is this review's finding 1, outside the brief's "paid channel" scope. The deletion half (only one of two is cancelled) is the escalated proposal "Cancel and refund a second live subscription ... automatically" in `.epic-loop/stage2/proposals.md` |
| 4 (MEDIUM) old price's events ignored | untouched, escalated | closure table: "escalated: the brief and Approach decisions say Nick confirms the mechanism". Still present at `apps/api/src/stripe-events.ts:105`. Proposal in `.epic-loop/stage2/proposals.md` |
| 2 (LOW) late event of an old subscription re-pays an ended channel | untouched | deferred by remediation scope; its two-part `0033` change still applies |
| 5 to 10 (LOW) | untouched | deferred by remediation scope |

Fixed only by editing a comment or a doc: none. The Confirmed count shrank from 10 to 3, all LOW, one of them aggregated comments, which is the expected shape of a second round.

## Verdict
**Ready to open a PR, with follow-ups.**
- **Gate:** none. No CRITICAL, HIGH or MEDIUM finding survived verification, and the two MEDIUM fixes of review 1 hold against their intent.
- **This remediation or follow-ups:** finding 1 (one-line SQL change, red repro preserved), finding 2 (one web test), finding 3 (comment sweep), and review 1's LOW findings 2 and 5 to 10.
- **Before any price change:** review 1 finding 4, escalated to Nick.
- Prior MEDIUM-or-higher findings left open: one (finding 4), deferred by decision. None were "resolved" by a comment edit alone.
