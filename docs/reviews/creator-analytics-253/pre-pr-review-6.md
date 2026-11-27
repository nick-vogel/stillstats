# Pre-PR review: creator-analytics#253 Marketing site SEO, the follow-ups #254 and #478, re-review after the beta note and footer FAQ entry were retired

**Branch:** `creator-analytics-253-marketing-site-seo` vs `origin/main` (merge-base `a72b6bc` "Merge pull request #484 from nick-vogel/creator-analytics-253-marketing-site-seo")
**Reviewed at:** HEAD `05217ec` ("creator-analytics#253 Site: retire the unverified-app beta note and footer FAQ entry"). The tree was clean, with no uncommitted or untracked files at review time. Against the merge-base: 13 files, +572 / −36, 9 commits. `origin/main` has not moved past the merge-base.
**Delta under review:** since `a952e77` ("creator-analytics#253 pre-PR review 4 remediation closure table"), the HEAD pre-PR review 5 (`pre-pr-review-5.md`) reviewed. The delta is 6 files, +218 / −20, in 2 commits: `e5b273a` ("creator-analytics#253 pre-PR review 5") adds review 5, and `05217ec` changes 5 product files, +17 / −20: it removes the homepage `.beta-note` paragraph, its style rule and the footer FAQ entry "Why does Google show a warning when I connect a channel?", rewords one comment in `apps/site/src/main.ts`, and adds one site test.
**Reviewed against:** the epic creator-analytics#253 (its body is the spec) and its children #254 and #478; pre-PR review 5 in full (its Approach decisions, three confirmed findings, dismissals and nits); `.epic-loop/stage2/proposals.md` (the proposal for review 5 finding 1); Nick's decision 2 of 2026-11-06 in `.epic-loop/closeout.md` ("Proposal 4 fixed in this work: remove the .beta-note paragraph, its style rule and the footer FAQ entry; keep "Open now, in the beta.""); `CODING_STANDARDS.md` 1 to 3; ADR 0012.
**Date:** 2026-11-06
**Reviewer:** 1 code-review agent over the 5 product files, a verify pass, and an executed base oracle and mutation run on the new test.

## What was verified and how

| Check | Method | Result |
| --- | --- | --- |
| SHAs | `git cat-file -t` on `a72b6bc`, `a952e77`, `e5b273a`, `05217ec`, `045bba4` | All commits, subjects as cited |
| Install | `pnpm install --frozen-lockfile` | Already up to date |
| Lint | `pnpm lint` (biome, 562 files) | Green; this doc's repro script also passes `pnpm exec biome check` |
| Typecheck | `pnpm typecheck` | Green |
| Site suite | `pnpm exec vitest run apps/site/test/site.test.ts` | Green: 57 passed |
| Build, full suite, browser walk | `pnpm build && pnpm test && pnpm run --if-present test:browser` | Green: 131 files, 3117 passed and 1 expected fail; the browser walk reports no content security policy violation in 39 steps |
| Requirement | `git diff a952e77 -- apps/site`, and `git grep -n -i "beta-note\|100 creators\|Until Google verifies\|waiting for Google"` outside `docs/reviews` | Both texts and the `.beta-note` rule are gone. "Open now, in the beta." stays (`apps/site/index.html:183`), as do the sign-in notice with its Terms and Privacy Policy links (`:19-22`) and the other three FAQ entries. No new copy was written |
| Leftover references | Finder grep across `apps/site` (src, test, browser walk), `apps/web`, `apps/api`, `CONTEXT.md`, docs | None. `README.md:46` "Unverified apps are capped at 100 users." is a general fact about Google, not site copy |
| Structured data | `homepageGraph` in `apps/site/vite.config.ts` | No FAQPage; nothing in the graph comes from the footer |
| Layout | `.hero` rules and `apps/site/src/styles.css:109-112` | `.hero` is a flex column with a uniform gap and the figure keeps its own top margin, so the removal closes one gap. The `.notice-agreed` comment and the reworded `main.ts:75` comment are both accurate: the figure is now the notice's next sibling |
| New test, base oracle | Scratch worktree at `a952e77` (the code before the removal) with HEAD's `site.test.ts`; `vitest run apps/site/test/site.test.ts -t "unverified-app warning"` | Red: `/` reports 6 claims. The test asserts what `05217ec` introduced |
| New test, mutants | Scratch worktree at `05217ec`. M1: the old footer only. M2: the old homepage only. M3: "Room for 100 users." added. M4: "You may see an unverified-app screen when you connect." added. M5: "Google calls Stillstats an unverified app." added (`repro/review-6-finding-1-unverified-mutant.mjs`) | M1, M2, M3 killed. M4 and M5 survive (finding 1) |
| New test, predicate matrix | The predicate evaluated in node over the removed sentences, 4 rephrasings and 4 true sentences | Every removed sentence matches. Misses "unverified app", "not yet verified" with no "Google" in the sentence, and "100 channels". Flags "Google verified Stillstats in October 2026." and "Sign in with Google verifies your email address." (finding 1) |
| Finding 1 fix | The recommended predicate in a scratch worktree: unmutated, M1, M2, M5, then `pnpm exec biome check` on the file | Green unmutated; red on M1, M2 and M5; lint clean |
| Prior finding 2 mutant M10 | Scratch worktree at `05217ec`; `repro/review-4-finding-2-placement-mutant.mjs`; `-t 'the homepage extension block\|the homepage shows the Studio extension'` | Survives: `Tests 1 passed \| 56 skipped` |
| Prior finding 3 entries | `sed -n` and line lengths at each cited line | All four still stand, at the same lines |
| Post-deploy header, indexing, rich results | Not run | Needs the deploy, and Search Console is Nick's (Needs Further Investigation A and B) |

