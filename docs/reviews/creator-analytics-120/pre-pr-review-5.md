# Pre-PR review: creator-analytics#120 Extension: engaged views on YouTube's public pages

**Branch:** `creator-analytics-120-youtube-engaged-views` vs `origin/main` (merge-base `cdc8d98` "Merge pull request #624 from nick-vogel/creator-analytics-567-releases-staging")
**Reviewed at:** HEAD `b226ed1` ("creator-analytics#627 hand check: the Shorts player's gap sits inside the pill, where YouTube's margin reset cannot reach it"), clean tree, no uncommitted or untracked files at review time. Whole branch: 15 files, +935 / −54 including the four prior review docs; eight commits since the merge-base (#627's `6336f9d`, `0840eee` and merge `3b3cd56`, the review docs `26cd4b5` and `20aa942`, and the three hand-check commits `013a894`, `275eb51` and `b226ed1`).
**Delta under review:** since `275eb51` ("creator-analytics#627 hand check: the Shorts player leaves space between the channel row and the pill"), the HEAD pre-PR review 4 (`docs/reviews/creator-analytics-120/pre-pr-review-4.md`) reviewed. Two commits: `20aa942` (the review 4 doc) and `b226ed1`. Code delta: 2 files, +26 / −6, in `apps/extension/src/surfaces/render.ts` (the `under-channel-bar` entry of `publicLayouts` and its doc comment) and `apps/extension/src/surfaces/shorts.test.ts` (a `marginsOf` helper and the two margin tests).
**Reviewed against:** nick-vogel/creator-analytics#627 and its acceptance criteria, the #627 hand check of 2026-11-11 (Nick's decision: an 8px gap between the Shorts player's channel row and the pill, every other surface unchanged; `b226ed1`'s message records that Chrome computed the host's 8px as 0px), `CODING_STANDARDS.md` (standards 1 to 3), the Approach decisions of pre-PR reviews 1 to 4, and the W3C CSS Cascade 5 spec's Context criterion (https://www.w3.org/TR/css-cascade-5/#cascade-context, fetched 2026-11-11). The repo has no `CLAUDE.md`.
**Date:** 2026-11-11
**Reviewer:** 1 code-review agent + verify pass (oracle and five mutation runs in a detached scratch worktree at `b226ed1`, removed after)

## What was verified and how

| Check | Method | Result |
| --- | --- | --- |
| Dependencies | `pnpm install --frozen-lockfile` | ok, already up to date |
| Lint | `pnpm lint` (biome, 644 files) | green |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` (all workspaces, extension for Chrome and Firefox) | green |
| Tests | `pnpm test` (Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | first run: 8 red, all `Test timed out in 5000ms` in `apps/api` (`connect.test.ts`, `channel-summary.test.ts`, `revenue-consent.test.ts`, `video-list.test.ts`, `video-revenue.test.ts`), run while the mutation suite ran beside it; the branch touches nothing under `apps/api` or `packages`. Retried after 60s: green, 157 files, 3955 passed, 1 expected fail. Flakes, creator-analytics#310 |
| Browser walk | `pnpm run --if-present test:browser` | green: no CSP violation in 59 steps |
| Cascade claim in the comment: a `:host` rule loses to the page's normal declaration on the host | W3C CSS Cascade 5, Context criterion: "for normal rules the declaration from the outer context wins", and for important rules the inner one | holds. The fix's mechanism is right: no page rule reaches `.pill` in the shadow root, and margin does not inherit |
| Line box claim: a top margin on the inline-flex `.pill` grows the inline-block host above the pill | CSS 2.1 §10.8.1 (atomic inline-level boxes count by their margin box in the line box); the finder's read | holds; the gap is 8px because `.pill` inherits the host's font and line height. No interaction with baseline alignment; the player's separator is `none` (`shorts.ts`, `placePlayer`) |
| `marginsOf` sees every spelling of a margin | jsdom probe by the agent: `[...style]` over `margin-block-start: 8px`, `margin: 8px 0 0`, `margin-top`, `margin-block`, `margin-inline` | every one listed under a `margin*` name; `marginsOf(undefined)` is `undefined`, so a missing rule fails `toEqual([])` |
| Delta's tests against `275eb51` (Phase 4.5 oracle) | scratch worktree at `b226ed1`, `render.ts` put back to `275eb51`, all of `apps/extension/src/surfaces/` run with a scratch vitest config without the database global setup | 1 red: the Shorts player's "leaves space between the channel row and itself" (`shorts.test.ts:550`). 1 green: the Shorts tab's "keeps no space above it" (`:320`), a scope guard that holds the pill first (Reviewed and Dismissed) |
| Mutation: margin on both `:host` and `.pill` | same scratch worktree | 1 red, the player test |
| Mutation: no margin anywhere | same | 1 red, the player test |
| Mutation: `margin-block-start: 8px` on the `inline` layout's pill | same | 1 red, the Shorts tab test |
| Mutation: `margin-top: 8px` in place of `margin-block-start: 8px` | same | 1 red, the player test (it pins the declared property name; Minor) |
| Mutation: 4px in place of 8px | same | 1 red, the player test |
| Mutation: margin on `.pill svg` | the agent's scratch worktree | 0 red (Minor) |
| Live look on youtube.com after `b226ed1` | not run here: #627's hand check | `b226ed1` records the 0px measurement that it fixes; no look at the fixed gap is recorded, nor any Firefox or dark-theme pass (NFI A) |

**Overall:** `b226ed1` moves the Shorts player's 8px from the host, where YouTube's own rule for that element beats a `:host` rule by the cascade's Context step, to `.pill` inside the shadow root, where no page rule reaches. The mechanism is correct by the spec, the two edited tests go red for the regressions they name, and every full check is green after a retry of eight load timeouts in untouched API tests. Nothing CRITICAL, HIGH or MEDIUM; the four LOWs carried from review 4 are untouched, and comment hygiene loses one entry and gains two.

## Approach decisions

- **A pill on a re-pointed tile (carried from reviews 1 to 4):** each tile surface's `sweep` takes down a pill whose tile no longer links the video the pill was drawn for, using the id `pillPlacer` records when it draws. Precedent: the watch page's `sweep` and the Shorts player's `sweep`.
- **The feed's tile id reader (carried):** one module function `videoIdIn(read, tile)` in `feed.ts`, shared by the pass and the sweep.
- **The re-pointed sweep's scan (carried from review 2):** the channel page and Shorts sweeps start from the surface's own pills and walk up with `closest`; the feed's re-pointed scan stays tile-first.
- **The public pill's separator (carried from review 3):** the extension draws its own `aria-hidden` separator inside the pill's shadow root host, before `.pill`, never borrowed from YouTube's markup. Kinds: `dot` on a search result, `space` on a lockup line (channel tabs, home feed), `two-spaces` on the watch page's info line, `none` in the Shorts player, on the Shorts tab and in the watch sidebar's row.
- **The lockup separator's kind (settled by the hand check):** `space` stands; YouTube draws no dot on a lockup line (`::before` content `none`, hand check 2026-11-11).
- **Where a pill sits (carried from review 4):** `pillPlacer.place` takes `after` and an optional `layout` (`inline` default, `row`, `under-channel-bar`), and the host is always `after`'s next sibling, which the keep check relies on. A layout's CSS lives in `publicLayouts` (`render.ts`), declared and never read from the page.
- **Which element carries a layout's spacing (this delta, review 5 records it):** a layout's box spacing goes on `.pill` inside the shadow root, never on `:host`, because a `:host` normal declaration loses to any normal page declaration matching the host (CSS Cascade 5, Context). `:host` keeps only `display`. Precedent: the `row` layout's `white-space: nowrap` already sits on `.pill`.

## Prior-review closure

Review 4 held no MEDIUM-or-higher finding and no Remediation section, so nothing was deferred by decision.

- **Finding 1 (LOW, nothing holds the search pill inline):** untouched (`feed.ts:69`, the search describe at `feed.test.ts:406` unedited). Re-emitted as Finding 1.
- **Finding 2 (LOW, no feed test of the keep rule):** untouched (`public-pages.ts:181`; no keep test added to `feed.test.ts`). Re-emitted as Finding 2.
- **Finding 3 (LOW, four unguarded no-capsule tests):** untouched; the Shorts tab's moved from `shorts.test.ts:306` to `:317` with the new helper above it. Re-emitted as Finding 3.
- **Finding 4 (LOW, the public pill style a third copy):** untouched; `publicLayouts[layout].pill` now also carries the player's margin, which the brief's Must preserve now names. Re-emitted as Finding 4.
- **Finding 5 (Comment hygiene):** partly closed. The `render.ts:138-139` entry ("not a margin on the host") is closed by the delta: the host declares no margin on any layout again, so the sentence is accurate as written. The other six entries are untouched; the `render.ts:458` entry is now `:463`. Re-emitted inside Finding 5 with the delta's two new entries.
- **NFI A (live look at the sidebar row and the Shorts margin):** partly answered: the hand check looked at the Shorts margin in Chrome, measured 0px, and `b226ed1` is the fix. The look at the fixed gap, the sidebar row, Firefox and the dark theme is still not recorded. Carried as NFI A.
- **NFI B (a narrow sidebar overflows):** untouched. Carried as NFI B.

Counts: of 5 prior confirmed findings, 0 fully fixed, 1 partially fixed (Finding 5, one entry of seven), 4 untouched (all LOW); 0 MEDIUM-or-higher open; of 2 NFIs, 1 partly answered, 1 open.

## Confirmed Issues

### 1. Nothing holds the search result's pill inline: it could become a block row and break the line with the suite green — LOW
- **Location:** `apps/extension/src/surfaces/feed.ts:69` (`layout: 'inline'` in `tilesOf['/results']`); the search tests `apps/extension/src/surfaces/feed.test.ts:406-445`
- **Attribution:** introduced in `013a894`, which added the per-page `layout` field (`git log -S"layout: 'inline'" 3b3cd56..HEAD -- apps/extension/src/surfaces/feed.ts` names `013a894`); carried unchanged from pre-PR review 4 Finding 1. Not touched by `b226ed1`.
- **Real-world trigger:** none for a user today; missing coverage of the hand check's "every other surface keeps its inline pill". A later edit to `tilesOf`, for example copying the sidebar's entry, turns the search pill into a block under the view count and pushes "• 1y ago" onto its own line. Capped at LOW: no user path until such an edit; upgrade to MEDIUM if `tilesOf` gains a fourth page kind.

**Evidence**
```ts
  '/results': {
    container: searchResultsIn,
    tilesIn: searchTilesIn,
    hrefIn: searchVideoHrefIn,
    viewCountIn: searchViewCountIn,
    pillAfter: (viewCount) => viewCount,
    separator: 'dot',
    layout: 'inline',
  },
```
The home feed has its guard (`feed.test.ts:374`, "a lockup's pill stays inline in the view count's row…"); the search describe checks the sibling and the dot only.

**Failure mode** — With `layout: 'inline'` changed to `layout: 'row'` for `/results`, all 43 `feed.test.ts` tests pass (review 4's executed mutation; `feed.ts` and `feed.test.ts` are unchanged since).

**Recommended fix** — add, in the `search results` describe after the dot test:
```ts
  test("a result's pill stays inline in its metadata line, directly after the view count, with no row of its own", async () => {
    await showPage({ uploads: mine(searchMine) })

    const pilled = searchResults().filter((tile) => searchMine.includes(tileId(tile)))
    expect(pilled).toHaveLength(7)
    for (const tile of pilled) {
      const host = viewCountOf(tile)?.nextElementSibling
      expect(host?.matches('[data-stillstats-surface="feed"]')).toBe(true)
      expect(declaredFor(host, ':host')?.getPropertyValue('display')).toBe('inline-block')
      expect(declaredFor(host, '.pill')?.getPropertyValue('white-space')).toBe('')
    }
  })
```

**Remediation brief**
- **Design intent:** each feed page kind declares where its pill goes (`pillAfter`) and how its host sits (`layout`) in `tilesOf`; only the watch sidebar is a `row`, because its tiles are narrow (Nick's hand check, 2026-11-11). A search result's line is wide and its pill is one more inline item after "19K views •". jsdom lays nothing out, so the rule is observed through the declared `display` on `:host` and `white-space` on `.pill`, read with `declaredFor`.
- **Full surface:** `feed.test.ts`, the `search results` describe (`:406`); `viewCountOf` in that file already resolves search tiles. `declaredFor` is already imported (`feed.test.ts:31`). No production change.
- **Must preserve:** the home feed guard at `feed.test.ts:374`; the search dot test at `:427` and capsule test at `:438`; `test/page-boundary.test.ts` (no read added to `testing.ts`).
- **Do not touch:** the search pill's placement and separator, which the hand check found correct.
- **Proof:** the new test is green at the fix commit. In a scratch worktree at the fix commit, change `layout: 'inline'` under `separator: 'dot'` in `apps/extension/src/surfaces/feed.ts` to `layout: 'row'` and run `pnpm exec vitest run apps/extension/src/surfaces/feed.test.ts -t "stays inline"` from the worktree root: the new test is red.

### 2. No feed test holds the "kept, not redrawn" rule, so a feed or sidebar pill that flickers on every pass goes green — LOW
- **Location:** `apps/extension/src/surfaces/public-pages.ts:179-181` (the keep check); `apps/extension/src/surfaces/feed.test.ts` (no test of it)
- **Attribution:** pre-existing, exposed; carried unchanged from pre-PR review 4 Finding 2. The keep check predates the branch, and no `feed.test.ts` test compares a host by identity across passes at `cdc8d98`, `3b3cd56` or `b226ed1`. `013a894` gave the sidebar a new keep path (`after` = the metadata row) with no test that the row's host survives a pass.
- **Real-world trigger:** none for a user today: the shared keep check is pinned by 7 Shorts and 3 watch page tests. A feed-only regression would be a `pillAfter` or key part that differs between passes (a `pillAfter` that returns a new wrapper element), which redraws every feed pill on every YouTube change, a visible flicker while scrolling. Capped at LOW: display only, no user path today.

**Evidence**
```ts
      const key = `${videoId} ${view.figure} ${view.name} ${separator} ${layout}`
      const next = after.nextElementSibling
      if (next && shown.get(next) === key) return
```

**Failure mode** — With that `if` made `if (false && next && shown.get(next) === key) return`, every `feed.test.ts` and `channel-page.test.ts` test passes; only `shorts.test.ts` (7) and `watch-page.test.ts` (3) go red (review 4's executed mutation; none of these files changed since but `shorts.test.ts`, whose keep tests are untouched).

**Recommended fix** — add to `the watch page's sidebar` describe (and the same shape in `the home feed`, with `homeTiles` and `homeMine`):
```ts
  test("a sidebar tile's pill is kept as YouTube changes the page, not drawn again", async () => {
    await showPage({ uploads: mine(sidebarMine) })

    const pilled = sidebarTiles().filter((tile) => sidebarMine.includes(tileId(tile)))
    expect(pilled).toHaveLength(3)
    const before = pilled.map(hostBeside)
    for (const host of before) expect(host).toBeDefined()
    await youtubeChanges()
    await youtubeChanges()
    for (const [i, tile] of pilled.entries()) expect(hostBeside(tile)).toBe(before[i])
  })
```

**Remediation brief**
- **Design intent:** `pillPlacer.place` keeps a host that is already `after`'s next sibling with the same key (video, figure, name, separator, layout), so YouTube's redraws and the watcher's passes do not flicker it; it redraws only when something in the key changed or the host moved. The rule is element identity across passes, so a test compares host elements with `toBe`, not equal-shaped pills.
- **Full surface:** `feed.test.ts`, describes `the watch page's sidebar` (`:469`) and `the home feed` (`:347`); helpers already in the file: `showPage` (`:214`), `youtubeChanges` (`:259`), `hostBeside` (`:162`), `sidebarTiles`, `homeTiles`, `sidebarMine`, `homeMine`, `tileId`. No production change.
- **Must preserve:** the Shorts and watch page keep tests that already pin the shared check; the re-pointed tile test (`feed.test.ts:830`), whose kept tile is a different rule (the id still matches).
- **Do not touch:** the keep key's `${separator}` and `${layout}` parts (Minor: unreachable, harmless).
- **Proof:** the new tests are green at the fix commit. In a scratch worktree at the fix commit, change `if (next && shown.get(next) === key) return` in `apps/extension/src/surfaces/public-pages.ts` to `if (false && next && shown.get(next) === key) return` and run `pnpm exec vitest run apps/extension/src/surfaces/feed.test.ts -t "kept"` from the worktree root: both new tests are red.

### 3. Four "no capsule" tests pass when the surface draws no pill at all — LOW
- **Location:** `apps/extension/src/surfaces/feed.test.ts:394` (home feed), `feed.test.ts:443` (search), `feed.test.ts:521` (watch sidebar), `apps/extension/src/surfaces/shorts.test.ts:317` (Shorts tab); the helper `apps/extension/src/surfaces/testing.ts:52-54`
- **Attribution:** introduced in `6336f9d`, carried unchanged from pre-PR reviews 3 (Finding 1) and 4 (Finding 3); `b226ed1` moved the Shorts tab line from `:306` to `:317` without editing it.
- **Real-world trigger:** none for a user; a claim of coverage. A later change that stops the feed or the Shorts tab drawing its pill, or gives it a style of its own, leaves these four green. Capped at LOW: the capsule rule lives in the one shared `publicPillStyle`, which the guarded no-capsule tests (channel tabs `channel-page.test.ts:306`, watch page `watch-page.test.ts:235`, Shorts player `shorts.test.ts:547`) still pin. Upgrade to MEDIUM if a surface ever gets its own public pill style.

**Evidence**
```ts
    for (const tile of pilled) expect(capsuleOf(hostBeside(tile))).toEqual([])
```
```ts
    for (const tile of tiles()) expect(capsuleOf(viewCountOf(tile)?.nextElementSibling)).toEqual([])
```
`capsuleOf(undefined)` returns `[]` (`testing.ts:53-54`, the `?.` chain over `cssRules ?? []`).

**Failure mode** — With `pillPlacer.place` returning at once, these four stayed green while the other #627 tests went red (review 3's executed mutation; the four lines are unchanged since).

**Recommended fix** — guard each on the pill before the capsule check, at `feed.test.ts:394`, `:443` and `:521`:
```diff
-    for (const tile of pilled) expect(capsuleOf(hostBeside(tile))).toEqual([])
+    for (const tile of pilled) {
+      expect(pillBeside(tile)).toEqual(thePill)
+      expect(capsuleOf(hostBeside(tile))).toEqual([])
+    }
```
and at `shorts.test.ts:317`:
```diff
-    for (const tile of tiles()) expect(capsuleOf(viewCountOf(tile)?.nextElementSibling)).toEqual([])
+    for (const tile of tiles()) {
+      expect(pillBesideTile(tile)?.text).toBe('334K engaged views')
+      expect(capsuleOf(viewCountOf(tile)?.nextElementSibling)).toEqual([])
+    }
```

**Remediation brief**
- **Design intent:** AC1 of #627 asks that the no-capsule rule be held on each surface's fixture, so each test first proves a pill was drawn there. `capsuleOf` returns `[]` both for "no capsule" and "no host"; the test tells them apart. In the sidebar, `hostBeside` and `pillBeside` look after the view count's metadata row (`pillPlaceOf`, `feed.test.ts:140`), where `013a894` puts the host.
- **Full surface:** `feed.test.ts:394`, `:443`, `:521`, `shorts.test.ts:317`. Helpers: `pillBeside` (`feed.test.ts:147`), `thePill` (`feed.test.ts:173`), `pillBesideTile` (`shorts.test.ts:120`). Do not change `capsuleOf`'s return for a missing host.
- **Must preserve:** the three guarded no-capsule tests named above; the test names; the 45-tile count at `shorts.test.ts:316`; `test/page-boundary.test.ts` green.
- **Do not touch:** the two Shorts "no separator" tests, kept by review 3's Reviewed and Dismissed; the Shorts tab's "keeps no space above it" test (`shorts.test.ts:320`), already guarded.
- **Proof:** in a scratch worktree at the fix commit, make `pillPlacer.place` return at its first line (insert `return` as the first statement of `place` in `apps/extension/src/surfaces/public-pages.ts`), then run `pnpm exec vitest run apps/extension/src/surfaces/feed.test.ts apps/extension/src/surfaces/shorts.test.ts -t capsule` from the worktree root: every no-capsule test is red. At the fix commit, unmutated, the same command is green.

### 4. The public pill's style is a third copy of the pill layout and icon rules, without the reason for the icon's centring — LOW
- **Location:** `apps/extension/src/surfaces/render.ts:143-149` (`publicPillStyle`), copying the two `.pill` rules of `render.ts:21-24` (`pillStyle`)
- **Attribution:** introduced in `6336f9d`, carried unchanged in substance from pre-PR reviews 3 (Finding 2) and 4 (Finding 4). `b226ed1` did not touch `publicPillStyle`; it put the Shorts player's margin into `publicLayouts['under-channel-bar'].pill`, which this rule appends.
- **Real-world trigger:** none for a user. A maintainer tuning the icon's alignment in `pillStyle`, whose comment (`render.ts:15-20`) is the only place that says why `align-self: center` is there, leaves the public pill behind. Standard 3 names the third copy as a walked-past refactor.

**Evidence**
```ts
const publicPillStyle = (layout: PillLayout) => `
:host { ${publicLayouts[layout].host} }
.separator { font: inherit; color: inherit; }
.separator.dot { margin-inline: 4px; }
.pill { display: inline-flex; align-items: baseline; gap: 0.35em; font: inherit; color: inherit;${publicLayouts[layout].pill} }
.pill svg { height: 1em; width: 1em; flex: none; align-self: center; }
`
```

**Failure mode** — Two pill styles that must lay the mark and words out the same way are held in step by hand.

**Recommended fix** — share the layout declarations and the icon rule, keeping exactly one `.pill` rule in each stylesheet (`declaredFor`, `testing.ts:39-44`, returns the first rule whose `selectorText` matches, so a second `.pill` rule would hide the capsule from Studio's reads, and the sidebar's `nowrap` and the player's margin from theirs):
```diff
-const pillStyle = `
-.pill { display: inline-flex; align-items: baseline; gap: 0.35em; padding: 0.15em 0.6em; border-radius: 999px; background: color-mix(in srgb, currentColor 12%, transparent); font: inherit; color: inherit; }
-.pill svg { height: 1em; width: 1em; flex: none; align-self: center; }
-`
+const pillLayout = 'display: inline-flex; align-items: baseline; gap: 0.35em; font: inherit; color: inherit;'
+
+const pillIconStyle = '.pill svg { height: 1em; width: 1em; flex: none; align-self: center; }'
+
+const pillStyle = `
+.pill { ${pillLayout} padding: 0.15em 0.6em; border-radius: 999px; background: color-mix(in srgb, currentColor 12%, transparent); }
+${pillIconStyle}
+`
```
and in `publicPillStyle`:
```diff
-.pill { display: inline-flex; align-items: baseline; gap: 0.35em; font: inherit; color: inherit;${publicLayouts[layout].pill} }
-.pill svg { height: 1em; width: 1em; flex: none; align-self: center; }
+.pill { ${pillLayout}${publicLayouts[layout].pill} }
+${pillIconStyle}
```
`pillLayout` and `pillIconStyle` must be declared above `pillStyle`, whose template is evaluated at module load.

**Remediation brief**
- **Design intent:** every shadow root host gets its own `<style>`; Studio's hosts take `pillStyle` (a capsule), a public page host takes `publicPillStyle(layout)` (no capsule, plus its layout's host rule and any pill rule: the sidebar row's `white-space: nowrap`, and since `b226ed1` the Shorts player's `margin-block-start: 8px`, which must stay on `.pill` and off `:host` per the Approach decision "Which element carries a layout's spacing"). Mark and words align the same way in both, so the layout has one home; the capsule and the layout's additions are what differ.
- **Full surface:** `render.ts:15-24` (`pillStyle` and its comment: the centring sentences move to `pillIconStyle`, the tint sentence stays on `pillStyle`), `render.ts:143-149` (`publicPillStyle`). Users of `pillStyle` stay as they are: `rowStyle` (from `render.ts:34`), `cellStyle` (from `:54`), `headingStyle` (from `:88`).
- **Must preserve:** one `.pill` rule per stylesheet; Studio's declared styles (every Studio test that reads the pill through `declaredFor`: `grep -rn "declaredFor(" apps/extension/src/surfaces/*.test.ts`); every no-capsule test green; the sidebar's `.pill` `white-space: nowrap` (`feed.test.ts`, "a sidebar tile's pill row is a block…"); the home feed's `white-space` read as `''` (`feed.test.ts:374`); the Shorts player's `.pill` margins read as exactly `['margin-block-start: 8px']` and its `:host` as `[]` (`shorts.test.ts:550`), and the Shorts tab's both `[]` (`shorts.test.ts:320`); `test/page-boundary.test.ts`.
- **Do not touch:** `figureStyle` (`render.ts:111-117`); the `.separator` rules; `publicLayouts`.
- **Proof:** `pnpm exec vitest run apps/extension/src/surfaces/` green before and after, plus `pnpm lint` and `pnpm typecheck`. A pure refactor has no red-before-green; the mutation "capsule back on the public pill" (add `padding: 0.15em 0.6em;` to the public `.pill` rule) must still turn the no-capsule tests red after it, and moving the player's margin to `publicLayouts['under-channel-bar'].host` must still turn `shorts.test.ts`'s "leaves space between the channel row and itself" red.

### 5. Comment hygiene — LOW (aggregated)
- `apps/extension/src/surfaces/render.ts:165-167` — "YouTube's stylesheet resets that element's margin, so Chrome computed the host's 8px as 0px" → "Chrome computed the host's 8px as 0px in #627's hand check (2026-11-11), so a page rule matching that element sets its margin" (new in `b226ed1`: the 0px is what was measured; which YouTube rule wins was not read, and the saved fixtures carry no styles. The mechanism holds either way.)
- `apps/extension/src/surfaces/shorts.test.ts:556-557` — "(creator-analytics#627's hand check measured 0px in Chrome)" → "(creator-analytics#627's hand check measured 0px in Chrome, 2026-11-11)" (new; standard 1, a measured value names its date).
- `apps/extension/src/surfaces/render.ts:463` — "in a lockup's metadata line (the channel tabs, the home feed and the watch sidebar), with no dot" → "in a lockup's metadata line (the channel tabs and the home feed), with no dot" (carried; the sidebar is `none`).
- `apps/extension/src/surfaces/render.ts:131-132` — "The engaged views pill on a public page, inline directly after YouTube's view count in a tile's metadata line, as one more of YouTube's metadata items" → "The engaged views pill on a public page, after the element its `PillLayout` follows (inline after YouTube's view count in most tiles' metadata lines), as one more of YouTube's metadata items" (carried).
- `apps/extension/src/surfaces/render.ts:139-141` — "The dot's 4px each side is YouTube's usual metadata dot margin, declared and never read from the page, which test/page-boundary.test.ts forbids; the hand check tunes it." → "The dot's 4px each side is declared and never read from the page, which test/page-boundary.test.ts forbids; #627's hand check (2026-11-11) found it matching YouTube's dot on a search result." (carried).
- `apps/extension/src/surfaces/public-pages.ts:145` — "drawn inside the pill so the pill stays that element's next sibling" → "drawn inside the host before the pill, so the host stays that element's next sibling" (carried).
- `apps/extension/src/surfaces/testing.ts:48` — "what would draw a capsule around the pill" → "the declarations the old capsule was drawn with; a box-shadow or outline is not counted" (carried).
- `apps/extension/src/surfaces/feed.test.ts:11-13` — the Limits header's edited sentences run to 184, 124 and 102 characters beside lines wrapped at 100 → re-wrap at 100; the same for `channel-page.test.ts:8` and `:10` and `watch-page.test.ts:10` (carried).

## Needs Further Investigation

### A. The fixed Shorts gap and the sidebar row have not been looked at live — confirm on a staging build from `b226ed1` in Chrome: in the Shorts player, `getComputedStyle(pillHost.shadowRoot.querySelector('.pill')).marginBlockStart` is `8px` and the gap under the channel row reads right; on a watch page whose sidebar holds one of Nick's videos, the pill sits on its own line under "N views • date" and does not wrap or overflow the tile. Then the same in Firefox, and both in the dark theme, which AC4 asks for and no note records.

### B. A sidebar tile narrower than the pill's text lets it overflow rather than wrap — confirm in A's check on the narrowest sidebar. `white-space: nowrap` with no overflow rule is a reversible assumption in #627's notes ("Reverse by: adding an overflow rule to the `row` entry of `publicLayouts`").

## Reviewed and Dismissed
- The `:host` claim in the new comment is wrong — the W3C CSS Cascade 5 Context criterion says the outer context's normal declaration wins over the shadow tree's, which is exactly the claim; the 0px measurement agrees (an inline-block's margins do not collapse, so a computed 0px means a page declaration won).
- A margin on an inline-level `.pill` does not open a gap — `.pill` is `inline-flex`, an atomic inline, whose margin box sizes the line box (CSS 2.1 §10.8.1), so the inline-block host grows above it; vertical margins are ignored only on non-atomic inline boxes.
- `display: inline-block` on `:host` is as exposed as the margin was — true, and harmless: in a block or inline-block host, or a host a flex parent blockifies, the pill's margin still opens the gap. Not changed by this delta.
- The Shorts tab's "keeps no space above it" test is vacuous for being green at `275eb51` — it is a scope guard for "the player's top margin is the player's alone", it holds the pill text first, and the mutation that puts the margin on the `inline` layout turns it red. Keep it.
- `marginsOf` misses a shorthand or a physical margin — jsdom lists every spelling under a `margin*` name (agent's probe); the property-name strictness is a Minor.
- The new margin leaks to the Studio pill — `pillStyle` is a separate stylesheet and `publicLayouts` reaches only `publicPillStyle`.

## Minor / nits
- `shorts.test.ts:327-328` reads margins on `:host` and `.pill` only, so a margin added to `.pill svg` or `.separator` passes the "player's alone" test (agent's mutation: 0 red); a sheet-wide scan would need to allow `.separator.dot`'s `margin-inline: 4px`.
- No test holds the `row` layout (watch sidebar) free of a top margin; the delta did not touch `row`.
- The player test pins `margin-block-start` by name, so an equivalent `margin-top: 8px` goes red (executed); acceptable, since the declared value is the contract.
- `marginsOf` (`shorts.test.ts:96-103`) is the same prefix filter over `[...style]` as `capsuleOf` (`testing.ts:52-64`); a shared helper taking a property pattern would serve both.
- Carried from review 4: `feed.ts:147` `if (read.pillAfter(viewCount) !== after) continue` unreachable; `feed.ts:149` destructuring rebuilt per tile; `feed.ts:46` and `:67` repeat search's defaults; `feed.test.ts:495-496` checks that cannot fail; `feed.test.ts:134-145` restates `metadataRowOf` as an oracle; the keep key's `${separator}` and `${layout}` parts pinned by nothing; `.separator { font: inherit; color: inherit; }` redundant; `place()` takes per-page constants on every call; the channel tab separator tests' names overclaim the next-sibling clause; `hostBeside` copied into three test files.

## Test quality
Tests edited in the delta: 2 (Shorts tab "keeps no space above it", Shorts player "leaves space between the channel row and itself") plus one helper, `marginsOf` · green at `275eb51`: 1, the tab's scope guard, kept (Reviewed and Dismissed) · tautology shapes found: 0 (expectations are literals, not `publicLayouts`; no mock, call-shaped or snapshot assertion; a missing rule fails rather than passes) · mutations: margin back on the host, on both, on neither, at 4px, or leaked to the `inline` layout each turn one test red; a margin on `.pill svg` turns none (Minor). The carried gaps are Findings 1 to 3.

## Before opening the PR
- **CI readiness:** `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` (after one retry of eight API load timeouts, creator-analytics#310) and `pnpm test:browser` green at `b226ed1`.
- **Commit hygiene:** clean tree; `b226ed1` plus this review doc on top of review 4's `20aa942`.
- **Notes to bring in line:** #627's assumption log still says the Shorts player's 8px is "`margin-block-start` on the player host's `:host`"; since `b226ed1` it is on `.pill`, and the reverse-by line should name the `pill` half of the `under-channel-bar` entry. #627's AC2 still names the watch sidebar among the lockup lines with a separator; the sidebar has no separator and a row of its own by Nick's hand-check decision (carried from review 4).
- **Likely reviewer asks:** the Firefox and dark-theme passes of AC4 (NFI A); why the Shorts margin sits on `.pill` and not the host (Approach decisions, "Which element carries a layout's spacing").

## Verdict
Ready to open the PR (or push to PR #629), with follow-ups. Gate: none in code; no CRITICAL, HIGH or MEDIUM finding is open, and no prior MEDIUM-or-higher finding exists to close. `b226ed1` fixes the 0px gap the hand check measured, by a mechanism the cascade spec confirms, with tests that go red for it. Findings 1 to 4 are the LOWs carried untouched from review 4, and Finding 5 is comment hygiene (one entry closed by the delta, two added); all can ride along or ship as follow-ups. The confirmed list holds only test and comment quality for the second round running, the expected shrink for a re-review. The remaining risk is visual and sits in NFI A, the live look at the fixed Shorts gap and the sidebar row in Chrome and Firefox, light and dark, which gates closing #627.
