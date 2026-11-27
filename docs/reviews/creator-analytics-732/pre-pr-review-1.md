# Pre-PR review: creator-analytics#732 The thumbnail preview tool moves into Stillstats

**Branch:** `creator-analytics-732-thumbnail-preview-tool` vs `origin/main` (merge-base `d3553bea` "Merge pull request #778 from nick-vogel/release-2026.11.17", which is `origin/main` itself)
**Reviewed at:** HEAD `048ab205` ("creator-analytics#797 Focus mode, the New badge and the duration badge"), clean tree, no uncommitted or untracked files at review time. Whole branch: 81 files, +10602 / −216, of which 3 are binary (two Roboto woff2 files and the walk's landscape fixture PNG) and 1 is `pnpm-lock.yaml`.
**Reviewed against:** epic creator-analytics#732 (its body is the spec, and its first comment holds the grill decisions), sub-issues #792 to #799 (bodies and acceptance criteria), `CODING_STANDARDS.md` standards 1 to 3, ADR 0007, ADR 0012, the new ADR 0021, and the nlvogel-site originals at `6d5d921` (a local checkout, byte-identical to `6d5d921` for `src/lib/tools/*`). No prior review docs.
**Date:** 2026-11-17
**Reviewer:** 3 code-review agents + 1 tautology-audit agent + verify pass (`--fresh`)

## What was verified and how

| Check | Method | Result |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | run in the integration worktree | already up to date |
| `pnpm lint` | full run | green, 757 files |
| `pnpm typecheck` | full run | green |
| `pnpm build` | full run | green |
| `pnpm test` | full run, `TEST_DATABASE_ADMIN_URL` unset, Testcontainers Postgres | green: 190 files, 4858 passed, 1 expected fail |
| `pnpm run --if-present test:browser` | full browser walk in the system Chrome | green: 120 steps, no CSP violation. Four console 401s on the signed-out tool page, which are the stub's real-API answer to `GET /api/me` with no session and do not fail the walk |
| Moved logic modules against nlvogel-site | agent diffed each of the 7 modules and 10 test files against `6d5d921`, normalising renames and imports; counted `it(` and `assert` per file | no behavioural change, no changed constant, no dropped or weakened assertion. Two added suites (grayscale re-derivation, overlay foreground), both independent |
| Component tree against nlvogel-site | agent compared every component and the hosted page, whitespace and comment stripped, and the original `globals.css` | event emission points, keyboard, drop, paste, focus restore, object URL lifetime, filter ids and badges unchanged. One cascade regression (finding 1) and one scrim divergence (finding 2) |
| Focus-stage cascade | executed: `repro/focus-stage-contrast.html` in headless Chrome, computed styles over page theme × stage | confirms finding 1 and finding 2 |
| CSP variant and its page matching | read `content-security-policy.ts`, `vite.ts`, `apps/site/vite.config.ts`; the site test and the policy unit test already assert `blob:` on the tool page only and nothing else different | holds |
| Site page list, canonical, sitemap, JSON-LD, sign-in `source` | agent read the build plugins and the tests; the unit tests for `main.ts` and `analytics.ts` run | hold |
| Web app sidebar item and avatar menu | agent read the diff, ran `sidebar.test.ts` and `account-menu.test.ts`; I read the walk's open and collapsed sidebar steps | hold, but the dev proxy misses `/tools` (finding 3) |
| Em-dash scan | `git diff $BASE` over `apps packages CONTEXT.md README.md`, added lines | none in shipped copy; three hits are tests asserting their absence |
| Tautology audit | agent ran every new and edited test file of `apps/site`, `apps/web` and `packages/visual-system` in a scratch worktree at `$BASE` (verbose reporter), and read every new package test | 4 tests green at base, all edited by the branch and explained; 2 moved negative controls that run no production code (finding 4) |
| What could not be run | the web app's dev server with `/tools/thumbnail-preview` (finding 3 is from config, not a run); the OpenPanel events arriving; the sign-in reaching Google | the spec names the last two as Nick's manual checks on the deployed product |

**Overall:** The move is faithful: the logic modules, their tests and the component tree carry nlvogel-site's behaviour unchanged, and the page, its policy, the sign-in band, the sidebar item and the avatar menu meet every acceptance criterion the review checked. The full checks are green, the browser walk included. One MEDIUM defect needs fixing before the PR: in focus mode, when the Background is set to the opposite of the page theme, the title fields draw their text in nearly the colour of their own background. The other findings are LOW.

## Approach decisions

- Focus-stage token remap: the stage remaps the visual-system tokens to the `--yt-` stage palette inside `.t-focus`, as `styles.css:713` already does for `--ink`, `--ink-soft`, `--line` and `--bg`. A token the chrome reads inside the stage that the block leaves out is the defect, and the fix adds it to that block rather than adding per-element `.t-focus .x` rules.
- Scrims: a darkening wash uses `var(--yt-scrim)`, the declared YouTube scrim, as `.t-card--overlay::after` (`styles.css:639`) does. Never a page token such as `--ink`, which flips lightness with the theme.
- Web dev proxy: each site path the web app links to gets its own `server.proxy` entry in `apps/web/vite.config.ts`, as `/privacy`, `/terms` and `/releases` do (`/releases` came with creator-analytics#577).
- Focus-stage colour proofs (remediation 1): the browser walk reads the computed colour of the element on the stage and compares it with the `youtube.css` value spelled as Chrome computes it, in a named constant beside `stageBackground` in `apps/site/test/screenshot/browser-walk.ts`, checked on the stage focus mode opens on and again after the Background switch.

## Confirmed Issues

### 1. In focus mode, the title fields are unreadable when the Background is the opposite of the page theme — MEDIUM

- **Location:** `packages/thumbnail-preview/src/styles.css:713-723` (the `.t-focus` block), read by `.t-input` at `styles.css:115-124`
- **Attribution:** introduced, by `e872b156` ("creator-analytics#797 Focus mode, the New badge and the duration badge"): `git log -S'--ink: var(--yt-fg)' $BASE..HEAD` names it. nlvogel-site's `.t-focus` did not remap the page tokens, so its inputs stayed self-consistent.
- **Real-world trigger:** a creator on the light site enters focus mode, sets Background to Dark to judge the thumbnail on YouTube's dark surface, and types or edits a title. The title fields render inside the tool root, so they stay on the stage (`thumbnail-tool.tsx:468`). The dark site with Background set to Light is the mirror case. The default entry is fine, since the stage opens on the page's theme.

**Evidence**

```css
.t-input {
  background: var(--bg-end);
  color: var(--ink);
}
.t-focus {
  --ink: var(--yt-fg);
  --ink-soft: var(--yt-fg2);
  --line: var(--yt-border);
  --bg: var(--yt-surface);
  --text-primary: var(--yt-fg);
```

**Failure mode:** `.t-focus` points `--ink` at the stage's foreground but leaves `--bg-end` at the page's value. The executed repro gives these computed `.t-input` colours:

| Page | Stage | Text | Background |
| --- | --- | --- | --- |
| light | dark | `rgb(241, 241, 241)` | `oklch(1 0 0)` (white) |
| dark | light | `rgb(15, 15, 15)` | `oklch(0.19 0.032 288)` (near black) |

That is light grey text on white, and near-black text on near black. The placeholder (`--ink-soft`, `#aaaaaa` on the dark stage) fails the same way. The browser walk turns focus mode on but never reads the title field's colours.

**Recommended fix**

```diff
 .t-focus {
   --ink: var(--yt-fg);
   --ink-soft: var(--yt-fg2);
   --line: var(--yt-border);
   --bg: var(--yt-surface);
+  --bg-end: var(--yt-raised);
   --text-primary: var(--yt-fg);
```

`--yt-raised` is `#ffffff` on `.t-focus--light` and `#212121` on `.t-focus--dark` (`youtube.css:105-123`), which gives `#0f0f0f` on white and `#f1f1f1` on `#212121`.

**Remediation brief**

- **Design intent:** focus mode is the tool alone on YouTube's own surface. Inside `.t-focus` every visual-system token the chrome reads must resolve against the stage (`.t-focus--light` or `.t-focus--dark`), never against the page's `data-theme`, because the Background control can set the stage to either theme whatever the page is. The `.t-focus` block is the one place that remap happens.
- **Full surface:** `packages/thumbnail-preview/src/styles.css:713-723` (add the declaration). `--bg-end` is read in the package sheet only at `styles.css:121` (`grep -n 'bg-end' packages/thumbnail-preview/src/*.css`). The visual system reads it only on `body` (`packages/visual-system/src/styles.css:152`), which is outside the stage, so nothing else moves. Add a walk step in `apps/site/test/screenshot/browser-walk.ts`, beside the existing focus-mode step: with the page light, enter focus mode, switch Background to Dark, and fail when the computed `color` and `background-color` of `.t-input` are the same colour family. The simplest form asserts that the field's background equals the stage's computed `--yt-raised`.
- **Must preserve:** the default entry's look. A light page and light stage keep a white field. A dark page and dark stage move from `oklch(0.19 0.032 288)` to `#212121`, which is intended. Overlay titles keep `--yt-overlay-fg`. `packages/thumbnail-preview/test/styles.test.ts` stays green (no literal colour is added). The walk's focus-mode and "New" badge steps stay green.
- **Do not touch:** the `--accent` family on the stage (Needs Further Investigation A, unmeasured). `enterFocusStage` (`focus-stage.ts`), which correctly leaves the tool's own children visible.
- **Proof:** from the repo root, `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --allow-file-access-from-files --user-data-dir="$(mktemp -d)" --dump-dom "file://$PWD/docs/reviews/creator-analytics-732/repro/focus-stage-contrast.html" | sed -n '/<pre id="out">/,/<\/pre>/p'`. Today the `stage: "dark"` rows show `inputBackground: "oklch(1 0 0)"` on the light page, and the `stage: "light"` rows show `oklch(0.19 0.032 288)` on the dark page. After the fix, every `stage: "light"` row shows `rgb(255, 255, 255)` and every `stage: "dark"` row shows `rgb(33, 33, 33)`. The walk step above is the lasting red-to-green test.

### 2. The Shorts crop bands lighten the cover in dark mode instead of darkening it — LOW

- **Location:** `packages/thumbnail-preview/src/styles.css:674-686` (`.t-cropband` and the comment above it)
- **Attribution:** introduced, by `859c7f49` ("creator-analytics#795 Shorts mode and the mismatch notice"): `git log -S't-cropband' $BASE..HEAD`. nlvogel-site used `--surface-overlay`, a modal scrim that "held one lightness across both themes" (`globals.css:2899-2911` at `6d5d921`).
- **Real-world trigger:** a creator on the dark site, or on the dark focus stage, switches to Shorts mode. The bands that show what the 2:3 grid crops off the 9:16 cover wash it out in light grey instead of shading it. They still mark the region, so this is LOW: the tile misrepresents nothing about the crop, but it reads opposite to light mode and to the original.

**Evidence**

```css
/* ... The page's ink at partial opacity darkens what is behind without hiding it in both modes,
   since the visual system has no scrim token. ... */
.t-cropband {
  background: var(--ink);
  opacity: 0.45;
```

**Failure mode:** the repro computes the band's background as `oklch(0.93 0.018 292)` on the dark page and `rgb(241, 241, 241)` on the dark stage, which are near-white at 45% opacity. The comment's "darkens … in both modes" is false.

**Recommended fix**

```diff
 .t-cropband {
   position: absolute;
   right: 0;
   left: 0;
-  background: var(--ink);
-  opacity: 0.45;
+  background: var(--yt-scrim);
+  opacity: 0.75;
   pointer-events: none;
 }
```

Rewrite the comment's scrim sentence: the band is YouTube's scrim at 75%, so it shades the cover to 45% black on every page and stage.

**Remediation brief**

- **Design intent:** the crop band is a darkening wash, not a warning, and it must look the same over a cover whatever the page or stage theme, since it describes the image rather than the page. `--yt-scrim` (`rgba(0, 0, 0, 0.6)`, `youtube.css:63`, declared at `:root`) is the package's one declared scrim, and 0.6 × 0.75 = 0.45 keeps light mode's current strength.
- **Full surface:** `packages/thumbnail-preview/src/styles.css:674-686` only.
- **Must preserve:** the dashed `var(--bg)` borders on `.t-cropband--top` and `.t-cropband--btm`, and their 2px radii. Opacity also scales those borders, so they draw at 75% rather than 45%; that change is declared intended. `styles.test.ts` stays green: a `var()` reference to a `--yt-*` name is not a colour literal, and `styles.css:639` already reads `var(--yt-scrim)`. The walk's Shorts measurement steps stay green.
- **Do not touch:** the corner radius in focus mode (Minor, inherited from nlvogel-site).
- **Proof:** the repro command in finding 1. Today `cropBand` follows `--ink` in every row. After the fix, every row reads `rgba(0, 0, 0, 0.6)`.

### 3. The sidebar's "Thumbnail preview" item 404s on the web app's dev server — LOW

- **Location:** `apps/web/vite.config.ts:25-34`, for the href at `apps/web/src/sidebar.ts:39`
- **Attribution:** introduced, by `962d0210` ("creator-analytics#799 A Thumbnail preview item in the sidebar, and the avatar menu without it"), which added the relative `/tools/thumbnail-preview` link without the proxy entry the web app's other site links have.
- **Real-world trigger:** Nick runs `pnpm dev` for the web app and clicks the item. With `base: '/app/'`, Vite answers `/tools/thumbnail-preview` itself, so the new tab shows Vite's base-path page instead of the tool. Production is unaffected, since the API serves the site at `/` and the app under `/app/` on one origin (`apps/api/src/app.ts`). It is capped at LOW because no user meets it. This is from config: the dev server was not run.

**Evidence**

```ts
  // The API also serves the built site's pages, which the web app links to: the legal pages, and
  // the release pages "What's new" links each highlight to.
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/privacy': 'http://localhost:3000',
      '/terms': 'http://localhost:3000',
      '/releases': 'http://localhost:3000',
```

**Recommended fix**

```diff
-  // The API also serves the built site's pages, which the web app links to: the legal pages, and
-  // the release pages "What's new" links each highlight to.
+  // The API also serves the built site's pages, which the web app links to: the legal pages, the
+  // release pages "What's new" links each highlight to, and the tool page the sidebar links to.
   server: {
     proxy: {
       '/api': 'http://localhost:3000',
       '/privacy': 'http://localhost:3000',
       '/terms': 'http://localhost:3000',
       '/releases': 'http://localhost:3000',
+      '/tools': 'http://localhost:3000',
     },
```

**Remediation brief**

- **Design intent:** in development the web app's Vite server stands in for the API's origin, so every site path the app links to is proxied to the API, one entry per path prefix.
- **Full surface:** `apps/web/vite.config.ts:25-34`. No other web app link targets a site path that is missing from the proxy (`grep -rnE "(href|Path) ?[:=] ?'/[a-z]" apps/web/src` finds only `thumbnailPreviewPath` and the fake API's `/releases` path).
- **Must preserve:** the four existing proxy entries.
- **Do not touch:** `thumbnailPreviewPath` in `sidebar.ts`, which is correct as a relative path for production and staging.
- **Proof:** no automated test runs the dev server, so this is a manual check. Start the API on 3000 with the site built, run `pnpm --filter @creator-analytics/web dev`, and open `/tools/thumbnail-preview` on the dev server's port. Today it shows Vite's page; after the fix it shows the tool. `pnpm typecheck` and `pnpm lint` stay green.

### 4. Two moved negative-control blocks test a copy of the old code, so they pass whatever the package does — LOW

- **Location:** `packages/thumbnail-preview/test/drop-highlight.test.ts:128-189` (the negative-control comment, the `createClearOnAnyLeave` helper and the "negative control: the pre-fix clear-on-any-leave logic" describe), and `packages/thumbnail-preview/test/slot-state.test.ts:402-415` (the test "WRONGLY hands out slot A again while its decode is still in flight")
- **Attribution:** introduced to this repo, moved verbatim by `04824905` ("creator-analytics#792 The thumbnail-preview package holds the tool's logic"): `git log -S'preFixFirstEmptySlot' $BASE..HEAD`. They were already this shape in nlvogel-site.
- **Real-world trigger:** none for users. This is a claim of coverage the suite does not have (CODING_STANDARDS.md standard 2, "a test that passes whatever the implementation does").

**Evidence**

```ts
const createClearOnAnyLeave = () => {   // defined in the test file
...
    const old = createClearOnAnyLeave()
    old.dragLeave('A')
    assert.equal(old.over(), null, 'recorded defect: ...')
```

```ts
const preFixFirstEmptySlot = (state: ToolState): SlotId | null =>
  SLOT_IDS.find((id) => state.slots[id].image === null) ?? null
...
    assert.equal(preFixFirstEmptySlot(state), 'A', 'recorded defect: ...')
```

**Failure mode:** each assertion reads a function the test file defines, so no change to `src/` can turn it red. The files' own comments say these blocks "stay green" when the bug returns. What catches the bug is the real-code tests beside them: `drop-highlight.test.ts:24-43`, and the two `firstEmptySlot` cases above `slot-state.test.ts:390`.

**Recommended fix:** delete `drop-highlight.test.ts`'s `createClearOnAnyLeave` helper, its header comment, and the whole negative-control describe (`:128-189`). In `slot-state.test.ts`, delete only the first test of the negative-control describe (`:402-415`). Rewrite the block comment at `:391-397` to state the remaining test's rule: the image-only selector and `firstEmptySlot` agree on every state with nothing in flight.

**Remediation brief**

- **Design intent:** each package test asserts a rule about what the package's own code returns. #792's "assert what they asserted in nlvogel-site" is met, because these blocks assert nothing about the package's code.
- **Full surface:** `packages/thumbnail-preview/test/drop-highlight.test.ts:128-189` and `packages/thumbnail-preview/test/slot-state.test.ts:391-415`.
- **Must preserve:** `slot-state.test.ts:417-426` ("agrees with the fixed selector on every state with nothing in flight"), which compares against the real `firstEmptySlot` and needs `preFixFirstEmptySlot`, so the helper stays. `drop-highlight.test.ts:24-43` and every other test in both files.
- **Do not touch:** the `mismatch-notice.test.ts` sentence assertions and the constant-pinning tests in `accept-image.test.ts` and `thumbnail-sizes.test.ts` (Reviewed and Dismissed).
- **Proof:** `pnpm exec vitest run packages/thumbnail-preview/test/drop-highlight.test.ts packages/thumbnail-preview/test/slot-state.test.ts` stays green with fewer tests. `grep -n 'createClearOnAnyLeave' packages/thumbnail-preview/test/drop-highlight.test.ts` prints nothing.

### 5. The avatar menu keeps an icon for a tool it no longer lists — LOW

- **Location:** `apps/web/src/AccountMenu.tsx:6` and `:44-47`, typed by `apps/web/src/account-menu.ts:31`
- **Attribution:** pre-existing, exposed. The `'thumbnail-preview': ImageIcon` entry is on `$BASE` (`git log -S"'thumbnail-preview': ImageIcon" $BASE..HEAD` finds nothing). `962d0210` removed the list entry and left the icon dead, because `Record<FreeTool, …>` forces it to stay. This is a walked-past refactor (CODING_STANDARDS.md standard 3).
- **Real-world trigger:** none for users. A reader takes the map as evidence that the menu can still show Thumbnail Preview.

**Evidence**

```ts
const toolIcons: Record<FreeTool, LucideIcon> = {
  'mid-roll-manager': Clapperboard,
  'thumbnail-preview': ImageIcon,
}
```

**Recommended fix:** key the map by the tools the menu lists.

```diff
-export const freeTools: readonly { tool: FreeTool; name: string; href: string }[] = [
+export const freeTools = [
   {
     tool: 'mid-roll-manager',
     name: 'Mid-Roll Manager',
     href: 'https://nlvogel.com/tools/mid-roll-manager',
   },
-]
+] as const satisfies readonly { tool: FreeTool; name: string; href: string }[]
```

```diff
-const toolIcons: Record<FreeTool, LucideIcon> = {
+const toolIcons: Record<(typeof freeTools)[number]['tool'], LucideIcon> = {
   'mid-roll-manager': Clapperboard,
-  'thumbnail-preview': ImageIcon,
 }
```

Then drop `ImageIcon` from `AccountMenu.tsx`'s lucide import. It has no other use in that file.

**Remediation brief**

- **Design intent:** `FreeTool` stays the union both tool-link events name, `'thumbnail-preview'` included, because the sidebar's event sends it (#799). Only the avatar menu's list and its icon map narrow to the tools it shows.
- **Full surface:** `apps/web/src/account-menu.ts:31-37` and `apps/web/src/AccountMenu.tsx:3-12` and `:44-47`. `freeTools` is read in `AccountMenu.tsx:184` and `account-menu.test.ts`.
- **Must preserve:** `FreeTool` and `toolLinkClickedEvent(tool, source)` unchanged. `account-menu.test.ts`'s `toStrictEqual` on `freeTools` (values unchanged, so it stays green). `app.test.ts`'s free tools tests.
- **Do not touch:** the `ImageIcon` import in `apps/web/src/sidebar.ts`, which the sidebar item uses.
- **Proof:** `pnpm typecheck` and `pnpm exec vitest run apps/web/src/account-menu.test.ts apps/web/src/app.test.ts` stay green. `grep -n ImageIcon apps/web/src/AccountMenu.tsx` prints nothing.

### 6. Comment hygiene — LOW (aggregated)

- `packages/thumbnail-preview/src/grayscale-weights.ts:9-15` — "That harness imports THIS module and exits nonzero when its own derivation disagrees" → "nlvogel-site's harness derived them; here the last suite in `test/grayscale-weights.test.ts` re-derives both triples by that method and fails when they disagree to four decimals. Re-derive there, never retype."
- `packages/thumbnail-preview/src/thumbnail-sizes.ts:253` — "under the `--yt-` prefix (`youtube.css`) that `check:copy` allowlists" → "under the `--yt-` prefix (`youtube.css`) that `test/styles.test.ts` allowlists"
- `packages/thumbnail-preview/test/duration-badge-tracing.test.ts:83` — "`youtube.css` under the `--yt-` prefix that `check:copy` allowlists" → "`youtube.css` under the `--yt-` prefix that `test/styles.test.ts` allowlists"
- `packages/thumbnail-preview/src/youtube.css:34-57` — nlvogel-site's build history ("Phase 3 declares TWO names … land at `:root`", "PHASE 4 ADDS NINE ROLE NAMES … an earlier draft of this comment said fourteen", "`--yt-scrim` ARRIVED IN REVIEW … passed on 562 declarations", `check-copy-css.mjs` rule 6) → keep only that the palette is YouTube's own values, that it is the one exemption from the colour rules, and that `test/styles.test.ts` enforces its shape. The `:root` block no longer holds two names.
- `packages/thumbnail-preview/src/youtube.css:92-96` — "The design file writes `.t-focus--light { background: #FFFFFF }`" (history) → "`--yt-surface` exists because no raised role equals the dark stage's `#0f0f0f`"
- `packages/thumbnail-preview/src/thumbnail-tool.tsx:1-2` and `rails.tsx:1-2` — "The AC numbers these comments cite are nlvogel-site's" → drop that sentence. Neither file cites an AC number any more.
- `packages/thumbnail-preview/src/slot-state.ts:383-388` — "There WAS an `unmounted` action beside it, and it was removed 2026-08-12." → "No `unmounted` action: a cleanup's dispatch is not guaranteed to run, so it would revoke nothing." Keep the rejected decision and drop the dated history.
- `packages/thumbnail-preview/src/segmented-control.tsx:4-13` — the component's JSDoc sits on `export type SegmentedOption` → move it above `SegmentedControl`.
- `packages/thumbnail-preview/src/focus-stage.ts:3-4` — "a sibling added to the page later cannot be missed" → "a sibling added to the page's markup later cannot be missed; a node inserted while focus mode is on is not covered"
- `apps/site/vite.config.ts:254` — "The tool's name, as the sidebar item and the footer link name it" → "The tool's name, kept equal by hand to the sidebar item (`apps/web/src/sidebar.ts`) and the footer link (`partials/footer.html`)"
- `packages/thumbnail-preview/src/styles.css:674-678` — the crop band comment is corrected by finding 2's fix. Listed here so it is not edited twice.

## Needs Further Investigation

### A. On the opposite stage, the accent-coloured focus ring and warning marks may fall below 3:1 — measure, then fix in the `.t-focus` remap

`.t-focus` does not remap `--accent`, `--accent-hover` or `--on-accent`. They colour the `.t-seg button:focus-visible` outline, the `.t-warnmark` "Cropped" icon, the `.t-notice--warn` border and the drag-over highlight. The finder estimates about 2:1 for the dark site's accent on the light stage. That is an estimate, not a measurement. To confirm it, extend `repro/focus-stage-contrast.html` to read the computed `--accent` on each stage and compute its contrast against `--yt-surface`. Below 3:1 is a defect, and the fix maps the accent pair inside `.t-focus` (to `--yt-link` or a declared stage accent), per the Approach decision.

### B. A mode switch right after a decode may report a stale `from` — confirm with a test that commits a decode and clicks in the same frame

`thumbnail-tool.tsx:285-295` reads `stateRef.current`, which a passive effect updates. A click before that effect flushes could read the pre-decode mode, and `modeSwitchEvent` would then drop a real switch. The window is about one frame, and the code is identical to nlvogel-site's, so this is pre-existing and untouched. React's flush order for a discrete click after a non-discrete commit was not checked.

## Reviewed and Dismissed

- The privacy-policy analytics test (`apps/site/test/site.test.ts:1334-1347`) as a copy test: #794's acceptance criteria require it ("The privacy policy test covers the new sentence"), and the same file holds other policy disclosures as facts (the tip and Studio extension sections). Its fragments are the disclosure's two facts, not its wording.
- `mismatch-notice.test.ts`'s sentence equalities and `TILE_MARKER`: each notice is composed from the slot letter and the mode, so the text is how the test observes which of the four branches ran (standard 2's first exemption), and the marker test pairs with the varying chip marker.
- The constant-pinning tests (`accept-image.test.ts:214-216` and `:226-232`, `thumbnail-sizes.test.ts:114-117`): each pins a value the spec fixes (the 25 MiB ceiling, the accepted formats, the master sizes) against a change. Moved unchanged.
- `title-typography-tracing.test.ts:253-285` reading the module's citation dates: it holds a load-bearing measurement citation to its source doc's date, which is a rule over the comment that comes from elsewhere (standard 1, "maintained like code").
- `URL.revokeObjectURL` inside the reducer (`slot-state.ts:368-371`, `:425`, `:430`, `:498`): it is idempotent under StrictMode's double invoke, and every dispatch comes from an event handler or a promise. Moved unchanged.
- The sidebar column's minimum height moving from 32rem to 36rem: the new item needs it, and the walk measured it (565.2px at 1280px). The 575px and 576px tests pin it.
- The tool page's "nothing leaves your device" line next to the policy's analytics sentence: it is approved copy (#732), and its scope is the images and titles.
- `ALLOWED_COPY_NUMBERS` accepting heights as well as widths in the prose gate: the spec defines the gate as "one of the package's allowed copy numbers", and the gate meets that definition.
- The browser walk's sidebar coverage: the walk finds the item in the open column (`browser-walk.ts:1596`), tabs to it in the collapsed column (`:1716`), and finds it at the column's minimum height (`:2030`).
- The four signed-out 401s in the walk log: the stub answers `GET /api/me` as the API does with no session, and every signed-out page reads it.
- The zoom note showing in focus mode while the conversion hint hides: the sizes matter most on the stage, and the spec keeps the note in the tool.
- The CSP variant and its matching: only `img-src` gains `blob:`; `/tools/` matches by clean path; the 404 page and the release pages get the base policy; the web app keeps the default `toolPage`. SVG `url(#conv-*)` filters are same-document references that `img-src` does not govern.

## Minor / nits

- `focus-stage.ts:32` skips non-HTML siblings (`instanceof HTMLElement`), so an inline `<svg>` placed directly beside the tool or one of its ancestors would stay visible in focus mode. No such sibling exists on today's page.
- In focus mode the image takes a 12px radius while the overlay scrim and the crop bands keep 2px (`styles.css:633-641`, `:688-698`, `:803-806`). This is inherited from nlvogel-site.
- `site.test.ts`'s `proseOf` uses a lazy match to the first `</div>`, so a nested div added to the prose would silently shorten both gates. Slicing up to `<section class="sign-in-band"` is sturdier.
- The release note's "The menu at the bottom of the sidebar" is true only for the column layout. Below 48rem, or under 36rem tall, the account menu is in the header.
- The package exports `./fonts`, `./grayscale-weights` and `./sizes` beyond the spec's one component and event type. Each is used by the site's build or tests.
- Comment lines over 100 characters at `content-security-policy.ts:10` and the edited `Sidebar.tsx` doc comment. Biome does not reflow comments.

## Test quality

The branch moves 14 test files (252 tests) into the package and adds or edits tests in 8 other files. In `apps/site`: `site.test.ts` 10 added / 3 edited, `main.test.ts` 3 added, `analytics.test.ts` 2 added. In `apps/web`: `app.test.ts` 2 / 13, `account-menu.test.ts` 0 / 2, `sidebar.test.ts` 1 / 0, `web.test.ts` 0 / 1. In `packages/visual-system`: `content-security-policy.test.ts` 2 added.

At `$BASE`, 4 tests are green. All four are edits that drop or allow for the removed avatar menu entry, or widen the JSON-LD exclusion, and each has a partner that is red at base: `account-menu.test.ts` "each have an accessible name…", `app.test.ts` "links each free tool to its nlvogel.com page…" and "a window as tall as the column's rows need…", and `site.test.ts` "no page but the homepage and the tool page carries a JSON-LD block". None is a tautology.

Tautology shapes: 2, both moved negative controls (finding 4). No unit under test is mocked, no assertion is call-shaped only, there are no snapshots, and every happy-dom file states its limits. `styles.test.ts`'s three checker-sanity tests exercise the test's own helper, but they guard the colour gate against a vacuous pass, so they are kept.

## Before opening the PR

- **CI readiness:** lint, typecheck, build and test are green at `048ab205`, and the browser walk is green locally.
- **Commit hygiene:** two commits per ticket share a subject (the lane commit and its merge). Commit this doc and `repro/focus-stage-contrast.html`.
- **Likely reviewer asks:** a walk step for the focus-stage colours (finding 1's proof); whether the accent pair holds contrast on the opposite stage (NFI A); a screenshot of the tool page in both themes for the PR body.

## Verdict

**Ready to open the PR once finding 1 is fixed.** Finding 1 (MEDIUM) gates the PR: it is a visible regression a creator meets with two clicks, and the fix is one declaration plus a walk step. Findings 2 to 6 (LOW) are cheap and can ride the same remediation pass, or become follow-ups. NFI A should be measured in that pass, since its fix sits in the same `.t-focus` block. No prior review findings were claimed.

## Remediation — 2026-11-17

Scope: CRITICAL, HIGH and MEDIUM, the remediator's default. The review has one MEDIUM (finding 1) and no CRITICAL or HIGH. Findings 2 to 6 are LOW and deliberately deferred to Nick, unfixed. NFI A and B were not worked.

| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 1 (MEDIUM) | `35337eff` creator-analytics#732 pre-PR review 1 finding 1: In focus mode the title fields keep the page's background under the stage's ink | red→green: `pnpm run test:browser` (new `titleFieldsOnTheStage` check in the focus-mode step; red at `cd2b0635` with "on the light stage the title fields draw … oklch(1 0 0)", green after); the finding's repro command now gives `rgb(255, 255, 255)` on every `stage: "light"` row and `rgb(33, 33, 33)` on every `stage: "dark"` row | 1 (the new constant's provenance in `youtube.css`, which the code cannot express) | proved by execution: walk green (120 steps, no CSP violation), `pnpm exec vitest run packages/thumbnail-preview` 14 files / 252 tests green, `pnpm typecheck` and `pnpm lint` green |
| 2 (LOW) | — deferred | — | — | LOW tail, left for Nick |
| 3 (LOW) | — deferred | — | — | LOW tail, left for Nick |
| 4 (LOW) | — deferred | — | — | LOW tail, left for Nick |
| 5 (LOW) | — deferred | — | — | LOW tail, left for Nick |
| 6 (LOW, comment hygiene) | — deferred | — | — | LOW tail, left for Nick |

Surface re-verified before the fix: `grep -rn 'bg-end' packages/thumbnail-preview/src packages/visual-system/src apps/site/src` finds the one package read at `styles.css:121` and the visual system's own declarations and `body` read, as the brief says. The other visual-system colour tokens the package sheet reads inside the stage are `--ink`, `--ink-soft`, `--line` and `--bg` (already remapped) and the `--accent` family (NFI A, do not touch). No `var(--…)` is read from the package's `.ts` or `.tsx`.

The walk's red on the light page and light stage is a spelling difference (`oklch(1 0 0)` against `rgb(255, 255, 255)`), since the walk stops at its first failure; the defect itself, the dark stage on the light page and the reverse, is the repro's red rows, and the same check runs on both stages in all four walk modes.

### Known regressions, deferred

- None.

### Rework briefs

- None. No fix needed a rework.
