# Pre-PR review: creator-analytics#571 Sidebar: the account row becomes a profile and settings section

**Branch:** `creator-analytics-571-sidebar-account-settings` vs `origin/main` (merge-base `511ab6b` "Merge pull request #681 from nick-vogel/creator-analytics-637-retention-player")
**Reviewed at:** HEAD `6aaa375` ("creator-analytics#590 The account row and its menu"), clean tree, no uncommitted or untracked files at review time. Whole branch: 39 files, +860 / −446, 7 commits (#589 at `5442bb7` and `7fada76`, #590 at `8f884c5`, `6e688a8`, `bb61dc0`, `de2fd6a`, `6aaa375`).
**Delta under review:** none, a fresh full review (round 1, `--fresh`).
**Reviewed against:** the epic creator-analytics#571 (body and both grill comments), its children #589 and #590, CODING_STANDARDS.md, CONTEXT.md, ADR 0007 and ADR 0014. No plan or spec docs under `docs/`, and no prior review docs in this folder.
**Date:** 2026-11-12
**Reviewer:** 3 `pr-review-finder` agents + 1 tautology-audit agent + verify pass

## What was verified and how

| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | green, lockfile unchanged |
| Lint | `pnpm lint` | green: 671 files |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` | green |
| Full suite | `pnpm test` (Testcontainers Postgres), `TEST_DATABASE_ADMIN_URL` unset | first run 1 red: `apps/api/src/video-list.test.ts:1500` "after first365, the cache answers each later window's first slice" timed out at 5000ms while the tautology agent's base-checkout suite ran beside it. The file is untouched by this branch. Re-run after 60 s green: 162 files, 4,127 passed, 1 expected fail. A load flake |
| Browser walk | `pnpm run --if-present test:browser` at `6aaa375` | green: no content security policy violation in 63 steps, the walk passed |
| Rename completeness | `git grep` for `profile_opened`, `'profile'`, `/app/profile`, `routeToProfile`, `.profile`, `"Profile"`, "profile screen" over `apps`, `packages`, `docs`, `README.md`, `CONTEXT.md` | code and the three named copies are clean; `docs/oauth-verification.md` still names the screen "Profile" twelve times (Finding 1) |
| Redirect | read `route.ts:183-191` (`routeOf`), `route.ts:450-457` (`readAddress`), `App.tsx:291-292` | `/app/profile` with any query becomes `/app/settings` with the route's query through `replaceState`; `support=thanks` is read before the route; held by `app.test.ts` "the Settings screen at its old profile address" (no `pushState`, history length unchanged) |
| OpenPanel names | read every emitter (`Settings.tsx` `settingsOpenedEvent`, `supportOpenedEvent('settings')`, `App.tsx` `supportOpenedEvent('sidebar')`), `support.ts` `supportSurfaces`, `landing.ts:49`; grep of `apps/api` for a server-side list of web event names | consistent; no server list of web event names exists (the relay validates extension events only) |
| Height condition | `git grep` for `28.25`, `28.5rem`, `451.6`, `453.2` | `28.5rem` in `app.css:2168` and `sidebar-column.ts:12`, held equal by `web.test.ts:680`; 453.2px / 16 = 28.325rem, next quarter rem 28.5; `app.test.ts:4466` 455/456px windows agree |
| Accessibility | read `AccountMenu.tsx` against Base UI's `Menu.Trigger` and `Menu.GroupLabel` | open row named "Settings, " plus the email, collapsed row and header avatar named "Settings", trigger keeps `aria-haspopup="menu"`, the menu header is a group label and takes no focus, every icon `aria-hidden` |
| CSS cascade | read `app.css` against `packages/visual-system/src/styles.css:174-192` | `.account-menu-header .avatar:hover` (0,3,0) outranks `.avatar:hover`; `.sidebar-account .avatar` outranks `.avatar`; both sheets unlayered, app.css later |
| Chevron colour | read `select.tsx:25` and `app.css` for any `svg` or `.account-chevron` colour rule | the picker's chevron is `text-muted-foreground` (`--ink-soft`); the row's inherits full ink (Finding 2) |
| lucide default `aria-hidden` | read `node_modules/lucide-react/dist/esm/shared/src/build/buildLucideIconNode.mjs:47-49` | lucide adds `aria-hidden="true"` to any icon with no a11y prop (Finding 5) |
| Tautology audit | branch's 15 new or changed test files copied into a scratch worktree at `511ab6b`, run there with the JSON reporter; rename-only stand-ins added to separate rename-only tests from new rules; two mutation runs | 6 files red on import as expected; 18 new or changed tests green at base, each legitimately (name-only, fixture rename, or a negative boundary row); both review-fix proofs (`bb61dc0`, `de2fd6a`) red at base, and `bb61dc0`'s goes red again on `-mx-1 my-1`. Worktree removed |

**Overall:** The rename, the redirect, the OpenPanel names, the account row, the menu and the height condition all hold, and every full check is green, the browser walk included. One MEDIUM: the OAuth verification document, which the product submits to Google, still sends the reader to a "Profile" item and a "profile screen" the app no longer has. The rest are LOW: the row's chevron drawn in full ink beside the picker's muted one, and test hygiene. Fix Finding 1 before the PR opens; the LOWs can ride along or follow.

## Approach decisions
- Screen name: one leaf module, `apps/web/src/settings-name.ts` (`settingsName`), read by the menu item, the heading, the row and the site test (#589 lane decision). Recommended fixes here read it and add no second literal.
- Redirect: `routeOf('profile', q)` returns the Settings route and `readAddress`'s existing `replaceState` rewrites the address; no server rule (#589).
- The menu: header as a group label, no separator between it and Settings, the version line right after Sign out with no separator, every item an icon from `lucide-react` (#590).
- The row's two lines share the picker's rule blocks (`.picker-handle, .account-heading` and `.picker-name, .sidebar-email`), so the built CSS tests can hold them equal; the email takes the picker name's full ink (#590).
- Sample email `fen@example.com`, short enough to show whole in the open row's about 119px (#590 fix pass 1). Most real emails show cut there, by decision.
- Copy and docs: ADR 0015, `docs/research` and `docs/reviews` stay as written, since they record decisions as made (#589). `docs/oauth-verification.md` is not a record: it is the text submitted at the next verification, so it changes with the app (this review, Finding 1).
- The chevron takes the picker chevron's muted ink through `app.css`, the same `--ink-soft` that `text-muted-foreground` maps to at `app.css:19` (this review, Finding 2).
- The OAuth verification document names the screen with the app's own word in the doc's own two forms: "the Settings screen" in prose and `"Settings"` in quotes where the operator clicks or opens it, the same form the shot list already used for "Profile". Scope names (`profile`) and Chrome's "browser profile" stay (remediation round 1, Finding 1).

## Confirmed Issues

### 1. The OAuth verification document still names the screen "Profile", in the scope justifications and the demo video's shot list — MEDIUM
- **Location:** `docs/oauth-verification.md:61, 63, 93, 121, 134, 142, 190, 195, 217, 222, 225, 229`
- **Attribution:** introduced. The text was right at `511ab6b` (`git show 511ab6b:docs/oauth-verification.md | grep -c '"Profile"\|profile screen'` prints 12) and no commit on the branch touches the file (`git log --oneline 511ab6b..HEAD -- docs/oauth-verification.md` prints nothing); the branch's rename of the menu item and the screen made all twelve wrong.
- **Real-world trigger:** the next verification take or re-verification. The file's own first line says it is "What the product submits to Google for OAuth verification", and a re-verification reuses it. The operator follows shot 8 ("Click "Profile" in the account menu") and finds no such item; Google's reviewer reads "the user starts from the profile screen" in the `yt-analytics-monetary.readonly` justification while the demo video shows a screen headed "Settings". Docs drift, so capped at MEDIUM.

**Evidence**
```
134: ... It is a separate, optional consent the user starts from the profile screen, never requested at connect.
142: ... and an optional revenue consent (yt-analytics-monetary.readonly) that the user starts from the profile screen.
217: | 8 | `youtube.readonly`: the channel | Click "Profile" in the account menu. ...
222: | 13 | Revenue consent starts | Open "Profile" from the account menu and click "Give revenue consent" ...
```
The menu item is `settingsItem = settingsName` (`apps/web/src/account-menu.ts:9`), "Settings".

**Failure mode** — the written justification and the shot list name a menu item and a screen that do not exist in the app the video records, so the submission contradicts its own video.

**Recommended fix** — rename the screen in the twelve places, nothing else:
- `:61` "from the empty state or the profile screen" → "from the empty state or the Settings screen"
- `:63` "from the profile screen" → "from the Settings screen"
- `:93` "on the profile screen" → "on the Settings screen"
- `:121` "on the profile screen" → "on the Settings screen"
- `:134` and `:142` "starts from the profile screen" → "starts from the Settings screen"
- `:190` `Disconnect it from "Profile" first` → `Disconnect it from "Settings" first`
- `:195` `The currency on "Profile" is USD` → `The currency on "Settings" is USD`
- `:217` `Click "Profile" in the account menu` → `Click "Settings" in the account menu`
- `:222`, `:225` `Open "Profile" from the account menu` → `Open "Settings" from the account menu`
- `:229` `Open "Profile" and change` → `Open "Settings" and change`

**Remediation brief**
- **Design intent:** the document is the submission text and the recording script for Google's OAuth verification. It must name what the app shows on the day of the take. The app's screen and its menu item are "Settings" (`settings-name.ts`), at `/app/settings`.
- **Full surface:** the twelve lines above, all in `docs/oauth-verification.md`. Nothing in code reads this file.
- **Must preserve:** the sign-in scope `openid`, `email`, `profile` (`:67`, `:142`, `:213`), which is Google's scope name; "browser profile" (`:191`), which is Chrome's. No em-dash in the new text.
- **Do not touch:** shot 7 at `:216` ("Click the avatar at the top right"), which went stale with #531, not this branch; the #590 lane filed it as a proposal ("Point the OAuth verification shot list at the sidebar's Settings row"). ADR 0015's "the profile shows no supporter mark", kept as written by decision.
- **Proof:** `grep -nE '"Profile"|profile screen' docs/oauth-verification.md` prints the twelve lines now and nothing after; `grep -c 'profile' docs/oauth-verification.md` drops by exactly 12.

### 2. The account row's chevron draws in full ink, while the channel picker's chevron right above it is muted — LOW
- **Location:** `apps/web/src/AccountMenu.tsx:108`, `apps/web/src/app.css:2366-2372`
- **Attribution:** introduced by `8f884c5` (the chevron is new on this branch).
- **Real-world trigger:** every signed-in creator at 48rem and wider sees the two stacked footer rows end in chevrons of different ink. The spec asks the row to "look like the channel picker above it, so that the sidebar footer reads as one piece" (user story 3). Display only, no wrong data: LOW.

**Evidence**
```tsx
<ChevronsUpDownIcon className="account-chevron" aria-hidden="true" />        // AccountMenu.tsx:108
<ChevronDownIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />  // select.tsx:25
```
`.account-chevron` (`app.css:2366-2372`) sets no colour, and no `svg` rule in `app.css` reaches it, so the icon's `currentColor` is the row's full ink. `text-muted-foreground` is `--ink-soft` (`app.css:19`).

**Failure mode** — the row's chevron is drawn in `--ink` and the picker's in `--ink-soft`.

**Recommended fix**
```diff
   .account-chevron {
     flex-shrink: 0;
     width: 1rem;
     height: 1rem;
     margin-inline-start: auto;
+    color: var(--ink-soft);
   }
```
and in `apps/web/test/web.test.ts:803-808`, add `color: valueIn(own, chevron, 'color', tablet)` to the object and `color: 'var(--ink-soft)'` to its expectation. (When Finding 4 lands in the same pass, the `margin-inline-start` line and the `start` key go, as that brief says.)

**Remediation brief**
- **Design intent:** the account row copies the picker's look: the same two line sizes and inks through shared rule blocks, and a chevron at the end. The picker's chevron is shadcn's `select.tsx` icon in `text-muted-foreground`, which the theme maps to `--ink-soft`; rule 3 asks every new part to take its colour from the tokens.
- **Full surface:** `apps/web/src/app.css:2366-2372` (the `.account-chevron` rule, inside the `(min-width: 48rem) and (min-height: 28.5rem)` block), `apps/web/test/web.test.ts:795-808` (the chevron test).
- **Must preserve:** the chevron's 1rem size and `flex-shrink: 0`; the row's text inks ("Settings" in `--ink-soft`, the email in full ink, held by the "two lines match the picker's" test in `web.test.ts`); the rule-3 colour test in `web.test.ts`, which admits token colours only, so `var(--ink-soft)` passes it.
- **Do not touch:** `select.tsx`, whose chevron is right.
- **Proof:** `pnpm exec vitest run apps/web/test/web.test.ts -t "chevron"` red with the new expectation before the CSS change, green after.

### 3. Two account row tests assert exact class strings — LOW
- **Location:** `apps/web/src/app.test.ts:4664-4667` and `:4682`
- **Attribution:** introduced by `8f884c5`.
- **Real-world trigger:** none for a user. A rename of a CSS class, or a utility class added to the avatar span, turns these red with no behaviour change, and the collapsed check passes if the row's text sits straight in the button instead of in a child. CODING_STANDARDS.md standard 2 names "an exact class string" as a delete-on-sight assertion. LOW.

**Evidence**
```ts
expect([...lines].map((each) => [each.className, each.textContent])).toEqual([
  ['account-heading', settingsName],
  ['sidebar-email', email],
])
...
expect([...(buttons[0]?.children ?? [])].map((each) => each.className)).toEqual(['avatar'])
```

**Failure mode** — the assertions pin markup, not what the creator sees.

**Recommended fix**
```diff
-      expect([...lines].map((each) => [each.className, each.textContent])).toEqual([
-        ['account-heading', settingsName],
-        ['sidebar-email', email],
-      ])
+      expect([...lines].map((each) => each.textContent)).toEqual([settingsName, email])
```
```diff
-      expect([...(buttons[0]?.children ?? [])].map((each) => each.className)).toEqual(['avatar'])
+      expect(buttons[0]?.textContent).toBe(avatarLetterOf(email))
```
(`avatarLetterOf` from `@creator-analytics/visual-system/avatar`, as `AccountMenu.tsx:2` imports it.)

**Remediation brief**
- **Design intent:** the open row shows "Settings" and then the email; collapsed, it shows the avatar's letter alone. The tests observe the rendered text of the real component.
- **Full surface:** `apps/web/src/app.test.ts:4654-4683` (the "open" and "collapsed" tests in the account row describe).
- **Must preserve:** the name assertions at `:4660-4662` and `:4681`, the `.account-lines` lookup at `:4663` (it is how the test finds the two lines), the click and `aria-expanded` check at `:4670-4673`.
- **Do not touch:** `accountRowLabelOf(email)` in the name assertion; see Reviewed and Dismissed ("the row-name tests are self-fulfilling").
- **Proof:** `pnpm exec vitest run apps/web/src/app.test.ts -t "the button is the avatar alone"` and `-t "the row shows Settings"` green after; swapping the two spans in `AccountMenu.tsx` turns the open test red.

### 4. The chevron's `margin-inline-start: auto` does nothing, and the chevron test pins it — LOW
- **Location:** `apps/web/src/app.css:2371`, `apps/web/test/web.test.ts:808`
- **Attribution:** introduced by `8f884c5`.
- **Real-world trigger:** none for a user. `.account-lines` is `flex: 1` (`app.css:2408-2413`), so it takes all free space and the chevron's auto margin resolves to 0; the chevron ends the row because of the lines' growth. Deleting the declaration changes nothing on screen and turns the test red, which is a test of a declaration, not a rule (standard 2). LOW.

**Evidence**
```css
.picker-lines,
.account-lines {
  display: grid;
  flex: 1;
  min-width: 0;
}
```
```ts
}).toEqual({ width: '1rem', height: '1rem', shrink: '0', start: 'auto' })
```

**Failure mode** — a dead declaration held alive by a test.

**Recommended fix** — delete `margin-inline-start: auto;` from `.account-chevron`, and delete the `start:` entry from the object and from its expectation at `web.test.ts:807-808`.

**Remediation brief**
- **Design intent:** the row is a flex line: avatar (`flex-shrink: 0`), lines (`flex: 1; min-width: 0`), chevron (`flex-shrink: 0`). The lines' growth puts the chevron at the end.
- **Full surface:** `apps/web/src/app.css:2371`, `apps/web/test/web.test.ts:807-808`.
- **Must preserve:** the chevron's `flex-shrink: 0`, width and height, and their assertions; the browser walk's account row step, which presses the chevron at its rendered place (`apps/site/test/screenshot/browser-walk.ts`, the step after `:920`).
- **Do not touch:** `.account-lines { flex: 1 }`, which does the work.
- **Proof:** `pnpm exec vitest run apps/web/test/web.test.ts -t "chevron"` green after; `pnpm test:browser` green (the press on the chevron still lands inside the row).

### 5. The icon test's "hidden from a screen reader" count cannot go red from the app's code — LOW
- **Location:** `apps/web/src/app.test.ts:3721-3733`
- **Attribution:** introduced by `8f884c5`.
- **Real-world trigger:** none for a user. lucide-react adds `aria-hidden="true"` itself to any icon given no a11y prop (`node_modules/lucide-react/dist/esm/shared/src/build/buildLucideIconNode.mjs:47-49`), so removing `aria-hidden="true"` from `AccountMenu.tsx:133, 153, 163, 175` leaves the test green. The half that can fail is "one svg per item". LOW.

**Evidence**
```ts
...params.hasA11yProp === false ? { [getAttributeName("aria-hidden")]: "true" } : {},
```
```ts
each.querySelectorAll('svg[aria-hidden="true"]').length,
```

**Failure mode** — the test name claims the app hides the icons; the library does it, and the app's own attribute is unobserved.

**Recommended fix** — rename the test to "every item carries one icon, and keeps its name", and drop the `svg[aria-hidden="true"]` count and the third `1` in each expected row:
```diff
-  test('every item carries an icon hidden from a screen reader, and keeps its name', async () => {
+  test('every item carries one icon, and keeps its name', async () => {
@@
         accessibleNameOf(each, true),
         each.querySelectorAll('svg').length,
-        each.querySelectorAll('svg[aria-hidden="true"]').length,
       ]),
-    ).toEqual(itemNames.map((name) => [name, 1, 1]))
+    ).toEqual(itemNames.map((name) => [name, 1]))
```

**Remediation brief**
- **Design intent:** each menu item leads with one icon and keeps its name; the name test (`accessibleNameOf`) already proves the icon adds nothing to the name, which is the user-facing half of "hidden".
- **Full surface:** `apps/web/src/app.test.ts:3721-3733`.
- **Must preserve:** the `accessibleNameOf(each, true)` pairing, which proves no icon leaks into an item's name.
- **Do not touch:** the explicit `aria-hidden="true"` props in `AccountMenu.tsx`; they are harmless and state intent.
- **Proof:** `pnpm exec vitest run apps/web/src/app.test.ts -t "every item carries one icon"` green; deleting one icon from `AccountMenu.tsx` turns it red.

### 6. The privacy policy test asserts that the word before "Settings" is always "in", which is phrasing, not a rule — LOW
- **Location:** `apps/site/test/site.test.ts:1251`
- **Attribution:** introduced by `5442bb7`.
- **Real-world trigger:** none for a user. A future approved clause such as "open Settings" names the screen correctly and fails the test. Standard 2: a test that restates copy fails on an edit, never on a break. LOW.

**Evidence**
```ts
const named = [...text.matchAll(new RegExp(`(\\S+) ${settingsName}\\b`, 'g'))]

