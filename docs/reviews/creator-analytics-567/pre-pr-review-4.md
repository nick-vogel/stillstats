# Pre-PR review: creator-analytics#567 Versioned releases, release notes and a staging environment

**Branch:** `creator-analytics-567-releases-staging` vs `origin/main` (merge-base `149417c` "Merge pull request #591 from nick-vogel/creator-analytics-588-tip-revenue-openpanel", which is `origin/main` itself)
**Reviewed at:** HEAD `db573f6` ("creator-analytics#593 The staging API refuses a request that did not pass Cloudflare Access", the merge of the #593 lane). The tree was clean, with no uncommitted or untracked files at review time. Full branch against `149417c`: 139 files, +8,749 / −290, 33 commits.
**Delta under review:** since `8c763a6` ("creator-analytics#567 pre-PR review 2 remediation closure table"), the HEAD that `pre-pr-review-3.md` reviewed: 12 files, +498 / −5. Commits `af47734` (review 3's doc), `9e81284` (#593) and `db573f6` (its merge). Without review 3's doc, the delta is #593 alone: 11 files, +394 / −5 (`apps/api/src/cloudflare-access.ts`, `apps/api/src/cloudflare-access.test.ts`, `apps/api/test/cloudflare-access.ts`, `apps/api/src/app.ts`, `apps/api/src/server.ts`, `apps/api/src/server.test.ts`, `apps/api/test/start-api.ts`, `apps/api/Dockerfile`, `docs/deploy.md`, `README.md`, `CONTEXT.md`).
**Reviewed against:** creator-analytics#593 (body and acceptance criteria), the epic body of creator-analytics#567, `pre-pr-review-3.md` (finding 1, Approach decisions, closure), `CODING_STANDARDS.md`, ADR 0015 (settings read at start), Cloudflare's docs on validating the Access token and on the application token (fetched through the Cloudflare docs search, 2026-11-10).
**Date:** 2026-11-10
**Reviewer:** 2 code-review agents (one finder, one test-quality and mutation audit) + verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | up to date |
| Lint | `pnpm lint` | pass, 644 files |
| Typecheck | `pnpm typecheck` | pass |
| Build | `pnpm build` | pass |
| Full suite | `pnpm test` (Docker up, `TEST_DATABASE_ADMIN_URL` unset) | 157 files, 3,931 passed, 1 expected fail |
| Browser walk | `pnpm run --if-present test:browser` | pass, "No content security policy violation in 59 steps" |
| Cloudflare's contract | Cloudflare docs: "Validate JWTs" and "Application token" pages | the header is `Cf-Access-Jwt-Assertion`, the `iss` is `https://<team>.cloudflareaccess.com`, tokens are RS256, keys are at `/cdn-cgi/access/certs`; an identity token carries `nbf` equal to `iat`; a service-token request also gets an application token (`common_name`, empty `sub`), and the Service Token selector requires the Service Auth action. The code matches on every point. |
| Coverage of every route | finder read of `server.ts` and `app.ts` | `serve` takes only `createApi(...).fetch`; the check is the first `app.use` (`app.ts:133`), with no path, so it stands before `/health`, `/api/auth/*`, `/api/risc/events`, the `/api` sub-app, the web app, the site and the not-found page, for every method. `await next()` is outside the `try`, so a route's own error still reaches `onError`. |
| jose 6.2.12 error classes | finder probe against the worktree's jose; my probe (`node` script in the scratchpad importing `node_modules/.pnpm/jose@6.2.12/.../webapi/index.js`) | expired gives `JWTExpired` (not a `JWTClaimValidationFailed`, so its own list entry is needed); wrong `iss`/`aud`/future `nbf` give `JWTClaimValidationFailed`; a JWKS timeout, a non-200 certs answer, a bad JWKS and a fetch `TypeError` are not on the refused list, so an outage is reported. |
| Malformed settings | my probe: the code's own `/[/:]/` test, issuer and certs URL construction, then `jwtVerify` of a valid token | `"t.cloudflareaccess.com "`, `"T.cloudflareaccess.com"` and `"t.cloudflareaccess.com?x"` all pass the start check, build the right certs URL, and then fail every token with `JWTClaimValidationFailed`; an AUD of `"aud1 "` does the same (finding 2) |
| Base oracle | test agent: `git worktree add --detach` at `8c763a6` under the scratchpad, HEAD's `cloudflare-access.test.ts`, `server.test.ts`, `test/cloudflare-access.ts`, `test/start-api.ts` copied in | `cloudflare-access.test.ts` red (module not found); `server.test.ts`'s two "refuses to start without" tests red; "on production, reads neither Cloudflare Access setting" green (a regression guard, it kills the production-reads mutant) |
| Mutation run | test agent: 17 mutants in a scratch worktree at `db573f6`, `pnpm exec vitest run apps/api/src/cloudflare-access.test.ts apps/api/src/server.test.ts` from the root | 11 killed; 6 survived: no `algorithms` pin, the check after the noindex middleware, five `refusedToken` classes removed, the check scoped to `/api/*` and `/health`, `server.ts` wiring `undefined`, `cloudflareAccessKeys` ignoring `certsUrl` (findings 1 and 3) |
| Prior finding | `sed -n 64p docs/release-notes.md` | unchanged: review 3 finding 1 is untouched (finding 4) |
| Not run | the staging stack (#593's post-deploy direct-IP check); the staging Dokploy application's health-check settings (Needs Further Investigation A); a staging API process against a real database (nothing in the repo starts one) | |

**Overall:** #593 does what its ticket asks. On staging every request, to every route and every method, needs a `Cf-Access-Jwt-Assertion` the team signed for the application, read from the header only, verified with `jose` against the team's remote key set with the issuer, the audience and RS256; every refusal is an empty 403; an outage is reported without the token; production reads neither setting; both settings are required at start on staging. All full checks and the browser walk pass. Four LOWs are confirmed: nothing automated runs the staging wiring itself; a team domain or AUD with a capital, a space or a query passes the start check and then silently refuses every request; the refusal tests leave several mutants alive; and review 3's documentation hint is still open. Nothing gates the PR.

## Approach decisions
- Carried forward from reviews 1 to 3: reporter release in tests (`vi.stubEnv` in the test, `vi.unstubAllEnvs()` in `afterEach`); the release page in the browser walk; repro files in `docs/reviews/**` pass `pnpm lint`; a migration number taken on both sides of a merge keeps main's and regenerates the branch's; `removes` stays a human field and the guide's hint is narrowed to `DROP TABLE` or `DROP COLUMN`. This review commits no repro file; each proof is a test the remediator writes red first.
- The Access check (findings 1 to 3): a refused token stays unreported, as the code's `refusedToken` comment says; settings are validated at start, as Stripe's are (ADR 0015, `apps/api/src/support.ts`), so a malformed value stops the API instead of reaching requests. The composition of settings and keys moves into `cloudflare-access.ts` so a test can run it; `server.ts` keeps one call. A staging container in CI's smoke run is not added by this review: it is Nick's call under the commit-stage rule (`_process/_ci-commit-stage.md`), and it would be a proposal, not a fix.

## Prior-review closure
Review 3 (`pre-pr-review-3.md`, at `8c763a6`) confirmed 1 finding, LOW. No remediation ran after it (it has no closure table), so the finding is untouched and re-reported as finding 4.
- **Fully fixed: 0.**
- **Partially fixed: 0.**
- **Untouched: 1**, finding 1 (LOW, the `DROP` hint in `docs/release-notes.md:64`).
- Prior MEDIUM-or-higher findings left open: none. Review 3's "Known regressions, deferred": none. Review 1's LOW findings 3 to 16 remain deferred to Nick, as reviews 2 and 3 recorded.

## Confirmed Issues

### 1. Nothing automated runs the staging wiring of the Access check, so staging could ship with no check and every test stays green — LOW
- **Location:** `apps/api/src/server.ts:96-99`, `apps/api/src/cloudflare-access.ts:91-94`
- **Attribution:** introduced by `9e81284` ("creator-analytics#593 The staging API refuses a request that did not pass Cloudflare Access"); `git show 149417c:apps/api/src/cloudflare-access.ts` fails, the file is new.
- **Real-world trigger:** none today; the wiring is correct as written. The failure is a future edit to `server.ts` or `cloudflareAccessKeys` (a refactor of the dependency list, a renamed key, a different URL) that drops the check or points it at the wrong keys: the mutants `cloudflareAccess: undefined && {…}` and `createRemoteJWKSet(new URL('https://example.invalid'))` both pass the whole suite. `server.test.ts` stops at `DATABASE_URL`, every seam 2 test injects a local key set through `startApi`, and CI's smoke run starts the image with `STILLSTATS_ENVIRONMENT=production` (`.github/workflows/ci.yml:140`). The only check left is #593's manual direct-IP request after a staging deploy, which the test file's Limits comment names. LOW, capped: upgrade to MEDIUM if Nick wants the commit stage, not the post-deploy check, to be what proves staging is closed.

**Evidence**
```ts
// apps/api/src/server.ts:96-99
      cloudflareAccess: accessSettings && {
        ...accessSettings,
        keys: cloudflareAccessKeys(accessSettings),
      },
// apps/api/src/cloudflare-access.ts:91-94
export function cloudflareAccessKeys({ certsUrl }: CloudflareAccessSettings): JWTVerifyGetKey {
  return createRemoteJWKSet(certsUrl)
}
```

**Failure mode** — a regression in these lines leaves the staging API open to a request sent straight to main-box's IP, which is exactly what #593 closes, with lint, typecheck, build, the suite and the browser walk all green (mutants m15 and m16 in the test agent's run survived).

**Recommended fix** — move the composition into `cloudflare-access.ts`, replacing `cloudflareAccessKeys`, and test it against keys served over HTTP:
```ts
export function cloudflareAccessOf(
  settings: CloudflareAccessSettings | undefined,
): CloudflareAccess | undefined {
  return (
    settings && {
      issuer: settings.issuer,
      audience: settings.audience,
      keys: createRemoteJWKSet(settings.certsUrl),
    }
  )
}
```
`server.ts`: import `cloudflareAccessOf` instead of `cloudflareAccessKeys`, and pass `cloudflareAccess: cloudflareAccessOf(accessSettings),`. In `apps/api/test/cloudflare-access.ts`, have `fakeCloudflareAccess` also return its public key set as JSON (`jwks: { keys: [publicJwk] }`) so a test can serve it. In `cloudflare-access.test.ts`, add to seam 2: start a `node:http` server on port 0 that answers the fake's `jwks` as `application/json` (closed with `onTestFinished`), build `cloudflareAccessOf({ issuer: <the fake's issuer>, audience: <the fake's aud>, certsUrl: new URL('/cdn-cgi/access/certs', <that server's origin>) })`, start the API with it, and assert a valid token gets 200 on `/health` and no token gets 403. Add to seam 1: `cloudflareAccessOf(undefined)` is `undefined`.

**Remediation brief**
- **Design intent:** on staging (`STILLSTATS_ENVIRONMENT=staging`) `server.ts` reads the two settings at start (`cloudflareAccessSettingsOf`), and `createApi` mounts `cloudflareAccessCheck` as its first middleware when `cloudflareAccess` is defined (`app.ts:133`). The check needs the team's remote key set, which `jose`'s `createRemoteJWKSet` fetches at the first check and again on an unknown `kid`, since Cloudflare rotates keys. Production passes `undefined` and mounts nothing. The composition from settings to dependency should live where a test can run it.
- **Full surface:** `apps/api/src/cloudflare-access.ts:91-94` (replace `cloudflareAccessKeys` with `cloudflareAccessOf`); `apps/api/src/server.ts:11` (import) and `:96-99` (the dependency); `apps/api/test/cloudflare-access.ts:23-28` and `:49-57` (expose the JWKS); `apps/api/src/cloudflare-access.test.ts` seam 1 and seam 2 (new tests). `git grep -n cloudflareAccessKeys` finds only `server.ts` and `cloudflare-access.ts`.
- **Must preserve:** settings read before the database (`server.test.ts` "on staging, refuses to start without %s, before the database"); production reads neither (`server.test.ts` "on production, reads neither Cloudflare Access setting", seam 1 "on production, are not read"); every existing seam 2 test, which injects `team.access` directly; the outage report without the token (seam 2 "refuses a request when the team's keys are out of reach").
- **Do not touch:** the `refusedToken` classification (Reviewed and Dismissed: outages are reported, refusals are not, by design); `startApi`'s `cloudflareAccess` option. Do not add a staging container to `.github/workflows/ci.yml` in this fix (Approach decisions); if it seems worth having, write it as a proposal.
- **Proof:** red first: with the new HTTP-served test in place and `cloudflareAccessOf` returning `createRemoteJWKSet(new URL('https://example.invalid/cdn-cgi/access/certs'))`, `pnpm exec vitest run apps/api/src/cloudflare-access.test.ts` (from the repo root, where the database `globalSetup` lives) fails on the valid-token request; with the fix it passes. Then `pnpm typecheck` and `pnpm exec vitest run apps/api/src/server.test.ts`.

### 2. A team domain or AUD with a capital, a space or a query passes the start check, and staging then refuses every request with nothing reported — LOW
- **Location:** `apps/api/src/cloudflare-access.ts:28-36`
- **Attribution:** introduced by `9e81284` (the file is absent at `149417c`).
- **Real-world trigger:** pasting the values into the staging Dokploy environment (#593's "After this lands" step) with a trailing space, or typing the team domain with a capital. The start check rejects only `/` and `:`, so the API starts, loads the right keys (the URL parser trims and lowercases the certs URL), and then compares the raw `https://<value>` to Cloudflare's lowercase `iss`. Every token fails with `JWTClaimValidationFailed`, which is on the refused list, so nothing reaches GlitchTip or the log. Nick sees an empty 403 on every staging page after signing in, with no clue where to look. It fails closed and touches staging only, so no wrong result reaches a user: LOW.

