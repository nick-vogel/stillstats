# Pre-PR review: creator-analytics#1037 Make Stillstats faster (instrumentation)

**Branch:** `creator-analytics-1037-make-stillstats-faster` vs `origin/main` (merge-base `20a6c7c2`, "Merge pull request #1059 from nick-vogel/creator-analytics-938-drop-copy-pins")
**Reviewed at:** HEAD `7aea7d5f` (creator-analytics#1054 Extension timing: the time from a surface element to its figure) + 0 files with uncommitted changes, 80 files total, +6154 / −360
**Reviewed against:** epic #1037 and closed sub-issues #1051, #1052, #1053, #1054 and #1055 (bodies read with `gh`), `CONTEXT.md`, `README.md`, `docs/deploy.md`, ADR 0023 (`docs/adr/0023-id-free-traces-leave-the-process.md`), the global rules in `~/.claude/rules/`, and the repo rules `.claude/rules/row-level-security-tests.md` and `.claude/rules/youtube-test-limits.md`. Fresh whole-branch second-opinion review (`--fresh`), independent of `pre-pr-review-1.md`.
**Date:** 2026-11-24
**Reviewer:** Gemini through Antigravity (Gemini 4 Neon) + verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Lint | `pnpm lint` (`biome check .`) | green (874 files) |
| Typecheck | `pnpm -r typecheck` (19 of 20 workspace projects) | green |
| Affected package & app tests | `pnpm exec vitest run packages/reporter packages/event-relay packages/youtube-gateway apps/web apps/extension apps/worker` | green: 125 files, 3847 passed |
| Changed API tests | `pnpm exec vitest run apps/api/src/request-timing.test.ts apps/api/src/traces.test.ts apps/api/src/traces-off.test.ts apps/api/src/cold-cache-walk.test.ts apps/api/src/events.test.ts apps/api/src/server.test.ts apps/api/src/channel-summary.test.ts apps/api/src/video-list.test.ts` (Testcontainers Postgres) | green: 8 files, 314 passed |
| Finding 1 repro | Executed against `apps/web/src/screen-timing.ts` via Node ESM loader hook (`registerHooks` intercepting `./analytics.ts`): emit LCP candidate `640`, dispatch `pointerdown`, emit later candidate `2500`, then call `screenShown('/app/')` | red at HEAD: `tracked` is `[]`, expected `[{ name: 'web_vital', metric: 'LCP', value: 640, screen: '/app/' }]` |
| Finding 2 repro | Executed against `packages/reporter/src/scrub.ts` and real `@sentry/node` v11.4.0 (`initErrorTracking({ tracesSampleRate: 1 })` + `traceRequest` + child `http.client` span) with `UCabcdefghijklmnopqrstu-` | red at HEAD: `UCabcdefghijklmnopqrstu-` passes through `maskSecrets`, `maskTraceText`, `scrubTransaction`, and the real Sentry envelope unmasked (`UCabcdefghijklmnopqrstu_` is masked) |
| Hono middleware edge cases | Executed `requestTiming` + `requestTrace` on Hono with throwing route (`500`), `c.redirect` (`302`), `Response.redirect` (immutable headers, `302`), raw `new Response` (`200`), and unmatched `/api/nope` (`404`) | all 5 carried `Server-Timing: total;dur=...` and logged one request line without throwing |
| Outgoing trace header propagation | Executed `Sentry.init` with `tracesSampleRate: 1` without `tracePropagationTargets: []` against a local HTTP server, then with `initErrorTracking` | confirmed `NodeFetch` injects `sentry-trace` and `baggage` when omitted, and `initErrorTracking` suppresses both (so `packages/reporter/src/traces.test.ts:124` can go red) |
| Worker standalone spans | Executed `initErrorTracking({ tracesSampleRate: 1 })` with a standalone `fetch` outside `traceRequest` | 0 envelopes / 0 transactions sent |
| Tautology audit — base checkout run (Phase 4.5) | Not run: non-Claude second-opinion runs forbid `git worktree add`, so running the branch's 135 new/changed test cases against `$BASE` (`20a6c7c2`) in a scratch worktree was skipped | not run (static audit of all new test files completed; see Test quality) |
| Live GlitchTip / OpenPanel / staging walk | Not run: cannot observe external self-hosted services or staging credentials from local review | not run (explicitly scoped to manual verification on #1056) |

**Overall:** the five instrumentation workstreams (#1051–#1055) are clean, well-tested, and faithful to the epic's privacy and boundary-testing rules. Lint, typecheck, and all 133 executed test files (4,161 tests) are green. Two MEDIUM issues were confirmed by execution and should be fixed before opening the PR: (1) any pointer, key, or tab-hide event while `/api/me` is in flight silently drops the page's LCP event, biasing the upcoming baseline p75 LCP downward on slow startups; and (2) YouTube channel IDs ending in `-` (~1 in 64 IDs) bypass `secretPatterns` in `packages/reporter/src/scrub.ts`, exposing them in both error reports and the new traces. No CRITICAL or HIGH defects were found.

## Approach decisions
- An LCP that the first input or hide ends before the budget screen shows (finding 1). Nick, 2026-11-24: neither drop it, as the code does now, nor send the frozen candidate, as this doc first recommended. The frozen candidate is the paint of the shell (header and sidebar), since the screen has not painted yet, so it would report a false, small LCP under the screen's name. Send instead the time of that first input or hide as the value, a floor the screen's real LCP is at least, with `beforeScreen: true`, so the baseline counts these loads and knows they are floors. `changeStarted` still sets `lcp.screen = null`, so non-budget and signed-out loads send nothing. Reviewed by Claude in the #1037 orchestrator session.
- Boundary matching for YouTube channel IDs in `packages/reporter/src/scrub.ts`: use `(?![\w-])` on the right boundary of `UC[\w-]{22}` to mirror the video ID pattern on line 69 (`\/videos\/[\w-]{11}(?![\w-])`), keeping `\b` on the left so IDs preceded by `-` or `=` continue to match (finding 2).

## Confirmed Issues
### 1. First input or tab hide while `/api/me` is in flight drops the page's LCP permanently — MEDIUM
- **Location:** `apps/web/src/screen-timing.ts:218-226, 245, 265-268, 341-345` (`endLcp`, `startScreenTiming`, `screenShown`)
- **Attribution:** introduced in `eeb0fb58` (creator-analytics#1053 Web timing in OpenPanel: LCP, INP and the wait after each change). `git log --oneline --reverse -S'function endLcp' 20a6c7c2..HEAD` names only `eeb0fb58`, and `apps/web/src/screen-timing.ts` does not exist at base `20a6c7c2`.
- **Real-world trigger:** a signed-in creator loads `/app/`, `/app/videos/:id`, `/app/audience`, or `/app/retention`. `apps/web/src/main.tsx:41-45` calls `startScreenTiming` right after `/api/client-settings` resolves, before React mounts `<App />`. While `<App />` waits for `/api/me` (`session.state === 'loading'`, `apps/web/src/App.tsx:271, 764`), the app shell (`<Header>` / `<Sidebar>`) is already painted and emits an `largest-contentful-paint` candidate, but none of the four budget screens has mounted yet so `lcp.screen` is still `undefined`. If the creator clicks, presses a key, or switches tabs before `/api/me` resolves, `endLcp` sets `lcp.sent = true` and returns without sending anything. When `/api/me` answers and the budget screen calls `screenShown`, `lcp.sent` is already `true`, so the load's LCP is lost. Because slower startup chains create a wider window before `/api/me` finishes, this systematically drops slow-startup LCP samples from the #1056 baseline.

**Evidence**
```ts
// apps/web/src/screen-timing.ts:219-226
function endLcp(current: Timing): void {
  const { lcp } = current
  if (lcp.sent) return
  lcp.sent = true
  if (lcp.screen && lcp.candidate !== null) {
    track(webVitalEvent({ metric: 'LCP', value: lcp.candidate, screen: lcp.screen }))
  }
}

// apps/web/src/screen-timing.ts:341-345
export function screenShown(screen: BudgetScreen): void {
  if (!timing) return
  if (timing.lcp.screen === undefined) timing.lcp.screen = screen
  if (timing.view.screen !== screen) switchView(timing, screen)
}
```

**Failure mode** — `startScreenTiming(...)` → LCP observer delivers `{ startTime: 640, duration: 0 }` → `pointerdown` (or `keydown` / `visibilitychange` to `hidden`) fires before `screenShown('/app/')` → later LCP candidate `{ startTime: 2500, duration: 0 }` arrives → `screenShown('/app/')` runs → `track` receives `[]` instead of `[{ name: 'web_vital', metric: 'LCP', value: 640, screen: '/app/' }]`. Executed against `apps/web/src/screen-timing.ts` via Node ESM loader hook: red (`[]` vs expected `[web_vital LCP 640 /app/]`).

**Recommended fix** (amended 2026-11-24 by Nick's decision, see Approach decisions; the first version sent the frozen candidate, which is the shell's paint) — when the first input or hide comes before any screen shows, keep its time; when a budget screen then shows, send that time as the LCP, marked as a floor:
```diff
--- a/apps/web/src/landing.ts
+++ b/apps/web/src/landing.ts
-  | { name: 'web_vital'; metric: 'LCP' | 'INP'; value: number; screen: BudgetScreen }
+  | { name: 'web_vital'; metric: 'LCP' | 'INP'; value: number; screen: BudgetScreen; beforeScreen?: true }
--- a/apps/web/src/screen-timing.ts
+++ b/apps/web/src/screen-timing.ts
   lcp: {
     screen: BudgetScreen | null | undefined
     candidate: number | null
+    /** When the first input or hide came before any screen showed: the browser stopped LCP then. */
+    endedAt: number | null
     sent: boolean
   }
 function endLcp(current: Timing): void {
   const { lcp } = current
   if (lcp.sent) return
+  if (lcp.screen === undefined) {
+    lcp.endedAt ??= current.now()
+    return
+  }
   lcp.sent = true
-  if (lcp.screen && lcp.candidate !== null) {
+  if (!lcp.screen) return
+  if (lcp.endedAt !== null) {
+    track(webVitalEvent({ metric: 'LCP', value: lcp.endedAt, screen: lcp.screen, beforeScreen: true }))
+  } else if (lcp.candidate !== null) {
     track(webVitalEvent({ metric: 'LCP', value: lcp.candidate, screen: lcp.screen }))
   }
 }
 export function screenShown(screen: BudgetScreen): void {
   if (!timing) return
-  if (timing.lcp.screen === undefined) timing.lcp.screen = screen
+  if (timing.lcp.screen === undefined) {
+    timing.lcp.screen = screen
+    if (timing.lcp.endedAt !== null) endLcp(timing)
+  }
```
`webVitalEvent` passes `beforeScreen` through only when it is true, so every other LCP and every INP keeps its exact keys. The observer keeps ignoring candidates once `sent` or `endedAt` is set. `changeStarted` sets `lcp.screen = null` before it calls `endLcp`, so a load whose first move goes to a non-budget screen still sends nothing, and a signed-out load never calls `screenShown`, so it sends nothing either. Audit this diff against the `startScreenTiming` start state (`sent` is true for a page loaded hidden, so `endLcp` returns before `endedAt` is set).

**Remediation brief**
- **Design intent:** LCP is the page load's metric for the screen the page loaded on (`.epic-loop` assumption 2 of #1053, confirmed by Nick), and the browser stops finding candidates at the first input or hide. When that comes before any budget screen shows, the real LCP of the screen is unknown, but it is at least the time of that input or hide, because the screen had not painted. Dropping those loads biases the baseline's p75 toward fast loads; sending the shell's paint reports a false, small number. A marked floor keeps the load in the count and tells the baseline what kind of number it is.
- **Full surface:** `apps/web/src/landing.ts:80` (the event type); `apps/web/src/screen-timing.ts:94-105` (`webVitalEvent`), `:186-192`, `:218-226`, `:238-275`, `:341-345`; `README.md:151` (the `web_vital` line: name `beforeScreen` and say when LCP is a floor); the `answer_shown` and `web_vital` exact-keys tests in `apps/web/src/screen-timing.test.ts` and `apps/web/src/app.test.ts`. The callers of `screenShown`, `changeStarted` and `startScreenTiming` need no change. The privacy policy names no `web_vital` field (proposal #1094 covers the timing events' copy), so it needs no change here.
- **Must preserve:**
  - A page loaded in the background sends no LCP (`screen-timing.test.ts:364`).
  - A page loaded on a non-budget screen then moved to a budget screen sends no LCP (`screen-timing.test.ts:354`).
  - A signed-out load sends no LCP.
  - An LCP whose first input or hide comes after the screen shows sends the last candidate, with no `beforeScreen` key, as today.
  - The event carries no ID and no address.
  - All tests in `apps/web/src/screen-timing.test.ts`, `apps/web/src/analytics.test.ts` and `apps/web/src/app.test.ts`.
- **Do not touch:** `endViews` and `onInteractions` (INP before the first screen is #1073).
- **Proof:** paste the cases in `docs/reviews/creator-analytics-1037/repro/lcp-input-before-screen-shown.case.ts` inside `describe('the web vitals', ...)` in `apps/web/src/screen-timing.test.ts`, then run `pnpm exec vitest run apps/web/src/screen-timing.test.ts -t 'repro:'` from the repo root. They are red at HEAD and must pass after the fix. Then run `pnpm exec vitest run apps/web/src/screen-timing.test.ts apps/web/src/analytics.test.ts apps/web/src/app.test.ts`. Rename the tests without `repro:` when landing.

### 2. YouTube channel IDs ending in a hyphen bypass the scrubber in both errors and traces — LOW
- **Location:** `packages/reporter/src/scrub.ts:67` (`secretPatterns`)
- **Attribution:** pre-existing, exposed wider — `git show 20a6c7c2:packages/reporter/src/scrub.ts | grep -n -A2 'UC\['` shows line 67 (`[/\bUC[\w-]{22}\b/g, '[youtube id]']`) already existed at base `20a6c7c2`, and `a1d3bcb4` (creator-analytics#1052 GlitchTip traces per API route, with no IDs, and the ADR) widened its reach by building `maskTraceText` on `maskSecrets` as the sole filter scrubbing every performance trace (at `tracesSampleRate=1.0`, every API request).
- **Severity amended to LOW (2026-11-24, Claude in the #1037 orchestrator session):** a real channel ID encodes 128 bits, so its 22nd character after `UC` carries 2 bits and is always `A`, `Q`, `g` or `w` (ArchiveTeam, https://wiki.archiveteam.org/index.php/YouTube/Technical_details, pattern `[A-Za-z0-9_-]{21}[AQgw]`; Google's own example `UCK8sQmJBp8GCxrOtXWBpyEA`, https://developers.google.com/google-ads/api/reference/rpc/v23/YoutubeVideoIdentifier). YouTube publishes no rule for it, so this is evidence, not a guarantee. No real channel ID ends in `-`, so the trigger below does not occur today; the regex fix stays, as hardening. The text below is the original rating.
- **Real-world trigger (original):** a creator whose YouTube channel ID (`UC` + 22 base64url chars `[A-Za-z0-9_-]`) ends with `-` (~1 in 64 real YouTube channels). Whenever that channel ID appears in a scrubbed string outside a `?key=value` query parameter—such as a URL path segment, an exception message, a breadcrumb, or an unparameterized span description—it leaves the process unmasked for GlitchTip, violating ADR 0023 and #1037's guarantee that no channel ID leaves in telemetry. **MEDIUM, capped:** current YouTube Data/Analytics calls pass channel IDs in query parameters (which line 71's query regex strips) and Postgres queries are parameterized (`$1`), so this triggers only when a `-`-ending channel ID appears in a path, free-text error message, or non-query span description; upgrade to HIGH if any outgoing call or span places a YouTube channel ID in a URL path segment or unmasked text (check via `git grep -n 'youtubeChannelId' apps/ packages/`).

**Evidence**
```ts
// packages/reporter/src/scrub.ts:66-70
  [/\bBearer\s+\S+/gi, 'Bearer [token]'],
  [/\bUC[\w-]{22}\b/g, '[youtube id]'],
  // A video id has no prefix of its own, so only its place in a path marks it as one.
  [/\/videos\/[\w-]{11}(?![\w-])/g, '/videos/[youtube id]'],
```
In JavaScript RegExp, `-` is `\W` (non-word). When the 22nd character after `UC` is `-`, a trailing `\b` only matches if the *following* character is `\w`; before `/`, `?`, space, quote, or end-of-string (`\W`), `\b` fails and the entire channel ID is skipped. Line 69 already uses `(?![\w-])` for the exact same base64url alphabet on video IDs.

**Failure mode** — `UCabcdefghijklmnopqrstu-` in `maskSecrets('/channels/UCabcdefghijklmnopqrstu-/videos')`, `maskTraceText('GET https://google.example.com/channels/UCabcdefghijklmnopqrstu-')`, or a real `@sentry/node` `http.client` span description leaves `UCabcdefghijklmnopqrstu-` verbatim in the scrubbed output and Sentry envelope, whereas `UCabcdefghijklmnopqrstu_` is masked to `[youtube id]`. Executed against `packages/reporter/src/scrub.ts` and `@sentry/node` v11.4.0: red (`UCabcdefghijklmnopqrstu-` leaked in `tx.spans[0].description`).

**Recommended fix**
```diff
--- a/packages/reporter/src/scrub.ts
+++ b/packages/reporter/src/scrub.ts
@@ -64,7 +64,7 @@ const secretPatterns: readonly [RegExp, string][] = [
   [/\b1\/\/[\w.-]+/g, '[token]'],
   [/\beyJ[\w-]+\.[\w-]+\.[\w-]*/g, '[token]'],
   [/\bBearer\s+\S+/gi, 'Bearer [token]'],
-  [/\bUC[\w-]{22}\b/g, '[youtube id]'],
+  [/\bUC[\w-]{22}(?![\w-])/g, '[youtube id]'],
   // A video id has no prefix of its own, so only its place in a path marks it as one.
   [/\/videos\/[\w-]{11}(?![\w-])/g, '/videos/[youtube id]'],
```

**Remediation brief**
- **Design intent:** `secretPatterns` is the shared scrubbing gate for both error reports (`scrubEvent` / `maskSecrets`) and traces (`scrubTransaction` / `maskTraceText`, ADR 0023), as well as request logs (`logger.request`). Every YouTube channel ID (`UC` + 22 base64url chars `[A-Za-z0-9_-]`) must be replaced with `[youtube id]` regardless of whether its final character is `-`, `_`, or alphanumeric. Keeping `\b` on the left preserves matching after `-` or `=` (such as `channel==UC...` or `x-UC...`), while `(?![\w-])` on the right matches after `-` and also avoids truncating a longer `UC...` token followed by `-`.
- **Full surface:** `packages/reporter/src/scrub.ts:67`. `maskSecrets`, `maskTraceText`, `scrubEvent`, `scrubBreadcrumb`, `scrubTransaction`, and `packages/reporter/src/logger.ts` all flow through `secretPatterns` automatically.
- **Must preserve:** every existing case in `packages/reporter/src/scrub.test.ts`, `packages/reporter/src/traces.test.ts`, `packages/reporter/src/logger.test.ts`, and `apps/api/src/traces.test.ts` (including `UC` IDs ending in alphanumerics or `_`, and `UC` IDs preceded by `=`, `/`, space, or `-`).
- **Do not touch:** the video ID regex on `packages/reporter/src/scrub.ts:69` (already uses `(?![\w-])`) and `uuidOrNumberPattern` on line 79.
- **Proof:** paste the case in `docs/reviews/creator-analytics-1037/repro/youtube-channel-id-trailing-hyphen.case.ts` at the end of `packages/reporter/src/scrub.test.ts`, then run `pnpm exec vitest run packages/reporter/src/scrub.test.ts -t 'repro:'` from the repo root. It is red at HEAD and must pass after the fix. Then run `pnpm exec vitest run packages/reporter apps/api/src/traces.test.ts`. Rename the test without `repro:` when landing.

## Needs Further Investigation
None. Every candidate investigated in Phase 4 was either proved by execution or cleared in Phase 5.

## Reviewed and Dismissed
- `apps/api/src/request-timing.ts:48` (`c.header('Server-Timing', ...)` on throwing routes, `c.redirect`, `Response.redirect`, and 404s) — executed directly against Hono (`app.onError`, `c.redirect`, `Response.redirect` with immutable headers, raw `new Response`, unmatched `/api/nope`): Hono attaches `Server-Timing` and logs one line on all five without throwing.
- `packages/youtube-gateway/src/youtube-gateway.ts:473-487, 680-694` (concurrent `googleCalls` double-counting `googleTime.ms` and under-reporting `databaseMs`) — `git grep 'Promise.all' packages/youtube-gateway/src/` confirms no read in the gateway catalogue invokes Google calls concurrently; every read awaits its Google calls sequentially.
- `packages/reporter/src/scrub.ts:290-299` (`contexts.trace` spreading `...trace` without masking `description`) — executed a real `@sentry/node` v11.4.0 transaction through `initErrorTracking({ tracesSampleRate: 1 })` and `traceRequest` with live `fetch` child spans: Sentry v11.4.0 places the root span name only in `event.transaction` (which `maskTraceText` scrubs) and sets only `span_id`, `trace_id`, `op`, `status`, `origin`, and `data` on `contexts.trace`, never `description`.
- `apps/worker/src/worker.ts:294-299` (worker emitting unscrubbed or unexpected standalone HTTP/DB transactions when `GLITCHTIP_TRACES_SAMPLE_RATE=1.0`) — executed `initErrorTracking({ tracesSampleRate: 1 })` with a standalone `fetch` outside `traceRequest`: 0 envelopes and 0 transactions are emitted, matching ADR 0023.
- `packages/reporter/src/traces.test.ts:124-138` (`tracePropagationTargets: []` test potentially tautological in ESM without `--import`) — executed `Sentry.init` without `tracePropagationTargets: []`: `NodeFetch` (`diagnostics_channel`) does inject both `sentry-trace` and `baggage` headers, so the test genuinely fails if `tracePropagationTargets: []` is removed.
- `apps/web/src/RetentionComparison.tsx:236-242` (free-channel upgrade view potentially firing `answer_shown` with `cache: 'stored'`) — `ComparisonView` in `apps/web/src/retention-comparison.ts:99-108` has only `'compared'` and `'refused'`, so a free channel's 403 refusal is `kind: 'refused'` and never fires `answerShown`.
- `apps/extension/src/surfaces/content-list.ts:330-354` (kept `answered` reused across navigations potentially reporting stale `fromCache: false`) — when `answered.navigation !== navigation`, line 353 returns `'unsettled'` (never `'shown'`), and once `settled` is true the branch falls through to `readVideosAndSendHeldClicks`, which reads from the background keep (`fromCache: true`).
- `apps/api/src/cold-cache-walk.ts:113-168` (`walkStepsOf` ordering and `retentionCurves` empty query) — matches the spec in #1055 (single cache clear before cold pass; retention curves opened with no picks, matching the web app's default `/app/retention` load) and `cold-cache-walk.test.ts` pins all 31 steps against live `startApi` with 200 answers.

## Minor / nits
- `packages/reporter/src/scrub.ts:290-299` — although `@sentry/node` v11.4.0 does not populate `contexts.trace.description`, masking any string field or allowlisting `contexts.trace` keys (`span_id`, `trace_id`, `parent_span_id`, `op`, `status`, `origin`, `data`) would align `contexts.trace` with ADR 0023's strict allowlist invariant if a future SDK update adds fields there.
- `apps/api/src/cold-cache-walk.ts:308-310` — `JSON.parse(body)` on a `200 OK` `videoList` response assumes JSON; if a proxy or Access misconfiguration returned `200` with an HTML page, it would throw a raw `SyntaxError` rather than naming the non-JSON answer.

## Test quality
tests added or changed: 135 (`test`/`databaseTest`/`test.each`/`test.for` blocks across 24 test files) · green against `$BASE`: not run (non-Claude second-opinion runs forbid `git worktree add`) · tautology shapes found: 0.

Static audit across `apps/api/src/request-timing.test.ts`, `apps/api/src/traces.test.ts`, `apps/api/src/traces-off.test.ts`, `apps/api/src/cold-cache-walk.test.ts`, `apps/api/src/events.test.ts`, `apps/api/src/server.test.ts`, `apps/worker/test/worker.test.ts`, `packages/reporter/src/scrub.test.ts`, `packages/reporter/src/tracing.test.ts`, `packages/reporter/src/traces.test.ts`, `packages/reporter/src/logger.test.ts`, `apps/web/src/screen-timing.test.ts`, `apps/web/src/analytics.test.ts`, `apps/web/src/app.test.ts`, `apps/extension/src/product-api.test.ts`, and `apps/extension/src/surfaces/*.test.ts`:
- Tests consistently assert on boundary outputs (HTTP headers, JSON log lines, Sentry envelopes through `recordingTransport`, OpenPanel `track` payloads, `FakeOpenPanel` relayed bodies, written walk JSON files) rather than internal wiring.
- `apps/api/src/cold-cache-walk.test.ts:249-266` compares `file.timings` against `walkStepsOf()`, which would look circular in isolation, but lines 58-128 independently pin `walkStepsOf()` against hardcoded window lists, routes, queries, and step count (`31`).
- Coverage gaps already tracked in collector #1060 (`#1061`, `#1062`, `#1068`, `#1074`, `#1077`–`#1079`) were not re-filed; the two new coverage gaps uncovered here are the LCP pre-mount input/hide path (Finding 1) and `-`-terminated YouTube channel IDs in `scrub.test.ts` (Finding 2).

## Before opening the PR
- **CI readiness:** `pnpm lint` (874 files), `pnpm -r typecheck` (19/20 projects), affected unit/web/extension/worker suites (125 files, 3,847 tests), and all 8 changed API test files (314 tests) are green.
- **Commit hygiene:** working tree is clean on `7aea7d5f` aside from untracked review docs under `docs/reviews/creator-analytics-1037/`. Commit this doc (`creator-analytics#1037 pre-PR review 2`) and remediate Findings 1 and 2 via `/pr-review-remediate`, after `pre-pr-review-1.md`'s run.
- **Likely reviewer asks:** manual staging cold-cache walk and live GlitchTip/OpenPanel checks remain on #1056; remember to migrate `beforeSendTransaction` to `beforeSendSpan` before upgrading to `@sentry/node` 12 (already documented in ADR 0023 and #1092).

## Remediation scope
Nick, 2026-11-24: remediate both confirmed findings, finding 1 with the amended brief (the marked floor) and finding 2 as a LOW hardening fix. This doc's run comes after `pre-pr-review-1.md`'s.

## Verdict
**Not ready** — fix Confirmed Findings 1 (MEDIUM) and 2 (LOW after the amendment), each small and cleanly isolated with a preserved repro, via `/pr-review-remediate docs/reviews/creator-analytics-1037/pre-pr-review-2.md` before opening the PR. No CRITICAL or HIGH issues remain.

## Remediation — 2026-11-24
| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 1 (MEDIUM) | `6077b162` an input or hide before the budget screen showed dropped the page's LCP | red→green in `apps/web/src/screen-timing.test.ts`: the two repro cases, renamed ("an input before the budget screen shows sends its time as the LCP, marked as a floor", "a hide before ..."), and "a web vital carries beforeScreen only when it is true"; a new preserve case, "an input before any screen shows sends no LCP when the page then moves to a screen with no budget, or never shows a screen", green before and after; `pnpm exec vitest run apps/web` 2627/2627 | 2 docblocks (`lcp.endedAt`, `endLcp`) | proved by execution |
| 2 (LOW) | none | blocked before any commit | n/a | blocked: the recommended pattern drops a mask the scrub applies today |

After the round: `pnpm typecheck` and `pnpm lint` green.

### Finding 2, blocked
The recommended diff replaces the trailing `\b` with `(?![\w-])`. Laid against the current pattern, it stops masking two inputs the scrub masks today, which Must preserve does not name and the brief does not declare dropped. Executed with `node -e` on the three patterns, `UCabcdefghijklmnopqrstuA` standing for a real ID:

| Input | `\b` (today) | `(?![\w-])` (brief) | `(?:\b\|(?!\w))` (proposed) |
| --- | --- | --- | --- |
| `/c/<id>/v` | masked | masked | masked |
| `<id>-report.csv` | masked | **leaks** | masked |
| `/c/UC…u-/v` (ends in `-`) | **leaks** | masked | masked |
| `UC…u-x` (ends in `-`, then a letter) | masked | **leaks** | masked |
| `<id>x` (a longer token) | kept | kept | kept |
| `=<id>` | masked | masked | masked |

A real ID followed by a hyphen (a file name, a slug, a log key) is the likelier text, since a real ID never ends in `-` (this doc's severity amendment), so the brief's pattern trades a case that does not occur for one that can. The proposed right boundary `(?:\b|(?!\w))` matches everything `\b` matches today, plus an ID ending in `-` before a non-word character, and still keeps a longer token whole. The brief needs re-issuing with the right-boundary choice before finding 2 is fixed; the repro case at `repro/youtube-channel-id-trailing-hyphen.case.ts` stays the proof, plus a case for `<id>-report.csv`.

## Approach decisions (remediation, 2026-11-24)
- An LCP whose first input or hide comes before any screen shows is held as `lcp.endedAt` (the first such moment), and the observer takes no candidate after it; a budget screen's first `screenShown` sends it with `beforeScreen: true` (finding 1, Nick's decision above).

## Remediation, finding 2 — 2026-11-24
Nick, 2026-11-24: fix finding 2 with the right boundary `(?:\b|(?!\w))`, with a test for `<id>-report.csv`.

| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 2 (LOW) | `dcf37ded` a YouTube channel ID ending in a hyphen passed the scrub | red→green in `packages/reporter/src/scrub.test.ts`: the repro case plus `<id>-report.csv`, `UC…u-x`, `=<id>`, `-<id>` and a longer token kept whole; the same test is red on the review's `(?![\w-])` too; `pnpm exec vitest run packages/reporter apps/api/src/traces.test.ts` 52/52 (one 5 s timeout at load 309 on the first run, green on the rerun) | 0 | proved by execution |

## Approach decisions (finding 2, 2026-11-24)
- The channel ID pattern's right boundary is `(?:\b|(?!\w))`, not `(?![\w-])`: it keeps every mask `\b` applied and adds the trailing-hyphen ID. Supersedes the "Boundary matching" line in this doc's first Approach decisions section.
