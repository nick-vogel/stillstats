# Pre-PR review: creator-analytics#1037 Make Stillstats faster

**Branch:** `creator-analytics-1037-make-stillstats-faster` vs `origin/main` (merge-base `20a6c7c2`, "Merge pull request #1059 from nick-vogel/creator-analytics-938-drop-copy-pins", which is origin/main's tip)
**Reviewed at:** HEAD `7aea7d5f` (creator-analytics#1054 Extension timing: the time from a surface element to its figure) + 0 files with uncommitted changes, 0 untracked files in the diff (the gitignored `.epic-loop/` and `docs/HANDOFF-*.md` are outside the review), 80 files total, +6154 / −360
**Reviewed against:** epic #1037's body (its spec), the bodies of its five closed children carried here (#1051, #1052, #1053, #1054, #1055), ADR 0023, `CONTEXT.md`, the README's Development and analytics sections, the global rules in `~/.claude/rules/`, the repo rules in `.claude/rules/` (`youtube-test-limits`, `row-level-security-tests`), and the open LOW findings already filed as sub-issues #1061 to #1107 of collector #1060. The repo has no `AGENTS.md` or `CLAUDE.md`. #1056, #540 and #555 are open and not in this branch, so their absence is not a finding. This is review 1, so it is not delta-scoped.
**Date:** 2026-11-24
**Reviewer:** 3 code-review agents + 1 tautology-audit agent + verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Lint | `pnpm lint` | green (874 files) |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` | green |
| Test suite | `pnpm test` (Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset), machine load 37 to 53 during the run | 228 files, 5960 passed, 11 failed, 1 expected fail. All 11 failures were `Test timed out in 5000ms`, in `channel-history`, `sponsor-report`, `traces`, `upgrade-preview`, `video-detail` and `video-list` |
| Re-run of the 6 timed-out files | `pnpm exec vitest run apps/api/src/{channel-history,sponsor-report,traces,upgrade-preview,video-detail,video-list}.test.ts`, load about 13 | green, 6 files, 280/280. The timeouts were load flakes, not findings |
| Browser walk | `pnpm run --if-present test:browser` | green ("The browser walk passed."). Two earlier runs were killed by session restarts, not by a failure |
| Node version | `node --version` in this shell | v26.3.0; `.node-version` and `engines` say 24, which CI uses. Every check above ran on 26 |
| Tautology audit (Phase 4.5) | The branch's 30 changed `*.test.ts` (plus 4 additive support files) copied into a scratch worktree at `20a6c7c2` and run there | 212 in-scope cases ran: 202 red, 10 green. A further 55 are red because their files cannot import code that base lacks. `traces-off.test.ts` is red too (its `beforeAll` throws). See Test quality |
| Server-Timing writer against the walk's parser | Finder B imported `timingOfServerTiming` and fed it `serverTimingOf`'s output joined with Cloudflare's entries, in both orders | identical result with and without Cloudflare's entries. Cloudflare's own format, from the Cloudflare docs MCP (rung 2, changelog "New cfWorker metric in Server-Timing header", 2026-02-18): `cdn-cache; desc=DYNAMIC, edge; dur=20, origin; dur=100` |
| Sentry SDK behaviour | Read in the installed `@sentry/node`, `@sentry/core` and `@sentry/server-utils` 11.4.0 build (the version in `pnpm-lock.yaml`), not from memory | the claims in findings 2 to 4 and in Dismissed cite file and line |
| Finding 1 repro | `docs/reviews/creator-analytics-1037/repro/repro-redraw-timing.test.ts`, run in a scratch worktree at `7aea7d5f` | red: `ms: 0`, `fromCache: true` where the creator waited 1,200 ms on a cold read |
| Finding 2 repro | `repro/repro-incoming-trace-header.test.ts`, same worktree | red: the request carrying `sentry-trace: ...-0` sent no transaction at a rate of 1.0 |
| Findings 3 and 4 repro | `repro/repro-scrub-unlisted-keys.test.ts`, same worktree | red, both cases |
| A signed-out request's trace | Scratch test in the same worktree, deleted after: `/api/me` signed out and signed in, at a rate of 1.0 | signed out (401) sends no transaction; signed in (200) sends one. The cause is the SDK's default status filter (comment hygiene entry 4) |
| Repro lint | `pnpm exec biome check docs/reviews/creator-analytics-1037/repro` | green (3 files). The root vitest include (`{apps,packages}/*/{src,test}/**/*.test.ts`) never runs them in `pnpm test`, and no `tsconfig` covers `docs/` |
| Not run | Typecheck of the repro files | they live outside every package's `tsconfig`; each is run by copying it into its package (see each brief), where `pnpm typecheck` covers it |

**Overall:** the five tickets fit together. The walk reads the header the API writes, and ignores whatever a proxy adds. The trace's cache result comes from the same request's timing record. The relay accepts the extension's new shape and the old one. Nothing adds a Google call or a quota cost. One cross-ticket defect matters before the baseline collects: the extension's figure time reads about 0 ms and "from cache" whenever Studio redraws a surface's element while its cold read is out (finding 1), which skews exactly the number #540 and #555 wait on. Three LOW findings sit in the trace path, and one pre-existing LOW sits in the error path. Fix finding 1, then open the PR.

## Approach decisions
- A read whose result the extension could not draw keeps its start and its cache result for the navigation's own pass, through a `Cut`-style answer (`cutFrom(fromCache)`, `apps/extension/src/surfaces/page-watcher.ts:44`), as the read-ahead record already does for a read a navigation cut (`noteReadAhead`, `page-watcher.ts:370-389`). A redraw during the read joins that mechanism through a sibling answer, `Redrawn`, which carries the read's cache result and the placement the missing judgments must keep reading (`'not-found'`, or `'placed'` for Shorts). Amended 2026-11-24 after the second-opinion review (`pre-pr-review-2.md` and its notes on this doc): a bare `Cut` would turn Shorts' `'placed'` into `'not-found'` (finding 1).
- Whether a request is traced is decided by the API's own rate, never by a caller's header: each request's root span starts a new trace (`Sentry.startNewTrace`, exported by `@sentry/node` 11.4.0) (finding 2, new this round).
- The trace scrub is an allowlist at every level, as ADR 0023 says: the event's top-level keys, each span's keys and the trace context's keys are named, and the tags and data keep `scrubTraceData`'s list (finding 3, new this round).
- An error event's free-text fields go through `maskSecrets`, which keeps an internal ID and masks a YouTube ID, the policy the error scrub already applies to messages (finding 4, new this round).

## Confirmed Issues
### 1. A figure drawn after Studio redraws its element during a cold read is reported as about 0 ms and from cache — MEDIUM
- **Location:** `apps/extension/src/surfaces/page-watcher.ts:313-316` (the start) and `:340-355` (the shown event)
- **Attribution:** introduced in `5cfbbbe9` (creator-analytics#1054 Extension timing: the time from a surface element to its figure). The start expression took its current shape in `c576c1c5` (creator-analytics#1054 review pass 2 finding 2). `git log -S'const start = surface.found' 20a6c7c2..HEAD` names it, and base has no timing at all. It is a different class from #1087 to #1090: no navigation is involved, only a redraw inside one navigation.
- **Real-world trigger:** a creator opens the Studio dashboard, the Content list or a video's analytics page on a cold read (the background's 30-second keep is empty, for example on the first open of the day). Studio redraws the card's Views row, the list header or the title while the read is out, or the analytics page's read lands before Studio draws its Views number. The surface answers `'not-found'`, the next pass draws at once from the keep, and the event carries that pass's few milliseconds with `fromCache: true`. MEDIUM, capped: telemetry only, never a creator's figure, but it is wrong results silently delivered, and the baseline (#1056) and #540 and #555 read this number. How often Studio redraws within a cold read is unknown. Check during the baseline: in OpenPanel, the share of `extension_surface_shown` with `fromCache: true` and `ms` under 50 on a creator's first Studio open of a day, when the keep cannot be warm.

**Evidence**
```ts
const calledAt = Date.now()
const start = surface.found
  ? Math.max(passStart, seen.get(surface.name) ?? calledAt)
  : passStart
...
ms: msFrom(early?.since ?? start, shownAt),
fromCache: (early?.fromCache ?? true) && answer.fromCache,
```
`start` is the later of this pass's due time and the first sighting, so on a second pass it is always the second pass. The read the creator waited through on the first pass is lost, and so is its cache result: the surfaces answer a bare `'not-found'` for a redraw (`video-row.ts:181`, `:189`, `:200`; `content-list.ts:376`; `watch-page.ts:70-73`; `shorts.ts:193-196` answers `'placed'`; `analytics.ts:132` demotes a shown answer with no Views number).

**Failure mode** — executed in a scratch worktree at `7aea7d5f` with `repro/repro-redraw-timing.test.ts`. A `card` surface is found from the start; its first place call waits 1,200 ms, Studio appends a node (a redraw), and it answers `'not-found'`; its second answers `shownFrom(true)`. Expected `ms >= 1200` and `fromCache: false`. Received:
```
-   "fromCache": false,
-   "ms": toSatisfy<[Function anonymous]>,
+   "fromCache": true,
+   "ms": 0,
```
The README (`README.md:163`) says `ms` runs "from the moment the pass that found the surface's element was due, or the moment the extension first saw the element". The code times from the pass that drew.

**Recommended fix** (amended 2026-11-24 after the second-opinion review) — give a redraw the same treatment the read-ahead record gives a cut read, through a sibling answer. Add to `page-watcher.ts`, beside `Cut`:
```ts
/** A read landed, but the page redrew the surface's element: nothing drawn, the read's cache result kept. */
export interface Redrawn {
  placement: 'redrawn'
  fromCache: boolean
  /** What the missing and give-up judgments read this answer as, as they read the bare answer it replaces. */
  counts: 'placed' | 'not-found'
}
export const redrawnFrom = (fromCache: boolean, counts: Redrawn['counts']): Redrawn => ({ placement: 'redrawn', fromCache, counts })
```
with `Redrawn` in `PlaceAnswer`, and `placementOf` answering `answer.counts` for it, so every missing and give-up judgment reads exactly what it reads today. Do not reuse `Cut`: its comment says the page navigated, and `placementOf` maps it to `'not-found'`, which would change Shorts' `'placed'`. The watch keeps, per navigation and per surface, the `{ since, fromCache }` of the first redrawn answer, and folds a later one in:
```diff
+      if (typeof answer !== 'string' && answer.placement === 'redrawn' && !nav.shown.has(surface.name)) {
+        const tried = nav.unplaced.get(surface.name)
+        if (tried) tried.fromCache &&= answer.fromCache
+        else nav.unplaced.set(surface.name, { since: early?.since ?? start, fromCache: (early?.fromCache ?? true) && answer.fromCache })
+      }
       if (
         typeof answer !== 'string' &&
         answer.placement === 'shown' &&
         !nav.shown.has(surface.name)
       ) {
         nav.shown.add(surface.name)
+        const tried = nav.unplaced.get(surface.name)
         const timed =
           early && 'ms' in early
             ? early
             : {
-                ms: msFrom(early?.since ?? start, shownAt),
-                fromCache: (early?.fromCache ?? true) && answer.fromCache,
+                ms: msFrom(tried?.since ?? early?.since ?? start, shownAt),
+                fromCache: (tried?.fromCache ?? early?.fromCache ?? true) && answer.fromCache,
               }
```
with `unplaced: new Map<ExtensionSurface, { since: number; fromCache: boolean }>()` added to the navigation's state beside `shown` (`page-watcher.ts:189-195`), so it resets with each navigation. A surface answers `redrawnFrom(fromCache, 'not-found')` only where its read succeeded and the element was redrawn; a line state or a failed read keeps its bare `'not-found'`, so a later figure never inherits a failed read's start. Shorts answers `redrawnFrom(fromCache, 'placed')` where it answers `'placed'` today.

**Remediation brief**
- **Design intent:** one `extension_surface_shown` per surface per navigation (`!nav.shown.has`), timed from the moment the extension could first act on the surface's element (the pass that found it, or the first sighting when later) to the figure showing, with `fromCache` true only when every answer the figure waited on came from the API's cache or the background's keep. `placementOf` turns every non-shown answer into the placement the missing judgments read, so a `Cut` already counts as `'not-found'` there. The read-ahead record (`ReadAhead`, `noteReadAhead`, `noteUnplacedAhead`) is the precedent for carrying a start and a cache result from one pass to a later one.
- **Full surface:** `apps/extension/src/surfaces/page-watcher.ts:189-195` (navigation state), `:313-316`, `:340-355`; `placementOf` and `PlaceAnswer` (`page-watcher.ts:41-49`); the redraw answers at `apps/extension/src/surfaces/video-row.ts:181` and `:189` (only when `read.state === 'read'`; a line or a failed read keeps `'not-found'`), `:200`; `content-list.ts:376`; `watch-page.ts:70-73`; `shorts.ts:193-196` (`redrawnFrom(fromCache, 'placed')`, never `'not-found'`); `analytics.ts:132` (a shown answer demoted for want of a Views number: it already holds `placement.fromCache`); `README.md:163` and `packages/api-types/src/events.ts:49-54` if the wording of when `ms` starts changes.
- **Must preserve:** one shown event per surface per navigation, with its first pass's time ("a surface shown on every pass of a navigation reports one shown event, with its first pass's time", `page-watcher.test.ts:1183`); the whole "the time from the pass that finds a surface to its figure" block (`page-watcher.test.ts:494`), including "a surface placed second in a pass, after the first surface's slow read" and "a surface that shows a line or is not found reports no shown event, so no time"; the read-ahead tests (`page-watcher.test.ts:729` onward, the review pass 1 to 5 proofs); the missing and give-up judgments, which must still see a redraw as `'not-found'` (`page-watcher.test.ts:357-492`), and a Shorts bar redraw as `'placed'`, so the give-up timer sends no `extension_surface_missing` for it (`shorts.test.ts`); every surface test's exact-ms cases in `card.test.ts`, `content-list.test.ts`, `analytics.test.ts`, `video-row.test.ts`, `studio-surfaces.test.ts`, `watch-page.test.ts`, `shorts.test.ts`, `feed.test.ts`, `channel-page.test.ts`; and the relay's validator (`apps/api/src/routes/events.ts:36`), which takes `ms` as a non-negative safe integer.
- **Do not touch:** the event's volume and its guard (Dismissed: "event volume"); the line states' silence (Dismissed: "line states send a time"); `heldChannels` in `public-pages.ts` (Dismissed: "the channels read and fromCache").
- **Proof:** `cp docs/reviews/creator-analytics-1037/repro/repro-redraw-timing.test.ts apps/extension/src/surfaces/ && pnpm exec vitest run apps/extension/src/surfaces/repro-redraw-timing.test.ts` is red now and must be green after (its mock surface answers the redrawn answer as a literal, since `redrawnFrom` does not exist before the fix; the first version answered a bare `'not-found'` and would have stayed red after the fix, as the second-opinion review found); then move its case into `page-watcher.test.ts` beside `:1183` and delete the copy. Add one surface-level case (the card whose Views row Studio replaces during a 1,200 ms read) in `card.test.ts`.

### 2. A caller's `sentry-trace` header decides whether its request is traced — LOW
- **Location:** `packages/reporter/src/tracing.ts:52`
- **Attribution:** introduced in `a1d3bcb4` (creator-analytics#1052 GlitchTip traces per API route, with no IDs, and the ADR). Base sends no trace at all. The incoming header is read by the SDK's http server subscription, which base also loaded, but with no tracing it decided nothing.
- **Real-world trigger:** none known today. No client of the API sends the header: `grep -rn "browserTracingIntegration\|tracePropagationTargets\|sentry-trace" apps/web/src apps/extension/src apps/site/src` finds nothing outside tests. LOW, capped: upgrade to MEDIUM if any client starts sending it (the check is that grep, plus comparing GlitchTip's transaction count for a route with the request log lines on main-box during the baseline).

**Evidence** — `@sentry/core` 11.4.0 `build/cjs/integrations/http/server-subscription.js:76-85` calls `continueTrace` with the request's `sentry-trace` and `baggage` for every incoming request, whatever `disableIncomingRequestSpans` says; `tracing/sampling.js:69-70`: `if (samplingContext.parentSampled !== void 0) return [samplingContext.parentSampled]`, which wins over `tracesSampleRate`. `traceRequest` opens its root span inside that continued context:
```ts
  return Sentry.startSpan(
    {
      name: method,
      op: 'http.server',
      forceTransaction: true,
```

**Failure mode** — executed with `repro/repro-incoming-trace-header.test.ts` at a rate of 1.0: a signed-in `/api/me` sends its transaction, and the same request with `sentry-trace: 0123456789abcdef0123456789abcdef-0123456789abcdef-0` sends none (`- "GET /api/me"` in the diff). At 0.1, a header ending `-1` forces a trace on every request. A caller's `sentry-*` baggage also becomes the envelope's `trace` header, which `beforeSendTransaction` never sees: the caller's own text, never a creator's.

**Recommended fix**
```diff
-  return Sentry.startSpan(
-    {
-      name: method,
-      op: 'http.server',
-      forceTransaction: true,
-      attributes: { 'http.request.method': method },
-    },
-    (span) =>
-      run({
+  return Sentry.startNewTrace(() =>
+    Sentry.startSpan(
+      {
+        name: method,
+        op: 'http.server',
+        forceTransaction: true,
+        attributes: { 'http.request.method': method },
+      },
+      (span) =>
+        run({
```
with the rest of the body indented one level and one more `)` to close it. `startNewTrace` (`@sentry/core` 11.4.0 `tracing/trace.js`) sets a fresh propagation context with a new trace ID and no `parentSampled` and no frozen DSC, so the rate decides and the envelope's trace header comes from this span.

**Remediation brief**
- **Design intent:** ADR 0023: the rate, `GLITCHTIP_TRACES_SAMPLE_RATE`, is the share of API requests whose ID-free trace leaves. Nothing outside the process may raise or lower it, and nothing a caller sends may leave unscrubbed.
- **Full surface:** `packages/reporter/src/tracing.ts:47-77` (the one `startSpan` in the repo). The worker opens no span, so it needs nothing.
- **Must preserve:** `apps/api/src/traces.test.ts` (5 tests: names, cache results, no IDs, no trace outside `/api/`); `apps/api/src/traces-off.test.ts` (rate unset: the span is non-recording and nothing leaves); `packages/reporter/src/traces.test.ts:133` (no `sentry-trace` or `baggage` on outgoing requests, from `tracePropagationTargets: []`); errors reported during a request still carry the request's trace context (`contexts.trace` from the active span).
- **Do not touch:** `tracePropagationTargets: []` and `disableIncomingRequestSpans: true` in `packages/reporter/src/index.ts` (Dismissed: "propagation to Google").
- **Proof:** `cp docs/reviews/creator-analytics-1037/repro/repro-incoming-trace-header.test.ts apps/api/src/ && pnpm exec vitest run apps/api/src/repro-incoming-trace-header.test.ts` (Docker running, `TEST_DATABASE_ADMIN_URL` unset) is red now and must be green after. Then fold its case into `apps/api/src/traces.test.ts` under "with a rate of 1.0" and delete the copy.

### 3. The trace scrub keeps every top-level, span and trace-context key it does not name, though ADR 0023 says it keeps only listed keys — LOW
- **Location:** `packages/reporter/src/scrub.ts:257-300` (`...rest` at `:269`, `...span` at `:279-280`, `...trace` in the `contexts` branch)
- **Attribution:** introduced in `a1d3bcb4` (creator-analytics#1052 GlitchTip traces per API route, with no IDs, and the ADR); `git log -S'export function scrubTransaction' 20a6c7c2..HEAD` names it.
- **Real-world trigger:** none carries a creator's data today. The keys that pass at those levels are the SDK's structural ones (`event_id`, `timestamp`, `start_timestamp`, `type`, `platform`, `server_name`, `release`, `environment`, `sdk`, `measurements`, `transaction_info`, span `links`). LOW, capped: it matters at the next `@sentry/node` upgrade, which #1092 already schedules, where ADR 0023's promise ("a key the SDK adds later stays in the process until someone adds it on purpose") is the safety the upgrade relies on. A false security assumption in the ADR, so it is its own finding and not comment hygiene.

**Evidence**
```ts
    breadcrumbs: _breadcrumbs,
    ...rest
  } = event
  const scrubbed: TransactionEvent = { ...rest }
...
    scrubbed.spans = spans.map(({ description, data, ...span }) => ({
      ...span,
```

**Failure mode** — executed with `repro/repro-scrub-unlisted-keys.test.ts`: a transaction with a made-up top-level key and a made-up span key, each holding `dQw4w9WgXcQ`, comes out of `scrubTransaction` with both keys (`{ top: true, span: true }`, expected `false` and `false`).

**Recommended fix** — build the scrubbed event, each span and the trace context from named lists, keeping the masking and `scrubTraceData` as they are:
```ts
const transactionKeys = ['event_id', 'type', 'platform', 'timestamp', 'start_timestamp', 'release', 'environment', 'sdk', 'transaction_info', 'measurements', 'sdkProcessingMetadata'] as const
const spanKeys = ['span_id', 'trace_id', 'parent_span_id', 'op', 'status', 'origin', 'start_timestamp', 'timestamp'] as const
const traceContextKeys = ['span_id', 'trace_id', 'parent_span_id', 'op', 'status', 'origin'] as const
const picked = <K extends string>(from: Record<string, unknown>, keys: readonly K[]) =>
  Object.fromEntries(keys.filter((key) => key in from).map((key) => [key, from[key]]))
```
The lists drop `server_name` (the host name) and `modules` (the dependency list), which `@sentry/node` 11.4.0 puts on every transaction. That is on purpose: neither is needed by GlitchTip's performance view, and the host name is the server's identity. Say so in the commit message. `sdkProcessingMetadata` stays: the SDK reads the envelope's trace header from it after the hook, and drops it from the body itself. Confirm that against what the recording transport sends before and after the change, both the envelope header and the event body.

**Remediation brief**
- **Design intent:** ADR 0023: the trace scrubbing hook keeps a key only when it is on its list, at every level, so a key the SDK adds later stays in the process until someone adds it on purpose. Tags and data already work that way (`scrubTraceData`, `traceKeys`).
- **Full surface:** `packages/reporter/src/scrub.ts:257-300`; `docs/adr/0023-id-free-traces-leave-the-process.md:7` only if the list of what a trace may carry changes.
- **Must preserve:** `packages/reporter/src/scrub.test.ts` ("a transaction leaves with no channel, video or user ID, no email and no query, in its name, URL, spans, tags or data", and its siblings); `packages/reporter/src/traces.test.ts` (the 5xx status, the route source `sentry.segment.name.source`, the timings); `apps/api/src/traces.test.ts` (GlitchTip still gets a transaction with its name, `contexts.trace.data` and spans). A transaction must still carry `type: 'transaction'`, its timestamps and its trace context, or GlitchTip drops it.
- **Do not touch:** the error scrub's own `...rest` (that is finding 4, a separate commit).
- **Proof:** `cp docs/reviews/creator-analytics-1037/repro/repro-scrub-unlisted-keys.test.ts packages/reporter/src/ && pnpm exec vitest run packages/reporter/src/repro-scrub-unlisted-keys.test.ts -t "a key the trace scrub does not name"` is red now and must be green after.

### 4. An error event's transaction name carries the request's raw path, a YouTube video ID included — LOW
- **Location:** `packages/reporter/src/scrub.ts:155-170` (`scrubEvent`, whose `...rest` passes `transaction` unmasked)
- **Attribution:** pre-existing, untouched. `git show 20a6c7c2:packages/reporter/src/scrub.ts` has the same `...rest` (lines 166-168), and base loaded the same http server subscription. This branch neither widens nor narrows it; tracing adds nothing to error events (Dismissed: "error events gain trace data").
- **Real-world trigger:** any error reported during a request under `/api/channels/:channelId/videos/:videoId` (the video detail, the sponsor report), such as a failed Google call the API reports. The SDK names the request's isolation scope `GET /api/channels/<uuid>/videos/<videoId>` (`@sentry/core` 11.4.0 `integrations/http/server-subscription.js:66-68`) and copies that onto every non-transaction event (`utils/scopeData.js:83-84`). The video ID goes to self-hosted GlitchTip, so ADR 0007 holds, but the scrub's own docblock says it drops YouTube IDs. LOW: follow-up ticket material.

**Evidence**
```ts
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const {
    message,
    ...
    request,
    ...rest
  } = event
  const scrubbed: ErrorEvent = { ...rest }
```

**Failure mode** — executed with `repro/repro-scrub-unlisted-keys.test.ts`: `scrubEvent({ transaction: 'GET /api/channels/<uuid>/videos/dQw4w9WgXcQ' }).transaction` still contains `dQw4w9WgXcQ`. The SDK half (the isolation scope's name reaching the error event) is read from the source lines above, not executed through the API.

**Recommended fix**
```diff
   const scrubbed: ErrorEvent = { ...rest }
+  if (rest.transaction !== undefined) scrubbed.transaction = maskSecrets(rest.transaction)
```
`maskSecrets` keeps the internal UUID, which the error policy allows, and its `/videos/` pattern masks the video ID.

**Remediation brief**
- **Design intent:** the error scrub keeps internal IDs and drops everything else a creator owns, YouTube IDs included; free text goes through `maskSecrets`. The transaction name is free text the SDK builds from the path.
- **Full surface:** `packages/reporter/src/scrub.ts:155-195`. Check the other free-text top-level keys the same `...rest` passes (`fingerprint`, `server_name`) while there.
- **Must preserve:** `packages/reporter/src/scrub.test.ts` error-event cases (messages, exceptions, breadcrumbs, contexts, tags); the README's statement that internal IDs leave in error events.
- **Do not touch:** `scrubTransaction`'s transaction masking (`maskTraceText`, stricter on purpose).
- **Proof:** `cp docs/reviews/creator-analytics-1037/repro/repro-scrub-unlisted-keys.test.ts packages/reporter/src/ && pnpm exec vitest run packages/reporter/src/repro-scrub-unlisted-keys.test.ts -t "transaction name leaves with no video ID"` is red now and must be green after. Move the case into `scrub.test.ts` and delete the copy once findings 3 and 4 are both green.

### 5. Comment hygiene — LOW (aggregated)
- `README.md:151` — "INP is each screen view's worst interaction, skipping one per 50, sent when the screen changes or the page is hidden" → "INP is each screen view's worst interaction, skipping one per 50, sent when the screen changes again after that view (the browser reports the input that left a view only once the next screen has painted), or when the page is hidden"; and "LCP is the page load's, sent once, at the first input or when the page is hidden" → "LCP is the page load's, sent once, at the first input, the first change of screen (Back and Forward included) or when the page is hidden" (`apps/web/src/screen-timing.ts:195-225`, `changeStarted` calls `endLcp`)
- `packages/api-types/src/events.ts:49-54` — "from the watch's pass that found the surface's element to its figure showing" and "true when every answer the figure was drawn from came from the API's cache or the extension's 30-second keep" → the README's wording at `README.md:163`: "from the moment the pass that found the surface's element was due, or the moment the extension first saw the element when that came later, to its figure showing", and "…or the extension's 30-second keep, or when the figure stayed up from an earlier navigation"
- `apps/worker/src/worker.ts:32-33` and `docs/deploy.md:151` — "so it sends a trace only for a span the SDK opens, scrubbed as the API's" → "and under the static lifecycle the SDK opens no root span of its own (its pg, http and fetch spans need a parent), so the worker sends no trace; one the SDK did open would be scrubbed as the API's" (`@sentry/core` 11.4.0 `get-outgoing-span-data.js:36`, `@sentry/server-utils` `integrations/postgres.js:57,77`)
- `docs/adr/0023-id-free-traces-leave-the-process.md:7` (and the README's tracing sentence) — add: "A request answered 401 to 404, or with a redirect other than 300 and 304, sends no trace: the SDK's default filter drops it (`DEFAULT_IGNORE_STATUS_CODES` in `@sentry/core` 11.4.0, run by `httpIntegration` whatever `disableIncomingRequestSpans` says). So a signed-out request and the `not_connected`, `video_not_found`, `consent_missing`, `not_monetized` and `not_owner` refusals are not in GlitchTip's p50 and p95." Executed: a signed-out `/api/me` at a rate of 1.0 sent no transaction
- `packages/reporter/src/tracing.ts:36` — "A 5xx marks the trace failed; a refusal, a 4xx, does not." → "A 5xx marks the trace failed; another 4xx does not. The SDK drops a 401 to 404 answer whole."
- `packages/reporter/src/traces.test.ts:99-100` — "or a redirect but 302 and 304, by default: a refusal the baseline does not read (assumptions.md)" → "or a redirect but 300 and 304, by default (`@sentry/core` 11.4.0 `DEFAULT_IGNORE_STATUS_CODES`: `[401, 404]`, `[301, 303]`, `[305, 399]`)". 302 is dropped, and `assumptions.md` is not in the repository.

## Needs Further Investigation
### A. A refused answer leaves its change waiting, so a later read with no input ends it with an inflated `ms` — confirm with a screen test
Finder B traced it in `apps/web/src/screen-timing.ts:314-336` with `apps/web/src/VideoDetail.tsx:597-601` and `Audience.tsx:259-264`: a refused answer never calls `answerShown`, so `timing.pending` survives; a later answer on the same screen with no input, such as the re-read after a currency change (`useViewInSavedCurrency`, `VideoDetail.tsx:572-576`), then sends `trigger: 'window'` with an `ms` that spans the refusal and the creator's pause. The README (`README.md:152`) says "a refusal and a read again with no input send nothing". To confirm: in `apps/web/src/app.test.ts`, change the window on a video's detail with the fake API refusing (`quota_reserved`), then change the currency, and assert no `answer_shown` is tracked. To kill: show a refusal clears `pending` somewhere this trace missed. Severity if confirmed: LOW (refusals then a currency change are rare). The second-opinion review notes the confirm step cannot run as written: currency changes only on `/app/settings` (`Settings.tsx:104`), and opening Settings calls `changeStarted`, which clears `pending`. The only path left is a slow currency save started on Settings that settles after a refused window change on the next screen. The fix would export a `answerRefused(screen)` that clears `pending` and `loadOpen` for that screen, called from each budget screen's refused branch.

## Reviewed and Dismissed
- **Cloudflare's own Server-Timing entries break the walk's parser.** Unknown names are ignored and nothing is misassigned, executed by Finder B against `cfL4`, `cfEdge`, `cfOrigin`, `cfCacheStatus`, in both orders. Cloudflare documents its entries as `cdn-cache; desc=DYNAMIC, edge; dur=20, origin; dur=100` (Cloudflare docs MCP), with no name the parser matches and no comma inside a description.
- **A comma or semicolon inside a quoted `desc` corrupts the parse** (`cold-cache-walk.ts:40-50`). True for such input, but no writer produces one: `serverTimingOf`'s names are `keyof Reads` and its cache value is `'hit' | 'miss'`, and Cloudflare's documented descriptions hold none.
- **The #1051 log line, which may carry the channel ID, reaches GlitchTip through tracing.** No new path: the line is written after `next()`, so its breadcrumb follows that request's captures; breadcrumbs go through `scrubBreadcrumb`; the internal ID it holds is the existing error policy. `contexts.trace` on an error is only span, trace and parent IDs (`@sentry/core` `utils/spanUtils.js:33-42`).
- **Error events gain trace data with tracing on.** They gain `contexts.trace` IDs only; `event.transaction` is set from the span for transaction events alone (`scopeData.js:108`). Finding 4 is pre-existing and separate.
- **Propagation to Google with tracing on.** `tracePropagationTargets: []` matches nothing, and both the http and the fetch injection paths check it (`core/utils/tracePropagationTargets.js:36-48`, `inject-trace-propagation-headers.js:17`, `node/utils/outgoingFetchRequest.js:12`).
- **The worker, or the API outside a request, opens root spans of its own.** pg, postgres.js, http and undici spans are `onlyIfParent` under the static lifecycle, and `tracing.ts:52` is the only `startSpan`. Under span streaming, undici fetches would become roots: that belongs on #1067, which already covers the streaming case.
- **Middleware order: the trace's cache result or name is wrong for refusals, errors or sub-apps.** Access check, then `requestTiming`, then `requestTrace`; Hono's compose runs `onError` inside the dispatch, so all three see the answer; `routePath(c)` after `next()` is the handler's full pattern; an early middleware answer gives `/*` or `/api/*` (#1065), never an ID.
- **The gateway's timing changes a read's cache, refusal or quota behaviour, or double-counts time.** `read` is a straight extraction into `readThrough`; the quota check and spend stay outside the timed `run`; the gateway has no `Promise.all`, so summed Google time cannot overlap. `fake-google`'s `onYouTubeApiRequest` is opt-in, so other tests are unchanged.
- **The relay refuses or mangles the extension's new shape.** `/api/events` accepts 1 key or exactly 3 with a non-negative safe-integer `ms` and a boolean `fromCache`, refuses timing on other names and any extra key, and the relay spreads the properties unchanged (`packages/event-relay/src/index.ts:140`). The extension sends `Math.max(0, Math.round(...))`, never NaN.
- **Event volume.** The shown event stays behind the same `!nav.shown.has(surface.name)` guard as base: one per surface per navigation, not one per pill; ahead passes record and never report.
- **Line states send a time.** Card, Content list and analytics tests assert no shown event for a line, and the mixed case is `page-watcher.test.ts:540`.
- **The channels read and `fromCache` on public pages** (`public-pages.ts`, `heldChannels`). The channels route reads no Google answer, so it has no cache result to report; its wait is inside `ms`.
- **The channel screen times only its video list, and the retention load only its stored curves.** Both are the documented choice (`README.md:152`, and #1053's "the retention comparison's cache result is stored").
- **CSP.** No new dependency; `PerformanceObserver` needs no directive; no inline script or new `connect-src`.
- **`track` has no runtime ID guard.** It never had one; the guard is the `ProductEvent` type and the two key-fixed builders (`webVitalEvent`, `answerShownEvent`), and `app.test.ts` checks no timing event carries an ID.
- **`found` does work on every mutation until a surface is seen** (`content-list.ts` `holdsList`). Bounded to the time before the element is drawn; per-tick scan cost is #555's.
- **The 11 test failures.** All were 5000 ms timeouts at load 37 to 53, and all 280 tests in those files pass on a re-run at load 13.

## Minor / nits
- The child-span description is masked by a pattern list, not an allowlist (`scrub.ts:281-285`): the Cloudflare email call's path keeps the 32-hex account ID (`notification-email.ts:83`, from `POST /api/feedback`). It is the operator's account, not a creator's, and ADR 0023 names masked descriptions as the design.
- `/api/events` takes any safe integer for `ms` (`routes/events.ts:36`); a timing-sized cap would keep a broken extension's values out of the dashboards.
- On the watch page and the Shorts player, `fromCache` ANDs every held channel's read, though the figure comes from one channel's (`public-pages.ts`, `pillsOn`). It errs toward "cold", and `ms` honestly includes waiting for both.
- The extension times with `Date.now()`, which a clock step moves; `performance.now()` would not (`page-watcher.ts`, `msFrom`).
- No test runs a worker job at a rate of 1.0 and checks that no transaction leaves (`apps/worker/test/worker.test.ts` parses the rate only).
- No walk parser test feeds a proxy's entries beside the API's (`cold-cache-walk.test.ts:30-52`).
- The walk does not read the video detail's stepper list (`VideoDetail.tsx:495-497`), and its detail step times the newest upload (`cold-cache-walk.ts:296-298`). Neighbours of #1086 and #1096.
- `request-timing.test.ts:296-307` asserts `googleMs > 0` and `databaseMs > 0` on real elapsed time: not a threshold, but the one real-clock timing assertion in CI.

## Test quality
Tests added or changed: 212 in-scope cases run at `$BASE`, plus 55 in files that cannot import there. Green against `$BASE`: 10. None came from a "review pass N finding" commit, so none is an earlier finding's proof. Per test:
- `apps/api/src/channel-summary.test.ts` "…refused with quota_reserved, and the log names no channel" and `apps/api/src/video-list.test.ts` "…stops answering partway gets google_failed…" (`acead9ad`): base behaviour, loosened to let the new request line carry the channel ID. Keep.
- `apps/api/src/server.test.ts` and `apps/worker/test/worker.test.ts` "with a trace sample rate of 1.0, the start goes on to the database" (`a1d3bcb4`): positive controls for the red malformed-rate tests. Keep.
- `apps/api/src/traces.test.ts:200` "a request outside the API… sends no trace" (`a1d3bcb4`): holds trivially at base and has no positive control of its own; its four red neighbours show traces flow. Weak; strengthen by fetching one `/api/` path in the same test and asserting exactly one trace.
- `apps/extension/src/background-answer.test.ts` "a usage-event request settles the event it carries", `surfaces/analytics.test.ts` "a video missing from the answer…", `surfaces/watch-page.test.ts` "a block YouTube redraws…", and two `page-watcher.test.ts` cases (a type rename; a test whose checks never read the card's answer) (`5cfbbbe9`): base behaviour pinned for the new fields, or negative checks that hold trivially. Keep.
Tautology shapes found: none that assert nothing. `cold-cache-walk.test.ts:249-265` and `:283` build expectations with `walkStepsOf()` and `cacheClearSqlOf()`, but both helpers are pinned by literals elsewhere in the file (`:59-75`, `:133`) and `:289` checks the effect. `screen-timing.test.ts:22` mocks only the `track` sink. Every new test against fake Google carries a `// Limits:` header naming the human step (`youtube-test-limits` holds).

## Remediation scope
Nick, 2026-11-24: remediate every confirmed finding in this doc, 1 to 5, finding 4 included, with finding 1's brief as amended after the second-opinion review. `pre-pr-review-2.md` is remediated after this doc, in its own run. Needs Further Investigation A is not in scope.

## Before opening the PR
- **CI readiness:** lint, typecheck and build green; the suite green apart from load timeouts that pass on a re-run; the browser walk green. All ran on Node 26 here; CI runs 24.
- **Commit hygiene:** this doc and its `repro/` folder are uncommitted. Commit them as `creator-analytics#1037 pre-PR review 1`. The repro files stay under `docs/reviews/`; the root vitest include and the package `tsconfig`s never pick them up. No commit carries AI attribution, and the diff adds no em-dash.
- **Likely reviewer asks:** a test for finding 1's redraw case on a real surface; a line in ADR 0023 for the status codes GlitchTip never sees (comment hygiene entry 4), since the baseline reads per-route p95 from it; whether the walk's numbers are comparable with the web app's (page size, #1086).

## Verdict
Ready to open the PR once finding 1 is fixed: it makes the extension's figure time, the number this epic exists to collect for #540 and #555, read about 0 ms and "from cache" whenever Studio redraws during a cold read. Findings 2, 3 and 5 are small and best fixed in the same PR, before the baseline (#1056) sets the rate. Finding 4 is pre-existing; Nick chose to fix it in this PR too (Remediation scope). Needs Further Investigation A can be settled by one screen test, before or after the PR opens.

## Remediation — 2026-11-24
| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 1 (MEDIUM) | `073826b7` a figure drawn after a redraw during its read is timed from the pass that drew | red→green: the repro (`ms: 0, fromCache: true` before, `ms >= 1200, fromCache: false` after), then folded into `page-watcher.test.ts` (4 cases) and `card.test.ts`; a channel page case for the sites beyond the brief; each new case red against the pre-fix code or a mutant; `pnpm exec vitest run apps/extension` 1070/1070 | 3 new docblocks (`Redrawn`, the navigation's `redrawn` map, the test helper), 2 amended | half-fixed, with introduced defects: tripwire hit, round stopped, no rework |
| 2 (LOW) | `e1abb315` a caller's sentry-trace header decided whether its request was traced | red→green: the repro, folded into `apps/api/src/traces.test.ts`; a new `packages/reporter/src/traces.test.ts` case for the must-preserve "an error during a request carries its trace" | 1 amended docblock | proved by execution |
| 3 (LOW) | `f99bc5c8` the trace scrub kept every top-level, span and trace-context key it did not name | red→green: the repro, folded into `scrub.test.ts`; the recording transport's envelope header unchanged before and after | 1 new docblock (the lists, with why `server_name` and `modules` go and `sdkProcessingMetadata` stays), 1 amended | fixed (disprove agent) |
| 4 (LOW) | `f98f4144` an error event's transaction name carried the request's raw path, a YouTube video ID included | red→green: the repro, folded into `scrub.test.ts` | 0 | proved by execution |
| 5 (LOW, comment hygiene) | `80b0395c` comment hygiene | each entry read against the code or `@sentry/core` 11.4.0 (`DEFAULT_IGNORE_STATUS_CODES`, ranges inclusive) | n/a | n/a |

After the round: `pnpm typecheck` and `pnpm lint` green; `pnpm exec vitest run apps/worker apps/web packages` 3696 passed, 1 expected fail; `pnpm exec vitest run apps/api` 1035/1035. All on Node 26.

### Known regressions, deferred
The verify pass on `073826b7` reported more than 2 introduced defects, so the round stopped before any rework (the remediator's tripwire). Finding 1 needs a re-issued brief and its own round. Verdicts, quoted from the disprove agent:
- **A stale redraw start leaks into a navigation handed back after a drop, and is never cleared within a navigation** (MEDIUM, executed by the agent). Introduced by `073826b7`. "In `giveUp`, `nav = previous?.url === here ? previous : …` brings back the old `nav` with its `redrawn` map still filled. Nothing ever deletes an entry except a shown answer." Its scratch run: redrawn on page A at 250 ms, bare `'not-found'` at 1,700 ms, a dropped navigation to B, A handed back, the card shown from cache at 6,950 ms: `ms: 6700, fromCache: false`, against `ms: 0, fromCache: true` with a bare first answer. Suggested: delete the surface's entry when an own pass answers a bare `'not-found'` or a cut, and clear `previous.redrawn` when it is handed back.
- **On the pill pages a failed read still answers redrawn** (MEDIUM, read, not executed). Introduced by `073826b7`. A failed uploads or channels read becomes `noPills` (`{ pills: new Map(), fromCache: true }`, `public-pages.ts:46, 77-80, 105-108`), which the surfaces cannot tell from a read that landed. Sites: `watch-page.ts:78`, `shorts.ts:200` (the player), and through the `repointed` flag `feed.ts:171-173`, `channel-page.ts:70`, `shorts.ts:170`. Suggested: `PillsRead` says whether any read answered, and a surface answers redrawn only when one did.
- **The `repointed` flag changes more than an all-repointed `'placed'`** (MEDIUM-LOW). Introduced by `073826b7`, beyond the brief. On the channel page and the Shorts tab the condition is `!shown && repointed`, so one repointed tile beside tiles placed with no pill also answers redrawn. Only the feed is truly all-repointed.
- **video-row's second and third sites can record `fromCache: false` for a cached read** (LOW). Introduced by `073826b7`. At `video-row.ts:191-192, 203-204` `fromCache` is `answer?.fromCache === true && …`, and `answer` is undefined when the video is not in the answer. Suggested: `read.answer.fromCache && (compared?.fromCache ?? true)`.
- **A figure shown ahead, then redrawn on the own pass, mixes the ahead pass's cache result into the own pass's start** (LOW). At `page-watcher.ts:383-386`, with `early` holding `ms`, the record takes `since: start` and `fromCache: early.fromCache && …`. The pre-fix code lost `early.ms` too, so the loss is not new; the mix is.
- **Two brief sites are not a redraw during the read** (LOW, design). The analytics demotion (`analytics.ts:132-134`) tests a `viewsNumberRow` taken before the read and also catches video-row's kept path, where no read happens; the Shorts player's `leftOver` half (`shorts.ts:198`) is YouTube still showing the previous Short's bar. Both now time the figure from a pass that could not draw it, so Studio's or YouTube's own render delay is counted.

The agent also noted, outside the diffs: `runtimeContexts` (`scrub.ts:51-59`) passes `cloud_resource`, `device` and `os` through whole in a transaction, and `cloud_resource` can carry `host.id` or `cloud.account.id`. Not a finding of this round.

### Rework briefs
None: the tripwire stops the round before any rework.

## Approach decisions (remediation, 2026-11-24)
- A redrawn answer on an ahead pass notes nothing in the read-ahead record, as a bare `'not-found'` noted nothing before (`noteReadAhead`), so the read-ahead timing is unchanged (finding 1).
- The pill pages (feed, channel page, Shorts tab) answer `redrawnFrom(fromCache, 'placed')` when a tile was repointed during the read and none showed. This went beyond the brief, and the verify pass found it too wide and blind to a failed read: the re-issued brief decides whether the pill pages are in scope at all (finding 1).
- The trace scrub's lists are the keys `@sentry/node` 11.4.0 puts on a real traced request, read from the recording transport before and after, minus `server_name` and `modules` (finding 3).

## Re-issued brief: finding 1, round 2 (2026-11-24)
Remediation scope: Nick, 2026-11-24, chose to re-run finding 1 as its own round, on top of `073826b7`, with this brief, before `pre-pr-review-2.md` is remediated. It covers the six defects under "Known regressions, deferred" above. Findings 2 to 5 are closed and out of scope.

**Design intent (restated, binding):** `extension_surface_shown`'s `ms` runs from the pass that first found the surface's element (or its first sighting) to the figure showing, and `fromCache` is true only when every read the figure waited on came from a cache. A redraw carries that start and cache result forward only while the surface keeps waiting on the same read for the same element: from a `Redrawn` answer through the very next own passes that answer `Redrawn` again, to the pass that shows. A read that held no answer never lends its start.

**Mechanism, per defect:**
- **D1, the record's lifetime.** An own pass whose answer is neither `Redrawn` nor `Shown` deletes the surface's entry in `nav.redrawn` (a bare `'not-found'`, `'placed'`, `'unsettled'`). A navigation `giveUp` hands back (`nav = previous`) starts with an empty `redrawn` map. Rejected: keeping the record across a bare `'not-found'` (the element gone): it overstates, as the disprove agent's 6,700 ms run showed, and the variant it would cover (an element gone for a whole pass) is rare.
- **D2, a pill read that held no answer.** `PillsRead` gains `answered: boolean`: true when at least one uploads read answered. `noPills` answers false; `pillsOn` answers true when any held channel's read did, and false when no channel is held. The watch page, the Shorts player and the pill pages answer `Redrawn` only when `answered`, and their bare answer otherwise.
- **D3, the pill pages' redraw test.** The feed, the channel page and the Shorts tab answer `redrawnFrom(fromCache, 'placed')` only when every tile with an id and a count was repointed during the read (none was placed, with or without a pill) and the read answered.
- **D4, a figure shown ahead, then redrawn.** When the own pass answers `Redrawn` and the read-ahead record holds a finished time (`'ms' in early`), the `redrawn` entry keeps that record whole, and the shown event reports it, as it would have on that pass. A later redrawn answer folds nothing into a finished record.
- **D5, video-row's cache result.** The second and third redraw sites in `video-row.ts` take `read.answer.fromCache && (compared?.fromCache ?? true)`, not the `answer`-gated `fromCache`, so a read that held the answer without this video still says where it came from.
- **D6, the analytics demotion and the Shorts `leftOver` branch.** Kept as they are. The analytics surface's `found` is the key metric header, so the definition times its figure from the pass that found the header to the figure under Studio's Views number, Studio's own drawing included. The Shorts player's `leftOver` branch keeps its redraw only with D2's `answered`.

**Full surface:** `apps/extension/src/surfaces/page-watcher.ts` (the `redrawn` map's type, the own pass's record code, `giveUp`'s hand-back), `public-pages.ts` (`PillsRead`, `noPills`, `uploadsPillsOf`, `pillsOn`), `watch-page.ts`, `shorts.ts` (the tab and the player), `feed.ts`, `channel-page.ts`, `video-row.ts:189-204`.

**Must preserve:** everything under finding 1's original Must preserve; the round 1 tests added in `073826b7` (`page-watcher.test.ts` "a figure drawn after the page redrew its element while its read was out", `card.test.ts` "a figure whose Views row Studio redraws during its cold read", `channel-page.test.ts` "a pill drawn after YouTube points every tile at another of the creator's videos"); `pnpm exec vitest run apps/extension` green.

**Proof, per defect:** a failing test first in `page-watcher.test.ts` for D1 (redrawn, then a bare `'not-found'`, then shown: timed from its own pass; and a redrawn answer on a navigation `giveUp` hands back after a drop: timed from its own pass) and D4 (a figure shown ahead, then redrawn, then shown: the ahead time); in `channel-page.test.ts` for D2 (a failed uploads read, then a tile repointed, then a figure on a later read: timed from its own pass) and D3 (one tile repointed beside tiles with no pill: timed from its own pass); in `card.test.ts` for D5 (an answer without the card video from the cache, redrawn, then shown: `fromCache` true).

## Remediation, finding 1 round 2 — 2026-11-24
| Defect | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| D1 (MEDIUM) | `e432b6d3` a redraw's start outlived the wait it timed | red→green in `page-watcher.test.ts`: "after a redraw, then a pass that found nothing" (`ms: 1700` before, `0` after) and "on a navigation the give-up hands back after a dropped one" (`ms: 6200` before, `0` after) | 1 amended docblock (the `redrawn` map) | fixed |
| D4 (LOW) | `e432b6d3` (same commit) | red→green in `page-watcher.test.ts`: "a figure the ahead pass drew, which the page redraws on the navigation's own pass" (`ms: 250` before, `500` after) | (same) | fixed |
| D2 (MEDIUM) | `62756a2e` a pill read that held no answer, or one repointed tile, counted as a redraw | red→green in `public-pages.test.ts`: the `answered` flag. No surface-level red test: after D1, the give-up's settled pass answers a bare `'placed'` within 5 s of any failed read and ends the record, so no fixture reaches D2's path alone. The disprove agent's scratch run of a failed read with every tile repointed, then a read 31 s later, reported `ms: 0` | 1 amended docblock (`PillsRead`) | fixed |
| D3 (MEDIUM-LOW) | `62756a2e` (same commit) | red→green in `channel-page.test.ts`: "a pill drawn after YouTube points one tile at the creator's video ... beside tiles of another channel's videos" (`ms: 1450` before, `0` after) | (same) | fixed |
| D5 (LOW) | `7b423ecd` a redrawn video row read from the cache could say it was cold | by reading only, as the commit says: the third site is reached when Studio redraws the analytics card during a read that lacks the video; the second site's edit is a no-op (the disprove agent: no `await` lies between the two `isConnected` checks unless the answer holds the video) | 0 | fixed |
| D6 (LOW) | none | decision recorded in the re-issued brief: the analytics demotion and the Shorts `leftOver` branch stay | n/a | n/a |

After the round: `pnpm typecheck` and `pnpm lint` green; `pnpm exec vitest run apps/extension` 1075/1075. The "Known regressions, deferred" list of round 1 is closed by these commits; no regression is open.

## Approach decisions (finding 1 round 2, 2026-11-24)
- A redraw's record lives only through consecutive redrawn answers of the navigation's own passes; any bare answer ends it, and a navigation the give-up hands back starts with none. Rejected: keeping it across a bare `'not-found'`, which overstated by the whole give-up wait.
- A public page's pills say whether any uploads read answered (`PillsRead.answered`), and a pill surface answers redrawn only when one did.
- A pill page answers redrawn only when every tile was repointed during the read, never when one was.
- A finished read-ahead time survives a redraw on the own pass whole, as the read-ahead record's precedence already gave it.
