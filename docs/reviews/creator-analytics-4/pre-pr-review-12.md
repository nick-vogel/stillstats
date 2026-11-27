# Pre-PR review: creator-analytics#4 Studio extension

**Branch:** `creator-analytics-4-studio-extension` vs `origin/main` (merge-base `5d4457d` "Merge pull request #193 from nick-vogel/creator-analytics-64-web-dashboard-metrics-profile")
**Reviewed at:** HEAD `6374a13` ("creator-analytics#246 Studio extension: a move off a surface's page leaves its elements up, such as the Content list's line and pill on the Collabs tab"), clean tree, no uncommitted or untracked files at review time. Whole branch: 156 files, +26,978 / −179, 426 commits. The only files this review adds are this doc and one repro, `repro/review-12-collabs-held-read.test.ts`.
**Delta under review:** none. A `--fresh` full review of the whole branch against `origin/main`, the first round of the thirteenth epic-loop run. Review 11 (at `2f7c8a5`) is the last earlier doc; its Findings 1 and 2 went to #245 (`1a34a3a`, merged `c8a86f5`) and #246 (`25be3e8`, merged `6374a13`), which have landed.
**Reviewed against:** epic creator-analytics#4 (its spec, user stories and implementation decisions); `CODING_STANDARDS.md` rules 1 to 3; `CONTEXT.md`; `README.md`'s analytics and extension sections; review 11's Approach decisions, NFI and dismissals.
**Date:** 2026-10-16
**Reviewer:** 3 code-review agents, 1 tautology-audit agent, plus a verify pass

## What was verified and how

| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | green, lockfile unchanged |
| Lint | `pnpm lint` | green: 451 files at review start, 452 with this review's repro |
| Typecheck | `pnpm typecheck` | green, every package |
| Build | `pnpm build` | green; `apps/extension/.output/chrome-mv3` and `firefox-mv3` written |
| Full suite | `pnpm test` (Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | green: 108 files, 2,293 tests |
| Preserved repro suite | `pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts` | green at review start, 14 files, 28 tests (review 11's three red repros now green). With this review's repro: 15 files, 28 green and 1 red by design (Finding 1) |
| Built manifests | Read `apps/extension/.output/{chrome,firefox}-mv3/manifest.json` | host permissions `https://studio.youtube.com/*` and `https://stillstats.com/*` only, no `permissions` key; Firefox gecko id `@stillstats`, `strict_min_version` 140.0, `data_collection_permissions` required `authenticationInfo`, optional `technicalAndInteraction`; Chrome a service worker, Firefox `background.scripts` |
| Em-dashes in shipped copy | `git diff 5d4457d -- . ':!docs/reviews' ':!pnpm-lock.yaml' ':!apps/extension/test/fixtures' \| grep -c '^+.*—'` | 0 |
| API, packages, web, site, docs | Finder A: diffs of `apps/api`, `packages/*`, `apps/web`, `apps/site`, the docs; a scratch Node script against the real `risc.ts` with a configuration server that holds the first request | #245 holds: a 429 maps to `TokenEndpointUnansweredError` at both token endpoint call sites (`requestToken`, `token-vault.ts:429-478`, used by the refresh and the code exchange); the RISC memo clears on a timeout and the next read fetches again (`read1 rejected TimeoutError … hits 1`, `read2 … answered {"ok":false} hits 2`); `ids` filter and event validation hold |
| Extension shell | Finder B: background, popup, first-run, host access, manifest, messages, product API; a Node script against the real `createProductApi` | timeouts, 401 forgetting, refusal mapping, first run, Firefox consent hold; one held-click test gap (Finding 2), the rest Dismissed or nits |
| Studio surfaces | Finder C: the #246 takedown, comparison, Content list, channel match, selectors; scratch harnesses on the saved Content list fixture | Finding 1; NFI A; comparison math, one read per page, channel match, selectors-only-in-`selectors/` hold |
| Finding 1 repro | New `repro/review-12-collabs-held-read.test.ts` (jsdom, the saved Content list fixture) | red 1 of 1 at `6374a13`: two Content list hosts (the line under the title and the pill) still up 3 s after a reported move to `/videos/collabs` while a re-read is held |
| Finding 1 recommended fix | Applied in a scratch worktree at `6374a13` under the scratchpad, then removed | repro suite 29 of 29 green; `pnpm exec vitest run apps/extension` 21 files, 477 tests green (`content-list.test.ts:722`, the ahead case, included); typecheck and lint green |
| Tautology audit | Agent: a scratch worktree at `5d4457d`, the 13 modified test files plus `risc-configuration.test.ts` and `packages/api-types/src/channels.test.ts` copied in with the branch's test helpers (and the branch's fake Google server where its handlers are needed), run per file; #245's and #246's new tests also run against their pre-fix parents | see Test quality |
| Live browsers | Not run: no browser in a review | NFI A and B, and review 11's carried NFI, need #99, #100 or #101 |
| Mozilla's `data_collection_permissions` categories | Not fetched this round; reviews 1 and 5 fetched extensionworkshop.com | NFI B, carried |

**Repro command for this round's repro:** `pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts docs/reviews/creator-analytics-4/repro/review-12-collabs-held-read.test.ts` from the repo root.

**Overall:** All four CI checks are green at `6374a13`, and review 11's findings 1 and 2 are closed by #245 and #246, whose repros now pass. A fresh read of the whole branch found no CRITICAL, HIGH or MEDIUM defect. One LOW behaviour finding is confirmed by an executed repro with its fix proved: #246's takedown waits on any read already out, so a slow read holds a surface's elements up on the page the creator moved to. Two hygiene entries carry review 11's two unapplied entries plus this round's. The PR can open; the findings fit one remediation round.

## Approach decisions
- **Analytics link window (review 1 F1):** the extension always writes `window` into the detail link, lifetime included. Unchanged.
- **Watch stop (review 1 F2, F3):** `stop()` removes every host through `removeSurface` and clears `again`; no `stopped` flag. Unchanged.
- **Give-up URL (review 1 F4, #210, #217):** the give-up judges the navigation WXT reported, held in `nav`; `giveUp` sets `nav.reached` when `url() === nav.url`. Unchanged.
- **Dropped navigation (#215, #217):** only a reached navigation may become `previous`; each navigation record carries its own count. Unchanged.
- **Session cache (review 1 F5):** a 401 from any *read* forgets the kept channels and video reads, in `readSignedIn`. An event send is not a read and stays out of it. A read already in flight that answers after the clear is kept (dismissed since review 1, restated in Dismissed below). Unchanged.
- **Background answers (review 1 F6):** the rejection to failed-value mapping lives in `backgroundAnswerer`. Unchanged.
- **Hung reads (#211):** every background fetch carries `AbortSignal.timeout(answerWithinMs)`, 15 s by default, per fetch. Unchanged.
- **Row sweep (review 3 F1, #215, #217, #224):** an optional synchronous `sweep(document, passAgain)` on `Surface`, run from `schedulePass`'s timer outside the pass lock, for every surface whatever its `isOn` says. Unchanged.
- **Comparison retry and window (review 3 F2, #215, #218, #224):** unchanged.
- **Content list page elements (#219, #226, #230, `e380c84`, #232):** the line goes directly after Studio's page header (`pageTitleIn`), and the pill's anchor directly after the Views heading's `h3` (`viewsWordLineIn`), never inside it. The page elements come down together. Unchanged.
- **Content list page elements once the video list goes (review 9 F1, review 10 F1, #234):** the sweep takes the page elements down when `videoListIn(document)` finds no list, on the second sweep in a row while the re-read of the answered rows is out, on the first otherwise; one counter, `emptySweeps`. Unchanged.
- **A surface whose page the URL leaves (review 11 F2, #246; amended by Finding 1):** the elements of every surface whose `isOn` is false for the URL come down with `removeSurface(document, surface.name)`, but only when the URL is the one WXT reported (`url() === nav.url`, the `!ahead` rule). A URL ahead of WXT's report removes nothing, since the navigation WXT reports next may still be judged on it (`content-list.test.ts:722`). #246 does it in `placeAll` (`watch.ts:201-204`); Finding 1 adds the same removal to `schedulePass`'s timer, before the sweeps and outside the pass lock, so a pass awaiting a read no longer holds it back. Both sites stay: the give-up's pass and a pass asked for during another run have no timer before them. Precedent: the row sweep's own place in that timer, and `stop()`'s `removeSurface` loop (`watch.ts:332`).
- **Analytics placement and not-found (#225, review 6 F1, #228, #229):** unchanged.
- **Analytics placement across redrawn anchors (review 8 F1, #232, review 9 F2, review 10 F2 and F3, #235):** the placer keeps `mayBeUp`, the set of every placement that may still be up, and judges each entry before a read. Unchanged.
- **Default row render (review 6 F2):** `renderSurface` draws the card's row only and takes no link. Unchanged.
- **Preserved repros (review 6 F3, amended by review 8 F3):** a stale repro fixture is brought up to the current rule by adding the data the rule needs, never by changing its assertions, unless a later ticket changed the rule on purpose in a recorded assumption. Unchanged.
- **Google call bound and outage mapping (#214, #216, #222, #227, #231, #233, #245):** every token endpoint call is bounded at `googleCallTimeoutMs`; no answer, a stalled body, a 5xx, a 429, or an unusable 200 is `TokenEndpointUnansweredError`, which the gateway and the connect callback end as `google_failed`; `invalid_grant` is a revocation; any other status stays a plain error. The RISC configuration fetch carries `AbortSignal.timeout(callTimeoutMs)` (#245). Unchanged, verified this round.

## Confirmed Issues

### 1. A move off a surface's page while a read is out leaves the surface's elements up until the read answers — LOW (capped)
- **Location:** `apps/extension/src/surfaces/watch.ts:201-204` (the takedown, inside `placeAll`) and `:230-243` (the pass lock); `:246-259` (`schedulePass`'s timer, where the fix goes)
- **Attribution:** introduced. The whole extension is new on this branch (`git show 5d4457d:apps/extension/src/surfaces/watch.ts` fails: no such path). #246 (`25be3e8`) added the takedown only inside `placeAll`, which runs under the pass lock: `git log --oneline -S'if (!ahead) removeSurface' 5d4457d..HEAD` names `25be3e8` alone.
- **Real-world trigger:** the creator re-sorts or pages the Content list, or opens it fresh, and moves to the Collabs tab (or the dashboard, or another analytics tab) before the extension's read answers. The read answers in well under a second when the API is healthy, so the elements stay up for that long and no more; only a slow or stalled API (up to `apiAnswerWithinMs`, 15 s, per request; the card's pass can make three video reads in a row) makes it visible. LOW, capped: a stray line and pill over rows with no figures, a confusing display that tops out at MEDIUM, and seen only while the API is slow. Upgrade to MEDIUM if #99 shows reads routinely taking over a second, check via the background's network panel in the #99 walk-through.

**Evidence**
```ts
for (const surface of surfaces) {
  if (!surface.isOn(here)) {
    if (!ahead) removeSurface(document, surface.name)
    continue
  }
  const placement = await surface
    .place({ ... })
```
`placeAll` runs only inside `pass()`, one at a time (`watch.ts:230-243`: "a pass asked for during one runs once it ends"). While the pass before it awaits a read, the timer's sweeps still run, but the Content list's sweep (`content-list.ts:232-256`) takes its page elements down only when the list is gone or has headings and no row ids; Studio's Collabs list has rows with ids, so it returns early. Nothing outside the lock takes the elements down.

**Failure mode** — Content list shown and answered; Studio points every row at other ids (a re-sort), so a second read goes out and is held; the creator moves to `/videos/collabs` and WXT reports it; Studio points the rows at other ids again. Executed: `repro/review-12-collabs-held-read.test.ts` is red at `6374a13`, with two hosts (the line "Data from Stillstats as of 7 Oct." under the page title, and the pill in the Views heading) still up 3 s after the reported move. Finder C's harness saw the same two hosts at +300 ms, +1 s, +3 s and +10 s, and none once the held read answered. The late answer itself is not drawn: `current()` is false after the reported navigation, so `content-list.ts:344` and `video-row.ts:167`, `:172` draw nothing, and the queued `again` pass removes the elements. `CONTEXT.md`'s Surface entry ("a move within Studio to any other page takes them down") holds only once any pass in flight ends.

**Recommended fix**
```diff
   function schedulePass(): void {
     if (passTimer !== undefined) return
     passTimer = setTimeout(() => {
       passTimer = undefined
+      const here = url()
       for (const surface of surfaces) {
+        if (here === nav.url && !surface.isOn(here)) removeSurface(document, surface.name)
         try {
           surface.sweep?.(document, schedulePass)
         } catch {
```
Proved in a scratch worktree: the repro goes green, and the whole repro suite (29) and `apps/extension` (21 files, 477 tests) stay green.

**Remediation brief**
- **Design intent:** the watch runs one pass at a time, and a pass may await a background read for up to 15 s per request. Anything that must react to Studio while a read is out runs in `schedulePass`'s timer, outside the lock: the sweeps already do. A surface's elements belong to its own page; off it, once the URL is the one WXT reported (`url() === nav.url`), they come down. A URL ahead of WXT's report removes nothing, because the navigation WXT reports next may still be judged on the elements up now. A read that answers after a reported navigation is never drawn (`current()`), so a removal outside the lock cannot be undone by the pass in flight.
- **Full surface:** `apps/extension/src/surfaces/watch.ts:246-259` (`schedulePass`'s timer: the new removal, before the sweeps loop's `try`); `watch.ts:201-204` stays as it is (the give-up's pass at `:284` and a pass asked for during another run have no timer before them); `watch.ts:19` (`isOn`'s doc, see Finding 3); `watch.ts:152-157` (`watchStudio`'s doc already says "takes a surface's elements down on a pass on any other page once WXT has reported the move"; widen "on a pass" to "on a pass or a tick" if you touch it). No other surface file changes: the card, the Content list and the analytics page all go through `removeSurface(document, surface.name)` (`render.ts:172`).
- **Must preserve:** the `!ahead` rule, pinned by `content-list.test.ts:722` ("a creator who leaves the Content list and comes back to the same rows has them read again once Studio has had the give-up time to draw them"); #246's four tests, `content-list.test.ts:1157` and `:1169` (Collabs, and the return to Videos), `analytics.test.ts:502`, `card.test.ts:319`; every sweep still runs on every tick for every surface, whatever `isOn` says, and a throwing sweep is still skipped (`watch.test.ts`); the removal inside `placeAll`. Failure of the fix itself: `removeSurface` only queries and removes the extension's own `[data-stillstats-surface]` hosts and throws on nothing the page can draw; if it ever did throw, the timer would not reach `void pass()`, so keep the removal before the `try` only if `removeSurface` stays throw-free, or place it inside the `try`.
- **Do not touch:** the late-render guard (`current()`, `watch.ts:196`), which already keeps the held read from drawing after a reported move; NFI A's proposed change to `current` is a separate, unproved question.
- **Proof:** `pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts docs/reviews/creator-analytics-4/repro/review-12-collabs-held-read.test.ts` red now, green after; then the whole repro suite and `pnpm exec vitest run apps/extension` green. Move the repro's case into `apps/extension/src/surfaces/content-list.test.ts` beside `:1157`, using `showListWithLaterReadsHeld`.

### 2. Test hygiene — LOW (aggregated)
- `apps/extension/src/popup.test.ts:211-242` — the held sign-in click is tested for an ask that rejects and one that throws, not for the background answering `false` (the relay refused it, or answered 401), the common real case; the surface twin has it (`line-clicks.test.ts:90`, "the background answers it not sent"). A change that turned a resolved `false` into a clear (`.then(() => true).catch(() => false)`) passes every popup test → add a `failingAsks` entry `['the background answers it not sent', (async () => false) as AskBackground]`.
- `apps/api/src/risc-configuration.test.ts` — its three tests cover a configuration fetch that never answers, a hang two reads share, and a stalled body, but none a read after the fetch timed out. The memo's reset (`risc.ts:76-78`, `riscKeys.catch(() => { riscKeys = undefined })`) is what makes #245's bound useful: without it every later RISC event fails until the process restarts. It is pre-existing code, but #245 made a rejection its common path, and no test pins it (standard 2 and the fallback-path rule) → add a case: the configuration server holds the first request until the first read rejects, then serves a configuration; assert the second read reaches verification (`{ ok: false }` for a junk token) and the server saw two requests. Finder A executed exactly this shape against the real reader and it passes today.
- `packages/fake-google/src/index.ts:176`, `:785` and `packages/fake-google/src/fake-google.test.ts:292` — `answerTokenEndpointWithNull` lost its only consumer when #245 moved `token-vault.test.ts:710` to `answerTokenEndpoint(google, 200, 'null')` (`git grep answerTokenEndpointWithNull` finds only these three lines). Added by this branch (#231, `419695a`) → delete the method, its state flag and its fake-google test (standard 3).
- `apps/extension/src/popup-link.test.ts:42-49` (carried from review 11 Finding 3, not applied: #246's plan left the file out of its diff) — "a middle-click, which opens the link in a new tab, asks for the event" asserts only `expect(asked).toHaveLength(1)` → assert `toEqual([{ type: 'usage-event', event: { name: 'extension_popup_web_app_opened' } }])`, as the sibling at `:27` does.

### 3. Comment hygiene — LOW (aggregated)
- `apps/api/test/start-api.ts:82` — "The bound on one Google call, the gateway's and the vault's. Unset, production's." → "The bound on one Google call, the gateway's, the vault's and the RISC reader's. Unset, production's." (its twin at `modules.ts:21-24` was updated by #245).
- `apps/extension/src/surfaces/content-list.test.ts:900`, `:1049`, `:1071`, `:1207`, `:1602` — "// Every read after the first is held, as a background answering from the API holds it." above each `showListWithLaterReadsHeld()` call → delete; the helper's doc (`:323-326`) says it.
- `apps/extension/src/surfaces/watch.ts:19` — "True on the Studio page that carries this surface." → "True on the Studio page that carries this surface. Off it, once the URL is the one WXT reported, the watch takes the surface's elements down."
- `apps/extension/src/product-api.ts:13-22` (carried from review 11 Finding 4, not applied) — "A video read with no kept channels is two requests in a row, so it can wait twice this. … Short enough that a stalled API frees the tab's surfaces, which the watch runs one pass at a time, within a few of Studio's draws." → add the card's worst case: "The latest video card's place makes up to three video reads in a row (its figure, its format read, and the wider format read, `card.ts:44` and `:58`), so a stalled API can hold the tab's passes for up to four times this, the channels read included."

## Needs Further Investigation

### A. A read that answers after a URL change WXT has not reported yet is drawn on the new page — confirm whether Firefox's content scripts take WXT's polling fallback
`watch.ts:196`: `const current = () => navigationAtStart === navigation` counts only WXT's reports. WXT 0.21.4's location watcher (`wxt/dist/utils/internal/location-watcher.mjs`) uses the Navigation API's `navigate` event when `globalThis.navigation?.addEventListener` exists, and otherwise polls `location.href` every second. Under polling, a read that answers between the URL change and the next poll sees `current()` true and draws: finder C executed this on the Content list fixture (all of the held read's hosts drawn on the Collabs URL until `navigated`). On the analytics page the same window would draw a week figure under Studio's 90-day number for up to a second, until the next poll's pass judges it away (read from the code, not executed). Chrome reports through `navigate`, so it is not affected. What would confirm exposure: in #101 or #99, in Firefox 140 and current Firefox, evaluate `typeof globalThis.navigation?.addEventListener` in the content script's console context. Candidate fix, unproved and touching a guard many tests pin: `const current = () => navigationAtStart === navigation && url() === here`.

### B. Firefox's data declaration may need `websiteContent` or `browsingActivity` — carried from review 1 NFI A, before #100
`manifest.ts:56-61` declares `authenticationInfo` (required) and `technicalAndInteraction` (optional); every read sends the Studio channel id, video ids and period, read from Studio's URL and links, to stillstats.com. Reviews 1 and 5 fetched Mozilla's page; whether AMO counts ids from Studio links as either category is a reviewer's call. What would settle it: AMO's answer at #100's submission.

Review 11's NFI B, C, D, F, G, H, I and J were not re-examined in this fresh round and stand as recorded there. Review 11 NFI E (the RISC configuration fetch) is closed by #245.

## Reviewed and Dismissed
- **A read in flight when another read's 401 clears the cache is kept again after the clear** (`product-api.ts:143`, `:179`) — finder B reproduced it; it is the recorded Session cache decision (dismissed since review 1). The window is one in-flight read, and the next read after the kept one expires sees the 401.
- **The session cache is not keyed on the session** (`product-api.ts:134`, `:172-177`) — kept reads last 30 s by design (`kept.ts`); the key holds the Studio channel id, so no channel's numbers reach another channel's page.
- **A malformed channels or video answer, or an unknown request type, reaches the popup or a surface** (`product-api.ts:74-80`, `background-answer.ts:14-21`) — the extension and the API share `@creator-analytics/api-types`, and every request is typed; another shape is the version skew the shared types exist to stop (as review 11 dismissed the `engagedViews` NaN case).
- **A 429 maps differently at some token endpoint call site** — every token endpoint call goes through `requestToken` (`token-vault.ts:429-478`), used by the refresh (`:512`, the gateway and the worker's connection probe) and the code exchange (`:715`); revocation is another endpoint and reports any non-ok status without failing the disconnect.
- **The RISC reader stays stuck after a timed-out configuration fetch** — executed by finder A: the memo clears on rejection and the next read fetches again.
- **The popup's host-access view has no web app link** — approved copy (#92, #109); dismissed in review 11.
- **A surface coming back after the takedown stays down** — finder C traced it: the Content list re-places from `answered` once its page hosts are disconnected (`content-list.ts:312-318`), `showInRows` re-renders figures whose host is disconnected, and the placer's keep needs every host connected (`video-row.ts:152`); `content-list.test.ts:1169` pins the Content list case.
- **A navigation between two pages of one surface (Content list tabs, a re-sort, a period change) takes it down** — `isOn` stays true on all of them, so the watch removes nothing.
- **`consent.test.ts:46` computes its expectation from the production constant** — dismissed in review 11: `first-run.test.ts:239-241` pins the literal wording.
- Reviews 1 to 11's other dismissals stand.

## Minor / nits
- `token-vault.ts:468-471`: an `invalid_grant` body wins over a 5xx or 429 status, so such an answer revokes the connection rather than counting as an outage. The `invalid_grant` check came first at the base too (`git show 5d4457d:packages/token-vault/src/token-vault.ts`, line 399); Google is not known to send the combination.
- `token-vault.ts:474`: the error message template is built twice either side of the status check (#245's own review, F1.1).
- `modules.ts:84`: no test goes through `startApi` to show `callTimeoutMs` reaches the RISC reader; the reader's 15 s default still bounds it if the line went.
- `risc.ts:74`: the configuration body's `issuer` and `jwks_uri` are not checked to be strings (pre-existing); the URL is Google's over TLS. `createRemoteJWKSet` is bounded by jose's own default, not `callTimeoutMs`.
- `routes/events.ts:56`: any content type and any body size is accepted; a cross-site `text/plain` POST needs no preflight, so the guard is the session cookie's SameSite=Lax (review 11 NFI B for Firefox). A `bodyLimit` would cap a signed-in user's 60 posts a minute.
- `server.ts:49-59`: one or two of the three `OPENPANEL_*` set disables the relay with no log (carried).
- `apps/site/privacy.html`, the extension section: the relay forwards the creator's IP and user agent to OpenPanel (`event-relay.ts:50-58`); the paragraph names neither. Approved copy; belongs with #202.
- `background.ts:16`, `product-api.ts:107`: the cache's freshness uses `Date.now`, so a backward clock step keeps reads longer; `performance.now()` or treating a negative age as stale would fix it.
- `background.ts:69-72`: on Chrome 133 and later, the `tabs.onUpdated` listener wakes the service worker on every tab load to check host access. Cost only.
- `apps/extension/package.json`: no `test` script, and `pnpm exec vitest run` from inside `apps/extension` fails 10 tests (WXT's `import.meta.env.ENTRYPOINT` undefined there); the root run passes.
- `watch.ts:203`: every reported pass off a surface's page now scans the document for its hosts; a few `querySelectorAll` calls a pass, unmeasured.
- `card.test.ts:319`: "leaves no figure or comparison row" checks only the pill before the move; the figure and the row share one host, so the end assertion covers both.
- A held popup sign-in click is sent only on the popup's next signed-in open, and a surface's held click lives in the tab's memory; both match their comments and the spec's "held until signed in".

## Test quality
Test files added or modified: 38 (25 added, 13 modified) · red at `5d4457d` by construction (module under test absent): 23 files, every `apps/extension` test plus `apps/api/src/events.test.ts` and `event-relay.test.ts` · red at base by import: `packages/api-types/src/channels.test.ts` and `apps/site/test/site.test.ts` · run at base: 15 files · new or changed blocks green at base: 15, every one justified as recorded in review 11 (`channels.test.ts:57`, `connect.test.ts:140` and `:317-319`, `video-list.test.ts:1818`, `:2214`, `:1691` (a helper hoist), `:2482`, `scopes.test.ts:588`, `:603` (red on the base harness), `:630`, `:641`, `seed-ids.test.ts:45`, `:58`, `channel-picker.test.ts:82`, `:88`). Against their pre-fix parents: #246's four new tests (`content-list.test.ts:1157`, `:1169`, `analytics.test.ts:502`, `card.test.ts:319`) go red with only `watch.ts` reverted to `25be3e8^`; #245's 429 refresh and consent tests and all three RISC configuration tests go red against `1a34a3a^`; `token-vault.test.ts:538` (a 400 `invalid_request` stays a plain error) is green there by design, the commit's named mutation guard. The seven "past the bound" tests hang at base, which has no bound, and time out when run alone: red for the right reason. Tautology shapes: no `vi.mock`, no snapshots, no assertion-free test; the call-shaped assertions in `host-access.test.ts` and `host-access-request.test.ts` fake the browser's permission API, where the call is the effect; `token-vault.test.ts:229-237` spies only Google's token URL. Two gaps go to Finding 2.

## Prior-review closure
Fresh review: the earlier docs' findings were not re-scored one by one. Review 11 Finding 1 (a token endpoint 429) is closed by #245, and Finding 2 (the Collabs tab) by #246: their repros `review-11-token-429.test.ts` and `review-11-collabs.test.ts` are green in the repro suite. Review 11's Findings 3 (test hygiene, `popup-link.test.ts:42-49`) and 4 (comment hygiene, `product-api.ts:13-22`) were not applied, since neither file was in #245's or #246's diff; both are carried into Findings 2 and 3 here. Review 11 NFI E is closed by #245. Finding 1 here is the residue of #246's fix: the takedown it added holds only between reads.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and `pnpm test` all green at `6374a13`, and lint stays green with this review's repro (452 files). The preserved repro suite (not in CI) is red 1 of 29 by design until Finding 1 is fixed.
- **Commit hygiene:** commit this doc and `repro/review-12-collabs-held-read.test.ts`. The tree was clean before the review.
- **Likely reviewer asks:** the ready-for-human tickets under #4 (#99, #100, #101, #122, #129, #200, #202) and the needs-triage ones (#121, #126, #221); NFI A as a #101 or #99 check; NFI B at #100.

## Verdict
**Ready to open the PR, with follow-ups.** No CRITICAL, HIGH or MEDIUM finding; all four CI checks pass, and review 11's behaviour findings are closed by #245 and #246. Finding 1 is LOW, capped on attainability (a read slow enough to see at the moment of a move), with an executed repro and a two-line fix proved in a scratch worktree; it and the two hygiene entries fit one remediation round, and none gates the PR.
