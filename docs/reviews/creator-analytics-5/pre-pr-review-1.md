# Pre-PR review: creator-analytics#5 Paid tier: CTR and impressions history

**Branch:** `creator-analytics-5-paid-tier-impressions-ctr` vs `origin/main` (merge-base `d3553bea`, "Merge pull request #778 from nick-vogel/release-2026.11.17")
**Reviewed at:** HEAD `7b640f3b` (creator-analytics#790 The terms, privacy policy, pricing and release note for the paid tier) + 0 files with uncommitted changes, 0 untracked files, 169 files total, +25,592 / −507
**Reviewed against:** epic creator-analytics#5 (its body is the spec), sub-issues #779 to #791 (#782 and #791 are ready-for-human and carry no code), ADR 0021, ADR 0006, ADR 0015, CONTEXT.md, CODING_STANDARDS.md. No prior review in this folder; run with `--fresh`.
**Date:** 2026-11-17
**Reviewer:** 3 code-review agents + 1 base-oracle agent + verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | green |
| Lint | `pnpm lint` (biome, 767 files) | green; this review's repro files pass `pnpm exec biome check docs/reviews/creator-analytics-5` |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` | green |
| Test suite | `env -u TEST_DATABASE_ADMIN_URL pnpm test` | green: 194 files, 4,904 passed, 1 expected fail |
| Browser walk | `pnpm run --if-present test:browser` | green (98 s) |
| Base oracle (Phase 4.5) | the branch's 41 added or modified `*.test.ts` copied into a scratch worktree at `d3553bea`, run together | 285 added or changed tests: 279 red at base, 6 green (see Test quality) |
| Finding 1 | `repro/ended-video-history.case.ts` appended to `apps/api/src/video-history.test.ts` in a scratch worktree at `7b640f3b` | red: `expected undefined to deeply equal { firstDay: '2026-09-10', … }`. Green with the recommended one-line gate; `video-history.test.ts` and `channel-history.test.ts` then 25 of 25 |
| Finding 2 | `repro/old-subscription-late-event.case.ts` appended to `packages/database/test/subscriptions.test.ts` | red: `Expected: "unchanged"`, `Received: "recorded"`. Green with the recommended two-part SQL fix; `packages/database apps/api packages/retention-engine packages/entitlements apps/worker` then 54 files, 1,003 passed |
| Finding 3 | `repro/second-subscription.case.ts` appended to `apps/api/src/subscription-changes.test.ts` | red: `expected [] to deeply equal [ { stripeObject: … } ]`, so no report of the second subscription |
| Finding 4 | read `apps/api/src/stripe-events.ts:96-116`; the suite's green `"a subscription to another product's price" is another product's sale` case (`subscription-events.test.ts:169-172`) is the executed proof | a subscription that names a Stillstats channel, at a price not in `STRIPE_PRICE_*`, records nothing |
| Finding 5 | `repro/report-order.mutant.sh` on a scratch worktree at `7b640f3b` | `MUTANT SURVIVED`: 175 of 175 worker and gateway tests green with the creation-time sort removed |
| Findings 6 to 10 | read the code path | see each finding |
| Live Stripe, the live Reporting API, real report files | not run | no access from a review; #791 is Nick's production walk |

**Overall:** The checks are all green, and the core arithmetic holds up under review: the reduction, channel CTR, running CTR, the partial pattern, the newest-average rule, the cursor and gap fill, the deleted-video check, the owner gate, and the OpenPanel events. Two in-scope defects block the PR. An ended channel's video list and video screen show the sample instead of the history the summary still shows (finding 1). A second paid Checkout for a paid channel is charged, then ignored and never reported (finding 3). Finding 4 must land before any price change, and the LOWs can go in this remediation or as follow-ups.

## Approach decisions
- Which history reads an ended channel gets: every history read goes through `historyReadable(entitlementOf(...))`, as `withHistoryOf` (`apps/api/src/channel-history.ts:31-32`) already does. No read gates on `tier === 'paid'` alone. Downloads stay paid-only (`apps/worker/src/reach-history.ts:59`).
- Ordering Stripe's events in `record_subscription` (overturns the #787 ticket assumption "a stored row of any other unpaid status is replaced as before, whatever the event's time", `.epic-loop/tickets/787/assumptions.md:19`):
  - Another subscription replaces the stored one only with an event no older than the row's `updated_at`, whatever the stored status.
  - A newer event of the stored subscription, once that one is `canceled`, answers `unchanged` and leaves `updated_at` alone.
  - Why: the #787 assumption feared a new subscription's own events would be dropped after the old one's deletion. That can only happen when a canceled subscription's later events move `updated_at` past the new one's. The second clause closes that path, and the full suites stay green with both clauses.
- A second live subscription for a paid channel is surfaced, not acted on. `record_subscription` answers a distinct outcome, and the webhook reports it to GlitchTip with the Stripe object's ID only, as `no_channel` already does (`apps/api/src/routes/stripe-events.ts:72-77`). Cancelling or refunding it automatically is an outward money action, so it stays a decision for Nick.
- Which subscriptions are the Paid tier's: a subscription whose metadata names a Stillstats channel. Its plan comes from its item's billing interval, not from a match against today's two price IDs. This overturns the #780 rule that a Stillstats-tagged subscription at another price is "another product's sale". Nick confirms it before it is built (finding 4).

## Confirmed Issues

### 1. An ended channel's video list and video screen show the sample and the upgrade action, though its summary shows its real history — MEDIUM
- **Location:** `apps/api/src/video-history.ts:210`
- **Attribution:** introduced. The gate came in `8777fb46` (creator-analytics#785 Impressions and CTR in the video list and video screen, with the newest average). `ebdb2400` (creator-analytics#787 The Customer Portal, and the end of a subscription with its purge date) added `historyReadable` and the ended state, and applied it to the summary only (`git log -S"historyReadable" d3553bea..HEAD`).
- **Real-world trigger:** any channel whose subscription has ended and whose purge date is ahead, for up to 30 days after each cancellation. The owner (or any member) opens the video list or a video screen, the core comparison screens. #787's acceptance criterion is "The web app shows an ended channel its history with the purge date and a subscribe-again action".

**Evidence**
```ts
export async function readVideoHistory(tx: Scoped<'user'>, channelId: string, windows: ReadonlyMap<string, DateRange>) {
  if ((await entitlementOf(tx, channelId)).tier !== 'paid') return undefined
```
`entitlementOf` gives an ended channel `{ tier: 'free', purgeDate }` (`packages/entitlements/src/entitlements.ts:34-46`). The web app's `paidPreviewOf` (`apps/web/src/sample-history.ts:25-33`) treats a `free` entry as a preview. `withSampleList` and `withSampleDetail` (`sample-history.ts:121-160`) fill an answer with no `history` with sample numbers.

**Failure mode:** an ended channel's summary answers its stored impressions and CTR with `purgeDate`. Its list answers no `history`, and the web app shows "Impressions (Sample)" columns, a sample newest average and a sample traffic-source table, with the upgrade action for the owner. The repro (`repro/ended-video-history.case.ts`) is red at `7b640f3b`: `list.history` is `undefined` for a canceled subscription whose purge date is ahead.

**Recommended fix**
```diff
-import { entitlementOf } from '@creator-analytics/entitlements'
+import { entitlementOf, historyReadable } from '@creator-analytics/entitlements'
@@
-  if ((await entitlementOf(tx, channelId)).tier !== 'paid') return undefined
+  if (!historyReadable(await entitlementOf(tx, channelId))) return undefined
```
Then move the repro's test into `apps/api/src/video-history.test.ts` as a seam 1 test of its own. Add a web test in `apps/web/src/app.test.ts`'s `describe('an ended channel and the Customer Portal (creator-analytics#787)')` (`:8172`): an ended channel's list carries no "(Sample)" column.

**Remediation brief**
- **Design intent:** an ended channel (free, with its purge date ahead) reads its stored history everywhere history is shown and downloads nothing new (ADR 0021, CONTEXT.md "Purge date"). The `entitlements` package decides readability, and every API history read asks it the same question. The web app fills the sample only when the answer carries no `history`, so the API-side fix flows through to the web unchanged.
- **Full surface:**
  - `apps/api/src/video-history.ts:15` (import) and `:210` (gate).
  - Doc comments that state "paid only" and must say "paid or ended":
    - `apps/api/src/video-history.ts:199-203`
    - `apps/api/src/video-list.ts:354-358`
    - `apps/api/src/video-detail.ts:152-158`
    - `packages/api-types/src/videos.ts:357-359`
    - `packages/api-types/src/video-detail.ts:232-233`
  - The README.md:93 last sentence, "The video list and the video screen read the history of a paid channel only."
  - `readVideoHistory` is the only gate. Both `historyPartOf` (`video-list.ts:360-380`) and `videoHistoryPartOf` (`video-detail.ts:160-195`) call it.
- **Must preserve:**
  - A free channel with no purge date, and an ended one past its purge date, still read no list or detail history. `apps/api/src/video-history.test.ts:510` ("a free channel's list and video screen carry no impressions, no history and no newest average, whatever is stored") pins the first case. `channel-history.test.ts:217` pins the past-purge case for the summary; add the same for the list.
  - The worker's download gate stays `tier !== 'paid'` (`apps/worker/src/reach-history.ts:59`).
- **Do not touch:** `paidPreviewOf` and the sample builders (`apps/web/src/sample-history.ts`). They are right once the API answers the history; see Dismissed, "skip the sample when the summary carries a purge date".
- **Proof:** append `docs/reviews/creator-analytics-5/repro/ended-video-history.case.ts` to `apps/api/src/video-history.test.ts`, then `env -u TEST_DATABASE_ADMIN_URL pnpm exec vitest run apps/api/src/video-history.test.ts -t 'repro:'`. Red before the fix, green after. Then fold it into a named test and run `env -u TEST_DATABASE_ADMIN_URL pnpm exec vitest run apps/api/src/video-history.test.ts apps/api/src/channel-history.test.ts apps/web/src/app.test.ts` and `pnpm typecheck`.

### 2. A late event of an old subscription makes an ended channel paid again and clears its purge date — LOW
- **Location:** `packages/database/drizzle/0033_subscription_end.sql:96-98`, with the claim in its header at `:19-25` and README.md:93
- **Attribution:** introduced. The current guard came in `e746f18a` (creator-analytics#787 review pass 1 finding 2: a late event of an old subscription re-pointed a channel whose new subscription was still incomplete), which limited the time check to a stored `incomplete` row on purpose (`.epic-loop/tickets/787/assumptions.md:19`).
- **Real-world trigger:** a failed delivery of an old subscription A's non-canceled event, which Stripe retries for up to 3 days. In that window the owner's second subscription B must start and end, so the row holds B `canceled`. LOW, capped: upgrade to MEDIUM if the live webhook endpoint shows failed deliveries (Stripe dashboard, Developers, Webhooks, the endpoint's failed events). The consequence is in the MEDIUM class: the channel reads as paid with nothing paying, it downloads again, and its history is never purged, so ADR 0006's published window breaks silently.

**Evidence**
```sql
  ELSIF NOT (stored.status = ANY (paid_statuses))
    AND subscription_status IS DISTINCT FROM 'canceled'
    AND (stored.status <> 'incomplete' OR event_created >= stored.updated_at) THEN
    next.stripe_subscription_id := subscription;
    next.status := coalesce(subscription_status, 'incomplete');
```

**Failure mode:** the sequence is A active, A canceled, B active (Nov 20), B canceled (Dec 20), then A's late `active` event created Nov 17. The result is `recorded`, and the row points at A `active` with no purge date. Repro `repro/old-subscription-late-event.case.ts`: red at `7b640f3b` (`Expected: "unchanged"`, `Received: "recorded"`).

**Recommended fix** (in place: `0030` to `0033` are added on this branch only, `git diff --name-status d3553bea` shows `A`, so no deployed database ran them; if staging has run `0033`, put the same change in a new `0034` instead)
```diff
-  ELSIF stored.stripe_subscription_id = subscription THEN
+  ELSIF stored.stripe_subscription_id = subscription AND stored.status = 'canceled' THEN
+    RETURN 'unchanged';
+  ELSIF stored.stripe_subscription_id = subscription THEN
     next.stripe_customer_id := customer;
@@
   ELSIF NOT (stored.status = ANY (paid_statuses))
     AND subscription_status IS DISTINCT FROM 'canceled'
-    AND (stored.status <> 'incomplete' OR event_created >= stored.updated_at) THEN
+    AND event_created >= stored.updated_at THEN
```
Then rewrite the header bullets at `0033:15-25` and the matching README.md:93 sentence to state the rule as it now is.

**Remediation brief**
- **Design intent:** `record_subscription` keeps one row per channel against Stripe's unordered, retried events. `updated_at` is the `created` time of the newest event the row holds. A canceled subscription is terminal. Another subscription may take the row only from a row that is not paid. With this fix, an event that takes the row must also be no older than the row: an older one is a late event of a subscription the row has already moved past.
- **Full surface:**
  - `packages/database/drizzle/0033_subscription_end.sql:91` (same-subscription branch), `:96-98` (replacement guard), `:15-25` (header).
  - README.md:93, the sentence beginning "`record_subscription` (migration 0033) guards against Stripe's unordered events".
  - The new test goes in `packages/database/test/subscriptions.test.ts` beside `:234` ("an older event of another subscription never replaces a new one not paid yet").
  - Finding 3 edits the same function's `ELSE` branch (`:104`). Land the two in one migration edit.
- **Must preserve:**
  - The first branch (`:84-89`, an older event of the stored subscription fills a null plan or period end), including on a canceled row.
  - A canceled subscription stays canceled with its purge date (the existing tests in `packages/database/test/subscriptions.test.ts`).
  - A return after an end still replaces the row. Its events are newer than the cancel event that set `updated_at`, which `apps/api/src/subscription-changes.test.ts` and `apps/worker/test/reach-history.test.ts` ("a channel that subscribes again on day 20…") pin.
  - Dropped by intent: a newer event of a canceled stored subscription no longer updates its customer, plan or period end, which no screen reads once it has ended.
  - The fix's own failure case: a stored `unpaid` subscription that emits a newer event moves `updated_at` on, so a new subscription's event created before it is dropped until that subscription's next event. That stays inside #787 review 3's F3.7 (the unpaid path), which #782's retries-to-cancel setting avoids.
- **Do not touch:** the `ON CONFLICT DO NOTHING` plus re-select insert race (`:55-77`), which is Dismissed as correct.
- **Proof:** append `docs/reviews/creator-analytics-5/repro/old-subscription-late-event.case.ts` to `packages/database/test/subscriptions.test.ts`, then `env -u TEST_DATABASE_ADMIN_URL pnpm exec vitest run packages/database/test/subscriptions.test.ts -t 'repro:'`. Red before, green after. Then `env -u TEST_DATABASE_ADMIN_URL pnpm exec vitest run packages/database apps/api packages/retention-engine packages/entitlements apps/worker`, which was 1,003 of 1,003 with this exact diff.

### 3. A second paid Checkout for a paid channel is charged, ignored and never reported, and a channel deletion cancels only one of the two — MEDIUM
- **Location:** `packages/database/drizzle/0033_subscription_end.sql:104` (`ELSE RETURN 'unchanged'`), `apps/api/src/routes/stripe-events.ts:72-77`, `apps/api/src/routes/billing.ts:65-67`
- **Attribution:** introduced. The Checkout gate and the webhook's reporting came in `dd30bf09` (creator-analytics#780 An owner subscribes, and the channel gets the paid Entitlement); the `ELSE` branch is `ebdb2400`'s.
- **Real-world trigger:** the owner opens a second Checkout while the channel still reads free and pays both. Ways that happens:
  - Two tabs.
  - Monthly in one Checkout, back, then annual, with the first Stripe page still open (a Checkout Session stays payable for hours).
  - A second click on Settings after returning from Stripe before the first webhook landed.
  
  The gate refuses only a channel already paid. Money: the owner pays twice, and Stillstats holds no record of the second subscription. `liveSubscriptionOf` (`packages/entitlements/src/entitlements.ts:111-122`) knows only the stored one, so a channel deletion cancels and refunds one, and the other keeps charging for a channel that no longer exists.

**Evidence**
```ts
  const outcome = await database.asAnonymous((tx) => recordSubscription(tx, subscribed.fields))
  if (outcome === 'no_channel' && event.type !== 'customer.subscription.deleted') {
    reporter.report({ message: 'A paid Stripe subscription names no channel', ... })
```
```sql
  ELSE
    RETURN 'unchanged';
```

**Failure mode:** a paid channel receives a `checkout.session.completed` for `sub_test_second`, and nothing is recorded or reported. Repro `repro/second-subscription.case.ts`: red at `7b640f3b` (`expected [] to deeply equal [ { stripeObject: … } ]`).

**Recommended fix**
```diff
   ELSIF NOT (stored.status = ANY (paid_statuses))
     ...
+  ELSIF stored.status = ANY (paid_statuses)
+    AND subscription_status IS DISTINCT FROM 'canceled' THEN
+    RETURN 'other_subscription';
   ELSE
     RETURN 'unchanged';
```
```diff
-export type RecordedSubscription = 'recorded' | 'unchanged' | 'no_channel'
+export type RecordedSubscription = 'recorded' | 'unchanged' | 'no_channel' | 'other_subscription'
```
```diff
   if (outcome === 'no_channel' && event.type !== 'customer.subscription.deleted') {
     reporter.report({
       message: 'A paid Stripe subscription names no channel',
       context: { stripeObject: subscribed.stripeObject },
     })
   }
+  if (outcome === 'other_subscription') {
+    reporter.report({
+      message: 'A second Stripe subscription names a paid channel',
+      context: { stripeObject: subscribed.stripeObject },
+    })
+  }
```

**Remediation brief**
- **Design intent:** one channel has at most one subscription row, and the webhook never re-points a paid channel at another subscription. That stays. But a second live subscription for a paid channel is money Stripe is taking for nothing. It must reach Nick through GlitchTip, with the Stripe object's ID only and no email, name or amount, as the `no_channel` report does. Whether Stillstats later cancels and refunds it on its own is Nick's decision (an outward money action), not this fix's.
- **Full surface:**
  - `packages/database/drizzle/0033_subscription_end.sql:104` (the new branch goes before `ELSE`), plus its header bullets at `:3-4` ("still answers 'recorded', 'unchanged' or 'no_channel'").
  - `packages/entitlements/src/entitlements.ts:169` (the outcome type) and its docblock at `:170-177`.
  - `apps/api/src/routes/stripe-events.ts:57-77`, both `receiveSubscription` and its docblock.
  - README.md:91 and :93, the sentences on what the webhook reports.
  - `packages/database/test/subscriptions.test.ts:219` ("a late event of another subscription never re-points a paid channel") must now expect `'other_subscription'`, with the row still unchanged.
- **Must preserve:**
  - The stored row is untouched by another subscription's event while the channel is paid (`subscriptions.test.ts:219`).
  - A canceled other subscription reports nothing (`subscription_status IS DISTINCT FROM 'canceled'`), so a channel's own old subscription ending says nothing.
  - Another product's sale still records and reports nothing (`apps/api/src/subscription-events.test.ts:159-183`, `subscription-changes.test.ts:407-436`).
  - The fix's own failure case: a late non-canceled event of an old subscription on a paid channel reports too, a false alarm Nick clears by looking at Stripe. Nothing is written in that case.
- **Do not touch:** the Checkout gate in `apps/api/src/routes/billing.ts:65-67`. Refusing an `incomplete` row there was considered and left out: it would lock out an owner whose 3D Secure step failed for up to 23 hours.
- **Proof:** append `docs/reviews/creator-analytics-5/repro/second-subscription.case.ts` to `apps/api/src/subscription-changes.test.ts`, then `env -u TEST_DATABASE_ADMIN_URL pnpm exec vitest run apps/api/src/subscription-changes.test.ts -t 'repro:'`. Red before, green after. Then `env -u TEST_DATABASE_ADMIN_URL pnpm exec vitest run packages/database/test/subscriptions.test.ts apps/api/src/subscription-events.test.ts apps/api/src/subscription-changes.test.ts`.
- **Escalation:** add a proposal to `.epic-loop/stage2/proposals.md` for an automatic cancel and refund of a second subscription, for Nick to decide.

### 4. After the first price change, every existing subscription's events are ignored, so a grandfathered subscriber's cancellation never ends the channel — MEDIUM
- **Location:** `apps/api/src/stripe-events.ts:96-116` (`subscriptionFieldsOf`)
- **Attribution:** introduced in `dd30bf09` (creator-analytics#780). `ebdb2400` (creator-analytics#787) extended the same filter to the updated and deleted events.
- **Real-world trigger:** ADR 0021 says "A later price rise is a new price for new subscribers. An existing subscription keeps its price". To sell at a new price, Nick points `STRIPE_PRICE_MONTHLY` or `STRIPE_PRICE_ANNUAL` at the new price ID (README.md:91, docs/deploy.md:148; there is no other way to configure it). From then on, every subscription at the old price is "another product's sale": its renewals, plan switches, `past_due`, and its deletion. The channel stays `active` forever after the subscriber cancels, downloads every day, and its history is never purged. MEDIUM, capped: it cannot happen before the first price change. It is certain at that change, so it must land before one.

**Evidence**
```ts
  const priced = subscription.items.data
    .map((item) => ({ item, plan: billingPlans.find((each) => prices[each] === item.price.id) }))
    .find(({ plan }) => plan !== undefined)
  const customer = idOf(subscription.customer)
  if (!channelId || !priced?.plan || !customer) return null
```

**Failure mode:** the suite's own case `"a subscription to another product's price" is another product's sale, which records and reports nothing` (`apps/api/src/subscription-events.test.ts:169-172`) is green. A subscription whose metadata names a Stillstats channel, at a price not in the two settings, is dropped. The Checkout path has no price filter (`stripe-events.ts:165-178`), so the two paths already disagree.

**Recommended fix:** read a subscription as the Paid tier's when its metadata names a Stillstats channel (only Stillstats' Checkout writes `stillstats_channel_id`). Take its plan from its item's billing interval, `item.price.recurring.interval` (`month` is `monthly`, `year` is `annual`), not from a match against today's two price IDs. Check that field on Stripe's Price object docs before building, and give the `price` built in `apps/api/test/stripe.ts` and `packages/fake-stripe/src/index.ts` a `recurring.interval`. Then rewrite the two test cases that pin the old rule (`subscription-events.test.ts:169-172`, `subscription-changes.test.ts:407-417`): a Stillstats-tagged subscription at a price not in the settings records its interval's plan. Another product's subscription, with no Stillstats metadata, still records and reports nothing.

**Remediation brief**
- **Design intent:** Stripe's events for the LLC's whole account reach one endpoint. The filter exists so another product's sale writes nothing. The Stillstats channel in the metadata is what marks a sale as Stillstats'; the price ID is what changes over time. The two settings are what Checkout sells today, not every price a live subscription can carry.
- **Full surface:**
  - `apps/api/src/stripe-events.ts:89-95` (docblock), `:96-116` (`subscriptionFieldsOf`), and the docblock at `:139-145`.
  - README.md:91 ("has an item at either price"), README.md:93 ("with the same filter as the created event (a Stillstats channel in the metadata and an item at either price)"), and docs/deploy.md:171.
  - The tests at `apps/api/src/subscription-events.test.ts:169-172` and `apps/api/src/subscription-changes.test.ts:407-417`.
  - `packages/retention-engine/src/subscription-cancellation.ts:120` reads `items.data[0]` and needs no change.
- **Must preserve:**
  - A subscription with no Stillstats channel in its metadata records and reports nothing (`subscription-events.test.ts:163-168`, `subscription-changes.test.ts:418-425`).
  - Checkout still sells only the two configured prices (`apps/api/src/billing.ts`).
  - A switch of plan records the new plan.
  - The fix's own failure case: an item with no `recurring` (not a subscription price) records with plan `null`, which `record_subscription` keeps as the stored plan.
- **Do not touch:** `checkout.session.completed`'s plan from metadata (`stripe-events.ts:165`).
- **Proof:** a new seam 1 test in `apps/api/src/subscription-changes.test.ts`. A paid channel's subscription is at `price_test_old`, outside `testBilling`'s prices, and its `customer.subscription.deleted` sets the `canceled` status and the purge date. Red before, green after: `env -u TEST_DATABASE_ADMIN_URL pnpm exec vitest run apps/api/src/subscription-changes.test.ts apps/api/src/subscription-events.test.ts`.
- **Escalation:** this overturns a #780 rule, so Nick confirms the mechanism first: the billing interval, or a list of retired price IDs in a new setting. It may ship as a follow-up ticket, provided that ticket blocks any price change.

### 5. No test guards that a day's reports are stored oldest first, so a correction can be overwritten by the report it corrects — LOW
- **Location:** `packages/youtube-gateway/src/reporting-job.ts:90`, `packages/fake-google/src/reporting-api/reports.ts:58-65`
- **Attribution:** introduced in `6f7b5fc0` (creator-analytics#783 A paid channel downloads its impressions and CTR history, and the summary cards and metric charts show it).
- **Real-world trigger:** only if a later change drops the sort. The fake lists reports in insertion order, and every test inserts them in creation order, so the rule "a report for a day already stored replaces that day's rows" (R2) is proved only for reports already in order. LOW: a coverage gap on a load-bearing rule, not a live defect.

**Evidence**
```ts
  return reports.toSorted((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
```

**Failure mode:** `repro/report-order.mutant.sh` replaces that line with `return reports`, and 175 of 175 worker and gateway tests stay green (`MUTANT SURVIVED`). With the sort gone and Google listing newest first, a first run on subscribe would store a day's correction and then overwrite it with the original.

**Recommended fix:** the fake Reporting API lists a job's reports newest first, the opposite of creation order. Add a worker test where one run downloads a day's original report and its correction, and the stored day holds the correction's numbers.

**Remediation brief**
- **Design intent:** `storeReport` deletes a day's rows and inserts the report's, so the order the loop stores reports in decides which version of a day wins. The gateway sorts by creation time, so the newest report of each day is stored last.
- **Full surface:** `packages/fake-google/src/reporting-api/reports.ts:58-65` (the listing order), and a test in `apps/worker/test/reach-history.test.ts` using `apps/worker/test/reporting-harness.ts`.
- **Must preserve:** `packages/fake-google/src/fake-google.test.ts`'s listing tests. Adjust any that assert insertion order, since they assert the fake and not a rule. The worker's existing first-download and gap-fill tests ("a new paid channel downloads every report still at Google, and stores each day", "a channel that subscribes again on day 20…") must stay green.
- **Do not touch:** the cursor arithmetic (`apps/worker/src/reach-history.ts:69-91`), Dismissed as correct.
- **Proof:** `git worktree add --detach <scratchpad>/mut <fix sha> && (cd <scratchpad>/mut && pnpm install --frozen-lockfile --prefer-offline) && docs/reviews/creator-analytics-5/repro/report-order.mutant.sh <scratchpad>/mut`, run from the repo root. At `7b640f3b` it prints `MUTANT SURVIVED` and exits 1; after the fix it must print `MUTANT KILLED`. Remove the scratch worktree afterwards.

### 6. One report the parser cannot read blocks every later day of that channel until Google deletes it — LOW
- **Location:** `apps/worker/src/reach-history.ts:98-103`, with `packages/youtube-gateway/src/youtube-gateway.ts:601-625` (a parse error answers `google_failed`)
- **Attribution:** introduced in `6f7b5fc0` (creator-analytics#783).
- **Real-world trigger:** a real file with a cell `reachRowsOf` throws on. Examples: an empty CTR on a zero-impression row, a CTR above 1 if the column is in percent (`packages/youtube-gateway/src/reach-report.ts:105-108`), or a date form the parser does not know. The reach-report test's `// Limits:` says the docs give neither the CTR scale nor the date form. LOW, capped: upgrade to MEDIUM if any production report fails to parse (check: GlitchTip "A paid channel has failed to download its reach reports for 3 days", or the #791 walk).

**Evidence**
```ts
      const downloaded = await gateway.downloadReachReport(tx, channelId, report)
      if (!downloaded.ok) {
        failure = downloaded.refusal
        break
      }
```

**Failure mode:** an unreadable file is refused like an outage, the loop breaks, and the cursor never passes it. Every daily run downloads it again and fails, and no newer day is stored for up to 60 days. The 3-day alarm fires, but nothing recovers without a code change.

**Recommended fix:** a file that downloads but does not parse gets its own refusal (`report_unreadable`). The runner reports it to GlitchTip with the channel ID and the report's day, then continues the loop past it. A transport failure still breaks, so R3's "left for the next run" holds for outages.

**Remediation brief**
- **Design intent:** R3: a failed download is left for the next run, so an outage loses no day while the file is still on YouTube. A file that will never parse is not an outage, and retrying it only blocks the days after it.
- **Full surface:** `packages/youtube-gateway/src/youtube-gateway.ts:601-625` (the refusal), the `ReachDownloadResult` type in the same file, `apps/worker/src/reach-history.ts:98-103`, and a test in `apps/worker/test/reach-history.test.ts`.
- **Must preserve:** "a failed download is retried" in `apps/worker/test/reach-history.test.ts`, and the 3-day alarm for transport failures.
- **Do not touch:** the CTR range guard itself (see Needs Further Investigation B).
- **Proof:** a worker test where the fake serves an unparseable file for day 1 and a good one for day 2, and one run stores day 2 and reports day 1. Run it with `env -u TEST_DATABASE_ADMIN_URL pnpm exec vitest run apps/worker/test/reach-history.test.ts`.

### 7. Three new test files open with no `// Limits:` comment — LOW
- **Location:** `apps/api/src/billing-settings.test.ts:1`, `apps/web/src/upgrade.test.ts:1`, `packages/database/test/subscriptions.test.ts:1`
- **Attribution:** introduced, in `dd30bf09` (creator-analytics#780) and `8b286fae` (creator-analytics#788 A free tier channel sees the paid screens with sample data).
- **Real-world trigger:** CODING_STANDARDS §2 "A test states its own limits", and the epic's Testing Decisions: "Every new test file opens with its `// Limits:` comment".

**Recommended fix:** open each file with a `// Limits:` comment in the shape of `apps/web/src/history.test.ts:1`. `billing-settings.test.ts` reads settings and cannot observe a real Stripe key or price. `upgrade.test.ts` tests the sentences as text and renders nothing. `subscriptions.test.ts` calls `record_subscription` directly with fields the tests write, never from a real Stripe event.

**Remediation brief**
- **Design intent:** the comment tells a reader what the green suite does not prove.
- **Full surface:** the three files above.
- **Must preserve:** every test in them.
- **Do not touch:** none.
- **Proof:** `head -1 apps/api/src/billing-settings.test.ts apps/web/src/upgrade.test.ts packages/database/test/subscriptions.test.ts | grep -c '// Limits:'` prints 3. Then run `pnpm lint`.

### 8. The upgrade screen's event test asserts that a constant equals its own literal — LOW
- **Location:** `apps/web/src/upgrade.test.ts:31-35`
- **Attribution:** introduced in `8b286fae` (creator-analytics#788), not a finding's proof (`git log -S"upgradeViewedEvent).toEqual" d3553bea..HEAD`).
- **Real-world trigger:** CODING_STANDARDS §2: it passes whatever the screen does, and it duplicates `apps/web/src/app.test.ts:8143` ("the upgrade screen sends upgrade_screen_viewed once each time it opens, with no property"). That test observes the real `track` call and asserts `[[{ name: 'upgrade_screen_viewed' }]]`.

**Evidence**
```ts
  test('carries its name and no property, so no channel number', () => {
    expect(upgradeViewedEvent).toEqual({ name: 'upgrade_screen_viewed' })
  })
```

**Recommended fix:** delete the `describe('the OpenPanel event of the upgrade screen')` block and the `upgradeViewedEvent` import from `apps/web/src/upgrade.test.ts`.

**Remediation brief**
- **Design intent:** the rule (one event per opening, no property) is a fact about what the screen sends, and only the rendered screen's `track` call shows it.
- **Full surface:** `apps/web/src/upgrade.test.ts:2` (import) and `:31-35`.
- **Must preserve:** `apps/web/src/app.test.ts:8143`.
- **Do not touch:** the comparison-line tests in the same file (`:4-29`); see Dismissed.
- **Proof:** `env -u TEST_DATABASE_ADMIN_URL pnpm exec vitest run apps/web/src/upgrade.test.ts apps/web/src/app.test.ts -t 'upgrade'` green, and `grep -c upgradeViewedEvent apps/web/src/upgrade.test.ts` prints 0.

### 9. A re-export left behind when `newestFirst` moved to `uploads.ts` — LOW
- **Location:** `apps/api/src/video-list.ts` (`export { newestFirst }`, with its comment "The list's default order, which the channel summary's uploads reuse."), `apps/api/src/channel-summary.ts:27`
- **Attribution:** introduced in `8777fb46` (creator-analytics#785), which moved `newestFirst` to `apps/api/src/uploads.ts` and kept a shim. CODING_STANDARDS §3: a walked-past refactor on a touched path.

**Recommended fix:** import `newestFirst` in `apps/api/src/channel-summary.ts` from `./uploads.ts`, and delete the re-export and its comment from `apps/api/src/video-list.ts`.

**Remediation brief**
- **Design intent:** one module owns the list's default order. `video-history.ts` already imports it from `uploads.ts`.
- **Full surface:** `git grep -n "newestFirst" apps/api/src`. Every importer goes to `./uploads.ts`.
- **Must preserve:** the channel summary's upload order (`apps/api/src/channel-summary` tests).
- **Do not touch:** none.
- **Proof:** `pnpm typecheck`, `pnpm lint`, and `git grep -n "export { newestFirst }" apps/api/src` prints nothing.

### 10. Comment hygiene — LOW (aggregated)
- `packages/database/src/subscriptions.ts:11-12` — "writes it only through the record_subscription function (migration 0030)" → "writes it only through the record_subscription function (migration 0033)"
- `apps/web/src/metric-charts.ts:78-79` — "Null when the days carry no stored history: a free channel, or a paid one whose history holds none of them." → "Null when the days carry no history and no sample: a free channel with no sample shown, or a paid or ended one whose history holds none of them."
- `apps/web/src/Settings.tsx:49-51` — the docblock breaks mid-sentence at "the currency revenue shows in, the" / "theme, …" → rewrap the paragraph to the file's width

## Needs Further Investigation

### A. The Reporting API traffic source codes past 28 may be mapped to the wrong names — what would confirm it: the code list on developers.google.com/youtube/reporting/v1/reports/dimensions (Traffic Source Dimensions), compared with `apps/web/src/traffic-sources.ts` (`REPORTING_18` "Playlist pages", `REPORTING_23` "Stories", `REPORTING_29` "Podcasts", `REPORTING_31` "Vertical live feed", `REPORTING_32` "Related video") and `apps/api/src/video-history.ts`'s code-to-type map. The web finder recalled from memory that the numbering past 28 may be shifted. No source was fetched, and `video-history.test.ts`'s `// Limits:` defers the codes to #791.

### B. The CTR column's scale (fraction or percent) — what would confirm it: one real `channel_reach_combined_a1` file from the #791 walk. `reach-report.ts:105-108` rejects a CTR above 1. A percent-scale file whose every row is at most 1% would be stored 100 times too high with no error, and one with any row above 1 becomes finding 6's blocking file.

### C. Whether Stripe keeps collecting a `past_due` subscription's open invoice after the immediate cancel on a channel deletion — what would confirm it: Stripe's docs on cancelling a subscription with open invoices, checked against `packages/retention-engine/src/subscription-cancellation.ts:82-84`, which cancels and refunds only a paid latest invoice. If Stripe keeps retrying the open invoice, a deleted channel can still be charged, and the fix voids it on cancel.

## Reviewed and Dismissed
- An ended channel should skip the sample when the summary carries a purge date (the web finder's alternative fix for finding 1). It is the wrong layer: the API decides readability, and the web app's fill-when-absent rule is right once the API answers.
- The `ending` state is not represented (`packages/entitlements/src/entitlements.ts:16-20`). A cancellation at period end is paid until Stripe ends it, as `apps/api/src/subscription-changes.test.ts:84` pins and README.md:93 states. No screen distinguishes it, and the Portal shows Stripe's own cancel state.
- The refund is the unused share of the latest payment only, so a prorated switch or Stripe credit can make it short or zero. This is the approved rule: #790 review pass 1 finding 2 (`6064b739`) reworded the terms to say so.
- `items.data[0]` in the cancellation (`subscription-cancellation.ts:120`): a Stillstats Checkout creates one item per subscription.
- Stripe calls inside the worker's channel transaction (`packages/retention-engine/src/retention-engine.ts:259`): each call carries an idempotency key, so a commit failing after Stripe succeeded repeats safely. Only a worker connection is held.
- The insert race in `record_subscription` (`0033:55-77`): `ON CONFLICT DO NOTHING` then a re-select `FOR UPDATE` serialises two first deliveries.
- The report cursor (`apps/worker/src/reach-history.ts:69-91`): it lists from cursor minus 1 ms and skips days already stored at the cursor's exact time. A break leaves the cursor at the last stored report, and the purge resets it.
- The deleted-video check: a failed batch deletes nothing, and private and unlisted videos are answered on the owner's token.
- A row of another day in a file is dropped (`reach-history.ts:40`): each file is one day by the API's contract, and the day comes from the report's own start time.
- A sub-millisecond `createTime` re-storing an older report: it needs a correction created within the same millisecond as the cursor.
- The six tests green at `$BASE` (Test quality): each is a negative guard ("with the Paid tier unset, the route answers 404", "absent when the days carry no stored history"), an adapted existing test, or the channel-owned meta-test, which fails if any other table gains a billing-role policy.
- The comparison-line tests in `apps/web/src/upgrade.test.ts:4-29`: each observes a branch (date or no date) through its text, which §2 allows.
- The channel summary carries no server-side "N of M days": the web app derives it from `firstDay` and the held days (`historyPartialOf`), and its tests cover it.

## Minor / nits
- `checkout_started` is sent before the API answers (`apps/web/src/App.tsx:165`), so a refused Checkout counts. `customer_portal_opened` is sent after. README.md:133 documents the timing, so moving the event is Nick's call on the funnel's meaning.
- The sample traffic-source table's column headings and the sample charts' hover cards carry no "(Sample)" (`apps/web/src/TrafficSources.tsx`, `apps/web/src/metric-charts.ts` hover labels). The table's heading and each chart's heading do. README says "every sample figure, chart and column".
- The sample newest average always names 10 uploads (`apps/web/src/sample-history.ts`), beside a real engaged-views average that may name 3.
- The upgrade screen renders its pitch and "would count if you subscribed today" lines for a paid channel reached by URL (`apps/web/src/Upgrade.tsx`). Nothing links there.
- The upgrade preview counts the first download as tomorrow's Pacific day (`apps/api/src/upgrade-preview.ts:122-125`). The roster's run at 04:30 UTC falls on today's Pacific evening, so the estimate is a day conservative, and on the day a job turns 30 days old it takes the 60-day branch.
- `downloadsFailingSince` survives an end and a return (`apps/worker/src/reach-history.ts:59`), so a returning channel's first failure alarms at once.
- `sum(...)::integer` in `readVideoHistory` overflows above 2^31 impressions for one video and one source.
- The stored reporting job is never re-validated (`packages/youtube-gateway/src/youtube-gateway.ts:567-571`). A job Google deleted fails every day, and only the 3-day alarm shows it.
- `app_web`'s `FOR ALL` policy on `subscriptions` (`0030_subscriptions.sql:18`) lets any member's user scope write the row. No route does. A select-only web policy for this table would make the database enforce "only `record_subscription` writes it".
- A purge date can be set again after the purge cleared it, by a later end event (`0033:107-108`, `coalesce(stored.purge_after, ends_purge_after)`). The purge then runs once more over no rows.
- The cancellation retries are timed from the deletion job's run, the alarm from the request (`packages/retention-engine/src/retention-engine.ts:218`). A late deletion job can outlast the alarm.
- `apps/api/src/subscription-events.test.ts:69` ("a repeated delivery changes nothing") re-applies an identical body, which writes an identical row whatever the repeat handling does. `packages/database/test/subscriptions.test.ts:315` holds the `'unchanged'` rule.
- `packages/database/test/jobs.test.ts`'s `cancelSubscription` queue test asserts the configured constants, and then a sum that follows from them.
- The `subscriptionEventOf` docblock in `apps/api/src/stripe-events.ts` has one line far past the file's width.

## Test quality
- **Tests added or changed:** 285 (across 41 files).
- **Green against `$BASE`:** 6, all of them negative guards or adapted tests (see Dismissed):
  - `apps/api/src/checkout.test.ts` "with the Paid tier unset, the Checkout route answers 404 as an unknown route does"
  - `apps/api/src/portal.test.ts`, the same rule for the Portal
  - `apps/web/src/components.test.ts` "each stacked chart keeps its heading and a slider…" (its fixture gained history)
  - `apps/web/src/numbers-table.test.ts` "are absent when the days carry no stored history"
  - `apps/web/src/traffic-sources.test.ts` "without the history, carry no impressions, CTR or average"
  - `packages/database/test/channel-owned.test.ts`'s policy meta-test
- **Tautology shapes found:** 2.
  - Finding 8 asserts a constant against its own literal.
  - Finding 5 is a sort no test can see, because the fake already lists in creation order.
  - Nits: the repeat-delivery test and the queue-constants test.
- **Limits comments:** 3 new test files lack one (finding 7).

## Before opening the PR
- **CI readiness:** lint, typecheck, build and the suite are green at `7b640f3b`, and so is the browser walk. The repro files under `repro/` pass biome. They are not `*.test.ts`, so vitest does not collect them.
- **Commit hygiene:** the tree was clean at review. Commit this doc and `repro/` together.
- **Likely reviewer asks:**
  - Migrations `0029` to `0033` are new on this branch. Findings 2 and 3 edit `0033` in place, which is safe only while no deployed database has run it.
  - The #782 Stripe setup: Managed Payments, the retry setting (cancel, not unpaid), and the Portal configuration README.md:93 relies on.
  - The #791 production walk for Needs Further Investigation A and B.

## Verdict
**Not ready as-is; ready once findings 1 and 3 land.**
- **Gate:** finding 1 (an ended channel's list and video screen) and finding 3 (an unreported second subscription). Both are small, in scope, and have red repros.
- **Before any price change:** finding 4. It needs Nick's choice of mechanism and may ship as a follow-up ticket that blocks one.
- **This remediation or follow-ups:** findings 2 and 5 to 10. Finding 2 shares the migration edit with finding 3, so land it with 3.
- No HIGH or CRITICAL finding survived verification.
- This is the branch's first review, so there are no prior findings to close.

## Remediation — 2026-11-17
Scope: CRITICAL, HIGH and MEDIUM (findings 1, 3, 4). The LOW findings 2 and 5 to 10 are deferred to Nick unfixed, per eng-pipeline#34. Finding 2's brief asked for it to land with finding 3 in one migration edit; finding 3 landed alone, and finding 2's two-part change to `0033` still applies on top of it unchanged.

| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 1 (MEDIUM) | `016d8cad` creator-analytics#5 pre-PR review 1 finding 1: an ended channel's video list and video screen showed the sample, though its summary showed its stored history | red→green: the repro, then the named test "an ended channel's list and video screen carry its history, as its summary does" (`env -u TEST_DATABASE_ADMIN_URL pnpm exec vitest run apps/api/src/video-history.test.ts -t 'ended channel'`, red `expected undefined to deeply equal { firstDay: '2026-09-10', … }` before, 2 of 2 after). Past-purge pin added for the list and video screen. Web pin in `app.test.ts` shown to go red with no list history. Preserve: video-history, channel-history, video-list, video-detail and app tests, 655 of 655 | 0 new; 5 existing docblocks rewritten to "paid or ended" as the brief's surface listed | fixed (disprove agent) |
| 3 (MEDIUM) | `69df5fcd` creator-analytics#5 pre-PR review 1 finding 3: a second paid Checkout for a paid channel was charged, ignored and never reported | red→green: the repro (`expected [] to deeply equal [ { stripeObject: … } ]` before), then the named test "a second paid Checkout for a paid channel records nothing and reports its session ID to GlitchTip". `subscriptions.test.ts`'s re-point test now expects `'other_subscription'`, and a new test pins a canceled other subscription on a paid channel as `'unchanged'`. Preserve: `packages/database apps/api packages/retention-engine packages/entitlements apps/worker`, 54 files, 1,007 of 1,007 | 0 new; the `0033` header, the `recordSubscription` and `receiveSubscription` docblocks rewritten as the brief's surface listed | fixed against the brief; see Known regressions |
| 4 (MEDIUM) | skipped | none | none | escalated: the brief and Approach decisions say Nick confirms the mechanism (billing interval or a retired-price setting) before it is built. Proposed as a follow-up ticket that blocks any price change (`.epic-loop/stage2/proposals.md`) |

Round checks after the last commit: `pnpm typecheck` green, `pnpm lint` green (770 files), `env -u TEST_DATABASE_ADMIN_URL pnpm test` 194 files, 4,910 passed, 1 expected fail, `pnpm build` green. One disprove agent verified both fixes. Fix A: no other API history read gates on `tier`, and the worker gate is untouched. Fix B: the new branch is reached only when the stored row is paid and the event's subscription differs and is not canceled. `RecordedSubscription` has one consumer, the webhook.

### Known regressions, deferred
- A late, non-canceled event of an old subscription (such as a retried `active` update of the subscription a channel left before it resubscribed) now reports "A second Stripe subscription names a paid channel" for a subscription that charges nothing. Introduced by `69df5fcd`. Verifier: "Before this commit it answered 'unchanged' silently". Not fixed, because the brief's Must preserve accepts this as the fix's own failure case: a false alarm, with nothing written. The verifier's patch (`AND event_created >= stored.updated_at`) would hide a real second Checkout delivered after a newer event of the stored subscription.
- A second subscription that never charges also reports: its `incomplete` created event (status passed as null), and `incomplete_expired`, `unpaid` or `paused`. Introduced by `69df5fcd`. Verifier: "a question of how 'live' is defined rather than a deviation". Not fixed: LOW, outside the one-line rework exception, and it errs toward reporting a money event.
- Coverage only, LOW: no web test covers an ended channel's video screen (the list one does; the path in `sample-history.ts` is symmetric). No API test checks the `sub_` ID report for a second subscription's own created or updated event (the Checkout `cs_` report and the database outcome are covered). One second Checkout reports once per event, so once per renewal too, with no deduplication.
- `apps/site/test/screenshot/stub-api.ts:1073` still sets `history = tier === 'paid'` in the screenshot stub, which the verifier noticed outside the diff. It is a fixture, not a read gate.

### Rework briefs
- None. The single verify pass reported no defect outside what the brief accepts, so no rework ran.

### Approach decisions (remediation 1)
- Finding 3's report fires for every non-canceled event of another subscription on a paid channel, whatever its time. No `updated_at` guard is added, because missing a real second charge is worse than a false alarm Nick clears in Stripe.
- `0033_subscription_end.sql` is edited in place, not in a new `0034`, because it is added on this branch only. A local or preview database that already ran the branch's earlier `0033` keeps the old function until it is rebuilt.
- Finding 4 is not built in this epic's remediation. Its mechanism waits for Nick, as a follow-up ticket that blocks any price change.
