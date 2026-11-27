# Pre-PR review: creator-analytics#942 clean the tree for the public stillstats repository (independent second opinion)

**Branch:** `creator-analytics-942-public-cleanup` vs `origin/main` (merge-base `1ec9866e281d3b4a53e6d323d104a5af25c985c7`, "Merge pull request #1122 from nick-vogel/creator-analytics-1108-extension-redraw-timing")
**Reviewed at:** HEAD `0ea7e47dd7344c826a75f2714824823b7206e8b2` (`creator-analytics#942 the docs name no email address of mine`) + 0 files with uncommitted changes, 0 untracked files at the start (expected gitignored local files `packages/visual-system/fonts/{CabinetGrotesk-Variable.woff2,Switzer-Variable.woff2,LICENSE-ITF-FFL.txt}` and `apps/extension/test/fixtures/studio/studio.css` present on disk), 54 files total, +549 / −3036 (`--fresh` full-branch independent review). The only untracked files added by this review are this doc and its two repro files under `docs/reviews/creator-analytics-942/repro/`.
**Reviewed against:** issue `nick-vogel/creator-analytics#942`, PR `nick-vogel/creator-analytics#1125` (body and checks), commit messages (`1ec9866e..0ea7e47d`), `CONTEXT.md`, `README.md`, `docs/deploy.md`, `docs/adr/0007-no-third-party-processors.md`, `docs/adr/0014-bundled-libraries-are-first-party-code.md`, `.claude/rules/`, and `~/.claude/rules/`. No plan or spec docs exist under `docs/specs/` or `docs/plans/`; concurrent `pre-pr-review-1.md` was not read.
**Date:** 2026-11-25
**Reviewer:** Gemini through Antigravity (Gemini 4 Neon (High)) + verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Workflow lint | `actionlint -no-color` | green, 0 errors across `ci.yml`, `release.yml`, `rollback.yml` |
| Lint | `pnpm lint` (`biome check .`), before and after adding repro files | green (889 files before; 891 files after) |
| Typecheck | `pnpm typecheck` (`pnpm -r typecheck`) | green across all 19 workspace projects |
| Build (with fonts present) | `pnpm build` (`pnpm -r build`) | green across `apps/extension` (Chrome + Firefox MV3), `apps/web`, and `apps/site`; all three emit `Switzer-Variable`, `CabinetGrotesk-Variable`, `JetBrainsMono-*`, and `fonts/LICENSE-ITF-FFL.txt` |
| Visual system + Cloudflare Access unit tests | `pnpm exec vitest run packages/visual-system/test/ apps/api/src/cloudflare-access.test.ts` | green: 7 files, 78 passed (`styles.test.ts` 9, `vite.test.ts` 2, `cloudflare-access.test.ts` 28, plus 39 others) |
| Extension unit tests | `pnpm exec vitest run apps/extension/` | green: 34 files, 1113 passed |
| Site & web dev-server font tests | `pnpm exec vitest run apps/site/test/site.test.ts -t "the dev server"` and `apps/web/test/web.test.ts -t "the dev server"` | green: 1 passed in `site.test.ts`, 2 passed in `web.test.ts` |
| `@tailwindcss/vite` + `fonts()` build & dev with absent font | scratch Vite 8 + `@tailwindcss/vite` build and dev server in `mktemp -d` with missing `Switzer-Variable.woff2` | confirmed working: drops absent `@font-face` and warns in both build and dev server; keeps present face |
| Vite PostCSS path resolution across workspace symlinks | spy PostCSS plugin on `apps/web` and `apps/site` builds | confirmed: `resolve(dirname(stylesheet), url)` matches `fileURLToPath(new URL(file, fontsDirectory))` exactly in both apps |
| GitHub Action SHA-to-tag pins | `gh api repos/<owner>/<repo>/git/ref/tags/<tag>` for all four pinned actions | all 4 match verbatim: `actions/checkout@v4.3.1`, `pnpm/action-setup@v4.3.0`, `actions/setup-node@v4.4.0`, `tailscale/github-action@v3.3.0` |
| `LICENSE.md` vs upstream template | `gh api 'repos/getsentry/fsl.software/contents/FSL-1.1-ALv2.template.md?ref=85f3fc7e'` + `diff -u` | byte-identical except `${year} ${licensor name}` → `2026 NLVogel, LLC` |
| Workspace `package.json` licenses | iterated all 20 `package.json` files | all 20 carry `"license": "FSL-1.1-ALv2"` |
| Sensitive-data & stale-ref sweep | repo-wide `git grep` and `git ls-files` for Fontshare files, `studio.css`, `fontLicences`, church domain, personal email, `/Users/` paths, old scheduled/unlisted Studio IDs/titles/sponsor/revenues, IPv4s | clean: zero leaked occurrences remain outside accepted fixtures |
| **Finding 1 (`fonts()` drops non-Fontshare absent fonts)** | executed `node --test docs/reviews/creator-analytics-942/repro/review-2-non-fontshare-dropped.test.ts` | red at `0ea7e47d`: `Roboto` (`roboto-missing.woff2`) stripped from CSS (`['JetBrains Mono']` vs `['JetBrains Mono', 'Roboto']`) and warned with `pnpm fonts` |
| **Finding 2 (`fetch-fonts-cli.ts` partial copy, error masking, extra args)** | executed `node --test docs/reviews/creator-analytics-942/repro/review-2-fetch-fonts-cli.test.ts` | 3 of 3 red at `0ea7e47d`: missing `LICENSE-ITF-FFL.txt` left `CabinetGrotesk-Variable.woff2` and `Switzer-Variable.woff2` in `fonts/`; `EACCES` claimed `is not at the root of nick-vogel/stillstats-fonts`; extra arg exited 0 |
| Tautology audit against `$BASE` checkout | static audit of all new/modified tests (`styles.test.ts`, `vite.test.ts`, `cloudflare-access.test.ts`); `$BASE` execution not run (Antigravity review does not run `git worktree add`) | all new/modified tests fail to import at `$BASE` (`fontshare.ts` and `fonts` do not exist at `1ec9866e`) and avoid the four tautology shapes; one path-weakness found in `styles.test.ts` (Finding 5) |
| Full Postgres / Testcontainers suites & `pnpm test:browser` | not run locally; GitHub Actions PR #1125 checks verified via `pull_request_read` | both `Lint, type check and test` and `Build, smoke-run and push the images` passed on `0ea7e47d`; outside-clone build without fonts was not re-run in a full clean clone here (covered by scratch Vite+Tailwind test above and PR checks) |

