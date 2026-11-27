# Pre-PR review: creator-analytics#942 clean the tree for the public stillstats repository

**Branch:** `creator-analytics-942-public-cleanup` vs `origin/main` (merge-base `1ec9866e` Merge pull request #1122 from nick-vogel/creator-analytics-1108-extension-redraw-timing)
**Reviewed at:** HEAD `0ea7e47d` (creator-analytics#942 the docs name no email address of mine), no uncommitted changes, no untracked files before this doc, 54 files total, +500 / −2980 (the three Studio fixtures excluded from the line count, 92 changed lines in them). PR #1125.
**Reviewed against:** issue #942's body (its "Blocker", "Should fix before the public copy" and "Notes, accepted" sections), the delegated brief for this PR (eight items), ADR 0007, ADR 0014, `.claude/rules/youtube-test-limits.md`, the global rules in `~/.claude/rules/`. No plan docs and no prior review of #942.
**Date:** 2026-11-25
**Reviewer:** 2 code-review agents + verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Lint, typecheck, build, full suite with the fonts present | `pnpm lint && pnpm typecheck && pnpm build && pnpm test` at `ba696196` (HEAD adds docs only) | pass: 229 files, 6041 tests, 1 expected fail (a first run under load timed out 19 database tests; those 8 files passed alone, and a quiet rerun passed) |
| Outside clone with no fonts and no `studio.css` | `git clone --single-branch` into a scratch folder, no env vars: install, lint, typecheck, build, test | all pass; 8 absent-font warnings, no error |
| Builds with the fonts present match `main` | `diff -r` of `apps/site/dist`, `apps/web/dist`, `apps/extension/.output` against a scratch worktree of `1ec9866e` | byte-identical, rechecked after the last stylesheet edit |
| CI, both paths | PR runs `45675502854` and `45683857550` (no secret: fallback) and the rerun of `45683857550` after `STILLSTATS_FONTS_TOKEN` was set | all green; the rerun ran the font checkout, the copy, and "The site's stylesheet carries the Fontshare fonts" |
| The PostCSS step in every pipeline | finder A probe: Vite `build` and `createServer().transformRequest`, plain and with `@tailwindcss/vite`, imported sheet in a symlinked package | present face kept, absent face dropped, in all four |
| Action pins | `gh api repos/<action>/tags` and finder B `git ls-remote` | each SHA is the named tag |
| `LICENSE.md` | byte compare with `FSL-1.1-ALv2.template.md` at getsentry/fsl.software `85f3fc7e` | identical but for the filled notice |
| Private data left in the fixtures | read of the three Studio fixtures' metric cells | finding 1 |
| Stylesheet test with a wrong Fontshare path | `repro/stylesheet-test-wrong-fontshare-path.sh` | passes; finding 2 |
| Fetch script, missing licence and relative `--from` | `repro/fetch-fonts-source-checks.sh` | fonts copied without licence; relative path fails; finding 4 |
| Extension build with no fonts | `pnpm build` in the outside clone | exit 0, warnings only; finding 3 |
| Test audit at `$BASE` | new and changed tests copied into a scratch worktree of `1ec9866e`, then run as written and through `fontLicences()` | see Test quality |
| Not run | `pnpm --filter @creator-analytics/extension screenshots` | it writes into the tracked `store-assets/`, so it would change the tree under review |
| Not run | a push to `main` and a release | only a merge exercises the guard step and the new Tailscale client |

**Overall:** The fonts leave the tree cleanly: every consumer builds both ways, the deployed site draws exactly as today, and CI fails closed on a push without the fonts. The church domain, `studio.css`, the licence, the pins and the email are done. One spec gap matters before the public copy is made: the Studio fixtures still publish private channel analytics other than revenue. Three LOW defects and a comment batch can be fixed now or follow.

## Approach decisions
- Absent font files: a PostCSS step, added through the `fonts()` Vite plugin's `config()` hook, drops the `@font-face` rule, and the font stack falls back. Recorded here so no later round swaps it for a runtime CDN (ADR 0007, ADR 0014) or an empty placeholder font.
- Deploy images without the fonts: CI refuses on a push to `main` ("Refuse to build the deploy images without the Fontshare fonts") and the smoke run greps the served stylesheet. A local store build of the extension follows the same shape: refuse, never warn, when the build is the one that ships.
- Fixture privacy: the swap writes sample values into the saved markup in place, with no change to structure, mirroring this branch's revenue swap (`264550cc`). The screenshot tool's in-page swap (`apps/extension/test/screenshot/studio-swaps.ts`) is not the mechanism for the committed files.

## Confirmed Issues
### 1. The Studio fixtures still publish private channel analytics other than revenue — MEDIUM
- **Location:** `apps/extension/test/fixtures/studio/dashboard.html:751` (channel analytics card and latest video card), `apps/extension/test/fixtures/studio/video-analytics.html` (key metrics, daily views chart, retention line), `apps/extension/test/fixtures/studio/README.md:15`
- **Attribution:** pre-existing, exposed. The values are on `$BASE` (`git show 1ec9866e:apps/extension/test/fixtures/studio/dashboard.html | grep -c 'Watch time (hours)'` prints 1). The branch swapped revenue and the two non-public rows only, and the public copy makes the rest readable by anyone.
- **Real-world trigger:** the public `stillstats` repository is seeded from this tree; anyone opens the fixture on GitHub.

**Evidence** — the dashboard still reads `Views 19.7K`, `Watch time (hours) 389.9` (28-day channel figures, owner-only), and the latest video card `click-through rate 2.9%`, `Average view duration 3:02`, `Ranking by views 6 of 10`. The analytics page still reads its key metrics `321` views and `4.9` watch hours, its daily views chart, and "60% of viewers are still watching at around the 0:30 mark". The README the branch wrote says the swap covers "Every revenue figure" and the two rows, and that "The public videos keep their real ids, titles and view counts".

**Failure mode** — issue #942 decided "swap in sample numbers" for "my Studio data in the fixtures", with `video-analytics.html` named without a qualifier. Impressions, click-through rate, watch time, average view duration, ranking, 28-day views, daily views and retention are visible only to the channel owner, so the public copy discloses them.

**Recommended fix** — swap every owner-only figure on the dashboard and the analytics page for a sample value of the same format, in place, as the revenue swap did: the channel analytics card (views, watch time), the latest video card (click-through rate, average view duration, ranking, its tooltip's views), the analytics page's key metric totals and any comparison text beside them, the daily views chart's values and labels, and the retention sentence's percentage. Leave the Content list's per-video views, comments and likes, which are public. Extend the README's swap paragraph to name what was swapped.

**Remediation brief**
- **Design intent:** the fixtures are Chrome's drawn DOM of three Studio pages. The parsers in `apps/extension/src/selectors/` read structure (element ids, classes, attributes) and the video ids in links, never a metric value, so a text swap inside a metric cell changes no parse. The swap is exact string replacement in the saved file; markup outside the replaced text stays byte-identical.
- **Full surface:** `apps/extension/test/fixtures/studio/dashboard.html` (`ytcd-channel-facts-item` metric rows, `ytcd-entity-snapshot-item` metrics table and `#ranking-tooltip`), `apps/extension/test/fixtures/studio/video-analytics.html` (`yta-key-metric-block` totals, the chart's data and axis text, the retention card), `apps/extension/test/fixtures/studio/README.md:15`. Check `apps/extension/test/screenshot/studio-swaps.ts` and `sample-studio.ts`: they select some of the same cells by selector and overwrite them in the screenshot, so their selectors must still match.
- **Must preserve:** every element, attribute and id; the video ids `NDha0z6zDA8` in the analytics URL and links, which `apps/extension/src/surfaces/analytics.test.ts` asserts; the channel id. Suites: `pnpm exec vitest run apps/extension` (34 files, 1113 tests today).
- **Do not touch:** the public per-video views, comments and likes on the Content list, and the public ids and titles (Reviewed and Dismissed, "public ids and titles").
- **Proof:** before, `grep -c '389.9\|2.9%\|3:02\|60% of viewers' apps/extension/test/fixtures/studio/dashboard.html apps/extension/test/fixtures/studio/video-analytics.html` prints non-zero counts; after, zero, and `pnpm exec vitest run apps/extension` passes unchanged.

### 2. The stylesheet test passes when a Fontshare font's path is wrong — LOW
- **Location:** `packages/visual-system/test/styles.test.ts:102-104`
- **Attribution:** introduced (`82602465` the Fontshare fonts come from a private repository at build time).
- **Real-world trigger:** an edit to `styles.css` that misspells the Switzer or Cabinet Grotesk path. The build then drops that face silently. The images job's stylesheet grep (`ci.yml:209`) still catches it on a run with the token, which caps this at LOW.

**Evidence**
```ts
const fontshare = (fontshareFiles as readonly string[]).includes(basename(source))
expect({ source, relative: source.startsWith('../'), present: present || fontshare }).toEqual({
```

**Failure mode** — `url("../fontz/Switzer-Variable.woff2")` is absent, its base name is in `fontshareFiles`, so the test passes even with the fonts installed. Executed: `bash docs/reviews/creator-analytics-942/repro/stylesheet-test-wrong-fontshare-path.sh` prints `Tests  9 passed (9)`.

**Recommended fix** — exempt a Fontshare font only when its url resolves to that file in the package's fonts folder:
```ts
const resolved = new URL(source, stylesheetUrl)
const fontshare =
  (fontshareFiles as readonly string[]).includes(basename(source)) &&
  resolved.href === new URL(basename(source), fontsDirectory).href
```
with `fontsDirectory` imported from `../src/fontshare.ts`.

**Remediation brief**
- **Design intent:** the rule is "every font the stylesheet names is in the package's fonts folder; only the three Fontshare files may be missing from it, because `.gitignore` keeps them out of the tree".
- **Full surface:** `packages/visual-system/test/styles.test.ts:90-111` only.
- **Must preserve:** the relative-path check (`source.startsWith('../')`), the pass with the Fontshare fonts absent (outside clone, fork CI), the red with a JetBrains Mono file removed.
- **Do not touch:** `packages/visual-system/src/fontshare.ts`'s list.
- **Proof:** the repro script above fails after the fix; `pnpm exec vitest run packages/visual-system` passes with and without the three Fontshare files in `packages/visual-system/fonts/`.

### 3. A store build of the extension without the fonts succeeds with only a warning — LOW
- **Location:** `apps/extension/wxt.config.ts:12`, `apps/extension/package.json:8`
- **Attribution:** introduced (`82602465`). Before, the fonts were always in the tree.
- **Real-world trigger:** Nick builds the Chrome or Firefox package from a fresh clone of the public repository, or from his checkout after pulling this branch, before he runs `pnpm fonts`. The popup and first-run pages then draw in the system's sans-serif in the stores. Display only, so LOW.

**Evidence** — `pnpm build` in the outside clone exited 0 with eight lines of `... is absent, so the build leaves out its @font-face ...` in WXT's output. No CI job builds the extension package that ships; `release.yml` deploys nothing for an extension tag.

**Failure mode** — the guard that protects stillstats.com (`ci.yml:120-126`) has no counterpart on the extension's shipping build, so the one build that leaves the machine can ship the fallback.

**Recommended fix** — give `fonts()` an opt-in `requireFontshare` option (or an env flag read in `apps/extension/wxt.config.ts`) that throws in `configResolved` when any file in `fontshareFiles` is absent, and set it only for the store packaging step: a new `apps/extension` script for the store build (for example `build:store`) that sets the flag, and the README's extension release text pointing at it. `pnpm build` stays fallback-tolerant, because CI and an outside clone run it.

**Remediation brief**
- **Design intent:** every default build must succeed without the fonts (outside clone, fork CI). Only a build that ships to users refuses. That split already exists for the images: CI refuses on a push to `main`, and nowhere else.
- **Full surface:** `packages/visual-system/src/vite.ts` (`fonts()` options), `apps/extension/wxt.config.ts:12`, `apps/extension/package.json` scripts, `README.md` where it describes building the extension for the stores. Check whether WXT 0.21.4's `zip` command runs the Vite config (it builds first), so a flag on the build covers `wxt zip` too.
- **Must preserve:** `pnpm build` and `pnpm test` in an outside clone pass; the byte-identical output with the fonts present; the site and web app configs untouched.
- **Do not touch:** the CI guard and smoke grep.
- **Proof:** in a scratch worktree of HEAD (which has no Fontshare fonts), the new store script exits non-zero and names the absent files; `pnpm --filter @creator-analytics/extension build` there still exits 0.

### 4. The fetch script copies the fonts before it checks the licence, and blames the repository for a wrong folder — LOW
- **Location:** `packages/visual-system/src/fetch-fonts-cli.ts:14-35`
- **Attribution:** introduced (`82602465`).
- **Real-world trigger:** (a) the fonts repository loses `LICENSE-ITF-FFL.txt`; (b) someone runs `pnpm fonts --from .stillstats-fonts` from the repo root, where pnpm runs the script in `packages/visual-system/`. CI passes an absolute path, so CI is not affected.

**Evidence**
```ts
for (const file of fontshareFiles) {
  try {
    copyFileSync(join(source, file), new URL(file, fontsDirectory))
  } catch (error) {
    throw new Error(`${file} is not at the root of ${fontshareRepository} (${source})`, {
```

**Failure mode** — executed with `bash docs/reviews/creator-analytics-942/repro/fetch-fonts-source-checks.sh`. Case 1: the script throws on the licence, but both fonts are already in `packages/visual-system/fonts/`, so the next build ships them and `fonts()` ships no ITF licence beside them. Case 2: `CabinetGrotesk-Variable.woff2 is not at the root of nick-vogel/stillstats-fonts (.stillstats-fonts)`, which names the repository and the relative path, not the folder it read.

**Recommended fix** — resolve the source to an absolute path first (`resolve(process.env.INIT_CWD ?? process.cwd(), from)` for `--from`, after checking that pnpm sets `INIT_CWD` for `pnpm run`), check that all three files exist there before copying any, and name the absolute folder in the error ("<folder> does not hold <file>; the fonts repository holds the three files at its root").

**Remediation brief**
- **Design intent:** the three files travel together: a font never lands without its licence, because `fonts()` ships only the licences it finds and the ITF FFL asks for the licence beside the fonts.
- **Full surface:** `packages/visual-system/src/fetch-fonts-cli.ts` only; `.github/workflows/ci.yml:66-70` and `:136-140` call it with an absolute `--from`.
- **Must preserve:** the `gh repo clone` path with no arguments and its temporary folder removed in `finally`; the CI call; the exit code non-zero on any failure.
- **Do not touch:** `packages/visual-system/src/fontshare.ts`.
- **Proof:** after the fix, case 1 of the repro lists only the JetBrains Mono files and its licence, and case 2 copies the fonts or names the absolute folder.

### 5. Comment hygiene — LOW (aggregated)
- `packages/visual-system/src/fontshare.ts:4-5` — "a build that has them copies them into this package's fonts folder first" → "`pnpm fonts`, or CI, copies them into this package's fonts folder before a build".
- `packages/visual-system/src/vite.ts:56` — "drops each @font-face whose font file is absent" → "drops each @font-face with any relative font file absent".
- `packages/visual-system/src/vite.ts:60` — "It runs after Vite inlines each @import" → "It runs after each @import is inlined (by Vite, or by Tailwind in the web app)".
- `packages/visual-system/src/vite.ts` (`fonts()` doc) — add: "An inline `css.postcss` turns off Vite's search for a `postcss.config` file, so a consumer that adds one must merge it here."
- `.gitignore:15` — "(packages/visual-system/src/fontshare.ts)" → "(.github/workflows/ci.yml)".
- `.github/workflows/ci.yml:57` and `:128` — "GitHub gives a pull request from a fork no secret" → "GitHub gives a pull request from a fork, and any run Dependabot starts, no secret".
- `.github/workflows/ci.yml:125` — "as that repository secret (docs/deploy.md, Environments)" → "as the repository secret STILLSTATS_FONTS_TOKEN, not an Environment secret (docs/deploy.md, Environments)".
- `docs/deploy.md:97` — add a step 7: "When `STILLSTATS_FONTS_TOKEN` is set, it checks that the site's stylesheet names Switzer and Cabinet Grotesk, so the image holds the Fontshare fonts."
- `docs/deploy.md:118` — "Repository secrets, shared by both paths:" → "Repository secret, read by CI only:".
- `docs/deploy.md:120` — "an expired one fails the checkout, and with it every deploy" → "an expired one fails the checkout, and with it every same-repository pull request and every deploy".
- `README.md:180` — after "with Studio's own stylesheet" add "(`studio.css`, which each machine writes for itself with `extract-studio-styles.ts`, as `apps/extension/test/fixtures/studio/README.md` says)".

## Needs Further Investigation
### A. A running dev server may keep the fallback after `pnpm fonts` until restart — confirm by starting `pnpm --filter @creator-analytics/site dev` with the fonts absent, running `pnpm fonts`, and reloading. If the face stays missing, push a `dependency` message for each absent file into PostCSS `result.messages` so Vite watches it.
### B. A push run that Dependabot starts on `main` fails at the font guard with "the secret is not set" — confirm only if Dependabot merges are ever enabled; the same run already fails at the Tailscale step on `$BASE`, so it is not a regression.

## Reviewed and Dismissed
- Secrets in job-level `env` and step `if:` (`ci.yml:45,107`) — documented Actions behaviour, and CI ran both values: green with no secret, green with it.
- Token left in the Docker context — `persist-credentials: false`, `rm -rf .stillstats-fonts`, and `.dockerignore` lists `.stillstats-fonts` and `.git`.
- The smoke grep passing falsely — `Switzer-Variable` appears only in a kept `src: url()`; a fallback build has none, and an empty stylesheet fails the grep.
- Plugin order against Vite's url rewrite — read in Vite 8.3.2 (`postcss-import` first, user plugins, `vite-url-rewrite` last) and probed on four pipelines.
- `permissions:` left at `contents: read` — already least privilege, and public on a public repository.
- `example.cloudflareaccess.com` against the `a-test-team` convention — the issue names `example.cloudflareaccess.com`.
- Public ids, titles and per-video views in the Studio fixtures — public on the channel, and the accepted `youtube/*.html` fixtures and about 30 tests carry the same ids. Do not swap them in finding 1.
- The "Playing Keys at Church" title in `home-feed.html` — another creator's video, accepted by Nick on 2026-11-25.
- `docs/reviews/creator-analytics-569/pre-pr-review-2.md` row now reading "deploy guide names Nick's address" — a historical record of that review.
- The second test in `packages/visual-system/test/vite.test.ts` passing through `fontLicences()` at `$BASE` — it guards that a present face is kept; it goes red when the plugin resolves against the wrong stylesheet, which drops the present face too.

## Minor / nits
- `packages/visual-system/src/vite.ts:50` — the url regex does not trim `url( ../x.woff2 )` or decode `%20`, and skips a bare `fonts/x.woff2`; none occurs in the repo.
- `packages/visual-system/test/vite.test.ts` — covers the plain build only; the site and web app dev-server tests cover the other pipelines when the fonts are absent (outside clone, fork CI).
- `.github/workflows/ci.yml:209-217` — the smoke check fails with no `::error::` line, and checks the site only.
- `packages/visual-system/test/testing.ts:230` — a second `new URL('../fonts/', import.meta.url)`; it could import `fontsDirectory` from `../src/fontshare.ts`.
- `packages/visual-system/src/fetch-fonts-cli.ts:16` — a bad argument prints a stack trace; a missing `gh` prints only `spawnSync gh ENOENT`.

## Test quality
Tests added: 2 (`packages/visual-system/test/vite.test.ts`). Tests changed: 2 (`styles.test.ts` font test, `cloudflare-access.test.ts` data only). At `$BASE` as written, both visual-system files are red at import. Run through `fontLicences()` at `$BASE`, the drop test is red (`expected [ 'Present', 'Absent' ] to deeply equal [ 'Present' ]`) and the keep test is green, a preservation guard (Reviewed and Dismissed). `cloudflare-access.test.ts` is green at `$BASE`, as a string swap should be. Tautology shapes found: 1, finding 2 (an exemption broader than its rule).

## Before opening the PR
- **CI readiness:** green on PR #1125 at `0ea7e47d`, on both font paths.
- **Commit hygiene:** commit this doc and `repro/` alone, subject `creator-analytics#942 pre-PR review 1`.
- **Likely reviewer asks:** that the public copy carries no private analytics (finding 1); how the extension store build gets the fonts (finding 3).

## Verdict
Ready with follow-ups. Finding 1 must be fixed before the public `stillstats` repository is seeded from this tree; it can land on this PR or before the copy. Findings 2 to 5 are LOW and can be fixed on this PR or filed as follow-ups. No CRITICAL or HIGH.

## Remediation — 2026-11-25
| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 1 (MEDIUM) | `56c2941e` creator-analytics#942 pre-PR review 1 finding 1: the Studio fixtures published owner-only analytics | red→green: the brief's `grep -c '389.9\|2.9%\|3:02\|60% of viewers'` printed 3 and 1, now 0 and 0; `pnpm exec vitest run apps/extension` 34 files, 1113 tests, unchanged | 0 | fixed, proved by execution |
| 2 (LOW) | — deferred | — | — | LOW tail, not in scope this round |
| 3 (LOW) | — deferred | — | — | LOW tail, not in scope this round |
| 4 (LOW) | `5f4dc782` creator-analytics#942 pre-PR review 2 finding 2: the fetch script copied fonts before it checked the licence | red→green: `bash docs/reviews/creator-analytics-942/repro/fetch-fonts-source-checks.sh` case 1 lists only the JetBrains Mono files, case 2 names the absolute folder | 4 lines (one doc block, counted in review 2's closure) | fixed under review 2 finding 2, the same defect |
| 5 (LOW) | — deferred | — | — | LOW tail, not in scope this round |

Finding 1 covered more than the brief named: the dashboard's 28-day subscriber gain, the typical-range tooltips and the 48-hour top videos' views, and on the analytics page the 48-hour views with their traffic shares and the `mini-card` attribute that held them as JSON (removed; no code reads it). The ranking stays "6 of 10", which `apps/extension/src/surfaces/card.test.ts:813` reads; the tooltip's views were swapped in descending order around the latest video's 331, so the rank still holds. The charts' drawn lines keep their shapes, with sample axis labels.

Full checks after the round, at `5f4dc782`: `pnpm typecheck` and `pnpm lint` pass; `pnpm test` passes, 230 files, 6048 tests, 1 expected fail.

### Known regressions, deferred
- None.
