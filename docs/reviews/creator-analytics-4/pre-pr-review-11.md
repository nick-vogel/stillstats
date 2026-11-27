# Pre-PR review: creator-analytics#4 Studio extension

**Branch:** `creator-analytics-4-studio-extension` vs `origin/main` (merge-base `5d4457d` "Merge pull request #193 from nick-vogel/creator-analytics-64-web-dashboard-metrics-profile")
**Reviewed at:** HEAD `2f7c8a5` ("creator-analytics#235 Studio extension: the placer remembers only its last placement, so a kept one can leave a figure or another video's line up"), clean tree, no uncommitted or untracked files at review time. Whole branch: 151 files, +26,032 / −177, 420 commits (128 files, +22,116 / −177 outside `docs/reviews/`, of which about 7,960 are the three saved Studio fixtures and 1,095 `pnpm-lock.yaml`). The only files this review adds are this doc and its two repros, `repro/review-11-token-429.test.ts` and `repro/review-11-collabs.test.ts`.
**Delta under review:** none. A `--fresh` full review of the whole branch against `origin/main`, the first round of the twelfth epic-loop run. Review 10 (at `2f63331`) is the last earlier doc; its three findings went to #234 and #235, which have landed.
**Reviewed against:** epic creator-analytics#4 and its 80 sub-issues (titles and states); `CODING_STANDARDS.md` rules 1 to 3; `CONTEXT.md`; ADRs 0008 and 0013 as the branch amends them; `README.md`'s analytics and extension sections; review 10's Approach decisions.
**Date:** 2026-10-15
**Reviewer:** 3 code-review agents, 1 tautology-audit agent, plus a verify pass

## What was verified and how

| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | green, lockfile unchanged |
| Lint | `pnpm lint` | green: 448 files at review start, 450 with this review's two repros |
| Typecheck | `pnpm typecheck` | green, every package, the extension's `wxt prepare` included |
| Build | `pnpm build` | green; `apps/extension/.output/chrome-mv3` and `firefox-mv3` written |
| Full suite | `pnpm test` (Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | green: 107 files, 2,283 tests |
| Preserved repro suite | `pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts` | green at review start, 12 files, 25 tests. With this review's repros: 14 files, 25 green and 3 red by design (Findings 1 and 2) |
| Built manifests | Read `apps/extension/.output/{chrome,firefox}-mv3/manifest.json` | host permissions `https://studio.youtube.com/*` and `https://stillstats.com/*` only, no `permissions` key; Firefox gecko id `@stillstats`, `strict_min_version` 140.0, `data_collection_permissions` required `authenticationInfo`, optional `technicalAndInteraction`; Chrome a service worker, Firefox `background.scripts` |
| Browser API use | `grep` of `browser.*` calls in `apps/extension/src` | `permissions.getAll`, `permissions.onRemoved`, `runtime.*`, `tabs.create`, `tabs.query`, `tabs.onUpdated`; none needs a manifest permission beyond the two hosts; the popup keeps its held click in `localStorage`, not `browser.storage` |
| Em-dashes in shipped copy | `git diff 5d4457d -- . ':!docs/reviews' ':!pnpm-lock.yaml' ':!apps/extension/test/fixtures' \| grep '^+.*—'` | none |
| API, packages, web, site, docs | Finder A: diffs of `apps/api`, `packages/*`, `apps/web`, `apps/site`, the docs; probes of a `__proto__` event key, gaxios 7.3.1's timeout path, and a stalled 4xx body under `AbortSignal.timeout` on Node 26 | event list, `invalid_event`, rate limit, IP forwarding, `ids` filter all hold; Finding 1 |
| Extension shell | Finder B: background, popup, first-run, manifest, messaging, watch, render, states | cache, 401 forgetting, timeouts, answer mapping, Firefox consent gating, install-only first run, once-per-navigation events hold; NFI B, F, H, J and nits |
| Studio surfaces | Finder C: card, comparison, Content list, analytics page, the #235 placer, selectors; one scratch harness on the saved Content list fixture | comparison math, ties, singular format word, placer set (#235), one read per page hold; Finding 2 |
| Finding 1 repro | New `repro/review-11-token-429.test.ts` (Testcontainers Postgres and the fake Google server) | red 2 of 2 at `2f7c8a5`: the refresh rejects with `Error: Google's token endpoint answered 429 rate_limit_exceeded`, not `TokenEndpointUnansweredError`; the code exchange throws the same instead of answering `google_failed` |
| Finding 2 repro | New `repro/review-11-collabs.test.ts` (jsdom, the saved Content list fixture) | red 1 of 1 at `2f7c8a5`: two Content list hosts, "Data from Stillstats as of 7 Oct." and the "engaged views" pill, stay after a move to `/videos/collabs` |
| Findings 1 and 2 recommended fixes | Applied together in a scratch worktree at `2f7c8a5` under the scratchpad, then removed | the first draft of Finding 2's fix (remove on every pass off the surface's page) turned `content-list.test.ts:722` red; the recorded fix (only on a pass on the URL WXT reported) is green: whole repro suite 28 of 28, `apps/extension` 21 files, 473 tests, plus a scratch check that a return from Collabs to the Videos tab shows the line, the pill and every row's figure again |
| Tautology audit | Agent: a scratch worktree at `5d4457d`, the 13 modified test files and `packages/api-types/src/channels.test.ts` copied in with the branch's test helpers (and the branch's fake Google server for the files that need its new handlers), run per file; shape read of the new extension tests | see Test quality |
| Live browsers | Not run: no browser in a review | NFI B, C, F, J need #99 or #101 |
| OpenPanel's header and body contract | Not fetched: no OpenPanel source or docs read this round | NFI I |