**Overall:** The public-cleanup items themselves are thorough and accurate: Fontshare assets and `studio.css` are untracked and ignored, `LICENSE.md` matches the upstream FSL-1.1-ALv2 template verbatim, all 20 `package.json` files carry `FSL-1.1-ALv2`, all four GitHub Action SHA comments match their tags, and the sensitive-data sweep found no leftover church domain, personal email, home-folder path, or unredacted Studio revenue/non-public row. There are zero CRITICAL or HIGH findings. Two MEDIUM defects and three LOW gaps remain in the new font-handling and screenshot tooling: `fonts()` silently drops any absent `@font-face` (not only the Fontshare fonts) and blames `pnpm fonts`, which weakens the CI guard on committed fonts like Roboto; and `fetch-fonts-cli.ts` can leave Fontshare `.woff2` files on disk without `LICENSE-ITF-FFL.txt`, masks non-`ENOENT` errors, accepts extra args, and lacks tests. Fix Findings 1 and 2 before merging; Findings 3, 4, and 5 are small enough to fold into the same pass or ship as quick follow-ups.

## Approach decisions
- **Allowed-absent fonts (`packages/visual-system/src/fontshare.ts`, `vite.ts`, `styles.test.ts`):** keep one canonical resolved-path set (`fontshareFontPaths`) in `fontshare.ts`, derived from `fontshareFiles` and `fontsDirectory`, and use it in both `fonts()`'s default `mayBeAbsent` predicate and `styles.test.ts` so neither build nor test treats arbitrary missing fonts or wrong directories as Fontshare fallbacks.
- **Font fetch script (`packages/visual-system/src/fetch-fonts-cli.ts`):** validate all source files before copying any file into `fonts/`, mirror `apps/extension/test/screenshot/studio-fixtures.ts:21` by rethrowing non-`ENOENT` errors unchanged (`nearest-in-repo-precedent`), and keep zero third-party imports because CI invokes `fetch-fonts-cli.ts` before `pnpm install`.

## Confirmed Issues

### 1. `fonts()` silently drops any absent `@font-face`, not only Fontshare fonts, and blames `pnpm fonts` — MEDIUM
- **Location:** `packages/visual-system/src/vite.ts:63-78`, `:100-112`
- **Attribution:** introduced. `git show 1ec9866e:packages/visual-system/src/vite.ts | grep -n withoutAbsentFonts` returns nothing; added in `82602465` (`creator-analytics#942 the Fontshare fonts come from a private repository at build time`).
- **Real-world trigger:** any future typo, rename, or accidental deletion of a committed font file — specifically `packages/thumbnail-preview/fonts/roboto-400.woff2` or `roboto-500.woff2` (`packages/thumbnail-preview/src/youtube.css:20,28`, which has no file-existence test in `packages/thumbnail-preview/test/styles.test.ts`), or a newly added `@font-face` in `apps/site`, `apps/web`, or `apps/extension`. Before this branch, `apps/site/test/site.test.ts:1159` ("every font the stylesheet names answers as a font") caught a broken Roboto `url()` because Vite left the unresolved URL in CSS and `fetch` returned 404. Now `fonts()` silently strips the broken `@font-face` during the build, warns `"Stillstats' own builds fetch it first with \`pnpm fonts\`"` (false for Roboto or JetBrains Mono), and `site.test.ts:1159` stays green because the remaining fonts satisfy `fonts.length > 0` and HTTP 200. Capped at MEDIUM: requires a future broken committed font path and produces fallback typography rather than data/auth corruption.

**Evidence**
```ts
// packages/visual-system/src/vite.ts:63-78
export function withoutAbsentFonts(onAbsent: (file: string) => void): PostcssPlugin {
  return {
    postcssPlugin: 'without-absent-fonts',
    OnceExit(root) {
      root.walkAtRules('font-face', (rule) => {
        const absent: string[] = []
        rule.walkDecls('src', (declaration) => {
          absent.push(...relativeFilesOf(declaration).filter((file) => !existsSync(file)))
        })
        if (absent.length === 0) return
        for (const file of absent) onAbsent(file)
        rule.remove()
      })
    },
  }
}
```

**Failure mode** — Building a page whose stylesheet has a present font (`JetBrainsMono-Regular.woff2`) and a broken non-Fontshare font (`../fonts/roboto-missing.woff2`) with `fonts()` strips the `Roboto` `@font-face` and logs `.../roboto-missing.woff2 is absent... fetch it first with \`pnpm fonts\``. Executed: `node --test docs/reviews/creator-analytics-942/repro/review-2-non-fontshare-dropped.test.ts` failed with `actual: ['JetBrains Mono']`, `expected: ['JetBrains Mono', 'Roboto']`.