expect(named.length).toBeGreaterThan(0)
expect(named.map(([, before]) => before)).toEqual(named.map(() => 'in'))
expect(text.match(/\bprofile\b(?! picture)/gi) ?? []).toEqual([])
```

**Failure mode** — the middle assertion holds the policy's wording, not its agreement with the app.

**Recommended fix**
```diff
-    const named = [...text.matchAll(new RegExp(`(\\S+) ${settingsName}\\b`, 'g'))]
-
-    expect(named.length).toBeGreaterThan(0)
-    expect(named.map(([, before]) => before)).toEqual(named.map(() => 'in'))
+    expect(text.match(new RegExp(`\\b${settingsName}\\b`, 'g'))?.length ?? 0).toBeGreaterThan(0)
     expect(text.match(/\bprofile\b(?! picture)/gi) ?? []).toEqual([])
```

**Remediation brief**
- **Design intent:** the rule is sourced outside the copy: the policy names the screen by the web app's own `settingsName`, and says "profile" only of a profile picture. Both parts stay.
- **Full surface:** `apps/site/test/site.test.ts:1241-1253` (the test and its comment, whose wording needs no change).
- **Must preserve:** the import of `settingsName` from `../../web/src/settings-name.ts` (`site.test.ts:57`), and the profile-picture assertion.
- **Do not touch:** `apps/site/privacy.html`.
- **Proof:** `pnpm exec vitest run apps/site/test/site.test.ts -t "names the web app's settings screen"` green after; changing `settingsName` to `'Preferences'` in a scratch copy turns it red.

### 7. The browser walk's line probe computes an `ellipsis` field that nothing reads, and it is always true — LOW
- **Location:** `apps/site/test/screenshot/browser-walk.ts:842` and `:846`
- **Attribution:** introduced by `8f884c5` (lane review pass 3 found it as F3.9; it stayed).
- **Real-world trigger:** a red walk. Every line the probe measures sits under `text-overflow: ellipsis` (`app.css:2415-2422`), so each failure JSON reads `"ellipsis": true` even where nothing is cut, and misleads whoever reads it. The checks use only `oneLine` and `whole`. Standard 3, a dead field on the touched path. LOW.

**Evidence**
```ts
          ellipsis: getComputedStyle(span).textOverflow === 'ellipsis',
