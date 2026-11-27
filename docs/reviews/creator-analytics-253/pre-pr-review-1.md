# Pre-PR review: creator-analytics#253 Marketing site SEO: metadata, social cards, structured data and indexing

**Branch:** `creator-analytics-253-marketing-site-seo` vs `origin/main` (merge-base `d34e9f2` "creator-analytics#253 The OG image for the marketing site")
**Reviewed at:** HEAD `5d6debd` ("creator-analytics#271 Site: JSON-LD for Stillstats on the homepage"). The tree was clean, with no uncommitted or untracked files at review time. 19 files, +1,000 / −84, 13 commits.
**Reviewed against:** the epic creator-analytics#253 (its body is the spec), its children #168, #169, #269, #270 and #271 (#272 is Nick's Search Console step and carries no code), `CODING_STANDARDS.md` 1 to 3, ADR 0012, `README.md` and `docs/deploy.md`. No plan docs and no prior review of this branch. Run with `--fresh`.
**Date:** 2026-10-18
**Reviewer:** 2 code-review agents, 1 test-oracle agent, and a verify pass

## What was verified and how

| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | up to date, lockfile unchanged |
| Lint | `pnpm lint` | green, 469 files |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` | green |
| Full suite | `pnpm test` (Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | 110 files, 2,336 passed, 1 expected fail |
| The site's CSP names the hosts the build knows | `VITE_OPENPANEL_API_URL=https://op.example.com/api VITE_GLITCHTIP_DSN=https://key@gt.example.com/3 pnpm exec vite build --outDir <scratch>` in `apps/site` and `apps/web` | every site page, the 404 included, and the web app carry `connect-src 'self' https://op.example.com https://gt.example.com` |
| The web app's CSP is unchanged by the move into `visual-system` | Differential harness: the base's plugin (`loadEnv(mode, root, 'VITE_')`) against HEAD's `contentSecurityPolicy()` (Vite's resolved `env`), both through Vite 8.3.2 `resolveConfig(..., 'build')`, over 12 env cases (no env, each host alone, both, empty strings, ports and paths, development mode, `.env` and mode files, process env over `.env`, custom `envDir`, custom `envPrefix`) | byte-identical in all 10 cases apps/web can reach. Diverges only under a custom `envDir` or `envPrefix`, which neither app sets (Dismissed) |
| Built output | Read `apps/site/dist/*.html`, `robots.txt`, `sitemap.xml` | every required tag present on the four pages, none on the 404, CSP meta first in every head and inside the first 1,024 bytes, JSON-LD on the homepage only, robots.txt and sitemap match #270 |
| Plugin edge cases | `node docs/reviews/creator-analytics-253/repro/plugin-parsing.mjs` (calls the real plugin's `transformIndexHtml`) | findings 3 and 4 reproduced; a `</script><!--` in the description stays inside the JSON-LD block |
| Restore read races the load read (finding 1) | `pnpm exec vitest run --config docs/reviews/creator-analytics-253/repro/finding-1-stale-guard.vitest.config.ts` | red: the avatar and dashboard link stay hidden |
| Tautology audit | Branch tests copied into a scratch worktree at `d34e9f2` and run there; mutations M1b, M2b, M3 and M4 on a scratch checkout of `5d6debd` | every new test red at base except three "must not appear" tests, which mutation turned red; the moved CSP test passes at base once its import is pointed at the old path (a pure move) |
| Prior fix e33d137 is a real red to green | Its `main.test.ts` cases run against `453ef83` | red there, green after |
| Browser walk: no CSP report signed in and out, Back twice shows the avatar, the X and Slack previews | not run: no browser in this run | Needs Further Investigation A |

**Overall:** The branch does what the epic asks. Every page but the 404 states its canonical URL and preview tags from one origin, the build writes `robots.txt`, the sitemap and the homepage graph, every page carries the app's own policy, and a restored page reads the session again. All four CI checks are green. Nothing here is above LOW: one real race in the session check after Back, two quiet parsing gaps in the build plugin, some test and doc tidying, and one stale domain checklist. The PR can open now. The browser walk from #168 and #169 is still Nick's.

## Approach decisions

- Session check ordering (finding 1): an answer is retired only by a newer **decisive** answer (a user or a 401), never by a newer read that could not tell. The guard mirrors the prior fix e33d137 ("a page that cannot tell keeps the session it shows") and extends it to ordering.
- Session answer shape (finding 2): `signed-in.ts` returns a three-way answer, a user, `'signed out'` or `'unknown'`, so `main.ts` needs no flag set inside its fetch closure. It lands **after** finding 1 and keeps finding 1's guard semantics.
- Build plugin parsing (findings 3 and 4): a head the plugin cannot read exactly fails the build with a message that names the problem. It never guesses, normalises, or silently picks one of two values. This follows the plugin's existing missing-description `throw` in `pagePreviews`.
- Site test expectations (findings 5 and 7): an expected value is read from the served page, such as its canonical link, its hero `<img src>` or its `og:image`, not rebuilt with the build plugin's own formula or restated as a literal.

## Confirmed Issues

### 1. A failed session check after Back throws away the earlier answer that said the visitor is signed in — LOW
- **Location:** `apps/site/src/main.ts:103`
- **Attribution:** introduced by `453ef83` ("creator-analytics#169 Site: check the session again when a page comes back from the back-forward cache"). `git log -S'latestCheck' d34e9f2..HEAD` names only that commit. Base `main.ts` read `/api/me` once and had no guard.
- **Real-world trigger:** a signed-in visitor opens the homepage. The load read has not landed yet, either because the API is slow or because `document.fonts.ready` is still waiting on the web fonts, which the check awaits before it applies anything. The visitor then goes forward and back, and the page comes back from the back-forward cache. The restore's read gets a 5xx or a dropped connection. **LOW, capped:** the result is a confusing display, the page offering "Sign in with Google" to someone who is signed in, until the next reload. It needs two rare things at once. Upgrade to MEDIUM if production `/api/me` 5xx rates are high enough to make the second condition common (check GlitchTip and the API logs for `/api/me` 5xx), and if Chrome keeps such a page in the back-forward cache (Needs Further Investigation B).

**Evidence**
```ts
  await document.fonts.ready
  if (check !== latestCheck) return
  if (user) showSignedIn(user)
  else if (signedOut) showSignedOut()
```
**Failure mode** — Load read A (check 1) is pending. The persisted `pageshow` starts read B (check 2), and `latestCheck` becomes 2. B answers 500: `user` is null and `signedOut` is false, so B shows nothing. A then answers 200 with the user, but `1 !== 2`, so A returns too. The page stays in its built, signed-out state. Executed: `docs/reviews/creator-analytics-253/repro/finding-1-stale-guard.test.ts` expects `{ reads: 2, avatar: true, link: true }` and receives `avatar: false, link: false` (red).
**Recommended fix**
```diff
 let latestCheck = 0
+let latestShown = 0
@@
   await document.fonts.ready
-  if (check !== latestCheck) return
-  if (user) showSignedIn(user)
-  else if (signedOut) showSignedOut()
+  if (check < latestShown || (!user && !signedOut)) return
+  latestShown = check
+  if (user) showSignedIn(user)
+  else showSignedOut()
```
**Remediation brief**
- **Design intent:** `checkSession` numbers each `/api/me` read. Only a 200 with a user or a 401 is decisive. A 5xx, a 429, a dropped connection or an unreadable body cannot tell, and the page keeps what it shows (prior fix e33d137). The rule this finding adds: an answer is retired only when a newer read has actually been **shown**. A newer read that could not tell retires nothing.
- **Full surface:** `apps/site/src/main.ts:85-108` (`latestCheck`, `checkSession`). A new case in `apps/site/src/main.test.ts` in the `describe('a homepage shown again from the back-forward cache')` block, after the test at `:265`: the load read is deferred and answers 200, the restore read answers 500, and the avatar and dashboard link show. Shape it on the repro.
- **Must preserve:** in `apps/site/src/main.test.ts`, "an answer that arrives after a newer one changes nothing" (an older 401 after a newer 200 is ignored: `1 < latestShown = 2`); the `test.each` "a page left signed in keeps its avatar and dashboard link when /api/me answers 500 / 429 / cannot be reached"; "a page left signed in, and signed out since, gives the hero its sign-in back"; and one read on a pageshow that is not a restore. **Dropping intended:** an older decisive answer that lands while a newer read is still out now shows until the newer one answers, where today it is thrown away. Both are true answers at the time they land, and the newer one still wins.
- **Do not touch:** the `await document.fonts.ready` before the guard. It keeps the button's width measured after the font swap (see Reviewed and Dismissed).
- **Proof:** `pnpm exec vitest run --config docs/reviews/creator-analytics-253/repro/finding-1-stale-guard.vitest.config.ts` is red now and must be green after. Then `pnpm exec vitest run apps/site/src/main.test.ts`.

### 2. The session check reads a 401 through a flag beside a helper whose comment says a page that cannot tell stays signed out — LOW
- **Location:** `apps/site/src/signed-in.ts:18-33`, `apps/site/src/main.ts:92-96`, `apps/site/src/signed-in.test.ts:17`
- **Attribution:** introduced. The comment at `signed-in.ts:19-20` is unchanged from base (`git show d34e9f2:apps/site/src/signed-in.ts`, line 20), but `453ef83` and `e33d137` changed the behaviour it describes. Standard 1 (a stale load-bearing comment) and standard 3 (the walked-past refactor).
- **Real-world trigger:** no user path. A maintainer who reads "a page that cannot tell stays signed out" and "fixes" `main.ts` to sign out on `null` brings back the defect e33d137 fixed.

**Evidence**
```ts
 * The user GET /api/me answers for, or null on a 401, any other failure, or a body that does not
 * read as a user. It never throws, because a page that cannot tell stays signed out.
```
```ts
  const user = await signedInUserOf(async () => {
    const response = await fetch('/api/me')
    signedOut = response.status === 401
    return response
  })
```
**Failure mode** — `signedInUserOf` folds a 401 and every failure into one `null`, so `main.ts` sets `signedOut` inside the fetch closure to tell them apart. The comment states the rule main.ts no longer follows, and `signed-in.test.ts:17` ("a 401, or any other status but 200, gives no user") pins the two-way shape main.ts has to work around.
**Recommended fix** — In `signed-in.ts`:
```ts
export type Session = SignedInUser | 'signed out' | 'unknown'

export async function sessionOf(fetchMe: () => Promise<Response>): Promise<Session> {
  try {
    const response = await fetchMe()
    if (response.status === 401) return 'signed out'
    if (response.status !== 200) return 'unknown'
    const body: unknown = await response.json()
    return isSignedInUser(body) ? body : 'unknown'
  } catch {
    return 'unknown'
  }
}
```
In `main.ts`, after finding 1's fix:
```ts
  const session = await sessionOf(() => fetch('/api/me'))
  await document.fonts.ready
  if (session === 'unknown' || check < latestShown) return
  latestShown = check
  if (session === 'signed out') showSignedOut()
  else showSignedIn(session)
```
Replace the doc comment with one that states the three answers and why a page keeps its session on `'unknown'`.
**Remediation brief**
- **Design intent:** `/api/me` has three answers for the site: a user, signed out (a 401 only), and cannot tell (any other status, a rejected fetch, or a 200 body that is not a user). The page shows the first two and keeps what it shows on the third.
- **Full surface:** `apps/site/src/signed-in.ts:18-33`; `apps/site/src/main.ts:3` (the import), `:85-108`; `apps/site/src/signed-in.test.ts:10-30` (rewrite the 401 versus 500 case into two tests: a 401 gives `'signed out'`, any other status gives `'unknown'`). `grep -rn signedInUserOf apps packages` finds no other caller.
- **Must preserve:** finding 1's guard and its new test; every case in the `describe('a homepage shown again from the back-forward cache')` block of `apps/site/src/main.test.ts`; a 200 whose body is not a user still changes nothing on the page (today: `null` with `signedOut` false).
- **Do not touch:** `isSignedInUser`.
- **Proof:** `pnpm exec vitest run apps/site/src/signed-in.test.ts apps/site/src/main.test.ts` and `pnpm exec vitest run --config docs/reviews/creator-analytics-253/repro/finding-1-stale-guard.vitest.config.ts`, all green.

### 3. A named character reference other than the five basic ones reaches the link preview as literal text — LOW
- **Location:** `apps/site/vite.config.ts:76-92` (`decodedOf`)
- **Attribution:** introduced by `54e51b2` ("creator-analytics#269 Site: every page tells a search engine and a link preview what it is").
- **Real-world trigger:** a title or description written with `&rsquo;`, `&nbsp;` or `&hellip;`. **LOW, capped:** no page writes any character reference today (`grep -oh '&[a-zA-Z]\+;' apps/site/*.html apps/site/partials/*.html` finds none), and the result is a display defect. Upgrade to MEDIUM if a page's head ever uses one.

**Evidence**
```ts
    /&(?:#(\d+)|#x([\da-f]+)|(amp|quot|apos|lt|gt));/gi,
    ...
      return characterReferences[(name ?? '').toLowerCase()] ?? ''
```
**Failure mode** — `&rsquo;` does not match, so it passes through as is. Vite's `serializeAttrs` escapes the `&` again, and the tag reads `&amp;rsquo;`, so X, Slack and the JSON-LD description show "&rsquo;". Executed: `node docs/reviews/creator-analytics-253/repro/plugin-parsing.mjs` prints `og:description="It&rsquo;s fine &hellip; ok"` for the first case. The doc comment ("Text with its HTML character references decoded") claims every reference, and the `?? ''` fallback can never run, because the regex captures only names the map holds.
**Recommended fix**
```diff
-    /&(?:#(\d+)|#x([\da-f]+)|(amp|quot|apos|lt|gt));/gi,
+    /&(?:#(\d+)|#x([\da-f]+)|([a-z][a-z\d]*));/gi,
@@
-      return characterReferences[(name ?? '').toLowerCase()] ?? ''
+      const character = characterReferences[(name ?? '').toLowerCase()]
+      if (character === undefined) {
+        throw new Error(`&${name}; is a character reference the build does not decode: write the character itself.`)
+      }
+      return character
```
Correct the doc comment at `:79-82` to say that the five basic named references and numeric ones are decoded, and that any other named reference fails the build.
**Remediation brief**
- **Design intent:** a page writes its title and description as HTML. The plugin hands Vite decoded text, because Vite escapes attribute values itself. Text the plugin cannot decode must fail the build rather than ship double-escaped.
- **Full surface:** `apps/site/vite.config.ts:68-92` (`characterReferences`, `decodedOf`) and its doc comment. Callers: `:99` (`descriptionOf`) and `:136` (`og:title`). Both inherit the fix.
- **Must preserve:** `&amp;`, `&quot;`, `&apos;`, `&lt;`, `&gt;` and numeric references decode as today. Every case in `apps/site/test/site.test.ts`, `describe('seam 1: what a page tells a search engine and a link preview')`. **Changed on purpose:** an unknown named reference, passed through today, now throws.
- **Do not touch:** the JSON-LD `<` escape at `:219` (Reviewed and Dismissed).
- **Proof:** `node docs/reviews/creator-analytics-253/repro/plugin-parsing.mjs` prints `throws Error &nbsp; is a character reference ...` for "finding 3" after the fix. Then `pnpm --filter @creator-analytics/site build` and `pnpm exec vitest run apps/site/test/site.test.ts`.

### 4. The build plugin can take the wrong description or ship a title's line breaks, with no error — LOW
- **Location:** `apps/site/vite.config.ts:94-100` (`descriptionOf`), `:115-116`
- **Attribution:** introduced by `54e51b2`.
- **Real-world trigger:** none today: every page writes one single-line `<title>` and one `<meta name="description">`. **LOW, capped:** upgrade to MEDIUM if a page or partial ever gains a second description meta or a `data-name="description"` attribute, since the preview would then silently show the wrong text.

**Evidence**
```ts
    .find((tag) => /\bname="description"/.test(tag))
...
      const title = /<title>([^<]*)<\/title>/.exec(html)?.[1]
```
**Failure mode** — Executed with `node docs/reviews/creator-analytics-253/repro/plugin-parsing.mjs`:
- `<meta data-name="description" content="WRONG">` before the real description gives `og:description="WRONG"`, because `-` is a word boundary.
- A title written across lines gives `og:title="\n  Two\n  lines\n"`. A browser collapses that whitespace in `<title>`, but a preview reads the attribute as written.
- A second description gives `og:description="first"`, and nothing says a page wrote it twice. That breaks "each page states its description once" (#269).

**Recommended fix**
```diff
 function descriptionOf(html: string): string | undefined {
-  const meta = [...html.matchAll(/<meta\b[^>]*>/g)]
-    .map(([tag]) => tag)
-    .find((tag) => /\bname="description"/.test(tag))
+  const metas = [...html.matchAll(/<meta\b[^>]*>/g)]
+    .map(([tag]) => tag)
+    .filter((tag) => /\sname="description"/.test(tag))
+  if (metas.length > 1) throw new Error('A page states its <meta name="description"> once.')
+  const [meta] = metas
   const content = meta && /\bcontent="([^"]*)"/.exec(meta)?.[1]
-  return content === undefined ? undefined : decodedOf(content)
+  if (content?.includes('\n')) throw new Error('A page writes its description on one line.')
+  return content === undefined ? undefined : decodedOf(content)
 }
```
Apply the same checks to the title at `:115`: throw when `html.match(/<title>/g)` finds more than one, or when the title holds a newline.
**Remediation brief**
- **Design intent:** a page's head is the one source of its title and description (#269: "each page writes its title and its description once"). The plugin reads it exactly or fails the build with a message naming what to change. It does not normalise, because the site test compares `og:title` and `og:description` with the raw `<title>` and meta (`apps/site/test/site.test.ts:540-556`, `:693-700`). Normalised text would differ from those raw values, and the test would go red on a correct page.
- **Full surface:** `apps/site/vite.config.ts:94-100`, `:115-121`. `homepageStructuredData` at `:212` calls the same `descriptionOf` and inherits the fix.
- **Must preserve:** the missing-title and missing-description error at `:117-121`; the plugin order `siteIncludes` (`order: 'pre'`) then `pagePreviews`, so a description that comes from an expanded partial is counted; every case in `apps/site/test/site.test.ts`.
- **Do not touch:** the 404 skip (`cleanPathOf` returns `null`). The 404 needs no description.
- **Proof:** after the fix, `node docs/reviews/creator-analytics-253/repro/plugin-parsing.mjs` prints `og:description="right"` for the data-name case, and `throws` for the multi-line title and the second description. Then `pnpm --filter @creator-analytics/site build` and `pnpm exec vitest run apps/site/test/site.test.ts`.

### 5. The homepage graph test restates fixed copy, and passes when the screenshot it names no longer exists — LOW
- **Location:** `apps/site/test/site.test.ts:653-691`, `apps/site/vite.config.ts:49-50`
- **Attribution:** introduced by `82dabb4` ("creator-analytics#271 Site: JSON-LD for Stillstats on the homepage").
- **Real-world trigger:** the hero screenshot is renamed, for example to `app-screenshot-2.webp`, in `index.html` and `public/`. `appScreenshotPath` keeps the old name, so the JSON-LD points at a 404. The hero test at `:899` passes, because it reads the new `src`. This test passes too, because it restates the old literal. No user sees it. **LOW.**

**Evidence**
```ts
          name: 'Stillstats',
          legalName: 'MIDLO WEB DESIGN, LLC',
...
          image: `${productOrigin}/og-image.png`,
          screenshot: `${productOrigin}/app-screenshot.webp`,
```
**Failure mode** — Standard 2 bans a copy test, and `name` (three times) and `legalName` restate literals from `homepageGraph` (`vite.config.ts:172-195`). The epic's Testing Decisions holds copy by approval, not by the suite. The `image` and `screenshot` lines restate the plugin's constants rather than reading what the page serves, so they move with the constant and miss the drift above. #271's Done when ("holding the three nodes with the values above") conflicts with standard 2 for the two name fields. The standard and the epic's own Testing Decisions win for copy. The schema.org values (`@type`, `applicationCategory`, `operatingSystem`, `offers`) are structure, not copy, and stay.
**Recommended fix** — In the test, drop `name` and `legalName` from the three nodes. Replace the literal `image` with the page's own `metaContentsOf(html, 'og:image')[0]`, and the literal `screenshot` with the hero `<img>` `src` resolved on the origin (`new URL(src, productOrigin).href`, with `src` read as at `:903-909`). Then a renamed screenshot fails the test until the plugin follows.
**Remediation brief**
- **Design intent:** the site test reads what a crawler gets and pins rules, never copy (standard 2; epic Testing Decisions). The JSON-LD's `image` is the preview image, and its `screenshot` is the hero's screenshot. Both rules read from the served page.
- **Full surface:** `apps/site/test/site.test.ts:651-691` (the test and the comment above it, which says "The values are the graph creator-analytics#271 sets"; restate it as the rules it pins). `homepageStructuredData` at `:640-648` already returns the `html` needed.
- **Must preserve:** the graph length of 3, the `@type`s, `@id`s and `publisher` links, `offers` with `price: '0'` as a string, and the other tests in `describe('seam 1: the homepage structured data')`.
- **Do not touch:** `appScreenshotPath` in `vite.config.ts`. The test now catches its drift, and reading the `src` in the plugin is optional extra work, not part of this finding.
- **Proof:** `pnpm exec vitest run apps/site/test/site.test.ts -t "homepage graph"` is green. Change `appScreenshotPath` to `'/app-screenshot-x.webp'` locally: it goes red. Revert.

### 6. The sitemap test builds its expected list with the build's own formula — LOW
- **Location:** `apps/site/test/site.test.ts:793-796`
- **Attribution:** introduced by `bc76443` ("creator-analytics#270 Site: serve robots.txt and a sitemap").
- **Real-world trigger:** none for users. A canonical link and its sitemap entry could drift apart, for example if the canonical gained a trailing slash, and both tests would stay green, each on its own copy of the formula. #253 user story 10 asks for "the canonical URL, `og:url`, the sitemap and the JSON-LD to come from one origin, so that they can't disagree". **LOW.**

**Evidence**
```ts
    const canonicalUrls = (await pagesAtCleanPaths())
      .map(({ path }) => path)
      .sort()
      .map((path) => `${productOrigin}${path}`)
```
**Failure mode** — The expected list is `origin + clean path`, sorted: the same steps as `crawlerFiles` (`vite.config.ts:260-264`). #270's Done when asks for "exactly the canonical URLs of the pages the test enumerates". The test never reads a page's canonical link.
**Recommended fix** — Build the expected list from the served pages: `(await servedSite(web)).pages.filter(({ path }) => path !== notFoundPath).flatMap(({ html }) => hrefsOf(html, 'canonical').map(decodedOf)).sort()`.
**Remediation brief**
- **Design intent:** a sitemap entry is a page's canonical URL. The test pins that the two agree, and the sort pins the order #270 sets (`/` first, then the rest by name).
- **Full surface:** `apps/site/test/site.test.ts:785-804`.
- **Must preserve:** the status, the content type, the `urlset` namespace and the no-`lastmod`/`changefreq`/`priority` assertions in the same test.
- **Do not touch:** `pagesAtCleanPaths`. Other tests use it.
- **Proof:** `pnpm exec vitest run apps/site/test/site.test.ts -t "sitemap"` is green.

### 7. The domain checklist in the deploy doc misses the constant that now carries the origin — LOW
- **Location:** `docs/deploy.md:77-84`
- **Attribution:** pre-existing, exposed. `productOrigin` existed at base in `apps/extension/src/manifest.ts` and the list never named it. This branch moves it to `packages/api-types/src/origin.ts` and makes it drive the canonical URLs, `og:url`, the preview image, the sitemap, `robots.txt` and the JSON-LD.
- **Real-world trigger:** a domain move done from this checklist. The site would ship canonical URLs, a sitemap and previews on the old domain, and the extension would call the old API. **LOW, capped:** no domain move is planned.

**Evidence** — `Every setting below names that origin, so a domain change touches each of them:` is followed by Cloudflare, Dokploy, `BETTER_AUTH_URL`, Google, RISC and OpenPanel, with no code constant.
**Recommended fix** — Add a bullet after the OpenPanel one: "- The code: `productOrigin` in `packages/api-types/src/origin.ts` gives the extension its API origin and the site its canonical URLs, preview tags, sitemap, `robots.txt` and structured data, so a change needs a new build of the site and the extension."
**Remediation brief**
- **Design intent:** the checklist lists everything a domain change touches.
- **Full surface:** `docs/deploy.md:78-84`.
- **Must preserve:** the existing bullets.
- **Do not touch:** nothing.
- **Proof:** `grep -n 'origin.ts' docs/deploy.md` finds the bullet. Make sure the bullet has no em-dash.

### 8. The screenshot script still writes the origin out by hand on a line the move walked past — LOW
- **Location:** `apps/extension/test/screenshot/take-screenshots.ts:477`
- **Attribution:** pre-existing, exposed. The literal is at base. This branch imports `productOrigin` into the file (`:26`) and uses it at `:115` and `:126`, but leaves this line. Standard 3.
- **Real-world trigger:** none until the origin changes. Then the stub would stop answering the background's reads, and the store screenshots would be taken against a dead API. **LOW.**

**Evidence**
```ts
    if (url.startsWith('https://stillstats.com/')) {
```
**Recommended fix** — ``if (url.startsWith(`${productOrigin}/`)) {``
**Remediation brief**
- **Design intent:** one origin (#269), read from `@creator-analytics/api-types`.
- **Full surface:** `apps/extension/test/screenshot/take-screenshots.ts:477`. `grep -rn "https://stillstats.com" apps/extension/src apps/extension/test` also finds `apps/extension/test/manifest.test.ts:76,134` and `apps/extension/src/first-run.test.ts:266`. Leave those three: they are the only tests that pin the origin's **value** (Reviewed and Dismissed).
- **Must preserve:** the script's behaviour. It is not run by `pnpm test`.
- **Do not touch:** the extension test files named above.
- **Proof:** `pnpm typecheck` is green, and `grep -n "'https://stillstats.com/'" apps/extension/test/screenshot/take-screenshots.ts` finds nothing.

### 9. Comment hygiene — LOW (aggregated)
- `README.md:122` — "The site (`apps/site`) reads the same two variables at build time." → "The site (`apps/site`) reads the same two variables at build time, and `VITE_GLITCHTIP_DSN` only to name its host in the pages' content security policy."
- `README.md:122` — "Every site page asks `GET /api/me` once on load;" → "Every site page asks `GET /api/me` on load, and again when the back-forward cache restores it;"
- `apps/site/vite.config.ts:57-58` — "The path the API serves a page at, the same mapping as its static rewrite," → "The path the API serves a page in the package root at, the same mapping as its static rewrite,"
- `packages/visual-system/src/vite.ts` (the `contentSecurityPolicy` doc comment) — "Vite's resolved `env` holds the same VITE_ values, the process's included, that `loadEnv` would return." → "With the default `envDir` and `envPrefix`, Vite's resolved `env` holds the same VITE_ values, the process's included, that `loadEnv` would return."

## Needs Further Investigation

### A. The browser walk from #168 and #169 — confirmed only by a browser
No CSP report on any site page signed in and signed out, with OpenPanel enabled. Sign in from the homepage, Back twice, and the homepage shows the avatar and "Open your dashboard". The X card validator and Slack show the preview. The build output and the tests support all three, but none ran in a browser here. This is the epic's own human step.

### B. Whether a browser keeps a page in the back-forward cache while its load read or font load is still out
Settles finding 1's attainability. Chrome and Firefox have both treated in-flight network requests as a reason to evict or skip the cache at various times. If neither keeps such a page, finding 1 needs a page whose load read is done but which is still waiting on `document.fonts.ready`, which narrows it further. Check: in Chrome DevTools, Application, Back/forward cache, "Test back/forward cache" on a throttled homepage load.

## Reviewed and Dismissed

- The CSP plugin reads Vite's resolved `env` instead of calling `loadEnv`. The differential harness gives byte-identical policies for every env source apps/web can reach. It diverges only under a custom `envDir` or `envPrefix`, which neither app sets, and there HEAD agrees with what `import.meta.env` gives the SDKs.
- The CSP meta comes before `<meta charset>`. The charset still sits inside the first 1,024 bytes, as the HTML standard requires (read on `dist/index.html`).
- A `</script>` or `<!--` in the description, inside the JSON-LD block. The `<` to `<` escape at `vite.config.ts:219` keeps both inside the block (harness). Do not remove it.
- Attribute values in the injected tags. Vite 8.3.2's `serializeAttrs` escapes them (`&quot;`, `&#39;` in `dist/index.html`).
- The `await document.fonts.ready` before the guard in `checkSession`. It keeps the link's width measured after the font swap, so nothing moves. Load-bearing.
- Inline styles under `style-src 'self'`. `main.ts:62` sets `link.style.inlineSize` through the CSSOM, which the policy allows. The site test pins that no page has an inline style.
- OpenPanel script injection under `script-src 'self'`. The SDK injects a script only for session replay, which is off.
- GlitchTip's host in the site's `connect-src`, though the site reports no errors. #168 allows the hosts the build knows, and the policy is one policy for both apps on purpose.
- The site tests build their expected origin from `productOrigin` (mutation M4 showed a wrong origin value passes them). The spec wants exactly that: the site test reads the one origin (#253 Implementation Decisions). The extension tests at `apps/extension/test/manifest.test.ts:76,134` and `apps/extension/src/first-run.test.ts:266` pin the value. Keep them hard-coded.
- The three tests green at base ("no site page has an inline script or an inline style", "the 404 page has no canonical URL and no og: or twitter: tags", "no page but the homepage carries a JSON-LD block"). They are "must not appear" rules, and mutations M3, M1b and M2b each turned one red. Keep all three.
- The moved CSP test passes at base once its import is pointed at the old path. It is a pure move of the function's own test, and moving it with the function is correct.
- `robots.txt` ends in a newline that #270's code block does not show. A text file ends in one, and every crawler reads it the same.
- The dev server serves no `robots.txt` or sitemap. `crawlerFiles` is `apply: 'build'`, and only the built site is ever crawled.
- `robots.txt` and the sitemap answer with the right type. Hono's mime table gives `text/plain; charset=utf-8` and `application/xml; charset=utf-8`, and the site test pins both.
- `README.md` and `docs/deploy.md` on the CSP and `VITE_GLITCHTIP_DSN`. Accurate, apart from the `README.md:122` entries in finding 9.

## Minor / nits

- `apps/site/src/main.ts:81` removes `notice-agreed` from whatever follows the button. `showSignedIn` at `:65` adds it only to a `.notice`. Harmless with today's markup.
- `apps/site/src/main.test.ts:190` also asserts that a pageshow that is not a restore does not read again, which is a second rule. It could be its own test.
- `apps/site/vite.config.ts:212-217`: `homepageStructuredData` parses the description again, and its throw cannot fire while `pagePreviews` runs first on the same condition.
- `apps/site/vite.config.ts`: a `>` inside the description, an attribute on `<title>`, or single-quoted attributes throw "needs a <title> and a <meta name=\"description\">" though the page has both. `&#x110000;` throws a raw `RangeError`.
- `canonicalUrlOf` concatenates, where `urlOnOrigin` serializes through `URL`. Same output for today's paths.
- `site.test.ts`: `pngSizeOf` does not check the PNG signature or the `IHDR` chunk type. The CSP ordering test checks scripts and stylesheets but not every `<link>`. `img-src` and `form-action` are not pinned on site pages. The robots `Allow` match is case-sensitive where its neighbours lower-case. The JSON-LD URL rule reads a fixed key list (`@id`, `url`, `image`, `screenshot`).

## Test quality

Tests added or changed: 8 in `apps/site/src/main.test.ts` (the 3-case `test.each` counted once), 17 new and 1 modified in `apps/site/test/site.test.ts`, and 9 moved in `packages/visual-system/test/content-security-policy.test.ts`. **Green against `$BASE`:** 3 "must not appear" tests, each turned red by a mutation (keep), and the moved CSP test once rewired, a pure move (keep). Every other new test is red at base and green on the branch. The prior fix e33d137's cases are a real red to green. **Tautology shapes found:** 2. The sitemap test rebuilds its expectation with the build's formula (finding 6). The homepage graph test restates copy and two constants (finding 5). There are no mocked units under test (the mocked `fetch` is the network boundary), no snapshots, no assertion-free tests and no prose tests. Both test files state their limits (happy-dom has no layout, no fonts and no back-forward cache).

## Before opening the PR

- **CI readiness:** `pnpm lint`, `pnpm typecheck`, `pnpm build` and `pnpm test` are all green at `5d6debd`.
- **Commit hygiene:** commit this doc and `repro/`. Nothing else is in the tree.
- **Likely reviewer asks:** the browser walk (A); a screenshot of the X and Slack previews; that `noindex` and `X-Robots-Tag` stay until #254; #272 (Nick submits the sitemap after the deploy).

## Verdict

**Ready to open a PR, with follow-ups.** Nothing blocks it: all nine confirmed findings are LOW. Findings 1 and 2 (the session check) are the ones worth fixing before merge, because they are the feature #169 exists to deliver. Findings 3 to 9 can go in the same remediation round or become follow-up tickets. The browser walk (Needs Further Investigation A) is still Nick's, as the epic says.
