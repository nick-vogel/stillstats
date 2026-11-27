# Pre-PR review: creator-analytics#642 A light and dark theme switch, not only the system preference

**Branch:** `creator-analytics-642-theme-switch` vs `origin/main` (merge-base `5615d76` "Merge pull request #707 from nick-vogel/creator-analytics-571-sidebar-account-settings")
**Reviewed at:** HEAD `ef4fc77` ("creator-analytics#692 Theme: the three radio items in the account menu"), clean tree, no uncommitted or untracked files at review time. Whole branch: 36 files, +3399 / −77, 10 commits: #382 at `63b05bf`, #688 at `4f2fd9b` and its merge `b2ba30d`, a merge of `origin/main` at `980f3f3`, #691 at `c6dedd6`, `6de0076`, `c5a4b92` and its merge `74b1f63`, #692 at `1b184be` and its merge `ef4fc77`. 1834 of the added lines are the generated Drizzle snapshot `packages/database/drizzle/meta/0024_snapshot.json`.
**Reviewed against:** the epic creator-analytics#642 (its body is the spec, and its first comment holds the grilled decisions and the approved reset warning), its sub-issues #382, #688, #691 and #692, CODING_STANDARDS.md (the repo has no CLAUDE.md), CONTEXT.md's Preference entry, and the lane assumptions in the run's ticket folders for #688, #691 and #692. No prior review doc exists in `docs/reviews/creator-analytics-642/`; the run was `--fresh`.
**Date:** 2026-11-12
**Reviewer:** 3 `pr-review-finder` agents (state and persistence; menu UI; tokens and browser walk) + 1 tautology audit agent + verify pass

## What was verified and how

| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | green, lockfile unchanged |
| Lint | `pnpm lint` at `ef4fc77` | green |
| Typecheck | `pnpm typecheck` at `ef4fc77` | green |
| Build | `pnpm build` at `ef4fc77` | green; `apps/web/dist/index.html` loads the classic `<script src="/app/assets/theme-<hash>.js">` after the policy meta and before the module script and the stylesheet |
| Full suite | `pnpm test` at `ef4fc77`, `TEST_DATABASE_ADMIN_URL` unset | green: 165 files, 4205 passed, 1 expected fail, no flake |
| Browser walk | `pnpm run --if-present test:browser` at `ef4fc77` | green: "No content security policy violation in 90 steps. The browser walk passed." |
| Walk isolates the head script | mutant in a scratch worktree at `ef4fc77`: `apps/web/src/theme-script.ts` replaced by `export {}`, then `pnpm test:browser` | red, as it should be: "state: the theme from the first frame, in Settings and after a reset did not complete: With dark stored on a light system the first frame drew {"theme":null,"bg":"oklch(96% .02 292)"}". The walk does catch a head script that does nothing; the comment that explains why is imprecise (Finding 5) |
| Migration | read `0024_preferences_theme.sql`, the snapshot's `preferences` entry and `_journal.json` | nullable `theme` text column, CHECK `preferences_theme` on the three values, snapshot `prevId` chains to 0023, journal idx 24 |
| API allowlist | read `apps/api/src/preferences.ts:37` and its tests | `theme` accepts exactly `light`, `dark`, `system`; `sepia`, `Dark`, `null` and `true` refused; reset deletes the row |
| Stylesheet cascade | read `packages/visual-system/src/styles.css:83-137` and the built CSS | `:root[data-theme="dark"]` and `:root:not([data-theme="light"])` in the dark media query are both (0,2,0) with equal values; Lightning CSS's injected `--lightningcss-*` at (0,1,0) are reset under the light attribute and unused (no `light-dark()`) |
| Nothing else keys on the system's dark mode | `grep -rnE '\bdark:\|prefers-color-scheme\|custom-variant\|color-scheme\|matchMedia'` over `apps/web/src`, `apps/web/index.html`, `packages/visual-system/src`, `apps/extension/src` | only `styles.css:51, 84, 88, 113`; the `matchMedia` calls are width queries; no Tailwind `dark:` utility, no `.dark` class |
| Menu ARIA and keys | read Base UI 1.9.0 `menu/*` in `apps/web/node_modules/@base-ui/react` | radio item is `menuitemradio` with `aria-checked`; the group label names the group; radio items join the composite list, so the arrow keys move item by item; `closeOnClick` defaults to false for a radio item |
| Both render paths | read `App.tsx:599-666` | Header (phone width) and Sidebar (desktop) both get `theme` and `onThemeChange={changeTheme}`; Settings gets the same `theme` |
| No OpenPanel event, no saved toast | read `changeTheme` (`App.tsx:546`) and the save's success path (`App.tsx:383-386`) | no `track` call; a success toast only for `currency` |
| Em-dash in shipped copy | `git diff 5615d76 -- apps packages CONTEXT.md README.md \| grep '^+' \| grep '—'` by the finders, over every added line | none |
| Tautology audit | scratch worktree at `5615d76`, built, the branch's 11 test files copied in, run with `--reporter=verbose` | 79 tests added or changed: 69 red at base, 10 green (see Test quality) |
| Scratch cleanup | `git worktree list`, `git status --porcelain` | both scratch worktrees gone; tree clean |

