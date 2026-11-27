# Pre-PR review: creator-analytics#120 Extension: engaged views on YouTube's public pages

**Branch:** `creator-analytics-120-youtube-engaged-views` vs `origin/main` (merge-base `cdc8d98` "Merge pull request #624 from nick-vogel/creator-analytics-567-releases-staging")
**Reviewed at:** HEAD `275eb51` ("creator-analytics#627 hand check: the Shorts player leaves space between the channel row and the pill"), clean tree, no uncommitted or untracked files at review time. Whole branch: 13 files, +644 / −54, six commits since the merge-base (#627's `6336f9d`, `0840eee` and merge `3b3cd56`, the review 3 doc `26cd4b5`, and the two hand-check commits).
**Delta under review:** since `3b3cd56` (the merge of #627, "creator-analytics#627 Public pages: make the engaged views pill read as one of YouTube's metadata items, not a badge on top"), the HEAD pre-PR review 3 (`docs/reviews/creator-analytics-120/pre-pr-review-3.md`) reviewed. Three commits: `26cd4b5` (the review 3 doc), `013a894` ("creator-analytics#627 hand check: the watch sidebar shows the pill on its own row under the view count, so a narrow tile does not break it") and `275eb51` (the Shorts player's 8px top margin). Code delta: 9 files, +186 / −47, in `apps/extension/src/selectors/lockup.ts` and `apps/extension/src/surfaces/` (`channel-page.ts`, `feed.ts`, `feed.test.ts`, `public-pages.ts`, `render.ts`, `shorts.ts`, `shorts.test.ts`, `watch-page.ts`).
**Reviewed against:** nick-vogel/creator-analytics#627 and its acceptance criteria, the #627 hand check notes of 2026-11-11 (Nick's decision: the watch sidebar's pill on a row of its own with no separator, and a declared top margin on the Shorts player's pill; every other surface unchanged), `CODING_STANDARDS.md` (standards 1 to 3), and the Approach decisions of pre-PR reviews 1 to 3. The repo has no `CLAUDE.md`.
**Date:** 2026-11-11
**Reviewer:** 1 code-review agent + verify pass (oracle and five mutation runs in a detached scratch worktree at `275eb51`)

## What was verified and how

| Check | Method | Result |
| --- | --- | --- |
| Dependencies | `pnpm install --frozen-lockfile` | ok, lockfile unchanged |
| Lint | `pnpm lint` (biome, 644 files) | green |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` (all workspaces, extension for Chrome and Firefox) | green |
| Tests | `pnpm test` (Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | green: 157 files, 3955 passed, 1 expected fail |
| Browser walk | `pnpm run --if-present test:browser` | green: no CSP violation in 59 steps |
| Page boundary | `test/page-boundary.test.ts` (in the full run, and run alone by the agent) | green; the delta adds no `textContent` or `getAttribute` read in `src/surfaces/` |
| Feed pill paths assume "the view count's next sibling" | grep of `nextElementSibling` / `previousElementSibling` in non-test `src/`, read of `takeDownAllBut`, `sweep`, `takeDownRepointed`, `removeSurface` | none do: the only sibling read is `after.nextElementSibling` in `pillPlacer.place` (`public-pages.ts:180`); removal walks ancestors or queries within the tile, and the sidebar's host is still inside the tile |
| Watch page surface on `/watch` beside the sidebar host | read of `watch-page.ts` | separate surface (`watch_page`), scoped to `ytd-watch-metadata`; cannot keep or remove a feed host; default inline layout |
| Studio styles unchanged | diff of `render.ts` since `3b3cd56` | only `publicPillStyle`, `publicLayouts`, `PillLayout` and `renderEngagedViewsPill` change; `pillStyle` and its users untouched |
| Delta's tests against `3b3cd56` (Phase 4.5 oracle) | scratch worktree at `275eb51`, the seven non-test source files put back to `3b3cd56`, `feed.test.ts` and `shorts.test.ts` run with a scratch vitest config without the database global setup | 6 red: the two new sidebar tests, the Shorts player margin test, and three existing sidebar tests whose `pillBeside` now looks after the row. 2 new tests green: the home feed "stays inline" and the Shorts tab "no space above" guards (see Test quality) |
| Mutation: row pill may wrap (`white-space: nowrap` removed from `publicLayouts.row`) | same scratch worktree | 1 red: "a sidebar tile's pill row is a block…" |
| Mutation: search given `layout: 'row'` (`feed.ts`, `/results`) | same | 0 red in `feed.test.ts` (Finding 1) |
| Mutation: keep check off (`if (false && next && shown.get(next) === key) return`, `public-pages.ts:181`) | same, all of `apps/extension/src/surfaces/` | 10 red, all in `shorts.test.ts` (7) and `watch-page.test.ts` (3); 0 in `feed.test.ts` and `channel-page.test.ts` (Finding 2) |
| Mutation: `${layout}` dropped from the keep key | same, all of `src/surfaces/` | 0 red; unreachable, since layout is constant per page kind (Minor) |
| Mutation: `if (read.pillAfter(viewCount) !== after) continue` deleted (`feed.ts:147`) | same | 0 red; unreachable (Minor) |
| Live look on youtube.com | not run here: #627's hand check | Nick's hand check in Chrome (closeout notes, 2026-11-11) settled review 3's NFI A to C; the sidebar row and the Shorts margin were synced to the staging builds but no re-check of them is recorded, nor any Firefox or dark-theme pass |

**Overall:** The two hand-check commits do what Nick decided: the sidebar's pill is a block row directly after the view count's metadata row with no separator and a pill that does not wrap, the Shorts player's host declares an 8px top margin, and every other surface keeps its inline pill. No code path relied on the pill being the view count's sibling, so the sweeps and removals still find the sidebar host. Every full check is green. Nothing CRITICAL, HIGH or MEDIUM; two new LOW test gaps, the two LOWs carried from review 3, and comment hygiene.

## Approach decisions

- **A pill on a re-pointed tile (carried from reviews 1 to 3):** each tile surface's `sweep` takes down a pill whose tile no longer links the video the pill was drawn for, using the id `pillPlacer` records when it draws. Precedent: the watch page's `sweep` and the Shorts player's `sweep`.
- **The feed's tile id reader (carried):** one module function `videoIdIn(read, tile)` in `feed.ts`, shared by the pass and the sweep.
- **The re-pointed sweep's scan (carried from review 2):** the channel page and Shorts sweeps start from the surface's own pills and walk up with `closest`; the feed's re-pointed scan stays tile-first.
- **The public pill's separator (carried from review 3):** the extension draws its own `aria-hidden` separator inside the pill's shadow root host, before `.pill`, never borrowed from YouTube's markup. Kinds: `dot` on a search result, `space` on a lockup line (channel tabs, home feed), `two-spaces` on the watch page's info line, `none` in the Shorts player, on the Shorts tab and in the watch sidebar's row.
- **The lockup separator's kind (settled by the hand check):** `space` stands. On the channel Videos tab `getComputedStyle(.ytContentMetadataViewModelDelimiter, '::before').content` printed `none` (hand check, 2026-11-11), so YouTube draws no dot on a lockup line.
- **Where a pill sits (this delta, review 4 records it):** `pillPlacer.place` takes `after`, the element the pill follows, and an optional `layout` (`PillLayout`: `inline` default, `row`, `under-channel-bar`), and the host is always `after`'s next sibling, which the keep check relies on. Each feed page kind names its `pillAfter` and `layout` in `tilesOf` (`feed.ts`); the sidebar takes `metadataRowOf` and `row`. A layout's CSS lives in `publicLayouts` (`render.ts`), declared and never read from the page. Precedent: the Shorts player already passed its channel bar where the view count went.

## Prior-review closure

Review 3 held no MEDIUM-or-higher finding and no Remediation section, so nothing was deferred by decision.

- **Finding 1 (LOW, four "no capsule" tests pass with no pill drawn):** untouched. The four tests are unedited at `feed.test.ts:394`, `:443`, `:521` and `shorts.test.ts:306`. The delta's new sidebar and home tests do guard on the host, which pins presence beside the sidebar and home capsule tests, but the capsule tests themselves still read `capsuleOf(undefined)` as `[]`. Re-emitted as Finding 3.
- **Finding 2 (LOW, `publicPillStyle` copies `pillStyle`'s layout rules):** untouched; `publicPillStyle` became a function of the layout and still repeats the two `.pill` rules. Re-emitted as Finding 4.
- **Finding 3 (Comment hygiene):** partly worse. The `public-pages.ts` doc comment was rewritten by `013a894` and keeps the inaccurate "drawn inside the pill" clause; the `render.ts:131` opener is now wrong for two surfaces, not one; the `feed.test.ts` Limits header gained a 184-character line. Re-emitted inside Finding 5 with the delta's new entries.
- **NFI A (lockup dot):** closed by the hand check (no dot; `space` stands).
- **NFI B (search date's dot beside the host):** closed by the hand check ("dot before the pill and before the date").
- **NFI C (watch page spacer):** closed by the hand check (Nick: the watch page under the title is correct).
- **NFI D (a narrow tile wraps the pill):** superseded on the watch sidebar, where it happened, by `013a894`'s row. Not seen on the channel tabs or home feed.

Counts: of 3 prior confirmed findings, 0 fully fixed, 0 partially fixed, 3 untouched (all LOW); 0 MEDIUM-or-higher open; of 4 NFIs, 4 closed by the hand check or the delta.

## Confirmed Issues

### 1. Nothing holds the search result's pill inline: it could become a block row and break the line with the suite green — LOW
- **Location:** `apps/extension/src/surfaces/feed.ts:69` (`layout: 'inline'` in `tilesOf['/results']`); the search tests `apps/extension/src/surfaces/feed.test.ts:406-445`
- **Attribution:** introduced in `013a894`, which added the per-page `layout` field (`git log -S"layout: 'inline'" 3b3cd56..HEAD -- apps/extension/src/surfaces/feed.ts` names `013a894`). At `3b3cd56` every feed pill was inline by construction, so no test was needed.
- **Real-world trigger:** none for a user today; this is missing coverage of a rule the commit states ("every other surface keeps its inline pill as it was"). A later edit to `tilesOf`, for example copying the sidebar's entry as a starting point, turns the search pill into a block under the view count and pushes "• 1y ago" onto its own line. Capped at LOW: no user path until such an edit; upgrade to MEDIUM if `tilesOf` gains a fourth page kind.

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
The home feed got its guard (`feed.test.ts:374`, "a lockup's pill stays inline in the view count's row…"); the search describe checks the sibling and the dot only, and `pillBeside` still finds the host after the view count whatever its `display`.

**Failure mode** — With `layout: 'inline'` changed to `layout: 'row'` for `/results`, all 43 `feed.test.ts` tests pass (executed in the scratch worktree).

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
- **Full surface:** `feed.test.ts`, the `search results` describe (`:406`); `viewCountOf` in that file already resolves search tiles (the dot test uses it through `pillBeside`). `declaredFor` is already imported (`feed.test.ts:31`). No production change.
- **Must preserve:** the home feed guard at `feed.test.ts:374`; the search dot test at `:427` and capsule test at `:438`; `test/page-boundary.test.ts` (no read added to `testing.ts`).
- **Do not touch:** the search pill's placement and separator, which the hand check found correct.
- **Proof:** the new test is green at the fix commit. In a scratch worktree at the fix commit, change `layout: 'inline'` under `separator: 'dot'` in `apps/extension/src/surfaces/feed.ts` to `layout: 'row'` and run `pnpm exec vitest run apps/extension/src/surfaces/feed.test.ts -t "stays inline"` from the worktree root: the new test is red.

### 2. No feed test holds the "kept, not redrawn" rule, so a feed or sidebar pill that flickers on every pass goes green — LOW
- **Location:** `apps/extension/src/surfaces/public-pages.ts:179-181` (the keep check); `apps/extension/src/surfaces/feed.test.ts` (no test of it)
- **Attribution:** pre-existing, exposed. The keep check predates the branch, and no `feed.test.ts` test of a kept host exists at `cdc8d98` or `3b3cd56` (grep of both for a host compared by identity across passes finds only the re-pointed tile test, which checks ids). `013a894` gives the sidebar a new keep path, `after` = the metadata row, with no test that the row's host survives a pass.
- **Real-world trigger:** none for a user today: the shared keep check is pinned by 7 Shorts and 3 watch page tests. A feed-only regression would be a `pillAfter` or key part that differs between passes (for example a `pillAfter` that returns a new wrapper element), which redraws every feed pill on every YouTube change, a visible flicker while scrolling. Capped at LOW: display only, no user path today.

**Evidence**
```ts
      const key = `${videoId} ${view.figure} ${view.name} ${separator} ${layout}`
      const next = after.nextElementSibling
      if (next && shown.get(next) === key) return
```

**Failure mode** — With that `if` made `if (false && next && shown.get(next) === key) return`, every `feed.test.ts` and `channel-page.test.ts` test passes; only `shorts.test.ts` (7) and `watch-page.test.ts` (3) go red (executed in the scratch worktree).

**Recommended fix** — add to `the watch page's sidebar` describe (and the same shape in `the home feed`):
```ts
  test("a sidebar tile's pill is kept as YouTube changes the page, not drawn again", async () => {
    await showPage({ uploads: mine(sidebarMine) })

    const pilled = sidebarTiles().filter((tile) => sidebarMine.includes(tileId(tile)))
    expect(pilled).toHaveLength(3)
    const before = pilled.map(hostBeside)
    for (const host of before) expect(host).toBeDefined()
    await youtubeChanges()
    await youtubeChanges()
    expect(pilled.map(hostBeside)).toEqual(before)
    for (const [i, tile] of pilled.entries()) expect(hostBeside(tile)).toBe(before[i])
  })
```

**Remediation brief**
- **Design intent:** `pillPlacer.place` keeps a host that is already `after`'s next sibling with the same key (video, figure, name, separator, layout), so YouTube's redraws and the watcher's passes do not flicker it; it redraws only when something in the key changed or the host moved. The rule is element identity across passes, so a test must compare host elements with `toBe`, not equal-shaped pills.
- **Full surface:** `feed.test.ts`, describes `the watch page's sidebar` (`:469`) and `the home feed` (`:347`); helpers already in the file: `showPage` (`:214`), `youtubeChanges` (`:259`), `hostBeside` (`:162`), `sidebarTiles`, `homeTiles`, `sidebarMine`, `homeMine`, `tileId`. No production change.
- **Must preserve:** the Shorts and watch page keep tests that already pin the shared check (the 10 named in the mutation row of this doc's table); the re-pointed tile test (`feed.test.ts:830`), whose kept tile is a different rule (the id still matches).
- **Do not touch:** the keep key's `${separator}` and `${layout}` parts (Minor: unreachable, harmless).
- **Proof:** the new tests are green at the fix commit. In a scratch worktree at the fix commit, change `if (next && shown.get(next) === key) return` in `apps/extension/src/surfaces/public-pages.ts` to `if (false && next && shown.get(next) === key) return` and run `pnpm exec vitest run apps/extension/src/surfaces/feed.test.ts -t "kept"` from the worktree root: both new tests are red.

### 3. Four "no capsule" tests pass when the surface draws no pill at all — LOW
- **Location:** `apps/extension/src/surfaces/feed.test.ts:394` (home feed), `feed.test.ts:443` (search), `feed.test.ts:521` (watch sidebar), `apps/extension/src/surfaces/shorts.test.ts:306` (Shorts tab); the helper `apps/extension/src/surfaces/testing.ts:52-54`
- **Attribution:** introduced in `6336f9d`, carried unchanged from pre-PR review 3 Finding 1; the delta did not touch these four lines.
- **Real-world trigger:** none for a user; a claim of coverage. A later change that stops the feed or the Shorts tab drawing its pill, or gives it a style of its own, leaves these four green. Capped at LOW: the capsule rule lives in the one shared `publicPillStyle`, which the guarded no-capsule tests (channel tabs `channel-page.test.ts:306`, watch page `watch-page.test.ts:235`, Shorts player `shorts.test.ts:535`) still pin. Upgrade to MEDIUM if a surface ever gets its own public pill style.

**Evidence**
```ts
    for (const tile of pilled) expect(capsuleOf(hostBeside(tile))).toEqual([])
```
```ts
    for (const tile of tiles()) expect(capsuleOf(viewCountOf(tile)?.nextElementSibling)).toEqual([])
```
`capsuleOf(undefined)` returns `[]` (`testing.ts:53-54`, the `?.` chain over `cssRules ?? []`).

**Failure mode** — With `pillPlacer.place` returning at once, these four stayed green while the other new #627 tests went red (review 3's executed mutation; the four lines are unchanged since).

**Recommended fix** — guard each on the pill before the capsule check:
```diff
-    for (const tile of pilled) expect(capsuleOf(hostBeside(tile))).toEqual([])
+    for (const tile of pilled) {
+      expect(pillBeside(tile)).toEqual(thePill)
+      expect(capsuleOf(hostBeside(tile))).toEqual([])
+    }
```
(at `feed.test.ts:394`, `:443` and `:521`), and at `shorts.test.ts:306`:
```diff
-    for (const tile of tiles()) expect(capsuleOf(viewCountOf(tile)?.nextElementSibling)).toEqual([])
+    for (const tile of tiles()) {
+      expect(pillBesideTile(tile)?.text).toBe('334K engaged views')
+      expect(capsuleOf(viewCountOf(tile)?.nextElementSibling)).toEqual([])
+    }
```

**Remediation brief**
- **Design intent:** AC1 of #627 asks that the no-capsule rule be held on each surface's fixture, so each test must first prove a pill was drawn there. `capsuleOf` returns `[]` both for "no capsule" and "no host"; the test tells them apart. In the sidebar, `hostBeside` and `pillBeside` look after the view count's metadata row (`pillPlaceOf`, `feed.test.ts:140`), which is where `013a894` puts the host.
- **Full surface:** `feed.test.ts:394`, `:443`, `:521`, `shorts.test.ts:306`. Helpers: `pillBeside` (`feed.test.ts:147`), `thePill` (`feed.test.ts:173`), `pillBesideTile` (`shorts.test.ts:109`). Do not change `capsuleOf`'s return for a missing host.
- **Must preserve:** the three guarded no-capsule tests named above; the test names; the 45-tile count in `shorts.test.ts:305`; `test/page-boundary.test.ts` green.
- **Do not touch:** the two Shorts "no separator" tests, kept by review 3's Reviewed and Dismissed.
- **Proof:** in a scratch worktree at the fix commit, make `pillPlacer.place` return at its first line (insert `return` as the first statement of `place` in `apps/extension/src/surfaces/public-pages.ts`), then run `pnpm exec vitest run apps/extension/src/surfaces/feed.test.ts apps/extension/src/surfaces/shorts.test.ts -t capsule` from the worktree root: every no-capsule test is red. At the fix commit, unmutated, the same command is green.

### 4. The public pill's style is a third copy of the pill layout and icon rules, without the reason for the icon's centring — LOW
- **Location:** `apps/extension/src/surfaces/render.ts:143-149` (`publicPillStyle`, now a function of the layout), copying the two `.pill` rules of `render.ts:21-24` (`pillStyle`)
- **Attribution:** introduced in `6336f9d`, carried unchanged in substance from pre-PR review 3 Finding 2; `013a894` turned `publicPillStyle` into a function and appended `publicLayouts[layout].pill` to the copied `.pill` rule.
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

**Recommended fix** — share the layout declarations and the icon rule, keeping exactly one `.pill` rule in each stylesheet. Review 3's recommended diff split `.pill` into two rules; that is withdrawn, because `declaredFor` (`testing.ts:39-44`) returns the first rule whose `selectorText` matches, so a second `.pill` rule hides the capsule from Studio's `declaredFor` reads and the sidebar's `nowrap` from its test.
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
- **Design intent:** every shadow root host gets its own `<style>`; Studio's hosts take `pillStyle` (a capsule), a public page host takes `publicPillStyle(layout)` (no capsule, plus its layout's host rule and any pill rule, today only the sidebar row's `white-space: nowrap`). Mark and words align the same way in both, so the layout has one home; the capsule and the layout's additions are what differ.
- **Full surface:** `render.ts:15-24` (`pillStyle` and its comment: the centring sentences move to `pillIconStyle`, the tint sentence stays on `pillStyle`), `render.ts:143-149` (`publicPillStyle`). Users of `pillStyle` stay as they are: `rowStyle` (`render.ts:42`), `cellStyle` (`render.ts:59`), `headingStyle` (`render.ts:92`).
- **Must preserve:** one `.pill` rule per stylesheet, since `declaredFor` (`testing.ts:39-44`) reads only the first match; Studio's declared styles (every Studio test that reads the pill through `declaredFor`: `grep -rn "declaredFor(" apps/extension/src/surfaces/*.test.ts`); every no-capsule test green; the sidebar's `.pill` `white-space: nowrap` (`feed.test.ts`, "a sidebar tile's pill row is a block…"); the home feed's `white-space` read as `''` (`feed.test.ts:374`); `test/page-boundary.test.ts`.
- **Do not touch:** `figureStyle` (`render.ts:111-117`); the `.separator` rules; `publicLayouts`.
- **Proof:** `pnpm exec vitest run apps/extension/src/surfaces/` green before and after, plus `pnpm lint` and `pnpm typecheck`. A pure refactor has no red-before-green; the mutation "capsule back on the public pill" (add `padding: 0.15em 0.6em;` to the public `.pill` rule) must still turn the no-capsule tests red after it.

### 5. Comment hygiene — LOW (aggregated)
- `apps/extension/src/surfaces/render.ts:458` — "in a lockup's metadata line (the channel tabs, the home feed and the watch sidebar), with no dot" → "in a lockup's metadata line (the channel tabs and the home feed), with no dot" (the sidebar is now `none`, and the same comment lists it there too).
- `apps/extension/src/surfaces/render.ts:131-132` — "The engaged views pill on a public page, inline directly after YouTube's view count in a tile's metadata line, as one more of YouTube's metadata items" → "The engaged views pill on a public page, after the element its `PillLayout` follows (inline after YouTube's view count in most tiles' metadata lines), as one more of YouTube's metadata items".
- `apps/extension/src/surfaces/render.ts:138-139` — "The space before the pill is its separator's (`PillSeparator`), not a margin on the host" → "The space before the pill on its line is its separator's (`PillSeparator`), not an inline margin on the host" (the Shorts player's host now declares a block-start margin).
- `apps/extension/src/surfaces/render.ts:139-141` — "The dot's 4px each side is YouTube's usual metadata dot margin, declared and never read from the page, which test/page-boundary.test.ts forbids; the hand check tunes it." → "The dot's 4px each side is declared and never read from the page, which test/page-boundary.test.ts forbids; #627's hand check (2026-11-11) found it matching YouTube's dot on a search result." (carried from review 3, now with the hand check's result).
- `apps/extension/src/surfaces/public-pages.ts:144-145` — "drawn inside the pill so the pill stays that element's next sibling" → "drawn inside the host before the pill, so the host stays that element's next sibling" (carried from review 3; `013a894` rewrote the sentence around it).
- `apps/extension/src/surfaces/testing.ts:48` — "what would draw a capsule around the pill" → "the declarations the old capsule was drawn with; a box-shadow or outline is not counted" (carried).
- `apps/extension/src/surfaces/feed.test.ts:11-13` — the Limits header's edited sentences run to 184, 124 and 102 characters beside lines wrapped at 100 → re-wrap at 100; the same for `channel-page.test.ts:8` and `:10` and `watch-page.test.ts:10` (carried).

## Needs Further Investigation

### A. The sidebar row and the Shorts player margin have not been looked at live since the fix — confirm on the staging build in Chrome: on a watch page whose sidebar holds one of Nick's videos, the pill sits on its own line under "N views • date" and does not wrap or overflow the tile; in the Shorts player, the 8px gap under the channel row reads right. Then the same in Firefox, and both in the dark theme, which AC4 also asks for and the closeout notes do not record.

### B. A sidebar tile narrower than the pill's text lets it overflow rather than wrap — confirm in A's check on the narrowest sidebar (a narrow window, where YouTube moves the sidebar under the video and widens it, is the opposite case). `white-space: nowrap` with no overflow rule is recorded as a reversible assumption in #627's notes ("Reverse by: adding an overflow rule to the `row` entry of `publicLayouts`").

## Reviewed and Dismissed
- A feed pill path assumes the host is the view count's next sibling — none does: removal walks ancestors (`takeDownAllBut`), queries within the tile (`removeSurface`, `takeDownRepointed`) or checks containment (`sweep`); the host after the row is still inside the tile.
- A tile with no metadata row loses its pill silently — unreachable: `viewCountIn`'s selector requires `.ytContentMetadataViewModelMetadataRow > …`, so `metadataRowOf` always returns the view count's parent; the `after` null filter (`feed.ts:137-138`) is there for the type.
- The watch page surface and the feed's sidebar host interfere on `/watch` — separate surface names and scopes; `removeSurface(document, 'watch_page')` matches only its own hosts.
- The layout in the keep key makes the feed's shared placer flicker between page kinds — the layout is constant per page kind and the containers are separate elements.
- The Shorts margin leaks to other surfaces — only `placePlayer` passes `under-channel-bar`; the Shorts tab guard (`shorts.test.ts:316`) and the default layout keep it there.
- The home feed "stays inline" and Shorts tab "no space above" tests are vacuous for being green at `3b3cd56` — they are scope guards for the hand check's "every other surface keeps its pill as it was", and each guards on the host first (a missing host fails `toBe(true)` or the pill text check). Keep them.

## Minor / nits
- `feed.ts:147` `if (read.pillAfter(viewCount) !== after) continue` is unreachable while the view count is the row's direct child (deleting it: 0 red) and carries no reason; fold it into the line above or drop it.
- `feed.ts:149` `const { separator, layout } = read` is rebuilt per tile; it can sit above the loop.
- `feed.ts:46` and `:67` repeat `pillAfter: (viewCount) => viewCount` and `layout: 'inline'` for search; `/results` could spread a shared default.
- `feed.test.ts:495-496`: `row.querySelector('[data-stillstats-surface]')` null and the view count's sibling not the host cannot fail once the host is the row's next sibling and the tile's only host; harmless.
- `feed.test.ts:134-145` `viewCountRowOf` and `pillPlaceOf` restate `metadataRowOf` and the per-page choice; acceptable as an independent oracle.
- The keep key's `${separator}` and `${layout}` parts are pinned by no test and unreachable (mutation: 0 red).
- Carried from review 3: `render.ts` `.separator { font: inherit; color: inherit; }` declares what a shadow span inherits anyway; `place()` takes `separator` and `layout` on every call where both are constant per page kind; the channel tab separator tests' names overclaim the next-sibling clause; `hostBeside` copied beside `pillBeside` in three test files.

## Test quality
Tests added or rewritten in the delta: 5 (home "stays inline", sidebar "row of its own" (rewritten), sidebar "row is a block…", Shorts tab "no space above", Shorts player "leaves space") · green at `3b3cd56`: 2, both scope guards, kept (Reviewed and Dismissed) · tautology shapes found: 0 new (no mocked unit, call-shaped or snapshot assertion; expectations are literals, not `publicLayouts`) · gaps: search's inline layout (Finding 1) and the feed's keep rule (Finding 2) are pinned by nothing; review 3's four unguarded no-capsule tests remain (Finding 3). Mutation: removing the row's `nowrap` turns its test red.

## Before opening the PR
- **CI readiness:** `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` and `pnpm test:browser` green at `275eb51`.
- **Commit hygiene:** clean tree; the two hand-check commits plus this review doc on top of PR #629's `26cd4b5`.
- **Spec drift to record:** #627's AC2 still reads "A separator matching YouTube's sits before the pill on the search result, lockup and watch page lines", and its body names the watch sidebar among the lockup lines. The sidebar now has no separator and a row of its own, by Nick's hand-check decision. The issue body should say so, or a reviewer reading AC2 will call the sidebar a miss.
- **Likely reviewer asks:** the Firefox and dark-theme passes of AC4 (NFI A); why the sidebar alone is a row (Approach decisions, "Where a pill sits").

## Verdict
Ready to open the PR (or push to PR #629), with follow-ups. Gate: none in code; no CRITICAL, HIGH or MEDIUM finding is open, and no prior MEDIUM-or-higher finding exists to close. Findings 1 to 5 are LOW: two new test gaps the hand-check fix opened or exposed, the two carried LOWs from review 3, and comment hygiene, which can ride along or ship as follow-ups. The confirmed list now holds only test and comment quality, which is the expected shrink for a re-review: the remaining risk is visual and sits in NFI A, the live re-check of the sidebar and the Shorts player in Chrome and Firefox, light and dark, which gates closing #627.