**Recommended fix**
```diff
--- a/packages/visual-system/src/fontshare.ts
+++ b/packages/visual-system/src/fontshare.ts
@@ -1,3 +1,5 @@
+import { fileURLToPath } from 'node:url'
+
 /**
  * The Fontshare fonts and their licence. The ITF Free Font License allows them on stillstats.com
  * but forbids redistribution through a public repository, so the tree does not hold them
@@ -14,3 +16,9 @@ export const fontshareFiles = [
 export const fontshareRepository = 'nick-vogel/stillstats-fonts'
 
 export const fontsDirectory = new URL('../fonts/', import.meta.url)
+
+export const fontshareFontPaths: ReadonlySet<string> = new Set(
+  fontshareFiles
+    .filter((file) => file.endsWith('.woff2'))
+    .map((file) => fileURLToPath(new URL(file, fontsDirectory))),
+)
--- a/packages/visual-system/src/vite.ts
+++ b/packages/visual-system/src/vite.ts
@@ -5,7 +5,7 @@ import { dirname, resolve } from 'node:path'
 import {
   contentSecurityPolicyOf,
   toolPageContentSecurityPolicyOf,
 } from './content-security-policy.ts'
-import { fontsDirectory } from './fontshare.ts'
+import { fontsDirectory, fontshareFontPaths } from './fontshare.ts'
 
 /** Each `LICENSE-*.txt` in a folder of fonts, by the file name it ships under. */
 function licencesIn(directory: URL): Map<string, URL> {
@@ -60,14 +60,19 @@ function relativeFilesOf(declaration: FontDeclaration): string[] {
  * It runs after Vite inlines each @import and before Vite resolves each url(), which leaves an
  * unresolved one in place for the browser to ask for at run time.
  */
-export function withoutAbsentFonts(onAbsent: (file: string) => void): PostcssPlugin {
+export function withoutAbsentFonts(
+  onAbsent: (file: string) => void,
+  mayBeAbsent: (file: string) => boolean = () => true,
+): PostcssPlugin {
   return {
     postcssPlugin: 'without-absent-fonts',
     OnceExit(root) {
       root.walkAtRules('font-face', (rule) => {
         const absent: string[] = []
         rule.walkDecls('src', (declaration) => {
-          absent.push(...relativeFilesOf(declaration).filter((file) => !existsSync(file)))
+          absent.push(
+            ...relativeFilesOf(declaration).filter((file) => mayBeAbsent(file) && !existsSync(file)),
+          )
         })
         if (absent.length === 0) return
         for (const file of absent) onAbsent(file)
@@ -85,7 +90,9 @@ export function withoutAbsentFonts(onAbsent: (file: string) => void): PostcssPlu
  * with the fonts, and Vite emits only the hashed fonts the stylesheet names. Two licences of one
  * name would ship one over the other, so that throws.
  */
-export function fonts(options: { directories?: URL[] } = {}): FontsPlugin {
+export function fonts(
+  options: { directories?: URL[]; mayBeAbsent?: (file: string) => boolean } = {},
+): FontsPlugin {
   const licences = new Map<string, URL>()
   for (const directory of [fontsDirectory, ...(options.directories ?? [])]) {
     for (const [file, url] of licencesIn(directory)) {
@@ -94,6 +101,7 @@ export function fonts(options: { directories?: URL[] } = {}): FontsPlugin {
     }
   }
   let base = '/'
+  const mayBeAbsent = options.mayBeAbsent ?? ((file: string) => fontshareFontPaths.has(file))
   let warnOnce = (message: string) => console.warn(message)
   return {
     name: 'fonts',
@@ -101,10 +109,13 @@ export function fonts(options: { directories?: URL[] } = {}): FontsPlugin {
       css: {
         postcss: {
           plugins: [
-            withoutAbsentFonts((file) =>
-              warnOnce(
-                `${file} is absent, so the build leaves out its @font-face and the page uses the next font in the stack. Stillstats' own builds fetch it first with \`pnpm fonts\`.`,
-              ),
+            withoutAbsentFonts(
+              (file) =>
+                warnOnce(
+                  `${file} is absent, so the build leaves out its @font-face and the page uses the next font in the stack. Stillstats' own builds fetch it first with \`pnpm fonts\`.`,
+                ),
+              mayBeAbsent,
             ),
           ],
         },