**Evidence**
```ts
  if (!teamDomain) throw new Error('CLOUDFLARE_ACCESS_TEAM_DOMAIN is not set')
  if (!audience) throw new Error('CLOUDFLARE_ACCESS_AUD is not set')
  if (/[/:]/.test(teamDomain))
    throw new Error(
      'CLOUDFLARE_ACCESS_TEAM_DOMAIN is the bare team domain, such as <team>.cloudflareaccess.com, with no scheme, port or path',
    )
  const issuer = `https://${teamDomain}`
```

**Failure mode** — probe output (the code's own test and construction, then `jwtVerify` of a valid token for `t.cloudflareaccess.com` and AUD `aud1`): `"t.cloudflareaccess.com "`, `"T.cloudflareaccess.com"` and `"t.cloudflareaccess.com?x"` each pass the regex, give certs URL `https://t.cloudflareaccess.com/cdn-cgi/access/certs`, and fail with `JWTClaimValidationFailed`; AUD `"aud1 "` fails the same way. The code's own comment at `:26-27` says a missing value stops the API "where a wrong one would refuse every request"; these values are malformed, not wrong, and the start check is the only place that can catch them.

**Recommended fix** — in `cloudflareAccessSettingsOf`, replace
```ts
  if (/[/:]/.test(teamDomain))
    throw new Error(
      'CLOUDFLARE_ACCESS_TEAM_DOMAIN is the bare team domain, such as <team>.cloudflareaccess.com, with no scheme, port or path',
    )
```
with
```ts
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(teamDomain))
    throw new Error(
      'CLOUDFLARE_ACCESS_TEAM_DOMAIN is the bare team domain, such as <team>.cloudflareaccess.com, in lowercase, with no scheme, port, path or space',
    )
  if (/\s/.test(audience)) throw new Error('CLOUDFLARE_ACCESS_AUD holds a space')
```
and in `docs/deploy.md:144` change "or a team domain that holds a scheme, a port or a path" to "a team domain that is not a lowercase host name (no scheme, port, path or space), or an AUD tag with a space".

