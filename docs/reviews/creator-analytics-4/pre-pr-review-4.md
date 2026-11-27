# Pre-PR review: creator-analytics#4 Studio extension

**Branch:** `creator-analytics-4-studio-extension` vs `origin/main` (merge-base `5d4457d` "Merge pull request #193 from nick-vogel/creator-analytics-64-web-dashboard-metrics-profile")
**Reviewed at:** HEAD `b1b387c` ("creator-analytics#215 Studio extension: the five proven LOW findings from the seventh epic-loop run"), clean tree, no uncommitted or untracked files at review time. 131 files, +19,899 / −149 (7,965 of those lines are the saved Studio HTML fixtures, 1,095 are `pnpm-lock.yaml`, and about 1,250 are pre-PR reviews 1 to 3 with their `repro/`), 300 commits.
**Reviewed against:** epic nick-vogel/creator-analytics#4 (body as of 2026-10-14) and its sub-issues, with #213, #214 and #215 read in full; `CODING_STANDARDS.md`, `CONTEXT.md`, ADR 0008, `README.md`, `docs/deploy.md`; pre-PR reviews 1 to 3 (Approach decisions, dismissals, Minor, NFIs). Run with `--fresh`: the whole branch, with extra scrutiny on what landed since review 3 (`9a13d3b`, the HEAD review 3 read): review 3 Finding 4 (`34e5d8d`), #213 (first-run unhandled rejections), #214 (a time bound on every Google call) and #215 (review 3's Findings 1 to 3 and NFI A, plus a read made ahead of an unreported navigation).
**Date:** 2026-10-14
**Reviewer:** 3 code-review agents, 1 test-audit agent, and a verify pass

## What was verified and how

| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | green, lockfile unchanged |
| Lint | `pnpm lint` | green (438 files) |
| Typecheck | `pnpm typecheck` | green, every package |
| Build | `pnpm build` (writes both extension builds) | green |
| Full suite | `pnpm test` (Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | green: 105 files, 2,123 tests |
| Prior repro suite | `pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts` | review 1's 6 and review 3's 3 green, so review 3's Findings 1 to 3 hold fixed; this review's 2 red |
| Manifest permissions | Read the built `apps/extension/.output/{chrome,firefox}-mv3/manifest.json` | hold: host access to `https://studio.youtube.com/*` and `https://stillstats.com/*` only, no `permissions`; Firefox gecko id `@stillstats`, 140.0, `authenticationInfo` required and `technicalAndInteraction` optional |
| Em-dashes in shipped copy | `git diff 5d4457d -- apps/site apps/web apps/extension/src packages README.md CONTEXT.md docs/adr docs/deploy.md apps/api \| grep '^+.*—'` | none |
| "Ranking by views" in the extension | `grep -rni 'ranking by views' apps/extension/src` outside tests | none |
| #214: the bound reaches every Google call | Agent trace through installed googleapis-common 9.1.0, gaxios 7.3.1, google-auth-library 11.1.0 | holds: `timeout` merges into every request, `AbortSignal.timeout` covers fetch and body, `retry: false`, the OAuth client cannot refresh on its own (access token only); the vault's token and revocation fetches carry their own signal. A timed-out gaxios call has no `response`, so `call` logs it unanswered and refuses `google_failed` |
| #214: a token endpoint body that stalls (Finding 3) | Agent-executed node script: a server that writes headers and part of a JSON body, fetched with `AbortSignal.timeout(300)`, then `response.json()` | `DOMException TimeoutError`, not a `TokenEndpointUnansweredError`; script not preserved (see the brief's Proof) |
| #213: every catch has a red test | Agent mutations of a copy of `first-run.ts` against the real `first-run.test.ts`, and again by the test-audit agent | each catch removed turns its own tests red; a single outer try turns "still sends extension_installed" red |
| #215: fixes complete and without regressions | Agent C trace plus a scratch harness through WXT 0.21.4's own location watcher (`watchThroughWxt`) | items 1, 2, 3 and 5 hold; item 4's drop path has two defects (Findings 1, 2) and two untested branches (Finding 4) |
| Two navigates that never commit (Finding 1) | Executed: `repro/review-4.test.ts` "finding 1" | red at HEAD; green at `47fa235` (the parent of `bdd6be5`) |
| A navigate away from the Content list that never commits (Finding 2) | Executed: `repro/review-4.test.ts` "finding 2", real `contentList` on the saved Content list | red at HEAD (2 reads); green at `47fa235` |
| Recommended diff for Findings 1 and 2 | Applied in a scratch worktree at HEAD: `apps/extension` typecheck, biome, the repro suite, the extension suite, and the test-audit agent's two probe tests | green: repro 11/11, extension 353/353, probes 2/2; Finding 1's line alone turns only "finding 1" green |
| Tautology audit | Tests changed since `9a13d3b` copied into a scratch worktree at `9a13d3b` and run there; targeted mutations of HEAD; API and package tests changed since `5d4457d` run at `5d4457d` | 41 new or changed since `9a13d3b`: 36 red at runtime, 4 red only under `tsc` (a new `tabs` option), 1 green control case; all 5 green ones red under mutation. Two `watch.ts` branches survive every test (Finding 4). Details under Test quality |
| Live browsers (Chrome and Firefox, WXT's Navigation API dispatch, Studio's real redraw timing, whether Studio fires a `navigate` that never commits) | Not run: no browser in a review | NFIs; #99 / #101 |

**Repro command for every executed proof:** `pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts docs/reviews/creator-analytics-4/repro/review-4.test.ts` from the repo root. The repro files sit outside the root `vitest.config.ts` include pattern, so `pnpm test` stays green while they are red. This review added WXT's `server.deps.inline` patterns to `repro/repro.vitest.config.ts`, the same two the root config carries, because `watchThroughWxt` imports WXT's runtime modules.

**Overall:** All four CI checks pass, and #213, #214 and #215 each do what their issue asked, with tests that go red without the fix. This fresh whole-branch pass found no CRITICAL, HIGH or MEDIUM defect. It confirmed two LOW defects in #215's new drop path for a navigation that never commits (a duplicate shown event, and a needless re-read of the Content list), one LOW misclassification in #214's token endpoint bound, one test gap and one aggregated comment hygiene entry. The PR can open as it stands; Findings 1 and 2 share one small diff in `watch.ts`.

## Approach decisions
- **Analytics link window (review 1 F1):** the extension always writes `window` into the detail link, lifetime included. Unchanged.
- **Watch stop (review 1 F2, F3):** `stop()` removes every host through `removeSurface` and clears `again`; no `stopped` flag. Unchanged.
- **Give-up URL (review 1 F4, #210):** the give-up judges the navigation WXT reported, held in `nav`; a pass on a URL WXT has not reported yet places for the next navigation (`ahead`) and reports nothing. Unchanged.
- **Session cache (review 1 F5):** a 401 from any *read* forgets the kept channels and video reads, in `readSignedIn`. An event send is not a read and stays out of it.
- **Background answers (review 1 F6):** the rejection to failed-value mapping lives in `backgroundAnswerer`. Unchanged.
- **Hung reads (#211):** every background fetch carries `AbortSignal.timeout(answerWithinMs)`, 15 s by default.
- **Row sweep (review 3 F1, #215):** an optional synchronous `sweep(document)` on `Surface`, run from `schedulePass`'s timer outside the pass lock. Unchanged.
- **Comparison retry (review 3 F2, #215):** a card figure whose format read did not answer is kept like a line (`keptAs: 'placed'`). Unchanged.
- **Google call bound (#214):** one per-call bound, `googleCallTimeoutMs` (10 s), exported by `@creator-analytics/token-vault`: gaxios' `timeout` for the gateway's clients, `AbortSignal.timeout` for the vault's own fetches; a token endpoint that does not answer is a `TokenEndpointUnansweredError`, which the gateway's `read` maps to `google_failed`. Finding 3 keeps this mechanism and extends the classification to the body read.
- **Dropped navigation (#215 item 4, new here):** a navigation the page never reached is dropped at its give-up and the page on screen is judged as `previous` or as a fresh navigation. Findings 1 and 2 keep this mechanism: only a reached navigation may become `previous`, and each navigation record carries its own count, which is what a surface sees as `navigation`, while the watch's `navigation` counter stays the epoch that `current()` and in-flight passes compare against.

## Confirmed Issues

### 1. Two navigates that never commit inside one give-up report the unchanged page's surface shown a second time — LOW
- **Location:** `apps/extension/src/surfaces/watch.ts:279` (`previous = nav`), with `:249`
- **Attribution:** introduced by `bdd6be5` ("creator-analytics#215 A navigate that never commits stops being the watch's current navigation at the give-up"), which added `previous` and the drop. The repro is green at its parent `47fa235` and red at HEAD.
- **Real-world trigger:** under the Navigation API (Chrome), the creator triggers a `navigate` Studio cancels or that never commits (the Details editor's unsaved-changes prompt, an `<a download>`, a 204), then a second one within 5 s. Whether Studio fires such a navigate at all is unverified (#99). LOW, capped: telemetry only, and the trigger is unproven; it stays LOW even if #99 sees it, since a duplicate shown event misleads no creator.

**Evidence**
```ts
function navigated(to: string): void {
  navigation += 1
  previous = nav
  nav = freshNavigation(to, url() === to)
...
  nav = previous?.url === here ? previous : freshNavigation(here, true)
```

**Failure mode** — dashboard settled, card reported shown (nav1). A `navigate` to the Content list never commits (nav2, unreached). Within 5 s a `navigate` to `/comments` never commits either (nav3): `navigated` sets `previous = nav2`, the unreached one. At nav3's give-up the page is still the dashboard, `previous.url` is the Content list, so the watch makes `freshNavigation(dashboard)`, whose `shown` set is empty, and the settled pass reports `extension_surface_shown` for the card again. A surface judged missing on the dashboard would be reported missing again the same way. Executed: `repro/review-4.test.ts` "finding 1" receives `[[shown card], [shown card]]`.

**Recommended fix**
```diff
   function navigated(to: string): void {
     navigation += 1
-    previous = nav
+    if (nav?.reached || nav?.url === url()) previous = nav
```

**Remediation brief**
- **Design intent:** the watch reports each surface's shown and missing at most once per navigation the page actually showed (R12). `previous` exists so that dropping a navigation that never committed hands the page back to the record that already reported for it. It must therefore only ever hold a navigation the page reached. `nav.reached` is set when WXT reports a URL already in `location.href` (the poll path), or by a pass that finds the page there; under the Navigation API `navigate` fires before the URL moves, so at `navigated` time `url()` is still the outgoing page's URL, which is why `nav?.url === url()` also counts as reached.
- **Full surface:** `apps/extension/src/surfaces/watch.ts:279` only. `nav` is `undefined` on the very first `navigated(url())` call (`:293`), which the optional chains cover, leaving `previous` undefined as today. `giveUp` (`:246-253`) reads `previous` and needs no change for this finding.
- **Must preserve:** `watch.test.ts` describe "a Navigation API navigate that never commits, through WXT 0.21.4" (`:226`, three tests), the rest of `watch.test.ts`, and `content-list.test.ts`'s `test.each` on WXT's poll path; the whole extension suite (353 tests) passed with this line applied.
- **Do not touch:** the `nav.missing` dedupe and the `if (here === dropped) navigated(here)` re-entry, both correct (Reviewed and Dismissed); `ahead`'s stamp `navigationAtStart + 1`.
- **Proof:** `pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts docs/reviews/creator-analytics-4/repro/review-4.test.ts -t "finding 1"` is red now and must be green; move the test into `watch.test.ts` under the describe at `:226`.

### 2. A navigate away from the Content list that never commits makes the list read every row again — LOW
- **Location:** `apps/extension/src/surfaces/watch.ts:252` (`navigation += 1` at the drop) with `:185` (the count `place` sees) and `apps/extension/src/surfaces/content-list.ts:178-184`
- **Attribution:** introduced by `bdd6be5`, same commit as Finding 1; repro green at `47fa235`, red at HEAD.
- **Real-world trigger:** on the Content list under the Navigation API, a `navigate` that never commits (as Finding 1). Unproven that Studio fires one (#99). LOW: one extra video list request, and when that request fails, rows whose figures were showing switch to "Try again later".

**Evidence**
```ts
      // Passes still running were for the dropped navigation.
      navigation += 1
...
          navigation: ahead ? navigationAtStart + 1 : navigationAtStart,
...
      const answeredHere =
        answered?.navigation === navigation &&
```

**Failure mode** — the list is answered at navigation N. A `navigate` to `/comments` never commits (N+1); its give-up hands the page back to `previous` (the list's record) but moves the counter to N+2, and the settled pass passes `navigation: N+2` to `contentList.place`. `answered.navigation` is N, so `answeredHere` is false, `settled` is true, and the list falls through to `dropChangedRows` and a fresh read of every row. Before `bdd6be5` the same case made no read. Executed: `repro/review-4.test.ts` "finding 2" counts 2 reads where 1 is right.

**Recommended fix**
```diff
-function freshNavigation(url: string, reached: boolean) {
+function freshNavigation(url: string, reached: boolean, count: number) {
   return {
+    count,
     /** The URL WXT reported. */
@@ placeAll
     const navigationAtStart = navigation
+    const count = nav.count
     const current = () => navigationAtStart === navigation
@@
-          navigation: ahead ? navigationAtStart + 1 : navigationAtStart,
+          navigation: ahead ? navigationAtStart + 1 : count,
@@ giveUp
-      nav = previous?.url === here ? previous : freshNavigation(here, true)
-      nav.reached = true
       // Passes still running were for the dropped navigation.
       navigation += 1
+      nav = previous?.url === here ? previous : freshNavigation(here, true, navigation)
+      nav.reached = true
@@ navigated
-    nav = freshNavigation(to, url() === to)
+    nav = freshNavigation(to, url() === to, navigation)
```
(The existing comment line in the `giveUp` hunk moves up with `navigation += 1`; the diff adds none.)

**Remediation brief**
- **Design intent:** two counts that were one. The watch's `navigation` is an epoch: every move, drop and `stop()` bumps it, and `current()` compares against it so a pass begun before a move abandons its result. A surface's `navigation` argument instead names *which navigation* a placement stands for, and the Content list keys its kept answer on it. A navigation handed back to `previous` is the same navigation, so it must keep its count. Record counts are taken from the epoch at creation, so no two records share one; an `ahead` pass still stamps `navigationAtStart + 1`, which is the count `navigated` gives the next record.
- **Full surface:** `apps/extension/src/surfaces/watch.ts:117-118` (`freshNavigation`), `:173-175` and `:185` (`placeAll`), `:246-253` (`giveUp`), `:280` (`navigated`). Only `content-list.ts` reads `navigation` (`:178-184`, `:220`); `card.ts`, `analytics.ts` and `video-row.ts` do not, so they need no change.
- **Must preserve:** `current()` stays on the epoch (`navigationAtStart === navigation`), so a pass in flight across a drop still abandons its result (the `// Passes still running were for the dropped navigation.` comment keeps its meaning). The `content-list.test.ts` `test.each` on the poll path (the 0.6 s and 1.4 s visits, #215 item 5) and `answered.ahead = false` (`content-list.ts:187`), the watch suite, and the extension suite (353 green with this diff and Finding 1's line together).
- **Do not touch:** `content-list.ts`'s `answeredHere` and `rowsStandAsAnswered` logic; it is right once it sees the record's count.
- **Proof:** `pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts docs/reviews/creator-analytics-4/repro/review-4.test.ts -t "finding 2"` is red now and must be green; move it into `content-list.test.ts` beside the poll-path `test.each`. With only Finding 1's line applied it stays red, so the two commits are separable.

### 3. A token endpoint answer whose body stalls past the bound ends the read as a 500, not `google_failed` — LOW
- **Location:** `packages/token-vault/src/token-vault.ts:421-422`
- **Attribution:** introduced by `2add977` ("creator-analytics#214 review pass 1 finding 1: a read's token refresh called Google's token endpoint with no time bound"). Before it the same stall hung the request with no end; the bound now ends it, but unclassified.
- **Real-world trigger:** Google's token endpoint sends headers within 10 s, then its body stalls until the bound. Rare; no known occurrence. LOW: the creator sees a 500 `internal` in place of the `google_failed` refusal (the extension shows "Try again later" for both), and GlitchTip gets an internal error for a Google outage.

**Evidence**
```ts
      signal: AbortSignal.timeout(callTimeoutMs),
    }).catch((error: unknown) => {
      throw new TokenEndpointUnansweredError('Google did not answer a token endpoint call', {
        cause: error,
      })
    })
    if (response.ok) return (await response.json()) as TokenResponse
    const { error } = (await response.json().catch(() => ({}))) as { error?: string }
```

**Failure mode** — the signal also aborts `response.json()`, which rejects with a `DOMException` named `TimeoutError`, outside the `.catch` that classifies. The gateway's `read` catch (`packages/youtube-gateway/src/youtube-gateway.ts:401-409`) rethrows anything but a `TokenEndpointUnansweredError` or `RefusedCall`, so `app.onError` (`apps/api/src/app.ts:111-115`) answers 500. On a non-ok status the `.catch(() => ({}))` swallows the abort and the plain `Error` at `:424` takes the same 500 path. Executed by a finder with a throwaway node script (headers plus a partial JSON body, 300 ms bound): `DOMException TimeoutError`, `instanceof TokenEndpointUnansweredError` false. Not preserved: it ran outside the repo's runner.

**Recommended fix**
```diff
-    if (response.ok) return (await response.json()) as TokenResponse
-    const { error } = (await response.json().catch(() => ({}))) as { error?: string }
+    const unanswered = (cause: unknown) =>
+      new TokenEndpointUnansweredError('Google did not answer a token endpoint call', { cause })
+    if (response.ok) {
+      return (await response.json().catch((cause: unknown) => {
+        throw unanswered(cause)
+      })) as TokenResponse
+    }
+    const { error } = (await response.json().catch((cause: unknown) => {
+      if (cause instanceof DOMException && cause.name === 'TimeoutError') throw unanswered(cause)
+      return {}
+    })) as { error?: string }
```
and the `fetch(...).catch` above uses the same `unanswered(error)`.

**Remediation brief**
- **Design intent:** #214's rule is that a Google call the API stops waiting on ends the read as a Google outage: `google_failed`, logged as unanswered, units of calls answered before it committed. For the token endpoint that classification is `TokenEndpointUnansweredError`, which the gateway maps. The bound (`AbortSignal.timeout(callTimeoutMs)`) covers the body read too, so the classification must as well. A 200 whose body is not JSON (malformed, not stalled) also becomes "unanswered" under this diff, which is the right reading: Google gave no usable answer.
- **Full surface:** `packages/token-vault/src/token-vault.ts:407-425` (`requestToken`). The revocation fetch (`:580-590`) reads only `response.ok` and no body, so it has no such gap. The gateway's mapping (`youtube-gateway.ts:401-409`) needs no change. Its test seam: `packages/fake-google/src/index.ts` holds the token endpoint before any header (`exchange`, `:447`); a stalled body needs a new fake mode that writes headers and part of the body, then holds (for example `stallTokenEndpointBody()` beside `holdTokenEndpoint()` at `:712`).
- **Must preserve:** `invalid_grant` still becomes `GoogleRefusedGrantError` (the `:422-423` path for a 400 with a readable body); `video-list.test.ts:2411` "a list whose access token refresh Google's token endpoint holds open past the bound gets google_failed"; the token-vault suite's refresh and exchange tests.
- **Do not touch:** the 5xx-to-500 path for an answered non-ok status (Minor / nits, pre-existing; a separate decision).
- **Proof:** a new test beside `video-list.test.ts:2411` with the stalled-body fake mode: red now (500 `internal`), green after (502 `{ refusal: 'google_failed' }`, and the "Google's token endpoint did not answer a call" log line).

### 4. Two branches of #215's dropped-navigation path have no test — LOW
- **Location:** `apps/extension/src/surfaces/watch.ts:257` (`if (judged !== navigation) return`) and `:265` (`!nav.missing.has(name)`)
- **Attribution:** introduced by `bdd6be5`.
- **Real-world trigger:** none; a coverage gap. A later edit to either line ships silently.

**Evidence** — the test-audit agent mutated HEAD: `if (judged !== navigation)` → `if (navigationAtStart !== navigation)` (the give-up never judges the page on screen after a drop, so no missing is ever reported after one), and deleting `&& !nav.missing.has(name)` (a dropped navigation handed back to `previous` reports its missing surface again). Each mutation survives the whole extension suite (353 tests).

**Failure mode** — no wrong behaviour today; the rules "after a drop, the page on screen is judged" and "a navigation handed back reports nothing it reported before" have no test that goes red without them (standard 2).

**Recommended fix** — two tests in `watch.test.ts`'s describe at `:226`, using its `studioKeepsChangingFor` and a variant of `watchDashboard` whose card is always `not-found`:
```ts
test('a navigate that never commits before the dashboard settles still judges the card missing once', async () => {
  const { wxt, report } = await watchDashboard(() => false)
  wxt.navigateEvent(contentList)
  await studioKeepsChangingFor(giveUpAfterMs + 1_000)
  expect(report.mock.calls).toEqual([[{ name: 'extension_surface_missing', surface: 'card' }]])
})

test('a navigate that never commits after the card was judged missing reports nothing again', async () => {
  const { wxt, report } = await watchDashboard(() => false)
  await vi.advanceTimersByTimeAsync(giveUpAfterMs + passEveryMs)
  expect(report.mock.calls).toEqual([[{ name: 'extension_surface_missing', surface: 'card' }]])
  report.mockClear()
  wxt.navigateEvent(contentList)
  await studioKeepsChangingFor(giveUpAfterMs + 1_000)
  expect(report.mock.calls).toEqual([])
})
```

**Remediation brief**
- **Design intent:** see Finding 1. The drop judges the page on screen in place of the dropped navigation, and `nav.missing` keeps a record handed back to `previous` from reporting its missing surfaces twice.
- **Full surface:** `apps/extension/src/surfaces/watch.test.ts:226-296` (the describe and its `watchDashboard(cardDrawn)` helper, which already takes the drawn flag).
- **Must preserve:** the three existing tests in that describe.
- **Do not touch:** `watch.ts`; this finding adds tests only.
- **Proof:** both tests pass at HEAD and with Findings 1 and 2 applied (checked in a scratch worktree), and each goes red under its mutation above. Run `pnpm exec vitest run apps/extension/src/surfaces/watch.test.ts`, then apply each mutation by hand and see its test go red.

### 5. Comment hygiene — LOW (aggregated)
- `apps/extension/src/product-api.ts:16` — "own unbounded calls to the YouTube Data and Analytics APIs (paging a large channel's uploads)" → "own calls to the YouTube Data and Analytics APIs, each bounded at `googleCallTimeoutMs` (10 s) but several in a row when paging a large channel's uploads" (#214 bounded them)
- `packages/token-vault/src/token-vault.ts:32-35` — "Under the extension's 15 s (...), with room left for the request's database work, so the API answers `google_failed` before the extension gives up." → "Under the extension's 15 s (...), so one call Google holds open ends as `google_failed` before the extension gives up; a read of several calls in a row can still pass 15 s." (the bound is per call)
- `packages/token-vault/src/token-vault.ts:271` — "no connection, or no answer within the bound" → keep once Finding 3 lands; until then it overstates (a body that stalls is not classified)
- `apps/extension/src/first-run.ts:28-29` — "so a failed browser call or read is caught here and sends nothing more." → "so a failed step is caught here; a failure from the consent check on sends no event." (a failed `tabs.create` still sends it)
- `apps/extension/src/first-run.ts:55` — "An unknown consent or sign-in sends nothing." → "A consent check, sign-in read or send that fails sends nothing."
- `apps/extension/src/entrypoints/first-run/main.ts:10` — "Closing the page's own tab needs no `tabs` permission in Chrome or Firefox." → delete; `renderFirstRun`'s doc (`first-run.ts:59-61`) now says it
- `apps/extension/src/surfaces/watch.ts:23` — "Runs on the watch's tick before each pass" → "Runs on the watch's tick before each timed pass" (the give-up's settled pass, `:256`, runs with no sweep)

## Needs Further Investigation

### A. The Content list's page line stays over an empty tab while a read is in flight
`content-list.ts:166` takes the page line down only inside `place`, under the pass lock, and `sweep` (`:154-157`) touches rows only. A creator who pages the list (read in flight) and then opens a tab with no rows would see the previous page's line over the empty list until the read lands (up to 15 s). Reasoned, not executed. What would confirm it: a `content-list.test.ts` case holding the second read (`heldAnswer()`), removing every row, and asserting no page host after one `passEveryMs`. Fix if confirmed: the same removal in `sweep`.

### B. Real Studio may drop `#table-header` on a tab with no uploads
#215 item 3's guard is `if (list && header && ids.length === 0)`; the saved fixture is the Videos tab only, and `content-list.test.ts:611`'s comment ("Studio keeps the list and its column headings on a tab with no uploads") is unbacked. If Studio removes the header, the line stays. What would confirm it: #129's Shorts and Live fixtures, or #99 on a channel with an empty tab.

### C. `sendResponse` on a closed channel may throw in the background
`entrypoints/background.ts:79-83` runs `answer(request).then(sendResponse)` with no rejection handler. `answer` never rejects, but if a browser throws from `sendResponse` once the asking tab or popup has closed, that is an unhandled rejection, the class #213 removed elsewhere. Not checked against current Chrome or Firefox. What would confirm it: #101's hand checks with the console open, closing the popup mid-read.

Carried, unchanged: review 1 NFI A (Firefox's data declaration may need `websiteContent` or `browsingActivity`, before #100) and NFI C (a surface whose page goes off); review 3 NFI B (Studio replacing the card's Views row or the analytics header leaves the old figure up during the read) and NFI C (Firefox closing the popup at the permission prompt). Review 3 NFI A is closed by #215 item 4, with Findings 1, 2 and 4 on its new code.

## Reviewed and Dismissed
- A cold read can take two 15 s bounds, channels then videos (`product-api.ts:145-164`) — review 3's dismissal stands.
- A timed-out Google call records no units though Google may have charged it (`youtube-gateway.ts` `spend`) — #214's rule is "units of calls answered before it still committed"; a call with no answer records nothing by the gateway's design, unchanged by #214.
- `consent.test.ts:45` builds its expectation from `retentionAndSharingLines`, the constant `consent.ts` spreads — the rule it defends is that the web screen carries the shared lines in order; their wording is pinned by `first-run.test.ts` (a wording mutation goes red there).
- The 1.4 s row of `content-list.test.ts`'s poll-path `test.each` cannot go red against #215 item 5 — it defends `answered.ahead = false` (`content-list.ts:187`, added in `0ae6589`): the test-audit agent removed that line and both rows went red.
- `if (here === dropped) navigated(here)` (`watch.ts:171`) — needed: WXT 0.21.4's watcher drops a `navigate` to its own last URL, so a page that later reaches a dropped URL is reported by nothing else. Tested by `watch.test.ts`'s third never-commits test.
- Timers after `stop()` — none left; `navigated` re-enters only from `placeAll`, which cannot start after `stop()`.
- #213: `runtime.getURL` throwing synchronously inside `openFirstRun` — caught, it runs inside the arrow awaited in the first try (`background.ts:46`).
- Review 3's dismissals stand: event-send 401 not clearing caches, undeduplicated concurrent reads, `cf-connecting-ip`, partial OpenPanel config, harness sibling scopes, the card and analytics figures kept while their element stands, `period-default` as Lifetime, the `sendTimeoutMs` cross-reference.

## Minor / nits
- A give-up while an earlier pass holds the lock past 5 s drops a navigation that did commit (`watch.ts:246`: `reached` is set only at `navigated` or a pass start). Executed in a scratch harness: the Content list is still reported shown once (at 8.25 s), with no missing; only the judgement waits another 5 s. One line would close it: `if (url() === nav.url) nav.reached = true` at the top of `giveUp`. `nav.reached = true` at `:250` is redundant on both branches.
- Google's token endpoint answering 5xx during a read's refresh gives a 500 `internal`, not `google_failed` (`token-vault.ts:424`, a plain `Error` the gateway rethrows). Pre-existing, untouched: the same line is at `5d4457d`'s `token-vault.ts:400`. Follow-up ticket material, with Finding 3's classification as the precedent.
- A card whose href Studio repoints during its read could be reported shown on the old video's figure (`video-row.ts:95`, `:102` check only `isConnected` and `current()`); the next pass removes it. Reasoned only.
- A dev-build popup links `http://localhost:3000/app`, which the API serves only from a built web root (`popup.ts:63`, `apps/api/src/app.ts:268-272`). Unverified; production unaffected.
- A 200 in flight when another read's 401 clears the caches writes its read back (`product-api.ts:141`, `:177`). Carried from reviews 2 and 3; a finder executed it this round (the read is the creator's own, answered while signed in).
- A held-call test that times out makes the next test in `video-list.test.ts` fail in about 10 ms with "Unexpected end of JSON input" and a `savepoint sp1` error; one real failure shows as two.
- `vitest.config.ts`'s new `server.deps.inline` has no why line; `watchThroughWxt`'s doc (`surfaces/testing.ts`) carries it.
- `entrypoints/first-run/main.ts` (`tabs: browser.tabs`) is reached by no test; the wiring is one line.
- Carried from review 3: `isKept` on `Date.now()`; the popup's "throws before it returns a promise" comments; copied test helpers; `card.ts`'s `comparisonOf` shadowing.

## Test quality
Tests new or changed since review 3's HEAD `9a13d3b`: 41 · red at `9a13d3b`: 36 at runtime, 4 only under `tsc` (the "Got it" tests pass a `tabs` option `renderFirstRun` did not have) · green: 1 (the 1.4 s poll-path row, a control case) · all 5 of those go red under a targeted mutation · tautology shapes found: none (no expectation computed with the production helper, no mocked unit under test, no call-shaped-only, assertion-free or snapshot test). Every #213 catch, every #214 timeout site (gateway Data and Analytics clients separately, refresh, revoke, the `TokenEndpointUnansweredError` branch, `modules.ts`'s pass-through) and every #215 fix goes red under its own mutation, except the two `watch.ts` branches in Finding 4. API and package tests changed since `5d4457d` and green there (10) are ordering or validation guards, harness tests whose subject is the copied harness, or helper moves; each goes red under a mutation or states its limits. Notes:
- `first-run.test.ts:273`, "a failing tabs.getCurrent leaves no unhandled rejection and removes nothing": `removed: []` cannot go red (no tab id exists to remove); `unhandled` carries the test. Optional: drop "and removes nothing" and that half.
- `content-list.test.ts:612`, `expect(document.querySelector('#table-header')).not.toBeNull()`, checks the test's own setup (it never removes the header). It reads as a precondition; NFI B is the real question.
- `token-vault.test.ts:709-711`'s held revoke test explains its timeout but, unlike `video-list.test.ts` and `fake-google.test.ts` after `6209e7e`, does not say the held fake cannot show a connection that never opens or a body that trickles in (Finding 3's gap). Optional: one line.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and `pnpm test` all green at `b1b387c`.
- **Commit hygiene:** commit this doc, `repro/review-4.test.ts` and the `repro/repro.vitest.config.ts` change (outside the suite's include pattern, so `pnpm test` stays green while the repro is red). Nothing else to drop; the tree was clean before the review.
- **Likely reviewer asks:** the ready-for-human tickets still open under #4 (#99, #100, #101, #122, #129, #200, #202) and the needs-triage ones (#121, #126); #213, #214 and #215 are open though their work is on the branch; the OpenPanel variables unset in Dokploy; review 1's NFI A before the AMO submission; which googleapis docs #214 read (the gateway comment cites the gaxios and google-api-nodejs-client READMEs, read 2026-10-14).

## Verdict
**Ready to open the PR, with follow-ups.** No finding gates it: this fresh whole-branch pass found no CRITICAL, HIGH or MEDIUM defect, and all four CI checks pass. Findings 1 and 2 are LOW telemetry and quota defects in #215's new drop path, each with a red repro and one small `watch.ts` diff checked green against the whole extension suite; Finding 3 is a LOW misclassification on #214's token endpoint path; Finding 4 adds two tests; Finding 5 is seven comment lines. They fit one short remediation round or follow-up tickets. Review 3's Findings 1 to 4 are closed (its repro is green, and the README line is in), and its NFI A was closed by #215.