```

**Remediation brief**
- **Design intent:** Only the Fontshare font files (`CabinetGrotesk-Variable.woff2` and `Switzer-Variable.woff2` in `packages/visual-system/fonts/`) are intentionally absent in an outside clone. Every other `@font-face` file (JetBrains Mono, Roboto in `packages/thumbnail-preview`) is committed in the repo and must never be silently dropped or blamed on `pnpm fonts`; leaving an unresolved non-Fontshare `url()` in place lets `site.test.ts` and `web.test.ts` catch the 404. Spy checks on both `apps/site` and `apps/web` confirmed Vite rewrites `@import "@creator-analytics/visual-system/styles.css"` URLs so `resolve(dirname(stylesheet), url)` equals `fileURLToPath(new URL(file, fontsDirectory))` exactly.
- **Full surface:** `packages/visual-system/src/fontshare.ts:1-16` (export `fontshareFontPaths`, keeping zero third-party imports because `fetch-fonts-cli.ts` imports `fontshare.ts` before `pnpm install` in CI), `packages/visual-system/src/vite.ts:8,63-78,88-112`, and `packages/visual-system/test/vite.test.ts:41-80` (pass `mayBeAbsent` in the temp-dir test for the optional absent face, and add a test with default `fonts()` proving an absent non-Fontshare file is kept in CSS with no warning). `apps/site/vite.config.ts:411`, `apps/web/vite.config.ts:18`, and `apps/extension/wxt.config.ts:12` need no change.
- **Must preserve:** an outside clone with `CabinetGrotesk-Variable.woff2` and `Switzer-Variable.woff2` absent still drops both `@font-face` rules and emits the warning naming each file in `apps/site`, `apps/web` (with `@tailwindcss/vite`), and `apps/extension` (Chrome and Firefox); builds with the fonts present remain unchanged; licence emission (`fonts/LICENSE-*.txt`) and duplicate-licence throw in `fonts()` stay unchanged. Suites: `packages/visual-system/test/vite.test.ts`, `packages/visual-system/test/styles.test.ts`, `apps/site/test/site.test.ts`, `apps/web/test/web.test.ts`, `apps/extension/test/manifest.test.ts`.
- **Do not touch:** `packages/visual-system/src/vite.ts` licence-copying logic (`licencesIn`, `configureServer`, `generateBundle`) and `contentSecurityPolicy`.
- **Proof:** `node --test docs/reviews/creator-analytics-942/repro/review-2-non-fontshare-dropped.test.ts` is red now and must pass after the fix, along with `pnpm exec vitest run packages/visual-system/test/vite.test.ts`.

### 2. `fetch-fonts-cli.ts` writes partial Fontshare files before failing, masks non-`ENOENT` errors, ignores extra CLI arguments, and has no tests — MEDIUM
- **Location:** `packages/visual-system/src/fetch-fonts-cli.ts:14-36`
- **Attribution:** introduced. `git show 1ec9866e:packages/visual-system/src/fetch-fonts-cli.ts` fails (file absent at `$BASE`); added in `82602465` (`creator-analytics#942 the Fontshare fonts come from a private repository at build time`).
- **Real-world trigger:** running `pnpm fonts` or CI's `node packages/visual-system/src/fetch-fonts-cli.ts --from <dir>` against an incomplete `nick-vogel/stillstats-fonts` checkout (for example, `LICENSE-ITF-FFL.txt` missing or renamed) copies `CabinetGrotesk-Variable.woff2` and `Switzer-Variable.woff2` into `packages/visual-system/fonts/` before throwing on the third file; any subsequent local build then bundles Fontshare fonts without `LICENSE-ITF-FFL.txt`. Independently, any non-`ENOENT` copy failure (`EACCES`, `ENOSPC`, `EISDIR`) is wrapped as `${file} is not at the root of nick-vogel/stillstats-fonts`, contradicting the `code !== 'ENOENT'` precedent introduced in `apps/extension/test/screenshot/studio-fixtures.ts:21` in this same PR (`nearest-in-repo-precedent`); extra positional arguments after `--from <dir>` exit 0 silently; and the `catch` block has zero tests (`test-every-fallback-path`).

**Evidence**
```ts
// packages/visual-system/src/fetch-fonts-cli.ts:14-35
const [flag, from] = process.argv.slice(2)
if (flag !== undefined && (flag !== '--from' || !from)) {
  throw new Error('Run it with no arguments, or with --from <a checkout of the fonts repository>')
}
// ...
  for (const file of fontshareFiles) {
    try {
      copyFileSync(join(source, file), new URL(file, fontsDirectory))
    } catch (error) {
      throw new Error(`${file} is not at the root of ${fontshareRepository} (${source})`, {
        cause: error,
      })
    }
  }
```

**Failure mode** — Three executed failures in `node --test docs/reviews/creator-analytics-942/repro/review-2-fetch-fonts-cli.test.ts`:
1. With `CabinetGrotesk-Variable.woff2` and `Switzer-Variable.woff2` present and `LICENSE-ITF-FFL.txt` absent, the CLI exits non-zero but leaves `['CabinetGrotesk-Variable.woff2', 'Switzer-Variable.woff2']` in `fonts/`.
2. With all three files present in `--from` and `fonts/` chmod `0o555`, the CLI throws `CabinetGrotesk-Variable.woff2 is not at the root of nick-vogel/stillstats-fonts (...)` wrapping `EACCES`.
3. Passing `--from <complete> unexpected-extra` exits `0` and copies the files.

**Recommended fix**
```diff
--- a/packages/visual-system/src/fontshare.ts
+++ b/packages/visual-system/src/fontshare.ts
@@ -1,3 +1,5 @@
+import { accessSync, copyFileSync } from 'node:fs'
+import { join } from 'node:path'
 import { fileURLToPath } from 'node:url'
 
 /**
@@ -22,3 +24,20 @@ export const fontshareFontPaths: ReadonlySet<string> = new Set(
     .filter((file) => file.endsWith('.woff2'))
     .map((file) => fileURLToPath(new URL(file, fontsDirectory))),
 )
+
+export function copyFontshareFiles(source: string, destination: URL = fontsDirectory): void {
+  for (const file of fontshareFiles) {
+    try {
+      accessSync(join(source, file))
+    } catch (error) {
+      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
+      throw new Error(`${file} is not at the root of ${fontshareRepository} (${source})`, {
+        cause: error,
+      })
+    }
+  }
+  for (const file of fontshareFiles) {
+    copyFileSync(join(source, file), new URL(file, destination))
+  }
+}
--- a/packages/visual-system/src/fetch-fonts-cli.ts
+++ b/packages/visual-system/src/fetch-fonts-cli.ts
@@ -5,14 +5,15 @@
 //   node packages/visual-system/src/fetch-fonts-cli.ts --from <folder>
 //                                               copies from a checkout of it, as CI does
 import { execFileSync } from 'node:child_process'
-import { copyFileSync, mkdtempSync, rmSync } from 'node:fs'
+import { mkdtempSync, rmSync } from 'node:fs'
 import { tmpdir } from 'node:os'
 import { join } from 'node:path'
 import { fileURLToPath } from 'node:url'
-import { fontsDirectory, fontshareFiles, fontshareRepository } from './fontshare.ts'
+import { copyFontshareFiles, fontsDirectory, fontshareFiles, fontshareRepository } from './fontshare.ts'
 
-const [flag, from] = process.argv.slice(2)
-if (flag !== undefined && (flag !== '--from' || !from)) {
+const args = process.argv.slice(2)
+const from = args.length === 2 && args[0] === '--from' && args[1] ? args[1] : undefined
+if (args.length !== 0 && !from) {
   throw new Error('Run it with no arguments, or with --from <a checkout of the fonts repository>')
 }
 
@@ -24,15 +25,7 @@ try {
     })
   }
   const source = from ?? clone ?? ''
-  for (const file of fontshareFiles) {
-    try {
-      copyFileSync(join(source, file), new URL(file, fontsDirectory))
-    } catch (error) {
-      throw new Error(`${file} is not at the root of ${fontshareRepository} (${source})`, {
-        cause: error,
-      })
-    }
-  }
+  copyFontshareFiles(source)
   console.log(`Copied ${fontshareFiles.join(', ')} into ${fileURLToPath(fontsDirectory)}`)
 } finally {
   if (clone) rmSync(clone, { recursive: true, force: true })
```

