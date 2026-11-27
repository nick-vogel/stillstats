# Pre-PR review: creator-analytics#4 Studio extension

**Branch:** `creator-analytics-4-studio-extension` vs `origin/main` (merge-base `5d4457d` "Merge pull request #193 from nick-vogel/creator-analytics-64-web-dashboard-metrics-profile")
**Reviewed at:** HEAD `5dbebaa` ("creator-analytics#230 Content list: put the engaged views label beside Studio's word Views, and the day under it, inside the heading"), clean tree, no uncommitted or untracked files at review time. Whole branch: 142 files, +23,043 / −173, 387 commits. The only file this review adds is its own repro, `repro/review-8.test.ts`.
**Delta under review:** none. A fresh, whole-branch review (`--fresh`), not delta-scoped to review 7.
**Reviewed against:** epic creator-analytics#4 (its spec, user stories and implementation decisions) and its closed and carried sub-issues, read most closely for #227, #228, #229 and #230, the four tickets landed since review 7; the run's recorded assumptions for #228, #229 and #230 (`.epic-loop/tickets/<n>/assumptions.md`); `CODING_STANDARDS.md` rules 1 to 3; `CONTEXT.md`, ADR 0008, ADR 0013, `README.md` and `docs/deploy.md` as the branch changes them; review 7's Approach decisions, NFIs and dismissals.
**Date:** 2026-10-15
**Reviewer:** 3 code-review agents, 1 tautology-audit agent, plus a verify pass

## What was verified and how

| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | green, lockfile unchanged |
| Lint | `pnpm lint` | green (442 files) |
| Typecheck | `pnpm typecheck` | green, every package |
| Build | `pnpm build` | green, both extension builds included |
| Full suite | `pnpm test` (Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | green: 106 files, 2,225 tests |
| Preserved repro suite | `pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts` | **red**: 8 files, 17 tests, 3 failed. The "another period" row of review 6's `review-6.test.ts` has been red since #228 (Finding 3); this review's 2 new rows in `review-8.test.ts` are red by design (Finding 1) |
| API `ids` filter: scope, tenancy, paging, parsing | Agent read of `video-list.ts`, `routes/videos.ts` | holds: the filter runs over the route channel's own uploads under `database.asUser`; `pageSize` is capped at the distinct id count; a repeated `ids` is refused through `singleQueryOf`; empty, `a,,b`, a trailing comma, more than 50 and a space each answer `invalid_ids` |
| Event relay: names, values, privacy, limiter, 401 | Agent read of `routes/events.ts`, `event-limit.ts`, `event-relay.ts` | holds: fixed lists match the spec; any extra key, an unknown surface or non-JSON is refused; only `{ name, properties: { surface? } }` leaves; the limiter keys on the user id and clears per window; the route sits inside `signedIn` |
| CORS | `grep` for a CORS middleware in `apps/api/src` | none exists, so nothing is opened to other origins |
| Google call bounds and `google_failed` landings (#214, #216, #222, #227) | Agent read of `token-vault.ts`, `youtube-gateway.ts`, `app.ts` and gaxios 7.3.1 | hold for every unanswered call, a stalled body and a 5xx. A malformed ID token still ends on a raw 500 (Finding 4, pre-existing) |
| Background cache, timeout, 401 clearing, install handler, host-access watch, manifest | Agent read and runs of 11 extension unit and boundary test files (146 tests) plus `test/manifest.test.ts` (22 tests, real WXT builds); a Node probe of the real `product-api.ts` | hold, except the in-flight write-back after another read's 401, dismissed since review 1 (see Dismissed) |
| Built Chrome manifest against the Chrome Web Store's required keys | `apps/extension/.output/chrome-mv3/manifest.json` after `pnpm build`; developer.chrome.com's manifest reference (rung 4, the vendor's own docs domain: no skill, docs MCP or context7 covers Chrome's manifest) | the store requires `description` and `icons`; the built manifest has no `description` (Finding 2) |
| Studio surfaces: placement, removal, navigation, events | Agent read of `surfaces/` and `selectors/`; 266 surface tests run green | hold for every path traced, except a whole key metric card redrawn on a move (Finding 1, executed) |
| Analytics line of the page before during a card redraw | New repro `repro/review-8.test.ts`, run through the repro config | red 2 of 2: the line linking the page before (`NDha0z6zDA8`, `window=last90`) stays up while the new read is out |
| Attribution of Finding 1 | `git show c260156:apps/extension/src/surfaces/analytics.ts`; `git log -S'before: card'` | at `c260156` the line went `after: header`, inside the card, so a redrawn card took it away; `a0019e9` (#229) moved it before the card, outside it |
| Attribution of Finding 3 | `git log -S'expect(hosts()).toEqual(linesOpening.length'`; `.epic-loop/tickets/228/assumptions.md` | `b29b02b` (#228) changed the rule and the in-suite test on purpose and left the preserved repro as it was |
| Tautology audit | Agent: 16 modified or base-adjacent test files copied into a scratch worktree at `5d4457d` and run there (503 tests: 363 green, 140 red); the base harness swapped back in for `scopes.test.ts` | 12 branch-added or changed tests green at base; none is a tautology on the branch's product code (see Test quality). Six timeout tests hang at base (`googleCallTimeoutMs` absent) and were excluded and counted red |
| Docs conformance | Read of the `CONTEXT.md`, ADR 0008, `README.md` and `docs/deploy.md` diffs | match the code, including #229's and #230's placements |
| Em-dashes in shipped copy | `git diff 5d4457d -- . ':!docs/reviews' ':!pnpm-lock.yaml' \| grep '^+.*—'` | only inside the saved Studio fixtures (Studio's own page text); none in shipped copy |
| Live browsers | Not run: no browser in a review | NFIs below; #99, #101, #200, #229 and #230 hand checks |

**Repro command for the whole preserved suite:** `pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts` from the repo root. This round's repro alone: `pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts docs/reviews/creator-analytics-4/repro/review-8.test.ts`.

**Overall:** All four CI checks are green at `5dbebaa`, the API halves, the manifest's two hosts, the event privacy and the Google outage landings all hold, and the four tickets landed since review 7 do what they say. This fresh pass found no CRITICAL, HIGH or MEDIUM defect. It confirmed four LOWs and one comment hygiene batch: #229's line, now outside Studio's key metric card, outlives a redrawn card and keeps the page before's link up while the new read is out; the built manifest lacks the `description` the Chrome Web Store requires; review 6's preserved repro has been red since #228 changed its rule on purpose; and a malformed ID token still ends a consent on a raw 500 (pre-existing). The PR can open; none of these gates it.

## Approach decisions
- **Analytics link window (review 1 F1):** the extension always writes `window` into the detail link, lifetime included. Unchanged.
- **Watch stop (review 1 F2, F3):** `stop()` removes every host through `removeSurface` and clears `again`; no `stopped` flag. Unchanged.
- **Give-up URL (review 1 F4, #210, #217):** the give-up judges the navigation WXT reported, held in `nav`; `giveUp` sets `nav.reached` when `url() === nav.url`. Unchanged.
- **Dropped navigation (#215, #217):** only a reached navigation may become `previous`; each navigation record carries its own count. Unchanged.
- **Session cache (review 1 F5):** a 401 from any *read* forgets the kept channels and video reads, in `readSignedIn`. An event send is not a read and stays out of it. A read already in flight that answers after the clear is kept (dismissed since review 1, restated below). Unchanged.
- **Background answers (review 1 F6):** the rejection to failed-value mapping lives in `backgroundAnswerer`. Unchanged.
- **Hung reads (#211):** every background fetch carries `AbortSignal.timeout(answerWithinMs)`, 15 s by default, per fetch. Unchanged.
- **Row sweep (review 3 F1, #215, #217, #224):** an optional synchronous `sweep(document, passAgain)` on `Surface`, run from `schedulePass`'s timer outside the pass lock. Unchanged.
- **Comparison retry and window (review 3 F2, #215, #218, #224):** unchanged.
- **Content list figure and label (#219, #226, #230):** the heading host sits inside the Views heading's `h3`, directly before Studio's sort control (inside `ytcp-ve`, never inside the button), with `pointer-events: none` (#230 assumptions 1 and 2). Unchanged by this review.
- **Analytics placement and not-found (#225, review 6 F1, #228, #229):** amended from review 7 to the rule #228 and #229 set on purpose. A pass that misses the key metric header or card (`yta-key-metric-card`, the header's closest card) calls `removeSurface(document, 'analytics')` and answers `not-found`. The line, a line state's or a read answer's, needs only the header and card and goes directly before the card; the figure needs Studio's Views number too and comes on the pass that finds it (`standsOn`). A read answer shown with no Views number answers `not-found`, so the page is reported missing while its line is up (#228 assumption 1).
- **Analytics placement across a redrawn anchor (review 8 F1, new):** the placer takes down the hosts of its last placement for another video, window or period before it reads, whatever Studio element the new placement stands on, not only those held on the same `after` element. Precedent: the same-element takedown at `video-row.ts:148`, widened to the placer's last placement.
- **Default row render (review 6 F2):** `renderSurface` draws the card's row only and takes no link. Unchanged.
- **Preserved repros (review 6 F3, amended by review 8 F3):** a stale repro fixture is brought up to the current rule by adding the data the rule needs, never by changing its assertions, **unless a later ticket changed the rule on purpose in a recorded assumption**. Then the repro's assertion follows that ticket's in-suite test, and the repro keeps its name and intent.
- **Google call bound (#214, #216, #222, #227):** one per-call bound, `googleCallTimeoutMs` (10 s). A code exchange Google answers that the consent cannot use lands on `google_failed` with `answer: 'unusable'` and its own log line (#227). Unchanged.

## Confirmed Issues

### 1. On a video's analytics page, a move that redraws Studio's whole key metric card leaves the page before's line and link up while the new read is out — LOW (capped)
- **Location:** `apps/extension/src/surfaces/video-row.ts:135-148`, with `apps/extension/src/surfaces/analytics.ts:105`
- **Attribution:** introduced by `a0019e9` ("creator-analytics#229 Video analytics page: put the Stillstats line above Studio's whole key metric card, ..."), which widened review 3's carried NFI (the header replaced alone). At `c260156` the line went `{ host: line, after: header }`, inside the card, so a redrawn card took the line away with it; `git log -S'before: card'` names `a0019e9` alone. The line now sits outside the card and survives the redraw.
- **Real-world trigger:** the creator moves to another period or another video on the analytics page, and Studio answers by drawing a new `yta-key-metric-card` (the fixture's card sits behind a Polymer `dom-if restamp`, and `analytics.test.ts:362` already treats a whole-card redraw as realistic). Until the new read answers (a real request when the new period or video was not read in the last 30 s, up to 15 s when the API hangs), the line still says "Data from Stillstats as of <day>" and its "View this video in Stillstats" link opens the page before's video or window. Capped at LOW: whether Studio redraws the card on a move is unverified. Upgrade to MEDIUM if #99's walk-through shows the card element replaced on a period or video change (check: in DevTools, keep a reference to `document.querySelector('yta-key-metric-card')`, change the period, then test `ref.isConnected`).

**Evidence**
```ts
const held = placed.get(after)
const sameRead =
  held?.videoId === videoId && held.window === window && held.periodLabel === periodLabel
...
// Another video's or period's numbers never stay up while the background answers for these.
if (held && !sameRead) for (const host of held.hosts) host.remove()
```
`after` is `#key-metric-header`. A redrawn card brings a new header, so `held` is `undefined` and nothing is taken down before `readVideosAndSendHeldClicks` awaits. The old figure goes with the old card; the old line, a sibling before the card, stays.

**Failure mode** — Executed: `repro/review-8.test.ts`, both rows red. After the first page shows, the test replaces the card with a clone, moves the URL to `period-week` (or to video `AAAAAAAAAAA`), and holds the new read open. During the read the page still carries `https://stillstats.example/app/videos/NDha0z6zDA8?channel=channel-1&window=last90`. Once the read lands, `removeSurface(root, surface)` (`video-row.ts:174`) clears it, so the stale line lasts one read.

**Recommended fix**
```diff
   const placed = new WeakMap<
     Element,
     { ... }
   >()
+  let lastPlaced:
+    | { videoId: string; window: VideoWindow; periodLabel: string | undefined; hosts: readonly Element[] }
+    | undefined
 ...
     // Another video's or period's numbers never stay up while the background answers for these.
-    if (held && !sameRead) for (const host of held.hosts) host.remove()
+    const before = held ?? lastPlaced
+    if (
+      before &&
+      !(before.videoId === videoId && before.window === window && before.periodLabel === periodLabel)
+    )
+      for (const host of before.hosts) host.remove()
 ...
-    placed.set(after, {
+    const entry = {
       videoId,
       window,
       periodLabel,
       standsOn,
       hosts,
       placement,
       keptAs,
       at: Date.now(),
-    })
+    }
+    placed.set(after, entry)
+    lastPlaced = entry
     return placement
```
The existing comment line stays as it is; the diff adds none.

**Remediation brief**
- **Design intent:** `videoRowPlacer` (one instance per surface: `card.ts:16`, `analytics.ts:70`) holds each placement by the Studio element it stands after, and keeps it while the same video, window and period stand on a connected element. A placement for another video, window or period takes the old hosts down *before* it reads, so no figure or link of the page before shows while the background answers; once the read lands, `removeSurface(root, surface)` clears the rest and the new hosts go in. Since #229 the analytics line lives outside the element the placement is held by, so the early takedown must not depend on that element surviving.
- **Full surface:** `apps/extension/src/surfaces/video-row.ts:107-119` (the new `lastPlaced` beside `placed`), `:147-148` (the takedown), `:182-191` (record the entry in both). A new suite test in `apps/extension/src/surfaces/analytics.test.ts`, beside "a change of period while the background answers never draws the old period's figure or link" (`:382`), named for the rule, e.g. "a move that redraws Studio's whole key metric card while the background answers leaves no line or link of the page before". The card surface takes the same code path (`card.ts:16`); no card change is needed.
- **Must preserve:** `analytics.test.ts` "Studio redrawing its whole key metric card gets the line placed again directly before the new card ..." (`:362`: a same-read redraw takes nothing down early, the old line leaves only when the new one goes in), "Studio redrawing its Views tile alone ..." (`:345`), "a change of period in place reads the new window ..." (`:317`), "a change of period while the background answers ..." (`:382`), the `test.each` move rows at `:408-431`, "a sign-in line stays up while Studio's Views number is gone for a moment on the same page" (`:706`); every test in `card.test.ts`; the held-placement keep check at `video-row.ts:138-146`, which is untouched; `removeSurface(root, surface)` at `:174`.
- **Do not touch:** the not-found removal in `analytics.ts:84-87` and the `not-found` answer for a shown read with no Views number (`analytics.ts:118`, #228 assumption 1, see Dismissed). The fix's own failure case: a new read that hangs leaves the analytics page with nothing of the extension's until the 15 s bound ends it as "Try again later", the same as an in-place period change today.
- **Proof:** `pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts docs/reviews/creator-analytics-4/repro/review-8.test.ts` is red 2 of 2 now and must be green after; then `pnpm exec vitest run apps/extension/src/surfaces/analytics.test.ts apps/extension/src/surfaces/card.test.ts`.

### 2. The built extension's manifest has no `description`, which the Chrome Web Store requires — LOW
- **Location:** `apps/extension/src/manifest.ts:36-42` (no `description`), `apps/extension/package.json` (none for WXT to copy)
- **Attribution:** introduced; `apps/extension` is new on this branch.
- **Real-world trigger:** #100 uploads the Chrome build. developer.chrome.com's manifest reference names `description` and `icons` as the keys the Chrome Web Store requires, "A string that describes the extension on both the Chrome Web Store and the user's extension management page", at most 132 characters. The built `apps/extension/.output/chrome-mv3/manifest.json` carries `name`, `version`, `icons`, `host_permissions`, `action`, `background` and `content_scripts`, and no `description`. LOW: the upload fails at #100 and harms no user, but it blocks the epic's end state until fixed.

**Evidence** — `.output/chrome-mv3/manifest.json` after `pnpm build`: `{"manifest_version":3,"name":"Stillstats","version":"0.1.0","icons":{...},"host_permissions":["https://studio.youtube.com/*","https://stillstats.com/*"],...}`. `grep -n description apps/extension/package.json apps/extension/src/manifest.ts apps/extension/wxt.config.ts` finds nothing.

**Failure mode** — the Chrome Web Store refuses the package, or shows no summary, at #100's submission.

**Recommended fix** — add `description` to the manifest `manifest.ts` builds, with #100's short description ("See your engaged views beside the numbers YouTube Studio shows, from YouTube's official API.", 94 characters), and pin it in `apps/extension/test/manifest.test.ts` for both builds. The words are user-facing copy: confirm Nick has approved #100's short description before it lands, and if not, park the copy question rather than invent text.

**Remediation brief**
- **Design intent:** `manifest.ts` is the one source of the manifest for both browsers; `manifest.test.ts` builds both with WXT and pins every key the stores read. Firefox reads the same `description` for AMO's summary.
- **Full surface:** `apps/extension/src/manifest.ts:36-42`; `apps/extension/test/manifest.test.ts` (a test that both builds carry the description, at most 132 characters).
- **Must preserve:** every existing `manifest.test.ts` pin (two host permissions, no `permissions`, Studio-only content script, gecko id, `strict_min_version` 140, `data_collection_permissions`, the dev build's localhost origin).
- **Do not touch:** `data_collection_permissions` (NFI D).
- **Proof:** `pnpm exec vitest run apps/extension/test/manifest.test.ts` with the new test red before and green after; `pnpm build` then `grep -c '"description"' apps/extension/.output/chrome-mv3/manifest.json apps/extension/.output/firefox-mv3/manifest.json` prints 1 for each.

### 3. Review 6's preserved repro has been red since #228 changed its rule on purpose — LOW
- **Location:** `docs/reviews/creator-analytics-4/repro/review-6.test.ts:76-96`
- **Attribution:** introduced by `b29b02b` ("creator-analytics#228 Studio extension and API: the proven LOW findings from the tenth epic-loop run"). Its recorded assumption 3 changed the in-suite twin of this test (`analytics.test.ts:408-431`, "another period" now expects no figure and only the new period's line, `window=last7`) and left the preserved repro asserting `[]`. Review 7 recorded the repro suite green at `0f7bb7c`.
- **Real-world trigger:** none for users; the preserved suite is the remediation loop's red-before-green record, and a red row with no live finding behind it reads as an open regression.

**Evidence**
```ts
['another period', () => fixtureUrl.replace(/period-quarter$/, 'period-week')],
...
expect(hosts()).toEqual([])
```
Received: one host, the new period's line linking `window=last7`. That is #228's rule working, not review 6 F1 regressing: no figure stays, and the line belongs to the URL's period.

**Recommended fix** — make the row assert the #228 rule, as the in-suite test does, keeping the test's name and intent (nothing of the page before stays):
```diff
 test.each([
-  ['another period', () => fixtureUrl.replace(/period-quarter$/, 'period-week')],
-  ['another video', () => fixtureUrl.replace('NDha0z6zDA8', 'AAAAAAAAAAA')],
+  ['another period', () => fixtureUrl.replace(/period-quarter$/, 'period-week'), ['last7']],
+  ['another video', () => fixtureUrl.replace('NDha0z6zDA8', 'AAAAAAAAAAA'), []],
 ])(
   'finding 1: a move to %s while Studio has not drawn the Views number leaves nothing of the page before',
-  async (_, next) => {
+  async (_, next, windowsUp) => {
 ...
-    expect(hosts()).toEqual([])
+    expect(document.querySelector('#EXTERNAL_VIEWS-tab [data-stillstats-surface="analytics"]')).toBeNull()
+    expect(
+      hosts().flatMap((host) =>
+        [...(host.shadowRoot?.querySelectorAll('a') ?? [])].map((link) =>
+          new URL(link.href).searchParams.get('window'),
+        ),
+      ),
+    ).toEqual(windowsUp)
   },
 )
```

**Remediation brief**
- **Design intent:** the preserved repros are each finding's red-before-green proof, kept runnable. Per the amended Approach decision, a repro whose rule a later ticket changed on purpose follows that ticket's in-suite test, keeping its name and intent.
- **Full surface:** `docs/reviews/creator-analytics-4/repro/review-6.test.ts:76-96` only. Leave the header comment.
- **Must preserve:** the "another video" row's outcome (nothing up); the setup (`#metric-total`'s row removed before the move); the in-suite rows at `apps/extension/src/surfaces/analytics.test.ts:408-431`.
- **Do not touch:** `analytics.ts`; the rule is #228's recorded decision (see Dismissed).
- **Proof:** `pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts docs/reviews/creator-analytics-4/repro/review-6.test.ts` red 1 of 2 now, green 2 of 2 after. Mutation check: with the figure's takedown removed, the first assertion goes red.

### 4. A code exchange answered with a malformed ID token, or a 200 whose JSON body is `null`, still ends the consent on a raw 500 — LOW (pre-existing, untouched)
- **Location:** `packages/token-vault/src/token-vault.ts:262-267` (`subjectOf`), `:699` (`response.scope`), `:430-434` (`requestToken`'s 200 branch)
- **Attribution:** pre-existing, untouched. `git show 5d4457d:packages/token-vault/src/token-vault.ts` has the same `subjectOf` (`:246-251`). #227 landed the parsed-but-no-`sub` half of "an answer the consent cannot use lands on `google_failed`"; the unparseable half was never in its scope.
- **Real-world trigger:** none known. Google's token endpoint over HTTPS sends a well-formed JWT and a JSON object. MEDIUM is out of reach regardless: the consequence is an error page instead of the `google_failed` landing.

**Evidence**
```ts
function subjectOf(idToken: string | undefined): string | undefined {
  const payload = idToken?.split('.')[1]
  if (!payload) return undefined
  const { sub } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { sub?: unknown }
```
A middle segment that is not JSON throws `SyntaxError`; one that decodes to `null` throws `TypeError` on the destructure. A 200 body of `null` passes `response.json()` and throws at `response.scope`. None is caught between `completeConsent` and `app.onError`.

**Failure mode** — the connect or revenue callback answers `500 {"error":"internal"}` and GlitchTip records an internal error, instead of `connect_error=google_failed` / `revenue_error=google_failed` with the "answered a consent without a refresh token or an ID token subject" log.

**Recommended fix**
```diff
 function subjectOf(idToken: string | undefined): string | undefined {
   const payload = idToken?.split('.')[1]
   if (!payload) return undefined
-  const { sub } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { sub?: unknown }
-  return typeof sub === 'string' ? sub : undefined
+  try {
+    const claims: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString())
+    const sub = claims && typeof claims === 'object' ? (claims as { sub?: unknown }).sub : undefined
+    return typeof sub === 'string' ? sub : undefined
+  } catch {
+    return undefined
+  }
 }
```
and in `requestToken`'s 200 branch, a body that is not an object is `unanswered`, as a non-JSON body already is.

**Remediation brief**
- **Design intent:** `completeConsent` turns every Google answer the consent cannot use into a refusal the callback lands on (`google_failed`, `answer: 'unusable'` for an answered-but-unusable exchange, `'none'` for an outage); only a defect of our own reaches the error handler. Nothing is stored for a refused consent, and logs carry no token or identifier.
- **Full surface:** `packages/token-vault/src/token-vault.ts:262-267`, `:430-434`; tests in `packages/token-vault/src/token-vault.test.ts` beside #227's `unusable` tests, and one each in `apps/api/src/connect.test.ts` and `apps/api/src/revenue-consent.test.ts` if fake Google can issue a malformed ID token (`packages/fake-google/src/index.ts`).
- **Must preserve:** #227's tests (no `refresh_token`, no `sub`: `google_failed`, the "answered a consent without ..." log, connection unchanged); `consent_denied` for `invalid_grant`; `scopes_missing`; the outage log for `answer: 'none'`.
- **Do not touch:** the outage log's wording "did not answer a call" for a 5xx (see Dismissed).
- **Proof:** a `token-vault.test.ts` case whose code exchange answers `id_token: 'a.not-json.b'` (and one whose body is `null`) returns `{ ok: false, refusal: 'google_failed', answer: ... }`, red before, green after: `pnpm exec vitest run packages/token-vault/src/token-vault.test.ts`.

### 5. Comment hygiene — LOW (aggregated)
- **Attribution:** the first two entries are review 7's Finding 1, untouched since (no ticket carried them); the rest are introduced on this branch.
- `apps/extension/test/studio-boundary.test.ts:34-39` — "Layout reads (`getBoundingClientRect`, `offset*`, `client*`), `.title`, `.ariaLabel`, `.className`, `.href` and attribute-value selectors are not matched." → "Layout reads (`getBoundingClientRect`, `offset*`, `client*`), `.title`, `.ariaLabel` and other `aria*` properties, `.className`, `.text`, `.label`, `outerText`, `getAttribute` (how the selectors read a link's href, which the file's header trusts) and attribute-value selectors are not matched." The scanned code reads hrefs through `getAttribute('href')` (`selectors/analytics.ts:43`, `selectors/card.ts:14`, `selectors/content-list.ts:38`); a finder ran `pageRead` against `outerText`, `.text` and `.label` and none matched.
- `apps/api/src/app.ts:250-252` — "No status, no error and no token: the vault keeps the error, whose message may carry identifiers, and answers only the refusal and what Google answered." → "No status, no error and no token: the vault answers only the refusal and what Google answered, never the error, whose message may carry identifiers." `completeConsent` returns `{ ok: false, refusal, intent, answer }` and holds nothing.
- `packages/token-vault/src/token-vault.ts:275-277` — "no connection, no answer or no full body within the bound, or a 5xx." → "no connection, no answer or no full body within the bound, a 200 whose body is not JSON, or a 5xx." `requestToken` maps the non-JSON 200 to this error at `:429-433`.
- `apps/extension/test/api-boundary.test.ts:3-5` — "a static `import` of the client, not an aliased fetch or an `export ... from` re-export." → "a static `import` of the client written `'…/product-api.ts'`, not an extensionless, `.js`, double-quoted or dynamic import, an aliased fetch, or an `export ... from` re-export." The regex at `:27` requires `/product-api\.ts'`; a finder ran it against the other forms and none matched.
- `apps/extension/src/product-api.ts:107` — the comment "Only a signed-in read is kept: a creator who has just signed in sees it on the next read." sits over `isFresh`, which applies the 30 s age → move it, unchanged, to directly above `keptChannels = read.state === 'signed-in' ? ...` at `:143`.
- `apps/extension/src/surfaces/card.ts:45-46` — the second sentence, "So is one counted to an earlier day than the figure that gives no place, since a later one can.", describes the return at `:63-65`, not the `if` under it → keep "A format read with no answer is asked again, as a line is: see `videoRowPlacer`." at `:45`, and move the second sentence, reworded "A format read counted to an earlier day than the figure that gives no place is asked again too, since a later one can.", to directly above `return comparison === undefined && ...` at `:63`.
- `apps/extension/src/surfaces/watch.ts:23-24` — "Runs on the watch's tick before each pass, on every page" → "Runs on each scheduled tick, before the pass that tick starts, on every page; the give-up's pass and a pass asked for during another run with no sweep before them". `schedulePass` (`:241-254`) is the only caller of `sweep`; `giveUp` (`:279`) and the `again` loop (`:231-234`) call `pass`/`placeAll` directly.

## Needs Further Investigation

### A. A surface whose page the URL leaves keeps its hosts — confirm in #99
Carried from review 1 (NFI C), raised again this round. `watch.ts:199-200` skips a surface whose `isOn(here)` is false and nothing else takes its hosts down; analytics and the card have no `sweep`. If Studio keeps the same `yta-key-metric-card` when the creator moves from the Overview tab to Reach or Engagement, the Overview's figure and line stay, and a period change there leaves the old period's figure up. On the Content list, the heading label and day stay if the Collabs tab reuses `#video-list`. What would confirm it: #99, on a video's analytics page, switch Overview to Reach and look for the figure and line; on the Content list, switch Videos to Collabs and look for the heading label. If either stays, the fix is in `placeAll`: replace the `continue` with `{ removeSurface(document, surface.name); continue }`.

### B. Studio replacing `#key-metric-header` alone between two videos
Carried from review 3. Partly subsumed by Finding 1: its fix takes the last placement down whatever the new header is. Confirm by re-running this NFI's scenario after Finding 1's remediation; if the old line is gone during the read, close it.

### C. A `standsOn` re-read racing a navigation
A shown analytics figure whose number row Studio redraws (`standsOn` differs, same video and period) reads again without a takedown; if the URL moves during that read, the old figure stays one read longer, until the pass after. Needs Studio to redraw the number row before it pushes the new URL, an ordering no fixture shows. What would confirm it: a recording in #99 of the DOM mutations around a period change.

### D. Firefox's data declaration may need `websiteContent` or `browsingActivity`
Carried from review 1 (NFI A), unchanged: settle at #100 with AMO.

### E. The Content list heading's day may be clipped, and the label may cover Studio's Date heading at the narrowest column
The day draws at `top: 1lh` under the `h3`'s one line (`render.ts:78`); if a Studio ancestor sets `overflow: hidden`, it is clipped. At the narrowest Views column, a finder's estimate puts the pill about 80 px over the Date heading, where a click falls through to Date's sort. #230 assumption 3 accepted the overlap for the hand check. What would confirm it: #230's Chrome hand check at the narrowest Views column.

### F. `cf-connecting-ip` is trusted from any client
`routes/events.ts`'s `clientIpOf` takes `cf-connecting-ip` as sent. If the API origin is reachable without Cloudflare, a client can choose the IP sent to OpenPanel (analytics pollution only). What would confirm it: whether the origin accepts traffic from outside Cloudflare's ranges (Dokploy/Traefik firewall, `docs/deploy.md`).

### G. The popup's storage calls may throw
`popup.ts:135-146` reads and removes the held sign-in click from `localStorage` outside any catch, so a storage that throws (Firefox with storage blocked) would reject `show()`, which `entrypoints/popup/main.ts:17` runs under `void`. What would confirm it: #101, in Firefox with cookies and site data blocked, open the popup and watch the console.

## Reviewed and Dismissed
- **A 200 in flight when another read's 401 clears the caches is written back (`product-api.ts:143`, `:179`)** — executed again by a finder this round; dismissed in reviews 1 to 6 and recorded in the Session cache Approach decision. The read is the creator's own, answered while signed in, and the next read past 30 s, or any read that meets the 401, says signed out. Not reopened.
- **The popup's failed channel read shows only "Open Stillstats"** — #106's recorded decision: no approved failure line, and "signed out" would be wrong.
- **The analytics page reports `extension_surface_missing` while a read answer's line is up and the Views number is missing (`analytics.ts:118`)** — #228 assumption 1, on purpose: the figure is the surface's point; pinned by `analytics.test.ts:575`.
- **The Content list heading host sits inside `ytcp-ve`, not as the `h3`'s first child** — #230 assumption 1 (review pass 1 F1.8 moved it there so Studio's white space does not draw between the label and "Views"); #230's Done-when ("inside the Views heading's `h3`, before the sort control") holds.
- **The outage log says "did not answer a call" for a 5xx Google did answer** — the wording #222 and #228 specified, asserted by `revenue-consent.test.ts` and `connect.test.ts`.
- **A token endpoint 4xx other than `invalid_grant` ends on a raw 500** — carried nit from reviews 6 and 7; the spec's bound covers unanswered calls.
- **`consent.test.ts:46` takes its expectation from the constant production spreads** — it pins the wiring (the connection screen ends with the shared lines); the words are pinned in `apps/extension/src/first-run.test.ts:239`.
- **`content-list.test.ts:378` names layout outcomes but checks declared styles** — the file header (`:3-12`) states jsdom's limits and names the hand check.
- **The extension-origin tests in `channels.test.ts:61` and `events.test.ts` pass with no product change** — declared regression guards against a future origin check.
- **`risc.ts:65`'s `fetch` has no signal** — outside the diff; `modules.ts` scopes `googleCallTimeoutMs` to the gateway's and the vault's calls.
- **No CORS middleware** — nothing is opened; the background's requests are same-site by host permission.
- **The `ids` filter, the event relay's validation and the limiter** — checked and holding (see the table).
- Reviews 1 to 7's other dismissals stand.

## Minor / nits
- `POST /api/events` sets no body-size limit (`routes/events.ts`); the limiter caps count, not size. `bodyLimit({ maxSize: 1024 })` would close it.
- `routes/videos.ts:49` accepts an id of any length; YouTube ids are 11 characters, but fake Google's ids are not.
- An `unusable` code exchange that still carries a refresh token leaves an offline grant at Google unrevoked, as `scopes_missing` already does.
- `product-api.ts`'s freshness uses `Date.now`; a clock moved back keeps a read fresh longer than 30 s.
- Concurrent cold reads each fetch `/api/channels` (no in-flight sharing); dismissed for correctness in review 1.
- Two overlapping popup `show()` runs could both send the held sign-in click; no reachable path found.
- The background's `tabs.onUpdated` wakes the Chrome service worker on every tab load; a known cost of registering before the first await.
- The analytics selectors take the first match in the whole document; a hidden second analytics screen is not known to exist.
- A shown card or analytics figure is kept while its Studio element stands, so a long-lived tab's "Through <day>" does not refresh.
- During a read for a new Content list page, the outgoing page's heading label stays; same channel, same day.

## Test quality
Tests added or changed by the branch in the 16 audited files: 503 run at `5d4457d` · red at base: 140 (4 files fail to import; 6 timeout tests hang at base and are counted red) · branch-added or changed tests green at base: 12 · tautology shapes: 1 mild (`consent.test.ts:46`, Dismissed). The 12: `channels.test.ts:61` (2, declared regression guards); `connect.test.ts:141` (2) and `:278` (#228's log-guard proofs, red under the mutation #228 recorded, green at base only because base never logged the line); `video-list.test.ts:1818` (pins `ids`-last order, cannot show `ids` works) and `:2214` (#206 proof, red under its recorded mutant); `video-list.test.ts:2482` (a labelled smoke test, #198 F9); `scopes.test.ts:630` and `:641` (harness edge cases, green against the base harness too, so they cannot tell "no queue" from "a correct queue"; the other two #198 scopes tests go red against it); `seed-ids.test.ts:45` and `:58` (self-contained meta-tests). None needs deleting. The extension's own test files are new and red at base by construction. Gaps: no test pins that a 401 from `sendEvent` leaves the kept reads in place (`product-api.test.ts`); `host-access.test.ts:52-61` tests a manifest with no host origins, which the built manifest never is. Review 6's notes (`content-list.test.ts:1183-1188`, `analytics.test.ts:286-297`, `card.test.ts:817-853`) stand.

## Prior-review closure
Fresh round, not delta-scoped. Review 7's one finding (comment hygiene, LOW) is untouched: neither entry was carried into #228, and both are repeated as the first two entries of Finding 5 here. Review 7 had no MEDIUM-or-higher finding. Its NFI D (a line state needs Studio's Views number) was closed by #228 item 4 and #229, which is also why review 6's repro went red (Finding 3).

## Before opening the PR
- **CI readiness:** lint, typecheck, build and `pnpm test` all green at `5dbebaa`. The preserved repro suite (not in CI) is red 3 of 17: one row is Finding 3, two are this review's Finding 1 repro.
- **Commit hygiene:** commit this doc and `repro/review-8.test.ts`. The tree was clean before the review.
- **Likely reviewer asks:** the ready-for-human tickets under #4 (#99, #100, #101, #122, #129, #200, #202) and the needs-triage ones (#121, #126, #221); #227 to #230 open though their work is on the branch; the copy awaiting Nick's approval (#218's "Publish day" and "First N days", #225 and #229's analytics line, #100's short description); #229's and #230's Chrome hand checks; NFI D before the AMO submission and Finding 2 before the Chrome Web Store upload.

## Verdict
**Ready to open the PR, with follow-ups.** No CRITICAL, HIGH or MEDIUM defect; all four CI checks pass. Nothing gates the PR. Finding 1 (a stale analytics line for one read's length after a card redraw, capped LOW until #99 shows the redraw) and Finding 3 (a stale preserved repro) are small and worth fixing in this branch; Finding 2 must land before #100's Chrome upload; Finding 4 is pre-existing and fits a follow-up ticket; Finding 5 is one comment commit.
