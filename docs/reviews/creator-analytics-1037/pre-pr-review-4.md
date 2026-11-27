# Pre-PR review: creator-analytics#1037 Make Stillstats faster (delta after review 3)

**Branch:** `creator-analytics-1037-make-stillstats-faster` vs `origin/main` (merge-base `20a6c7c2`, "Merge pull request #1059 from nick-vogel/creator-analytics-938-drop-copy-pins")
**Reviewed at:** HEAD `217ac2d2` (creator-analytics#1037 pre-PR review 3: remediation follow-up, boot and start times), not pushed (8 commits ahead of origin), 0 files with uncommitted changes, 0 untracked files at the start; vs `$BASE` 91 files, +8121 / −369
**Delta under review:** since `8aff9d8d` (creator-analytics#1037 pre-PR review 2 finding 2: the test's span carries the status SpanJSON requires), the HEAD `pre-pr-review-3.md` reviewed: 10 commits, 12 files, +580 / −25, of which 8 files outside `docs/reviews/` (+164 / −25). The remediation of review 3 findings 4 to 7 (`1a843e92`, `66286ef8`, `83abcc2c`, `f2c68df5`), the repro lint fix `2cbc2e42`, and the finding 6 follow-up `3cd5e3e6`.
**Reviewed against:** epic #1037's spec as distilled in the prior docs; `pre-pr-review-3.md`'s briefs for findings 4 to 7, its Approach decisions, Remediation scope, closure table, Known regressions and follow-up; ADR 0023; the README's `web_vital` line; the global rules in `~/.claude/rules/`; the repo rules in `.claude/rules/` (`youtube-test-limits`, `row-level-security-tests`, neither covering these files). The repo has no `AGENTS.md` or `CLAUDE.md`.
**Date:** 2026-11-24
**Reviewer:** 2 code-review agents + verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Lint, typecheck, build, suite, browser walk | `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm run --if-present test:browser` at `217ac2d2`, Node 26.3.0 (CI runs 24) | all exit 0; suite 228 files, 5997 passed, 1 expected fail; browser walk passed |
| Tautology audit (Phase 4.5) | The delta's 3 changed `*.test.ts` copied into a scratch worktree at `8aff9d8d` (`pnpm install --offline`), then `pnpm exec vitest run apps/web/src/screen-timing.test.ts packages/reporter/src/scrub.test.ts packages/reporter/src/traces.test.ts`; worktree removed after | 4 of the 5 new cases red; 1 green, the deliberate signed-out guard (see Test quality). The key pins added to two existing cases are green there by design: they pin keys already kept, and the remediation proved each red by deleting its key |
| Finder A, web | `pr-review-finder` over `screen-timing.ts`, its test, the README `web_vital` line and the finding 4 repro, with 9 probe cases (P1 to P9) in a scratch copy of the test file | finding 4's intent holds on every path probed: move then input, background load then move, two moves, move to Settings then a budget screen, move then hide then show, one LCP only, screen shown first, input then move from Settings, move from the sponsor report; every `replace: true` call site stays on one budget screen. 7 candidates, all tests or docs |
| Finding 1 proof | `&& timing.lcp.loadedOn === undefined` deleted from `changeStarted` in the scratch worktree (HEAD's `screen-timing.ts`), then the shipped `screen-timing.test.ts`; then `repro/lcp-second-move-keeps-load-screen.case.ts` pasted in, against the mutant and against HEAD | shipped suite 34/34 green with the mutant; the repro red with the mutant, green at HEAD; the repro passes `biome check` |
| Finder B, reporter, extension docblock, repro lint | `pr-review-finder` over `scrub.ts`, `scrub.test.ts`, `traces.test.ts`, `tracing.ts`, the `Redrawn` docblock and the ahead-redraw repro; one real traced request through `@sentry/node` 11.4.0 with the recording transport | the key lists equal what 11.4.0 fills, less `boot_time` and `app_start_time`; `trace` still goes through `traceContextKeys`; `scrubEvent` unchanged; `traces.test.ts`'s header assertion reads the real envelope; the `tracing.ts` docblock matches `DEFAULT_IGNORE_STATUS_CODES`; the repro's `biome-ignore` is needed as committed. `pnpm exec vitest run packages/reporter apps/api/src/traces.test.ts` 54/54 |
| Finding 2 absence | `grep -rn "culture\|processor_count\|kernel_version" packages/reporter/src/*.test.ts apps/api/src/traces.test.ts` | no match |
| `cloud_resource` claim | `grep` of `@sentry/node` 11.4.0 `build/cjs/integrations/context.js` | the SDK sets `cloud.provider`, `cloud.region`, `cloud.platform`, `cloud.availability_zone`, and `cloud.account.id` only from `TENCENTCLOUD_APPID` (`:363`); no `host.id` (comment hygiene) |
| Em-dash in shipped copy | `git diff 8aff9d8d HEAD -- README.md apps packages` added lines | none |
| Not run | nothing skipped | `apps/api/src/traces.test.ts` ran without Docker |

**Overall:** the delta closes review 3 findings 4, 5, 6 and 7, and the follow-up, against their intent: every LCP path the brief and the deferred notes name behaves as designed, and the trace scrub's runtime lists match the SDK. What is left is two LOW test gaps, both already on review 3's Known regressions list, and a comment sweep. No CRITICAL, HIGH or MEDIUM. The branch can open its PR; the three findings are cheap enough to land first.

## Approach decisions
Carried forward, binding:
- Review 1: a redraw is a `Redrawn` answer beside `Cut`; the watch's per-navigation record lives only through consecutive own-pass redrawn answers; each request's root span starts a new trace (`Sentry.startNewTrace`); the trace scrub builds the event, each span and the trace context from named lists; an error event's transaction name goes through `maskSecrets`.
- Review 2: an LCP whose first input or hide comes before any screen shows is held as `lcp.endedAt` and sent as a floor with `beforeScreen: true`; the channel ID pattern's right boundary is `(?:\b|(?!\w))`.
- Review 3: the extension timing subsystem takes no further in-place rewrite in this PR; its findings 1 to 3 and Needs Further Investigation A are #1108. A navigation from a budget route before any screen shows holds the floor for the screen the page loaded on (`lcp.loadedOn`, set once at the first move before any screen shows, from `budgetScreenOf(previous)`), with `lcp.screen` left undefined until a screen shows; `screenShown` names the LCP `loadedOn ?? screen`. The trace scrub's runtime contexts get named key lists (`runtimeContextKeys`), read from a real traced request; `cloud_resource` is dropped whole; `browser` takes the other-context path; the error scrub keeps runtime contexts whole. The keys the envelope and GlitchTip's filters need are pinned at both layers.
- Review 3 follow-up (Nick): `device.boot_time` and `app.app_start_time` leave no trace; `device.memory_size`, `device.cpu_description` and `os.kernel_version` stay.

Added this round:
- None. Both test findings add cases only; the comment sweep changes no mechanism.

## Confirmed Issues
### 1. No shipped test fails when the guard that keeps the first move's screen and floor is removed — LOW
- **Location:** `apps/web/src/screen-timing.ts:327` (`changeStarted`), test gap in `apps/web/src/screen-timing.test.ts`
- **Attribution:** known regression, deferred. `pre-pr-review-3.md`, Known regressions, deferred: "No test covers a second move keeping the first `loadedOn` and floor, a move then an input, or a background load with a move; the verifier's probe shows all three behave as intended." The guard is from `1a843e92` (review 3 finding 4); `screen-timing.ts` does not exist at `20a6c7c2`. This round proves the gap leaves a mutant alive.
- **Real-world trigger:** none today; the code is right. A later edit that drops the `loadedOn === undefined` clause would ship with the suite green, and then two moves before the screen shows (two sidebar clicks while `/api/me` is slow) send the floor under the second move's screen, or drop it when the first move went to a screen with no budget. LOW, as a coverage gap on a correct line.

**Evidence**
```ts
  if (timing.lcp.screen === undefined && timing.lcp.loadedOn === undefined) {
    const loadedOn = budgetScreenOf(previous)
    if (loadedOn === null) timing.lcp.screen = null
    else timing.lcp.loadedOn = loadedOn
  }
```

**Failure mode** — executed: with `&& timing.lcp.loadedOn === undefined` deleted, the shipped `screen-timing.test.ts` is 34/34 green. `repro/lcp-second-move-keeps-load-screen.case.ts` (a move from Audience to the list at 1,000, a move from the list to Retention at 2,000, then `screenShown('/app/retention')`) is red with the mutant, sending the floor under `/app/` instead of `{ value: 1000, screen: '/app/audience', beforeScreen: true }`, and green at HEAD.

**Recommended fix** — ship the repro as a test in `describe('the web vitals', ...)`, after "a move to another budget screen before either shows sends its time as the LCP of the screen the page loaded on, marked as a floor":
```ts
  test('a second move before the budget screen shows keeps the first move time and the screen the page loaded on', () => {
    const browser = started()
    browser.at(1_000)
    changeStarted(at('audience'), list)
    browser.at(2_000)
    changeStarted(list, at('retention'))
    screenShown('/app/retention')

    expect(tracked()).toEqual([
      {
        name: 'web_vital',
        metric: 'LCP',
        value: 1_000,
        screen: '/app/audience',
        beforeScreen: true,
      },
    ])
  })
```

**Remediation brief**
- **Design intent:** one LCP per page load, for the budget screen the page loaded on. The first input, hide or move before any screen shows fixes both the floor time (`endedAt ??=`) and, for a move, the load screen (`loadedOn`, set once). Later moves before a screen shows change neither.
- **Full surface:** `apps/web/src/screen-timing.test.ts` only, the new case beside the two move cases (`:444` to `:483`).
- **Must preserve:** every case in `apps/web/src/screen-timing.test.ts`; `screen-timing.ts` unchanged.
- **Do not touch:** `screen-timing.ts` (correct as is); the signed-out guard "a move from a budget screen and then a hide, with no screen ever shown, sends no LCP" (see Reviewed and Dismissed).
- **Proof:** `pnpm exec vitest run apps/web/src/screen-timing.test.ts -t 'a second move before the budget screen shows'` green at HEAD; with `&& timing.lcp.loadedOn === undefined` deleted from `changeStarted` it goes red (restore the line after). This is a test-only finding, so its red is against the mutant, not against HEAD.

### 2. Most of each runtime context key list has no test, so a dropped key goes unnoticed — LOW
- **Location:** `packages/reporter/src/scrub.ts:279-295` (`runtimeContextKeys`), test gap in `packages/reporter/src/scrub.test.ts`
- **Attribution:** known regression, deferred. `pre-pr-review-3.md`, Known regressions, deferred: "The new test covers `os` and `cloud_resource` only, not the `app`, `device`, `culture` and `runtime` lists." `3cd5e3e6` added `app.app_memory` and `device.arch`; the rest is still unpinned. Introduced by `83abcc2c` (review 3 finding 6).
- **Real-world trigger:** none today; the lists equal what `@sentry/node` 11.4.0 fills. A later edit, or the `@sentry/node` upgrade (#1092), that drops `culture` or one of `os.kernel_version`, `os.version`, `os.build`, `device.memory_size`, `device.free_memory`, `device.processor_count`, `device.cpu_description`, `device.processor_frequency`, `app.free_memory` ships with the suite green, and GlitchTip loses that field from every trace. It fails closed (data dropped, never leaked). LOW.

**Evidence**
```ts
const runtimeContextKeys = new Map<string, readonly string[]>([
  ['app', ['app_memory', 'free_memory']],
  ['culture', ['locale', 'timezone']],
```
The tests assert `runtime.name` and `runtime.version`, `os.name`, `app.app_memory` and `device.arch` only; `grep -rn "culture\|processor_count\|kernel_version" packages/reporter/src/*.test.ts apps/api/src/traces.test.ts` finds nothing.

**Failure mode** — finder B, by reading: deleting the `culture` entry sends `culture` through `scrubTraceData`, and deleting any listed key drops it; no case asserts either. Not executed here: the absence is grep-proved, and the `os` mutant is already red.

**Recommended fix** — replace the test "a transaction's app and device contexts leave without the boot and start times that mark one server" with one case over the full shape 11.4.0 fills on a traced request (recorded by finder B through the recording transport, Darwin; Linux fills a subset, with no `os.build`):
```ts
  test("a transaction's runtime contexts keep every key @sentry/node 11.4.0 fills on a traced request but the boot and start times that mark one server", () => {
    const scrubbed = scrubTransaction({
      ...transaction,
      contexts: {
        ...transaction.contexts,
        app: { app_start_time: '2026-11-24T17:16:57.631Z', app_memory: 111738880, free_memory: 2048 },
        culture: { locale: 'en-US', timezone: 'Europe/Berlin' },
        device: {
          boot_time: '2026-11-14T21:11:17.867Z',
          arch: 'x64',
          memory_size: 17179869184,
          free_memory: 4096,
          processor_count: 8,
          cpu_description: 'Intel(R) Xeon(R)',
          processor_frequency: 2400,
        },
        os: { kernel_version: '6.8.0', name: 'Linux', version: '24.04', build: '1' },
        runtime: { name: 'node', version: 'v24.22.1' },
      },
    })

    expect(scrubbed.contexts?.app).toEqual({ app_memory: 111738880, free_memory: 2048 })
    expect(scrubbed.contexts?.culture).toEqual({ locale: 'en-US', timezone: 'Europe/Berlin' })
    expect(scrubbed.contexts?.device).toEqual({
      arch: 'x64',
      memory_size: 17179869184,
      free_memory: 4096,
      processor_count: 8,
      cpu_description: 'Intel(R) Xeon(R)',
      processor_frequency: 2400,
    })
    expect(scrubbed.contexts?.os).toEqual({
      kernel_version: '6.8.0',
      name: 'Linux',
      version: '24.04',
      build: '1',
    })
    expect(scrubbed.contexts?.runtime).toEqual({ name: 'node', version: 'v24.22.1' })
  })
```
Line by line against the replaced case: it kept `app.app_start_time` and `device.boot_time` out and `app.app_memory` and `device.arch` in; the new case asserts all four the same way, so nothing it pinned is lost, and one rule keeps one test.

**Remediation brief**
- **Design intent:** ADR 0023: a trace keeps a key only when it is on its list, at every level. A runtime context of a transaction keeps exactly the keys `@sentry/node` 11.4.0 fills on a traced request, less the boot and start times (Nick's follow-up), so a later SDK key stays in the process, and a key dropped from a list is a visible decision.
- **Full surface:** `packages/reporter/src/scrub.test.ts` (`:351`, the boot-and-start case, replaced).
- **Must preserve:** `scrub.test.ts` "a transaction keeps its runtime contexts and drops its user, extra, breadcrumbs and any other context data" and "a transaction's runtime contexts keep only the keys the scrub names, and its cloud resource ... goes"; every `scrubEvent` case; `packages/reporter/src/traces.test.ts`; `apps/api/src/traces.test.ts`.
- **Do not touch:** `scrub.ts` (the lists are right); `scrubEvent`'s contexts branch.
- **Proof:** `pnpm exec vitest run packages/reporter/src/scrub.test.ts -t 'every key @sentry/node'` green at HEAD; red with the `culture` entry deleted from `runtimeContextKeys`, red with `'processor_count'` deleted from the `device` list, red with `'app_start_time'` added to the `app` list (restore each after).

### 3. Comment hygiene — LOW (aggregated)
- `apps/web/src/screen-timing.ts:376-378` (`screenShown` docblock) — "the first screen shown names the page's LCP" → "the first screen shown names the page's LCP, unless a move before it already named the screen the page loaded on"
- `apps/web/src/screen-timing.ts:320-323` (`changeStarted` docblock) — "the page's LCP is done" → "the page's LCP is done, or, before any screen shows, held as a floor for the screen the page loaded on"
- `apps/web/src/screen-timing.ts:194-196` (`lcp.screen` and `lcp.loadedOn`) — `loadedOn` has no docblock beside a `screen` docblock that says the same thing ("The screen the page loaded on") → keep `screen`'s line as "The screen the LCP is sent for: null for a page loaded on a route with no budget, undefined until a screen shows or a move names it." and give `loadedOn` "The budget screen the page loaded on, set by the first move before any screen shows."
- `README.md:151` (`web_vital`) — "A page loaded on a screen with no budget, and one whose screen never shows, sends no LCP" → "A page loaded on a screen with no budget, and one on which no budget screen ever shows, sends no LCP" (a load on Audience that moves to the list sends its floor under `/app/audience`, which never shows)
- `packages/reporter/src/scrub.ts:251-253` (`transactionKeys` docblock) — "but the boot and start times, which together mark one server, and `cloud_resource` goes whole, since it can hold the host's ID." → "but the boot and start times, each of which marks one server, and `cloud_resource` goes whole, since it can hold the cloud account's ID and GlitchTip's performance view reads none of it." (11.4.0 sets no `host.id`; it sets `cloud.account.id` from `TENCENTCLOUD_APPID`, `integrations/context.js:363`)
- `packages/reporter/src/scrub.test.ts:337` (test title) — "and its cloud resource, the host's identity, goes" → "and its cloud resource goes" (same false reason)
- `packages/reporter/src/scrub.test.ts:326` (test title) — "a transaction keeps its runtime contexts and drops ..." → "a transaction keeps its runtime contexts' named keys and drops ..."
- `apps/extension/src/surfaces/page-watcher.ts:41-42` (`Redrawn` docblock, review 3 finding 7's text) — "or, when a pass ahead of WXT's report read it first, from that pass's start or with its whole time" → "or, when a pass ahead of WXT's report showed the figure or was cut short reading it, with that pass's whole time or from its start" (an ahead pass that itself answered `Redrawn` notes nothing, `noteReadAhead` `:436`: that is #1108's case, so the current text reads as if #1108 were fixed)

## Needs Further Investigation
### A. Review 1's Needs Further Investigation A, carried untouched
A refused answer leaves its change waiting in the web app's screen timing (`pre-pr-review-1.md`, Needs Further Investigation A; `pre-pr-review-3.md` B). Out of scope; still open.

## Reviewed and Dismissed
- **The signed-out guard "a move from a budget screen and then a hide, with no screen ever shown, sends no LCP" passes against the old bug and states the deferred regression as a rule** (finder A). It is the case review 3's brief asked for, against the rejected Grok mechanism that set `lcp.screen` at the move, and it goes red against that mechanism; its title is the approved intent ("a load whose screen never shows sends nothing"). The deferred note covers the signed-in look-alike. Keep it.
- **A null or primitive context throws in `picked`** (`scrub.ts:336-338`). Unreachable: the Context integration rebuilds `app`, `os`, `device`, `culture` and `cloud_resource` as objects, `runtime` falls back to the client's option, and `scope.setContext(name, null)` deletes the key. If it happened, core's `safeCallback` drops the transaction, so it fails closed.
- **`contexts.response` leaves as `{}`.** By design: every context not on a list goes through `scrubTraceData`, as `report` does in the must-preserve case; the status travels as `http.response.status_code` in `contexts.trace.data`.
- **A `replace` navigation before the first move leaves a wrong `loadedOn`.** Every `replace: true` call site (`App.tsx:571`, `route.ts:403`, `route.ts:493`, `RetentionComparison.tsx:201,223`, `VideoList.tsx:492,509,536`, `video-list.ts:752`) stays on one budget screen.
- **The new key pins in "a transaction keeps only the keys the scrub names ..." and the reporter's rate-1.0 trace test pass at `8aff9d8d`.** They pin keys already kept; the remediation proved each red by deleting its key from `transactionKeys`, and `header.trace?.trace_id` is also matched against `/^[0-9a-f]{32}$/`, so two undefineds cannot pass.

## Minor / nits
- `scrub.ts:335`: the `flatMap` callback is typed `unknown[][]`, so `Object.fromEntries` answers `any` and `scrubbed.contexts` loses its type; `[string, unknown][]` keeps it.
- `scrub.ts`: the rule for runtime contexts lives in `transactionKeys`'s docblock, about 30 lines above `runtimeContextKeys`.
- `repro/lcp-navigation-before-screen.case.ts`: its two cases now ship as `screen-timing.test.ts` cases (`:444`, `:457`); its header could say so.
- `repro/ahead-redraw-timing.case.ts:33`: the `biome-ignore` may read as unused once pasted into `page-watcher.test.ts`, where `stop` is a declared `let` (unverified).
- The signed-out guard could also show a later budget screen, to prove a hold rather than a drop; P5 shows that shape passes at HEAD.
- `README.md:151`, pre-existing wording from #1053: "the first change of screen" also covers a same-screen move (a filter, a sort, Back across them), since `changeStarted` runs on any move that is not a `replace`.

## Test quality
Tests added or changed in the delta: 5 new cases and 3 changed ones in 3 files. Red at `8aff9d8d`: 4 of the 5 new cases ("an input and then a move before the budget screen shows ...", "a move to another budget screen before either shows ...", "a transaction's runtime contexts keep only the keys the scrub names ...", "a transaction's app and device contexts leave without the boot and start times ..."). Green at `8aff9d8d`: the signed-out guard, by design (Reviewed and Dismissed). The changed cases are two key pins (red by key deletion in the remediation) and a renamed title. Tautology shapes found: none. Coverage gaps: findings 1 and 2.

## Prior-review closure
- `pre-pr-review-3.md` finding 4: fully fixed. Every path in the brief, its Must preserve and the deferred notes behaves as designed (finder A's probes P1 to P9); the second-move guard is unpinned (finding 1).
- Finding 5: fully fixed; both layers' pins go red with their key deleted.
- Finding 6 and its follow-up: fully fixed; the lists equal what 11.4.0 fills, less the two times; most keys are unpinned (finding 2).
- Finding 7: fixed; two of its own texts are imprecise (the `Redrawn` docblock, and the false `cloud_resource` reason the finding 6 docblock carries), in finding 3 here.
- Findings 1 to 3 and Needs Further Investigation A: in #1108, untouched as scoped (`page-watcher.ts` changed only in its docblock). Nothing was "resolved" by a comment edit alone.

## Before opening the PR
- **CI readiness:** all five full checks green at `217ac2d2` on Node 26.3.0; CI runs 24.
- **Commit hygiene:** commit this doc and `repro/lcp-second-move-keeps-load-screen.case.ts` as `creator-analytics#1037 pre-PR review 4`. No commit in the delta carries AI attribution; the delta adds no em-dash.
- **Likely reviewer asks:** whether the baseline (#1056) waits for #1108, since it reads `extension_surface_shown`; the four spec-made decisions in the epic's Further Notes.

## Verdict
Ready to open the PR as-is, with follow-ups. The confirmed count is 2 LOW and a comment sweep, against 4 MEDIUM, 2 LOW and a sweep in review 3: both LOWs are coverage gaps the prior round already listed as deferred, and nothing in the delta is a behaviour defect. That is the expected shrink, not the bottom of the barrel. Gate: none. Findings 1, 2 and 3 are test-only and comment-only, about three commits through `/pr-review-remediate`, and are worth landing before the push since the PR has not opened. #1108 stays the home of the extension's redraw timing.

## Remediation: 2026-11-24
Scope: Nick asked for all three findings, the LOW tail included ("commit and run it", in reply to the offer to remediate the three findings before the push).

| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 1 (LOW) | `c3ca5f9d` no test pinned the guard that keeps the first move's screen and floor | red→green against the mutant: `pnpm exec vitest run apps/web/src/screen-timing.test.ts -t 'a second move before the budget screen shows'` red with `&& timing.lcp.loadedOn === undefined` deleted from `changeStarted`, green at HEAD (file restored); `screen-timing.test.ts` 35/35 | 0 | proved by execution |
| 2 (LOW) | `112f2e11` most of each runtime context key list had no test | red→green against three mutants: `pnpm exec vitest run packages/reporter/src/scrub.test.ts -t 'every key @sentry/node'` red with the `culture` entry deleted, with `'processor_count'` deleted from `device`, and with `'app_start_time'` added to `app`; green at HEAD (file restored each time). Preserve: `pnpm exec vitest run packages/reporter apps/api/src/traces.test.ts` 54/54 | 0 | proved by execution |
| 3 (LOW, comment hygiene) | `a26cd499` comment hygiene | each of the eight texts read against its code | 2 (the corrections; `lcp.loadedOn` gets a one-line docblock, `lcp.screen`'s becomes two lines) | excluded from verify |

Checks after the round: `pnpm typecheck` and `pnpm lint` green. `pnpm test`, first run: 27 failures in 11 files, all in `apps/api` and `apps/worker` database suites (`video-revenue.test.ts`, `retention-curves.test.ts` and others) that this round does not touch, run straight after the typecheck; rerun at once with no change: 228 files, 5998 passed, 1 expected fail. Not a regression of this round; recorded as flaky under load, no test case added.

### Known regressions, deferred
None introduced.

### Rework briefs
None.

### Approach decisions (this remediation)
- Finding 1: the guard is pinned by a shipped case built from `repro/lcp-second-move-keeps-load-screen.case.ts`, as review 3 finding 4's repro became shipped cases.
- Finding 2: one case over the full context shape @sentry/node 11.4.0 fills replaces the narrower boot-and-start case, so one rule keeps one test and the boot and start times stay asserted absent.
