# Pre-PR review: creator-analytics#120 Extension: engaged views on YouTube's public pages

**Branch:** `creator-analytics-120-youtube-engaged-views` vs `origin/main` (merge-base `cdc8d98` "Merge pull request #624 from nick-vogel/creator-analytics-567-releases-staging")
**Reviewed at:** HEAD `3b3cd56` (the merge of #627, "creator-analytics#627 Public pages: make the engaged views pill read as one of YouTube's metadata items, not a badge on top"), clean tree, no uncommitted or untracked files at review time. 11 files, +325 / −41, all in `apps/extension/src/surfaces/`. Three commits since the merge-base: `6336f9d` (#627's implementation), `0840eee` ("creator-analytics#627 review pass 1 finding 1: lockup lines open the pill with a dot where YouTube's delimiter holds one space") and the merge `3b3cd56`, whose tree equals `0840eee`'s. The epic's earlier work (#134 to #142, #486, #487, #520 to #523) is already on `origin/main`, so this working surface is #627 alone.
**Reviewed against:** epic nick-vogel/creator-analytics#120 (the pill section of its body), nick-vogel/creator-analytics#627 and its acceptance criteria, `CODING_STANDARDS.md` (standards 1 to 3), and the Approach decisions of pre-PR reviews 1 and 2. The repo has no `CLAUDE.md`. Run with `--fresh`, so a full review of the working surface, not delta-scoped against review 2.
**Date:** 2026-11-11
**Reviewer:** 1 code-review agent, 1 test-audit agent (which also ran the mutation checks), and a verify pass

## What was verified and how

| Check | Method | Result |
| --- | --- | --- |
| Dependencies | `pnpm install --frozen-lockfile` | ok, lockfile unchanged |
| Lint | `pnpm lint` (biome, 644 files) | green |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` (all workspaces, extension for Chrome and Firefox) | green |
| Tests | `pnpm test` (Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | green: 157 files, 3951 passed, 1 expected fail |
| Browser walk | `pnpm run --if-present test:browser` | green: no CSP violation in 59 steps |
| Studio styles unchanged | diff of `render.ts`: `pillStyle`, `rowStyle`, `cellStyle`, `headingStyle`, `figureStyle`, `lineStyle` against `cdc8d98` | byte-identical; `renderEngagedViewsPill` has one caller, `pillPlacer.place` (`public-pages.ts:176`) |
| Page boundary | `test/page-boundary.test.ts` in the full run; `testing.ts` read for `textContent` and `getAttribute` | green; the new helpers read neither |
| Added tests red at `$BASE` | scratch worktree at `cdc8d98`, branch's `testing.ts` and the four test files copied in, extension tests run with a scratch vitest config without the database global setup | 16 of 18 red; the two Shorts "no separator" tests green (see Test quality) |
| Mutation: capsule back on `.pill` | scratch worktree at `3b3cd56`, `padding: 0.15em 0.6em;` added to `.pill` in `publicPillStyle` | 9 red: every no-capsule test |
| Mutation: lockups get `'dot'` | `'space'` → `'dot'` in `channel-page.ts:50` and `feed.ts:43` | 5 red: the three channel tab and the home feed and sidebar lockup spacing tests |
| Mutation: separator dropped from the keep key | `${separator}` removed from the key at `public-pages.ts:171` | 0 red across 29 extension files (see Minor) |
| Mutation: no pill drawn | `pillPlacer.place` returns at once | 14 of 18 added tests red; 4 no-capsule tests stay green (Finding 1) |
| Live look on youtube.com (AC4: dot spacing, lockup delimiter, watch spacer, theme) | not run: needs Chrome and Firefox on live youtube.com, which is #627's hand check and #143's walk | not run; see Needs Further Investigation A to D |

**Overall:** The change does what #627 asks inside what jsdom can see: the public pill's shadow stylesheet declares no background, border or padding, each line kind opens the pill with its own `aria-hidden` separator inside the host, the Shorts surfaces get none, the visible text, hover and accessible name are untouched, and the Studio styles are byte-identical. Every full check is green. There is nothing CRITICAL, HIGH or MEDIUM; three LOWs remain, all test or comment quality. What jsdom cannot settle (whether a lockup line draws a dot, the watch spacer's width, the search date's own dot beside the host) is AC4's hand check, which is Nick's and gates closing #627, not opening the PR.

## Approach decisions

- **A pill on a re-pointed tile (carried from reviews 1 and 2):** each tile surface's `sweep` takes down a pill whose tile no longer links the video the pill was drawn for, using the id `pillPlacer` records when it draws. Precedent: the watch page's `sweep` and the Shorts player's `sweep`.
- **The feed's tile id reader (carried):** one module function `videoIdIn(read, tile)` in `feed.ts`, shared by the pass and the sweep.
- **The re-pointed sweep's scan (carried from review 2):** the channel page and Shorts sweeps start from the surface's own pills and walk up with `closest`; the feed's re-pointed scan stays tile-first.
- **The public pill's separator (#627, this review records it):** the extension draws its own separator as an `aria-hidden` span inside the pill's shadow root host, before `.pill`, never read from or borrowed from YouTube's markup. The host stays the view count's next sibling, which `pillPlacer.place`'s keep check relies on. Kinds: `dot` on a search result, `space` on a lockup line (the one space the saved `ytContentMetadataViewModelDelimiter` holds), `two-spaces` on the watch page's info line, `none` in the Shorts player and on the Shorts tab. Reversing to a light-DOM delimiter with YouTube's class would move the keep check to the host after it.
- **The lockup separator's kind waits on the hand check:** `space` stays until #627's hand check shows whether YouTube's stylesheet draws a dot on a lockup's delimiter (NFI A). If it does, pass `'dot'` at `channel-page.ts:50` and `feed.ts:43`, and update the five lockup spacing tests' expected text.

## Confirmed Issues

### 1. Four "no capsule" tests pass when the surface draws no pill at all — LOW
- **Location:** `apps/extension/src/surfaces/feed.test.ts:359-365` (home feed), `feed.test.ts:408-414` (search), `feed.test.ts:465-471` (watch sidebar), `apps/extension/src/surfaces/shorts.test.ts:300-305` (Shorts tab); the helper `apps/extension/src/surfaces/testing.ts:52`
- **Attribution:** introduced in `6336f9d` (`git log -S'capsuleOf' cdc8d98..HEAD` names `6336f9d` and `0840eee`; the helper and the tests do not exist at `cdc8d98`).
- **Real-world trigger:** none for a user; this is a claim of coverage. A later change that stops the feed or the Shorts tab drawing its pill, or gives it a style of its own, leaves these four green. Capped at LOW: the capsule rule lives in the one shared `publicPillStyle` constant, which the five guarded no-capsule tests (channel tabs, watch page, Shorts player) still pin, and the pill's presence on these pages is pinned by the neighbouring separator tests. Upgrade to MEDIUM if a surface ever gets its own public pill style.

**Evidence**
```ts
const pilled = homeTiles().filter((tile) => homeMine.includes(tileId(tile)))
expect(pilled).toHaveLength(2)
for (const tile of pilled) expect(capsuleOf(hostBeside(tile))).toEqual([])
```
```ts
expect(tiles()).toHaveLength(45)
for (const tile of tiles()) expect(capsuleOf(viewCountOf(tile)?.nextElementSibling)).toEqual([])
```
`capsuleOf(undefined)` returns `[]` (`testing.ts:53-54`, the `?.` chain ends in `?? []`). The feed tests count tiles by fixture id, not by a drawn pill; the Shorts tab test counts tiles only.

**Failure mode** — With `pillPlacer.place` made to return at once (no pill drawn anywhere), these four stay green while the other 14 added tests go red. Executed by the test-audit agent in a scratch worktree; the five guarded no-capsule tests went red, because they check the host first: the channel tabs filter on `hostBeside(tile) !== undefined` with `length > 0`, the watch test has `expect(hostBeside()).toBeDefined()`, the Shorts player test has `expect(pillUnderChannelName()).toBeDefined()`.

**Recommended fix** — guard each of the four on the pill before the capsule check, as the neighbouring separator tests do:
```diff
-    for (const tile of pilled) expect(capsuleOf(hostBeside(tile))).toEqual([])
+    for (const tile of pilled) {
+      expect(pillBeside(tile)).toEqual(thePill)
+      expect(capsuleOf(hostBeside(tile))).toEqual([])
+    }
```
(the same at `feed.test.ts:364`, `:413` and `:470`), and in `shorts.test.ts:304`:
```diff
-    for (const tile of tiles()) expect(capsuleOf(viewCountOf(tile)?.nextElementSibling)).toEqual([])
+    for (const tile of tiles()) {
+      expect(pillBesideTile(tile)?.text).toBe('334K engaged views')
+      expect(capsuleOf(viewCountOf(tile)?.nextElementSibling)).toEqual([])
+    }
```

**Remediation brief**
- **Design intent:** AC1 of #627 asks that the no-capsule rule be held on each surface's fixture. A no-capsule test states that the pill drawn on that page has no capsule, so it must first prove a pill was drawn there. `capsuleOf` reads the host's shadow stylesheet; it returns `[]` both for "no capsule" and for "no host", and the test has to tell those apart.
- **Full surface:** `feed.test.ts:364`, `feed.test.ts:413`, `feed.test.ts:470`, `shorts.test.ts:304`. The helpers to use already exist: `pillBeside` and `thePill` in `feed.test.ts` (`:132`, `:158`), `pillBesideTile` in `shorts.test.ts:107`. Do not change `capsuleOf`'s return for a missing host; the five guarded tests and any future caller read `[]` as "no capsule declared".
- **Must preserve:** the five guarded no-capsule tests (`channel-page.test.ts:294-308`, `watch-page.test.ts:231-236`, `shorts.test.ts:518-523`) unchanged; the test names; the 45-tile count in `shorts.test.ts:303`; `test/page-boundary.test.ts` green (no `textContent` or `getAttribute` read added to `testing.ts`).
- **Do not touch:** the two Shorts "no separator" tests that are green at `$BASE` (see Reviewed and Dismissed); they already guard on the pill.
- **Proof:** in a scratch worktree at the fix commit, change `public-pages.ts:166` from `    }): void {` to `    }): void { return`, then run `pnpm exec vitest run apps/extension/src/surfaces/feed.test.ts apps/extension/src/surfaces/shorts.test.ts -t capsule` from the worktree root: every listed test is red (today four of the six are green). At the fix commit itself, unmutated, the same command is green.

### 2. The public pill's style is a third copy of the pill layout and icon rules, without the reason for the icon's centring — LOW
- **Location:** `apps/extension/src/surfaces/render.ts:146-147` (`publicPillStyle`), copying `render.ts:22-23` (`pillStyle`); `render.ts:113-114` (`figureStyle`) holds the same two rules under `.figure`
- **Attribution:** introduced in `6336f9d`. At `cdc8d98`, `publicPillStyle` interpolated `${pillStyle}`; the branch replaced that with a copy minus the capsule declarations.
- **Real-world trigger:** none for a user. A maintainer tuning the icon's alignment in `pillStyle` (whose comment at `render.ts:15-19` is the only place that says why `align-self: center` is there) leaves the public pill behind. Standard 3 names the third copy as a walked-past refactor, and the change opened exactly these lines.

**Evidence**
```ts
const pillStyle = `
.pill { display: inline-flex; align-items: baseline; gap: 0.35em; padding: 0.15em 0.6em; border-radius: 999px; background: color-mix(in srgb, currentColor 12%, transparent); font: inherit; color: inherit; }
.pill svg { height: 1em; width: 1em; flex: none; align-self: center; }
`
...
.pill { display: inline-flex; align-items: baseline; gap: 0.35em; font: inherit; color: inherit; }
.pill svg { height: 1em; width: 1em; flex: none; align-self: center; }
```

**Failure mode** — Two pill styles that must lay the mark and words out the same way are held in step by hand; the centring rationale ("a flex container with no baseline item takes its baseline from the icon's bottom edge, which would sit the pill's words about 2px above the text beside it at 13px") sits on the Studio copy only.

**Recommended fix** — split `pillStyle` into the shared layout and the Studio capsule, keeping Studio's emitted CSS unchanged in meaning:
```diff
-const pillStyle = `
-.pill { display: inline-flex; align-items: baseline; gap: 0.35em; padding: 0.15em 0.6em; border-radius: 999px; background: color-mix(in srgb, currentColor 12%, transparent); font: inherit; color: inherit; }
-.pill svg { height: 1em; width: 1em; flex: none; align-self: center; }
-`
+const pillLayout = `
+.pill { display: inline-flex; align-items: baseline; gap: 0.35em; font: inherit; color: inherit; }
+.pill svg { height: 1em; width: 1em; flex: none; align-self: center; }
+`
+
+const pillStyle = `${pillLayout}
+.pill { padding: 0.15em 0.6em; border-radius: 999px; background: color-mix(in srgb, currentColor 12%, transparent); }
+`
```
and in `publicPillStyle` replace the two `.pill` lines with `${pillLayout}`. Leave `figureStyle` alone in this fix (its selector is `.figure`, and generalising the selector is a separate refactor).

**Remediation brief**
- **Design intent:** every shadow root host gets its own `<style>`; Studio's hosts take `pillStyle` (a capsule), the public page host takes `publicPillStyle` (no capsule, #627). The mark and the words must align the same way in both, which is why the layout should have one home; the capsule is the only thing that differs.
- **Full surface:** `render.ts:15-23` (`pillStyle` and its comment, which moves to `pillLayout` for the centring sentences and keeps the tint sentence on the capsule), `render.ts:142-148` (`publicPillStyle`). Users of `pillStyle` stay as they are: `rowStyle` (`render.ts:42`), `cellStyle` (`render.ts:59`), `headingStyle` (`render.ts:92`).
- **Must preserve:** Studio's computed style: every Studio test that reads the pill's declarations through `declaredFor` (`grep -rn "declaredFor(" apps/extension/src/surfaces/*.test.ts`), including the analytics page, Content list and card suites; the cascade order, so the capsule rule follows the layout rule; all nine no-capsule tests green (`publicPillStyle` must not pick up the capsule rule); `test/page-boundary.test.ts`.
- **Do not touch:** `figureStyle` (`render.ts:110-116`) beyond this fix; `.separator` rules.
- **Proof:** `pnpm exec vitest run apps/extension/src/surfaces/` green before and after, plus `pnpm lint` and `pnpm typecheck`. No red-before-green exists for a pure refactor; the mutation "capsule back on the public pill" (add `padding: 0.15em 0.6em;` to the public pill's rule) must still turn the nine no-capsule tests red after the refactor.

### 3. Comment hygiene — LOW (aggregated)
- `apps/extension/src/surfaces/public-pages.ts:139-140` — "Each pill opens with the `separator` its line takes, drawn inside the pill so the pill stays that element's next sibling." → "Each pill's host opens with the `separator` its line takes, drawn inside the host before the pill, so the host stays that element's next sibling." (The separator is a sibling of `.pill`, outside the `role="img"` element and its name.)
- `apps/extension/src/surfaces/render.ts:131-132` — "inline directly after YouTube's view count in a tile's metadata line" → "inline directly after YouTube's view count in a tile's metadata line or the watch page's info line, or after the channel bar in the Shorts player".
- `apps/extension/src/surfaces/render.ts:139-140` — "The dot's 4px each side is YouTube's usual metadata dot margin" → "The dot's 4px each side is a guess at YouTube's metadata dot margin, not measured (the saved pages carry no styles)".
- `apps/extension/src/surfaces/testing.ts:47` — "what would draw a capsule around the pill" → "the declarations the old capsule was drawn with; a box-shadow or outline is not counted".
- `apps/extension/src/surfaces/channel-page.test.ts:8` and `:10`, `feed.test.ts:9` and `:11`, `watch-page.test.ts:10` — the Limits headers the branch edited are left with lines of 101 to 148 characters beside lines wrapped at 100 → re-wrap the edited sentences at 100 like the lines around them.

## Needs Further Investigation

### A. A lockup line (channel tabs, home feed, watch sidebar) may draw a dot between its items, so the pill's one space may not match it — confirm in #627's hand check: on the channel Videos tab, the home feed and the watch sidebar, run `getComputedStyle(document.querySelector('.ytContentMetadataViewModelDelimiter'), '::before').content` and `'::after'` in the console, and look at the line. The saved delimiter holds one plain space (`apps/extension/test/fixtures/youtube/channel-videos.html`, 30 occurrences), and YouTube writes a literal "•" in the same class only in the channel header, so `space` matches the markup; #627's own example ("19K • S 17K engaged views • 1y ago") assumes a dot. If a dot shows, pass `'dot'` at `channel-page.ts:50` and `feed.ts:43` (Approach decisions). This carries #627 lane review pass 2's F2.1.

### B. On a search result, the date's own dot may not draw once the pill's host sits between the count and the date — confirm in the hand check: on a search result holding one of Nick's videos, check that the line reads "19K • S 17K engaged views • 1y ago", with a dot before "1y ago" as well as before the pill. YouTube draws that dot with a `::before` on each later `.inline-metadata-item`; a selector of the `:not(:first-of-type)` kind survives the inserted `div` host, an adjacent-sibling (`+`) selector would not. The placement predates #627, but #627's goal depends on it. If the dot is lost, the fix is a `dot` drawn after the pill as well, or a light-DOM host of YouTube's item class, which overturns the separator Approach decision.

### C. The watch page's spacer is two no-break spaces, where YouTube's two plain spaces may collapse to one — confirm in the hand check: under the watch page's title, compare the gap before the pill with the gap between the pill and "3w ago" (`getComputedStyle(document.querySelector('ytd-watch-info-text #info'), null).whiteSpace` says whether YouTube's spaces collapse). If they collapse, change `two-spaces` in `separatorText` (`render.ts:447-451`) to one no-break space. Carries lane review pass 2's F2.2.

### D. A pill that wraps to a second line in a narrow tile starts one no-break space (two on the watch line) in from the line's start — confirm in the hand check on a narrow watch sidebar. The host is `inline-block`, so the separator travels with the pill. The old `margin-inline-start: 0.5em` did the same, so this is no regression; it is cosmetic.

## Reviewed and Dismissed
- Studio's pill changed — `pillStyle`, `rowStyle`, `cellStyle`, `headingStyle`, `figureStyle` and `lineStyle` are byte-identical to `cdc8d98`; only `publicPillStyle` changed, and only `pillPlacer.place` renders the public pill.
- The separator changes the pill's accessible name or hover — the separator span is `aria-hidden` and a sibling of `.pill`, which alone carries `title`, `role="img"` and `aria-label`; the existing `pillBeside` and `pillOf` equality tests pass unedited.
- The separator in the keep key makes pills flicker — every call site passes a constant per page kind (`channel-page.ts:50`, `feed.ts:43` and `:54`, `watch-page.ts:73`, `shorts.ts:143` and `:186`), so the key is stable across passes.
- `testing.ts` breaks the page rule — `separatorBefore` returns the element and leaves its text and `aria-hidden` to each test file's `separatorOf`; `test/page-boundary.test.ts` is green.
- The two Shorts "no separator" tests are vacuous for being green at `$BASE` — they pin AC2's "none in the Shorts player; a test holds each", which the base already satisfied, and both guard on the pill's text first (`shorts.test.ts:295`, `:514`), so they go red when no pill is drawn and when Shorts is given a separator. Keep them.
- "The pill on a line of its own starts where the line does" (`render.ts:139`) contradicts wrapping — it names the `none` case, a pill on its own line, and is accurate there; the wrap case is NFI D.
- `separatorBefore` treats the `<style>` as a separator — it returns `undefined` when `.pill`'s previous sibling is the `<style>`, so the `none` tests can go red.

## Minor / nits
- `render.ts:144` `.separator { font: inherit; color: inherit; }` declares what a span in the shadow root inherits anyway; it can go.
- The `${separator}` part of the keep key (`public-pages.ts:171`) is pinned by no test (mutation removing it: 0 red) and is unreachable today, since a tile never changes page kind. Harmless; leave it or drop it with Finding 2's pass.
- `place()` now takes six fields where `separator` is constant per surface (lane review F2.6); passing it to `pillPlacer(surface, separator)` would shorten the calls, but the feed's two page kinds share one placer, so it is not a clear win.
- The channel tab separator tests' names say each pill "stays the view count's next sibling", but they filter to the tiles whose host is (`channel-page.test.ts:286`), so that clause is not asserted (lane review F2.4).
- The surface tests copy the next-sibling check into `hostBeside` in three files beside each file's `pillBeside` (lane review F2.7).

## Test quality
Tests added: 18 (counting each `test.each` row) · green against `$BASE`: 2, the Shorts "no separator" tests, kept (Reviewed and Dismissed) · tautology shapes found: 1, four no-capsule tests that pass with no pill drawn (Finding 1) · no mocked unit, no call-shaped or snapshot assertion, no expectation computed with the production helper (the separator expectations are literals, not `separatorText`). Mutations: the capsule put back turns all 9 no-capsule tests red; lockups given a dot turn the 5 lockup spacing tests red.

## Before opening the PR
- **CI readiness:** `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` and `pnpm test:browser` green at `3b3cd56`.
- **Commit hygiene:** clean tree; three commits for #627 plus this review doc.
- **Likely reviewer asks:** AC4's hand check in Chrome and Firefox, light and dark (NFI A to D ride on it); why the separator is drawn inside the host rather than borrowed from YouTube (Approach decisions).

## Verdict
Ready to open the PR, with follow-ups. Gate: none in code; no CRITICAL, HIGH or MEDIUM finding is open. Findings 1 to 3 are LOW and can ride along or ship as follow-ups. #627's AC4 hand check (Nick's, in Chrome and Firefox, light and dark) settles NFI A to D and gates closing #627; NFI A and B, if they show YouTube draws dots this branch does not, would change the lockup separator kind or the search placement.