**Remediation brief**
- **Design intent:** `fetch-fonts-cli.ts` is the sole mechanism that populates the three gitignored Fontshare files into `packages/visual-system/fonts/` (locally via `pnpm fonts` / `gh repo clone` and in CI via `--from <checkout>` before `pnpm install`). Because `ci.yml:69` and `ci.yml:140` invoke it before `pnpm install`, neither `fetch-fonts-cli.ts` nor `fontshare.ts` may import any npm package (Node built-ins and relative `.ts` imports only). Either all three files are present at the source root and copied together, or none are copied and a missing file is reported with its `ENOENT` cause while any non-`ENOENT` filesystem error surfaces unchanged (matching `apps/extension/test/screenshot/studio-fixtures.ts:21`).
- **Full surface:** `packages/visual-system/src/fontshare.ts`, `packages/visual-system/src/fetch-fonts-cli.ts:7-38`, and a new unit test file `packages/visual-system/test/fetch-fonts.test.ts` testing `copyFontshareFiles` (all three copied; missing `LICENSE-ITF-FFL.txt` throws naming the file with `ENOENT` cause and leaves destination empty; read-only destination surfaces `EACCES` without the missing-file message) and CLI argument refusal (`--from <dir> extra`, `--unknown`).
- **Must preserve:** `node packages/visual-system/src/fetch-fonts-cli.ts --from <folder>` works with zero installed `node_modules`; `pnpm fonts` with no arguments still clones `nick-vogel/stillstats-fonts` via `gh` into a temp directory and removes the temp directory in `finally`; valid `--from <folder>` copies all three files and logs the copied list.
- **Do not touch:** `.github/workflows/ci.yml:69,140` (`--from "$GITHUB_WORKSPACE/.stillstats-fonts"` invocation) and `package.json` / `packages/visual-system/package.json` `fonts` scripts.
- **Proof:** `node --test docs/reviews/creator-analytics-942/repro/review-2-fetch-fonts-cli.test.ts` is 3/3 red now and must be 3/3 green after the fix, along with `pnpm exec vitest run packages/visual-system/test/fetch-fonts.test.ts`.

### 3. CI smoke test verifies the Fontshare fonts only in the marketing site's stylesheet (`/`), not in the web app's (`/app`) — LOW
- **Location:** `.github/workflows/ci.yml:209-217`
- **Attribution:** introduced. `git show 1ec9866e:.github/workflows/ci.yml | grep -n Switzer-Variable` returns nothing; added in `82602465` (`creator-analytics#942 the Fontshare fonts come from a private repository at build time`).
- **Real-world trigger:** `apps/api/Dockerfile` builds two separate frontends with different CSS pipelines (`apps/site` uses plain Vite CSS; `apps/web` uses `@tailwindcss/vite` + `fonts()`). On a `push` to `main`, `check` is skipped and `images` is the only check before deploy. If a Tailwind v4 / Vite upgrade or `apps/web/vite.config.ts` edit drops Switzer or Cabinet Grotesk from the web app while `apps/site` keeps them, the smoke step passes and deploys the web app with fallback system fonts (`whole-surface-of-a-change`).

**Evidence**
```yaml
# .github/workflows/ci.yml:209-217
      - name: The site's stylesheet carries the Fontshare fonts
        if: env.FONTS_TOKEN_SET == 'true'
        run: |
          for sheet in $(curl --fail --silent --show-error http://localhost:3000/ \
            | grep -oE 'href="/assets/[^"]+\.css"' | sed -E 's/^href="(.*)"$/\1/'); do
            curl --fail --silent --show-error "http://localhost:3000$sheet"
          done > "$RUNNER_TEMP/site.css"
          grep -q 'Switzer-Variable' "$RUNNER_TEMP/site.css"
          grep -q 'CabinetGrotesk-Variable' "$RUNNER_TEMP/site.css"
```

**Failure mode** — `apps/web/dist/index.html` links `/app/assets/index-*.css`, which the smoke check never fetches or greps; a regression that strips Fontshare `@font-face` rules only in `apps/web` passes the `images` job.

**Recommended fix**
```diff
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -206,15 +206,20 @@ jobs:
           # The answer reads the release content, so this shows the image's --prod install holds it.
           curl --fail --silent --show-error http://localhost:3000/api/client-settings \
             | grep -q '"environment":"production"'
-      - name: The site's stylesheet carries the Fontshare fonts
+      - name: The site's and the web app's stylesheets carry the Fontshare fonts
         if: env.FONTS_TOKEN_SET == 'true'
         run: |
           for sheet in $(curl --fail --silent --show-error http://localhost:3000/ \
             | grep -oE 'href="/assets/[^"]+\.css"' | sed -E 's/^href="(.*)"$/\1/'); do
             curl --fail --silent --show-error "http://localhost:3000$sheet"
           done > "$RUNNER_TEMP/site.css"
-          grep -q 'Switzer-Variable' "$RUNNER_TEMP/site.css"
-          grep -q 'CabinetGrotesk-Variable' "$RUNNER_TEMP/site.css"
+          for sheet in $(curl --fail --silent --show-error http://localhost:3000/app \
+            | grep -oE 'href="/app/assets/[^"]+\.css"' | sed -E 's/^href="(.*)"$/\1/'); do
+            curl --fail --silent --show-error "http://localhost:3000$sheet"
+          done > "$RUNNER_TEMP/web.css"
+          for bundle in "$RUNNER_TEMP/site.css" "$RUNNER_TEMP/web.css"; do
+            grep -q 'Switzer-Variable' "$bundle"
+            grep -q 'CabinetGrotesk-Variable' "$bundle"
+          done
       - name: Container logs
         if: ${{ !cancelled() }}
```

