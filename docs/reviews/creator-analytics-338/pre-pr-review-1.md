# Pre-PR review: creator-analytics#338 Pay what you want: a support button for Stillstats

**Branch:** `creator-analytics-338-support-button` vs `origin/main` (merge-base `4c032ab` "Merge pull request #409 from nick-vogel/creator-analytics-359-tanstack-charts")
**Reviewed at:** HEAD `247541d` ("creator-analytics#415 Support: a tip's amount reaches OpenPanel"). The tree was clean, with no uncommitted or untracked files at review time. 50 files, +5,292 / −91 against the merge-base (about 2,000 of the added lines are the two drizzle snapshot JSON files). The branch carries #411 (`8134e1f`, `4ba7f1a`), #412 (`018f3c7`, `6a54041`, `b6976a2`, `0b5fb40`), #413 (`b63402a`, `9fe5669`), #414 (`461525d`, `7be4607`, `75e1a22`) and #415 (`20cf309`, `247541d`). #416 (the manual Stripe setup and the deployed check) is not on the branch.
**Reviewed against:** the epic body of creator-analytics#338 (End state, Implementation Decisions and Testing Decisions are the spec), `CODING_STANDARDS.md` 1 to 3, ADR 0015, and the assumptions the loop recorded for #411 to #415. No prior review doc for this epic. A full review (`--fresh`).
**Date:** 2026-11-04
**Reviewer:** 3 code-review agents, 1 test-oracle agent, and a verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | added 1 package (`stripe`): the integration worktree's `node_modules` was stale after the lane merges. Before the install, `pnpm typecheck` failed with `Cannot find module 'stripe'`; after it, green |
| Lint | `pnpm lint` | pass, 551 files |
| Typecheck | `pnpm typecheck` | pass |
| Build | `pnpm build` | pass |
| Full suite | `pnpm test` (Docker up, Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | 127 files, 2,842 passed, 1 expected fail, first run |
| Browser walk | `pnpm run --if-present test:browser` | pass: 30 steps, no content security policy violation. JS 748.7 kB / 243.1 kB gzip, CSS 30.7 kB / 7.2 kB gzip |
| Raw body and signature | `routes/stripe-events.ts`, `stripe-events.ts`, `app.ts` middleware, stripe@23.1.0 `Webhooks.js` (agent) | the raw text is the first read of the body; `constructEvent` with the default 300 s tolerance; a missing header becomes `''` and a `StripeSignatureVerificationError` (400); any other throw goes to `onError` (500) |
| Idempotent insert in the anonymous scope | a throwaway PostgreSQL 17.6 cluster outside the worktree, with the branch's policies and FORCE RLS (agent) | a target-less `ON CONFLICT DO NOTHING` on a duplicate gives rowCount 0 and no error; a targeted one and `RETURNING` both raise the RLS error, as `tips.ts`'s comment says; two concurrent deliveries of one session give one `recorded` and one `repeated` |
| Cascade on "Delete me" | the same cluster (agent) | deleting a `users` row removes that user's tips and no other user's |
| Server event carries no UA, IP or profile id | `event-relay.ts` `sendServerEvent`, and `stripe-events.test.ts:219-262` | no `user-agent`, `openpanel-client-ip` or `x-client-ip` header is set; the body is `{type, payload: {name, properties: {amount, currency}}}` |
| Stripe stays out of the browser | `git grep stripe` over `apps/web`, `apps/site`, `apps/api/package.json` (agent) | `stripe` is a dependency of `apps/api` only; no Stripe origin in the web app or the site |
| No em-dash, no "donat" | grep of the diff's added lines; both "donat" scans mutated at base by planting "donate" in `privacy.html` and `video-step.ts` (oracle agent) | no em-dash added; both scans go red on a plant |
| Tests green at `$BASE` | scratch worktree at `4c032ab`, the branch's 9 changed test files plus `apps/api/test/start-api.ts` and `apps/api/test/stripe.ts` copied in (oracle agent) | new files red (they import code base lacks); green at base: the two "donat" guards (rules, kept), two preference refusal rows (guarded by the positive save test, dismissed below), the signed-out support test (finding 5), and `sign-in.test.ts`'s exemption once `stripe` is stubbed |
| Finding 1 and 2 repro | `sh docs/reviews/creator-analytics-338/repro/support-ui-repro.sh <scratch-dir>` | both red at `247541d` |
| Recommended fixes for findings 1 and 2 | applied in a scratch worktree at HEAD, then `pnpm exec vitest run apps/web/src/app.test.ts apps/web/src/components.test.ts` and `pnpm exec biome check --write` on the two files | 269 passed, both repro tests green, biome clean |
| Real Stripe page, a real delivery, OpenPanel's handling of a server event, VoiceOver | not run | no Stripe account or deployed product in reach; #416 is the human check (Needs Further Investigation A and C) |

**Overall:** The feature holds end to end. The webhook verifies the signature on the raw body, records a tip once per Checkout Session in the anonymous scope under an insert-only policy, sends `support_tip_completed` only for a newly recorded tip and only after the commit, and carries no account ID, user agent or IP. The support answer, the dismissal, the sidebar item, the profile section, the thanks line and the policy pages all do what the spec asks, and all five full checks are green on the first run. No finding is above MEDIUM. The one MEDIUM is that "Hide" drops a keyboard user's focus to the page body. The rest are LOW: the sidebar can still ask for a tip beside the thanks line, four fallback paths have no test, the site tests include a whole-sentence copy test, deploy.md misses the Payment Link's return address, and some test and comment hygiene. The PR can open after finding 1, and the LOWs can be remediated in the same pass or carried as follow-ups.

## Approach decisions
- Webhook scope: the anonymous scope with the insert-only `tips_anonymous_insert` policy, and the Checkout Session ID as the primary key with a target-less `ON CONFLICT DO NOTHING` (#414 assumptions). Verified on PostgreSQL 17.6 here; not reopened.
- A write failure in the webhook answers 500 through `onError`, so Stripe delivers again (#414). Finding 3 adds the missing test and keeps the mechanism.
- Server events go through `sendServerEvent`, which takes no client (#415). Not reopened.
- `support=thanks` is read once in App before `useRoute` drops it from the address (#411). Finding 2 reuses that one read to hide the sidebar item for the page load; it does not add a second read.
- Sidebar visibility is `sidebarSupportLinkOf(support, saved)` (#413). Finding 2 gates its result in App rather than changing the function's signature.
- Focus after a control removes itself: focus the nearest stable container, made focusable with `tabIndex={-1}`, as `VideoStepper.tsx:96` and `:104` do for its retry button. Finding 1 follows it.
- A failing database in an API test: `startApiWithUnreadableDatabase` in `apps/api/src/app.test.ts:13-17` (a pool on `postgres://nobody@127.0.0.1:1/none`). Finding 3's webhook 500 test follows it.

## Confirmed Issues

### 1. Pressing "Hide" on the sidebar's support item drops keyboard focus to the page body — MEDIUM
- **Location:** `apps/web/src/Sidebar.tsx:26`, `:40-50`; `apps/web/src/App.tsx:436-439`
- **Attribution:** introduced by #413 (`b63402a`, "creator-analytics#413 Support: the sidebar item and its Hide control"). At `$BASE` the sidebar has no removable control.
- **Real-world trigger:** a keyboard or screen-reader creator tabs to "Hide" and presses Enter or Space. User story 24 asks for exactly this path. The item unmounts with the focused button inside it, and the next Tab starts from the top of the document.

**Evidence**
```tsx
    <nav className="sidebar">
      ...
      {supportLink !== null && (
        <div className="sidebar-support">
          ...
          <button type="button" aria-label={hideSupportLabel} onClick={onHideSupport}>
```
`hideSupport` in App saves `{ supportPromptDismissed: true }`, which makes `sidebarSupportLinkOf` return null in the same render, so the whole `.sidebar-support` div unmounts.

**Failure mode** — Executed: the repro test focuses the Hide button, clicks it, and asserts that the focused element is connected and inside `nav.sidebar`. At `247541d` it fails with `{ connected: true, inSidebar: false }`: focus is on `<body>`. A failed save brings the item back, and focus does not return either.

**Recommended fix**
```diff
--- a/apps/web/src/Sidebar.tsx
+++ b/apps/web/src/Sidebar.tsx
@@
+import { useRef } from 'react'
 import { RouteLink } from './RouteLink.tsx'
@@
 }) {
+  const nav = useRef<HTMLElement>(null)
   return (
-    <nav className="sidebar">
+    <nav className="sidebar" ref={nav} tabIndex={-1}>
@@
-          <button type="button" aria-label={hideSupportLabel} onClick={onHideSupport}>
+          <button
+            type="button"
+            aria-label={hideSupportLabel}
+            onClick={() => {
+              nav.current?.focus()
+              onHideSupport()
+            }}
+          >
             {hideSupportText}
           </button>
```
Then add a test to `describe("the sidebar's support item")` in `apps/web/src/app.test.ts`, from the repro's first test: after a click on Hide, `document.activeElement` is connected and inside `nav.sidebar`.

**Remediation brief**
- **Design intent:** the sidebar is the one piece of chrome that stays on screen across routes. Its doc comment already relies on that for focus ("A followed link keeps focus: the sidebar stays on screen"). When a control inside it removes itself, focus belongs on the sidebar, so the next Tab continues from there. The in-repo precedent is `VideoStepper.tsx:96` and `:104`: when the retry button goes away, its `nav` (with `tabIndex={-1}`) takes focus.
- **Full surface:** `apps/web/src/Sidebar.tsx:1` (import), `:24` (the ref), `:26` (`ref` and `tabIndex`), `:45` (the Hide `onClick`). Nothing in App changes: `hideSupport` stays as it is. Update the Sidebar's doc comment at `Sidebar.tsx:6-10` to say that Hide leaves focus on the sidebar.
- **Must preserve:** Hide's single `PUT /api/me/preferences` with `{ supportPromptDismissed: true }`, the immediate removal, and the one `support_prompt_dismissed` track call (`app.test.ts` "\"Hide\" sends the dismissal, removes the item at once and tracks support_prompt_dismissed"). The failed save's revert and notice ("a failed save of \"Hide\" brings the item back with the failed save's notice"). The `nav.sidebar` selector the tests and the walk use (`sidebarIn` in `app.test.ts:2866`, the walk's `sidebarSupportItem`). The route links' own focus behaviour. A `tabIndex={-1}` nav is not in the tab order, so Tab order does not change.
- **Do not touch:** `sidebarSupportLinkOf`'s rule (link, prompt, saved dismissal), which is a recorded decision. Finding 2's change to App's `sidebarSupportLink` is separate and must not be folded into this commit.
- **Proof:** `sh docs/reviews/creator-analytics-338/repro/support-ui-repro.sh <scratch-dir>`: test "finding 1: focus stays inside the sidebar after \"Hide\"" is red now and green after the fix. The fix was applied in a scratch worktree at `247541d`, and all 269 tests in `apps/web/src/app.test.ts` and `apps/web/src/components.test.ts` stayed green. After the fix, run `pnpm run --if-present test:browser` too, since the walk visits the sidebar at both widths.

### 2. Stripe's return can show the sidebar's support item right beside the thanks line — LOW
- **Location:** `apps/web/src/App.tsx:283`
- **Attribution:** introduced. The thanks line came with #411 (`8134e1f`) and the sidebar item with #413 (`b63402a`), and neither knows about the other.
- **Real-world trigger:** a creator tips, and Stripe redirects to `/app/profile?support=thanks`. The app reads `GET /api/me/support` as soon as it loads. Stripe does not guarantee that the webhook lands before the redirect, and the spec's own story 16 assumes it may not. If the read wins, the answer still says `prompt: true`, and the sidebar shows "Support Stillstats" with "Hide" next to "Thank you for supporting Stillstats." until the next page load. User story 6 says a creator who has tipped should not be asked again. The severity is capped at LOW: it is one page view, and the next load reads the tip.

**Evidence**
```tsx
  const sidebarSupportLink = sidebarSupportLinkOf(support, saved ?? {})
```
`supportThanks` (`App.tsx:269`) is only passed to `Profile`.

**Failure mode** — Executed: the repro test renders `profile?support=thanks` with a support answer of `{ link, prompt: true }`, which is the state before the webhook lands. At `247541d` it gets `{ thanks: true, sidebarPrompt: true }`.

**Recommended fix**
```diff
-  const sidebarSupportLink = sidebarSupportLinkOf(support, saved ?? {})
+  const sidebarSupportLink = supportThanks ? null : sidebarSupportLinkOf(support, saved ?? {})
```
Then add a test to `describe("the sidebar's support item")`, from the repro's second test.

**Remediation brief**
- **Design intent:** Stripe's return is the app's one signal that a tip just happened, and the server may not know yet. For that page load the app trusts the signal. The thanks line already does, by design ("It does not wait for the webhook"). The sidebar item should do the same, so the product never asks a creator who has just paid. `supportThanks` lives in a `useState` for the page session, so the item stays hidden until the next load. By then the webhook has normally recorded the tip, and the server's answer takes over.
- **Full surface:** `apps/web/src/App.tsx:283`, plus the comment on the `supportThanks` state at `App.tsx:268`, which should say it also hides the sidebar item.
- **Must preserve:** the profile's support section, which reads `support?.link` (`App.tsx` `supportLink={support?.link ?? null}`), not `sidebarSupportLink`, so it still shows after a tip. The thanks-line test (`'%s the thanks line for the address %o'`). Hide and the failed-save revert, which go through `saved`.
- **Do not touch:** `sidebarSupportLinkOf` in `apps/web/src/support.ts` and its doc. The "read once before `useRoute`" decision.
- **Proof:** `sh docs/reviews/creator-analytics-338/repro/support-ui-repro.sh <scratch-dir>`: test "finding 2: Stripe's return shows no sidebar prompt beside the thanks line, before the webhook lands" is red now and green after the fix (verified in a scratch worktree at `247541d`, with the 269 web tests green).

### 3. Four fallback paths have no test — LOW
- **Location:** `apps/web/src/App.tsx:312`, `apps/web/src/App.tsx:425`, `apps/api/src/routes/support.ts:26-29`, `apps/api/src/routes/stripe-events.ts:44-47`
- **Attribution:** introduced by #411, #413 and #414. The binding rule is "a test for every fallback path".
- **Real-world trigger:** none of these is broken today. The gap is that a regression in any of them ships silently. Capped at LOW: a coverage claim with no user path. It would go to MEDIUM if a regression appeared on the webhook path, since that is money.

**Evidence** — I found no test for any of these four by `grep -n "me/support" apps/web/src/app.test.ts` (one hit, an ordering assertion at `:3610`), `grep -rn "client_reference_id rule" apps/api/src/*.test.ts` (only the regex unit test at `support.test.ts:45` and the Better Auth ID check at `:107`), and `grep -n 500 apps/api/src/stripe-events.test.ts` (only OpenPanel's `answerWith(500)`).
- (a) `readSupport().then(setSupport, () => setSupport(null))`: a failed first read shows no support UI and no alert.
- (b) `readSupport().then(setSupport, () => {})` after a reset: a failed reload keeps the answer on view, so the profile section stays.
- (c) The route's ID-rule breach: answers `{ link: null, prompt: false }` and reports with no ID.
- (d) A write that throws in the webhook answers 500 (the recorded decision), so Stripe retries, and no event goes out.

**Failure mode** — for example, if (a)'s rejection handler were dropped, the first failed read would reach the app's unhandled-rejection path, and nothing would go red.

**Recommended fix** — one test each, at the seam the neighbouring tests use:
- (a) and (b) in `apps/web/src/app.test.ts`, `describe("the profile's support section")` or the sidebar block: fail `GET /api/me/support` through the fake API's `hold(route)` failure, as the existing failed-read tests do. Assert that no support link or section renders and no alert shows (a). After a successful first read and a Reset whose support reload fails, assert that the profile section is still there (b).
- (c) in `apps/api/src/support.test.ts`: drive `GET /api/me/support` for a signed-in user whose ID breaks the rule, through the same `startApi(web, { stripe })` helper. If no fixture can create such a user, call `supportRoute` on a bare `Hono<SignedIn>` with a `user` set and the recording reporter. Assert the answer, and that `reporter.reports` holds the message with no context.
- (d) in `apps/api/src/stripe-events.test.ts`: start the API on an unreadable pool, as `startApiWithUnreadableDatabase` does in `apps/api/src/app.test.ts:13-17`, but with `{ stripe }`. Post a correctly signed paid session. Assert a 500 and that the fake OpenPanel received nothing.

**Remediation brief**
- **Design intent:** support is optional in the web app. A failed read never alerts, and a failed reload never takes away what is on view (#411, #413 assumptions). In the API, the breach branch exists because Stripe silently drops a bad `client_reference_id`, and the 500 exists so that Stripe's retry eventually records the tip.
- **Full surface:** the four test files named above. No production code changes.
- **Must preserve:** all existing support, sidebar and webhook tests. The webhook test file's `Limits` header.
- **Do not touch:** the recorded decisions behind each branch.
- **Proof:** each new test, run red by deleting the branch it pins in a scratch worktree (for example, replace `() => setSupport(null)` with nothing for (a)), then green at HEAD: `pnpm exec vitest run apps/web/src/app.test.ts apps/api/src/support.test.ts apps/api/src/stripe-events.test.ts`.

### 4. The privacy policy's analytics test is a whole-sentence copy test, against its own Limits comment — LOW
- **Location:** `apps/site/test/site.test.ts:1041-1045`; the Limits comment at `apps/site/test/site.test.ts:964-972`
- **Attribution:** introduced by #412 (`018f3c7`). The #412 assumptions say this review might raise it.
- **Real-world trigger:** none for a creator. The test goes red when Nick edits the sentence and never when the code changes. Capped at LOW.

**Evidence**
```ts
  test("the privacy policy's analytics section says what a tip event carries", async ({ web }) => {
    const text = textOf(sectionOf(await privacyMain(web), 'Product analytics and error reports'))

    expect(text).toContain('A tip event carries the amount and currency, and no account ID.')
  })
```
The describe's Limits comment says these tests "hold the facts each disclosure names, inside its own section, not its sentences". This one holds the sentence. `CODING_STANDARDS.md` 2: "No test asserts that fixed copy is present ... Write no new one, and delete an existing one on sight." The spec's Testing Decisions ask for "The analytics section carries the tip event sentence". Where the spec and the standard disagree, this review follows the standard for a test that is nothing but the sentence. The phrase-list tests beside it are left for Nick (Needs Further Investigation D).

**Recommended fix** — delete the test at `:1041-1045`, and in the Limits comment at `:964-968` drop "the tip event in the analytics section," from the list of disclosures these tests prove. The sentence then rests on Nick's copy approval on #338, like the rest of the wording.

**Remediation brief**
- **Design intent:** site tests read the built pages and prove only rules that come from outside the copy: links, hosts from the manifest, and, for the tip, facts the code makes true.
- **Full surface:** `apps/site/test/site.test.ts:964-968` and `:1041-1045`.
- **Must preserve:** the test at `:1029-1039` (`6a54041`, #412 review pass 1 finding 1's proof), the terms test's `/not count toward a paid tier/i` entry (`b6976a2`, finding 2's proof), and both "donat" scans.
- **Do not touch:** the policy text itself.
- **Proof:** `pnpm exec vitest run apps/site/test/site.test.ts` stays green with one test fewer, and `grep -n "A tip event carries" apps/site/test/site.test.ts` prints nothing.

### 5. Duplicate and overclaiming tests — LOW
- **Location:** `apps/api/src/stripe-events.test.ts:261-262`, `:72`; `apps/api/src/support.test.ts:87-96`; `apps/web/src/app.test.ts:3524-3532`; `packages/database/test/tips.test.ts:39`
- **Attribution:** introduced by #411, #413 and #414. None of these tests came from a review finding (`git log -S` traced each to its feature commit: `8134e1f`, `b63402a`, `461525d`).
- **Real-world trigger:** none. `CODING_STANDARDS.md` 2 ("One rule, one test"; a test's name says which rule it states).

**Evidence and fix, one line each**
- `stripe-events.test.ts:261-262`: `expect(sent?.body).toHaveProperty('payload')` and `.not.toHaveProperty('payload.profileId')` duplicate the exact-body `toEqual` at `:219-235`, whose own comment says it proves no profile id. Delete the two lines and keep the header checks at `:258-260`.
- `support.test.ts:87-96`, "a signed-out request is refused": it passes at `$BASE` in substance, because any `/api/me/*` answers 401 there. `sign-in.test.ts`'s route inventory already sweeps `GET /api/me/support` for a 401, since it starts its API with `{ stripe: testStripe }`. Delete it.
- `app.test.ts:3524-3532`, "is absent for a creator with no channel": `expect(container.textContent).not.toContain(hideSupportText)` checks the bare word "Hide", which any unrelated control would trip, and the sidebar-null assertion repeats existing sidebar tests. Replace the text check with `expect(container.querySelector(\`a[href="${link}"]\`)).toBeNull()`, so the test states its own rule: no tip link for a creator with no channel.
- `stripe-events.test.ts:72`, "the same delivery again answers 200 and changes nothing": the prompt was already off, so it shows only that a repeat does not 500. The OpenPanel count test at `:265` holds "changes nothing". Rename it to "the same delivery again, and a second session, answer 200".
- `tips.test.ts:39`, "a second tip with the same Checkout Session ID is refused, and ...": nothing shows a plain insert being refused. Drop "is refused, and" from the name, or add a plain-insert assertion that expects the unique violation.

**Remediation brief**
- **Design intent:** one rule, one test, and a name that says the rule.
- **Full surface:** the five sites above.
- **Must preserve:** the exact-body test at `stripe-events.test.ts:219-235`, the header assertions at `:258-260`, the route inventory in `sign-in.test.ts`, and the "is absent while the sidebar shows when %s" rows.
- **Do not touch:** the preference refusal rows at `preferences.test.ts:99-104` (Reviewed and Dismissed).
- **Proof:** `pnpm exec vitest run apps/api/src/stripe-events.test.ts apps/api/src/support.test.ts apps/web/src/app.test.ts packages/database/test/tips.test.ts` green.

### 6. deploy.md's origin list misses the Payment Link's return address — LOW
- **Location:** `docs/deploy.md:77`, `:84`
- **Attribution:** introduced by #414 (`461525d`), which added the Stripe bullet.
- **Real-world trigger:** a domain change, or recreating the Payment Link. `deploy.md:77` says "Every setting below names that origin, so a domain change touches each of them", but the Payment Link's after-completion redirect, `https://stillstats.com/app/profile?support=thanks`, names the origin and is not listed. A maintainer following the list loses the thanks line without any error. #416's body names the redirect, but #416 is a one-off ticket, not the deploy reference.

**Evidence** — `docs/deploy.md:84`: "Stripe: the webhook endpoint is `https://stillstats.com/api/stripe/events`, listening for `checkout.session.completed` only. Its signing secret is the API's `STRIPE_WEBHOOK_SECRET`." `git grep -n "support=thanks"` finds only `browser-walk.ts:390` and `app.test.ts:3470`.

**Recommended fix** — extend the bullet at `docs/deploy.md:84`: "The Payment Link sells the Support Stillstats price (customer chooses, USD, preset $5, minimum $3, maximum $500), card payments only, and after payment redirects to `https://stillstats.com/app/profile?support=thanks`."

**Remediation brief**
- **Design intent:** deploy.md is the list of every external setting that names the origin. The redirect is one of them, and the card-only rule is what lets the webhook ignore delayed payments.
- **Full surface:** `docs/deploy.md:84`.
- **Must preserve:** the webhook endpoint and secret sentence, and the env line at `:70`.
- **Do not touch:** the README's webhook paragraph, except as comment hygiene below.
- **Proof:** `grep -n "support=thanks" docs/deploy.md` prints the bullet.

### 7. Comment hygiene — LOW (aggregated)
- `apps/web/src/Profile.tsx:32-36` — the doc comment is a 160-character line, never mentions the thanks line, and its inserted clause makes the channel actions read as part of the account → rewrap at 100 and restate in render order: "The thanks line under the heading after Stripe's return; the creator's channels, each by its name on YouTube, with disconnect and revenue consent; the Support section when the support answer has a link; and the account: the currency revenue shows in, connect, reset of the preferences, sign-out and delete. While the channels are read, their place holds a placeholder, until the read fails."
- `apps/web/src/App.tsx:201-202` — "Null until the API answers, and after a failed read, which shows no alert" → "Null until the API answers, and after a failed first read, which shows no alert; a failed read after a reset keeps the answer on view."
- `apps/web/test/web.test.ts:940-941` — "The fonts' licence is third-party legal text the creator never sees, so the scan skips it." → "The scan reads no stylesheet and no other served file, so the fonts' licence and any CSS `content` string are not read."
- `README.md:81` — the webhook paragraph omits one outcome → add after "...sends `support_tip_completed` ...": "A newly recorded tip whose session carries no amount or currency sends no event and reports to GlitchTip with the Checkout Session ID."

## Needs Further Investigation

### A. Every Checkout Session on the LLC's Stripe account reaches this webhook — whether the account sells anything else
`paidTipOf` (`apps/api/src/stripe-events.ts:39-53`) treats any paid `checkout.session.completed` as a tip. It never checks `session.payment_link` against the Support Stillstats link. The spec puts Stillstats on "the LLC's existing Stripe account". If that account sells anything else through Checkout or Payment Links, each sale reports "A paid Stripe Checkout Session carries no client_reference_id" to GlitchTip. A future Stillstats Checkout for the Paid tier, carrying the user ID as `client_reference_id`, would be recorded as a tip and send `support_tip_completed` with its amount. That would be a wrong sum delivered silently, and would rate MEDIUM. Confirm: Stripe dashboard → Payment Links and Payments, filtered to Checkout, for any source other than the Support Stillstats link. If there is one, the fix is to compare `session.payment_link` with the link's `plink_` ID, which needs a third setting or a lookup.

### B. The browser walk's support steps never wait for the support answer
`browser-walk.ts:390-400` and `:1925-1934` call `control()` right after `ready()`. `control()` makes one `Accessibility.queryAXTree` with no retry, and `readyCheck` (`:159-164`) waits on the screen landing, not on `GET /api/me/support`. The stub answers synchronously and the walk passed, so this would be a rare flake, not a defect. Confirm: delay the stub's `/api/me/support` answer by 500 ms in a scratch worktree and run `pnpm test:browser`. If it goes red, wait with `waitFor` on the support link's `href` before each `control()`.

### C. OpenPanel's handling of a server event with Node's default user agent
`sendServerEvent` sends no `user-agent`, so Node's fetch sends `node`. The #415 assumption cites OpenPanel's parser (`packages/shared/src/server/parser-user-agent.ts`) as filing it as a server event. No test here observes OpenPanel. #416's deployed check ("`support_tip_completed` shows in OpenPanel with the amount") settles it.

### D. The sharing-section and terms phrase lists: spec-required disclosures or copy tests
`site.test.ts:1017-1027` (`['Stripe', "Stripe's page", 'account ID', 'tip']`) and `:1055-1070` (seven regexes over the tip clause's words) hold the source's own phrases. Under `CODING_STANDARDS.md` 2 they are copy tests. The spec's Testing Decisions ask for both. Nick decides. If the standard wins, keep the `b6976a2` paid-tier entry and the `6a54041` test, and derive "Stripe" from `apps/api/package.json`'s dependencies, the way the Studio test derives hosts from the manifest.

### E. What Stripe receives when the creator opens its page
The sharing section lists the account ID and what the creator types. Opening Stripe's page also gives Stripe the browser's IP address, user agent and its own fraud signals. This is Nick's copy call: a pointer to Stripe's privacy policy would cover it.

### F. A failed webhook write's error text may carry the `client_reference_id` to GlitchTip
drizzle-orm 0.45.3's `DrizzleQueryError` message includes `params: ...`, and for `recordTip`'s queries that is the user ID. `scrubException` masks tokens, YouTube IDs, query strings and numbers, not a Better Auth ID. This contradicts the route's doc ("never the reference it carries") on the 500 path only. The same holds for every route's failed query, so it is pre-existing and systemic. Confirm by sending a failing query through `errorTrackingReporter`'s scrub, for example with finding 3 (d)'s unreadable-pool test plus a check of the scrubbed event. Follow-up ticket material either way.

## Reviewed and Dismissed
- `tips_web_delete` lets a user scope delete its own tip, and the cascade does not need it — a recorded #414 decision (house pattern `ownRowsPolicies`); no caller deletes tips. Do not remove it in remediation.
- The race between the user-existence `SELECT` and the `INSERT` in `recordTip` — a recorded #414 decision. The FK error answers 500, and Stripe's retry ends as `no_user`.
- Delayed payment methods (`checkout.session.async_payment_succeeded`) are never handled — the spec makes the Payment Link card-only, and finding 6 documents it.
- `c.req.text()` buffers an unlimited body before the HMAC check — the same as the RISC receiver on `$BASE`, pre-existing and untouched.
- The preference refusal rows at `preferences.test.ts:99-104` pass at `$BASE` — on the branch they go red if the validator ever accepts `false` or a time. The positive save of `true` is in "every value the shared types allow is saved and read back", which is red at base. Keep them.
- The privacy policy says Stripe receives the account ID "even if you do not pay", not the spec's "only when the creator chooses to tip" — deliberate and true. `supportLinkOf` puts the ID on the link itself (`6a54041`, #412 review pass 1 finding 1).
- "It stores only the fact of the tip" — the spec's approved wording; the Checkout Session ID is an opaque key.
- A late first support read overwriting the read after a Reset — the creator would have to confirm Reset inside the first read's latency. Not attainable in practice.
- `sign-in.test.ts:296`'s `'POST /api/stripe/events'` exemption would pass even if stale — an allow-list, as the other entries are; the route exists on the branch.
- The walk's stub ignores a dismissal — the walk never clicks Hide (a recorded #413 decision), and the web app hides the item from `saved` anyway.
- The support item can flash for a creator with no channel while channels load — the sidebar itself does the same on `$BASE` (`sidebarShown` while `channels === null`).

## Minor / nits
- The thanks line shows on every visit to the profile for the rest of the page session, since `supportThanks` is never cleared. Harmless, and finding 2 relies on that persistence.
- `apps/api/src/preferences.ts:62` stamps the dismissal with `sql\`now()\``, where `recordTip` uses the scope's pinned `tx.now`. Same value in practice.
- `supportSettingsOf` accepts any URL scheme for `STRIPE_PAYMENT_LINK_URL`. The value is operator-set; requiring `https:` would be cheap hardening.
- `supportLinkOf` keeps a `prefilled_email` already on the configured link. That is operator-set too, not the creator's email.
- `supportSurfaces` in `apps/web/src/support.ts:20` exists only to derive `SupportSurface`.
- The sidebar's support link has no underline (`.sidebar a`), and the Hide button does. Not checked visually.

## Test quality
Tests added or changed: 9 files. Green at `$BASE`: the two "donat" scans (rules from Stripe's charity rule, which go red on a plant, so keep them), the two preference refusal rows (keep, see Dismissed), the signed-out support test (finding 5), `sign-in.test.ts` once `stripe` is stubbed (allow-list, dismissed), and four absence tests in `app.test.ts` that hold at base only because the feature is absent (each guards a real condition on the branch, so keep them). Tautology shapes found: no self-computed expectations, no mocked unit under test, no call-shaped-only assertions, no unread snapshots, and no assertion-free tests. The `tips.test.ts` queries run as real scopes against fixture rows. Copy tests: one plain one (finding 4) and two phrase lists (Needs Further Investigation D). Duplicates and overclaiming names: finding 5. Fallback paths with no test: finding 3.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and the full suite are green at `247541d` after `pnpm install --frozen-lockfile`. The browser walk is green.
- **Commit hygiene:** nothing to drop. This doc and `repro/` are committed as `creator-analytics#338 pre-PR review 1`.
- **Likely reviewer asks:** whether the LLC's Stripe account sells anything else (A); the copy-test question (D); #416's deployed check covers the real Stripe page, the redirect, and OpenPanel.

## Verdict
**Ready with follow-ups.** Fix finding 1 (focus after Hide) before the PR opens: it is a real keyboard path the spec names. Findings 2 to 7 are LOW. They can be remediated in the same pass or carried as follow-up tickets. No finding is a CRITICAL or a HIGH. Needs Further Investigation A needs one look at the Stripe dashboard before #416 goes live.

## Remediation — 2026-11-04
Scope: CRITICAL, HIGH and MEDIUM, the default. The doc holds one MEDIUM (finding 1) and no CRITICAL or HIGH. Findings 2 to 7 are LOW and deliberately deferred to Nick (eng-pipeline#34).

| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 1 (MEDIUM) | `b320c2e` creator-analytics#338 pre-PR review 1 finding 1: pressing "Hide" on the sidebar support item drops keyboard focus to the page body | red→green: `pnpm exec vitest run apps/web/src/app.test.ts -t 'leaves focus on the sidebar'` (red at `247541d`, focus on `<body>`), and the repro's finding 1 test green at `b320c2e` via `sh docs/reviews/creator-analytics-338/repro/support-ui-repro.sh <scratch-dir>` | 0 (the gate prints the two lines of the Sidebar doc comment the brief asked to update) | proved by execution: `apps/web/src/app.test.ts` and `apps/web/src/components.test.ts` 268 passed; `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` (127 files, 2,843 passed, 1 expected fail) and `pnpm run --if-present test:browser` (30 steps, no CSP violation) green at `b320c2e` |
| 2 (LOW) | — deferred | repro test still red at `b320c2e`, as expected | — | LOW tail, not worked |
| 3 (LOW) | — deferred | — | — | LOW tail, not worked |
| 4 (LOW) | — deferred | — | — | LOW tail, not worked |
| 5 (LOW) | — deferred | — | — | LOW tail, not worked |
| 6 (LOW) | — deferred | — | — | LOW tail, not worked |
| 7 (LOW, comment hygiene) | — deferred | — | — | LOW tail, not worked |

The new test is `"Hide" leaves focus on the sidebar` in `describe("the sidebar's support item")`, `apps/web/src/app.test.ts`. It asserts that `document.activeElement` is the sidebar's `nav` itself, which is stricter than the repro's "connected and inside the sidebar".

### Known regressions, deferred
- None. No verify agent ran: the only fix is MEDIUM, its proof was executed, and it touched no shared computation core.

### Rework briefs
- None. No rework pass was needed.

Approach decisions: unchanged. Finding 1 applied the recorded focus decision (`VideoStepper.tsx`'s `nav` with `tabIndex={-1}`) as written.
