# Pre-PR review: creator-analytics#642 A light and dark theme switch, not only the system preference

**Branch:** `creator-analytics-642-theme-switch` vs `origin/main` (merge-base `5615d76` "Merge pull request #707 from nick-vogel/creator-analytics-571-sidebar-account-settings")
**Reviewed at:** HEAD `df52d00` ("creator-analytics#642 The privacy policy names the theme and its copy in the browser"), clean tree, no uncommitted or untracked files at review time. Whole branch: 39 files, +3653 / −80, 12 commits (the 10 of review 1, then `12eec91` "creator-analytics#642 pre-PR review 1" and `df52d00`). 1834 of the added lines are the generated Drizzle snapshot `packages/database/drizzle/meta/0024_snapshot.json`.
**Delta under review:** since `ef4fc77` ("creator-analytics#692 Theme: the three radio items in the account menu"), the HEAD that `pre-pr-review-1.md` reviewed. The delta is 3 files, +254 / −3: the review doc itself (`12eec91`) and `df52d00`, which edits `apps/site/privacy.html` (+11 / −2) and `apps/site/test/site.test.ts` (+12 / −1). No other file changed, so every `file:line` carried forward from review 1 is still exact.
**Reviewed against:** the epic creator-analytics#642 and its sub-issues #382, #688, #691 and #692 (as summarised in review 1), CODING_STANDARDS.md standard 2 (tests state a rule; no copy test), the privacy copy Nick approved word for word for #691 at the #642 close-out (held in the run's `.epic-loop/privacy-approved.md`, Passage A and Passage B), and `pre-pr-review-1.md`.
**Date:** 2026-11-12
**Reviewer:** 1 `pr-review-finder` agent (the two delta files and the policy's claims against the web app) + verify pass

## What was verified and how

| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | already up to date |
| Lint | `pnpm lint` (Biome) at `df52d00` | green, 680 files |
| Typecheck | `pnpm typecheck` at `df52d00` | green |
| Site suite | `pnpm exec vitest run apps/site/test/site.test.ts`, `TEST_DATABASE_ADMIN_URL` unset | green, 70 passed. The suite builds the site from the worktree in `beforeAll` (`site.test.ts:232`), so it read the edited HTML |
| New test can go red | scratch worktree at `df52d00` with `apps/site/privacy.html` replaced by its `ef4fc77` version, then `pnpm exec vitest run apps/site/test/site.test.ts -t "names the theme's copy"` | red, as it should be: "expected '<h2>Cookies and device storage</h2>…' to contain '<code>theme</code>'". Scratch worktree removed |
| Approved copy, byte for byte | Python substring check of both approved passages (indentation and wrapping included) against `apps/site/privacy.html` | Passage A and Passage B both present exactly; the HTML approval comment matches; "Last updated November 12, 2026" (`privacy.html:12`) unchanged, as the approval says |
| Policy claims against the code | finder agent, traced through `apps/web/src/theme.ts`, `theme-script.ts`, `App.tsx`, `preferences.ts`, `apps/web/vite.config.ts` and `docs/deploy.md` | all six claims hold (see Reviewed and Dismissed) |
| Em-dash in shipped copy | `git diff ef4fc77 -- apps \| grep '^+' \| grep -c '—'` | 0 |
| Other browser storage the section might deny | `grep -rn 'localStorage\|sessionStorage\|indexedDB'` over `apps/web/src`, `apps/site`, `apps/extension/src`; `@openpanel/web` 1.4.1 read for its storage use | the web app's only storage is the theme copy; OpenPanel writes `sessionStorage` only through `pendingRevenue()`, which nothing calls; the Studio extension keeps storage the section does not name (Needs Further Investigation A) |
| Build, full suite, browser walk | not re-run | the delta is one static HTML file and one site test; the site suite above builds the site and runs the only tests that read the policy. Review 1 ran all three green at `ef4fc77`, and no code the build, the suite's other files or the walk exercise has changed since |
| Scratch cleanup | `git worktree list`, `git status --porcelain` | scratch worktree gone; tree clean before this doc |

**Overall:** The delta does what it set out to do: the privacy policy now names the theme among the display preferences and discloses the browser copy, in exactly the words Nick approved, and the new site test ties the policy to the key the web app writes under, a rule from outside the copy that goes red on the old policy. No new defect. The five LOWs of review 1 stay open, untouched by design (round 1 converged with no remediation), and one of them, sign-out leaving the copy, is now the behaviour the approved policy describes. The PR can open.

## Approach decisions
- How the page gets its theme: one pure rule, `themeOnViewOf(saved, serverKnown, copyAtLoad)` in `apps/web/src/preferences.ts:130`, and one effect at `apps/web/src/App.tsx:340` that calls `applyTheme` whenever its answer changes; the read, a change, a failed save and a reset each move it by moving `saved` (#691 lane decision). Recommended fixes here change the theme by changing that rule's inputs or its answer, never by a second `applyTheme` call.
- The dark tokens are written twice in `styles.css`, once under the attribute and once in the media query, and `packages/visual-system/test/styles.test.ts` "the two dark blocks hold the same declarations" keeps them equal (#688 lane decision). Not overturned.
- The head script is built by `apps/web/theme-script-plugin.ts` from `src/theme-script.ts` as a hashed classic IIFE and injected ahead of the first script or stylesheet (#691 lane decision).
- The menu ignores a press on the already-checked item (`AccountMenu.tsx:167`), because Base UI calls `onValueChange` on every press (#692 lane decision).
- The privacy policy's claims about the theme copy are held by Nick's word-for-word approval; the suite holds only that the device storage section names the copy by `themeCopyKey`, the same shape as the policy-names-the-manifest's-hosts test (#137). New in this round, from `df52d00`.

## Prior-review closure

Review 1 (`pre-pr-review-1.md`, at `ef4fc77`) confirmed 5 findings, all LOW, and carried no remediation closure table: stage 2 round 1 converged on zero MEDIUM-or-higher findings and remediated nothing.

| Prior finding | Status at `df52d00` | Carried as |
| --- | --- | --- |
| 1. Sign-out and account deletion leave the theme on the page and in the copy (LOW) | untouched in code; now disclosed by the approved policy ("It stays when you sign out or delete your account", `privacy.html:271`) | 1 |
| 2. Two tests assert approved copy word for word (LOW) | untouched | 2 |
| 3. Two account menu tests repeat a rule (LOW) | untouched | 3 |
| 4. Three walked-past refactors (LOW) | untouched | 4 |
| 5. Comment hygiene (LOW, aggregated) | untouched | 5, with two new entries |

Fully fixed: 0. Partially fixed: 0. Untouched: 5, none MEDIUM or higher. Resolved only by a doc edit: none, though Finding 1's behaviour is now written into the policy, which turns its fix into a copy decision (see its brief). Review 1's "Likely reviewer asks" named the policy's silence on the theme and its copy; `df52d00` closes that ask.

## Confirmed Issues

### 1. Signing out or deleting the account leaves the creator's theme on the page and in the browser's copy — LOW
- **Location:** `apps/web/src/App.tsx:239` (the theme on view), with the two exits at `apps/web/src/App.tsx:556-563` (`signOut`) and `apps/web/src/App.tsx:465-476` (`deleteYourself`); the policy sentence that now describes it at `apps/site/privacy.html:271-272`
- **Attribution:** introduced. `git show 5615d76:apps/web/src/App.tsx | grep -n themeOnViewOf` prints nothing; the theme state arrived in `c6dedd6` (#691). Carried from review 1 Finding 1, unchanged in code since `ef4fc77`.
- **Real-world trigger:** a creator who chose Dark signs out, or deletes their account, on a shared or family computer. The signed-out screen keeps drawing Dark, and every later load of `/app` on that browser draws Dark from the first frame (the head script reads the copy), until another account signs in and its own preferences read lands. CONTEXT.md's Preference entry says preferences "go with the user when the user is deleted"; the copy does not. Cosmetic, no data at risk, so LOW.

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
and, new since review 1, the approved policy (`privacy.html:271-272`): "It stays when you sign out or delete your account. To remove it then, clear your browser's data for stillstats.com."

**Failure mode** — Both exits only move `session` to signed-out. `saved`, `serverThemeKnown` and `themeAtLoad` are untouched, so `theme` keeps its value, the effect at `:340` does not run, and `data-theme` and `localStorage['theme']` stay. On a reload while signed out, the preferences read never runs (`App.tsx:351` returns unless signed in), so `themeOnViewOf(null, false, copy)` keeps the copy for good. Proved by reading the code path in review 1, and re-traced for sign-out by this round's finder; no harness, as a LOW.

**Recommended fix** — Nick's approval of the policy now describes this behaviour as intended, so the recommendation this round is to **keep the behaviour and close the finding by decision**. If Nick instead wants sign-out and deletion to clear the theme, the code change is review 1's diff below, and it ships only together with re-approved policy copy, because the fix makes `privacy.html:271-272` false:
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

**Remediation brief**
- **Design intent:** The page's theme is one derived value, `theme`, and one effect writes it to the root and the copy. The copy exists only to draw the signed-in creator's theme before their preferences read lands. Whether a signed-out browser keeps drawing the last creator's theme is a product choice, and the approved policy currently says it does.
- **Full surface:** `apps/web/src/App.tsx:239` (the derived `theme`) and the `./preferences.ts` import list at `App.tsx:31-49`; `apps/site/privacy.html:271-272` (the approved sentence "It stays when you sign out or delete your account. To remove it then, clear your browser's data for stillstats.com.", which must be replaced with copy Nick approves word for word). `signOut` (`:556`) and `deleteYourself` (`:465`) need no edit. New tests go in `apps/web/src/app.test.ts`, in `describe('the signed-out screen')` (`:1155`).
- **Must preserve:** while the session is `loading` and when its read `failed`, the theme stays the copy's (the head script's first frame must not be undone before the session is known). A failed sign-out (`assertAnswered` throws) keeps the signed-in screen and its theme. Every test in `describe('the Theme control on Settings (creator-analytics#691)')` (`app.test.ts:2229`) and `describe('the Theme items in the account menu (creator-analytics#692)')` (`:4330`), `apps/web/src/preferences.test.ts` "theme on view" tests, the walk's theme step, and `apps/site/test/site.test.ts` "the privacy policy's device storage section names the theme's copy by the web app's own key".
- **Do not touch:** `themeOnViewOf`'s signature and its unit tests; the head script; the walk's `themeBackTo` restore; the policy's other approved sentences.
- **Proof:** only if Nick chooses the change: add to `apps/web/src/app.test.ts`, red before the fix and green after: with `installFakeApi({ theme: 'dark' })` and `render('settings')`, a click on "Sign out" leaves `pageTheme()` equal to `{ attribute: null, copy: null }`; the same after "Delete me" with `window.confirm` stubbed to true. Run `pnpm exec vitest run apps/web/src/app.test.ts`.
- **Escalation:** a remediator must not apply the code diff without newly approved policy copy; without it, the right outcome is "closed by decision".

### 2. Two tests assert approved copy word for word — LOW
- **Location:** `apps/web/src/app.test.ts:2233-2244` and `apps/web/src/app.test.ts:1596-1609`
- **Attribution:** `:2233` introduced in `c6dedd6` (#691). `:1596` pre-existing, exposed: the test exists at `5615d76` with the old warning literal, and `c6dedd6` edited it and widened its name to "names the theme", so standard 3 puts it on this change's path. Carried from review 1 Finding 2, unchanged.
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
- **Do not touch:** the menu tests' `themeNames` (`:4331`), which already derive from `themeOptions`; the new site test at `apps/site/test/site.test.ts:1258-1264`, which is not a copy test (Reviewed and Dismissed).
- **Proof:** `pnpm exec vitest run apps/web/src/app.test.ts` green, and `grep -n "the theme, the unlisted switch" apps/web/src/app.test.ts` prints nothing.

### 3. Two account menu tests repeat a rule another test already states — LOW
- **Location:** `apps/web/src/app.test.ts:4383` ("choosing System removes the attribute and the copy") and `apps/web/src/app.test.ts:4416-4417`
- **Attribution:** introduced in `1b184be` (#692). Carried from review 1 Finding 3, unchanged.
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
- **Must preserve:** "a failed save puts the attribute, the copy and the checked item back, and says so as Settings does" (`:4395`): it states #692's revert criterion for the menu's own checked item and stays. "choosing the checked item sends no save" must still go red when the guard at `AccountMenu.tsx:167` is removed (drop `if (chosen !== theme)`).
- **Do not touch:** the phone width test (`:4444`), the only coverage of the Header's render path.
- **Proof:** `pnpm exec vitest run apps/web/src/app.test.ts` green; then, in a scratch worktree only, remove `if (chosen !== theme)` at `apps/web/src/AccountMenu.tsx:167` and the same command goes red on "choosing the checked item sends no save".

### 4. Three refactors the change walked past — LOW
- **Location:** `apps/web/src/components/ui/dropdown-menu.tsx:122-131`; `apps/web/src/app.test.ts` helpers `checkedTheme` and `checkedInMenu`; `apps/web/src/app.test.ts:2230`
- **Attribution:** introduced in `c6dedd6` (#691) and `1b184be` (#692). Carried from review 1 Finding 4, unchanged.
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
- `apps/site/test/site.test.ts:1133` (new, `df52d00`) — a 105-column line, "// #120, #202, #338, #488, #539, #657 and #691. The Studio extension section's tests hold the sentences" → rewrap the block from `:1133` at 100 columns, folding the stray short line ":1135 sends rests on the extension's" and the 126-column `:1140` back into the paragraph while there
- `apps/site/test/site.test.ts:1123-1129` (new, `df52d00`) — the block's "Limits: these tests prove each page carries the links it must, that the Studio extension section names the manifest's hosts, ..." omits the tie `df52d00` added → add after the #137 sentence: "and that the device storage section names the theme's copy by the web app's `themeCopyKey` (#691); whether the copy is kept and removed as the policy says rests on the web app's theme tests in `apps/web/src/app.test.ts` and `apps/web/src/theme.test.ts`."
- `apps/web/src/theme.ts:3-4` — "It names no DOM type, so the built web app's test, which runs outside the DOM's types, can import its key." → "It names no DOM element type; `Storage` and `localStorage` resolve from @types/node in the built web app's test, which runs outside the DOM's types, so that test can import its key." (The site test now imports the key too, through `apps/site`'s own tsconfig; the corrected sentence still holds.)
- `apps/web/src/App.tsx:543-545` — "a failed save's revert and notice are Settings' own" → "a failed save's revert and notice are the shared save's, as for Settings"
- `apps/site/test/screenshot/browser-walk.ts:4545-4546` — "while the Fetch domain holds the preferences read, so only the head script can have set them" → "while the Fetch domain holds the preferences read; App also applies the copy on mount, but it mounts only after `readClientSettings()` resolves, after the first frame, so the probe sees the head script's work (a no-op head script turns this step red)"
- `apps/web/vite.config.ts:19` — "// The head script that sets the theme before the first paint (creator-analytics#691)." → delete: it restates `themeScript()`'s own JSDoc in `apps/web/theme-script-plugin.ts:8-15`
- `apps/web/src/app.css:12-13` — "there is still no `.dark` class" → "there is no `.dark` class"
- `apps/web/src/Settings.tsx:50-52` — the reflow leaves the stub line " * at once. App" → rewrap the paragraph so "App holds what each action does ..." continues on one line
- `apps/web/src/components/ui/dropdown-menu.tsx:17-18` — the ragged line "dark or highlight classes. The separator, between the" → rewrap the comment block at 100 columns
- `apps/web/src/app.test.ts:35` — a 131-column line in the header comment → rewrap at 100 columns
- `packages/visual-system/test/styles.test.ts:2-4` — a 133-column line, and "so they cannot show either mode as a browser draws it" → "so they cannot show any of the three states as a browser draws it", and "Nick checks the light and dark modes of the site and the web app in a real browser" → "the browser walk draws each state in Chrome (creator-analytics#691), and Nick checks the look in a real browser"

## Needs Further Investigation

### A. The policy's device storage section does not name the Studio extension's own storage — Nick's reading of the section's scope would settle it
The section ("Cookies and device storage", `apps/site/privacy.html:254-281`) names two cookies and, since `df52d00`, the theme copy, and closes with "On every other page, no third party stores or reads information on your device". The Studio extension keeps `sign-in-click-pending` in its popup's `localStorage` (`apps/extension/src/popup.ts:154-157`) and an install hold in IndexedDB (`apps/extension/src/held-install.ts:89-134`, `indexedDbInstallHold`, added in `0615edf`), and neither the section nor the extension section (`privacy.html:90-130`) names them. Both live in the extension's origin, not stillstats.com, and no sentence strictly denies them; the new "Stillstats also keeps a copy of your theme" makes the section read more like a complete list than it did. Pre-existing, untouched by this branch, and a copy question rather than a code defect: if Nick reads the section as covering everything Stillstats stores on the device, it becomes a follow-up issue for new approved copy; if he reads it as the website's storage only, it is dismissed.

## Reviewed and Dismissed
- The new site test is a copy test (standard 2) — dismissed: its expected value is `themeCopyKey`, imported from `apps/web/src/theme.ts`, not a literal restating the policy; it is "a rule over the copy that comes from somewhere other than the copy", the same shape as the policy-names-the-manifest's-hosts test (#137). It asserts only the key, not the approved sentences, and it went red by execution on the `ef4fc77` policy.
- Policy claim (a), local storage "for stillstats.com" under `theme` — holds: `themeCopyKey = 'theme'` (`apps/web/src/theme.ts:11`); the web app is served under `/app/` on the site's origin (`apps/web/vite.config.ts` `base: '/app/'`, `docs/deploy.md:84`), and production answers only on `https://stillstats.com` (`docs/deploy.md:155-158`).
- Claim (b), "so that the app's pages show your theme as they load" — holds: the head script applies the copy before the stylesheet (`theme-script.ts:7-11`, `theme-script-plugin.ts:51-63`), and `App.tsx:237` seeds `themeAtLoad` from it; the site's own pages read no storage outside `test/screenshot`.
- Claim (c), the copy "holds only light or dark" — holds: `applyTheme` removes the key for System and sets it otherwise (`theme.ts:56-57`), and the head script turns an unknown value into System and so removes it (`theme.ts:23-25`).
- Claim (d), removed on choosing System or a reset — holds, through `themeOnViewOf` and the effect at `App.tsx:340`, pinned by `app.test.ts` "System removes the attribute and the copy" (`:2273`) and the reset tests at `:2359` and `:2371`.
- Claim (e), the copy stays on sign-out and deletion — holds; it is the behaviour of Finding 1.
- Claim (f), not a cookie and never sent — holds: `theme.ts` is the only reader, and nothing puts the value in a header or body.
- OpenPanel's `sessionStorage` contradicts "OpenPanel ... keeps no identifier on your device" — dismissed: `@openpanel/web` 1.4.1 writes `openpanel-pending-revenues` only through `pendingRevenue()`, which nothing in `apps/web/src` or `apps/site/src` calls.
- The approval comment cites #691 rather than #642 — dismissed: the comment text itself is part of the approved Passage A, and the approval was given for #691 at the #642 close-out.
- The approval comment at `privacy.html:141` is 144 columns — dismissed: approved word for word, and already over 100 at `ef4fc77`.
- Every dismissal of review 1 stands; no file they cite has changed since `ef4fc77`.

## Minor / nits
- "Only while your theme is Light or Dark" (`privacy.html:269-270`) is exact for the theme on view in that browser, not always for the account's stored theme: a browser that last saw Dark keeps `dark` until its next load of the app after another browser chose System, and a tab closed while an optimistic Dark save is in flight leaves `dark` while the server holds System. Both correct themselves on the next load of the app. Approved copy, so no action unless Nick wants the extra precision.
- Review 1's nits stand unchanged.

## Test quality
Tests added or changed in the delta: 1 · green against `ef4fc77`'s policy: 0 (red by execution in a scratch worktree) · tautology shapes found: 0. The test reads the built site's real policy and takes its expectation from the web app's key constant, so it goes red if the paragraph is dropped or the key is renamed. Review 1's audit of the branch's other 79 tests stands (69 red at base, 10 green, two copy assertions in Finding 2).

## Before opening the PR
- **CI readiness:** lint and typecheck green at `df52d00`; the site suite green; build, full suite and browser walk green at `ef4fc77` with no code change since.
- **Commit hygiene:** the branch is clean. Commit this doc. Nothing to drop.
- **Likely reviewer asks:** whether sign-out should clear the theme (Finding 1, now a copy decision); whether the device storage section should name the extension's storage (Needs Further Investigation A); the migration's CHECK on a nullable column; why the dark tokens are written twice.

## Verdict
Ready to open the PR with follow-ups. No CRITICAL, HIGH or MEDIUM finding, in this round or the last. The delta (the privacy policy and its test) introduced no defect; the confirmed list is review 1's five LOWs carried forward, with two comment entries added, which is the expected shrink-to-steady state of a re-review over a two-file delta, not a backfill. Prior findings closed: 0 of 5, all LOW, none MEDIUM or higher; none was "resolved" by a comment edit, though Finding 1's behaviour is now stated by the approved policy, so its recommended outcome is closure by decision. Nothing gates the PR; Findings 2 to 5 can be remediated before it or carried as a follow-up, and Needs Further Investigation A is Nick's call on the policy's scope.
