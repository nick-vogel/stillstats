# Pre-PR review: creator-analytics#338 Pay what you want: a support button for Stillstats

**Branch:** `creator-analytics-338-support-button` vs `origin/main` (merge-base `4c032ab` "Merge pull request #409 from nick-vogel/creator-analytics-359-tanstack-charts")
**Reviewed at:** HEAD `e6c3a5e` ("creator-analytics#338 The Stripe webhook takes only the Stillstats Payment Link's sessions, because the LLC's account sells other products"). The tree was clean, with no uncommitted or untracked files at review time. 55 files, +5,968 / −92 against the merge-base.
**Delta under review:** since `a924742` ("creator-analytics#338 pre-PR review 1 remediation closure table"), the commit `pre-pr-review-2.md` reviewed. The delta is `f4cd383` (review 2's doc and repro, no code) and `e6c3a5e`, 10 files, +166 / −37: `apps/api/src/stripe-events.ts`, `apps/api/src/support.ts`, `apps/api/src/routes/stripe-events.ts`, their tests `apps/api/src/stripe-events.test.ts` and `apps/api/src/support.test.ts`, the helper `apps/api/test/stripe.ts`, `apps/api/Dockerfile`, `README.md`, `docs/deploy.md` and ADR 0015. Review 2 was not remediated; `e6c3a5e` answers review 1's Needs Further Investigation A.
**Reviewed against:** `pre-pr-review-2.md` and `pre-pr-review-1.md` (findings, Approach decisions, Needs Further Investigation A), the epic body of creator-analytics#338 (Implementation Decisions), the body of creator-analytics#416, `CODING_STANDARDS.md`, and Stripe's own docs (docs.stripe.com/expand, "Expansion with webhooks") plus the stripe@23.1.0 types for `Checkout.Session.payment_link`.
**Date:** 2026-11-05
**Reviewer:** 1 code-review agent (delta), and a verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | already up to date |
| Lint | `pnpm lint` | pass, 551 files |
| Typecheck | `pnpm typecheck` | pass |
| Build | `pnpm build` | pass |
| Full suite | `pnpm test` (Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | 127 files, 2,856 passed, 1 expected fail (2,843 at review 1; the 13 new are this delta's) |
| Browser walk | `pnpm run --if-present test:browser` | 30 steps, no CSP violation, passed |
| Delta suites in a scratch worktree | `pnpm exec vitest run apps/api/src/stripe-events.test.ts apps/api/src/support.test.ts` (agent) | 59 passed |
| Mutation: drop the `payment_link` check | scratch worktree at HEAD (agent) | red: all 5 new "another link / no link" rows |
| Mutation: move the link check after the `client_reference_id` read | scratch worktree (agent) | red: the 2 "no client_reference_id" rows |
| Mutation: compare only a string link | scratch worktree (agent) | red: the expanded-object test |
| Mutation: treat a `null` link as Stillstats | scratch worktree (agent) | red: both "no Payment Link" rows |
| Mutation: accept any expanded link object | scratch worktree (agent) | survives; the branch is unreachable in production (Minor / nits) |
| Mutation: drop the `plink_` prefix check | scratch worktree (agent) | red: all 3 "not a plink_ ID" rows |
| Mutation: the route passes the URL instead of the ID | scratch worktree (agent) | red: 12 existing tests, which take the Stillstats link from the helper's default |
| Settings surface | `git grep -n "STRIPE_\|paymentLinkId"` across the repo, CI workflow, compose and `.env` examples | every in-repo list names all three settings; CI has no Stripe env; `SupportSettings` is built only at `server.ts:22` and `test/start-api.ts:146` |
| Webhook payloads never expand `payment_link` | Stripe docs, docs.stripe.com/expand: "Objects sent in events are always in their minimal form." | the object branch in `paidTipOf` is type-driven only |
| Plan versus code | `gh issue view 338` and `gh issue view 416` | both still name two settings: finding 1 |
| Prior LOW findings still present | greps of each indicted line at HEAD | review 2 findings 1 to 7 all present; line moves noted per finding |

**Overall:** The webhook now ignores every Checkout Session that does not come from the Stillstats Payment Link, before it reads the payment or the reference, and the settings check refuses to start with two of the three settings or a non-`plink_` ID. The tests go red for every reachable mutation. The one new finding outside comment wording is that the epic's spec and #416's setup steps still name two settings, so #416 worked as written leaves the API refusing to start. Nothing in the repo blocks the PR; the issue text should change before #416 is worked.

## Approach decisions
- All of review 1's and review 2's Approach decisions stand unchanged.
- Telling the Stillstats tip from another product's sale: compare `session.payment_link` with a configured `plink_` ID (`STRIPE_PAYMENT_LINK_ID`), ignored before the payment status or the reference is read, with no report (`e6c3a5e`, Nick's decision on review 1 Needs Further Investigation A). Not reopened.

## Prior-review closure
Review 2 held 7 confirmed findings, all LOW, none remediated. Review 1's Needs Further Investigation A is closed by `e6c3a5e`.
- **Fully fixed: 0.**
- **Partially fixed: 0.**
- **Untouched: 7.** Review 2 findings 1 to 7, all LOW, carried forward below as findings 2 to 8. No prior MEDIUM-or-higher finding is open.
- **Needs Further Investigation A (review 1):** closed. The LLC's account sells other products, and the webhook now takes only the Stillstats link's sessions. Verified against its intent: another link's paid session with a real creator's user ID records nothing, reports nothing and sends no event (the new rows at `stripe-events.test.ts:187-238`).
- Fixes resolved only by editing a comment or doc: 0.

## Confirmed Issues

### 1. The epic's spec and #416's setup steps still name two Stripe settings, so #416 worked as written leaves the API refusing to start — LOW
- **Location:** GitHub: creator-analytics#416 body ("Set the Payment Link URL and the webhook signing secret in Dokploy, and redeploy."); creator-analytics#338 body, Implementation Decisions ("The API gains two settings: the Payment Link URL and the webhook signing secret. ... With only one, the API refuses to start."). In the repo: `apps/api/src/support.ts:24-27`, `apps/api/src/server.ts:22`.
- **Attribution:** introduced by `e6c3a5e`, which added the third setting and updated every in-repo list (README, deploy.md, ADR 0015, the Dockerfile) but not the two issues. The plan is the stale side; the code is the decided behaviour.
- **Real-world trigger:** Nick works #416 from its body, sets the two values in Dokploy and redeploys. `supportSettingsOf(process.env)` throws at module load, so the API does not start. Capped at LOW: the failure is loud and immediate, its message names all three settings, and `docs/deploy.md:70` already lists the third. Upgrade to MEDIUM if the Dokploy redeploy replaces the running container before the new one is healthy (a full product outage until the third value is set); check with one look at the API application's deploy settings in Dokploy.

**Evidence**
```ts
  if (!paymentLinkUrl && !webhookSecret && !paymentLinkId) return undefined
  if (!paymentLinkUrl || !webhookSecret || !paymentLinkId)
    throw new Error(
      'Set all three of STRIPE_PAYMENT_LINK_URL, STRIPE_WEBHOOK_SECRET and STRIPE_PAYMENT_LINK_ID, or none',
    )
```

**Failure mode** — Executed in the suite: `the API refuses to start with all but the Payment Link ID set` (`support.test.ts:38-44`) throws on exactly the env #416 asks for.

**Recommended fix** — edit the two issue bodies (an outward GitHub write, so the orchestrator or Nick does it, not a remediation commit):
- #416: "Set the Payment Link URL, the Payment Link's `plink_` ID (from its page in the Stripe dashboard) and the webhook signing secret in Dokploy, and redeploy."
- #338, Implementation Decisions: "The API gains three settings: the Payment Link URL, the Payment Link's `plink_` ID, and the webhook signing secret. They are optional and go together. With none, ... With some but not all, or an ID that does not start with `plink_`, the API refuses to start." Add one line: "The webhook takes only Checkout Sessions whose `payment_link` is that ID, because the LLC's account sells other products."

**Remediation brief**
- **Design intent:** the API refuses to start on a partial Stripe configuration, so a half-configured deploy fails at once. The issue that tells the operator what to configure must name the full set, or that safeguard turns into the failure.
- **Full surface:** creator-analytics#416 body (the Dokploy step), creator-analytics#338 body (the "The API gains two settings" decision). No repo file changes; `docs/deploy.md:70`, `README.md:81`, ADR 0015 and `apps/api/Dockerfile:46-49` already name three.
- **Must preserve:** every other step and check in #416, including the deployed tip check, which is also the only check that the configured ID matches the link (see Minor / nits).
- **Do not touch:** `supportSettingsOf`'s all-or-none rule.
- **Proof:** `gh issue view 416 --repo nick-vogel/creator-analytics --json body --jq .body | grep -n STRIPE_PAYMENT_LINK_ID\|plink_` prints the setup step; the same for 338 prints the decision.

### 2. The new "Hide" focus test stays green without the nav's `tabIndex={-1}`, half of the fix — LOW
- **Location:** `apps/web/src/app.test.ts:3555-3566`; `apps/web/src/Sidebar.tsx:29`
- **Attribution:** introduced by `b320c2e`. Carried forward unchanged from review 2 finding 1.
- **Real-world trigger:** none today; a later removal of `tabIndex={-1}` would bring back review 1's MEDIUM with the suite green.

**Evidence** — still at HEAD: `grep -n "getAttribute('tabindex')" apps/web/src/app.test.ts` prints nothing.

**Failure mode, Recommended fix** — as review 2 finding 1.

**Remediation brief**
- **Design intent, Full surface, Must preserve, Do not touch:** as in `docs/reviews/creator-analytics-338/pre-pr-review-2.md` finding 1. The delta touched no web file, so its line numbers hold.
- **Proof:** `sh docs/reviews/creator-analytics-338/repro/sidebar-tabindex-mutation.sh <scratch-dir>` passes the test on the mutant now and must fail it after the fix.

### 3. Stripe's return can show the sidebar's support item right beside the thanks line — LOW
- **Location:** `apps/web/src/App.tsx:283`
- **Attribution:** introduced by #411 (`8134e1f`) and #413 (`b63402a`). Carried forward from review 2 finding 2 (review 1 finding 2).
- **Real-world trigger:** Stripe's redirect wins the race with the webhook.

**Evidence** — still at HEAD: `const sidebarSupportLink = sidebarSupportLinkOf(support, saved ?? {})`.

**Failure mode, Recommended fix** — as review 1 finding 2.

**Remediation brief**
- **Design intent, Full surface, Must preserve, Do not touch:** as in `pre-pr-review-1.md` finding 2; line numbers hold.
- **Proof:** `sh docs/reviews/creator-analytics-338/repro/support-ui-repro.sh <scratch-dir>`: the finding 2 test is red at HEAD and must go green.

### 4. Four fallback paths have no test — LOW
- **Location:** `apps/web/src/App.tsx:312`, `:425`, `apps/api/src/routes/support.ts:26-29`, `apps/api/src/routes/stripe-events.ts:45-48`
- **Attribution:** introduced by #411, #413 and #414. Carried forward from review 2 finding 3 (review 1 finding 3).
- **Real-world trigger:** none today; a regression in any of the four ships silently.

**Evidence** — still at HEAD: `readSupport().then(setSupport, () => setSupport(null))` (`App.tsx:312`), `readSupport().then(setSupport, () => {})` (`:425`).

**Failure mode, Recommended fix** — as review 1 finding 3. For (d), the webhook 500 test must now deliver a session from the Stillstats link; `checkoutSessionEvent` in `apps/api/test/stripe.ts` does so by default (`paymentLink = testStripe.paymentLinkId`), so pass no `paymentLink`.

**Remediation brief**
- **Design intent, Full surface, Must preserve, Do not touch, Proof:** as in `pre-pr-review-1.md` finding 3. Line moves at HEAD: the `recordTip` write in the route is at `routes/stripe-events.ts:46` (was `:45`), and the ordering assertion in `app.test.ts` is at `:3623`.

### 5. The privacy policy's analytics test is a whole-sentence copy test, against its own Limits comment — LOW
- **Location:** `apps/site/test/site.test.ts:1041-1045`; the Limits comment at `:964-972`
- **Attribution:** introduced by #412 (`018f3c7`). Carried forward from review 2 finding 4 (review 1 finding 4).
- **Real-world trigger:** none for a creator; `CODING_STANDARDS.md` 2.

**Evidence** — still at HEAD, `site.test.ts:1044`.

**Failure mode, Recommended fix** — as review 1 finding 4.

**Remediation brief**
- **Design intent, Full surface, Must preserve, Do not touch, Proof:** as in `pre-pr-review-1.md` finding 4; line numbers hold.

### 6. Duplicate and overclaiming tests — LOW
- **Location:** `apps/api/src/stripe-events.test.ts:337-338`, `:72`; `apps/api/src/support.test.ts:108-117`; `apps/web/src/app.test.ts:3524-3532`; `packages/database/test/tips.test.ts:39`
- **Attribution:** introduced by #411, #413 and #414. Carried forward from review 2 finding 5 (review 1 finding 5).
- **Real-world trigger:** none; `CODING_STANDARDS.md` 2.

**Evidence** — all five sites still at HEAD; the two API files moved with the delta's added tests.

**Failure mode, Recommended fix** — as review 1 finding 5, at the moved lines.

**Remediation brief**
- **Design intent, Do not touch, Proof:** as in `pre-pr-review-1.md` finding 5.
- **Full surface at HEAD:** `stripe-events.test.ts:337-338` (was `:261-262`; the two `toHaveProperty('payload...')` lines); `stripe-events.test.ts:72` (the rename); `support.test.ts:108-117` (was `:87-96`, "a signed-out request is refused"); `app.test.ts:3524-3532`; `tips.test.ts:39`.
- **Must preserve at HEAD:** the exact-body `toEqual` in the test at `stripe-events.test.ts:281` (was `:219-235`), the header assertions at `:334-336` (was `:258-260`), the OpenPanel count test at `:341` (was `:265`), the route inventory in `sign-in.test.ts:296`, and the "is absent while the sidebar shows when %s" rows.

### 7. deploy.md's origin list misses the Payment Link's return address — LOW
- **Location:** `docs/deploy.md:77`, `:84`
- **Attribution:** introduced by #414 (`461525d`). Carried forward from review 2 finding 6 (review 1 finding 6). `e6c3a5e` extended the bullet at `:84` without adding it.
- **Real-world trigger:** a domain change or a recreated Payment Link loses the thanks line with no error.

**Evidence** — `grep -n "support=thanks" docs/deploy.md` still prints nothing at HEAD.

**Recommended fix** — append review 1 finding 6's sentence to the end of the bullet at `docs/deploy.md:84`, after "...and answers any other with 200 and does nothing.". A recreated Payment Link also has a new `plink_` ID, so add: "Recreating the Payment Link changes both its URL and its ID, so `STRIPE_PAYMENT_LINK_URL` and `STRIPE_PAYMENT_LINK_ID` change together."

**Remediation brief**
- **Design intent, Do not touch:** as in `pre-pr-review-1.md` finding 6.
- **Full surface:** `docs/deploy.md:84`.
- **Must preserve:** the bullet's existing three sentences (endpoint, signing secret, the other-products sentence from `e6c3a5e`) and the env line at `:70`.
- **Proof:** `grep -n "support=thanks" docs/deploy.md` prints the bullet.

### 8. Comment hygiene — LOW (aggregated)
Review 2 finding 7's four entries are still present at HEAD at the same lines; this round adds four.
- `apps/web/src/Profile.tsx:32-36` — see `pre-pr-review-1.md` finding 7.
- `apps/web/src/App.tsx:201-202` — "Null until the API answers, and after a failed read, which shows no alert" → "Null until the API answers, and after a failed first read, which shows no alert; a failed read after a reset keeps the answer on view."
- `apps/web/test/web.test.ts:940-941` — see `pre-pr-review-1.md` finding 7.
- `README.md:81` — the webhook paragraph omits one outcome → add after "...so a repeated delivery sends nothing.": "A newly recorded tip whose session carries no amount or currency sends no event and reports to GlitchTip with the Checkout Session ID."
- `README.md:81` — "whatever its payment or `client_reference_id`" → "whatever its payment status or `client_reference_id`".
- `apps/api/src/routes/stripe-events.ts:11-12` — "A session from any Payment Link but the Stillstats one is another product's sale" → "A session from any Payment Link but the Stillstats one, or from none, is another product's sale" (the code and `stripe-events.ts:40-41` cover `payment_link: null`).
- `apps/api/Dockerfile:48-49` — "with some but not all, or an ID that does not start with plink_, the API refuses to start" → "with some but not all, a URL that does not parse, or an ID that does not start with plink_, the API refuses to start" (`support.ts:29`).
- `docs/deploy.md:70` — "with some but not all, or an ID that does not start with `plink_`, the API refuses to start" → "with some but not all, a URL that does not parse, or an ID that does not start with `plink_`, the API refuses to start".

## Needs Further Investigation
Review 1's B to F stand unchanged; the delta touches none of them. A is closed (Prior-review closure). See `pre-pr-review-1.md` for each one's confirm-or-kill step.

## Reviewed and Dismissed
- The link check running before `payment_status` — both paths return `ignored`; the order is unobservable and matches the doc comment. Not a defect.
- Another link's session carrying a real creator's user ID reports nothing — the test at `stripe-events.test.ts:187-238` pins it on purpose: a future Stillstats Paid-tier Checkout would carry the user ID and must not report. Nick's decision in `e6c3a5e`. Do not add a report there.
- `support.ts:14-16`, "rather than ... take another product's sale for a tip" — read as the reason the ID is required at all (without it the webhook could only take every sale or none). Accurate enough; no entry.
- The shared session ID `cs_test_another_product` across the five `test.for` rows — each row goes red on its own under the drop-the-check mutation, so no state leaks between rows.
- Existing webhook tests still exercising a Stillstats session — they get the link from `checkoutSessionEvent`'s default (`apps/api/test/stripe.ts:40`); the URL-for-ID mutation turned 12 of them red.
- Empty env values — an empty `STRIPE_PAYMENT_LINK_ID` with the other two set refuses to start; all three empty means none. Same semantics as before.
- Review 1's and review 2's dismissals all stand.

## Minor / nits
- A configured ID that matches no real link is silent by design: a typo, a test-mode ID in a live deploy, or a link recreated with only its URL updated makes the webhook ignore every tip with 200 and no report, so the tipper keeps seeing the prompt. `support.ts:30` checks only the `plink_` prefix. #416's deployed tip check catches it at setup, and finding 7's added sentence covers the recreated-link case. Tightening to `/^plink_[A-Za-z0-9_]+$/` would catch a pasted trailing newline; Stripe's ID alphabet is not documented, so this is hardening, not a fix.
- The expanded-object branch in `paidTipOf` (`stripe-events.ts:47`) and its test at `stripe-events.test.ts:241-258` cover a state production cannot reach: Stripe's docs say "Objects sent in events are always in their minimal form." The branch exists for the `string | PaymentLink | null` type. Its surviving mutant (any expanded object accepted) has no user path. Keep the branch; a negative expanded row is optional.
- `support.test.ts:31-45` splits one rule ("some but not all set refuses to start, naming all three") across two `test.for` blocks, "only %s set" and "all but %s set". Both go red when broken; merging them is structure only.

## Test quality
Tests added in the delta: 13 (5 "another link / no link" rows, 1 expanded-object test, 1 "all but %s" block of 3, 1 "not a plink_ ID" block of 3, and the renamed "only %s" block gained a row). Each reachable mutation turns at least one red (table above). Every new test asserts behaviour (status, the creator's prompt, GlitchTip reports, OpenPanel's received list, or a thrown message), none asserts fixed copy beyond the env names, and none computes its own expectation. Tautology shapes found: none. Review 1's test-quality findings (4, 5, 6 here) are carried forward.

## Before opening the PR
- **CI readiness:** lint, typecheck, build, the full suite and the browser walk are green at `e6c3a5e`.
- **Commit hygiene:** nothing to drop. This doc is committed as `creator-analytics#338 pre-PR review 3`; no repro was needed.
- **Likely reviewer asks:** the issue text for #416 (finding 1); the copy-test question (review 1 D); #416's deployed check, which is now also the check that the configured `plink_` ID is the right one.

## Verdict
**Ready to open the PR, with follow-ups.** No CRITICAL, HIGH or MEDIUM finding is open, and no prior MEDIUM-or-higher finding is open. The delta, Nick's answer to review 1's Needs Further Investigation A, is correct and well pinned by tests. One new LOW sits outside the repo: #416 and the epic's spec still name two settings, and the #416 body should be edited before that ticket is worked, because following it as written leaves the API refusing to start. The other new items are four comment-wording entries. The seven LOWs from review 2 are carried forward untouched. The confirmed list grew by one real item and some wording, which is what a converging branch looks like after a small feature change.
