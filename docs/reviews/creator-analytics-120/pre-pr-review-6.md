# Pre-PR review: creator-analytics#120 Extension: engaged views on YouTube's public pages

**Branch:** `creator-analytics-120-youtube-engaged-views` vs `origin/main` (merge-base `35d8927` "Merge pull request #634 from nick-vogel/release-2026.11.11-privacy")
**Reviewed at:** HEAD `887bc90` ("creator-analytics#488 #539 Privacy policy and popup: name the youtube.com usage events, and say no video id from a youtube.com page leaves the browser"), clean tree, no uncommitted or untracked files at review time. Whole branch against the merge-base: 23 files, +1268 / −79, including review docs 3 to 5.
**Delta under review:** since `fbbfb3f` ("creator-analytics#120 pre-PR review 5"), the HEAD pre-PR review 5 (`docs/reviews/creator-analytics-120/pre-pr-review-5.md`) reviewed. Three commits: the merge of `origin/main` `4533391` (no conflict resolution: `git show --remerge-diff 4533391` is empty), `e5e68d3` ("creator-analytics#485 First-run page: say what the extension reads on www.youtube.com") and `887bc90`. The branch's own delta: 8 files, +63 / −25, in `CONTEXT.md`, `apps/extension/src/first-run.ts` and `first-run.test.ts`, `apps/extension/src/popup.ts`, `popup.test.ts` and `popup-page.test.ts`, `apps/site/privacy.html` and `apps/site/test/site.test.ts`. Nothing under `apps/extension/src/surfaces` or `selectors` changed since `fbbfb3f`.
**Reviewed against:** nick-vogel/creator-analytics#485, #488 and #539 (sub-issues of #120) and Nick's approved copy on each, 2026-11-11; `CODING_STANDARDS.md` (standards 1 to 3); `docs/adr/0016-studio-by-default-www-youtube-com-on-request.md`; the Approach decisions of pre-PR reviews 1 to 5. The repo has no `CLAUDE.md`.
**Date:** 2026-11-11
**Reviewer:** 1 code-review agent + verify pass (oracle and copy-edit mutation in a detached scratch worktree at `887bc90`, removed after)

## What was verified and how

