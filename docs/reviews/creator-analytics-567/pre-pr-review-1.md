# Pre-PR review: creator-analytics#567 Versioned releases, release notes and a staging environment

**Branch:** `creator-analytics-567-releases-staging` vs `origin/main` (merge-base `bbba1fb` "Merge pull request #566 from nick-vogel/creator-analytics-337-retention-numbers-table")
**Reviewed at:** HEAD `023050a` ("creator-analytics#579 Rollback to a named version"). The tree was clean, with no uncommitted or untracked files at review time. 133 files, +7,683 / −278, 23 commits: the eight landed child tickets #572, #574, #575, #576, #577, #578, #579 and #580, each a lane commit plus its merge, and the review-pass fix commits `8178d12`, `3c9001b` (#572), `d8d8357`, `4bf9452` (#576) and `47278ef` (#580).
**Reviewed against:** the epic body of creator-analytics#567 (its End state, User Stories, Implementation Decisions and Testing Decisions are the spec), its sub-issues #572 to #581 and #593 (#573 closed by Nick, #581 and #593 open and carried by no commit here), `CODING_STANDARDS.md` 1 to 3, `CONTEXT.md`, ADR 0011, ADR 0012 and ADR 0018. No prior review of this branch (`--fresh`).
**Date:** 2026-11-10
**Reviewer:** 3 code-review agents, 1 test-oracle agent, and a verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | up to date |
| Lint | `pnpm lint` | pass |
| Typecheck | `pnpm typecheck` | pass |
| Build | `pnpm build` | pass |
| Full suite, local | `pnpm test` (Docker up, Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | 156 files, 3,910 passed, 1 expected fail |
| Full suite under GitHub Actions' variables | `CI=true GITHUB_ACTIONS=true GITHUB_SHA=023050a… GITHUB_EVENT_NAME=pull_request pnpm test` | **1 failed**: `packages/reporter/src/index.test.ts` "with no release given, a report carries none". Finding 1. Every other file passes. |
| Browser walk | `pnpm run --if-present test:browser` | pass, "No content security policy violation in 55 steps"; no site page is among the steps (finding 2) |
| Tests green at `$BASE` | scratch worktree at `bbba1fb`, the 14 modified test files copied in, run there; new files spot-checked for red on import | 120 new or changed tests; 10 groups (21 cases) green at base, each a negative control of a red positive case, none a finding proof, none vacuous. See Test quality. |
| Release notes reach the image | scratch Docker build of a context with the repo's `.dockerignore`, a root `README.md`, `docs/a.md` and `packages/releases/notes/2026.11.9.md` | only the nested note survives: `*.md` matches root markdown only. Dismissed. |
| GitHub Environments | `gh api repos/nick-vogel/creator-analytics/environments/{staging,production}/secrets` | each holds `DOKPLOY_WEBHOOK_API`, `DOKPLOY_WEBHOOK_WORKER`, `MIGRATION_DATABASE_URL` |
| Workflow CLIs | finder ran `pnpm --silent --filter @creator-analytics/releases release-tag-check …` and `rollback-check …` | flags pass through, only `key=value` lines on stdout, exit 1 with the reason on stderr; with no `notes/` the tag check refuses an app tag |
| Date-sorted newest release | finder ran the tag-check CLI over notes `2026.11.12` dated 2026-11-14 and `2026.11.13` dated 2026-11-13 | tag `2026.11.13` refused, tag `2026.11.12` deploys. Finding 6. |
| Sentry release detection | read `@sentry/node` 11.4.0 `build/esm/sdk/index.js:156` `getRelease` and `api.js:5` `getSentryRelease` | an unset `release` falls back to `SENTRY_RELEASE`, `GITHUB_SHA` and other CI or host variables |
| Script injection | grep of every `run:` block in the three workflows | `tag_name` and `inputs.version` reach scripts only through `env:` |
| OpenPanel | read `whats-new.ts`, `App.tsx`, `Sidebar.tsx`, `WhatsNewBanner.tsx`, `app.test.ts` | the two approved events only, fired from handlers, no account ID; the version link sends nothing |
| Em-dashes in shipped strings | grep of added lines in `apps/`, `packages/`, templates and fixtures | none |
| Not run | the workflows on GitHub, the staging stack, the extension's `test/manifest.test.ts` by a finder (it builds into `.wxt/`; the full suite ran it), the site under `vite dev` | the first real release and rollback are #581's walk, per the epic's Testing Decisions |

**Overall:** Every End-state item of the epic is implemented, and lint, typecheck, build, the local suite and the browser walk pass. Two MEDIUMs gate the PR: one new reporter test fails on GitHub Actions, because the error SDK reads the runner's `GITHUB_SHA` as a release, so the PR's own CI goes red; and the browser walk never loads a release page, which the epic's Testing Decisions require. The fourteen LOWs are cheap and mostly cross-ticket edges (a failed settings or preferences read, the date-sorted "newest" release, a release commit without images, rollback guidance), plus test hygiene and comments.

## Approach decisions
- Reporter release in tests (finding 1): the test isolates itself from the runner's variables with `vi.stubEnv`, and production keeps the SDK's own release detection, which `packages/reporter/src/sessions.test.ts:11` depends on. Precedent: `vi.stubEnv('RAILWAY_GIT_COMMIT_SHA', '09014ed')` at `packages/reporter/src/sessions.test.ts:11`.
- Release page in the browser walk (finding 2): the walk builds the site with the same `buildEnvironment()` as the web app (fixture `RELEASE_CONTENT_ROOT`), and the stub serves the site's build with the API's page mapping (clean path, then `${path}.html`, and `.html`, `/index`, `/404` refused). Precedent: the API's own mapping at `apps/api/src/app.ts:324-333`, and the stub's `serveWebApp` at `apps/site/test/screenshot/stub-api.ts:646`.
- Review repro files: `biome check .` lints `docs/reviews/**`, so any repro committed here must pass `pnpm lint`. This review commits none; each proof is a one-line command.
- Env stubs in the reporter test (remediation 1, finding 1): restored in the file's `afterEach` with `vi.unstubAllEnvs()`, not at the end of the test, so a failing test cannot leak its stubs into the next. Precedent: `apps/web/src/error-reporting.test.ts:34`.
- Site page readiness in the browser walk (remediation 1, finding 2): a site visit (`visitPage`) waits for the document at its own path to be complete, its fonts loaded and two frames drawn, because the web app's `screenLanded` needs a header or nav inside `main`, which site pages lack. The step keeps the `route: <path>` name of the web app's `visit`. Precedent: `readyCheck` in `apps/site/test/screenshot/browser-walk.ts`.
- A site page's heading in the walk (remediation 1, finding 2): found by role and accessible name, then held to be the `H1`, because the release index lists each release as an `h2` with the release page's own name.

## Confirmed Issues

### 1. A new reporter test fails on GitHub Actions, so the PR's CI goes red — MEDIUM
- **Location:** `packages/reporter/src/index.test.ts:78-88`, with its premise in the comment at `packages/reporter/src/index.ts:29`
- **Attribution:** introduced by `5b0a7a6` ("creator-analytics#575 Runtime client settings, and the version in the account menu"): `git log --oneline -S'with no release given' bbba1fb..HEAD` names only it, and the test is absent at `bbba1fb`.
- **Real-world trigger:** opening the PR. `.github/workflows/ci.yml` runs `pnpm test` in the `check` job, and GitHub Actions sets `GITHUB_SHA` in every step. No user path; the cost is a red CI on the PR and on main, which blocks the merge. MEDIUM as a merge gate, not as user impact.

**Evidence**
```ts
test('with no release given, a report carries none', async () => {
  const { envelopes, transport } = recordingTransport()
  initErrorTracking({ dsn, transport, environment: 'production' })
  ...
  expect(event?.release).toBeUndefined()
})
```
`packages/reporter/src/index.ts:29`: `/** The version the process runs. Unset, a report carries no release. */`. `@sentry/node` 11.4.0 `sdk/index.js:156-164`: `getRelease(release)` returns `release` when given, else `getSentryRelease()`, which reads `SENTRY_RELEASE`, then `GITHUB_SHA` and a list of other CI and host commit variables.

**Failure mode** — `GITHUB_SHA=abc123deadbeef pnpm exec vitest run packages/reporter/src/index.test.ts` fails: `expected 'abc123deadbeef' to be undefined`. The whole suite under GitHub Actions' variables fails on this test alone. In the images none of the detected variables is set, so production reports carry no release while the build holds no note; the comment is still wrong wherever one is set.

**Recommended fix**
```diff
   test('with no release given, a report carries none', async () => {
+    vi.stubEnv('GITHUB_SHA', '')
+    vi.stubEnv('SENTRY_RELEASE', '')
     const { envelopes, transport } = recordingTransport()
     initErrorTracking({ dsn, transport, environment: 'production' })
@@
     expect(event?.release).toBeUndefined()
+    vi.unstubAllEnvs()
   })
```
Add `vi` to the file's `vitest` import if it is not there. Rename the test to the rule the reporter owns, such as "with no release given, the reporter adds none of its own", and add one Limits line above it: the SDK reads a release from `SENTRY_RELEASE` or a CI or host commit variable, which the test clears, so the test holds the reporter's rule and not the SDK's detection. Change `index.ts:29` to `/** The version the process runs. Unset, the SDK's own detection applies (SENTRY_RELEASE, or a CI or host commit variable such as GITHUB_SHA); the images set none. */`.

**Remediation brief**
- **Design intent:** `initErrorTracking` passes `environment` and `release` to `Sentry.init` only when given; the API and the worker pass the build's version (`deploymentOf(...).version ?? undefined`). The SDK's fallback detection is deliberate repo knowledge: `sessions.test.ts` relies on it to make the SDK record a session.
- **Full surface:** `packages/reporter/src/index.test.ts:78-88`, `packages/reporter/src/index.ts:29`. No production code changes.
- **Must preserve:** `packages/reporter/src/index.test.ts:64` "a report carries the environment and the release error tracking started with"; `packages/reporter/src/sessions.test.ts` (its own file, its own `RAILWAY_GIT_COMMIT_SHA` stub); `apps/api/src/server.test.ts` and `apps/worker/test/worker.test.ts`, which spawn processes with an explicit env and are unaffected.
- **Do not touch:** do not stop the SDK's release detection in `initErrorTracking` (for example `release: ''`): `sessions.test.ts` depends on it, and an empty string would ship as a release.
- **Proof:** `GITHUB_SHA=abc123deadbeef pnpm exec vitest run packages/reporter/src/index.test.ts` red now, green after; then `CI=true GITHUB_ACTIONS=true GITHUB_SHA=abc123 pnpm test` green.

### 2. The browser walk never loads a release page, which the epic's Testing Decisions require — MEDIUM
- **Location:** `apps/site/test/screenshot/browser-walk.ts:254` (builds only the web app), `apps/site/test/screenshot/stub-api.ts:66` and `:646` (serves only `web/dist`), `apps/site/test/screenshot/browser-walk.ts:475-484` (the What's new step checks a release link's `href` and goes no further)
- **Attribution:** introduced, as a spec gap: the walk's What's new step came in `52a2b3a` ("creator-analytics#577 The \"What's new\" screen") and its banner step in `8f52c0a` (#580); no commit adds a site page to the walk. At `bbba1fb` the stub also served only `webRoot`, so no site page was ever walked; the release pages are new and the epic names them.
- **Real-world trigger:** a release page that breaks the page policy in Chrome in a way the static checks miss, for example a script or resource the release templates or the site's runtime `fetch('/api/client-settings')` path add. `site.test.ts` holds the policy statically (same policy on every page, no inline script or style, 200 at every clean path), so the gap is the in-browser check only. MEDIUM, capped: a claim of coverage the branch does not have, against an explicit Testing Decision ("The browser walk visits `/app/whats-new` and a release page, with the stub API answering the runtime settings, and fails on any CSP violation as it does today").

**Evidence**
```ts
await run('pnpm', ['--filter', '@creator-analytics/web', 'build'], buildEnvironment())
...
const webRoot = fileURLToPath(new URL('../../../web/dist/', import.meta.url))
...
    if (href !== '/releases/2026.11.9') {
      throw new Error(`The newest highlight's release link goes to ${String(href)}`)
```

**Failure mode** — the walk passes with 55 steps and no site URL among them; a policy violation on `/releases/` or `/releases/<version>` in a real browser cannot turn it red.

**Recommended fix** — in `browser-walk.ts`, build `@creator-analytics/site` beside the web app with the same `buildEnvironment()`; in `stub-api.ts`, add a `serveSite(path, response, missing)` for every GET outside `/app/` and `/api/`, mapping as the API does: refuse a path ending `.html` or equal to `/index` or `/404`, then try the file at the path (a directory answers its `index.html`), then `${path}.html`, then `missing()`; in the walk, after the What's new step, `await visit('/releases/')` and `await visit('/releases/2026.11.9')`, each with one `walk(...)` that finds the page's `h1` by role, so the step proves the page rendered.

**Remediation brief**
- **Design intent:** the walk is the only in-browser policy gate and runs only locally (commit-stage rule). The CSP is built into each page by `packages/visual-system/src/vite.ts`, so serving the site's build as files carries the real policy; the violation listener the walk installs before each navigation (`browser-walk.ts:205`) does the rest. The web fixture content root (`webContentRoot`, `browser-walk.ts:136`) holds notes `2026.11.2`, `2026.11.9` and `2026.11.9.1`, so `/releases/2026.11.9` exists in a site built with it.
- **Full surface:** `apps/site/test/screenshot/browser-walk.ts:135-140` (the env, reused), `:254` (the build), `:475-484` (the step to follow); `apps/site/test/screenshot/stub-api.ts:66` (add a `siteRoot` beside `webRoot`) and its request router (the branch that calls `serveWebApp`); `apps/site/test/screenshot/take-screenshot.ts`, which starts the same stub, must keep working without a site build or build it too.
- **Must preserve:** every existing walk step and its count of policy-free steps; `serveWebApp`'s SPA fallback for `/app/*`; the stub's API answers, including `GET /api/client-settings`; `pnpm run test:browser` stays out of CI.
- **Do not touch:** the API's own mapping at `apps/api/src/app.ts:324-333`; the dismissed `/releases/index` alias (Minor) is not this finding.
- **Proof:** before the fix, `grep -n "visit('/releases" apps/site/test/screenshot/browser-walk.ts` prints nothing; after, `pnpm run test:browser` passes and its log lists `route: /releases/` and `route: /releases/2026.11.9`. Then plant an inline `<script>x</script>` in `apps/site/templates/release.html` in a scratch worktree and confirm the walk fails there.

### 3. The web app paints nothing until the settings request answers, and has no timeout — LOW
- **Location:** `apps/web/src/main.tsx:25-52`, `apps/web/src/client-settings.ts:7-14`
- **Attribution:** introduced by `5b0a7a6` (#575); at `bbba1fb` `Sentry.init` ran at module load and React rendered at once.
- **Real-world trigger:** every load pays one same-origin round trip before first paint, and the #507 placeholders no longer show "from the first paint". A request the API accepts and never answers leaves a blank page with no error reporting started. The same API served the page a moment earlier, so a hang is rare: LOW.

**Evidence** — `const clientSettings = await readClientSettings()` precedes `startErrorReporting`, `startAnalytics` and `createRoot(...).render`; `readClientSettings` catches only a rejection or a non-OK answer. The comment at `main.tsx:25` says "The reporters start before anything renders or records, so no error or event is lost", and an error during the wait is not reported. `apps/web/src/fake-api.ts:476` also awaits the read before rendering, so `app.test.ts`'s first-paint test cannot see the delay.

**Recommended fix** — give the read a bound: `fetch('/api/client-settings', { signal: AbortSignal.timeout(3000) })`, so a timeout reads as `null` like any failure, and correct the `main.tsx:25` comment to say errors before the answer lands are not reported.

**Remediation brief**
- **Design intent:** the app renders once with the settings so the version line needs no second render; a failed read is `null` and the app runs with no OpenPanel client, no release on errors and no version line.
- **Full surface:** `apps/web/src/client-settings.ts:9`, `apps/web/src/main.tsx:25-26`.
- **Must preserve:** `apps/web/src/error-reporting.test.ts` and `apps/web/src/analytics.test.ts` (settings to the SDKs), the `app.test.ts` version-line tests, the null path's behaviour.
- **Do not touch:** the single render with settings (changing it to state would add a render the version-line tests do not expect).
- **Proof:** a `client-settings` unit test with a `fetch` that never settles and fake timers: `readClientSettings()` resolves `null` after the bound. Red now (never resolves), green after.

### 4. With the settings unread, the web app files its errors as production, and the comment says no environment — LOW
- **Location:** `apps/web/src/error-reporting.ts:18`, `apps/web/src/client-settings.ts:4-5`
- **Attribution:** introduced by `5b0a7a6` (#575); raised at #575 review 1 (F1.3) and left.
- **Real-world trigger:** a staging page whose settings read fails sends its errors under `production`, since `@sentry/core` 11.4.0 `prepareEvent.js:75` defaults the environment to `"production"`. Staging only, after a failed read: LOW.

**Evidence** — `...(settings && { environment: settings.environment })`; `client-settings.ts:4-5`: "A failed read is null: the web app then runs with no OpenPanel client, no environment or release on its errors". `error-reporting.test.ts:56` checks only `release` for the null case.

**Recommended fix** — set `environment: settings?.environment ?? 'unknown'` and change the comment to "no OpenPanel client, errors filed under the environment `unknown` with no release, and no version line"; extend the `error-reporting.test.ts:56` test to assert `environment: 'unknown'`.

**Remediation brief**
- **Design intent:** GlitchTip separates staging's errors from production's by the `environment` tag (epic story 39); an error whose origin is unknown must not land in production's.
- **Full surface:** `apps/web/src/error-reporting.ts:18`, `apps/web/src/client-settings.ts:4-5`, `apps/web/src/error-reporting.test.ts:56`.
- **Must preserve:** `error-reporting.test.ts:39` (staging and the version from the settings); release unset on a null read.
- **Do not touch:** the API and worker reporters, which require `STILLSTATS_ENVIRONMENT`.
- **Proof:** `pnpm exec vitest run apps/web/src/error-reporting.test.ts` with the strengthened null-case assertion red now, green after.

### 5. After a failed preferences read the banner returns, and opening What's new saves a marker blind — LOW
- **Location:** `apps/web/src/App.tsx:351-355` with `:489-499`
- **Attribution:** introduced by `8f52c0a` (#580); raised at #580 review 2 (F2.12) and left.
- **Real-world trigger:** `GET /api/me/preferences` fails once; every creator older than the newest highlighted release sees the banner again under the read's error alert, and opening What's new PUTs the build's newest highlighted version whatever the server holds (after a rollback, that can lower a newer marker). LOW: a one-off notice, no data lost.

**Evidence**
```ts
(reason) => { showError(reason); setSaved((current) => current ?? {}); setPreferencesRead(true) },
...
session.state === 'signed-in' && preferencesRead && !route.whatsNew
  ? bannerReleaseOf(highlights, saved?.whatsNewMarker, session.user.createdAt)
```

**Recommended fix** — keep a separate `preferencesKnown` flag, set only on a successful read, and require it for both `bannerRelease` and `markerToSave`; `preferencesRead` keeps gating the channel and the screens as it does now.

**Remediation brief**
- **Design intent:** the banner waits for the read "so a marker the server holds is known first" (`App.tsx:486`); a failed read must not count as "no marker".
- **Full surface:** `apps/web/src/App.tsx:226` (state), `:351-355` (both read outcomes), `:489` and `:497` (the two consumers).
- **Must preserve:** `preferencesRead` gating `channelOnView` and `channelWaiting` (`App.tsx:297-300`); every banner test in `apps/web/src/app.test.ts` (the banner describe, from about line 5047), including close, open, failed-save and reset.
- **Do not touch:** `bannerReleaseOf` and `markerAfterOpen` in `whats-new.ts`, which are correct for a known marker.
- **Proof:** a new `app.test.ts` case with `failNext('GET /api/me/preferences')` on an account older than the fixture release: no `region` named "New in Stillstats". Red now, green after.

### 6. A note's date is never checked against its version, while "newest" sorts by date — LOW
- **Location:** `packages/releases/src/read-release-content.ts:169` (`isDay` only) and `:212-216` (`newestFirst`)
- **Attribution:** introduced by `e8e40cc` (#572); raised at #572 reviews 1 to 3 (F1.15, F2.22, F3.26) and #580 reviews (F1.4, F2.3) and left. At epic level it now spans four consumers: the tag check (#578), the API's version and the account menu (#575), and the banner (#580) follow the date order, while the rollback check (#579) and `rollback.yml`'s `sort -V` follow the version order.
- **Real-world trigger:** Nick or the drafting agent types a note's `date` a day off (`docs/release-notes.md:60` says the date is the version's day, and nothing enforces it). The release then refuses the right tag with "does not match the newest app release note", and staging shows the older version. Fail-safe at the release, so LOW.

**Evidence** — `if (!isDay(date)) throw …` checks a real day only; `if (a.date !== b.date) return a.date < b.date ? 1 : -1`. Executed by a finder through the real CLI: notes `2026.11.12` (date 2026-11-14) and `2026.11.13` (date 2026-11-13): tag `2026.11.13` refused, tag `2026.11.12` answers `deploy=true version=2026.11.12`.

**Recommended fix** — in `releaseOf`, after the `isDay` check, refuse an app note whose date is not its version's day: `if (product === 'app' && date !== dayOfAppVersion(name)) throw new ReleaseContentError(file, \`date must be ${dayOfAppVersion(name)}, the day the version names\`)`, with `dayOfAppVersion` in `version.ts` turning `YYYY.M.D[.N]` into `YYYY-MM-DD`.

**Remediation brief**
- **Design intent:** an app version names its own day, so for app notes the date and the version cannot disagree once checked, and the date order equals the version order; extension notes keep a free date.
- **Full surface:** `packages/releases/src/read-release-content.ts:169`, `packages/releases/src/version.ts` (new helper beside `isAppVersion`), `packages/releases/test/release-content.test.ts` (one refusal case); every fixture note in `packages/releases/test/fixtures/notes/` and `apps/web/test/fixtures/notes/` must already agree (check them).
- **Must preserve:** `newestFirst`'s same-day rules (app before extension, `.1` after the day's first), pinned by `release-content.test.ts:73` and `:103`.
- **Do not touch:** `compareVersions`.
- **Proof:** a `release-content.test.ts` case with `2026.11.12.md` dated `2026-11-14` expects a throw naming the file. Red now, green after.

### 7. A release note's merge commit can end up with no images, and the guide's recovery does not apply — LOW
- **Location:** `.github/workflows/ci.yml:12-14`, `.github/workflows/release.yml:61-69`, `docs/deploy.md:37`, `docs/release-notes.md` (the publish step)
- **Attribution:** pre-existing, exposed: the concurrency group is unchanged from `bbba1fb` (its comment there already said "A newer push replaces one that is still pending"); #578 (`d1caaaf`) makes one specific commit's `sha-` images a release precondition.
- **Real-world trigger:** Nick merges the note PR (commit B) while main's previous run is still going, then merges another PR (C) before B's run starts. B's pending run is cancelled, `sha-B` never exists, and publishing from B fails at "Check that the tagged commit's images exist". The guide says to wait for the run to go green and re-run, but B's run was cancelled; re-running it moves `staging` back to B. LOW: the release refuses safely.

**Evidence** — `group: ci-${{ github.ref }}`, `cancel-in-progress: ${{ github.event_name == 'pull_request' }}`; `deploy.md:37`: "The image check: the merge commit's CI run has not pushed its images yet, or failed. Wait for the run to go green, or fix it, then re-run the failed jobs of the release run."

**Recommended fix** — in `docs/deploy.md:37`, add the cancelled case and its working recovery: delete the release and its tag, then publish again from the newest commit on main whose run pushed its images (the tag check passes there while it holds the same newest note). Mirror one sentence in `docs/release-notes.md`'s publish step.

**Remediation brief**
- **Design intent:** a release deploys exactly the images staging ran for the tagged commit; any later commit that holds the same newest note is an equally valid release commit.
- **Full surface:** `docs/deploy.md:37`, `docs/release-notes.md` publish step.
- **Must preserve:** the CI concurrency (no two staging migrations at once).
- **Do not touch:** `release.yml`'s image check.
- **Proof:** docs only; `grep -n "cancel" docs/deploy.md` shows the new case.

### 8. A commit whose staging migration failed can still be released to production — LOW
- **Location:** `.github/workflows/ci.yml:172-180` (images pushed before `migrate-staging`), `.github/workflows/release.yml:61-69`, `docs/deploy.md:37`
- **Attribution:** introduced by `d1caaaf` (#578).
- **Real-world trigger:** a merge whose migration fails on staging still pushes `sha-<commit>`; Nick publishes a release from it, and production runs the migration that failed on staging. Needs Nick to publish over a red main run, so LOW; the spec's step 2 checks only that the images exist. Upgrade to MEDIUM if releases are ever published by an agent.

**Evidence** — `docker push "$API_IMAGE:sha-$GITHUB_SHA"` in `images`, which `migrate-staging` needs; `release.yml` checks `docker buildx imagetools inspect "$image:sha-$GITHUB_SHA"` only. `deploy.md:37` implies a failed run leaves no images.

**Recommended fix** — in `release.yml`'s `prepare`, after the image check, require the tagged commit's `Deploy staging through Dokploy` check run to have succeeded: `gh api "repos/$GITHUB_REPOSITORY/commits/$GITHUB_SHA/check-runs" --jq '[.check_runs[] | select(.name == "Deploy staging through Dokploy" and .conclusion == "success")] | length'` must be 1, else `::error::` naming the staging run and exit 1; and correct `deploy.md:37`.

**Remediation brief**
- **Design intent:** a release promotes what staging ran (epic stories 24 and 47); staging having run the commit is the precondition, not just the images existing.
- **Full surface:** `.github/workflows/release.yml:61-69` (new step after it, `checks: read` added to `prepare`'s permissions), `docs/deploy.md:24-30` (the step list) and `:37`.
- **Must preserve:** the `prepare` job holds no Environment; an extension tag still ends green with no deploy.
- **Do not touch:** `ci.yml`'s job order.
- **Proof:** none executable locally; the first release in #581 is the walk. Record the check-run name against the `deploy-staging` job's `name:` in `ci.yml:211`.

### 9. The rollback guidance claims only a remove release can leave an unfit schema, which a constraint tightened later falsifies — LOW
- **Location:** `docs/deploy.md:60`, `docs/release-notes.md:63-66`
- **Attribution:** introduced by `7836cc9` (#579) and `86eb97c` (#576).
- **Real-world trigger:** release N adds nullable column X and writes it; N+1 makes X `NOT NULL` (or adds a check, a foreign key, or narrows an enum). The "Look for" list names only `DROP` and removed routes, so N+1 is marked `removes: false`; a rollback to N-1, whose code never writes X, passes and its inserts fail. LOW, capped: needs a two-release-back rollback over a tightening migration. Upgrade if a migration under `packages/database/drizzle/` adds `NOT NULL`, a `CHECK` or a foreign key to an existing column: `grep -lE 'SET NOT NULL|ADD CONSTRAINT' packages/database/drizzle/*.sql`.

**Evidence** — `deploy.md:60`: "the rule that a remove release comes after an expand release means only a remove release can leave a schema older code does not fit"; `release-notes.md:63` lists "a migration in the range that drops a column or a table" and "a removed route, screen or setting".

**Recommended fix** — add to the `release-notes.md` "Look for" list: a migration that sets `NOT NULL`, adds a `CHECK`, a foreign key or a unique constraint on an existing column, renames a column or changes its type; and restate `deploy.md:60` as "only a release marked `removes: true` may leave a schema older code does not fit, so a note marks every such change".

**Remediation brief**
- **Design intent:** the `removes` flag is the only gate on a rollback; it must be set by "older code would break against what this release leaves behind" (`release-notes.md:63`), not by the word "remove".
- **Full surface:** `docs/release-notes.md:63-66`, `docs/deploy.md:60`.
- **Must preserve:** the rollback check's behaviour.
- **Do not touch:** `packages/releases/src/rollback-check.ts`.
- **Proof:** docs only.

### 10. The GitHub release body keeps the note's site-relative links, which break on GitHub — LOW
- **Location:** `.github/workflows/release.yml:70-75`, `packages/releases/src/tag-check.ts:62-63` (`body: note.body`)
- **Attribution:** introduced by `d1caaaf` (#578).
- **Real-world trigger:** a note links `[principles](/principles)` (the package's own fixture `packages/releases/test/fixtures/notes/2026.11.9.md:16` does) or shows a same-origin image, which the image rule requires; on GitHub the link resolves to `github.com/principles`. LOW: the release page on the site is the reader's copy.

**Recommended fix** — when the CLI writes the notes file, rewrite each markdown link or image target that starts with a single `/` to `https://stillstats.com/…`; test it in `packages/releases/test/release-tag-check-cli.test.ts` with the fixture note.

**Remediation brief**
- **Design intent:** the release body is a copy of the note (epic story 28), readable where it is shown.
- **Full surface:** `packages/releases/src/release-tag-check-cli.ts` (the write), `packages/releases/test/release-tag-check-cli.test.ts`.
- **Must preserve:** the site's release pages keep same-origin links (the site build reads `html`, not `body`).
- **Do not touch:** `markdown.ts`.
- **Proof:** a CLI test asserting the notes file holds `https://stillstats.com/principles`. Red now, green after.

### 11. The rollback's newest-tag filter admits tags that are no valid version, and echoes the raw input — LOW
- **Location:** `.github/workflows/rollback.yml:50-55`
- **Attribution:** introduced by `7836cc9` (#579).
- **Real-world trigger:** a stray tag such as `2026.13.1` or `2026.02.1`, or a refused release's tag left behind, becomes the required ref; a leftover tag on an older commit means the check reads notes that miss a newer remove release. Separately, `$VERSION` is printed in an `::error::` line before validation, so a dispatched value with a newline can emit workflow commands (writers only). LOW.

**Evidence** — `grep -E '^[0-9]{4}\.[0-9]+\.[0-9]+(\.[0-9]+)?$' | sort -V | tail -n 1`; `echo "::error::… -f version=$VERSION"`.

**Recommended fix** — tighten the pattern to the package's CalVer shape, `'^[1-9][0-9]{3}\.[1-9][0-9]?\.[1-9][0-9]?(\.[1-9][0-9]*)?$'`, and drop `$VERSION` from the error line (print `-f version=<version>`).

**Remediation brief**
- **Design intent:** the rollback reads release content at the newest release tag so no remove release is missed.
- **Full surface:** `.github/workflows/rollback.yml:52` and `:55`, `docs/deploy.md:53`.
- **Must preserve:** the ref check's refusal when run from a branch.
- **Do not touch:** `rollback-check.ts`.
- **Proof:** `printf '2026.13.1\n2026.11.9\n2026.02.1\n' | grep -E '<new pattern>'` prints only `2026.11.9`.

### 12. The deploy guide says only a release's run reaches the production Environment — LOW
- **Location:** `docs/deploy.md:117`
- **Attribution:** introduced by `d1caaaf` (#578), widened by `7836cc9` (#579), whose own section (`deploy.md:49`) dispatches the rollback from a tag into `production`.
- **Real-world trigger:** a maintainer trusting the sentence assumes the Environment's secrets are reachable only from `release.yml`; in fact any workflow dispatched from any pushed tag matching the rule reaches them. A false security assumption, so its own finding; LOW, as only writers can push a tag.

**Recommended fix** — "`production`, with deployment tags only (`20*.*.*`), so only a run from a release tag reaches it: a release, or a rollback dispatched from one. Any workflow dispatched from such a tag can reach it, so the tag is the boundary."

**Remediation brief**
- **Design intent:** the Environment's tag rule is the boundary between a merge and production.
- **Full surface:** `docs/deploy.md:117`.
- **Must preserve:** the staging rule line at `:116`.
- **Do not touch:** the workflows.
- **Proof:** docs only.

### 13. The site screenshot will carry the "What's new" banner once real highlights land — LOW
- **Location:** `apps/site/test/screenshot/sample-channel.ts:27`, `apps/site/test/screenshot/take-screenshot.ts`
- **Attribution:** introduced by `8f52c0a` (#580).
- **Real-world trigger:** `createdAt: '2026-10-14T09:30:00.000Z'` predates every release so the walk sees the banner; the screenshot uses the same stub and user with no marker and builds without `RELEASE_CONTENT_ROOT`, so once `packages/releases/notes/` holds a note with a highlight, every retaken homepage screenshot shows the banner. Dormant today: LOW.

**Recommended fix** — in `take-screenshot.ts`, seed the stub's preferences with `whatsNewMarker` set to the newest highlighted release of the build it screenshots (from `readReleaseContent()`), so the screenshot shows the dashboard as a returning creator sees it.

**Remediation brief**
- **Design intent:** the screenshot is marketing copy of the dashboard; the banner is a transient notice.
- **Full surface:** `apps/site/test/screenshot/take-screenshot.ts`, `apps/site/test/screenshot/stub-api.ts` (a way to seed preferences, if none exists).
- **Must preserve:** the walk's banner steps, which need no marker.
- **Do not touch:** `sample-channel.ts`'s `createdAt`.
- **Proof:** with a scratch highlight note under `packages/releases/notes/`, the screenshot's page has no `region` named "New in Stillstats".

### 14. A modified click on the banner's link sends no event and leaves the banner up — LOW
- **Location:** `apps/web/src/WhatsNewBanner.tsx:27`, against `apps/web/src/Sidebar.tsx:78`
- **Attribution:** introduced by `8f52c0a` (#580); a new-tab variant was raised at #580 review 2 (F2.18).
- **Real-world trigger:** Cmd-click on "See what's new" opens What's new in a new tab; `RouteLink`'s `onFollow` skips modified clicks, so no `whats_new_opened`/banner is sent, while the sidebar counts a modified click. The original tab keeps the banner until a re-render. LOW.

**Recommended fix** — send the banner's open event from the link's `onClick` for every click, as the sidebar does, and leave `onFollow` for the in-place navigation.

**Remediation brief**
- **Design intent:** both entry points count an open the same way (`Sidebar.tsx:78`, "a modified click included").
- **Full surface:** `apps/web/src/WhatsNewBanner.tsx:27`, the banner tests in `apps/web/src/app.test.ts`.
- **Must preserve:** exactly one `whats_new_opened` per plain click, no account ID; the marker save on open.
- **Do not touch:** `RouteLink.tsx`.
- **Proof:** an `app.test.ts` case with a `metaKey` click on the banner link expects one `whats_new_opened` with `from: 'banner'`. Red now, green after.

### 15. New tests that state no rule of their own — LOW
- **Location and action:**
  - `apps/web/src/sidebar.test.ts:98` — a copy test (`expect(whatsNewLinkText).toBe("What's new")`), forbidden by `CODING_STANDARDS.md` 2. Delete. (Raised at #577 review 1, F1.1.)
  - `apps/web/src/whats-new.test.ts:36` "names the release as its page does" — asserts a literal that restates `releaseLinkTextOf`'s template, never the site's `nameOf` (`apps/site/release-pages.ts:36`). Delete, or strengthen once the name has one source (Minor, release name twice).
  - `packages/releases/test/tag-check.test.ts:84` and `:88` — repeat `:43` and `:47` through `releaseForTag`. Delete both; `:76` keeps `releaseForTag`'s own rule.
  - `packages/releases/test/rollback-check.test.ts:144` — repeats `:110`. Delete.
  - `packages/releases/test/release-content.test.ts:216` (`releasePagePath` equals its template) and `:210` (the package name) — no rule. Delete.
  - `apps/api/src/preferences.test.ts:175` — the marker's save and read back, covered by `:141` "every value the shared types allow is saved and read back". Delete.
  - `apps/web/src/route.test.ts:846` — green at base because its precondition never held there; add `expect(addressOf(whatsNew)).toBe('whats-new?channel=c-2&window=last90&page=3')` first.
- **Attribution:** introduced by the child tickets' lane commits (`git log -S` per test name: `52a2b3a`, `e8e40cc`, `d1caaaf`, `7836cc9`, `8f52c0a`); none is a review finding's proof.
- **Proof:** `pnpm test` green after the deletions; `pnpm exec vitest run apps/web/src/route.test.ts` green with the precondition.
- **Do not touch:** the 10 green-at-base negative controls listed under Test quality.

### 16. Comment hygiene — LOW (aggregated)
- `apps/api/src/client-settings.test.ts:2-3` — "The image's smoke run in CI reads the answer from a built image, which shows the image's install carries the release content." → "The image's smoke run in CI reads the answer from a built image, which shows the image's install loads the release content package; with no note committed it cannot show the notes are in the image."
- `apps/web/src/main.tsx:25` — "The reporters start before anything renders or records, so no error or event is lost" → "The reporters start once the settings are read and before anything renders or records; an error during the read is not reported." (Superseded by finding 3's fix if that lands first.)
- `apps/web/src/client-settings.ts:4-5` — see finding 4.
- `packages/reporter/src/index.ts:29` — see finding 1.
- `docs/deploy.md:37` — see findings 7 and 8.

## Needs Further Investigation
### A. A pending release or rollback is cancelled when a third run joins the `production` group — confirm against GitHub's concurrency docs ("any previously pending job or workflow in the concurrency group will be canceled"); if it holds, add one line to `docs/deploy.md:32` and `:60` saying to re-run a cancelled release run.
### B. A pre-release later promoted to a release never deploys — confirm which event GitHub fires on promotion (`released`/`edited` vs `published`); #578 review 1 (F1.9) raised it. If `published` does not fire, document "delete and publish again" at `docs/deploy.md:32`.
### C. The site's release pages under `vite dev` — `apps/site/release-pages.ts` adds them as virtual build inputs, which Vite's dev HTML middleware may not serve, and `apps/web/highlights-plugin.ts` adds no watch file. Run `pnpm --filter @creator-analytics/site dev` with fixture content and open `/releases/`. Development only.

## Reviewed and Dismissed
- Staging jobs falling back to production's repository secrets — both Environments hold all three secrets (read back 2026-11-10), so each staging job reads staging's values; #578's deferred F1.1 is closed by that setup. The repository copies are still worth deleting, as `deploy.md:124` says.
- `.dockerignore`'s `*.md` dropping the release notes from the image — proved by a scratch Docker build: only root markdown and `docs/` drop.
- Script injection through `tag_name` or `inputs.version` — both reach `run:` blocks only through `env:`.
- The "What's new" marker lowered by an older build after a rollback — `markerAfterOpen` PUTs only a version newer than the saved marker, so a known marker never moves back; only the failed-read path does (finding 5).
- Markdown parsed by the API and the worker at start — the epic's rule and ADR 0018 are about the browser; no parser code reaches a bundle (site and web tests check it).
- An extension note carrying a highlight — refused by `read-release-content.ts:176`.
- `highlights-plugin.ts`'s `as string` day lookup — a highlight is returned only when a note lists it.
- The banner's account rule by UTC day, not instant — documented and tested design (`whats-new.ts:91-99`).
- The Access token reaching a production extension build — `accessHeadersOf` answers `{}` outside staging, the token comes from `.env.staging.local` (git-ignored) or the shell, and WXT's `dotSources` default keeps it out of the Firefox sources ZIP.
- `staging-access.ts:2-5`'s reason for the service token — it restates the epic's reading of Cloudflare Access's CORS documentation; the token is needed for Access either way, so no behavioural mistake follows.
- `deploy` running after a failed `migrate` — the implicit `success()` in its `if:` skips it.
- `/api/client-settings` cached by Cloudflare — it answers `cache-control: no-store`, and the API has no CORS middleware.

## Minor / nits
- `/releases`, `/releases/` and `/releases/index` all answer the index (`apps/api/src/app.ts:328` guards `/index` at the root only); the canonical URL names one.
- The release page title renders "Stillstats 2026.11.9 | Stillstats" (`apps/site/templates/release.html:5`); copy, for Nick.
- The release name is written twice: `apps/site/release-pages.ts:31-38` and `apps/web/src/whats-new.ts:33`. One `releaseNameOf` beside `releasePagePath` would let the web test compare real values.
- `packages/releases/src/tag-check.ts:62` throws for a case `checkReleaseTag` already excludes (#578 review 1, F1.4).
- Ragged comment wraps: `apps/web/src/fake-api.ts:466`, `apps/web/src/route.ts:27-31`.
- The worker renders every note's markdown at start to read one version (`deploymentOf`'s default read).

## Test quality
Tests added or changed: 120 · green against `$BASE`: 10 groups (21 cases), each the negative control of a red positive case (`apps/api/src/sign-in.test.ts:286`, `apps/extension/src/product-api.test.ts:198` and `:854`, `apps/extension/test/manifest.test.ts:133` staging rows and `:268`, `apps/site/src/main.test.ts:479` and `:485`, `apps/web/src/route.test.ts:827` five rows and `:846`, `packages/reporter/src/index.test.ts:78`); none is a review finding's proof, and none is deleted for it · tautology shapes found: 5. A copy test (`sidebar.test.ts:98`) and a template restatement (`whats-new.test.ts:36`), both in finding 15; `apps/site/test/site.test.ts:1277` and `:1320` compute the expected index order with `readReleaseContent`, the build's own reader, so "newest first" there is a wiring check (the sort is proved at `release-content.test.ts:73` and `:103`); keep, and drop "newest first" from the name if it is touched. Call-shaped assertions on the mocked OpenPanel SDK (`apps/web/src/analytics.test.ts:53`, `apps/site/src/main.test.ts:476`) are at a third-party boundary and state their limits; keep. Three files (`apps/site/test/site.test.ts`, `apps/web/test/web.test.ts`, `apps/web/src/app.test.ts`) cannot load at base, so their changed tests count as red by import.

## Before opening the PR
- **CI readiness:** lint, typecheck and build pass; `pnpm test` passes locally and fails on GitHub Actions until finding 1 is fixed. Re-run the suite with `GITHUB_SHA` set after the fix.
- **Commit hygiene:** the tree is clean; this doc is the only addition.
- **Likely reviewer asks:** Nick's word-for-word approval of the sidebar label "What's new" (#577), the screen and banner copy (#577, #580) and the version line (#575), each marked pending in its source; migration `0021_preferences_whats_new_marker.sql` is expand-only (nullable column plus a CHECK); production's Dokploy apps need `STILLSTATS_ENVIRONMENT=production` before the first release (`docs/deploy.md:142-143`); no release note is committed yet, so the first release's note and #581's walk come after the merge; #593 is an open sub-issue no commit here carries.

## Verdict
Not ready to open as-is. The gate is finding 1 (the PR's CI goes red on GitHub Actions) and finding 2 (the epic's Testing Decision for the browser walk). Findings 3 to 16 are LOW and can ride the same remediation pass or become follow-up tickets; none blocks the PR.

## Remediation, 2026-11-10
Scope: CRITICAL, HIGH and MEDIUM (findings 1 and 2). The LOW findings 3 to 16 are deferred to Nick, unworked.

| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 1 (MEDIUM) | `b5f75f9` creator-analytics#567 pre-PR review 1 finding 1: the no-release reporter test failed on GitHub Actions, where the SDK reads GITHUB_SHA as a release | red→green: `GITHUB_SHA=abc123deadbeef pnpm exec vitest run packages/reporter/src/index.test.ts` (failed `expected 'abc123deadbeef' to be undefined`, then 5 passed, `sessions.test.ts` green beside it); then `CI=true GITHUB_ACTIONS=true GITHUB_SHA=8609e38abc GITHUB_EVENT_NAME=pull_request pnpm test` 156 files, 3,910 passed, 1 expected fail | 1 (the Limits block the brief asks for); the `release` doc comment at `index.ts:29` is rewritten, not added | proved by execution |
| 2 (MEDIUM) | `8609e38` creator-analytics#567 pre-PR review 1 finding 2: the browser walk never loaded a release page, which the epic's Testing Decisions require | red→green: `grep -n "visit('/releases" apps/site/test/screenshot/browser-walk.ts` printed nothing before (the site visits are `visitPage('/releases/')` and `visitPage('/releases/2026.11.9')` after, see Approach decisions); `pnpm run test:browser` passes with 59 steps (55 before, plus the two routes and their two heading steps). Mutation in a scratch worktree at `8609e38`: an inline `<script>x</script>` in `apps/site/templates/release.html` fails the walk with 2 violations under `route: /releases/2026.11.9` (log and listener) | 1 (`serveSite`'s doc, the API's mapping); the two file headers are rewritten to name the site build, not added | proved by execution |
| 3 to 16 (LOW) | deferred | none | none | not worked: LOW tail, per the default scope |

Full checks at `8609e38`: `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` (local and under GitHub Actions' variables) and `pnpm run --if-present test:browser` all pass. No verify agent was dispatched: both fixes are MEDIUM with executed proofs and passing preserve-suites, and neither touches a shared computation core.

Finding 16's `packages/reporter/src/index.ts:29` entry is closed by finding 1's commit; its other entries stay open with the LOW tail.

### Known regressions, deferred
- None.

### Rework briefs
- None; no rework pass ran.