**Remediation brief**
- **Design intent:** The `images` job's smoke run proves the built API image serves both `apps/site` (`/`) and `apps/web` (`/app`) with Switzer and Cabinet Grotesk whenever `STILLSTATS_FONTS_TOKEN` is set, catching CSS-pipeline regressions in either Vite build before `Push the images` runs.
- **Full surface:** `.github/workflows/ci.yml:209-217`. Verified against `apps/web/dist/index.html` (`href="/app/assets/index-*.css"`) and `apps/web/dist/assets/index-*.css` (contains both `Switzer-Variable` and `CabinetGrotesk-Variable`).
- **Must preserve:** step stays skipped when `FONTS_TOKEN_SET != 'true'` (fork PRs without the secret); `actionlint -no-color` stays clean.
- **Do not touch:** `.github/workflows/ci.yml:122-126` (the `push` refusal guard) and `ci.yml:200-208` (the existing API smoke assertions).
- **Proof:** `actionlint -no-color` passes, and the `Build, smoke-run and push the images` CI job passes on the PR with `STILLSTATS_FONTS_TOKEN` set.

### 4. `readStudioStyles()` adds a `try/catch` fallback path with no tests — LOW
- **Location:** `apps/extension/test/screenshot/studio-fixtures.ts:17-27`
- **Attribution:** introduced. `git show 1ec9866e:apps/extension/test/screenshot/studio-fixtures.ts | grep -n readStudioStyles` returns nothing; added in `71d3a8ce` (`creator-analytics#942 Studio's stylesheet is written locally, not committed`).
- **Real-world trigger:** `readStudioStyles()` is called only from `apps/extension/test/screenshot/take-screenshots.ts:155`, never in CI, and hardcodes `studioStylesPath` with no optional path argument. No test exercises either the `ENOENT` translation or the non-`ENOENT` rethrow, violating `~/.claude/rules/test-every-fallback-path.md`.