...
  type Line = { text: string; oneLine: boolean; whole: boolean; ellipsis: boolean }
```
`grep -n 'ellipsis' apps/site/test/screenshot/browser-walk.ts` shows no reader of the field.

**Failure mode** — an error message that always reports an ellipsis.

**Recommended fix** — delete the `ellipsis:` property at `:842` and `ellipsis: boolean` from `Line` at `:846`.

**Remediation brief**
- **Design intent:** the probe reports, for each line, whether it sits on one line (`oneLine`) and whether its box holds all its text (`whole`); a line cut by an ellipsis is one that is not `whole`.
- **Full surface:** `apps/site/test/screenshot/browser-walk.ts:842, 846`.
- **Must preserve:** the `oneLine` and `whole` fields and the three filters that read them (around `:867`, `:892`, `:931`); the doc comment at `:830` ("so no ellipsis cuts it"), which describes `whole`.
- **Do not touch:** the other `ellipsis` hits at `:2497-2539`, which belong to the video title check.
- **Proof:** `pnpm typecheck` and `pnpm lint` green; `pnpm test:browser` green.

### 8. Comment hygiene — LOW (aggregated)
- `apps/web/src/AccountMenu.tsx:124` — "The menu closes on the click and gives focus back to the avatar." → "The menu closes on the click and gives focus back to the button that opened it."
- `apps/web/src/AccountMenu.tsx:127` — "so focus stays on the avatar." → "so focus stays on that button."
- `apps/web/src/AccountMenu.tsx:150` — "the menu closes behind it, with focus on the avatar." → "the menu closes behind it, with focus on its button."
- `apps/web/src/AccountMenu.tsx:160-161` — "Signed out, the header goes; ... with focus on the avatar." → "Signed out, the page's header goes; ... with focus on the menu's button." (the menu now has a header of its own, and in the sidebar the button is the row)
- `apps/web/src/components/ui/dropdown-menu.tsx:14-15` — "a 1px rule in the border token across the popup's width, with none of shadcn's margin or colour." → "a 1px rule in the border token across the popup's content, without shadcn's margin." (`bg-border` is shadcn's own colour class, and with no negative margin the rule spans the content box, not the popup)
- `apps/web/src/account-menu.ts:7` — "creator-analytics#571; they replace "Account menu" from creator-analytics#66 and #531. Sign out is" → "creator-analytics#571. Sign out is" (narrates the change, standard 1)
- `apps/web/src/app.test.ts:5786` — "// creator-analytics#589: the profile became Settings. Stripe's Payment Link still returns to" → "// creator-analytics#589: Stripe's Payment Link still returns to" (narration; the Stripe sentence carries the weight)

## Needs Further Investigation

### A. While the session is read with the sidebar collapsed, the account row's placeholder may overflow the 3rem column — confirm whether the collapsed state is known before the session answers
`.sidebar-account-place` (`app.css:2387-2402`) keeps its 0.5rem padding, 0.75rem gap and line placeholder under `.sidebar[data-collapsible="icon"]`, where the real row is the 2.5rem avatar with `padding: 0` (`app.css:2355-2357`). This branch made the place 0.1rem taller (`calc((0.75rem + 0.875rem) * 1.6)` for the line), so it is pre-existing, exposed slightly. It matters only if the sidebar can render collapsed while `email === null` (`Sidebar.tsx:162-170`). Confirm: reload `/app` with the sidebar collapsed and a slowed `/api/me` in the browser, and watch the footer. If it overflows, the fix is `.sidebar[data-collapsible="icon"] .sidebar-account-place { padding: 0 }` and hiding its `.placeholder-line` there.

## Reviewed and Dismissed
- **The row-name tests are self-fulfilling** (`account-menu.test.ts:49`, `app.test.ts:4660-4665`) — the expectations read `settingsName` and `accountRowLabelOf`, but together they hold the rule: the unit test pins the "name, comma, email" shape, and the app test pins that the rendered name and the rendered top line both come from the one approved word. A literal "Settings, nick@example.com" would be a copy test, which standard 2 forbids. Keep both.
- **`settings.test.ts:20` restates `settingsOpenedEvent`** — it holds "with no other value", that the event carries no payload, which `app.test.ts:5828-5840` does not check (it filters by name). A privacy-relevant rule, carried over from the base's profile test.
- **`app.test.ts:5838` `not.toContain('profile_opened')` cannot fail by types** — the epic's testing decision names "profile_opened never fires" as a rule; a cheap guard against an untyped emitter. Keep.
- **README.md:104 "that release's note must record it"** — #589's body asks the README to say exactly this. The release-note task itself is the #589 lane's proposal.
- **The walk's direct `/app/settings` visit asserts nothing** (`browser-walk.ts:503`) — the route visits at `:501-503` are the content security policy pass for every path `routeOf` knows, and none of them asserts its screen; the Settings screen's heading is asserted in the support step at `:551-555`.
- **`route.test.ts:543-547` is relational with nothing pinned** — the exact-path table at `:551-552` pins both `'settings'` and `'profile'` to `{ ...defaultRoute, settings: true }`, and `:531` pins a query.
- **The menu header's email is muted and the row's is full ink** — two different surfaces; the row's ink is a recorded decision, the header's is `DropdownMenuLabel`'s existing style.
- **`walk-report.ts:16` and `walk-report.test.ts:48, 65` use `route: /app/profile`** — the walk still emits `route: /app/profile?support=thanks` (`browser-walk.ts:468`, from the visit at `:550`), so the example names a real step shape.
- **"Stripe's Payment Link still returns to /app/profile"** — the epic states it, and Out of Scope keeps it.
- **CONTEXT.md:47 `_Avoid_: User settings`** — it governs the term for a preference, not the screen's name; the spec asks CONTEXT.md to change only where it names the profile screen, and it does not.
- **Lines past the block's wrap** (`web.test.ts` near `:316`, `components.test.ts:4`, `account-menu.ts:5`) — biome passes them; not a defect.

## Minor / nits
- `settingsItem` (`account-menu.ts:9`) and `settingsHeading` (`settings.ts:9`) are aliases of `settingsName`, so one approved word reaches the UI under three names, and `AccountMenu.tsx` reads both `settingsName` and `settingsItem`. Reading `settingsName` everywhere would drop two names and two approval sentences (lane F3.28).
- `app.test.ts:4668` repeats `aria-haspopup="menu"` on the same button `:3656` already checks.
- `route.test.ts:543`'s `''` row repeats the `'profile'` row of the exact-path table at `:552`.
- `app.test.ts:3698` builds `#${id}` without `CSS.escape`; it works with React 19's ids, and a miss fails loudly.
- `browser-walk.ts` near `:928` interpolates `${expected}` unquoted in its error, as the picker step near `:865` already did; `JSON.stringify(expected)` reads better.
- The `web.test.ts:760-775` picker-equality assertions compare two declarations that share one rule block, so deleting a declaration from both passes; `min-width` is pinned, the others are not.
- No browser step renders an email too long for the open row since the sample became `fen@example.com`; the long-email layout is held by `de2fd6a`'s declaration test alone (lane F3.3, deferred to Nick's browser walk).
- Absence tests that pass on the wrong screen: `app.test.ts:5865` ("is absent when the support answer has no link"), the "does not show" row at `:5903`, and `route.test.ts:861-867` each pass if `'settings'` fell back to the list. The same shape stood at base under `'profile'`; pre-existing, untouched. A first `expect(headingText(container)).toBe('Settings')` would close it.
- The committed homepage screenshot `apps/site/public/app-screenshot.webp` still shows the old row and email until it is retaken with `pnpm --filter @creator-analytics/site screenshot` (lane decision).