**Remediation brief**
- **Design intent:** settings are read and validated at start, as Stripe's are (ADR 0015, `supportSettingsOf`), because at request time a refused token is deliberately silent (`refusedToken`, `cloudflare-access.ts:39-53`): a run of refusals reads as nobody visiting. So any value the API can tell is malformed must stop it at start. A real team domain is a lowercase host name (`example.cloudflareaccess.com`); a real AUD tag is one token with no whitespace.
- **Full surface:** `apps/api/src/cloudflare-access.ts:31-34` (the check) and a new AUD line after it; `apps/api/src/cloudflare-access.test.ts:48-58` (the bare-host `test.for`: add `T.cloudflareaccess.com`, `` `${teamDomain} ` ``, `` `${teamDomain}?x` `` and `` `${teamDomain}#` ``, and tighten its `toThrow` to `'is the bare team domain'` so it cannot match "is not set"); a new seam 1 test that an AUD of `` `${aud} ` `` throws `'CLOUDFLARE_ACCESS_AUD holds a space'`; `docs/deploy.md:144` (the sentence above). `apps/api/Dockerfile:57-59` and `README.md:62` name only "unset", which stays true; leave them.
- **Must preserve:** the order of checks, so an empty value still throws `<NAME> is not set` (seam 1 "on staging, refuse to start without %s", `server.test.ts` "refuses to start without %s, before the database"); the three values rejected today (`https://…`, a trailing `/`, `:443`) still throw; production returns `undefined` before reading anything; the issuer and certs URL for a valid domain (seam 1 "on staging, give the issuer, the audience and the certs URL"). No em-dash in the new error text or doc line.
- **Do not touch:** the `refusedToken` list (refusals stay unreported, by design); do not trim or lowercase the value silently, which would hide a paste error instead of naming it.
- **Proof:** red first: the new `test.for` cases and the AUD test fail today (`pnpm exec vitest run apps/api/src/cloudflare-access.test.ts` from the repo root); green after the fix. Then `pnpm lint`.

