# Pre-PR review: creator-analytics#253 Marketing site SEO, the follow-ups #254 and #478, re-review after review 4's remediation

**Branch:** `creator-analytics-253-marketing-site-seo` vs `origin/main` (merge-base `a72b6bc` "Merge pull request #484 from nick-vogel/creator-analytics-253-marketing-site-seo")
**Reviewed at:** HEAD `a952e77` ("creator-analytics#253 pre-PR review 4 remediation closure table"). The tree was clean, with no uncommitted or untracked files at review time. Against the merge-base: 10 files, +354 / −16, 7 commits. `origin/main` has not moved past the merge-base.
**Delta under review:** since `428d570` ("creator-analytics#254 Remove noindex and X-Robots-Tag once Google approves OAuth verification"), the HEAD pre-PR review 4 (`pre-pr-review-4.md`) reviewed. The delta is 2 files, +234 / −0, in 2 commits: `4ac0d96` ("creator-analytics#253 pre-PR review 4") adds `pre-pr-review-4.md` and `repro/review-4-finding-2-placement-mutant.mjs`, and `a952e77` appends review 4's remediation closure table. `git diff --stat 428d570 -- . ':!docs/reviews'` prints nothing: no product code, test, config or ADR changed since review 4.
**Reviewed against:** the epic creator-analytics#253 (its body is the spec) and its open children #254 and #478; pre-PR review 4 in full (its Approach decisions, its three confirmed findings, its dismissals, and its remediation closure table); `.epic-loop/stage2/proposals.md` (the proposal remediation filed for review 4 finding 1); `CODING_STANDARDS.md` 1 to 3; ADR 0012.
**Date:** 2026-11-06
**Reviewer:** 0 code-review agents and a verify pass. The delta holds no product code, so the delta-scoping rule for an empty delta applies: re-verify each prior confirmed finding against its intent at HEAD and re-emit it with its brief. A finder over a review doc and a 15-line repro script would have bought no coverage.

## What was verified and how

| Check | Method | Result |
| --- | --- | --- |
| SHAs | `git cat-file -t` on `a72b6bc`, `428d570`, `4ac0d96`, `a952e77`, `045bba4`, `afd8890`, `3e681a5` | All commits, subjects as cited |
| Code unchanged since review 4 | `git diff --stat 428d570 -- . ':!docs/reviews'` | Empty |
| Install | `pnpm install --frozen-lockfile` | Already up to date |
| Lint | `pnpm lint` (biome, 562 files, the repro script included) | Green |
| Typecheck | `pnpm typecheck` | Green |
| Site suite | `pnpm exec vitest run apps/site/test/site.test.ts` | Green: 56 passed |
| Build, full `pnpm test`, browser walk | Not re-run | The code is byte-identical to `428d570`, where review 4 ran all three green (3116 passed, 1 expected fail; 39 browser steps, no CSP violation) |
| Finding 1 surface | `grep -n "Until Google verifies\|waiting for Google's verification\|100 creators\|Open now, in the beta" apps/site/index.html apps/site/partials/footer.html` | Unchanged: `index.html:24`, `:187`; `footer.html:33`, `:35` |
| Finding 2 mutant M10 | Scratch worktree at `a952e77`; `repro/review-4-finding-2-placement-mutant.mjs` on its `apps/site/index.html`; `vitest run apps/site/test/site.test.ts -t 'the homepage extension block\|the homepage shows the Studio extension'` before and after the mutation | Survives: `Tests 1 passed \| 55 skipped` both times, with the block moved to line 41, above the points' `<ul>` at line 57 |
| Finding 2 proof command | Review 4's `-t 'the homepage extension block'` against the current test name | Matches no test before the fix, so it cannot show today's green (corrected below, Minor) |
| Finding 3 entries | `sed -n` on each cited line | All four still stand at the cited lines |
| Base oracle and other mutants | Not re-run | No test changed since review 4, which ran them (3 of 4 tests red at base, 9 of 10 mutants killed) |
| Post-deploy header, indexing, rich results | Not run | Needs the deploy, and Search Console is Nick's (Needs Further Investigation A and B) |