## Test quality
Tests added or changed: about 110 across 15 files. Green against `511ab6b` on the branch's own code: 18, each legitimately (name-only changes such as `connect.test.ts`'s connect test, fixture renames such as `analytics.test.ts:56, 96`, and negative boundary rows such as `route.test.ts:550`'s `'settings/'`, `'settings/x'`, `'Settings'`, `'videos/settings'`); none is a review-fix proof. Both review-fix proofs are red at base: `bb61dc0`'s separator-margin test (`web.test.ts:349`), which a mutation adding `-mx-1 my-1` turns red again, and `de2fd6a`'s long-email assertion in the two-lines test. `web.test.ts:319`'s `'dropdown-menu.tsx'` row is green at base and still bites: a mutation to `[&_svg]:text-red-500` turns it red. Tautology shapes found: 3 confirmed (Findings 3, 4, 5) plus the copy-phrasing assertion (Finding 6); the identity candidates are dismissed above. The audit's raw output is in the session scratchpad and was not kept.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and the suite green at `6aaa375`; the one red was a load timeout in an untouched file, green on the re-run. The browser walk is green.
- **Commit hygiene:** clean tree. This doc is the only addition.
- **Likely reviewer asks:** the OpenPanel rename's note in the next release (the #589 lane's proposal); the Stripe Payment Link's return address (out of scope by the spec); a retake of the homepage screenshot; the `docs/oauth-verification.md` shot 7 avatar step (the #590 lane's proposal).

