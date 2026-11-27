# Pre-PR review: creator-analytics#253 Marketing site SEO, the follow-ups #290, #307 and #308

**Branch:** `creator-analytics-253-marketing-site-seo` vs `origin/main` (merge-base `a187286` "Merge pull request #475 from nick-vogel/creator-analytics-238-own-channel-metrics")
**Reviewed at:** HEAD `c482a55` ("creator-analytics#308 Site: test that the avatar letter comes from the email, not the name"). The tree was clean, with no uncommitted or untracked files at review time. 6 files, +128 / −20, 7 commits: 3 lane commits `adfe6b3` (#290), `b1bd2a0` (#307), `7c105f3` (#308), each with its merge commit `7d510c9`, `f8c3d13`, `c482a55`, plus `5035003` (the epic branch merged into the #307 lane).
**Reviewed against:** the epic creator-analytics#253 (its body is the spec), its open children #290, #307 and #308, #100's closing comment (2026-11-06, the two public store URLs), `CODING_STANDARDS.md` 1 to 3, pre-PR review 2 (`pre-pr-review-2.md`, its Approach decisions, finding 1 and finding 2 in full), and Google's structured data general guidelines (developers.google.com/search/docs/appearance/structured-data/sd-policies, fetched 2026-11-06). Run with `--fresh`, so the whole surface against `origin/main` is in scope.
**Date:** 2026-11-06
**Reviewer:** 1 code-review agent + verify pass

## What was verified and how

| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | up to date, lockfile unchanged |
| Lint | `pnpm lint` | green, 561 files |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` | green |
| Full suite | `pnpm test` (Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | 131 files, 3,114 passed, 1 expected fail, 0 failed |
| Browser walk | `pnpm run --if-present test:browser` | passed: no content security policy violation in 39 steps |
| Built JSON-LD | read `apps/site/dist/index.html` after the build | the `#extension` node is served with both store URLs in `installUrl`, Chrome first, publisher the organization |
| Store URLs | against #100's closing comment of 2026-11-06 | both match the published listings word for word |
| Review 2 finding 1 repro | `pnpm exec vitest run --config docs/reviews/creator-analytics-253/repro/review-2-finding-1-avatar-focus.vitest.config.ts` | green (it was red at `72f6a7d`, focus on `BODY`) |
| Mutations, site letter | the #308 issue's mutant (letter from `name`, `SignedInUser` widened) on a scratch checkout of `c482a55`, `pnpm exec vitest run apps/site/src/main.test.ts` | killed: "a page left signed in, restored after a sign-in as another account, shows the newest account on its avatar" goes red (`Z` vs `B`) |
| Mutations, web letter | `App.tsx:499` passes `session.user.name` into the header, `pnpm exec vitest run apps/web/src/app.test.ts -t 'first letter of the email'` | killed: expected `N`, received `A` |
| Mutations, #307 | (M3) no focus move; (M4) focus the wordmark whenever an avatar exists; (M6) bare `a.wordmark` selector; (M7) no `preventScroll`; (M8) `swapKeepingFocus` focuses its target unconditionally | M3 kills the avatar case; M4 kills "a sign-out restore leaves focus on a link elsewhere" and the sign-in-button direction case, and **not** "a restore that swaps the hero leaves focus elsewhere"; M8 kills all three focus-stays cases; M6 and M7 survive (happy-dom cannot see a scroll; the header precedes the footer) |
| Tautology audit | per added or modified test, red at `$BASE` or killed by a mutant | see Test quality |
| Browser walk of the avatar focus case: Tab to the avatar, sign out in another tab, Back | not run: the scripted walk does not drive it, and no hand walk in this run | Needs Further Investigation A |
| Rich Results Test and Schema Markup Validator on the deployed homepage (#290 Done when) | not run: the node is not deployed yet | Needs Further Investigation B |

**Overall:** All three tickets landed as their Done-when asks. The homepage graph carries the Studio extension with the two store URLs #100 published, linked to the organization; a focused header avatar hands its focus to the header wordmark on a sign-out restore, and focus elsewhere stays put; both apps' test users now have names that start with another letter than their emails, and a letter-from-name mutant goes red in each. Every full check is green. Three LOW findings and a one-entry comment hygiene batch, none of them a gate. The PR can open now.

## Approach decisions

- Session check ordering (review 1, finding 1, landed in #287): an answer is retired only by a newer **decisive** answer (a user or a 401), never by a newer read that could not tell. Unchanged.
- Session answer shape (review 1, finding 2): carried as a proposal in `.epic-loop/tickets/287/proposals.md`. Unchanged.
- Focus across a restore (#289): focus moves only when the element leaving the page held it, and to the element that takes its place, with `preventScroll: true`. Precedent: `swapKeepingFocus` in `apps/site/src/main.ts:50-54`. Unchanged.
- Focus when a restore removes an element with no replacement (review 2, finding 1, landed in #307): focus moves to the header's `.site-header a.wordmark` before the removal, only when the removed element held it. Unchanged.
- Site test expectations (review 1): an expected value is read from the page, written as the literal the issue approved, or read from the outside source the rule names (the #290 graph test reads the extension's name from `manifestOf`, which is the store listing name; the production node writes the literal). Never rebuilt with the helper the code under test calls.
- "Focus elsewhere stays" (new, finding 1): one test owns the rule, focused on a link that no restore moves focus to (`main a[href="/principles"]`). This overturns review 2's dismissal bullet that said to keep the wordmark-focused case: since #307 the wordmark is a focus target, so that case can no longer tell "left alone" from "moved there".
- The free offer (new, finding 3): one `freeOffer` value in `homepageGraph()`, shared by both application nodes.

## Prior-review closure

Review 2 had 2 confirmed findings, both LOW. **Finding 1 is fully fixed** by #307 (`b1bd2a0`): its repro is green and the case lives in `apps/site/src/main.test.ts:364`. **Finding 2 (comment hygiene) is partially fixed:** its `:87-88` entry is done (the `showSignedOut` doc now says a focused avatar hands its focus to the wordmark); its `:58-59` and `:103-106` entries are untouched and carried as a proposal in `.epic-loop/tickets/307/proposals.md`. Nothing was "resolved" by editing only a comment.

## Confirmed Issues

### 1. The wordmark-focused "focus elsewhere stays" test is now a weaker duplicate of the new principles-link test — LOW

- **Location:** `apps/site/src/main.test.ts:348` ("a restore that swaps the hero leaves focus elsewhere on the page where it was"), beside `apps/site/src/main.test.ts:382` ("a sign-out restore leaves focus on a link elsewhere on the page where it was")
- **Attribution:** introduced. The `:348` test predates the branch (#289), and the branch made it a duplicate twice over: #307 (`b1bd2a0`) made the header wordmark a focus target, and the same commit added the `:382` test for the same rule.
- **Real-world trigger:** none for a user; this is suite quality. A maintainer reading two tests for one rule may "fix" the weaker one and believe the rule is still guarded. LOW, no user path.

**Evidence**

```ts
const wordmark = document.querySelector<HTMLAnchorElement>('a.wordmark')
wordmark?.focus()
page.answerMe('signed out')
await showPage(true)
```

**Failure mode** — Both tests start on the signed-in homepage, focus a link outside the swapped hero, answer the restore read with a 401, and assert focus stayed. Executed on a scratch checkout of `c482a55`: mutant M8 (`swapKeepingFocus` focuses its target unconditionally) turns both red, so `:382` kills everything `:348` kills. Mutant M4 (focus the wordmark whenever an avatar exists) turns `:382` red and leaves `:348` green, because the focus it asserts is already where M4 puts it. `CODING_STANDARDS.md` 2: "A duplicate that covers a rule an existing test already covers. One rule, one test", and a test that no longer states a rule "is deleted in the same commit that made it meaningless".

**Recommended fix** — delete the `:348` test (lines 348 to 362) and keep `:382` as the one owner of the rule.

**Remediation brief**
- **Design intent:** a restore swaps the page to the newest decisive session answer, and nothing the visitor holds moves. Focus moves only when the element leaving the page held it (`swapKeepingFocus`, `main.ts:50-54`, and the avatar branch in `showSignedOut`, `main.ts:91-99`). "Focus elsewhere stays" is the guard that a restore never pulls focus; it must be observed on an element that no restore code ever focuses, which the wordmark no longer is.
- **Full surface:** `apps/site/src/main.test.ts:348-362` only. `:382-398` stays as it is.
- **Must preserve:** in `apps/site/src/main.test.ts`, "focus on the header avatar moves to the wordmark when a sign-out restore takes the avatar away" (`:364`), "a sign-out restore leaves focus on a link elsewhere on the page where it was" (`:382`), and the two direction cases before `:348` ("focus on "Open your dashboard" moves to the sign-in button a sign-out restore puts back" and its mirror). The always-focus mutants M4 and M8 must each still be killed.
- **Do not touch:** the `.site-header a.wordmark` selector and the focus-before-removal order in `main.ts:93-97` (Reviewed and Dismissed).
- **Proof:** this is a deletion, so there is no red. After it, `pnpm exec vitest run apps/site/src/main.test.ts` is green with 15 tests, and on a scratch worktree each of these one-line mutants of `apps/site/src/main.ts` turns at least one test red: `if (focused) to.focus({ preventScroll: true })` → `to.focus({ preventScroll: true })` (M8), and `if (avatar && document.activeElement === avatar)` → `if (avatar)` (M4).

### 2. The homepage JSON-LD names a browser extension the homepage never mentions — LOW

- **Location:** `apps/site/vite.config.ts:207-219` (the `#extension` node); `apps/site/index.html` (no mention)
- **Attribution:** introduced by #290 (`adfe6b3`). `git show a187286:apps/site/vite.config.ts` has three nodes and no `installUrl`.
- **Real-world trigger:** Google crawls stillstats.com and reads a `SoftwareApplication` for a browser extension with two store listings, while the page's visible text names no extension, Chrome, Firefox or store (`grep -i 'extension\|studio\|chrome\|firefox' apps/site/index.html` prints nothing). Google's general guidelines say "Don't mark up content that is not visible to readers of the page", and a quality violation "can prevent syntactically correct structured data from being displayed as a rich result in Google Search, or possibly cause it to be marked as spam"; a structured data manual action "doesn't affect how the page ranks in Google web search". The homepage earns no software app rich result today (the graph carries no rating, by #253's decision), so the cost is limited to the page's rich result eligibility. LOW, capped: upgrade to MEDIUM if Search Console reports a structured data manual action for stillstats.com, check via Search Console, Security and Manual Actions.

**Evidence**

```ts
'@id': urlOnOrigin('/#extension'),
name: 'Stillstats',
url: urlOnOrigin('/'),
applicationCategory: 'BrowserApplication',
installUrl: extensionStoreUrls.map((url) => new URL(url).href),
```

**Failure mode** — The markup is valid and the ticket asked for it word for word, so no validator flags it. The conflict is with the page's content: the node describes something a reader of the homepage cannot see. Proved by the grep above and the guideline text, not by a Google verdict, which needs a deploy.

**Recommended fix** — do not change the graph in this PR. The fix is visible homepage copy that names the extension and links its two listings, and copy needs Nick's approval, which #253 keeps out of scope. File the #290 lane's proposal ("Link the Studio extension's store listings from the homepage", `.epic-loop/tickets/290/proposals.md`) as its own ticket.

**Remediation brief**
- **Design intent:** the homepage graph describes what the homepage presents (#271), and #290 added the extension once #100's listings went live. Visible copy is approved word for word on its issue, so a remediation round must not write it.
- **Full surface:** a follow-up ticket only. When its copy lands, `apps/site/index.html` gains the mention and links, and `apps/site/test/site.test.ts` may gain a rule that each `installUrl` is linked from the page (a rule over copy that comes from the graph, which `CODING_STANDARDS.md` 2 allows).
- **Must preserve:** the graph as it stands, and both #290 tests in `apps/site/test/site.test.ts` ("the homepage graph names Stillstats as a web application, the Studio extension in its two stores, its operator and its site, linked by @id" and "every URL in the homepage graph is absolute, on the product origin or its store, and unchanged by encoding it again").
- **Do not touch:** the node itself; removing it would undo #290.
- **Proof:** `grep -ci 'addons.mozilla.org' apps/site/dist/index.html` after `pnpm --filter ./apps/site build` counts the JSON-LD only today (1); after the follow-up's copy lands it counts the visible link too.

### 3. The free offer is now written twice in the homepage graph — LOW

- **Location:** `apps/site/vite.config.ts:204-205` and `apps/site/vite.config.ts:217-218`
- **Attribution:** introduced by #290 (`adfe6b3`), which copied the web app node's `offers` line into the extension node. `git show a187286:apps/site/vite.config.ts | grep -c "price: '0'"` prints 1.
- **Real-world trigger:** none for a user. The day the free tier gains a currency, a price or a condition, one copy changes and the other does not, and the graph test pins both copies so it would catch it. `CODING_STANDARDS.md` 3: the refactor sits on the lines the change already touches. LOW, no user path.

**Evidence**

```ts
        // The free tier. schema.org writes a price as text.
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
...
        // The extension is free.
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
```

**Failure mode** — Duplicated value on the touched path; not a behaviour defect. Read from the code, nothing to execute.

**Recommended fix**

```diff
 function homepageGraph(description: string) {
   const organization = urlOnOrigin('/#organization')
+  const freeOffer = { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
@@
-        // The free tier. schema.org writes a price as text.
-        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
+        offers: freeOffer,
@@
-        // The extension is free.
-        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
+        offers: freeOffer,
```

Move the existing comment "The free tier. schema.org writes a price as text." onto the `freeOffer` line, unchanged; it is load-bearing (the string price). The "The extension is free." comment is dropped on purpose (it restates `price: '0'`).

**Remediation brief**
- **Design intent:** `homepageGraph()` builds one schema.org graph whose nodes reference each other by `@id`; the serialized output is what matters, and `JSON.stringify` writes a shared object at each place it is used, so sharing the value changes no byte of the output.
- **Full surface:** `apps/site/vite.config.ts`, the start of `homepageGraph()` (after `const organization`), `:204-205` and `:217-218`.
- **Must preserve:** the served JSON-LD byte for byte. Suites: the whole `describe('seam 1: the homepage structured data')` block in `apps/site/test/site.test.ts`, which pins both offers inside the graph test.
- **Do not touch:** the `name: 'Stillstats'` literals and the `publisher` objects. Each node's name is its own fact, and sharing them is a taste call, not this finding.
- **Proof:** no red (a refactor). Before and after, `pnpm --filter ./apps/site build && grep -o '"offers":{[^}]*}' apps/site/dist/index.html` prints the same two lines, and `pnpm exec vitest run apps/site/test/site.test.ts` stays green.

### 4. Comment hygiene — LOW (aggregated)

- `apps/site/src/main.test.ts:9-11` — "The focus cases show which element holds focus after a swap, not that a browser draws its focus ring there: the walk checks that with Tab to "Open your dashboard", a sign-out in another tab, and Back." → "The focus cases show which element holds focus after a swap or a removal, not that a browser draws its focus ring there or keeps the page from scrolling: the walk checks that with Tab to "Open your dashboard", and with Tab to the avatar, then a sign-out in another tab and Back." (the #307 case is not a swap, and the file's limits do not name it; `CODING_STANDARDS.md` 2, a test states its own limits)

## Needs Further Investigation

### A. Whether a browser draws the focus ring on the wordmark and keeps the page still when a restore removes a focused avatar — Nick's browser walk

Confirm by a hand walk in Chrome and Firefox: sign in, Tab to the header avatar, sign out in another tab, press Back. The ring should sit on the header wordmark and the page should not scroll. happy-dom cannot observe either (mutant M7, no `preventScroll`, survives), and `apps/site/test/screenshot/browser-walk.ts` does not drive this case.

### B. Whether the deployed homepage passes Google's Rich Results Test and the Schema Markup Validator — after deploy

#290's Done when asks for both on the deployed homepage. Run each against https://stillstats.com/ once the branch deploys. A warning about the missing `aggregateRating` is expected and accepted by #253's decision.

## Reviewed and Dismissed

- The `installUrl` property, `BrowserApplication`, the `#extension` `@id`, `operatingSystem: 'Chrome, Firefox'`, and no `description`. Each is a recorded, reversible choice in `.epic-loop/tickets/290/assumptions.md`, grounded in schema.org's `installUrl` definition and Google's `applicationCategory` list.
- The two nodes share `name` and `url` (lane review F1.9). They differ by `@type`, `@id`, `applicationCategory` and `operatingSystem`; the graph is valid either way.
- The graph test reading the extension's name from `manifestOf({ browser: 'chrome', mode: 'production' }).name` (`apps/site/test/site.test.ts:701`). Not self-fulfilling: the production node writes the literal and never calls `manifestOf`, and the rule is "the node's name is the name each store lists", whose outside source is the manifest. A manifest rename turns it red, which is a real break.
- The URL test's store origin and order check (`site.test.ts:761`) overlapping the graph test's `installUrl` literals. The URL test owns "every URL in the graph is on an allowed origin and encodes to itself", which still holds for any future `installUrl` entry; the overlap is one line.
- `.site-header a.wordmark` rather than `a.wordmark` (mutant M6 survives). The scoped selector is the recorded choice: the footer carries a second `a.wordmark` (`apps/site/partials/footer.html:4`), and the bare selector would depend on the header coming first in the DOM.
- Focus moving before the avatar's removal. Intended (assumption in `.epic-loop/tickets/307/assumptions.md`), so focus never passes through `<body>`. happy-dom cannot tell the two orders apart; it is a browser concern (Needs Further Investigation A).
- A focused avatar with no header wordmark. `?.focus` does nothing, the avatar goes, and focus falls to `<body>` as before #307, with no throw. Every page includes `apps/site/partials/header.html`, which carries the wordmark.
- `showSignedOut` on a first load. The built header's `[data-avatar-place]` is empty, so the avatar branch never runs.
- The web fake API's `me.name` changing from `Nick` to `Ada`. No web source shows `me.name` and no web test asserted on it; the full suite is green.
- The review 2 repro files kept under `repro/` though #307 says the case "moves into" `main.test.ts`. Recorded in `.epic-loop/tickets/307/assumptions.md`, as #287 kept review 1's; the root vitest include never runs them, lint covers them, and the repro is green.
- The comment "schema.org's URL the app installs from, where it differs from the item's own URL." (`vite.config.ts:214`). It says why the store URLs are not the node's `url`. Keep it.
- The docblock line "Only the homepage graph reads them." (`vite.config.ts:160`). It records why the constant lives in the site's build and not in `api-types` (assumption in `.epic-loop/tickets/290/assumptions.md`). Keep it.
- The duplicate commit subjects. Each pair is a lane commit and its merge commit (`adfe6b3`/`7d510c9`, `b1bd2a0`/`f8c3d13`, `7c105f3`/`c482a55`). None is empty.

## Minor / nits

- `apps/site/src/main.test.ts:375`: the key `avatarWasFocusable: avatar !== null` checks that the avatar exists, not that it can take focus. `avatarShown` would say so.
- `apps/site/test/site.test.ts:741`: the test title's "on the product origin or its store" reads as one store; the graph holds two. "or a store listing" would read right.
- `apps/site/src/main.test.ts`: the pattern `document.activeElement === x ? '<label>' : document.activeElement?.tagName` now repeats in five focus tests (two added here). A small `focusedAs(element, label)` helper would remove it.
- The site's email-not-name rule is pinned only through "a page left signed in, restored after a sign-in as another account, shows the newest account on its avatar" (`main.test.ts:232`), whose name states another rule. It kills the mutant; the fixture comment at `:16-17` says why the names differ.

## Test quality

Tests added: 3 (`apps/site/src/main.test.ts:364` and `:382`, `apps/web/src/app.test.ts:3300`). Tests modified: 2 (`apps/site/test/site.test.ts`, the graph test and the URL test), plus the fixture names in `apps/site/src/main.test.ts:16-21` and `apps/web/src/fake-api.ts:66-68`. **Red at `$BASE` or killed by a mutant:** all 5. The `:364` avatar case is review 2's repro, red at `72f6a7d`, and mutant M3 kills it. Both `site.test.ts` tests are red at base by construction (the base graph has 3 nodes and no `installUrl`), as the #290 lane audit also recorded. **Green at `$BASE`, expected:** `:382` is a "must not" guard, killed by M4 and M8; `app.test.ts:3300` is a test-only ticket's guard, killed by the web letter-from-name mutant; the renamed site users make the existing `:232` test kill the #308 mutant. **Tautology shapes found:** 0: no mocked unit (only `fetch` and `document.fonts` are faked at the boundary), no call-shaped-only assertion, no snapshot, no expectation built with the helper under test. One duplicate found: finding 1.

## Before opening the PR

- **CI readiness:** `pnpm lint`, `pnpm typecheck`, `pnpm build` and `pnpm test` are green at `c482a55`, and the local browser walk passes.
- **Commit hygiene:** commit this doc. Nothing else is in the tree.
- **Likely reviewer asks:** why the homepage marks up an extension it does not show (finding 2, a follow-up ticket for approved copy); the post-deploy Rich Results and Schema Markup Validator runs (Needs Further Investigation B); the hand walk of the avatar focus case (Needs Further Investigation A); review 2 finding 2's two open comment entries, carried as a proposal.

## Verdict

**Ready to open a PR, with follow-ups.** No finding gates it: findings 1, 3 and 4 are LOW suite and code tidying that a remediation round can take in three small commits, and finding 2 is a follow-up ticket for homepage copy. Of review 2's findings, finding 1 is fully fixed and finding 2 is partly fixed, its open half carried as a proposal; none was closed only by editing a comment. The browser walk of the avatar focus case and the post-deploy validator runs are still Nick's.