**Overall:** Nothing changed in the product since review 4, so its picture holds: both tickets meet their Done when, every full check is green, and the noindex split between the site and the web app, the API and `/health` is held by tests that kill nine mutants. The three prior findings are all still open and re-emitted here unchanged in substance. Finding 1 (MEDIUM, the stale "Google has not verified Stillstats" copy) was deferred by decision in review 4's remediation, because it is copy Nick approves, and it sits as a proposal in `.epic-loop/stage2/proposals.md`. Findings 2 and 3 are LOW and were deliberately left unworked. Finding 2's proof command is corrected here.

## Approach decisions

- Carried from review 3, unchanged: session check ordering (#287), the session answer shape proposal, focus across a restore (#289, `swapKeepingFocus`), focus when a restore removes an element (#307, the header wordmark), "focus elsewhere stays" owned by one test, the one `freeOffer` value, and site test expectations read from the page, the issue's approved literal, or the outside source the rule names, never rebuilt with the helper the code under test calls.
- Indexing scope (#254, from review 4, unchanged): the static site carries no robots meta and no `X-Robots-Tag`; the web app (`webAppPath` and below), the API (`/api` and below) and `/health` keep `X-Robots-Tag: noindex`. `robots.txt` stays `Allow: /`, so a crawler can see that header. A recorded, reversible assumption (`.epic-loop/tickets/254/assumptions.md`) that Nick confirms or reverses on the PR.
- Header placement (#254, from review 4, unchanged): one global `app.use` with the `keptOutOfSearch` path predicate, so the route inventory in `apps/api/src/sign-in.test.ts` keeps one `ALL /*` entry.
- Site copy (from review 4, applied by its remediation): visible copy is approved word for word by Nick on its issue. No remediation round writes it; a finding about copy files a ticket that carries proposed wording for his approval.
- Extension block test (from review 4, unchanged): the page's store links are held equal to the served graph's `installUrl`, in order. Placement is a separate rule with its own test, anchored on the end of the differentiators points list and on the privacy heading.

## Prior-review closure

Review 4 had 3 confirmed findings: 1 MEDIUM and 2 LOW. **Fully fixed: 0. Partially fixed: 0. Untouched: 3.** No product file changed after review 4, so nothing was "resolved", by code or by a comment edit.

- **Finding 1 (MEDIUM), untouched, deferred by decision.** Review 4's closure row: "— not fixed … out of scope: copy Nick approves word for word (Approach decisions, Site copy). … Filed as a stage 2 proposal in `.epic-loop/stage2/proposals.md` carrying both texts and the proposed wording, for a ticket under #253 to land before the Search Console indexing request". The row does not use the word "escalated", but it records the same thing: remediation set the finding aside under a recorded decision, and handed it to Nick with proposed wording. Re-emitted here as finding 1.
- **Finding 2 (LOW), untouched.** Closure row: "— deferred … LOW tail, not worked by default". Re-emitted as finding 2, with its proof command corrected.
- **Finding 3 (LOW), untouched.** Closure row: "— deferred … LOW tail, not worked by default". Re-emitted as finding 3.

Review 4's "Known regressions, deferred" list reads "None."

## Confirmed Issues

### 1. Every page still tells a visitor that Google has not verified Stillstats and caps it at 100 creators, and this branch sends that to search engines — MEDIUM

- **Location:** `apps/site/index.html:23-26` (the homepage beta note under "Sign in with Google"); `apps/site/partials/footer.html:30-37` (the footer FAQ entry, on every page)
- **Attribution:** pre-existing, exposed, and deferred by decision in review 4's remediation. Both texts come from `3e681a5` ("creator-analytics#31: write the homepage content and the footer FAQ") and are on the base: `git show a72b6bc:apps/site/index.html | grep -c "Until Google verifies"` and `git show a72b6bc:apps/site/partials/footer.html | grep -c "waiting for Google's verification"` each print 1. Against `428d570` (review 4): unchanged, a repeat of review 4 finding 1. This branch lifts `noindex` from the pages that carry the claim, so the claim now reaches search results and the Search Console indexing request #254 asks for.
- **Real-world trigger:** any visitor to any page, today and after the deploy. Google approved the verification on 2026-10-26 (#34, comment of 2026-11-02, project `creator-analytics-510701`, both scopes). A verified app shows no unverified-app warning and has no 100-user cap, and the repository holds no cap of its own (`git grep -n -i "100 creators\|room for"` finds only these two texts). A creator who reads them expects a warning screen and may assume the beta is full. MEDIUM is the ceiling for a misleading display; it is not a wrong number delivered by the product.

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

**Failure mode:** a reader is told that a warning screen and a 100-creator cap exist when neither does. No test pins either text, by `CODING_STANDARDS.md` 2's ban on copy tests, so the suite cannot catch it. Re-proved at `a952e77` by the grep in the Proof line, which still prints `index.html:24` and `footer.html:33`.

**Recommended fix:** do not edit copy in a remediation round. The ticket under #253 that `.epic-loop/stage2/proposals.md` already proposes ("Site: retire the "Google has not verified Stillstats" beta note and footer FAQ entry now that verification is approved") carries both texts and the proposed wording for Nick's approval: remove the homepage `.beta-note` paragraph and its `.beta-note` style rule, and remove the footer FAQ entry "Why does Google show a warning when I connect a channel?". Whether the beta keeps a cap of its own, and whether "Open now, in the beta." (`apps/site/index.html:187`) still holds, is Nick's call on that ticket. Land it before the Search Console indexing request #254 asks for, so Google's first crawl of an indexable page reads current copy.

**Remediation brief**
- **Design intent:** the site's copy is approved word for word by Nick on its issue (ADR 0012; `CODING_STANDARDS.md` 2). The site test gates rules over copy, such as no em-dash and the policy links, never the copy itself. Approval moved the app from Google's unverified state to verified, and every sentence that describes the unverified state is now stale.
- **Full surface:** `apps/site/index.html:23-26` (the `.beta-note` paragraph); `apps/site/partials/footer.html:30-37` (the `<details>` FAQ entry); `apps/site/src/styles.css:114` (the `.beta-note` rule, which goes if the paragraph goes); `apps/site/index.html:187` ("Open now, in the beta.", only if Nick changes the beta's status). No test reads any of them: `git grep -n "beta-note\|100 creators" -- apps/site/test` prints nothing.
- **Must preserve:** the sign-in notice above the beta note (`apps/site/index.html:19-22`, the Terms and Privacy Policy links that OAuth verification depends on, pinned by the site test's policy link tests); the footer's other FAQ entries; the site test's no-em-dash rule over every page.
- **Do not touch:** the X-Robots-Tag split and the robots meta removal (Dismissed, bullets 1 and 2).
- **Proof:** `grep -n "Until Google verifies\|waiting for Google's verification" apps/site/index.html apps/site/partials/footer.html` prints 2 lines today and none after; then `pnpm --filter ./apps/site build && pnpm exec vitest run apps/site/test/site.test.ts` stays green.
- **Escalation:** not a rewrite loop. The finding is blocked on Nick's approval of copy, and a further remediation round cannot close it. It closes through the proposed ticket.

### 2. The extension test's placement check passes with the block above the "Honest numbers" points, and the test holds two rules — LOW

- **Location:** `apps/site/test/site.test.ts:805-828` (the test), with its comment at `:802-804`
- **Attribution:** introduced by #478 (`045bba4`). Against `428d570`: unchanged, a repeat of review 4 finding 2, left unworked as a LOW.
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

**Failure mode:** the test's name says "a block between the differentiators points and the privacy points", but it anchors on the section heading, not on the end of the points. Re-proved by execution at `a952e77`: mutant M10 (`repro/review-4-finding-2-placement-mutant.mjs`) moves the block to line 41, above the points' `<ul>` at line 57, and the test stays green (`Tests 1 passed | 55 skipped`). The test also asserts two rules, the store links in graph order and the block's placement, under one name, against `CODING_STANDARDS.md` 2 ("One rule, one test").

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
- **Full surface:** `apps/site/test/site.test.ts:802-828` (the comment block above the test at `:802-804` and the test itself at `:805-828`). `homepageSection` (`:125`) already returns the section through `elementOf`. The first `</ul>` in `section#differentiators` closes the "Honest numbers" points: no `<li>` there nests a list, and the extension block holds no `<ul>`.
- **Must preserve:** the kills of M6 (links swapped) and M8 (a wrong Firefox href) by the links test; the kill of M7 (block after the privacy points) by the placement test; the `installUrl.length > 0` and `block !== ''` guards; the comment above the test, which says why the expectation is the graph's and why no words are read. Split it so each test keeps the sentence that applies to it.
- **Do not touch:** the graph test's `installUrl` literals at `site.test.ts:735` and the three copies of the store URLs (Dismissed, bullet 6).
- **Proof:** from the repo root, `git worktree add --detach /tmp/m10 HEAD && node docs/reviews/creator-analytics-253/repro/review-4-finding-2-placement-mutant.mjs /tmp/m10/apps/site/index.html && (cd /tmp/m10 && pnpm install --frozen-lockfile --offline && pnpm exec vitest run apps/site/test/site.test.ts -t 'the homepage extension block|the homepage shows the Studio extension'); git worktree remove --force /tmp/m10`. The filter matches today's test name and both names after the split. Today it prints `Tests 1 passed | 55 skipped` on the mutant. After the fix the placement test must go red on the mutant (1 failed, 1 passed), and unmutated both tests are green.

### 3. Comment hygiene — LOW (aggregated)

Unchanged since review 4; every entry re-checked at `a952e77`.

- `apps/site/vite.config.ts:170-174` — line 172 runs to 157 characters ("(creator-analytics#290), which the homepage also shows and links (creator-analytics#478). It carries no `aggregateRating` and no `review`, though Google's") → the same paragraph, rewrapped at 100.
- `apps/site/vite.config.ts:276-278` — "robots.txt allows every crawler, /app and /api included: Google has to crawl a page to see the `X-Robots-Tag: noindex` the API sets on those (creator-analytics#253, #254)" → "robots.txt allows every crawler, /app, /api and /health included: Google has to crawl a page to see the `X-Robots-Tag: noindex` the API sets on those (creator-analytics#253, #254)", rewrapped at 100.
- `apps/api/src/sign-in.test.ts:297` — "The X-Robots-Tag header on the web app's and the API's responses." → "The X-Robots-Tag header on the web app's, the API's and /health's responses."
- `apps/site/test/site.test.ts:247` — "Google approved OAuth verification (creator-analytics#254), so search engines may index the site." (102 characters, and #254 is the removal ticket, not the approval) → "Google approved OAuth verification on 2026-10-26 (creator-analytics#34), so search engines may index the site.", wrapped at 100.

## Needs Further Investigation

### A. Whether production serves the homepage with no X-Robots-Tag, and the indexing request — after the deploy

Carried from review 4 A. The site test proves the API sets no header on site responses. Only `curl -sI https://stillstats.com/` after the deploy shows that nothing in front of the API adds one. `git grep -i x-robots` finds no proxy or deploy config that would. The Search Console URL Inspection request has no API. Both are Nick's steps on #254 (proposals in `.epic-loop/tickets/254/proposals.md`). Make the request after finding 1's copy lands.

### B. Whether the deployed homepage passes Google's Rich Results Test and the Schema Markup Validator — after the deploy

Carried from review 4 B and review 3 B. Only a validator run on the deployed page shows it.

## Reviewed and Dismissed

Carried from review 4 unchanged, since no product code moved; these remain the do-not-touch list.

- The web app, the API and `/health` keeping `X-Robots-Tag: noindex` where #254 says "Remove the header". A recorded, reversible assumption with its reason; #254's Done when is met, and `robots.txt` lets crawlers see the header. Nick confirms it on the PR.
- The robots meta removal from `apps/site/partials/head.html`. Every page includes the partial, the robots meta test is red at base, and M9 is killed.
- The path predicate against Hono's router. Review 4's harness on hono 4.13.12 showed the router and `keptOutOfSearch` agree on every path tried, error paths and HEAD included.
- No HEAD request in the tests. The harness shows HEAD carries the GET dispatch's headers.
- One global middleware rather than two scoped ones, and its comment naming the route inventory (`apps/api/src/app.ts:112-115`). A recorded decision, and the comment says why the obvious alternative was not taken.
- The store URLs in three hand-kept copies: `apps/site/index.html:79-80`, `extensionStoreUrls` in `vite.config.ts`, and the graph test's literals at `site.test.ts:735`. The extension test holds the page to the graph and the graph test holds the graph to #100's URLs, so no copy can drift alone.
- The extension test reading `installUrl` from the served graph. Not self-fulfilling: the page writes literals and never reads `extensionStoreUrls`, and M6 and M8 are killed.
- The web app and API noindex test green at base. It guards behaviour base already had, and M2, M3 and M5 kill it.
- The off-site arrow icon in the store links, `.home-section h2 { max-width: 20ch }` on the new heading, no `target`, `rel` or OpenPanel event on the store links, `.extension-block` repeating the proof heading's margin, and the ADR 0012 edit. Each is a recorded decision or matches its neighbours (review 4, Dismissed).
- The delta's repro script, `repro/review-4-finding-2-placement-mutant.mjs`. It passes `pnpm lint`, refuses to run without a path, throws when the block or the heading is missing, and writes only the file passed to it.

## Minor / nits

- `docs/reviews/creator-analytics-253/pre-pr-review-4.md`, finding 2's Proof: `-t 'the homepage extension block'` matches no test before the fix, since today's test is named "the homepage shows the Studio extension its graph marks up: …". Vitest then skips all 56 and passes, so the command cannot show the green that the line describes. Finding 2's Proof above carries the corrected filter; review 4 stays as written, as the audit trail.
- Carried from review 4, unchanged: `apps/site/test/site.test.ts:250` uses `html.includes('<meta name="robots"')` where `metaContentsOf(html, 'robots')` (`:179`) reads any attribute order; `:296-301` the asset rows check only the header; `:318-340` has no bare `/api` row; `apps/site/index.html:68` `id="extension-heading"` is referenced by nothing; `apps/site/src/styles.css:162` describes the block instead of citing its issue; `apps/api/src/app.ts:87` the `keptOutOfSearch` JSDoc mostly restates the name and body.

## Test quality

The delta adds no tests and changes none. The branch's tests were audited by review 4 at the same code: 3 added and 1 modified in `apps/site/test/site.test.ts`, 3 of 4 red at `$BASE`, the fourth (`:318`) a guard of behaviour base already had, 9 of 10 mutants killed, 0 tautology shapes. M10 re-run here still survives (finding 2).

## Before opening the PR

- **CI readiness:** `pnpm lint` and `pnpm typecheck` green at `a952e77`, and the site suite 56 of 56. The build, the full `pnpm test` and the browser walk ran green at `428d570`, whose code is byte-identical outside `docs/reviews`.
- **Commit hygiene:** commit this doc. Nothing else is in the tree.
- **Likely reviewer asks:** why `/app`, `/api` and `/health` keep noindex when #254 says remove the header (Approach decisions, Nick's confirmation); the stale verification copy (finding 1, its proposed ticket, ideally landed before the indexing request); the post-deploy `curl` and Search Console request (A); the post-deploy validator runs (B).

## Verdict

**Ready to open a PR, with follow-ups.** No code finding gates it, and nothing has changed in the product since review 4. Finding 1 (MEDIUM, pre-existing, exposed) is copy Nick has to approve; remediation deferred it by decision to the proposal in `.epic-loop/stage2/proposals.md`, and another remediation round cannot close it. It should land as a ticket under #253 before the Search Console indexing request. Findings 2 and 3 are LOW suite and comment tidying, two small commits whenever Nick opts in. Of review 4's 3 findings, 0 are fixed, 0 partially fixed, 3 untouched, and none was closed only by editing a comment. The confirmed list holds at the same three because the tree did not move, not because the review drifted toward nits.