**Evidence**
```ts
// apps/extension/test/screenshot/studio-fixtures.ts:17-27
export async function readStudioStyles(): Promise<string> {
  try {
    return await readFile(studioStylesPath, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    throw new Error(
      `${studioStylesPath} is absent. It is YouTube Studio's own stylesheet, which the repository does not hold. Write it from the three full Studio saves first: node apps/extension/test/screenshot/extract-studio-styles.ts <dashboard> <content list> <video analytics>`,
      { cause: error },
    )
  }
}
```

**Failure mode** — `git grep -n readStudioStyles` finds only the definition and `take-screenshots.ts:155`; zero tests cover the `catch` block, so a change that drops the `code !== 'ENOENT'` guard or `{ cause: error }` goes undetected.

**Recommended fix**
```diff
--- a/apps/extension/test/screenshot/studio-fixtures.ts
+++ b/apps/extension/test/screenshot/studio-fixtures.ts
@@ -14,13 +14,13 @@ export const studioStylesPath = fileURLToPath(new URL('studio.css', fixturesDire
  * Studio's stylesheet for the screenshots. It is YouTube's own file, so it is written locally by
  * extract-studio-styles.ts and never committed (creator-analytics#942), and a clone has none.
  */
-export async function readStudioStyles(): Promise<string> {
+export async function readStudioStyles(path: string = studioStylesPath): Promise<string> {
   try {
-    return await readFile(studioStylesPath, 'utf8')
+    return await readFile(path, 'utf8')
   } catch (error) {
     if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
     throw new Error(
-      `${studioStylesPath} is absent. It is YouTube Studio's own stylesheet, which the repository does not hold. Write it from the three full Studio saves first: node apps/extension/test/screenshot/extract-studio-styles.ts <dashboard> <content list> <video analytics>`,
+      `${path} is absent. It is YouTube Studio's own stylesheet, which the repository does not hold. Write it from the three full Studio saves first: node apps/extension/test/screenshot/extract-studio-styles.ts <dashboard> <content list> <video analytics>`,
       { cause: error },
     )
   }
```

**Remediation brief**
- **Design intent:** `studio.css` is gitignored and generated locally by `extract-studio-styles.ts`; `readStudioStyles()` translates only `ENOENT` into an actionable error naming the absent path and command (preserving `{ cause: error }`) and rethrows any other filesystem error unchanged.
- **Full surface:** `apps/extension/test/screenshot/studio-fixtures.ts:17-27` and a new unit test file `apps/extension/test/screenshot/studio-fixtures.test.ts` testing: existing file returns its contents; absent path throws naming the path and `extract-studio-styles.ts` with an `ENOENT` cause; a directory path (non-`ENOENT`, `EISDIR`) rethrows the original error unchanged.
- **Must preserve:** calling `readStudioStyles()` with no argument still reads `studioStylesPath`; `apps/extension/test/screenshot/take-screenshots.ts:155` needs no change; all 34 existing files in `apps/extension/` stay green.
- **Do not touch:** `apps/extension/test/screenshot/extract-studio-styles.ts` and `apps/extension/test/screenshot/studio-swaps.ts`.
- **Proof:** `pnpm exec vitest run apps/extension/test/screenshot/studio-fixtures.test.ts`.

### 5. `styles.test.ts` allows any absent font whose filename matches `fontshareFiles`, regardless of directory — LOW
- **Location:** `packages/visual-system/test/styles.test.ts:97-105`
- **Attribution:** introduced. `git show 1ec9866e:packages/visual-system/test/styles.test.ts | grep -n fontshare` returns nothing; added in `82602465` (`creator-analytics#942 the Fontshare fonts come from a private repository at build time`).
- **Real-world trigger:** if `packages/visual-system/src/styles.css` writes a wrong relative directory for a Fontshare font (such as `url("../wrong-folder/Switzer-Variable.woff2")`), `source.startsWith('../')` is `true` and `basename(source)` matches `fontshareFiles`, so `styles.test.ts` passes even though `pnpm fonts` will never populate that path.

**Evidence**
```ts
// packages/visual-system/test/styles.test.ts:97-105
    for (const source of sources) {
      const present = await access(fileURLToPath(new URL(source, stylesheetUrl))).then(
        () => true,
        () => false,
      )
      const fontshare = (fontshareFiles as readonly string[]).includes(basename(source))
      // A path from the origin's root breaks under /app, where the web app's build puts its assets.
      expect({ source, relative: source.startsWith('../'), present: present || fontshare }).toEqual(
```

**Failure mode** — Any `../<wrong-dir>/Switzer-Variable.woff2` or `../<wrong-dir>/CabinetGrotesk-Variable.woff2` passes `styles.test.ts` because only `basename(source)` is checked against `fontshareFiles`.

**Recommended fix**
```diff
--- a/packages/visual-system/test/styles.test.ts
+++ b/packages/visual-system/test/styles.test.ts
@@ -3,10 +3,9 @@
 // translucent colour composited over the page, the blend along a gradient, or the grain overlay.
 // Nick checks the light and dark modes of the site and the web app in a real browser.
 import { access, readFile } from 'node:fs/promises'
-import { basename } from 'node:path'
 import { fileURLToPath } from 'node:url'
 import { describe, expect, test } from 'vitest'
-import { fontshareFiles } from '../src/fontshare.ts'
+import { fontshareFontPaths } from '../src/fontshare.ts'
 import {
   avoidedColoursNear,
   backgroundColoursIn,
@@ -95,11 +94,12 @@ describe('the visual system', () => {
 
     expect(sources.length).toBeGreaterThan(0)
     for (const source of sources) {
-      const present = await access(fileURLToPath(new URL(source, stylesheetUrl))).then(
+      const resolved = fileURLToPath(new URL(source, stylesheetUrl))
+      const present = await access(resolved).then(
         () => true,
         () => false,
       )
-      const fontshare = (fontshareFiles as readonly string[]).includes(basename(source))
+      const fontshare = fontshareFontPaths.has(resolved)
       // A path from the origin's root breaks under /app, where the web app's build puts its assets.
       expect({ source, relative: source.startsWith('../'), present: present || fontshare }).toEqual(
         {
```

**Remediation brief**
- **Design intent:** `styles.test.ts` ensures every font URL in `packages/visual-system/src/styles.css` is relative and either exists on disk or resolves to one of the exact Fontshare font files under `packages/visual-system/fonts/` (using `fontshareFontPaths` exported in Finding 1).
- **Full surface:** `packages/visual-system/test/styles.test.ts:6,9,97-105` (depends on `fontshareFontPaths` from Finding 1 in `packages/visual-system/src/fontshare.ts`).
- **Must preserve:** passes both with the Fontshare fonts present and with them absent; fails if `JetBrainsMono-Regular.woff2` or `JetBrainsMono-Medium.woff2` is absent, or if a Fontshare URL points outside `../fonts/`.
- **Do not touch:** the other eight tests in `packages/visual-system/test/styles.test.ts`.
- **Proof:** `pnpm exec vitest run packages/visual-system/test/styles.test.ts` (passes on clean tree, fails if `../fonts/Switzer-Variable.woff2` is mutated to `../other/Switzer-Variable.woff2`).

## Needs Further Investigation
None.

## Reviewed and Dismissed
- `@tailwindcss/vite` skipping PostCSS `withoutAbsentFonts` in `apps/web` — disproved by execution: a scratch Vite 8 + `@tailwindcss/vite` build and dev server both invoke `withoutAbsentFonts`, drop absent `@font-face` rules, emit the warning, and keep present faces.
- `LICENSE.md` diverging from upstream `FSL-1.1-ALv2.template.md` — verified via `gh api` at `85f3fc7e`: the only difference is replacing `${year} ${licensor name}` with `2026 NLVogel, LLC`.
- GitHub Action version-pin comments drifting from their commit SHAs — verified all four SHAs (`actions/checkout` `v4.3.1`, `pnpm/action-setup` `v4.3.0`, `actions/setup-node` `v4.4.0`, `tailscale/github-action` `v3.3.0`) against GitHub's tag refs API; all four match.
- Missing `"license": "FSL-1.1-ALv2"` in any workspace package — verified all 20 `package.json` files carry `"license": "FSL-1.1-ALv2"`.
- Leftover church domain, personal email, `/Users/nick/` home path, `fontLicences` symbol, `studio.css` tracking, or old Studio revenue/non-public values — verified clean across the tracked tree; the remaining `Playing Keys at Church` title in `apps/extension/test/fixtures/youtube/home-feed.html` and public `9SvyFna2XGM` fixtures in `youtube/` are explicitly accepted in #942 / PR #1125.
- `sampleSched` / `sampleUnlst` breaking `studio-swaps.ts:23` (`[\w-]{11}`) — both IDs are 11 characters and match cleanly; all 1113 extension tests pass.
- Unused `readFile` import in `apps/extension/test/screenshot/take-screenshots.ts:29` — still called at lines 441 and 444 (`promoTilePage`); Biome passes.
- `apps/api/Dockerfile` and `apps/worker/Dockerfile` `COPY . .` carrying `packages/visual-system/fonts/` into images — pre-existing on `main`, and GHCR visibility is explicitly out of scope for #942.
- `apps/site/vite.config.ts:198` `legalName: 'MIDLO WEB DESIGN, LLC'` vs `LICENSE.md` `NLVogel, LLC` — pre-existing schema.org metadata on `main`, untouched by this branch.

## Minor / nits
- `packages/visual-system/src/vite.ts:50`: `url\(\s*["']?(\.{1,2}\/[^"')?#]+)` includes trailing whitespace in an unquoted spaced `url( ../fonts/present.woff2 )` (proved in scratch test). Every CSS `url()` in the repo is double-quoted and Biome-formatted, so there is no reachable trigger today; changing `[^"')?#]+` to `[^"')?#\s]+` or trimming handles it if `vite.ts` is edited for Finding 1.
- `README.md:206-218`: the new `## License` section is flagged in PR #1125 as a draft for Nick to reword in his own voice before merge.

## Test quality
tests added: 2 (`packages/visual-system/test/vite.test.ts`) · tests modified: 2 (`packages/visual-system/test/styles.test.ts`, `apps/api/src/cloudflare-access.test.ts`) · green against `$BASE` (assert nothing new): 0 (static check: both `vite.test.ts` and `styles.test.ts` import new exports absent at `1ec9866e`; `$BASE` worktree execution not run per Antigravity review rules) · tautology shapes found: 0 · gaps found: `styles.test.ts:102` checks only `basename(source)` (Finding 5); `fetch-fonts-cli.ts` and `readStudioStyles()` have no tests for their new `try/catch` paths (Findings 2 and 4). `vite.test.ts` carries a `Limits:` header (`tests-state-a-rule`) and asserts on real Vite build output and warnings.

## Before opening the PR
- **CI readiness:** `actionlint`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `packages/visual-system`, `apps/api/src/cloudflare-access.test.ts`, `apps/extension` (1113 tests), and PR #1125 CI checks are all green.
- **Commit hygiene:** working tree had 0 uncommitted changes at start; only this review doc and its two repro files are untracked under `docs/reviews/creator-analytics-942/`.
- **Likely reviewer asks:** Nick's voice pass on `README.md`'s new `## License` section (already flagged in PR #1125); confirming Findings 1 and 2 are remediated before merge.

## Verdict
**Ready with follow-ups / fix Findings 1 and 2 before merge.** Zero CRITICAL or HIGH defects were found, and the cleanup scope of #942 is solid. Gate before merging PR #1125: remediate Finding 1 (scope `fonts()` dropping to Fontshare font paths only) and Finding 2 (validate all three files before copying in `fetch-fonts-cli.ts`, rethrow non-`ENOENT` errors, reject extra args, and add tests). Findings 3, 4, and 5 are LOW and can land in the same remediation pass or as follow-ups.

## Remediation — 2026-11-25
| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 1 (MEDIUM) | `ac214207` creator-analytics#942 pre-PR review 2 finding 1: fonts() dropped any absent font, not only the Fontshare ones | red→green: `node --test docs/reviews/creator-analytics-942/repro/review-2-non-fontshare-dropped.test.ts` families and url assertions pass; `pnpm exec vitest run packages/visual-system` 51 tests | 19 lines: two new doc blocks (the real-path compare, the test stand-in) and two existing doc comments rewritten to stay true | fixed, proved by execution |
| 2 (MEDIUM) | `5f4dc782` creator-analytics#942 pre-PR review 2 finding 2: the fetch script copied fonts before it checked the licence | red→green: `node --test --test-reporter=tap docs/reviews/creator-analytics-942/repro/review-2-fetch-fonts-cli.test.ts` 0 of 3, now 3 of 3; `pnpm exec vitest run packages/visual-system/test/fetch-fonts.test.ts` | 4 lines: one doc block (all or none, and why) | fixed, proved by execution |
| 3 (LOW) | — deferred | — | — | LOW tail, not in scope this round |
| 4 (LOW) | — deferred | — | — | LOW tail, not in scope this round |
| 5 (LOW) | — deferred | — | — | LOW tail, not in scope this round; same defect as review 1 finding 2 |

Finding 1 departs from the brief's diff in two places, both recorded in Approach decisions below. The repro's last assertion, no warnings at all, still fails: Vite's own "didn't resolve at build time" warning for the missing Roboto file is the base behaviour the finding restores, and `packages/visual-system/test/vite.test.ts` asserts the intent instead (no warning naming `pnpm fonts`). Must preserve was run: in a scratch worktree of `ac214207` with no Fontshare fonts, `pnpm build` exits 0 with 8 absent-font warnings, and `pnpm exec vitest run packages/visual-system apps/site/test/site.test.ts apps/web/test/web.test.ts` passes, 280 tests; with the fonts present, `apps/site/dist` and `apps/web/dist` are byte-identical to `main`'s.

Full checks after the round, at `5f4dc782`: `pnpm typecheck` and `pnpm lint` pass; `pnpm test` passes, 230 files, 6048 tests, 1 expected fail.

### Known regressions, deferred
- None.

## Approach decisions (remediation, 2026-11-25)
- Allowed-absent fonts: `withoutAbsentFonts(mayBeAbsent, onAbsent)` takes the predicate as a required first argument, with no default. A default of "drop anything" would keep the defect for a later caller. `fonts()` passes `isFontshareFont` from `fontshare.ts` and has no new option; the tests drive `withoutAbsentFonts` directly with a stand-in predicate.
- `isFontshareFont` compares through the real path of the file's folder, not the raw path: Vite names a stylesheet by its real path, so a raw compare misses under a symlinked folder (seen with macOS `/var` → `/private/var`). Review 1 finding 2's stylesheet test should use the same function when it is worked.
- Font fetch: `copyFontshareFiles` in `fontshare.ts` checks all three files before it copies any, rethrows non-ENOENT errors unchanged, and names the absolute source folder. A relative `--from` through pnpm still resolves against `packages/visual-system`; the error now shows that.