**Repro command for this round's repros:** `pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts docs/reviews/creator-analytics-4/repro/review-11-token-429.test.ts docs/reviews/creator-analytics-4/repro/review-11-collabs.test.ts` from the repo root. Docker must be running for the token repro.

**Overall:** All four CI checks are green at `2f7c8a5`, and a fresh read of the whole branch found no CRITICAL, HIGH or MEDIUM defect. Review 10's three findings, now landed as #234 and #235, hold: the placer's set of placements leaves no other video's figure or line up across a read. Two LOW behaviour findings are confirmed by executed repros, both capped on attainability no fixture or log shows, plus one test hygiene entry and one comment hygiene entry. The PR can open; the findings fit one remediation round.

## Approach decisions
- **Analytics link window (review 1 F1):** the extension always writes `window` into the detail link, lifetime included. Unchanged.
- **Watch stop (review 1 F2, F3):** `stop()` removes every host through `removeSurface` and clears `again`; no `stopped` flag. Unchanged.
- **Give-up URL (review 1 F4, #210, #217):** the give-up judges the navigation WXT reported, held in `nav`; `giveUp` sets `nav.reached` when `url() === nav.url`. Unchanged.
- **Dropped navigation (#215, #217):** only a reached navigation may become `previous`; each navigation record carries its own count. Unchanged.
- **Session cache (review 1 F5):** a 401 from any *read* forgets the kept channels and video reads, in `readSignedIn`. An event send is not a read and stays out of it. A read already in flight that answers after the clear is kept. Unchanged.
- **Background answers (review 1 F6):** the rejection to failed-value mapping lives in `backgroundAnswerer`. Unchanged.
- **Hung reads (#211):** every background fetch carries `AbortSignal.timeout(answerWithinMs)`, 15 s by default, per fetch. Unchanged.
- **Row sweep (review 3 F1, #215, #217, #224):** an optional synchronous `sweep(document, passAgain)` on `Surface`, run from `schedulePass`'s timer outside the pass lock, for every surface whatever its `isOn` says. Unchanged.
- **Comparison retry and window (review 3 F2, #215, #218, #224):** unchanged.
- **Content list page elements (#219, #226, #230, `e380c84`, #232):** the line goes directly after Studio's page header (`pageTitleIn`), and the pill's anchor directly after the Views heading's `h3` (`viewsWordLineIn`), never inside it. The page elements come down together. Unchanged.
- **Content list page elements once the video list goes (review 9 F1, review 10 F1, #234):** the sweep takes the page elements down when `videoListIn(document)` finds no list, on the second sweep in a row while the re-read of the answered rows is out, on the first otherwise; one counter, `emptySweeps`. Unchanged.
- **A surface whose page the URL leaves (new, Finding 2, closes review 10 NFI A's recorded candidate):** the watch's `placeAll` takes down the elements of every surface whose `isOn` is false for the pass's URL, with `removeSurface(document, surface.name)`, but only on a pass on the URL WXT reported (`!ahead`). A pass ahead of WXT's report removes nothing, since the navigation WXT reported may still be judged on it (`content-list.test.ts:722`). Precedent: `stop()`'s own `removeSurface(document, surface.name)` loop (`watch.ts:332`). The surfaces' own sweeps and placers stay as they are; a surface coming back on a later navigation re-reads and re-renders as any navigation does.
- **Analytics placement and not-found (#225, review 6 F1, #228, #229):** unchanged.
- **Analytics placement across redrawn anchors (review 8 F1, #232, review 9 F2, review 10 F2 and F3, #235):** the placer keeps `mayBeUp`, the set of every placement that may still be up, and judges each entry before a read. Unchanged, verified this round.
- **Default row render (review 6 F2):** `renderSurface` draws the card's row only and takes no link. Unchanged.
- **Preserved repros (review 6 F3, amended by review 8 F3):** a stale repro fixture is brought up to the current rule by adding the data the rule needs, never by changing its assertions, unless a later ticket changed the rule on purpose in a recorded assumption. Unchanged.
- **Google call bound and outage mapping (#214, #216, #222, #227, #231, #233):** every token endpoint call is bounded at `googleCallTimeoutMs`; no answer, a stalled body, a 5xx, or an unusable 200 is `TokenEndpointUnansweredError`, which the gateway and the connect callback end as `google_failed`; `invalid_grant` is a revocation; any other status stays a plain error. Amended by Finding 1: a 429 joins the 5xx as an outage.

## Confirmed Issues

### 1. A token endpoint that answers 429 ends a read or a connect on an internal error, not `google_failed` — LOW (capped)
- **Location:** `packages/token-vault/src/token-vault.ts:471-477`
- **Attribution:** pre-existing, untouched for 429. At `5d4457d` every non-2xx answer except `invalid_grant` was a plain `Error` (`git show 5d4457d:packages/token-vault/src/token-vault.ts`, line 400: `throw new Error(\`Google's token endpoint answered ${response.status} ...\`)`). The branch's `0b465bc` (#216) moved the 5xx to `TokenEndpointUnansweredError` (`git log -S'response.status >= 500' 5d4457d..HEAD`) and left 429, Google's rate limit, where the base had it.
- **Real-world trigger:** Google's token endpoint answering 429 to a refresh or a code exchange under load. Not seen on the deployed product. LOW, capped: upgrade to MEDIUM if GlitchTip holds any event whose message is "Google's token endpoint answered 429", check via a GlitchTip search for that string on the API project.

**Evidence**
```ts
if (error === 'invalid_grant') throw new GoogleRefusedGrantError()
// A 5xx is Google's own failure, an outage like no answer at all.
if (response.status >= 500) {
  throw unanswered(undefined, `Google's token endpoint answered ${response.status} ${error ?? ''}`.trim())
}
throw new Error(`Google's token endpoint answered ${response.status} ${error ?? ''}`.trim())
```
`youtube-gateway.ts:415-419` turns only `TokenEndpointUnansweredError` into `google_failed` and rethrows everything else, which `app.ts:111-115` answers `500 {"error":"internal"}` and reports to GlitchTip.

**Failure mode** — a refresh answered 429 rejects with a plain `Error`, so a video list read answers 500 `internal` instead of the `google_failed` refusal; the extension shows "Try again later" either way, the web app shows its internal error state, and GlitchTip records an internal error. A code exchange answered 429 throws out of `completeConsent`, so the connect callback lands the creator on raw `{"error":"internal"}` JSON instead of the web app with `connect_error=google_failed`. Proof: `repro/review-11-token-429.test.ts`, red 2 of 2 at `2f7c8a5` (`AssertionError: expected Error: Google's token endpoint answered 4… to be an instance of TokenEndpointUnansweredError`, and `Error: Google's token endpoint answered 429 rate_limit_exceeded` from the consent).

**Recommended fix**
```diff
-    if (response.status >= 500) {
+    if (response.status >= 500 || response.status === 429) {
```
Then add two tests to `packages/token-vault/src/token-vault.test.ts` beside the 503 ones (`:496` for the refresh, `:695` for the code exchange), using the file's `answerTokenEndpoint(google, 429, '{"error":"rate_limit_exceeded"}')`, and update the comment above the check to name 429 with the 5xx (the reason: a rate limit is Google's own, as an outage is). Applied in a scratch worktree, the repro goes green and `packages/token-vault` stays green.

**Remediation brief**
- **Design intent:** `requestToken` sorts every token endpoint answer into three: `GoogleRefusedGrantError` (a revocation, `invalid_grant`), `TokenEndpointUnansweredError` (Google failed: no answer, a stalled body, a 5xx, an unusable 200), and a plain `Error` for anything that means this product is misconfigured (`invalid_client`, `invalid_request`, a 400 or 401). Only the second ends as `google_failed`. A 429 is Google's capacity, not this product's config, so it belongs with the outages.
- **Full surface:** `packages/token-vault/src/token-vault.ts:470-476` (the check and its comment); `packages/token-vault/src/token-vault.test.ts` near `:496` and `:695` (the two new tests). No caller changes: `youtube-gateway.ts:415`, `app.ts:248-258` and the probe already handle `TokenEndpointUnansweredError`.
- **Must preserve:** `invalid_grant` on any status stays a revocation (checked before the status, `token-vault.test.ts:441`); a 4xx other than 429 stays a plain `Error` (no test pins this today; the fix must not widen to all 4xx); the log line and `answer: 'none'` for an outage at the code exchange (`connect.test.ts`'s outage tests). Suites: `packages/token-vault/src/token-vault.test.ts`, `apps/api/src/connect.test.ts`, `apps/api/src/video-list.test.ts`.
- **Do not touch:** the unusable-consent path that drops Google's tokens without revoking them (Minor below); the "did not answer a call" log wording (Minor below).
- **Proof:** `pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts docs/reviews/creator-analytics-4/repro/review-11-token-429.test.ts` red now, green after; then `pnpm exec vitest run packages/token-vault/src/token-vault.test.ts`.

### 2. A move from the Content list to its Collabs tab leaves the line under the title and the pill in the Views heading up, over rows with no figures — LOW (capped)
- **Location:** `apps/extension/src/surfaces/watch.ts:201`, with `studio-url.ts:7-8` (`contentListPath`, which leaves Collabs out) and the Content list's `sweep` at `content-list.ts:232-256`
- **Attribution:** introduced. The `continue` came with `dd2473a` (#93), the Collabs exclusion with the Content list's URL rule; both are new on the branch.
- **Real-world trigger:** a creator on the Content list's Videos tab clicks its Collabs tab. The saved fixture's Collabs tab is `tp-yt-paper-tab#video-list-collabs-tab`, beside `video-list-uploads-tab`, `-shorts-tab` and `-live-tab`, which suggests Studio draws Collabs in the same `#video-list`; the fixture does not show the Collabs page itself. LOW, capped: upgrade to MEDIUM if #99 shows Studio keeps `ytcp-video-section-content#video-list` with rows on the Collabs tab, check in real Studio by opening Collabs and running `document.querySelector('#video-list ytcp-video-row')` in the console.

**Evidence**
```ts
for (const surface of surfaces) {
  if (!surface.isOn(here)) continue
```
Nothing else takes a surface's elements down when its `isOn` turns false, except `stop()`. The Content list's sweep, which runs whatever `isOn` says, takes the page elements down only when there is no list, or an empty one while a read is out (`content-list.ts:246`: `if (!empty || readingKey === undefined) return`); Collabs rows carry ids, so it returns.

**Failure mode** — after the move, `dropChangedRows` takes each row's figure down as the rows change, but "Data from Stillstats as of 7 Oct." stays under "Channel content" and the "engaged views" pill stays in the Views heading, saying figures run through a day over a table that shows none. Proof: `repro/review-11-collabs.test.ts`, red 1 of 1 at `2f7c8a5` (`expected [ <div …(1)></div>, <div …(1)></div> ] to deeply equal []`). The same `continue` leaves the analytics page's line and figure up on a move from Overview to another analytics tab if Studio keeps the key metric section in place (review 10 NFI A, unproven: the fixture holds the Overview tab only), and the card on a move off the dashboard if Studio keeps the card connected.

**Recommended fix**
```diff
     for (const surface of surfaces) {
-      if (!surface.isOn(here)) continue
+      if (!surface.isOn(here)) {
+        if (!ahead) removeSurface(document, surface.name)
+        continue
+      }
```
Then move the repro's test into `apps/extension/src/surfaces/content-list.test.ts`, in the `describe` at `:998` beside the Playlists row at `:1142`, and add one test there that a return from Collabs to the Videos tab shows the line, the pill and every row's figure again. Add one test to `apps/extension/src/surfaces/analytics.test.ts` that a move from `.../analytics/tab-overview/...` to `.../analytics/tab-reach_viewers/...`, with the key metric card left in the document, leaves no analytics host.

**Remediation brief**
- **Design intent:** a surface's `isOn(url)` says which Studio pages it may stand on; its elements belong to that page only. The watch runs passes in one lock, and the give-up judges the navigation WXT reported (`nav`), not `url()`: a pass whose `url()` differs from `nav.url` is `ahead`, placing for the navigation WXT will report next, and must not change what the reported navigation's give-up judges. So the takedown belongs in `placeAll`, gated on `!ahead`, and not in each surface's sweep (which receives no URL, and whose `document.location` in the tests is not the Studio URL).
- **Full surface:** `apps/extension/src/surfaces/watch.ts:200-201` (the loop; `removeSurface` is already imported at `:6`); `apps/extension/src/surfaces/content-list.test.ts` near `:1142` (two tests); `apps/extension/src/surfaces/analytics.test.ts` (one test); `docs/reviews/creator-analytics-4/repro/review-11-collabs.test.ts` stays as the record.
- **Must preserve:** an ahead pass removes nothing: `content-list.test.ts:722` ("a creator back on the same rows who leaves again in the last second before the give-up, before WXT reports it, is not reported missing while every row shows its figure") goes red if the gate is dropped, as the scratch run proved. The Playlists and same-page tab-page tests at `content-list.test.ts:1141-1173` and the whole `content-list.test.ts`, `watch.test.ts`, `analytics.test.ts`, `card.test.ts` and `video-row.test.ts` suites; the missing report at the give-up only for a surface `isOn(nav.url)` (`watch.ts:286`); `stop()`'s own takedown. A surface back on its page later re-reads on that navigation (content-list "A navigation reads again"), which the scratch check confirmed for Collabs then Videos.
- **Do not touch:** the Content list's `sweep` and its `emptySweeps` rule (Approach decisions); the placer's `mayBeUp` set (verified this round, Dismissed below).
- **Proof:** `pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts docs/reviews/creator-analytics-4/repro/review-11-collabs.test.ts` red now, green after; then `pnpm exec vitest run apps/extension`.

### 3. Test hygiene — LOW (aggregated)
- `apps/extension/src/popup-link.test.ts:42-49` — "a middle-click, which opens the link in a new tab, asks for the event" asserts only `expect(asked).toHaveLength(1)`, so a middle-click that asked for any other request passes → assert `toEqual([{ type: 'usage-event', event: { name: 'extension_popup_web_app_opened' } }])`, as the sibling at `:27` does (standard 2: the name states which event).

### 4. Comment hygiene — LOW (aggregated)
- `apps/extension/src/product-api.ts:13-22` — "A video read with no kept channels is two requests in a row, so it can wait twice this. … Short enough that a stalled API frees the tab's surfaces, which the watch runs one pass at a time, within a few of Studio's draws." → add the card's worst case: "The latest video card's place makes up to three video reads in a row (its figure, its format read, and the wider format read, `card.ts:44` and `:58`), so a stalled API can hold the tab's passes for up to four times this, the channels read included."

## Needs Further Investigation

### A. Analytics and card halves of Finding 2 — confirm in #99
Finding 2's fix covers them, so nothing more is needed in code. What would show the defect live: on a video's analytics page, switch Overview to Reach and look for the line and figure before the fix ships.

### B. Firefox and the SameSite=Lax session cookie from the background script — confirm in #101
`product-api.ts:118-121` and `:184-190` fetch with `credentials: 'include'`; Better Auth's default cookie (the API sets no cookie attributes, `apps/api/src/auth.ts:35`) is `SameSite=Lax`. Chrome treats a request from an extension with host access as same-site; whether Firefox 140 does for `moz-extension://` was the #92 spike's to prove, and its record was not re-read here. What would confirm a problem: #101 signed in on Firefox, the popup shows "signed in". If not, every Firefox read answers 401.

### C. `period-default` on the analytics page shows Lifetime — confirm in #99
`analytics.ts:19-36` maps `week`, `4_weeks`, `quarter`, `year` and `lifetime`; the fixture README records that Studio's nav drawer link carries `period-default`, which falls to lifetime labelled "Lifetime". That meets the spec ("If Studio does not carry the analytics period in the URL, the panel shows lifetime labelled Lifetime"), but on the commonest entry route the figure covers a different period from Studio's number. What would settle it: #99 opens the analytics page from the drawer and records whether Studio rewrites the URL to `period-4_weeks` (or another) after load. Mapping `default` by guess is not a fix.

### D. `cf-connecting-ip` is trusted from any client (carried from review 10 NFI D)
`apps/api/src/routes/events.ts`, `clientIpOf`. A request straight to the origin can set any value, and without it the socket address is Traefik's. Analytics accuracy only. What would confirm: whether the origin accepts traffic not from Cloudflare's ranges (Dokploy/Traefik config).

### E. The RISC configuration fetch has no time bound — pre-existing, untouched, follow-up ticket
`apps/api/src/risc.ts:65`: `const response = await fetch(configurationUrl)` carries no `signal`, the one Google call left unbounded after #214; the memoised promise resets only on rejection, so a hang holds every later RISC post on that process. Not in this branch's diff. What would confirm: a fake RISC configuration endpoint that never answers, and a `POST /api/risc/events` that never returns. Fix shape: `{ signal: AbortSignal.timeout(googleCallTimeoutMs) }`.

### F. A link click in a surface line may bubble into Studio's handlers — confirm in #99
`dom.ts:32-38`, `render.ts:138-146`: the shadow root's click is composed and reaches Studio's ancestors (the card, the analytics section). If one navigates or switches the chart on click, one click does two things. What would confirm: #99 clicks each line link on the card and the analytics page and watches Studio.

### G. `reportingDayOf` relies on `en-CA` formatting as YYYY-MM-DD
`comparison.ts:19-27`. If a browser's CLDR ever formats `en-CA` otherwise, `daysFrom` is `NaN` and `windowCovering(NaN)` returns `first365`, a wrong window rather than no row. What would confirm: `new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())` in current Chrome and Firefox. Hardening either way: build the day from `formatToParts`, and treat a non-finite day count as no row.

### H. Hosts in subtrees Studio detached survive `stop()`
`watch.ts:332` removes only connected hosts; a host inside a subtree Studio detached and later re-attaches comes back after an extension update with no watcher. What would confirm: a Studio redraw that re-attaches a detached card or row, which no fixture shows.

### I. OpenPanel's header order and `/track` body shape
`apps/api/src/event-relay.ts`: the comments on `IP_HEADER_ORDER` and on an OpenPanel older than 2025-11-17 reading `x-client-ip`, and the body `{ type: 'track', payload: { name, properties } }`, were not checked against OpenPanel's source this round. What would confirm: OpenPanel's server source for its track route and IP header read, or one relayed event on the self-hosted instance showing the right country.

### J. The popup's re-render after "Allow access" in Firefox — confirm in #101
`popup-page.ts:38-44`, `:83-86`: if Firefox closes the popup when its permission prompt takes focus, the re-render goes to a closed document. Harmless (the grant applies), but the "reads and renders again" behaviour is then not observable. Add a line to #101's hand check.

Review 10's NFI B, C, E, F, G and H were not re-examined in this fresh round and stand as recorded there.

## Reviewed and Dismissed
- **An event body with a `__proto__` key slips past the extra-key check** — `JSON.parse` keeps `__proto__` as an own key and the object rest sees it; probe: `{"name":"extension_installed","__proto__":{}}` is refused `invalid_event`.
- **The 60-a-minute limit lets a 61st through** — the check is `count >= 60` before the increment, on clock-minute windows, and runs before the body is read.
- **`ids` accepts ids of any length** — the fake Google server's ids (`video-1`) are not 11 characters, the ids never reach Google, and a non-matching id is left out by rule.
- **A row with no `engagedViews` shows "NaN"** — the extension and the API share `@creator-analytics/api-types`; an answer of another shape is a version skew the shared types exist to stop.
- **The popup's host-access view has no web app link** — the one action there is "Allow access"; approved copy (#92, #109).
- **The comparison row reads "First 365 days" for an upload over a year old** — the API serves no longer window after publish, and the row says what it covers.
- **A same-read card figure in a second connected card stays up** (`card.ts:32`, `root: card`) — the dashboard draws one `ytcd-entity-snapshot-item`, and an entry for another video is always removed before a read.
- **The #235 placer set leaves another video's line or figure up, places twice, or grows without bound** — finder C traced `video-row.ts:104-210`: every entry for another video, window or period is removed before keep or read; `removeSurface(root)` runs before each insert; the only residue is entries whose hosts `removeSurface` emptied, dropped on the next placement.
- **The background's `answer(request).then(sendResponse)` can reject** — `backgroundAnswerer` wraps every path in try/catch.
- **`consent.test.ts:46-49` computes its expectation from the constant production spreads** — the rule is that the web screen and the first-run page share the lines; `first-run.test.ts:239-241` pins the literal wording, so a rewording of `disclosure.ts` goes red there.
- **`channel-picker.test.ts:88` takes its expected value from the fixture** — the input's channel id is the output by rule; the test builds only its input.
- **`events.test.ts:85-86` duplicate each other** — they refuse a missing surface on two different event names, each its own schema entry.
- **`connect.test.ts:140` and `:317-319` pass at base** — the log they guard did not exist at base; at HEAD they go red if a non-`google_failed` refusal is logged as an outage.
- **The extension manifest needs `storage` or `tabs`** — it uses neither `browser.storage` nor a tab URL outside its two hosts.
- Reviews 1 to 10's other dismissals stand.

## Minor / nits
- `states.ts:72-74`, `text.ts:35-36`, `render.ts:165`: the `day: null` path ("Data from Stillstats.") is unreachable from the typed API, whose `lastProcessedDay` is a string the API always fills; `isVideoListAnswer` (`product-api.ts:74-76`) checks only `videos`. Either keep it as the malformed-body fallback and validate `lastProcessedDay` there, or drop it; the copy was proposed for approval in #225, so it is Nick's call.
- `youtube-gateway.ts:416` and `app.ts:256` log "Google's token endpoint did not answer a call" for a 5xx Google did answer; logging the error's own message (it holds a status, no identifier) would tell them apart.
- `apps/api/src/server.ts`: one or two of the three `OPENPANEL_*` set disables the relay with no log; a startup warning would catch a typo. Matches `README.md` and `docs/deploy.md` as written.
- `token-vault.ts` `completeConsent`: an unusable consent answer (no refresh token, or no ID token subject) drops Google's tokens without revoking them; at base the same case threw, so nothing regressed. Candidate follow-up.
- `apps/site/privacy.html:85-88` says the extension sends "those ids"; it also sends the selected period (`product-api.ts:35-51`). `first-run.ts:14` says it sends usage events, which Firefox does not when the creator declines. Both are approved copy; they belong with #202.
- `manifest.ts:35-46`: no `minimum_chrome_version`, though `render.ts` uses `1lh` (Chrome 109) and `color-mix()` (Chrome 111).
- `product-api.ts:133-145`, `:171-181`: no in-flight sharing, so two cold reads of the same key each fetch. Cost only.
- `content-list.ts:271-288`: a tab Studio draws genuinely empty (a Live tab with no streams) reports `extension_surface_missing`, as the card does for a channel with no uploads. A metric-definition question for Nick, not a defect.
- `product-api.test.ts:343` asserts only `toHaveLength(5)` of the requests; naming the URLs, as its sibling near `:470` does, would show which read went back to the API.

## Test quality
Test files added or modified: 37 (24 added, 13 modified) · red at `5d4457d` by construction (module under test absent): 23 files, every `apps/extension` test plus `apps/api/src/events.test.ts` and `event-relay.test.ts` · run at base: 14 files, 71 added or changed test blocks · green at base: 14 blocks. Of those: `channels.test.ts:57` (an extension-origin read is not refused) is a regression guard named so in `f9b5333`; `video-list.test.ts:1818` and `:2214` pin the order of the `ids` and visibility checks; `scopes.test.ts:588`, `:603`, `:630`, `:641` and `seed-ids.test.ts:45`, `:58` guard the test harness and were proved against the base harness or by mutation; `channel-picker.test.ts:82`, `:88` guard an unchanged rule; `connect.test.ts:140` and `:317-319` see Dismissed. `video-list.test.ts:2482` ("twenty list requests in flight at once…") is `0fa5357`'s named proof but failed only 2 of 7 base-harness runs, so the reliable proofs of that harness fix are `scopes.test.ts:588` and `:603`. Tautology shapes: no `vi.mock`, no snapshots, no assertion-free test; one name-versus-assertion gap (Finding 3); `apps/extension/test/api-boundary.test.ts` and `studio-boundary.test.ts` read source text by design, with their limits stated, and miss an aliased `fetch`.

## Prior-review closure
Fresh review: the earlier docs' findings were not re-scored one by one. Review 10's three behaviour findings were taken by #234 (Finding 1) and #235 (Findings 2 and 3), both landed before this round; finder C's trace of the placer and the preserved repros `review-10.test.ts` and `review-10-placer.test.ts`, green in the repro suite, show them closed. Review 10 NFI A is now Finding 2.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and `pnpm test` all green at `2f7c8a5`, and lint stays green with this review's repros (450 files). The preserved repro suite (not in CI) is red 3 of 28 by design until Findings 1 and 2 are fixed.
- **Commit hygiene:** commit this doc, `repro/review-11-token-429.test.ts` and `repro/review-11-collabs.test.ts`. The tree was clean before the review.
- **Likely reviewer asks:** the ready-for-human tickets under #4 (#99, #100, #101, #122, #129, #200, #202) and the needs-triage ones (#121, #126, #221); NFI B and C as #101 and #99 checks; NFI E as a follow-up ticket.

## Verdict
**Ready to open the PR, with follow-ups.** No CRITICAL, HIGH or MEDIUM finding; all four CI checks pass, and review 10's findings are closed by #234 and #235. Findings 1 and 2 are LOW, each capped on attainability no fixture or log shows, with executed repros and fixes proved in a scratch worktree; they and the two hygiene entries fit one remediation round, and none gates the PR. NFI E (the RISC fetch) is pre-existing and goes to a follow-up ticket.