**Overall:** The epic does what its spec asks. The preference saves and validates end to end, the head script sets the theme before the first paint (proved by a mutant the walk catches), the server value wins once the read lands, a failed save and a reset move the attribute and the copy through one effect, and the two controls share one state and one save. Every check, the browser walk included, is green. What remains is five LOWs: sign-out and account deletion leave the theme behind in the browser, two copy tests, two duplicate tests, three walked-past refactors, and a batch of comment hygiene. None blocks the PR.

## Approach decisions
- How the page gets its theme: one pure rule, `themeOnViewOf(saved, serverKnown, copyAtLoad)` in `apps/web/src/preferences.ts:130`, and one effect at `apps/web/src/App.tsx:340` that calls `applyTheme` whenever its answer changes; the read, a change, a failed save and a reset each move it by moving `saved` (#691 lane decision). Recommended fixes here change the theme by changing that rule's inputs or its answer, never by a second `applyTheme` call.
- The dark tokens are written twice in `styles.css`, once under the attribute and once in the media query, and `packages/visual-system/test/styles.test.ts` "the two dark blocks hold the same declarations" keeps them equal (#688 lane decision; plain CSS cannot join a selector and a media query in one rule). Not overturned here.
- The head script is built by `apps/web/theme-script-plugin.ts` from `src/theme-script.ts` as a hashed classic IIFE and injected ahead of the first script or stylesheet (#691 lane decision).
- The menu ignores a press on the already-checked item (`AccountMenu.tsx:167`), because Base UI calls `onValueChange` on every press (#692 lane decision).

## Confirmed Issues

### 1. Signing out or deleting the account leaves the creator's theme on the page and in the browser's copy — LOW
- **Location:** `apps/web/src/App.tsx:239` (the theme on view), with the two exits at `apps/web/src/App.tsx:556-563` (`signOut`) and `apps/web/src/App.tsx:465-476` (`deleteYourself`)
- **Attribution:** introduced. `git show 5615d76:apps/web/src/App.tsx | grep -n themeOnViewOf` prints nothing; the theme state arrived in `c6dedd6` (#691). The lane's review (`.epic-loop/tickets/691/review-2.md` F2.19) found it and filed it only as a proposal, which is not yet an issue (#704 does not list it).
- **Real-world trigger:** a creator who chose Dark signs out, or deletes their account, on a shared or family computer. The signed-out screen keeps drawing Dark, and every later load of `/app` on that browser draws Dark from the first frame (the head script reads the copy), until another account signs in and its own preferences read lands. For the deleted account, CONTEXT.md's Preference entry says preferences "go with the user when the user is deleted", and the copy does not. Cosmetic, no data at risk, so LOW.

**Evidence**
```ts
const theme = themeOnViewOf(saved, serverThemeKnown, themeAtLoad)
...
async function signOut() {
  assertAnswered(await fetch('/api/auth/sign-out', jsonPost))
  clearToasts()
  setError(null)
  sessionNumber.current += 1
  setSession({ state: 'signed-out' })
}
```

**Failure mode** — Both exits only move `session` to signed-out. `saved`, `serverThemeKnown` and `themeAtLoad` are untouched, so `theme` keeps its value, the effect at `:340` does not run, and `data-theme` and `localStorage['theme']` stay. On a reload while signed out, the preferences read never runs (`App.tsx:351` returns unless signed in), so `themeOnViewOf(null, false, copy)` keeps the copy for good. Proved by reading the code path; no harness, as a LOW.

**Recommended fix**
```diff
 import {
   ...
+  preferenceDefaults,
   ...
 } from './preferences.ts'
@@
-  const theme = themeOnViewOf(saved, serverThemeKnown, themeAtLoad)
+  const theme =
+    session.state === 'signed-out'
+      ? preferenceDefaults.theme
+      : themeOnViewOf(saved, serverThemeKnown, themeAtLoad)
```
The existing effect then removes the attribute and the copy on sign-out, on "Delete me", and on a load that finds no session. This is a product choice Nick has not yet made (the lane proposal "Sign-out and account deletion clear the theme copy"); the recommendation is reversible by deleting the condition.

**Remediation brief**
- **Design intent:** The page's theme is one derived value, `theme`, and one effect writes it to the root and the copy. The copy exists only to draw the signed-in creator's theme before their preferences read lands. With no creator signed in, there is no choice to draw, so the theme is System and the copy goes.
- **Full surface:** `apps/web/src/App.tsx:239` (the derived `theme`) and the `./preferences.ts` import list at `App.tsx:31-49`. `signOut` (`:556`) and `deleteYourself` (`:465`) need no edit: both already set the signed-out session. New tests go in `apps/web/src/app.test.ts`, in `describe('the signed-out screen')` (`:1155`), beside "shows no notice of a failed save made before \"Sign out\"".
- **Must preserve:** while the session is `loading` and when its read `failed`, the theme stays the copy's (the head script's first frame must not be undone before the session is known; the lane assumption "A failed preferences read leaves the attribute and the copy"). A failed sign-out (`assertAnswered` throws) keeps the signed-in screen and its theme. Every test in `describe('the Theme control on Settings (creator-analytics#691)')` (`app.test.ts:2229`) and `describe('the Theme items in the account menu (creator-analytics#692)')` (`:4330`), `apps/web/src/preferences.test.ts` "theme on view" tests, and the walk's theme step.
- **Do not touch:** `themeOnViewOf`'s signature and its unit tests; the head script; the walk's `themeBackTo` restore.
- **Proof:** add to `apps/web/src/app.test.ts`, red before the fix and green after: with `installFakeApi({ theme: 'dark' })` and `render('settings')`, a click on "Sign out" leaves `pageTheme()` equal to `{ attribute: null, copy: null }`; the same after "Delete me" with `window.confirm` stubbed to true. Run `pnpm exec vitest run apps/web/src/app.test.ts`.

### 2. Two tests assert approved copy word for word — LOW
- **Location:** `apps/web/src/app.test.ts:2233-2244` and `apps/web/src/app.test.ts:1596-1609`
- **Attribution:** `:2233` introduced in `c6dedd6` (#691). `:1596` pre-existing, exposed: the test exists at `5615d76` with the old warning literal, and `c6dedd6` edited it and widened its name to "names the theme", so standard 3 puts it on this change's path.
- **Real-world trigger:** none for users. Standard 2 ("No test asserts that fixed copy is present") calls for deleting such assertions on sight: they fail when Nick edits approved copy, never when the code breaks.

**Evidence**
```ts
expect(radiosIn(themeGroup(container)).map((radio) => accessibleNameOf(radio, true))).toEqual([
  'Light',
  'Dark',
  'System',
])
...
expect(asked).toEqual([
  'Reset your preferences? Page size, columns, charts, currency, the theme, the unlisted switch and the RPM switch go back to their defaults.',
])
```

**Failure mode** — Both restate a literal from `apps/web/src/settings.ts` (`themeOptions` at `:58-62`, `resetPreferencesWarning` at `:20-21`), so neither states a behaviour rule. The `'System'` in `checkedTheme(container)` beside it does reveal a branch, and stays.

**Recommended fix**
```diff
-    expect(radiosIn(themeGroup(container)).map((radio) => accessibleNameOf(radio, true))).toEqual([
-      'Light',
-      'Dark',
-      'System',
-    ])
+    expect(radiosIn(themeGroup(container)).map((radio) => accessibleNameOf(radio, true))).toEqual(
+      themeOptions.map(({ label }) => label),
+    )
@@
-  test('names the theme and the RPM switch among what goes back to its default (creator-analytics#456, #691)', async () => {
+  test('asks with the reset warning before it resets (creator-analytics#456, #691)', async () => {
@@
-    expect(asked).toEqual([
-      'Reset your preferences? Page size, columns, charts, currency, the theme, the unlisted switch and the RPM switch go back to their defaults.',
-    ])
+    expect(asked).toEqual([resetPreferencesWarning])
```
with `resetPreferencesWarning` added to the test file's import from `./settings.ts`.

**Remediation brief**
- **Design intent:** approved copy is held by Nick's approval on its issue and the approval comment in `settings.ts`, not by the suite. A test keeps only what the code decides: that the control renders every option in order, and that the reset asks with the warning before it clears.
- **Full surface:** `apps/web/src/app.test.ts:2233-2244`, `apps/web/src/app.test.ts:1596-1609`, and the test file's `./settings.ts` import (it already imports `themeOptions` and `themeLabel`).
- **Must preserve:** the `checkedTheme(container)` and `pageTheme()` assertions in the `:2233` test; the `confirm` stub, the `installFakeApi({ rpmAdsAndPremiumOnly: true })` setup and the click in the `:1596` test, inside `describe('the warning a "Reset preferences" asks first')`.
- **Do not touch:** the menu tests' `themeNames` (`:4331`), which already derive from `themeOptions`.
- **Proof:** `pnpm exec vitest run apps/web/src/app.test.ts` green, and `grep -n "the theme, the unlisted switch" apps/web/src/app.test.ts` prints nothing.

### 3. Two account menu tests repeat a rule another test already states — LOW
- **Location:** `apps/web/src/app.test.ts:4383` ("choosing System removes the attribute and the copy") and `apps/web/src/app.test.ts:4416-4417`
- **Attribution:** introduced in `1b184be` (#692).
- **Real-world trigger:** none for users; standard 2, "A duplicate that covers a rule an existing test already covers. One rule, one test."

**Evidence**
```ts
test('choosing System removes the attribute and the copy', async () => {
...
    expect(api.requests.length).toBe(requests)
    expect(savesOf(api)).toEqual([])
```

**Failure mode** — The menu's choice is `changeTheme`, which is `preferences.save({ theme: chosen })` (`App.tsx:546-548`), the same save Settings makes. That System removes the attribute and the copy is stated by Settings' "System removes the attribute and the copy" (`app.test.ts:2273`) and by `apps/web/src/theme.test.ts:87`; that the menu's press reaches the save is stated by "choosing Dark applies it at once ..." (`:4356`). In "choosing the checked item sends no save", the request count already implies the empty saves list.

**Recommended fix** — Delete the test at `app.test.ts:4383`, and delete the `expect(api.requests.length).toBe(requests)` line at `:4416` with the `requests` capture it reads, keeping `expect(savesOf(api)).toEqual([])`, which names the rule.

**Remediation brief**
- **Design intent:** one rule, one test. The menu tests state what is the menu's own: its group, its checked item, that its press reaches the shared save, that a press on the checked item saves nothing, and that a failed save puts its checked item back.
- **Full surface:** `apps/web/src/app.test.ts:4383-4394` and `:4408-4419`.
- **Must preserve:** "a failed save puts the attribute, the copy and the checked item back, and says so as Settings does" (`:4395`): it states #692's revert criterion for the menu's own checked item and stays. "choosing the checked item sends no save" must still go red when the guard at `AccountMenu.tsx:167` is removed (the lane's mutant: drop `if (chosen !== theme)`).
- **Do not touch:** the phone width test (`:4444`), the only coverage of the Header's render path.
- **Proof:** `pnpm exec vitest run apps/web/src/app.test.ts` green; then, in a scratch worktree only, remove `if (chosen !== theme)` at `apps/web/src/AccountMenu.tsx:167` and the same command goes red on "choosing the checked item sends no save".

### 4. Three refactors the change walked past — LOW
- **Location:** `apps/web/src/components/ui/dropdown-menu.tsx:122-131`; `apps/web/src/app.test.ts` helpers `checkedTheme` and `checkedInMenu`; `apps/web/src/app.test.ts:2230`
- **Attribution:** introduced in `c6dedd6` (#691) and `1b184be` (#692).
- **Real-world trigger:** none for users; standard 3, "A reviewer names the refactors the change walked past".

**Evidence**
```ts
const themeGroup = settingsThemeGroup
```

**Failure mode** — (a) `DropdownMenuRadioItem` copies `DropdownMenuItem`'s class list, `cn(itemIconLayout, 'cursor-pointer [&:hover]:underline [&:hover]:decoration-primary')`, word for word, so the two item looks can drift. (b) `checkedTheme` and `checkedInMenu` are the same filter and map (`aria-checked === 'true'`, then the accessible name) over two item lists. (c) `themeGroup` is a bare alias of the helper defined just above it.

**Recommended fix** — (a) hoist `const itemPressLook = cn(itemIconLayout, 'cursor-pointer [&:hover]:underline [&:hover]:decoration-primary')` beside `itemIconLayout` and use it in both items; (b) one `checkedNamesOf(items: Element[])` helper that both call; (c) use `settingsThemeGroup` directly in the Settings describe.

**Remediation brief**
- **Design intent:** behaviour-preserving only. The class lists stay byte-identical in the rendered DOM, which the built CSS test reads through `cn()`.
- **Full surface:** `apps/web/src/components/ui/dropdown-menu.tsx` (`DropdownMenuItem` and `DropdownMenuRadioItem`); `apps/web/src/app.test.ts` (`checkedTheme`, `checkedInMenu` and their callers in the two theme describes; `themeGroup` at `:2230` and its uses in that describe).
- **Must preserve:** `apps/web/test/built-css.test.ts` and `apps/web/src/components.test.ts` green; the rendered class string of every menu item unchanged.
- **Do not touch:** `className={cn('inline-flex')}` on the radio indicator, which follows the file's stated `cn()` convention.
- **Proof:** `pnpm exec vitest run apps/web/src/app.test.ts apps/web/src/components.test.ts apps/web/test/built-css.test.ts` and `pnpm typecheck` green.

### 5. Comment hygiene — LOW (aggregated)
- `apps/web/src/theme.ts:3-4` — "It names no DOM type, so the built web app's test, which runs outside the DOM's types, can import its key." → "It names no DOM element type; `Storage` and `localStorage` resolve from @types/node in the built web app's test, which runs outside the DOM's types, so that test can import its key."
- `apps/web/src/App.tsx:543-545` — "a failed save's revert and notice are Settings' own" → "a failed save's revert and notice are the shared save's, as for Settings"
- `apps/site/test/screenshot/browser-walk.ts:4545-4546` — "while the Fetch domain holds the preferences read, so only the head script can have set them" → "while the Fetch domain holds the preferences read; App also applies the copy on mount, but it mounts only after `readClientSettings()` resolves, after the first frame, so the probe sees the head script's work (a no-op head script turns this step red)"
- `apps/web/vite.config.ts:19` — "// The head script that sets the theme before the first paint (creator-analytics#691)." → delete: it restates `themeScript()`'s own JSDoc in `apps/web/theme-script-plugin.ts:8-15`
- `apps/web/src/app.css:12-13` — "there is still no `.dark` class" → "there is no `.dark` class"
- `apps/web/src/Settings.tsx:50-52` — the reflow leaves the stub line " * at once. App" → rewrap the paragraph so "App holds what each action does ..." continues on one line
- `apps/web/src/components/ui/dropdown-menu.tsx:17-18` — the ragged line "dark or highlight classes. The separator, between the" → rewrap the comment block at 100 columns
- `apps/web/src/app.test.ts:35` — a 131-column line in the header comment → rewrap at 100 columns
- `packages/visual-system/test/styles.test.ts:2-4` — a 133-column line, and "so they cannot show either mode as a browser draws it" → "so they cannot show any of the three states as a browser draws it", and "Nick checks the light and dark modes of the site and the web app in a real browser" → "the browser walk draws each state in Chrome (creator-analytics#691), and Nick checks the look in a real browser"

## Needs Further Investigation

None.

## Reviewed and Dismissed
- The walk's first-frame probe cannot tell whether the head script ran — dismissed by execution: with `theme-script.ts` replaced by `export {}`, the walk goes red at its first-frame check. App applies the copy too, but only after `readClientSettings()` resolves in `main.tsx`; the comment's imprecision is in Finding 5.
- The dark tokens are "written twice, not declared once" — a recorded #688 decision (Approach decisions); the equality test holds the two blocks together and can go red.
- A future Tailwind `dark:` utility would ignore the chosen theme — nothing uses one today (grep above); preventive only, no defect.
- `apps/web/theme-script-plugin.ts:63` slices to `indexOf('</head>')` without a -1 guard — `apps/web/index.html` always has a head; unreachable.
- The nested `build()` in the plugin uses `configFile: false`, so it gets no `@/` alias — `theme.ts` imports only a type and nothing through `@/`; the built script is one 471-byte IIFE with no imports.
- The head script rewrites the copy on every load, and deletes an unknown one — harmless, and an unknown copy means System by the spec.
- The head script could throw and block the page — `pageStorage` reaches `localStorage` lazily, and `storedTheme`, `applyTheme` and the outer try/catch each catch.
- No sync across open tabs — not asked for by any criterion.
- A theme change while the session is still loading — unreachable: Header renders a placeholder, not the account menu, until a signed-in email exists (`apps/web/src/Header.tsx:45-48`, `App.tsx:594`).
- `apps/api/src/preferences.test.ts:124-127` refusal rows are green at base — at base `theme` is refused as an unknown key; at HEAD they are live (the #691 lane's mutant `theme: () => true` at `apps/api/src/preferences.ts:37` turns them red). Keep.
- The menu's failed-save test (`app.test.ts:4395`) duplicates Settings' — it states #692's revert criterion for the menu's own checked item; kept (Finding 3, Must preserve).
- `packages/visual-system/test/styles.test.ts:64` "data-theme=\"light\" declares no token" is green at base — a "declares no token" rule is met by absence; it goes red if anyone adds a token to the light block, and the color-scheme test at `:75` proves the block exists.

## Minor / nits
- A press on the already-checked item before the preferences read lands saves nothing, in the menu (`AccountMenu.tsx:167`) and in Settings (the segmented control fires only on a change), so the read then puts the server's theme back. The window is the few milliseconds before the read lands, and the guard is a recorded #692 decision.
- The walk measures "applies at once" by polling while the stub answers the save straight away, and its reload check can pass on the browser copy alone. `app.test.ts` "a press applies the theme at once, before its save lands" holds the save, and the API tests prove the value persists, so the rules are covered at a lower layer.
- The walk checks a menu choice showing in Settings, not a Settings choice showing in the menu; the menu's `test.each` at `app.test.ts:4333` covers that direction over the fake API.
- The walk reads `--bg` and the attribute but never the computed `color-scheme`; the built CSS tests cover the declarations.
- The walk's Settings presses run only on a light system, and its site check only with a Dark copy on a light system.
- The menu `test.each` at `app.test.ts:4333` repeats the shape test's group-name check (`:3902`).
- `apps/web/test/web.test.ts:2199` `toBeGreaterThan(head.indexOf('Content-Security-Policy'))` would pass with no policy meta (-1); other assertions in that test carry it.
- `packages/visual-system/test/testing.ts` `declarationsOf` splits on `;`, so a `data:...;base64` value would split; only property names are compared, so harmless today.
- The three theme values are written in `packages/api-types/src/preferences.ts`, `packages/database/src/preferences.ts:12` (forced: the database package does not depend on api-types, as for its other enums), `apps/web/src/theme.ts:24` (the head script's no-value-imports size goal) and `apps/web/src/settings.ts`.

## Test quality
Tests added or changed: 79 (parameterised cases counted one each) · red at base: 69 · green at base: 10 · tautology shapes found: 2, both copy assertions (Finding 2).
- Green at base, kept: the 8 tests in `packages/visual-system/test/testing.test.ts` (`:82`, `:89`, `:96`, `:105`, `:120`, `:126`, `:133`, `:146`, added in `4f2fd9b`) test the test helper, which the audit copied into base, so green by construction; `packages/visual-system/test/styles.test.ts:64`, dismissed above; `apps/web/src/preferences.test.ts:255` "put the theme back, and leave it when the failed save did not carry it" (`c6dedd6`), which states the theme's revert rule through the generic `preferencesAfterFailedSave` and is live under the #691 lane's mutant at `apps/web/src/preferences.ts:246`.
- Masked by import failure at base, live at HEAD: `apps/api/src/preferences.test.ts:124-127` (dismissed above).
- Expectations from production constants: the menu tests' `themeNames` (`app.test.ts:4331`) and the API's `test.for(themes)` (`apps/api/src/preferences.test.ts:221`) iterate the production lists, as the file's other enums do. Acceptable: the values themselves are pinned by the database CHECK test and the API's refusal rows.
- No snapshots, no assertion-free tests, no mocked unit under test, no call-shaped-only assertions.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and the full suite green at `ef4fc77`; the browser walk green locally.
- **Commit hygiene:** the branch is clean. Commit this doc. Nothing to drop.
- **Likely reviewer asks:** the migration's CHECK on a nullable column (absent means System, by the table's convention); why the dark tokens are written twice; the open lane proposal on the privacy policy (`apps/site/privacy.html` names neither the theme preference nor its `localStorage` copy) and on sign-out (Finding 1).

## Verdict
Ready to open the PR with follow-ups. No CRITICAL, HIGH or MEDIUM finding. The five LOWs (sign-out and deletion leave the theme in the browser, two copy tests, two duplicate tests, three walked-past refactors, comment hygiene) can be remediated before the PR or carried as follow-up tickets; none is a merge gate. No prior review findings to close: this is the epic's first pre-PR review.
