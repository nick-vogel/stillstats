# Pre-PR review: creator-analytics#253 Marketing site SEO, the follow-ups #254 and #478

**Branch:** `creator-analytics-253-marketing-site-seo` vs `origin/main` (merge-base `a72b6bc` "Merge pull request #484 from nick-vogel/creator-analytics-253-marketing-site-seo")
**Reviewed at:** HEAD `428d570` ("creator-analytics#254 Remove noindex and X-Robots-Tag once Google approves OAuth verification"). The tree was clean, with no uncommitted or untracked files at review time. 8 files, +120 / −16, 5 commits: 2 lane commits `afd8890` (#254) and `045bba4` (#478), their merge commits `428d570` and `bf47339`, and `a251995` (the epic branch merged into the #254 lane).
**Reviewed against:** the epic creator-analytics#253 (its body is the spec), its open children #254 and #478 (#478's approved copy, word for word), #34's closing comments (Google approved the OAuth verification on 2026-10-26, scopes `yt-analytics-monetary.readonly` and `youtube.readonly`), the recorded decisions in `.epic-loop/tickets/254/assumptions.md` and `.epic-loop/tickets/478/assumptions.md`, `CODING_STANDARDS.md` 1 to 3, ADR 0012, and pre-PR review 3 (`pre-pr-review-3.md`, its Approach decisions, finding 2 and its dismissals in full). Run with `--fresh`, so the whole surface against `origin/main` is in scope. The work review 3 covered merged to `main` in PR #484 (`a72b6bc`) and sits outside this surface.
**Date:** 2026-11-06
**Reviewer:** 1 code-review agent, 1 test-oracle agent, and a verify pass

## What was verified and how

| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` at `428d570` | Already up to date |
| Lint | `pnpm lint` (biome, 561 files) | Green |
| Typecheck | `pnpm typecheck` | Green |
| Build | `pnpm build` | Green |
| Test | `pnpm test` | Green: 131 files, 3116 passed, 1 expected fail. No timeout, no flake |
| Browser walk | `pnpm run --if-present test:browser` | Green: no content security policy violation in 39 steps |
| Base oracle | HEAD's `apps/site/test/site.test.ts` run in a scratch worktree at `a72b6bc` | The robots meta test, the site X-Robots-Tag test and the extension block test are red at base; the web app and API noindex test is green at base, as a guard of behaviour base already had |
| Mutants M1 to M9 | Scratch worktree at HEAD: `keptOutOfSearch` always true, always false, no exact prefix match, `startsWith(prefix)`, no `/health`; store links swapped; block moved after the privacy points; Firefox href changed; robots meta put back | All 9 killed, each by the test meant to catch it |
| Mutant M10 | Block moved above the "Honest numbers" points, through `repro/review-4-finding-2-placement-mutant.mjs` | **Survives**: the extension test stays green (finding 2) |
| Hono path and error semantics | Finder's throwaway harness on the repo's hono 4.13.12, same middleware and predicate | Router and predicate agree on every path tried, error paths and HEAD included (Dismissed) |
| Approved copy | The #478 block against the issue's Approved copy | Word for word; Chrome first; no em-dash |
| Stale noindex prose | `git grep -n -i "noindex\|x-robots"` outside `docs/reviews` and `.epic-loop` | Only the two comments in finding 3 |
| Stale verification copy | `git grep -n -i "beta\|verif" -- apps/site/*.html apps/site/partials`; #34's comments | The homepage beta note and the footer FAQ still say Google has not verified Stillstats (finding 1) |
| Post-deploy header and indexing | `curl -sI https://stillstats.com/`, Search Console URL Inspection | Not run: needs the deploy, and Search Console is Nick's (Needs Further Investigation A) |

**Overall:** Both tickets do what their Done when asks. The site's pages, 404, assets, `robots.txt` and `sitemap.xml` carry no robots meta tag and no `X-Robots-Tag`. The web app, the API and `/health` keep `X-Robots-Tag: noindex`, and nine mutants prove the tests hold that split. The homepage shows #478's approved extension block with both store links in graph order. Every full check is green. One MEDIUM: the homepage beta note and the footer FAQ on every page still say Google has not verified Stillstats and caps it at 100 creators. That copy predates this branch, but the branch is the one that sends it to search engines. Its fix is copy Nick has to approve, so it is a follow-up ticket, not a remediation item. Two LOW findings remain: the extension test's placement check, and a small comment batch.

## Approach decisions

- Carried from review 3, unchanged: session check ordering (#287), the session answer shape proposal, focus across a restore (#289, `swapKeepingFocus`), focus when a restore removes an element (#307, the header wordmark), "focus elsewhere stays" owned by one test, the one `freeOffer` value, and site test expectations read from the page, the issue's approved literal, or the outside source the rule names, never rebuilt with the helper the code under test calls.
- Indexing scope (#254, new): the static site carries no robots meta and no `X-Robots-Tag`; the web app (`webAppPath` and below), the API (`/api` and below) and `/health` keep `X-Robots-Tag: noindex`. `robots.txt` stays `Allow: /`, so a crawler can see that header. This is a recorded, reversible assumption (`.epic-loop/tickets/254/assumptions.md`). It departs from #254's literal "Remove the `X-Robots-Tag: noindex` header" and meets its Done when, which asks only about `https://stillstats.com/`. Nick confirms or reverses it on the PR.
- Header placement (#254, new): one global `app.use` with the `keptOutOfSearch` path predicate, not `app.use('/app/*')` and `app.use('/api/*')`, so the route inventory in `apps/api/src/sign-in.test.ts` keeps one `ALL /*` entry.
- Site copy (new, finding 1): visible copy is approved word for word by Nick on its issue. No remediation round writes it; a finding about copy files a ticket that carries proposed wording for his approval.
- Extension block test (new, finding 2): the page's store links are held equal to the served graph's `installUrl`, an outside source, in order. Placement is a separate rule with its own test, anchored on the end of the differentiators points list and on the privacy heading.

## Prior-review closure

Run with `--fresh` on round 1, so this is context, not a gate. Review 3 had 4 confirmed findings, all LOW. **Finding 2 is fully fixed** by #478 (`045bba4`): the homepage now shows and links the extension its graph marks up, and `grep -c 'addons.mozilla.org' apps/site/dist/index.html` counts the visible link besides the JSON-LD. **Findings 1, 3 and 4 are untouched.** They sit on `main` since PR #484 and outside this surface: `grep -n freeOffer apps/site/vite.config.ts` prints nothing. Nothing was "resolved" by editing only a comment.

## Confirmed Issues

### 1. Every page still tells a visitor that Google has not verified Stillstats and caps it at 100 creators, and this branch sends that to search engines — MEDIUM

- **Location:** `apps/site/index.html:23-26` (the homepage beta note under "Sign in with Google"); `apps/site/partials/footer.html:30-37` (the footer FAQ entry, on every page)
- **Attribution:** pre-existing, exposed. Both texts come from `3e681a5` ("creator-analytics#31: write the homepage content and the footer FAQ") and are on the base: `git show a72b6bc:apps/site/index.html | grep -c "Until Google verifies"` and `git show a72b6bc:apps/site/partials/footer.html | grep -c "waiting for Google's verification"` each print 1. This branch is the ticket that acts on the approval, and it lifts `noindex` from the pages that carry the claim, so the claim now reaches search results and the Search Console indexing request #254 asks for.
- **Real-world trigger:** any visitor to any page, today and after the deploy. Google approved the verification on 2026-10-26 (#34, comment of 2026-11-02, project `creator-analytics-510701`, both scopes). A verified app shows no unverified-app warning and has no 100-user cap. The repository holds no cap of its own: `git grep -n -i "100 creators\|room for"` finds only these two texts, and the FAQ itself says the cap is Google's ("That is why the beta has room for 100 creators"). Both sentences are false for every reader. A creator who reads them expects a warning screen and may assume the beta is full. MEDIUM is the ceiling for a misleading display; it is not a wrong number delivered by the product.

**Evidence**

```html
<p class="beta-note">
  The beta has room for 100 creators. Until Google verifies Stillstats, Google shows a
  warning when you connect a channel.
</p>
```

```html
<summary>Why does Google show a warning when I connect a channel?</summary>
<p>
  Stillstats is waiting for Google's verification. Until it passes, Google warns you that it
  has not verified the app when you connect a channel, and it lets only 100 people connect
  one. That is why the beta has room for 100 creators.
</p>
```

**Failure mode:** a reader is told that a warning screen and a 100-creator cap exist when neither does. No test pins either text, by `CODING_STANDARDS.md` 2's ban on copy tests, so the suite cannot catch it. Proved by the grep above and #34's approval comment.

**Recommended fix:** do not edit copy in a remediation round. File a ticket under #253 that quotes both texts and proposes wording for Nick to approve, and land it before the Search Console indexing request #254 asks for, so Google's first crawl of an indexable page reads current copy. One proposal, with no em-dash: remove the homepage `.beta-note` paragraph and the footer FAQ entry "Why does Google show a warning when I connect a channel?". Whether the beta keeps a cap of its own, and whether "Open now, in the beta." (`apps/site/index.html:187`) still holds, is Nick's call on that ticket.

**Remediation brief**
- **Design intent:** the site's copy is approved word for word by Nick on its issue (ADR 0012; `CODING_STANDARDS.md` 2). The site test gates rules over copy, such as no em-dash and the policy links, never the copy itself. Approval moved the app from Google's unverified state to verified, and every sentence that describes the unverified state is now stale.
- **Full surface:** `apps/site/index.html:23-26` (the `.beta-note` paragraph); `apps/site/partials/footer.html:30-37` (the `<details>` FAQ entry); `apps/site/src/styles.css:114` (the `.beta-note` rule, which goes if the paragraph goes); `apps/site/index.html:187` ("Open now, in the beta.", only if Nick changes the beta's status). No test reads any of them: `git grep -n "beta-note\|100 creators" -- apps/site/test` prints nothing.
- **Must preserve:** the sign-in notice above the beta note (`apps/site/index.html:19-22`, the Terms and Privacy Policy links that OAuth verification depends on, pinned by the site test's policy link tests); the footer's other FAQ entries; the site test's no-em-dash rule over every page.
- **Do not touch:** the X-Robots-Tag split and the robots meta removal (Dismissed, bullets 1 and 2).
- **Proof:** `grep -n "Until Google verifies\|waiting for Google's verification" apps/site/index.html apps/site/partials/footer.html` prints 2 lines today and none after; then `pnpm --filter ./apps/site build && pnpm exec vitest run apps/site/test/site.test.ts` stays green.

### 2. The extension test's placement check passes with the block above the "Honest numbers" points, and the test holds two rules — LOW

- **Location:** `apps/site/test/site.test.ts:805-828`
- **Attribution:** introduced by #478 (`045bba4`).
- **Real-world trigger:** an edit that moves the extension block to just under the "Honest numbers, and nothing else." heading, before its points, which #478's approved placement forbids ("after the 'Honest numbers, and nothing else.' points and before 'Privacy is the proof.'"). The suite stays green. No user meets this until such an edit lands, so LOW.

**Evidence**

```ts
const [heading, extensionBlock, proofHeading] = [
  'id="differentiators-heading"',
  'id="extension"',
  'class="proof-heading"',
].map((marker) => differentiators.indexOf(marker))
...
expect(links).toEqual(installUrl)
expect(heading).toBeGreaterThanOrEqual(0)
expect(extensionBlock).toBeGreaterThan(heading ?? -1)
expect(proofHeading).toBeGreaterThan(extensionBlock ?? -1)
```

**Failure mode:** the test's name says "a block between the differentiators points and the privacy points", but it anchors on the section heading, not on the end of the points. Proved by execution: mutant M10 (`repro/review-4-finding-2-placement-mutant.mjs`) moves the block above the points and the test stays green (`Tests 1 passed`). The test also asserts two rules, the store links in graph order and the block's placement, under one name, against `CODING_STANDARDS.md` 2 ("One rule, one test").

**Recommended fix:** split it into two tests in the same `describe('seam 1: the homepage structured data')`, and anchor the placement on the first `</ul>` of the differentiators section.

```ts
test('the homepage extension block links each store the extension installs from, in the graph order', async ({
  web,
}) => {
  const { html, data } = await homepageStructuredData(web)
  const extension = data['@graph']?.find((node) => node['@type'] === 'SoftwareApplication')
  const installUrl = Array.isArray(extension?.installUrl) ? extension.installUrl : []
  const block = elementOf(html, 'div', 'extension')
  const links = [...block.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].map(([, href = '']) =>
    decodedOf(href),
  )

  expect(installUrl.length).toBeGreaterThan(0)
  expect(block).not.toBe('')
  expect(links).toEqual(installUrl)
})

test('the homepage extension block sits after the differentiators points and before the privacy points', async ({
  web,
}) => {
  const differentiators = await homepageSection(web, 'differentiators')
  const pointsEnd = differentiators.indexOf('</ul>')
  const [extensionBlock, proofHeading] = ['id="extension"', 'class="proof-heading"'].map(
    (marker) => differentiators.indexOf(marker),
  )

  expect(pointsEnd).toBeGreaterThanOrEqual(0)
  expect(extensionBlock).toBeGreaterThan(pointsEnd)
  expect(proofHeading).toBeGreaterThan(extensionBlock ?? -1)
})
```

**Remediation brief**
- **Design intent:** the homepage graph describes what the page shows (#271, #290), so the page's store links are held to the served graph's `installUrl`, an outside source, never to literals or the build's `extensionStoreUrls`. Placement comes from #478's approved copy: the block follows the "Honest numbers" points and precedes "Privacy is the proof.", inside `section#differentiators` (recorded in `.epic-loop/tickets/478/assumptions.md`). The test reads none of the block's words; copy is held by Nick's approval.
- **Full surface:** `apps/site/test/site.test.ts:799-828` (the comment block above the test and the test itself). `homepageSection` (`:125`) already returns the section through `elementOf`. The first `</ul>` in `section#differentiators` closes the "Honest numbers" points: no `<li>` there nests a list, and the extension block holds no `<ul>`.
- **Must preserve:** the kills of M6 (links swapped) and M8 (a wrong Firefox href) by the links test; the kill of M7 (block after the privacy points) by the placement test; the `installUrl.length > 0` and `block !== ''` guards; the comment above the test, which says why the expectation is the graph's and why no words are read. Split it so each test keeps the sentence that applies to it.
- **Do not touch:** the graph test's `installUrl` literals at `site.test.ts:735` and the three copies of the store URLs (Dismissed, bullet 6).
- **Proof:** from the repo root, `git worktree add --detach /tmp/m10 HEAD && node docs/reviews/creator-analytics-253/repro/review-4-finding-2-placement-mutant.mjs /tmp/m10/apps/site/index.html && (cd /tmp/m10 && pnpm install --frozen-lockfile --offline && pnpm exec vitest run apps/site/test/site.test.ts -t 'the homepage extension block'); git worktree remove --force /tmp/m10`. The placement test must go red on the mutant after the fix; today the single test stays green. Unmutated, both tests are green.

### 3. Comment hygiene — LOW (aggregated)

- `apps/site/vite.config.ts:170-174` — line 172 runs to 157 characters ("(creator-analytics#290), which the homepage also shows and links (creator-analytics#478). It carries no `aggregateRating` and no `review`, though Google's") → the same paragraph, rewrapped at 100.
- `apps/site/vite.config.ts:276-278` — "robots.txt allows every crawler, /app and /api included: Google has to crawl a page to see the `X-Robots-Tag: noindex` the API sets on those (creator-analytics#253, #254)" → "robots.txt allows every crawler, /app, /api and /health included: Google has to crawl a page to see the `X-Robots-Tag: noindex` the API sets on those (creator-analytics#253, #254)", rewrapped at 100.
- `apps/api/src/sign-in.test.ts:297` — "The X-Robots-Tag header on the web app's and the API's responses." → "The X-Robots-Tag header on the web app's, the API's and /health's responses."
- `apps/site/test/site.test.ts:247` — "Google approved OAuth verification (creator-analytics#254), so search engines may index the site." (102 characters, and #254 is the removal ticket, not the approval) → "Google approved OAuth verification on 2026-10-26 (creator-analytics#34), so search engines may index the site.", wrapped at 100.

## Needs Further Investigation

### A. Whether production serves the homepage with no X-Robots-Tag, and the indexing request — after the deploy

The site test proves the API sets no header on site responses. Only `curl -sI https://stillstats.com/` after the deploy shows that nothing in front of the API adds one. `git grep -i x-robots` finds no proxy or deploy config that would, and anything outside the repo is unverified. The Search Console URL Inspection request has no API. Both are Nick's steps on #254 (proposals in `.epic-loop/tickets/254/proposals.md`). Make the request after finding 1's copy lands.

### B. Whether the deployed homepage passes Google's Rich Results Test and the Schema Markup Validator — after the deploy

Carried from review 3 B. The page now shows the extension its graph marks up, so the visible-content conflict from review 3 finding 2 should be gone; only a validator run on the deployed page shows it.

## Reviewed and Dismissed

- The web app, the API and `/health` keeping `X-Robots-Tag: noindex` where #254 says "Remove the header". This is a recorded, reversible assumption with its reason (a signed-out sign-in shell and JSON hold nothing a searcher wants, and an indexed `/app` would be a thin duplicate of the homepage). #254's Done when is met, and `robots.txt` lets crawlers see the header. Nick confirms it on the PR.
- The robots meta removal from `apps/site/partials/head.html`. Every page includes the partial, the robots meta test is red at base, and M9 is killed.
- The path predicate against Hono's router. The finder's harness on hono 4.13.12 showed noindex on `/app`, `/app/`, `/app/x`, `/%61pp/x`, `/api`, `/api/`, `/%61pi/me`, and `/health` on GET and HEAD; on POST `/health`, POST `/app/x`, a thrown error through `onError`, an `HTTPException(401)` and an immutable `Response.redirect`. No header on `/APP`, `//app`, `//app/x`, `/app%2Fx`, `/apiary`, `/application`, `/app.webmanifest`, `/health/`, POST `/no-such`, and GET and HEAD `/`, all of which the site handler serves. `c.req.path` is the value the router matches on, and compose runs the outer middleware after an inner throw.
- No HEAD request in the tests (lane F1.11). The harness shows HEAD carries the GET dispatch's headers.
- One global middleware rather than two scoped ones, and its comment naming the route inventory (`apps/api/src/app.ts:112-115`). A recorded decision, and the comment says why the obvious alternative was not taken. Keep it.
- The store URLs in three hand-kept copies: `apps/site/index.html:79-80`, `extensionStoreUrls` in `vite.config.ts`, and the graph test's literals at `site.test.ts:735` (lane F1.2). The page is static HTML with no data binding but includes. The extension test holds the page to the graph and the graph test holds the graph to #100's URLs, so no copy can drift alone.
- The extension test reading `installUrl` from the served graph. Not self-fulfilling: the page writes literals and never reads `extensionStoreUrls`, and M6 and M8 are killed.
- The web app and API noindex test green at base. It guards behaviour base already had, and M2, M3 and M5 kill it.
- The off-site arrow icon in the store links. `siteIncludes` runs as a `pre` HTML transform on every page, as the footer and `privacy.html` already use this icon; the SVG carries no `style` and no script, and the browser walk saw no CSP violation.
- `.home-section h2 { max-width: 20ch }` wrapping the new 44-character heading. The same rule shapes "Privacy is the proof." and every other section heading; how it reads is a browser look, not a defect.
- No `target="_blank"`, no `rel`, no OpenPanel event on the store links. Recorded decisions; the OpenPanel question is a proposal for Nick in `.epic-loop/tickets/478/proposals.md`.
- `.extension-block` repeating the proof heading's top margin (lane F1.3). Two sections spaced alike by one value each; folding them into one selector would couple unrelated blocks.
- The ADR 0012 edit. It drops `noindex` from the gates the site test holds, which matches the suite.

## Minor / nits

- `apps/site/test/site.test.ts:250`: `html.includes('<meta name="robots"')` misses another attribute order or quoting. `metaContentsOf(html, 'robots')` (`:179`) reads it whatever the order.
- `apps/site/test/site.test.ts:296-301`: the asset rows (`/og-image.png`, `/favicon.svg`, `/robots.txt`, `/sitemap.xml`) check only the header, so a missing asset would quietly re-test the 404. Other tests pin each asset's existence today.
- `apps/site/test/site.test.ts:318-340`: no bare `/api` row. Only bare `/app` kills M3.
- `apps/site/index.html:68`: `id="extension-heading"` is referenced by nothing.
- `apps/site/src/styles.css:162`: "The Studio extension and its two store listings, the ones the homepage graph names." describes the block; its neighbours cite their issue.
- `apps/api/src/app.ts:87`: the `keptOutOfSearch` JSDoc mostly restates the name and body.

## Test quality

Tests added: 3 (`apps/site/test/site.test.ts:292`, `:318`, `:805`). Tests modified: 1 (`:248`, the robots meta test, inverted), plus one comment in `apps/api/src/sign-in.test.ts:297`. **Red at `$BASE`:** 3 of 4 (`:248`, `:292`, `:805`). **Green at `$BASE`, expected:** `:318`, a guard of noindex on the web app and the API, killed by M2, M3 and M5. **Mutants:** 9 of 10 killed; M10 survives (finding 2). **Tautology shapes found:** 0: nothing under test is mocked (`startApi` runs the real `createApi` over the real built site), no call-shaped assertion, no snapshot, no copy test, no expectation built with the helper the code uses. One two-rules test (finding 2).

## Before opening the PR

- **CI readiness:** `pnpm lint`, `pnpm typecheck`, `pnpm build` and `pnpm test` are green at `428d570`, and the local browser walk passes.
- **Commit hygiene:** commit this doc and `repro/review-4-finding-2-placement-mutant.mjs`. Nothing else is in the tree.
- **Likely reviewer asks:** why `/app`, `/api` and `/health` keep noindex when #254 says remove the header (Approach decisions, Nick's confirmation); the stale verification copy (finding 1, a ticket for approved copy, ideally landed before the indexing request); the post-deploy `curl` and Search Console request (Needs Further Investigation A); the post-deploy validator runs (B).

## Verdict

**Ready to open a PR, with follow-ups.** No code finding gates it. Finding 1 (MEDIUM, pre-existing, exposed) is copy Nick has to approve. It becomes a ticket under #253, and it should land before the Search Console indexing request, so the first indexed crawl reads current copy. Finding 2 and finding 3 are LOW suite and comment tidying, two small commits for a remediation round. Of review 3's findings, finding 2 is fully fixed by #478, and findings 1, 3 and 4 are untouched on `main`, outside this surface. None was closed only by editing a comment.

## Remediation — 2026-11-06

Scope: CRITICAL, HIGH and MEDIUM, the default. That is finding 1 alone. Findings 2 and 3 are LOW and deliberately deferred, unworked, for Nick to opt in to. No code changed this round, so no typecheck, suite run or verify agent was needed: the tree's code is the one this review ran every full check on at `428d570`.

| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 1 (MEDIUM) | — not fixed | — | — | out of scope: copy Nick approves word for word (Approach decisions, Site copy). Surface re-verified at `4ac0d96`: the proof grep still prints the 2 lines, `apps/site/index.html:24` and `apps/site/partials/footer.html:33`. Filed as a stage 2 proposal in `.epic-loop/stage2/proposals.md` carrying both texts and the proposed wording, for a ticket under #253 to land before the Search Console indexing request |
| 2 (LOW) | — deferred | — | — | LOW tail, not worked by default |
| 3 (LOW) | — deferred | — | — | LOW tail, not worked by default |

### Known regressions, deferred

None. This round committed no code.

### Rework briefs

None.

### Approach decisions, this round

- Site copy (finding 1): applied the recorded decision unchanged. No remediation round edits visible copy; the finding becomes a proposal with proposed wording for Nick's approval, and the closure records it as open.