## Verdict
Ready to open the PR once Finding 1 is fixed: the OAuth verification document must name the Settings screen before the next verification take. Findings 2 to 8 are LOW and can ride along in the same pass or follow; Needs Further Investigation A is pre-existing and needs one browser check. No prior review findings to close: this is round 1.

## Remediation — 2026-11-12
Scope: CRITICAL, HIGH and MEDIUM, the default. One MEDIUM in scope (Finding 1); Findings 2 to 8 are LOW and deferred to Nick, unworked. No Remediation scope note, no Escalation note.

| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 1 (MEDIUM) | `9229f29` creator-analytics#571 pre-PR review 1 finding 1: the OAuth verification document still names the screen "Profile", in the scope justifications and the demo shot list | red→green: `grep -nE '"Profile"\|profile screen' docs/oauth-verification.md` printed the twelve lines (61, 63, 93, 121, 134, 142, 190, 195, 217, 222, 225, 229) before and nothing after; `grep -o 'profile' docs/oauth-verification.md \| wc -l` 13 → 7 and `"Profile"` 6 → 0, so exactly 12 occurrences changed. The brief's `grep -c 'profile'` counts lines, case-sensitively: it reads 12 → 7, not a drop of 12, because `:142` holds both the scope name and "profile screen" and the six `"Profile"` hits are capitalised. The seven survivors are the scope name (`:49`, `:67`, `:69`, `:142`, `:212`, `:213`) and "browser profile" (`:191`), all Must preserve. No em-dash added. `pnpm typecheck` and `pnpm lint` green | 0 (Markdown only) | proved by execution; a docs-only MEDIUM touching no shared core, so no verify agent |
| 2 (LOW) | — deferred | — | — | LOW tail, not worked by default |
| 3 (LOW) | — deferred | — | — | LOW tail, not worked by default |
| 4 (LOW) | — deferred | — | — | LOW tail, not worked by default |
| 5 (LOW) | — deferred | — | — | LOW tail, not worked by default |
| 6 (LOW) | — deferred | — | — | LOW tail, not worked by default |
| 7 (LOW) | — deferred | — | — | LOW tail, not worked by default |
| 8 (LOW, comment hygiene) | — deferred | — | — | LOW tail, not worked by default |

Needs Further Investigation A was not worked: it is not a Confirmed finding, and it needs a browser check.

### Known regressions, deferred
- None. The round introduced no open item.

### Rework briefs
- None. No verify pass ran, so no rework.
