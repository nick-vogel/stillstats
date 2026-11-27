# Pre-PR review: creator-analytics#253 Marketing site SEO, the post-merge follow-ups #287, #288 and #289

**Branch:** `creator-analytics-253-marketing-site-seo` vs `origin/main` (merge-base `72b39d4` "creator-analytics#253 Run CI and the deploy for the #292 merge")
**Reviewed at:** HEAD `1457ecd` ("creator-analytics#289 Site: keep keyboard focus when a restore swaps the dashboard link back"). The tree was clean, with no uncommitted or untracked files at review time. 2 files, +130 / −12, 6 commits (3 lane commits `efe2e75`, `483a79d`, `a1eebec`, each with its merge commit `7bb8fef`, `898d54f`, `1457ecd`).
**Reviewed against:** the epic creator-analytics#253 (its body is the spec), its open children #287, #288 and #289 (#290 is skipped, held by #100), `CODING_STANDARDS.md` 1 to 3, and pre-PR review 1 (`pre-pr-review-1.md`, its Approach decisions and finding 1 in full). The earlier epic work merged to `main` in PR #292 (`b0b4195`), so it is outside this surface. Run with `--fresh`.
**Date:** 2026-10-20
**Reviewer:** 1 code-review agent, 1 test-oracle agent, and a verify pass

## What was verified and how

| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | up to date, lockfile unchanged |
| Lint | `pnpm lint` | green, 472 files |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` | green |
| Full suite | `pnpm test` (Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset), run twice | 110 files, 2,340 passed, 1 expected fail, **1 failed both times**: `apps/api/src/event-relay.test.ts` "an event OpenPanel accepts and never answers is given up after the send timeout, and the failure is reported". Not in this surface (last touched by `3bab8e3`, creator-analytics#210). It passes alone 3 of 3 (`pnpm exec vitest run apps/api/src/event-relay.test.ts`). Both runs shared the machine with a parallel audit's suite runs. Pre-existing load flake, already a proposal in `.epic-loop/tickets/287/proposals.md` |
| Site session and focus tests | `pnpm exec vitest run apps/site/src/main.test.ts` | 14 passed |
| Review 1 finding 1 repro | `pnpm exec vitest run --config docs/reviews/creator-analytics-253/repro/finding-1-stale-guard.vitest.config.ts` | green (it was red at `0c1abd1`) |
| Tautology audit, base oracle | HEAD's `main.test.ts` copied into a scratch worktree at `72b39d4` | the #287 test and both direction focus tests red at base; the #288 test and "focus elsewhere stays put" green at base (expected: a test-only ticket and a "must not" guard); all 9 pre-existing tests green |
| Tautology audit, mutations | 8 mutants of `main.ts` on a scratch checkout of `1457ecd` (the #288 relabel mutant, no focus call, focus in one direction only (each way), always focus, the base guard, no cannot-tell clause, no `check < latestShown`) | every mutant killed by at least one test; every new test killed by at least one mutant |
| Guard orderings with three checks | finder probes in a scratch mirror: (S1) restore 2 answers 500 first, restore 1 answers 200, load 401 lands last; (S2) a newer 200 for a second account lands before an older 401 | both end on the newest decisive answer (signed in; letter Z) |
| Focus on the header avatar across a sign-out restore (finding 1) | `pnpm exec vitest run --config docs/reviews/creator-analytics-253/repro/review-2-finding-1-avatar-focus.vitest.config.ts` | red: focus falls to `BODY`. Green with the recommended fix in a scratch worktree, where `main.test.ts` (14) and `pnpm typecheck` also pass |
| Browser walk: Tab to "Open your dashboard", sign out in another tab, Back; focus ring on "Sign in with Google" | not run: no browser in this run | Needs Further Investigation A |

**Overall:** All three tickets landed as their Done-when asks. A restore read that cannot tell no longer throws away a good answer, the restored avatar is pinned to the newest account, and a focused hero button or link hands focus to its replacement in both directions. The new tests are real: each goes red at base or under a mutant. CI is green but for one known API timing flake outside this surface. The only confirmed defect is pre-existing and LOW: focus on the header avatar is still lost on a sign-out restore. The PR can open now.

## Approach decisions

- Session check ordering (review 1, finding 1, landed in #287): an answer is retired only by a newer **decisive** answer (a user or a 401), never by a newer read that could not tell. An older decisive answer that lands while a newer read is still out shows until the newer one answers. Unchanged.
- Session answer shape (review 1, finding 2): `signed-in.ts` returns a three-way answer. Not taken in #287 (assumption in `.epic-loop/tickets/287/assumptions.md`), carried as a proposal in `.epic-loop/tickets/287/proposals.md`. Unchanged.
- Focus across a restore (#289): focus moves only when the element leaving the page held it, and to the element that takes its place, with `preventScroll: true`. A restore never pulls focus from elsewhere. Precedent: `swapKeepingFocus` in `apps/site/src/main.ts:50-54`.
- Focus when a restore removes an element with no replacement (finding 1, new): focus moves to the nearest element that stays in the same region, the header's `a.wordmark`, before the removal. Reversible: a later change may pick another target.
- Site test expectations (review 1): an expected value is read from the page or written as the literal the issue approved, never rebuilt with the production helper (so not `avatarLabelOf(otherUser.email)` in the #288 test).

## Prior-review closure

Review 1 had 9 confirmed findings, all LOW. **Finding 1 is fully fixed** by #287 (`483a79d`): its repro is green and the case now lives in `apps/site/src/main.test.ts:362`. Findings 2 to 9 are **untouched** by this branch and were never in its scope: they merged to `main` with PR #292. Finding 2 has a proposal in `.epic-loop/tickets/287/proposals.md`. No ticket for findings 3 to 9 turned up (`gh issue list --search` on the review's terms). Nothing was "resolved" by editing only a comment or a doc.

## Confirmed Issues

### 1. A sign-out restore drops keyboard focus to the top of the page when it sat on the header avatar — LOW
- **Location:** `apps/site/src/main.ts:91`
- **Attribution:** pre-existing, untouched. `git show 72b39d4:apps/site/src/main.ts` has the same line at `:78`, and the branch does not change it. #289 covers the hero swap only. The lane named this exact gap and proposed it (`.epic-loop/tickets/289/proposals.md`, "Site: keep keyboard focus when a restore removes a focused header avatar").
- **Real-world trigger:** a signed-in keyboard user tabs to the header avatar (the second Tab stop on every page that runs `main.ts`: `index.html`, `principles.html`, `privacy.html`, `terms.html`, `404.html`), signs out in another tab, and comes back with Back. The restore's read answers 401, the avatar goes, and focus falls to `<body>`, so the next Tab starts from the top. **LOW:** a lost place for a keyboard or screen-reader user, recovered by tabbing again. It needs a focused avatar and a sign-out elsewhere before Back. Not a domain-outcome class, so it tops out at MEDIUM. Upgrade to MEDIUM if OpenPanel shows avatar clicks by keyboard are common, which it cannot today (no event tracks it).

**Evidence**
```ts
function showSignedOut(): void {
  document.querySelector('[data-avatar-place] a.avatar')?.remove()
  for (const [link, button] of buttonsSwapped) {
    swapKeepingFocus(link, button)
```
**Failure mode** — Page loaded signed in, `a.avatar` focused, the restore read answers 401: `showSignedOut` removes the avatar, nothing takes its place, and `document.activeElement` becomes `BODY`. Executed: `docs/reviews/creator-analytics-253/repro/review-2-finding-1-avatar-focus.test.ts` expects `focused: 'the wordmark'` and receives `'BODY'` (red).
**Recommended fix**
```diff
 function showSignedOut(): void {
-  document.querySelector('[data-avatar-place] a.avatar')?.remove()
+  const avatar = document.querySelector('[data-avatar-place] a.avatar')
+  if (avatar && document.activeElement === avatar) {
+    document.querySelector<HTMLElement>('a.wordmark')?.focus({ preventScroll: true })
+  }
+  avatar?.remove()
   for (const [link, button] of buttonsSwapped) {
```
**Remediation brief**
- **Design intent:** a restore swaps the page to the newest decisive session answer, and nothing the visitor holds moves: no layout shift, no scroll, and no lost focus. Where an element is swapped, `swapKeepingFocus` hands focus to its replacement. The avatar has no replacement (its place stays empty and held at size), so focus goes to the header's other link, `a.wordmark` (`apps/site/partials/header.html:2`), which every page with the header carries. Focus moves only when the avatar held it.
- **Full surface:** `apps/site/src/main.ts:85-97` (`showSignedOut`, and its doc comment at `:85-89`, which should say the avatar's focus goes to the wordmark). A new case in `apps/site/src/main.test.ts` in `describe('a homepage shown again from the back-forward cache')`, after the focus tests at `:312-360`, shaped on the repro. `showSignedIn` adds the avatar and moves no focus, which is right (nothing focused leaves).
- **Must preserve:** in `apps/site/src/main.test.ts`, "focus on "Open your dashboard" moves to the sign-in button a sign-out restore puts back" (`:312`), "a restore that swaps the hero leaves focus elsewhere on the page where it was" (`:346`, the wordmark-focused case: focus must stay on the wordmark, and must not be pulled anywhere when the avatar was not focused), "a page left signed in, and signed out since, gives the hero its sign-in back" (`:252`), and the avatar's removal itself.
- **Failure of the fix:** a page with no `a.wordmark` gets `undefined?.focus`, so focus falls to `<body>` as today, with no throw. Every page includes `partials/header.html`, which carries it.
- **Do not touch:** `swapKeepingFocus` and its `activeElement` check (Reviewed and Dismissed), and `await document.fonts.ready` in `checkSession`.
- **Proof:** `pnpm exec vitest run --config docs/reviews/creator-analytics-253/repro/review-2-finding-1-avatar-focus.vitest.config.ts` is red now and must be green after. Then `pnpm exec vitest run apps/site/src/main.test.ts` and `pnpm typecheck`.

### 2. Comment hygiene — LOW (aggregated)
- `apps/site/src/main.ts:58-59` — "Both land in the same task. A focused button hands its focus to its link." → "Both land in the same task." (`swapKeepingFocus`'s own doc says it)
- `apps/site/src/main.ts:87-88` — "so it keeps its click listener and its size, and nothing moves. A focused link hands its focus to the button." → "so it keeps its click listener and its size, and nothing moves." (same reason; with finding 1, say instead that a focused avatar hands its focus to the wordmark)
- `apps/site/src/main.ts:103-106` — "Asks GET /api/me who is signed in and shows the page to the answer. Only an answer that can tell retires older ones; an answer that cannot leaves the newest one that could in place." → "Asks GET /api/me who is signed in and shows the page to the answer. An older answer that can tell still shows while a newer read is out, and the newer one replaces it when it lands." (the first half repeats the guard's comment at `:119-123`; the accepted decision from review 1 is written nowhere, and a reader could "fix" it back)

## Needs Further Investigation

### A. Whether a browser draws the focus ring on the element a restore hands focus to
`swapKeepingFocus` calls `to.focus()` after `from.replaceWith(to)`, so at that moment the active element is `<body>`. The `:focus-visible` heuristic for script-moved focus looks at whether the previously focused element matched `:focus-visible`, and Chrome also weighs the last input type. A browser may move focus correctly, which the tests prove, and still draw no ring. Check: the #289 browser walk, in Chrome and Safari (Safari leaves `<a>` out of the Tab order unless "Press Tab to highlight each item" is on). If the ring is missing, the cheaper order is `from.before(to)`, focus `to` while `from` still holds focus, then `from.remove()`. The finder ran it, and every case in `main.test.ts` passes.

### B. Whether a browser keeps a page in the back-forward cache while its load read or font load is still out
Carried from review 1. It settles how often #287's race is met. Check in Chrome DevTools: Application, Back/forward cache, "Test back/forward cache" on a throttled homepage load.

## Reviewed and Dismissed

- The new guard `check < latestShown || (!user && !signedOut)` across three or more checks. `latestShown` only grows, and a check shows only when it is at least `latestShown`, so the page always shows the highest-numbered decisive answer that has landed (probes S1 and S2). A 429 and a 200 body that is not a user count as cannot-tell, as #287 asks.
- An older decisive answer that shows while a newer read is still out. Intended, and declared dropped in review 1 finding 1's brief. Both answers are true when they land, and the newer one still wins.
- `swapKeepingFocus` moves focus only when `from` was `document.activeElement`. Intended (assumption in `.epic-loop/tickets/289/assumptions.md`). "a restore that swaps the hero leaves focus elsewhere on the page where it was" pins it, and the always-focus mutant fails it. Keep it.
- `preventScroll: true`. The replacement stands in the same place, so a scroll could only move the page, which the site's "nothing moves" rule forbids (assumption in `.epic-loop/tickets/289/assumptions.md`).
- The `swapKeepingFocus` doc's "`to` stands in the same place at the same size" (lane review F1.2 of #289). In the sign-in direction the link takes the button's width through `inlineSize`. In the sign-out direction the button is the node the page loaded with, the one whose width the link copied. Accurate.
- Focus held inside the swapped node, and several `[data-sign-in]` buttons. The button and the link hold text only, and the loop swaps each button on its own. `index.html:18` holds the only one today.
- Computing the #288 test's expected label with `avatarLabelOf(otherUser.email)` (a finder suggestion). That builds the expectation with the production helper, which review 1's Approach decision rules out. The literal is the copy #157 approved and is allowed: the test observes which account won through it.
- The repro `docs/reviews/creator-analytics-253/repro/finding-1-stale-guard.test.ts` duplicates the new #287 case. It is review 1's proof, kept on purpose (assumption in `.epic-loop/tickets/287/assumptions.md`), and the root vitest include never runs it in `pnpm test`.
- The duplicate commit subjects. Each pair is a lane commit and its merge commit (`efe2e75`/`7bb8fef`, `483a79d`/`898d54f`, `a1eebec`/`1457ecd`). Neither is empty.
- The `event-relay.test.ts` failure under the full suite. Outside this surface and unchanged by it. It passes alone, and it is already proposed as its own bug.
- `apps/site/src/signed-in.ts:20` still says "a page that cannot tell stays signed out". Pre-existing and outside this surface. It is review 1 finding 2, and the three-way answer proposal replaces the comment along with the flag.

## Minor / nits

- `apps/site/src/main.ts:51`: `focused` holds whether `from` had focus before the swap. `hadFocus` would say so.
- `apps/site/src/main.test.ts:324-326`, `:341-343`, `:357-359`: the focus assertions map identity to a made-up label ("Sign in with Google", "the wordmark") and report only a tag name on failure. They do go red (mutants M2 to M5). `focused: document.activeElement === signIn` with `true` would read as what it is.
- `apps/site/src/main.test.ts:19`: the second account's name `Zoe` starts with the same letter as `zoe@example.com`, so a letter taken from the name would stay green. Today `SignedInUser` is `Pick<MeAnswer, 'email'>`, so `showSignedIn` cannot reach the name without a type change.
- `apps/site/src/main.test.ts`: every back-forward cache case opens with `homepage()`, `page.fonts.resolve()`, `await settle()`. The four new cases add four more copies.
- `apps/site/src/main.test.ts:1-11`: the file's limits say happy-dom draws no focus ring, but not that it cannot observe `preventScroll`.
- The rule "an older decisive answer never overwrites a newer one" is pinned only by the pre-existing "an answer that arrives after a newer one changes nothing" (`:292`), which kills the mutant without `check < latestShown`. No case drives three checks. Enough today.

## Test quality

Tests added: 5, all in `apps/site/src/main.test.ts` (#288 at `:231`, #289 at `:312`, `:329` and `:346`, #287 at `:362`). **Green against `$BASE`:** 2. The #288 case is a test-only ticket's guard, and the #288 mutant kills it. "a restore that swaps the hero leaves focus elsewhere on the page where it was" is a "must not" guard, and the always-focus mutant kills it. Keep both. The other 3 are red at base, each with the real gap: focus on `BODY`, the avatar and link missing. **Tautology shapes found:** 0. No mocked unit (only `fetch` and `document.fonts` are faked, at the boundary), no call-shaped-only assertion (`meReads()` always sits beside DOM state), no snapshot, no assertion-free test, no prose test, and no expectation built with a production helper. The literal `aria-label` in the #288 case is approved copy observed as a behaviour, which `CODING_STANDARDS.md` 2 allows. Each name states one rule, and the two direction tests are mirrors, each killed by its own one-direction mutant.

## Before opening the PR

- **CI readiness:** `pnpm lint`, `pnpm typecheck` and `pnpm build` are green at `1457ecd`. `pnpm test` is green but for the `event-relay.test.ts` load flake, which can also turn CI red on a busy runner. A re-run clears it, and its fix is its own proposal.
- **Commit hygiene:** commit this doc and the two `repro/review-2-finding-1-avatar-focus.*` files. Nothing else is in the tree.
- **Likely reviewer asks:** the #289 browser walk (Needs Further Investigation A); why focus on the avatar is not kept (finding 1, a follow-up); review 1's findings 2 to 9, which are on `main`, finding 2 as a proposal and the rest with no tickets.

## Verdict

**Ready to open a PR, with follow-ups.** Nothing blocks it: the one defect (finding 1) is LOW and pre-existing, and the lane already proposed it as its own ticket. It can land in a remediation round, since its brief and repro are ready, or ship as that ticket. Finding 2 is comment tidying. Of review 1's findings, the one this branch claimed (finding 1) is fully fixed, and none was closed only by editing a comment. The #289 browser walk, with its focus ring check, is still Nick's.