| Check | Method | Result |
| --- | --- | --- |
| Dependencies | `pnpm install --frozen-lockfile` | ok, already up to date |
| Lint | `pnpm lint` (biome, 644 files) | green |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` (all workspaces) | green |
| Tests | `pnpm test` (Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | green on the first run: 157 files, 3957 passed, 1 expected fail |
| Browser walk | `pnpm run --if-present test:browser` | green: no CSP violation in 59 steps |
| Approved copy lands word for word | script: every `> ` line of Nick's approval comments on #485 and #488 (the #539 comment is identical to #488's) searched in `first-run.ts`, `popup.ts`, and the tag-stripped, whitespace-collapsed "The Studio extension" section of `privacy.html` | 7 of 7 quoted paragraphs found; no em-dash in any of the three files |
| Every claim in the new copy is true of the code | agent trace of every outbound path from a public page: the two `fetch` calls in `product-api.ts`, the tab-to-background message types, the pill's markup, the usage event payloads | true; see Reviewed and Dismissed |
| Old wording left elsewhere | `git grep` for "any other site", "sends only your own videos", "works only on studio", "does not read any other site" outside `docs/reviews` | only the new copy and its tests; `README.md:131` already says no video id is sent. ADR 0016 states the older bound in other words (Finding 6) |
| Delta's tests against `fbbfb3f`'s sources (Phase 4.5 oracle) | scratch worktree at `887bc90`, `first-run.ts`, `popup.ts` and `privacy.html` put back to `fbbfb3f`, the four delta test files run | every edited or added test red (19), including both new tests |
| Mutation: a meaning-preserving copy edit | same worktree at `887bc90`; "leaves your browser" → "leaves the browser" in `privacy.html`, "leaves it." → "leaves the browser." in `first-run.ts` | exactly 2 red, the two new tests; 96 green. No code changed (Finding 5) |
| Live look at the first-run page, popup and policy | not run | copy only; the rendered text is what the tests read |

**Overall:** the delta lands Nick's approved copy for #485, #488 and #539 word for word, and every factual claim in it holds against the extension: nothing a www.youtube.com page yields leaves the browser, the usage events named are the ones sent, and the reads named are the reads made. Every full check is green on the first run. Two new LOWs: the two tests the delta adds are copy tests, which standard 2 forbids by name, and ADR 0016 still allows the creator's own video ids to leave the browser, which the shipped policy now rules out. The four LOWs carried since review 4 are untouched.

## Approach decisions

- **A pill on a re-pointed tile (carried from reviews 1 to 5):** each tile surface's `sweep` takes down a pill whose tile no longer links the video the pill was drawn for, using the id `pillPlacer` records when it draws. Precedent: the watch page's `sweep` and the Shorts player's `sweep`.
- **The feed's tile id reader (carried):** one module function `videoIdIn(read, tile)` in `feed.ts`, shared by the pass and the sweep.
- **The re-pointed sweep's scan (carried from review 2):** the channel page and Shorts sweeps start from the surface's own pills and walk up with `closest`; the feed's re-pointed scan stays tile-first.
- **The public pill's separator (carried from review 3):** the extension draws its own `aria-hidden` separator inside the pill's shadow root host, before `.pill`, never borrowed from YouTube's markup. Kinds: `dot` on a search result, `space` on a lockup line (channel tabs, home feed), `two-spaces` on the watch page's info line, `none` in the Shorts player, on the Shorts tab and in the watch sidebar's row.
- **The lockup separator's kind (settled by the hand check):** `space` stands; YouTube draws no dot on a lockup line (`::before` content `none`, hand check 2026-11-11).
- **Where a pill sits (carried from review 4):** `pillPlacer.place` takes `after` and an optional `layout` (`inline` default, `row`, `under-channel-bar`), and the host is always `after`'s next sibling, which the keep check relies on. A layout's CSS lives in `publicLayouts` (`render.ts`), declared and never read from the page.
- **Which element carries a layout's spacing (carried from review 5):** a layout's box spacing goes on `.pill` inside the shadow root, never on `:host`, because a `:host` normal declaration loses to any normal page declaration matching the host (CSS Cascade 5, Context). `:host` keeps only `display`. Precedent: the `row` layout's `white-space: nowrap` already sits on `.pill`.
- **How approved copy is held (this review records it):** by Nick's approval on its issue, never by a test that holds the sentence (`CODING_STANDARDS.md` standard 2). A test over the policy or a disclosure page checks a rule whose source is outside the copy, as the policy's host tests do from `hostOriginsOf` and `manifestOf` (`site.test.ts:1173`, `:1184`), or observes a branch through its text, as the popup tests do with the toggle's explanation. Where an issue's "Done when" asks a test to hold approved text, standard 2 wins and the issue's line is brought in line.
- **Where a change to a decision record goes (this review records it):** a new ADR that amends the old one, which stays as written. Precedent: ADR 0016 amends ADR 0008 (`docs/adr/0016-studio-by-default-www-youtube-com-on-request.md:3`).

## Prior-review closure

Review 5 held no MEDIUM-or-higher finding and no Remediation section, so nothing was deferred by decision. The delta touched none of the files the prior findings name (`git diff --stat fbbfb3f HEAD -- apps/extension/src/surfaces apps/extension/src/selectors` is empty).

- **Finding 1 (LOW, nothing holds the search pill inline):** untouched. Re-emitted as Finding 1, brief unchanged.
- **Finding 2 (LOW, no feed test of the keep rule):** untouched. Re-emitted as Finding 2, brief unchanged.
- **Finding 3 (LOW, four unguarded no-capsule tests):** untouched. Re-emitted as Finding 3, brief unchanged.
- **Finding 4 (LOW, the public pill style a third copy):** untouched. Re-emitted as Finding 4, brief unchanged.
- **Finding 5 (Comment hygiene):** untouched, all eight entries. Re-emitted inside Finding 7 with this delta's two new entries.
- **NFI A (live look at the fixed Shorts gap and the sidebar row):** untouched; no look is recorded since `b226ed1`. Carried as NFI A.
- **NFI B (a narrow sidebar overflows):** untouched. Carried as NFI B.

Counts: of 5 prior confirmed findings, 0 fully fixed, 0 partially fixed, 5 untouched (all LOW); 0 MEDIUM-or-higher open; of 2 NFIs, 2 open.

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

### 5. The two tests the delta adds are copy tests: they hold Nick's approved sentences, go red on a harmless wording edit, and never on a code break — LOW
- **Location:** `apps/extension/src/first-run.test.ts:250-261` (the test "says what the extension reads on Studio, then on www.youtube.com once YouTube access is on, before the shared lines (creator-analytics#485)"); `apps/site/test/site.test.ts:1196-1213` (the test "the privacy policy's Studio extension section says where the extension works, names the youtube.com usage events, and says no video id from a youtube.com page leaves the browser"); the comment block `apps/site/test/site.test.ts:1128-1137` that now describes it
- **Attribution:** introduced in this delta: the first-run test in `e5e68d3`, the site test and the comment sentence in `887bc90` (`git log --oneline -S"The sentences Nick approved word for word on #488" 35d8927..HEAD` names `887bc90`; `git log --oneline -S"#202 and #485." 35d8927..HEAD -- apps/extension/src/first-run.test.ts` names `e5e68d3`). Both commit messages say the tests hold the approved text on purpose. #539's "Done when" asks that "`apps/site/test/site.test.ts` and the popup tests hold the new text", so the plan and the standard disagree; the standard wins (Approach decisions, "How approved copy is held"), and the issue line is the one to bring in line.
- **Real-world trigger:** none for a user. Nick adjusts a word of the policy or the first-run page on a later copy issue, the suite goes red with no code broken, and the fix is to retype the sentence in the test, which proves nothing. Standard 2 names this shape, "the privacy policy contains the Limited Use statement, the consent screen says its paragraph word for word", and says "Write no new one, and delete an existing one on sight." Capped at LOW: test quality, no user path.

**Evidence**
```ts
  // The copy Nick approved word for word on creator-analytics#97, #202 and #485.
  test('says what the extension reads on Studio, then on www.youtube.com once YouTube access is on, before the shared lines (creator-analytics#485)', () => {
    const paragraphs = [...firstRunPage().querySelectorAll('p')].map((p) => p.textContent)

    expect(paragraphs.slice(0, -retentionAndSharingLines.length)).toEqual([
      'The extension shows your engaged views beside the numbers YouTube Studio shows.',
```
```ts
    expect(approved.filter((sentence) => !text.includes(sentence))).toEqual([])
    expect({
      worksOnlyOnStudio: /works only on/.test(text),
      readsNoOtherSite: /does not read any other site/.test(text),
    }).toEqual({ worksOnlyOnStudio: false, readsNoOtherSite: false })
```
The comment block says both that "The rest of the wording (CODING_STANDARDS.md, standard 2) ... rest[s] on Nick's copy approval" and, two lines on, that "The Studio extension section's tests hold the sentences #488 and #539 approve, word for word".

**Failure mode** — Executed in a scratch worktree at `887bc90`: "leaves your browser" changed to "leaves the browser" in `privacy.html`, and "leaves it." to "leaves the browser." in `first-run.ts`, with no code touched. `pnpm exec vitest run apps/extension/src/first-run.test.ts apps/site/test/site.test.ts`: exactly these two tests red, 96 green. The expected lists are the source's own literals (`firstRunText.paragraphs`, `first-run.ts:11-17`, and the policy's paragraphs), so each test restates its source.

**Recommended fix** — delete both tests and the comment sentence that describes the site one.

In `apps/extension/src/first-run.test.ts`, delete lines 250 to 262: the comment line `// The copy Nick approved word for word on creator-analytics#97, #202 and #485.`, the whole `test('says what the extension reads on Studio, ...` block, and the blank line after it, so `describe('the first-run page', () => {` is followed directly by the shared lines test.

In `apps/site/test/site.test.ts`, delete lines 1196 to 1214: the comment line `// The sentences Nick approved word for word on #488 and #539, on 2026-11-11.`, the whole `test("the privacy policy's Studio extension section says where the extension works, ...` block, and the blank line after it. Then replace lines 1128 to 1137 with:
```diff
-  // to it (#137). The rest of the wording (CODING_STANDARDS.md, standard 2), and whether the
-  // policy's claims (the scopes, the stored data, the cookies, the encryption, the retention
-  // windows) match what the code does, rest on Nick's copy approval on #29, #61, #98, #120, #202,
-  // #338, #488 and #539. The Studio extension section's tests hold the sentences #488 and #539
-  // approve, word for word; whether the events they name are the ones the extension sends rests on
-  // the extension's event tests. The youtube.com paragraph's other claims (it reads only links on
-  // the page and its address, sends no video id from the page, reads no number and uses no YouTube
-  // sign-in) rest on that approval and on the public page surfaces' boundary scan and seam tests
-  // (#138 to #141, #520), not on this file. The footer links the same policies on every page, so these tests read each page's
-  // own <main> alone.
+  // to it (#137). The rest of the wording (CODING_STANDARDS.md, standard 2), and whether the
+  // policy's claims (the scopes, the stored data, the cookies, the encryption, the retention
+  // windows) match what the code does, rest on Nick's copy approval on #29, #61, #98, #120, #202,
+  // #338, #488 and #539. Whether the usage events it names are the ones the extension sends rests
+  // on that approval and on the extension's event tests. The youtube.com paragraph's other claims
+  // (it reads only links on the page and its address, sends no video id from the page, reads no
+  // number and uses no YouTube sign-in) rest on that approval and on the public page surfaces'
+  // boundary scan and seam tests (#138 to #141, #520), not on this file. The footer links the same
+  // policies on every page, so these tests read each page's own <main> alone.
```

**Remediation brief**
- **Design intent:** approved copy is held by Nick's approval on its issue, and a test over a disclosure holds a rule whose source is outside the copy: the policy names every host the manifest asks for (`site.test.ts:1173`, from `hostOriginsOf`; `:1184`, from `manifestOf(...).optional_host_permissions`), the first-run page ends with the web app's shared lines (`first-run.test.ts:263`, from `retentionAndSharingLines`). The popup tests that read `youtubeToggleExplanation` are behaviour tests: they observe the toggle's state through its text, and stay.
- **Full surface:** `apps/extension/src/first-run.test.ts:250-262`; `apps/site/test/site.test.ts:1128-1137` and `:1196-1214`. No production change: `first-run.ts`, `popup.ts` and `privacy.html` keep the approved text exactly as committed. Nothing else references the two tests' names (`git grep -n "names the youtube.com usage events" -- apps` and `git grep -n "before the shared lines" -- apps` print only the tests themselves).
- **Must preserve:** `first-run.test.ts:263` ("ends with the web app's shared lines ...") and every other first-run test; `site.test.ts:1173` and the `test.for(['chrome', 'firefox'])` host test at `:1184`, which use `sectionOf` and `textOf`; the comment block's approval list including #488 and #539, and its pointer to the boundary scan and seam tests (#138 to #141, #520); the `popupText` edits in `popup.test.ts:27-32` and `popup-page.test.ts:58-59`.
- **Do not touch:** the approved copy in `first-run.ts:11-17`, `popup.ts:17-18` and `privacy.html:84-122` (Reviewed and Dismissed: every claim holds, and the order of the first-run paragraphs is the order Nick approved).
- **Proof:** after the fix, `git grep -nE "approved word for word on (creator-analytics#97, #202 and #485|#488 and #539)" -- apps` prints nothing; `pnpm exec vitest run apps/extension/src/first-run.test.ts apps/site/test/site.test.ts` is green; `pnpm lint` is green. Then in a scratch worktree at the fix commit, change "leaves your browser" to "leaves the browser" in `apps/site/privacy.html` and run the same vitest command from the worktree root: green, where at `887bc90` it turned the two deleted tests red.

### 6. ADR 0016 still lets the creator's own video ids leave the browser, which the shipped policy now rules out — LOW
- **Location:** `docs/adr/0016-studio-by-default-www-youtube-com-on-request.md:7`; cited as the authority for "no id is sent" at `apps/extension/src/surfaces/public-pages.ts:42` and six more surface comments (Full surface)
- **Attribution:** pre-existing, exposed. The ADR came in `82acdcc` ("creator-analytics#135 Record Studio by default, www.youtube.com on request, in an ADR and the glossary") and is on `origin/main`; `0a3c0db` (#520, also on `origin/main`) narrowed the code to send no id from a public page and cited the ADR for it. Until `887bc90` the policy and the popup said the extension "sends Stillstats the ids of videos from the channels you connected", which agreed with the ADR. Since `887bc90` the policy, the popup and the first-run page say no video id from www.youtube.com leaves the browser, so the ADR now permits what the shipped disclosure forbids. #539's "Where" names this line and calls a change optional.
- **Real-world trigger:** none for a user today: the code sends no id (Reviewed and Dismissed). A maintainer who reads the ADR as the boundary, for example to fetch one Short's numbers by id instead of a channel's uploads, stays inside it and makes the privacy policy false without any test or reviewer citing a broken rule. Capped at LOW: decision-record drift with no change on the way; upgrade to MEDIUM if any open ticket plans a request from a public page that carries a video or channel id read from the page (check: `gh issue list --repo nick-vogel/creator-analytics --search "youtube.com in:body is:open"`).

**Evidence**
```md
On youtube.com the extension reads video ids, channel links and the page URL, and never a number. Only the ids of videos on the creator's connected channels leave the browser: the extension matches each video to a connected channel in the browser, and sends nothing about any other video, so the rest of what the creator browses stays in the browser.
```
```ts
 * the page matches its ids against them here, and no id from the page is ever sent (ADR 0016,
 * creator-analytics#520). Whose a video is depends on no channel link, URL or draw order.
```

**Failure mode** — The decision record and the disclosure disagree about what may leave the browser; the code cites the looser one for the stricter behaviour.

**Recommended fix** — add `docs/adr/0019-no-id-from-a-public-page-leaves-the-browser.md`, amending ADR 0016 the way ADR 0016 amends ADR 0008, and point the code comments that cite 0016 for what is sent at it; the first of seven:
```md
# No id from a public page leaves the browser

This ADR amends ADR 0016, which let the ids of videos on the creator's connected channels leave the browser from www.youtube.com. ADR 0016 stays as written.

On www.youtube.com the extension sends no id it reads from the page. It reads each connected channel's uploads from the product API, by Stillstats' own channel id, and matches the page's video links against them in the browser (creator-analytics#520). The privacy policy, the popup and the first-run page say so (creator-analytics#539, #485).

The narrower bound costs nothing the creator sees: the uploads list already holds every video a pill can show. It makes the youtube.com disclosure a fact about the request, not about a filter that runs before it.
```
```diff
- * the page matches its ids against them here, and no id from the page is ever sent (ADR 0016,
- * creator-analytics#520). Whose a video is depends on no channel link, URL or draw order.
+ * the page matches its ids against them here, and no id from the page is ever sent (ADR 0019,
+ * creator-analytics#520). Whose a video is depends on no channel link, URL or draw order.
```
The ADR's wording is a decision record, not shipped copy; Nick may prefer #539's lighter option, one line added to ADR 0016. Either closes the finding.

**Remediation brief**
- **Design intent:** ADRs here are append-only: a changed decision gets a new ADR that names the one it amends, and the old one stays readable (`0016`:3 for `0008`). Since #520, a public page's request is the channel list and each held channel's uploads (`product-api.ts:98-105`, `:237-251`), keyed by Stillstats' own channel id; tab-to-background messages from youtube.com cannot carry ids (`background-answer.ts:78` refuses `read-videos` from a youtube.com tab).
- **Full surface:** a new `docs/adr/0019-no-id-from-a-public-page-leaves-the-browser.md` (the next free number: `ls docs/adr` ends at `0018-release-notes-in-the-repository-no-cms.md`). The code comments that cite ADR 0016 for "no id is sent", each of which moves to `ADR 0019` (rewrap at 100 where the line grows): `apps/extension/src/surfaces/public-pages.ts:42`, `channel-page.ts:18`, `feed.ts:93`, `shorts.ts:45`, `channel-page.test.ts:217`, `feed.test.ts:339`, `shorts.test.ts:280` (all under `apps/extension/src/surfaces/`; `git grep -n "ADR 0016" -- apps packages` lists them). `apps/extension/src/manifest.ts:47`, `README.md:131` and `CONTEXT.md:169` cite ADR 0016 for the optional host permission, which 0016 still decides, and stay.
- **Must preserve:** ADR 0016's text unchanged; `apps/extension/test/page-boundary.test.ts` and the seam tests that pin "no id is sent" (`watch-page.test.ts:238` and the `videoIdsSentIn` checks); `pnpm lint` green (biome does not lint markdown, but check).
- **Do not touch:** `README.md:131`, which already states the narrower bound; the approved copy in `privacy.html`, `popup.ts` and `first-run.ts`.
- **Proof:** documentation only, no red-before-green. After the fix, `git grep -n "Only the ids of videos on the creator's connected channels leave the browser" -- docs/adr` still prints ADR 0016's line (it stays as written), and `git grep -n "ADR 0016" -- apps/extension/src/surfaces` prints nothing, while `git grep -n "ADR 0019" -- apps/extension/src/surfaces` prints the seven sites above.

### 7. Comment hygiene — LOW (aggregated)
- `apps/site/privacy.html:83` — "<!-- Approved word for word in creator-analytics#98, #202 and #120, with #488's usage events and #539's youtube.com wording. -->" (134 characters beside lines wrapped at 100) → "<!-- Approved word for word in creator-analytics#98, #202, #120, #488 and #539. -->" (new in `887bc90`).
- `apps/extension/src/surfaces/render.ts:165-167` — "YouTube's stylesheet resets that element's margin, so Chrome computed the host's 8px as 0px" → "Chrome computed the host's 8px as 0px in #627's hand check (2026-11-11), so a page rule matching that element sets its margin" (new in `b226ed1`: the 0px is what was measured; which YouTube rule wins was not read, and the saved fixtures carry no styles. The mechanism holds either way.)
- `apps/extension/src/surfaces/shorts.test.ts:556-557` — "(creator-analytics#627's hand check measured 0px in Chrome)" → "(creator-analytics#627's hand check measured 0px in Chrome, 2026-11-11)" (new; standard 1, a measured value names its date).
- `apps/extension/src/surfaces/render.ts:463` — "in a lockup's metadata line (the channel tabs, the home feed and the watch sidebar), with no dot" → "in a lockup's metadata line (the channel tabs and the home feed), with no dot" (carried; the sidebar is `none`).
- `apps/extension/src/surfaces/render.ts:131-132` — "The engaged views pill on a public page, inline directly after YouTube's view count in a tile's metadata line, as one more of YouTube's metadata items" → "The engaged views pill on a public page, after the element its `PillLayout` follows (inline after YouTube's view count in most tiles' metadata lines), as one more of YouTube's metadata items" (carried).
- `apps/extension/src/surfaces/render.ts:139-141` — "The dot's 4px each side is YouTube's usual metadata dot margin, declared and never read from the page, which test/page-boundary.test.ts forbids; the hand check tunes it." → "The dot's 4px each side is declared and never read from the page, which test/page-boundary.test.ts forbids; #627's hand check (2026-11-11) found it matching YouTube's dot on a search result." (carried).
- `apps/extension/src/surfaces/public-pages.ts:145` — "drawn inside the pill so the pill stays that element's next sibling" → "drawn inside the host before the pill, so the host stays that element's next sibling" (carried).
- `apps/extension/src/surfaces/testing.ts:48` — "what would draw a capsule around the pill" → "the declarations the old capsule was drawn with; a box-shadow or outline is not counted" (carried).
- `apps/extension/src/surfaces/feed.test.ts:11-13` — the Limits header's edited sentences run to 184, 124 and 102 characters beside lines wrapped at 100 → re-wrap at 100; the same for `channel-page.test.ts:8` and `:10` and `watch-page.test.ts:10` (carried).

## Needs Further Investigation

### A. The fixed Shorts gap and the sidebar row have not been looked at live (carried from review 5) — confirm on a staging build from `887bc90` in Chrome: in the Shorts player, `getComputedStyle(pillHost.shadowRoot.querySelector('.pill')).marginBlockStart` is `8px` and the gap under the channel row reads right; on a watch page whose sidebar holds one of Nick's videos, the pill sits on its own line under "N views • date" and does not wrap or overflow the tile. Then the same in Firefox, and both in the dark theme, which #627's AC4 asks for and no note records.

### B. A sidebar tile narrower than the pill's text lets it overflow rather than wrap (carried from review 5) — confirm in A's check on the narrowest sidebar. `white-space: nowrap` with no overflow rule is a reversible assumption in #627's notes ("Reverse by: adding an overflow rule to the `row` entry of `publicLayouts`").

## Reviewed and Dismissed
- "No video id from www.youtube.com leaves your browser" is false — it holds. The extension's only network calls are the two `fetch` calls in `product-api.ts` (the signed-in GET and `POST /api/events`); a youtube.com tab can ask the background only for `read-channels`, `read-uploads`, `usage-event` and `youtube-access` (`messages.ts:19-25`), and `read-videos`, the one request that takes ids, is refused from a youtube.com tab (`background-answer.ts:78`). `read-uploads` names a held channel from the channel list, never an id from the page, the API request carries Stillstats' own channel id, and the page's ids are matched against the answer in the tab (`public-pages.ts:113-133`). The seam tests pin it (`watch-page.test.ts:238`, "sends no video id, the page URL's `v` included", and the `videoIdsSentIn` checks in the channel page, feed and Shorts tests).
- A click on a public pill sends a video id to stillstats.com — the public pill draws no link (`PillView` is `{ figure, name }`), and no public surface uses `lineClicks` or `newTabLink`, so there is no stillstats.com link and no click event on youtube.com.
- The usage events paragraph leaves out a surface — the public surface values are exactly `channel_page`, `watch_page`, `feed` and `shorts` (`packages/api-types/src/events.ts`); both YouTube access events carry no payload and go through the same Firefox consent. `feed` also covers search results and the watch sidebar, so "feed" is a loose label for those (Minor), not a missing one.
- "When you or your browser remove it" overclaims — the removed event fires on every `permissions.onRemoved` the background hears, which both the popup toggle and the browser's settings reach (`youtube-access.ts:146-160`). The start-up repair deliberately sends none, since it cannot tell when the grant changed (`youtube-access.ts:161-174`); that is a removal the browser never delivered, an edge the sentence can leave out.
- "Reads the links ... and the page address" leaves out other reads — the reads are `getAttribute('href')` and `document.URL` / `location.href`; selector matches on `[video-id=...]`, `[hidden]` and `[page-subtype=...]` locate elements and compare the same id the URL carries, read no content, and send nothing. True in substance.
- The first-run page's paragraph 4 ("It sends stillstats.com the video ids and the period ...") now reads as if it covers www.youtube.com — Nick placed the new paragraph directly after paragraph 2 in the approval on #485 ("Paragraph 2 loses its last clause, and a new paragraph follows it"), and paragraph 4's "for the channel you connected" and "the period" are Studio's. A reorder or a "On Studio," prefix is a copy change for Nick, not a defect.
- `textOf` breaks `includes` across the policy's hard wraps — it strips tags and collapses `\s+` to one space (`site.test.ts:212-217`). Moot once Finding 5 deletes the test.
- The privacy policy's "Last updated" date is stale — it reads November 11, 2026 (`privacy.html:12`, from #631 on `origin/main`), the date of this delta's edit.
- The popup tests' edits are copy tests too — they update the expected text of existing behaviour tests that observe the toggle's state through its rendered explanation (`popup.test.ts:27-32`, `popup-page.test.ts:58-59`), the kind standard 2 keeps. Do not delete them under Finding 5.
- The merge of `origin/main` changed branch code — `git show --remerge-diff 4533391` is empty; no conflict was resolved by hand.

## Minor / nits
- `popup.ts:17-18`, approved copy: "reads the links to videos and channels on the page, and matches them against your own videos" reads as if channel links are matched against videos; only video ids are matched, and channel links are read only on the Shorts player bar to drop left-over pills. Not false about what leaves the browser.
- The policy's "feed" covers the home feed, search results and the watch sidebar, so a watch page sends both `watch_page` and `feed` events; the wording is loose, not wrong.
- A rule test could replace Finding 5's site test if Nick wants the link between the events named and the events sent enforced: every public `ExtensionSurface` value in `packages/api-types/src/events.ts` maps to a phrase the policy section names, the shape of the host tests at `site.test.ts:1173`. Optional, and Nick's call.
- The Firefox build's `data_collection_permissions` was not checked for the youtube.com reads; nothing read there is transmitted, so nothing new should need declaring. Outside this delta.
- Carried from review 5: `shorts.test.ts:327-328` reads margins on `:host` and `.pill` only, so a margin on `.pill svg` or `.separator` passes the "player's alone" test; no test holds the `row` layout free of a top margin; the player test pins `margin-block-start` by name; `marginsOf` (`shorts.test.ts:96-103`) repeats `capsuleOf`'s prefix filter (`testing.ts:52-64`).
- Carried from review 4: `feed.ts:147` `if (read.pillAfter(viewCount) !== after) continue` unreachable; `feed.ts:149` destructuring rebuilt per tile; `feed.ts:46` and `:67` repeat search's defaults; `feed.test.ts:495-496` checks that cannot fail; `feed.test.ts:134-145` restates `metadataRowOf` as an oracle; the keep key's `${separator}` and `${layout}` parts pinned by nothing; `.separator { font: inherit; color: inherit; }` redundant; `place()` takes per-page constants on every call; the channel tab separator tests' names overclaim the next-sibling clause; `hostBeside` copied into three test files.

## Test quality
Tests added in the delta: 2 (the first-run page's leading paragraphs, the policy's Studio extension sentences); tests edited: the popup's expected toggle text in `popup.test.ts` and `popup-page.test.ts` · green against `fbbfb3f`'s sources: 0, every added and edited test red · tautology shapes: no mock, call-shaped or snapshot assertion; both added tests restate their source's literals, so they are copy tests under standard 2: red on a meaning-preserving wording edit (executed), never on a code break (Finding 5, delete both) · the popup edits stay, as behaviour tests that observe the toggle through its text. The carried gaps are Findings 1 to 3.

## Before opening the PR
- **CI readiness:** `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` and `pnpm test:browser` green at `887bc90`, all on the first run.
- **Commit hygiene:** clean tree; this review doc on top of `887bc90`.
- **Notes to bring in line:** #539's "Done when" asks that `apps/site/test/site.test.ts` hold the new text; under standard 2 the approval holds it, so that clause should read "and the popup tests hold the new text" alone (Finding 5). #485, #488 and #539 are still open; their copy has landed on this branch. Carried from review 5: #627's assumption log still puts the Shorts player's 8px on `:host` (it is on `.pill` since `b226ed1`), and #627's AC2 still names the watch sidebar among the lockup lines with a separator.
- **Release note:** the policy changed on this branch; the release that ships #120 should say so, as `packages/releases/notes/2026.11.11.md` did for #631.
- **Likely reviewer asks:** why the new copy has no test holding it (Approach decisions, "How approved copy is held"); the Firefox and dark-theme passes of #627's AC4 (NFI A).

## Verdict
Ready to open the PR (or push to PR #629), with follow-ups. Gate: none in code; no CRITICAL, HIGH or MEDIUM finding is open, and no prior MEDIUM-or-higher finding exists to close. The delta does what #485, #488 and #539 ask: Nick's approved copy lands word for word on the first-run page, the popup and the privacy policy, and every claim it makes holds against the extension's code. Finding 5 (two copy tests that standard 2 says to delete on sight) is the one item worth folding in before the PR, since it is two deletions and a comment rewrap in files the delta just added to; Finding 6 (an ADR amendment) and Findings 1 to 4, the LOWs carried untouched since review 4, can ride along or ship as follow-ups. For the third round running, the confirmed list holds only test, comment and record quality, the expected shrink for a re-review. The remaining risk is visual and sits in NFI A, which gates closing #627.