**Overall:** The delta does what Nick decided on 2026-11-06: both stale texts and their style rule are gone, the kept copy is untouched, nothing else referenced them, and every full check is green. That closes review 5's MEDIUM finding 1, so the branch carries no MEDIUM or higher finding. The new guard test is real (red on the old pages, mutants M1 to M3 killed), but its predicate is shaped to the deleted wording: it misses "unverified app", flags true post-approval sentences such as "Google verified Stillstats", and does not state its limits (finding 1, LOW). Findings 2 and 3 are review 5's LOW findings, unchanged.

## Approach decisions

- Carried from review 5, unchanged: session check ordering (#287), the session answer shape proposal, focus across a restore (#289, `swapKeepingFocus`), focus when a restore removes an element (#307, the header wordmark), "focus elsewhere stays" owned by one test, the one `freeOffer` value, and site test expectations read from the page, the issue's approved literal, or the outside source the rule names, never rebuilt with the helper the code under test calls.
- Indexing scope (#254), header placement (#254) and the extension block test (#478): carried from review 5, unchanged.
- Site copy (from review 4): visible copy is approved word for word by Nick on its issue. No remediation round writes it. The removal in `05217ec` is Nick's decision 2 of 2026-11-06, which also keeps "Open now, in the beta."
- Stale-claim guard (new, this review): the site test may hold a rule over the copy whose source is outside the copy, here Google's approval of the verification (creator-analytics#34), under `CODING_STANDARDS.md` 2's exemption. Such a guard matches the claim, not the deleted sentences' words, and its comment states what it cannot see.

## Prior-review closure

Review 5 had 3 confirmed findings: 1 MEDIUM and 2 LOW. **Fully fixed: 1. Partially fixed: 0. Untouched: 2.**

- Finding 1 (MEDIUM, stale "Google has not verified Stillstats" copy): fully fixed by `05217ec`, by removing the copy, as Nick decided. Review 5's proof now passes: `grep -n "Until Google verifies\|waiting for Google's verification" apps/site/index.html apps/site/partials/footer.html` prints nothing, and the site build and suite are green. It was closed by a product change, not by a comment or doc edit.
- Finding 2 (LOW, extension placement test): untouched, re-emitted below as finding 2. M10 still survives.
- Finding 3 (LOW, comment hygiene): untouched, re-emitted below as finding 3.

## Confirmed Issues

### 1. The new unverified-app guard misses "unverified app", flags true post-approval sentences, and does not state its limits — LOW

- **Location:** `apps/site/test/site.test.ts:275-277` (the predicate), with its comment at `:270-271`
- **Attribution:** introduced by `05217ec` ("creator-analytics#253 Site: retire the unverified-app beta note and footer FAQ entry"). `git log --oneline -S'aboutUnverifiedApp' a72b6bc..HEAD` prints only that commit. Not in review 5's delta.
- **Real-world trigger:** a future copy edit on any site page. Two directions. A sentence such as "Google calls Stillstats an unverified app." reintroduces the stale claim and the suite stays green. A true sentence Nick approves, such as "Google verified Stillstats in October 2026." or "Sign in with Google verifies your email address.", turns the site test red with a message calling it a claim about the unverified-app warning. No visitor meets either until such an edit lands, so there is no user path and the severity is capped at LOW.

**Evidence**

```ts
// Google approved Stillstats's OAuth verification on 2026-10-26 (#34). A verified app gets
// neither Google's unverified-app warning at connection nor its 100-user cap.
test("no site page tells a visitor about Google's unverified-app warning or its 100-user cap", async ({
  web,
}) => {
  const aboutUnverifiedApp = (sentence: string) =>
    (/\bGoogle\b/.test(sentence) && /\b(?:verif|warn)/i.test(sentence)) ||
    /\b100 (?:creators|people|users)\b/i.test(sentence)
```

**Failure mode:** `\bverif` needs a word boundary before the "v", and "unverified" has none, so the concept the test is named for never matches. Executed at `05217ec` in a scratch worktree: `repro/review-6-finding-1-unverified-mutant.mjs` adds "Google calls Stillstats an unverified app." to the homepage and the test stays green (`Tests 1 passed | 56 skipped`). Mutant M4 ("You may see an unverified-app screen when you connect.") also survives. Evaluated in node: the predicate misses "Stillstats is not yet verified, so you may see a warning screen." and "The beta is limited to 100 channels.", and flags "Google verified Stillstats in October 2026." and "Sign in with Google verifies your email address.", both true now. The bare `verif` stem with "Google" is the cause of both directions: it matches the removed "Until Google verifies Stillstats" but equally any sentence about Google verifying anything. The comment says why the rule exists but not that the check reads page text one sentence at a time and no attribute, so a meta description, `og:description` or image `alt` goes unchecked, against `CODING_STANDARDS.md` 2 ("A test states its own limits").

**Recommended fix:** match the unverified state rather than the deleted words: "unverified", "not (yet) verified", or "until" or "waiting for" before a verify word, in one sentence; Google with a warning word; or a count of 100 creators, people, users, accounts or channels. Then rewrite the comment above the test to state its limits, and cite the approval as `creator-analytics#34` like its neighbours at `:247` and `:361`.

```diff
     const aboutUnverifiedApp = (sentence: string) =>
-      (/\bGoogle\b/.test(sentence) && /\b(?:verif|warn)/i.test(sentence)) ||
-      /\b100 (?:creators|people|users)\b/i.test(sentence)
+      /\bunverified\b|\bnot (?:yet )?(?:been )?verified\b|\b(?:until|waiting for)\b[^.?!]*\bverif/i.test(
+        sentence,
+      ) ||
+      (/\bGoogle\b/.test(sentence) && /\bwarn/i.test(sentence)) ||
+      /\b100 (?:creators|people|users|accounts|channels)\b/i.test(sentence)
```

The comment at `:270-271` becomes, wrapped at 100 characters: "Google approved Stillstats's OAuth verification on 2026-10-26 (creator-analytics#34). A verified app gets neither Google's unverified-app warning at connection nor its 100-user cap. The check reads page text one sentence at a time and no attribute, so a meta description or an image's alt text goes unchecked, and it also flags a true sentence that pairs Google with a warning or counts 100 creators."

**Remediation brief**
- **Design intent:** the site test gates rules over copy, never the copy itself (ADR 0012; `CODING_STANDARDS.md` 2). This guard is allowed because its rule comes from outside the copy: Google approved the verification (creator-analytics#34), so no page may describe the unverified state, its warning screen or its 100-user cap. It reads every served page, the 404 included, through `servedSite`, strips tags with `textOf`, splits sentences on `.?!`, and expects no sentence to match. It must match the claim, not the removed wording, and a green run must not read as stronger than it is.
- **Full surface:** `apps/site/test/site.test.ts:270-271` (the comment) and `:275-277` (the predicate). Nothing else calls `aboutUnverifiedApp`. `textOf` (`:189-194`) and `servedSite` (`:82-88`) are shared by other tests and do not change.
- **Must preserve:** the test goes red on the old footer alone (M1) and on the old homepage alone (M2): every removed sentence ("The beta has room for 100 creators.", "Until Google verifies Stillstats, Google shows a warning when you connect a channel.", "Why does Google show a warning when I connect a channel?", "Stillstats is waiting for Google's verification.", the "Until it passes, Google warns you ... only 100 people connect one." sentence, and "That is why the beta has room for 100 creators.") still matches. Current pages produce no match; the privacy page holds 26 sentences mentioning Google, verify, warn or 100 that must stay unmatched, and `terms.html:88` "100 US dollars" must stay unmatched. One test, one rule: do not split it or add copy assertions. The recommended predicate keeps two known false positives ("Google's consent screen warns before you share data.", "Over 100 creators use Stillstats."); the comment above declares them, so dropping them is not required.
- **Do not touch:** `textOf` gluing adjacent text when markup has no whitespace between tags (Dismissed); whether the guard is a forbidden copy test (Dismissed: it fits the exemption).
- **Proof:** from the repo root, `git worktree add --detach /tmp/m5 HEAD && node docs/reviews/creator-analytics-253/repro/review-6-finding-1-unverified-mutant.mjs /tmp/m5/apps/site/index.html && (cd /tmp/m5 && pnpm install --frozen-lockfile --offline && pnpm exec vitest run apps/site/test/site.test.ts -t "unverified-app warning"); git worktree remove --force /tmp/m5`. Today it prints `Tests 1 passed | 56 skipped`; after the fix, run on the fixed HEAD, it prints `1 failed`. Unmutated, `pnpm exec vitest run apps/site/test/site.test.ts` stays green, and `pnpm lint` stays green.

### 2. The extension test's placement check passes with the block above the "Honest numbers" points, and the test holds two rules — LOW

- **Location:** `apps/site/test/site.test.ts:821-844` (the test), with its comment at `:818-820`
- **Attribution:** introduced by #478 (`045bba4`). Against `a952e77`: unchanged except for the 16-line shift from the test `05217ec` added above it, a repeat of review 5 finding 2, left unworked as a LOW.
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

**Failure mode:** the test's name says "a block between the differentiators points and the privacy points", but it anchors on the section heading, not on the end of the points. Re-proved by execution at `05217ec`: mutant M10 (`repro/review-4-finding-2-placement-mutant.mjs`) moves the block above the points' `<ul>`, and the test stays green (`Tests 1 passed | 56 skipped`). The test also asserts two rules, the store links in graph order and the block's placement, under one name, against `CODING_STANDARDS.md` 2 ("One rule, one test").

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
- **Full surface:** `apps/site/test/site.test.ts:818-844` (the comment block at `:818-820` and the test at `:821-844`). `homepageSection` (`:125`) already returns the section through `elementOf`. The first `</ul>` in `section#differentiators` closes the "Honest numbers" points: no `<li>` there nests a list, and the extension block holds no `<ul>`.
- **Must preserve:** the kills of M6 (links swapped) and M8 (a wrong Firefox href) by the links test; the kill of M7 (block after the privacy points) by the placement test; the `installUrl.length > 0` and `block !== ''` guards; the comment above the test, which says why the expectation is the graph's and why no words are read. Split it so each test keeps the sentence that applies to it.
- **Do not touch:** the graph test's `installUrl` literals at `site.test.ts:751` and the three copies of the store URLs (Dismissed, carried bullet).
- **Proof:** from the repo root, `git worktree add --detach /tmp/m10 HEAD && node docs/reviews/creator-analytics-253/repro/review-4-finding-2-placement-mutant.mjs /tmp/m10/apps/site/index.html && (cd /tmp/m10 && pnpm install --frozen-lockfile --offline && pnpm exec vitest run apps/site/test/site.test.ts -t 'the homepage extension block|the homepage shows the Studio extension'); git worktree remove --force /tmp/m10`. The filter matches today's test name and both names after the split. Today it prints `Tests 1 passed | 56 skipped` on the mutant. After the fix the placement test must go red on the mutant (1 failed, 1 passed), and unmutated both tests are green.

### 3. Comment hygiene — LOW (aggregated)

Unchanged since review 5; every entry re-checked at `05217ec`. The new test's comment at `site.test.ts:270-271` is rewritten by finding 1, so it is not listed here.

- `apps/site/vite.config.ts:170-174` — line 172 runs to 157 characters ("(creator-analytics#290), which the homepage also shows and links (creator-analytics#478). It carries no `aggregateRating` and no `review`, though Google's") → the same paragraph, rewrapped at 100.
- `apps/site/vite.config.ts:276-278` — "robots.txt allows every crawler, /app and /api included: Google has to crawl a page to see the `X-Robots-Tag: noindex` the API sets on those (creator-analytics#253, #254)" → "robots.txt allows every crawler, /app, /api and /health included: Google has to crawl a page to see the `X-Robots-Tag: noindex` the API sets on those (creator-analytics#253, #254)", rewrapped at 100.
- `apps/api/src/sign-in.test.ts:297` — "The X-Robots-Tag header on the web app's and the API's responses." → "The X-Robots-Tag header on the web app's, the API's and /health's responses."
- `apps/site/test/site.test.ts:247` — "Google approved OAuth verification (creator-analytics#254), so search engines may index the site." (102 characters, and #254 is the removal ticket, not the approval) → "Google approved OAuth verification on 2026-10-26 (creator-analytics#34), so search engines may index the site.", wrapped at 100.

## Needs Further Investigation

### A. Whether production serves the homepage with no X-Robots-Tag, and the indexing request — after the deploy

Carried from review 5 A. The site test proves the API sets no header on site responses. Only `curl -sI https://stillstats.com/` after the deploy shows that nothing in front of the API adds one. The Search Console URL Inspection request has no API. Both are Nick's steps on #254. The stale copy review 5 asked to land first is now gone, so nothing in this branch holds the request back.

### B. Whether the deployed homepage passes Google's Rich Results Test and the Schema Markup Validator — after the deploy

Carried from review 5 B. Only a validator run on the deployed page shows it.

## Reviewed and Dismissed

New in this review:

- The new guard as a forbidden copy test (`CODING_STANDARDS.md` 2). It asserts an absence, and its rule comes from outside the copy, Google's approval in creator-analytics#34, the same exemption as the no-em-dash rule. It is red at the code before `05217ec`. Its weakness is the predicate (finding 1), not its existence.
- `textOf` (`site.test.ts:189-194`) replacing tags with nothing, so text in adjacent tags without whitespace joins into one sentence. It only broadens matching, so it cannot hide a claim, and the site's HTML is whitespace-formatted. A shared helper; no change.
- Layout after the removal. `.hero` spaces its children with a uniform gap, nothing was tuned for the removed paragraph, and the browser walk passes. The sign-in notice test reads the button's `nextElementSibling`, which is still the notice.
- The reworded comment at `apps/site/src/main.ts:75` ("so the screenshot does not move up"). Accurate, since the figure is now the notice's next sibling, and load-bearing: it says why the notice is hidden rather than removed.
- "Open now, in the beta." kept at `apps/site/index.html:183`. Nick's decision 2 of 2026-11-06.
- `README.md:46` "Unverified apps are capped at 100 users." A fact about Google that the repo's research notes record, not a claim about Stillstats.

Carried from review 5 unchanged; these remain the do-not-touch list:

- The web app, the API and `/health` keeping `X-Robots-Tag: noindex` where #254 says "Remove the header". A recorded, reversible assumption; Nick confirms it on the PR.
- The robots meta removal from `apps/site/partials/head.html`.
- The path predicate against Hono's router, and no HEAD request in the tests (review 4's harness).
- One global middleware rather than two scoped ones, and its comment naming the route inventory (`apps/api/src/app.ts:112-115`).
- The store URLs in three hand-kept copies: `apps/site/index.html:75-76`, `extensionStoreUrls` in `vite.config.ts`, and the graph test's literals at `site.test.ts:751`.
- The extension test reading `installUrl` from the served graph.
- The web app and API noindex test green at base.
- The off-site arrow icon in the store links, `.home-section h2 { max-width: 20ch }`, no `target`, `rel` or OpenPanel event on the store links, `.extension-block` repeating the proof heading's margin, and the ADR 0012 edit.
- The repro scripts `repro/review-4-finding-2-placement-mutant.mjs` and `repro/review-6-finding-1-unverified-mutant.mjs`. Each passes lint, refuses to run without a path, throws when its anchor is missing, and writes only the file passed to it.

## Minor / nits

- Carried from review 5, line numbers updated for `05217ec`: `apps/site/test/site.test.ts:250` uses `html.includes('<meta name="robots"')` where `metaContentsOf(html, 'robots')` (`:179`) reads any attribute order; `:312-317` the asset rows check only the header; `:334-356` has no bare `/api` row; `apps/site/index.html:64` `id="extension-heading"` is referenced by nothing; `apps/site/src/styles.css:155` describes the block instead of citing its issue; `apps/api/src/app.ts:87` the `keptOutOfSearch` JSDoc mostly restates the name and body.

## Test quality

Tests added in the delta: 1 (`site.test.ts:272`). Green at the code before `05217ec`: 0, it is red there with 6 claims on `/`. Tautology shapes: 0 (its expectation is an empty list, its input is the real served site). Mutants: 3 of 5 killed; M4 and M5 survive, the rephrasings with "unverified" (finding 1). The branch's earlier tests were audited by review 4 (3 of 4 red at `$BASE`, 9 of 10 mutants killed); M10 still survives (finding 2).

## Before opening the PR

- **CI readiness:** `pnpm lint`, `pnpm typecheck`, `pnpm build` and `pnpm test` green at `05217ec` (3117 passed, 1 expected fail), and the browser walk passes with no content security policy violation in 39 steps.
- **Commit hygiene:** commit this doc and `repro/review-6-finding-1-unverified-mutant.mjs`. Nothing else is in the tree.
- **Likely reviewer asks:** why `/app`, `/api` and `/health` keep noindex when #254 says remove the header (Approach decisions, Nick's confirmation); whether the beta still has a cap now that the note is gone (Nick kept "Open now, in the beta." on purpose); the post-deploy `curl` and Search Console request (A); the post-deploy validator runs (B).

## Verdict

**Ready to open a PR, with follow-ups.** Confirmed: 0 CRITICAL, 0 HIGH, 0 MEDIUM, 3 LOW. Of review 5's 3 findings, 1 is fully fixed (the MEDIUM stale copy, by removing it as Nick decided), 0 partially fixed, 2 untouched (both LOW), and none was closed only by editing a comment or a doc. The one new finding is a LOW gap in the guard test that the fix added, which leaves the site correct today and only weakens the guard against a future edit. No finding gates the PR. Findings 1 to 3 are small test and comment commits whenever Nick opts in. The list shrank from one MEDIUM to only LOWs because the real defect closed, not because the review went looking for nits.