### 3. The refusal tests leave the algorithm pin, the unknown-key case, the route scope and the cookie refusal's body unpinned — LOW
- **Location:** `apps/api/src/cloudflare-access.test.ts:63-68`, `:86-89`, `:91-127`, `:155`, `:161-169`; `apps/api/test/cloudflare-access.ts:13-21`, `:40-57`
- **Attribution:** introduced by `9e81284`.
- **Real-world trigger:** a future change to the check that the suite would not notice. Surviving mutants in the test agent's run: dropping `algorithms: ['RS256']` (m3); removing `JWTInvalid`, `JWKSNoMatchingKey`, `JWKSMultipleMatchingKeys`, `JOSEAlgNotAllowed` and `JOSENotSupported` from `refusedToken` (m13), after which a forged token with a random `kid` would page GlitchTip as an outage; scoping the check to `app.use('/api/*')` and `app.use('/health')` (m14), which leaves the staging site and web app open to a direct-IP request; and the check moved after the noindex middleware (m7a). No user meets any of these today, so LOW (`CODING_STANDARDS.md` rule 2: a test must be able to go red).

**Evidence**
```ts
const everyKindOfRoute = [
  ['GET', '/health'],
  ['GET', '/api/client-settings'],
  ['GET', '/api/me'],
  ['POST', '/api/risc/events'],
] as const
...
    expect(JSON.stringify(reporter.reports)).not.toContain(token)   // :155
...
    expect(response.status).toBe(403)                               // :168, the cookie test
```

**Failure mode** — the six mutants above pass the suite. Separately, `:155` cannot fail: the error is the test's own `new errors.JWKSTimeout()`, which holds no token, and `JSON.stringify` of an `Error` drops its message; the exact `toEqual` at `:148-154` is what pins "no token in the report".

**Recommended fix**
- `everyKindOfRoute`: add `['GET', '/']` (the site), `['GET', '/app']` (the web app, `webAppPath` in `apps/api/src/auth.ts:11`) and `['POST', '/api/auth/sign-in/google']`. Kills m14.
- Fake team (`apps/api/test/cloudflare-access.ts`): add `keyId?: string` to `AccessTokenChanges` and use `changes.keyId ?? keyId` in `setProtectedHeader`; expose `publicJwk` on `FakeCloudflareAccess`.
- Refusal `test.for`: add `['an unknown key id', (team) => team.sign({ keyId: 'rotated-away' })]` (gives `JWKSNoMatchingKey`, and the test's `reports` `toEqual([])` pins that it stays unreported).
- One new seam 2 test for the algorithm pin: start the API with `{ ...team.access, keys: createLocalJWKSet({ keys: [<team.publicJwk without its alg>] }) }`, sign a token with `alg: 'PS256'` using the team's RSA private key (expose it, or add an `algorithm?: 'PS256'` change to the fake), and assert 403, empty body and `reporter.reports` equal to `[]`. Without the pin jose accepts PS256 on an RSA key whose JWK names no `alg`, so this kills m3 (reasoned from jose's key selection, not executed).
- Refused responses: add `robots: response.headers.get('x-robots-tag')` with expected `null` to the refusal `toEqual`, which pins `app.ts:130`'s "no other middleware" (kills m7a).
- Cookie test (`:161-169`): assert `{ status: 403, body: '' }` and `reporter.reports` equal to `[]`, as its siblings do.
- Delete `:155`.
- Valid-token test (`:86-89`): add `expect((await send(origin, ['POST', '/api/risc/events'], headers)).status).toBe(400)`.

**Remediation brief**
- **Design intent:** the check stands before every route and every middleware (`app.ts:130-133`); it refuses with an empty 403 and reports only what is not the token's fault. The tests should each be able to go red on the behaviour they name: the route scope, the algorithm pin, the classification of each refusal, and the empty body.
- **Full surface:** `apps/api/src/cloudflare-access.test.ts` (route table `:63-68`, valid-token test `:84-90`, refusal table `:91-127`, outage test `:129-156`, cookie test `:158-169`); `apps/api/test/cloudflare-access.ts` (`AccessTokenChanges`, `FakeCloudflareAccess`, `signWith`). No production file changes.
- **Must preserve:** every current case and its assertions, in particular the expired token (`anHourAgo`), which kills the `JWTExpired` removal (m5), and the exact report `toEqual` in the outage test (kills a report that gains the path, m12). The fake's default token stays valid.
- **Do not touch:** `apps/api/src/cloudflare-access.ts` (none of these is a code defect); the test names "on production, …" (Minor).
- **Proof:** each new case is red against its mutant, in a scratch worktree, never the integration worktree: `git worktree add --detach <scratchpad>/mut HEAD`, `pnpm install --frozen-lockfile`, apply the mutant (delete `algorithms: ['RS256']`; delete `errors.JWKSNoMatchingKey,`; replace `app.use(cloudflareAccessCheck(...))` with `app.use('/api/*', …)` and `app.use('/health', …)`; move the check below the noindex `app.use`), run `pnpm exec vitest run apps/api/src/cloudflare-access.test.ts` from that worktree's root, see red, then `git worktree remove --force <scratchpad>/mut`. Green in the integration worktree.

### 4. The release-note guide says to read new migrations "for `DROP`", and the next release's range holds main's `DROP NOT NULL`, which removes nothing — LOW
- **Location:** `docs/release-notes.md:64`
- **Attribution:** introduced by `86eb97c` ("creator-analytics#576 Release note drafting from the PRs merged since the last release"); exposed by `60e5455` (the merge that brought main's `0021_tips_user_id_optional.sql` into the first release this branch drafts). Carried forward unchanged from `pre-pr-review-3.md` finding 1: no remediation ran.
- **Real-world trigger:** drafting the first release note after this PR merges, following `docs/release-notes.md` step 4 literally: a grep for `DROP` hits `0021` (`ALTER COLUMN "user_id" DROP NOT NULL`), the note gets `removes: true`, and `checkRollback` (`packages/releases/src/rollback-check.ts:30-33`) then refuses a rollback past it that would have worked. It fails safe and names the release in the way, so LOW.

**Evidence**
```
  - a migration in the range that drops a column or a table: `git diff --name-only <base> HEAD -- packages/database/drizzle/`, where `<base>` is the tag or commit the command printed as `base`, then read each new migration for `DROP`;
```

**Failure mode** — `grep -n DROP packages/database/drizzle/*.sql` matches `0007` (`DROP DEFAULT`), `0019` (`DROP CONSTRAINT`) and `0021` (`DROP NOT NULL`); none drops a column or a table.

**Recommended fix** — in `docs/release-notes.md:64`, replace
```
then read each new migration for `DROP`;
```
with
```
then read each new migration for `DROP TABLE` or `DROP COLUMN`. A `DROP NOT NULL`, `DROP DEFAULT` or `DROP CONSTRAINT` only loosens a rule, so on its own it removes nothing;
```

**Remediation brief**
- **Design intent:** `removes` is a human-set frontmatter field (`packages/releases/src/read-release-content.ts:15-16`) marking the remove half of an expand and remove pair (`docs/deploy.md:99`); `checkRollback` refuses to go back past any app release that sets it. Too few breaks a rollback against a removed column; too many blocks a rollback that would have worked.
- **Full surface:** `docs/release-notes.md:64` only.
- **Must preserve:** the bullet's first clause, the `git diff --name-only` command and its `<base>` explanation, the second bullet, the "When it is `true`" line; no em-dash in the new text. `pnpm lint` stays green.
- **Do not touch:** `packages/releases/src/rollback-check.ts`, `read-release-content.ts` (no migration parser goes into the package); main's `0021_tips_user_id_optional.sql`.
- **Proof:** documentation, so no red test. After: `sed -n 64p docs/release-notes.md` shows `DROP TABLE` or `DROP COLUMN` and names `DROP NOT NULL`; `grep -lE 'DROP (TABLE|COLUMN)' packages/database/drizzle/*.sql` prints nothing.

## Needs Further Investigation

### A. A health check on the staging Dokploy application would now see 403 and mark the API unhealthy — confirm in Dokploy
The repo has no `HEALTHCHECK` in `apps/api/Dockerfile`, and `docs/deploy.md` describes no Dokploy or Traefik health check, so nothing in the repo is affected; but the staging applications were set up by hand (#573). If `creator-analytics-api-staging` has a health check that requests `/health` (Dokploy's Advanced settings, Swarm health check), it gets an empty 403 from this change on, and a rollback-on-failure setting could undo every staging deploy. `docs/deploy.md:18` says `/health` is refused, which is the intended behaviour. Confirm: open the staging API application's health-check settings in Dokploy. Kill it if none is set; otherwise either turn it off or point it at a check that accepts 403, and add one line to `docs/deploy.md`'s Staging section.

Review 1's A, B and C and review 3's A stand as written there.

## Reviewed and Dismissed
- A route or middleware outside the check — `server.ts` serves only `createApi(...).fetch`; the check is the first `app.use` with no path, so it covers every method, OPTIONS and HEAD included (the app has no CORS middleware), and every `app.get`/`app.route` below it.
- A route's own error turned into a 403 — `await next()` is outside the `try` (`cloudflare-access.ts:87`), so `onError` still answers it.
- The token or a path leaking into GlitchTip — the report holds the method and the error; the error classes that carry the payload (`JWTClaimValidationFailed`, `JWTExpired`) are on the refused list and never reported.
- An outage misread as a bad token — `JWKSTimeout`, a bare `JOSEError` (non-200 or bad JSON), `JWKSInvalid` and a fetch `TypeError` are not on the refused list nor subclasses of an entry on it.
- The staging Studio extension refused by the check — its service token needs a Service Auth policy, and Cloudflare sends an application token (with `common_name` and the application's `aud`) for a service-token request, per the "Application token" page; the check reads no email.
- The Stripe webhook and Google RISC refused on staging — documented intent (`docs/deploy.md:18`: "`/health` and the webhooks included"); Access at the edge already stands in front of both on staging.
- Refused responses lacking `X-Robots-Tag` — staging sits behind Access and the check is first on purpose (`app.ts:130-132`); finding 3 pins the ordering rather than changing it.
- CI's image smoke run broken by the change — it starts the API with `STILLSTATS_ENVIRONMENT=production`, which reads neither setting, and `server.test.ts`'s production test pins that.
- The worker — unchanged, as the ticket says.
- `server.test.ts`'s Limits comment ("the image's smoke run in CI starts one") — predates #593 (present at `8c763a6`) and speaks of a running API, which the smoke run does start; finding 1 records that the staging composition is the part nothing runs.

## Minor / nits
- No clock tolerance (`cloudflare-access.ts:76`): Cloudflare's identity tokens carry `nbf` equal to `iat` (Cloudflare docs, "Application token"), and jose's default tolerance is 0; probe: a token with `nbf` one second ahead fails with `"nbf" claim timestamp check failed`. With main-box's clock behind Cloudflare's, a request in the same second as sign-in can get an empty 403 that a reload clears. An NTP-synced box makes this rare. If wanted: `clockTolerance: 5` in the `jwtVerify` options, with the expired-token case (an hour ago) still refused.
- `exp` is not required: a team-signed token without `exp` verifies (probe). Only Cloudflare's key signs and Cloudflare always sets `exp`, so this is defence in depth only: `requiredClaims: ['exp']` if wanted.
- `JOSENotSupported` on the refused list can come from importing a key in the fetched set, a key-side fault; the token's own unsupported `alg` is already stopped by the `algorithms` pin. Unreachable while Cloudflare publishes RSA keys.
- A refusal leaves no log line at all, so a misconfiguration not caught at start (a well-formed but wrong AUD or team) is invisible. `createApi` has a `logger`; a `logger.info('Cloudflare Access refused a request', { reason: error.code })` with no token and no path would make it diagnosable. A design choice for Nick, not a defect.
- Test names: `server.test.ts` "on production, reads neither Cloudflare Access setting" proves "does not require", and seam 2 "on production, lets a request with no token reach its route as today" runs `createApi` with no check rather than production; both are green at `8c763a6` and are valid regression guards.

## Test quality
Tests added in the delta: `apps/api/src/cloudflare-access.test.ts` (new, 2 seams) and 3 new tests in `apps/api/src/server.test.ts` · green against `8c763a6`: 2, both regression guards for production ("on production, reads neither Cloudflare Access setting", which kills the production-reads mutant; seam 2 "on production, lets a request with no token reach its route", which would pass at base if it could import) · tautology shapes found: 1, the `JSON.stringify(...).not.toContain(token)` line at `:155`, which cannot fail (finding 3) · mutation: 17 mutants, 11 killed, 6 survived (findings 1 and 3). Nothing mocks the unit under test, no expectation is computed by production code, and there are no snapshots.

## Before opening the PR
- **CI readiness:** lint, typecheck, build, the suite and the browser walk pass at `db573f6`. `origin/main` is still `149417c`; re-run the merge check if it moves before the PR opens.
- **Commit hygiene:** the tree is clean; this doc is the only addition from this review.
- **Likely reviewer asks:** as in reviews 1 to 3, plus: #593's post-deploy check (a direct request to main-box's IP with the staging host header gets 403, and the same path through Cloudflare after signing in works) is the only proof the staging wiring is live (finding 1); set `CLOUDFLARE_ACCESS_TEAM_DOMAIN` and `CLOUDFLARE_ACCESS_AUD` in staging's Dokploy environment exactly, lowercase, no spaces (finding 2); check the staging application's health-check setting (A).

## Verdict
Ready to open the PR as-is, with four LOW follow-ups. #593 meets its ticket: the check covers every route and method, reads only the header, verifies issuer, audience and RS256 against the team's remote keys, refuses with an empty 403, reports only outages, and is required at start on staging and absent on production. The findings are a missing automated proof of the staging wiring, a start check that lets a capital or a space through into a silent outage, mutants the refusal tests leave alive, and review 3's untouched documentation hint. None blocks the PR; findings 1 to 3 are one small test-and-validation pass in `apps/api`, and finding 4 is one line of docs. No prior MEDIUM is open.
