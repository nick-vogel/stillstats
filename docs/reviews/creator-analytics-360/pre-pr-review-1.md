# Pre-PR review: creator-analytics#360 Light migration to shadcn and Tailwind

**Branch:** `creator-analytics-360-shadcn-tailwind-migration` vs `origin/main` (merge-base `efdfc48` "creator-analytics#358 ADR 0014: the charts move to TanStack Charts, with the inline style patch and a browser policy test")
**Reviewed at:** HEAD `b74e6e0` ("creator-analytics#366 The toast becomes shadcn Toast on Base UI"). The tree was clean, with no uncommitted or untracked files at review time. 41 files, +4,864 / −864 against the merge-base. The branch carries all seven children: #361 (`c0bc7a1`, `aaa057a`, `89f4117`), #362 (`9243844`, `ad62b67`), #367 (`9550616`, `b95aba0`), #363 (`4568a4b`, `5cb3b9d`), #364 (`a363326`, `acd188a`), #365 (`5e8602b`, `febc513`, `feaf2d9`, `a31fa89`) and #366 (`dfa9232`, `e127bd6`, `b74e6e0`).
**Reviewed against:** the epic body of creator-analytics#360 (End state, Implementation Decisions and Testing Decisions are the spec), the bodies of #361 to #367, `CODING_STANDARDS.md` 1 to 3, ADR 0014, the assumptions the loop recorded for each ticket. No prior review doc for this epic. A full review (`--fresh`).
**Date:** 2026-11-02
**Reviewer:** 3 code-review agents, 1 test-oracle agent, and a verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | up to date |
| Lint | `pnpm lint` | pass |
| Typecheck | `pnpm typecheck` | pass |
| Build | `pnpm build` | pass |
| Full suite | `pnpm test` (Docker up, Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | first run: 1 failed, a 5 s timeout in `apps/api/src/video-list.test.ts:1500`, a file this branch does not touch (last changed in `ef89df1`, #178), while a second suite ran in a scratch worktree. Re-run after 60 s: 117 files, 2,629 passed, 1 expected fail. A flake (creator-analytics#310). |
| Browser walk | `pnpm run --if-present test:browser` | pass: 8 steps, no content security policy violation. JS 618.5 kB / 199.4 kB gzip, CSS 28.0 kB / 6.8 kB gzip (at #361, before Tailwind: JS 131.1 kB gzip, CSS 5.6 kB gzip) |
| Runtime dependencies | `git diff efdfc48 -- apps/web/package.json`, the lock's `apps/web` importer | exactly the five Nick approved (`@base-ui/react`, `class-variance-authority`, `clsx`, `lucide-react`, `tailwind-merge`). Tailwind, `@tailwindcss/vite` and `shadcn@4.23.0` are devDependencies. No `tw-animate-css` in the lock. |
| Tailwind import shape | `apps/web/src/app.css:5-8`, the built CSS | theme and utilities only, layer order declared, no Preflight import; `preflightRulesIn` on the built CSS is `[]` |
| Theme names | every `var()` in the `@theme inline` block against `packages/visual-system/src/styles.css` | all six colour tokens are declared in light and dark; no colour literal in the theme |
| Utilities that emit nothing | every class token in `className`, `cn()` and `cva()` strings under `apps/web/src` looked up in the built CSS (agent) | every Tailwind token has a rule |
| Deleted app.css rules | `git grep` for each removed class (`account-menu*`, `list-select*`, `toast*`, `custom-range*`, `segmented-control*`) | no remaining reference outside `data-slot` values |
| `CSPProvider` | `apps/web/src/main.tsx:46-48`, `renderApp` | wraps the root in both |
| Base UI prop semantics | read in `apps/web/node_modules/@base-ui/react` 1.9.0: Toast store `closeToast`/`addToast`, Menu focus return, Radio `onChange`, Button `type`, Field control `onChange` | `onClose` runs synchronously inside `closeToast`, so `Toast.tsx`'s app-close guard works; re-adding an ending toast of the same id replaces it; focus returns to the avatar only when focus was in the popup or on the body; Format fires only on a real change; Apply's `type="submit"` wins over Base UI's `type="button"` |
| Product events | the five event names traced through the moved controls; the app tests' `track` assertions | same names and properties, none new; the Audience screen fires none from the controls bar |
| Copy | labels, notices and the error text in the diff against base | unchanged. One string ships that the app does not own: Base UI's landmark name "Notifications" (Needs Further Investigation A). |
| Walk detection | executed by an agent against Chrome 156 with the walk's own CDP setup and a meta `style-src 'self'` page | `setAttribute('style')` and an injected `<style>` both fail on the listener and on the `security` log. A style written through CSSOM raises nothing, which is what the policy allows (Dismissed). |
| Rule 3 and stillness plants | `sh docs/reviews/creator-analytics-360/repro/plant-css-gaps.sh <scratch-dir>`, four class strings planted one at a time in a scratch worktree at `b74e6e0`, `web.test.ts` and `built-css.test.ts` run each time | `bg-[#f00]` fails rule 3 (the harness sees plants). `[--accent:oklch(0.97_0_0)]`, `animate-[spin_1s_linear_infinite]` and `rounded-[.625rem]!` pass every test: findings 1, 2 and 3. A `:root{--accent:oklch(0.97 0 0)}` appended to `app.css` is caught by the own-sheet colour test, so that path is covered. |
| Tests green at `$BASE` | scratch worktree at `efdfc48`, the branch's changed test files and new test-only modules copied in, run there (agent) | 105 in-scope cases: 50 red, 55 green. 26 of the green test new test-only modules (base cannot be an oracle). The other green ones guard behaviour the migration had to keep, found now by role: legitimate. Two are not: findings 5 and 6. |
| Screen reader announcements, real hover and touch | not run | the nested live region (Needs Further Investigation A) needs VoiceOver |

**Overall:** Every End state item is implemented, the four CI checks and the browser walk pass, the dependencies are exactly the approved five, and no control lost a behaviour, a label or an event that the review could find. Nothing is HIGH or MEDIUM. The confirmed findings are gaps in the guards this epic added or relied on: the rule 3 test lets a utility redeclare a token, the stillness test no longer reads all the CSS the app serves, the shadcn radius check misses an important utility, and the walk does not check which screen a route step reached. Two tests break the repo's test rule. The branch can open its PR; the six LOW findings are cheap and test-only, so they are best fixed in this branch first.

## Approach decisions
- Rule 3 token exemption: the visual system's own token declarations stay exempt (its light page ends in `oklch(1 0 0)`, shadcn's light background). What closes finding 1 is a separate check that no declaration inside Tailwind's `theme` or `utilities` layer sets a visual-system token, mirroring how `preflightRulesIn` reads a layer by `blockAt` (`apps/web/test/built-css.ts`).
- The stillness rule (#71): its existing test stays unchanged, as the epic requires. A new test reads the served CSS (`servedCss`, as the rule 3 test does) for `animation` and `@keyframes`.
- Walk route steps: a route step proves it reached its screen through the screen's heading text, as the walk's other steps prove their open state through role and name, never by class.

## Confirmed Issues
### 1. The rule 3 test exempts every declaration of a token's name, so a utility that redeclares a token with shadcn's default value ships unseen — LOW
- **Location:** `apps/web/test/built-css.ts:31-36` (`outsideTokens`), used by `coloursOutsideTokens` (`:44-51`) and `shadcnDefaultsIn` (`:82-98`); the test at `apps/web/test/web.test.ts:188-198`
- **Attribution:** introduced in `9243844` (#362 Tailwind and shadcn foundation on the visual system's tokens), which added `built-css.ts`
- **Real-world trigger:** an arbitrary-property utility in a component, `[--accent:oklch(0.97_0_0)]`, or a later `shadcn add` of a registry item whose CSS sets a variable the visual system also names. `--accent` is the one name shadcn's theme and the visual system share. No such class exists today. LOW, capped: upgrade to MEDIUM if any component sets a token through an arbitrary property, check via `git grep -nE '\[--(bg|ink|ink-soft|line|accent|on-accent)[:\]]' apps/web/src`.

**Evidence**
```ts
function outsideTokens(css: string, tokens: readonly string[]): Declaration[] {
  const declaredByTheVisualSystem = new Set(tokens)
  return declarationsWrittenIn(css).filter(
    ({ property }) => !declaredByTheVisualSystem.has(property),
  )
}
```
**Failure mode** — the filter goes by property name only. Planted `[--accent:oklch(0.97_0_0)]` (shadcn's light `--accent`): Tailwind emits `.\[--accent\:oklch\(0\.97_0_0\)\]{--accent:oklch(.97 0 0)}` in the utilities layer, both `coloursOutsideTokens` and `shadcnDefaultsIn` skip it, and `web.test.ts` and `built-css.test.ts` pass (repro: `token-utility: vitest exit 0`). Any element under that class repaints the accent with shadcn's grey, the default look ADR 0014 rule 3 exists to keep out. The own-sheet colour test does not see it, because it reads `app.css` source only.
**Recommended fix** — add a check that no declaration in Tailwind's layers sets a token, and assert it in the rule 3 test:
```diff
+export function tokensSetInTailwindLayersOf(css: string, tokens: readonly string[]): Declaration[] {
+  const declaredByTheVisualSystem = new Set(tokens)
+  const uncommented = css.replace(/\/\*[\s\S]*?\*\//g, '')
+  return [...uncommented.matchAll(/@layer\s+(?:theme|utilities)\s*\{/g)]
+    .flatMap((opening) =>
+      declarationsWrittenIn(blockAt(uncommented, (opening.index ?? 0) + opening[0].length - 1)),
+    )
+    .filter(({ property }) => declaredByTheVisualSystem.has(property))
+}
```
```diff
     expect(coloursOutsideTokens(css, tokens)).toEqual([])
     expect(shadcnDefaultsIn(css, tokens, shadcnDefaultTheme)).toEqual([])
+    expect(tokensSetInTailwindLayersOf(css, tokens)).toEqual([])
```
`blockAt` is declared below `shadcnDefaultsIn`; a `function` declaration hoists, so the order in the file does not matter. Rename the test to say the third rule if its title no longer covers it.
**Remediation brief**
- **Design intent:** rule 3 (ADR 0014) says the built CSS writes no colour outside the visual system's tokens and none of shadcn's defaults. The tokens' own declarations, light and dark, are the one place a colour may be written, and they live in the visual system's unlayered sheet. Tailwind's output is always inside `@layer theme` or `@layer utilities`, and `app.css` is unlayered and already held by the own-sheet colour test. So a token set inside Tailwind's layers is never the visual system's own declaration.
- **Full surface:** `apps/web/test/built-css.ts` (new export beside `preflightRulesIn`, reusing `blockAt` at `:101-109` and `declarationsWrittenIn` at `:21-25`); `apps/web/test/web.test.ts:188-198` (the rule 3 test, its import list at the top of the file); `apps/web/test/built-css.test.ts` (unit tests for the new export: a token set in `@layer utilities{}` is reported, the same declaration unlayered is not, a non-token custom property in the layer is not).
- **Must preserve:** `coloursOutsideTokens` and `shadcnDefaultsIn` unchanged, including the exemption that keeps `--bg-end: oklch(1 0 0)` from failing; all 13 tests in `built-css.test.ts`; the rule 3 test green on today's build (today's theme layer sets `--spacing`, `--text-base` and font weights, none of them a token; confirm by running it).
- **Do not touch:** the `transparent` and `currentcolor` exceptions in the shared colour reader (Dismissed); the OKLab tolerance (Dismissed).
- **Proof:** `sh docs/reviews/creator-analytics-360/repro/plant-css-gaps.sh <scratch-dir>` prints `token-utility: vitest exit 0` now and must print `exit 1` after; `pnpm exec vitest run apps/web/test/built-css.test.ts apps/web/test/web.test.ts` green.

### 2. The stillness rule's test reads only the two source sheets, so an animation Tailwind emits ships unseen — LOW
- **Location:** `apps/web/test/web.test.ts:242-262` ("nothing in the web app's stylesheets animates, and no placeholder rule has a transition (creator-analytics#71)")
- **Attribution:** introduced. The test is unchanged from `efdfc48` (`git show efdfc48:apps/web/test/web.test.ts | grep -n "nothing in the web app's stylesheets animates"`), and the branch adds a third source of served CSS, Tailwind's utilities, in `9243844` (#362), which the test does not read. The epic says "The existing rule against `animation` and `@keyframes` stays".
- **Real-world trigger:** an arbitrary animation class, `animate-[spin_1s_linear_infinite]`, in a component a later epic copies or writes. shadcn's own `animate-*` names emit nothing here, because `--animate-*` is reset and `tw-animate-css` is not installed, so only an arbitrary value or a new import reaches the build. LOW, capped: upgrade to MEDIUM if any `animate-[` appears, check via `git grep -n 'animate-\[' apps/web/src`.

**Evidence**
```ts
const own = await webOwnSheet()
const sheets = [own, await visualSystemSheet()]
for (const css of sheets) {
  ...
  expect(css).not.toMatch(/@(?:-\w+-)?keyframes\b/)
}
```
**Failure mode** — planted `animate-[spin_1s_linear_infinite]`: the build emits `.animate-\[spin_1s_linear_infinite\]{animation:1s linear infinite spin}` and an `@keyframes spin`, and every test in `web.test.ts` and `built-css.test.ts` passes (repro: `animation-utility: vitest exit 0`). A spinning element would ship into an app whose stillness is a product rule (#71).
**Recommended fix** — a new test beside the #71 test, on the served CSS:
```diff
+  test('the stylesheet the web app serves animates nothing (creator-analytics#71)', async ({ web }) => {
+    const { origin } = await startApi(web, { webRoot })
+    const css = await servedCss(origin)
+
+    const properties = declarationsIn(css).map(({ property }) => property)
+    expect(properties.length).toBeGreaterThan(0)
+    expect(properties.filter((property) => property.startsWith('animation'))).toEqual([])
+    expect(css).not.toMatch(/@(?:-\w+-)?keyframes\b/)
+  })
```
**Remediation brief**
- **Design intent:** the app never animates (#71); hover transitions are allowed, and only a placeholder must not transition. The served CSS is the visual system's sheet, `app.css` and Tailwind's emitted layers bundled into one file, so a check on it covers every source at once. `servedCss` and `startApi` are what the rule 3 test uses to read it.
- **Full surface:** `apps/web/test/web.test.ts`, a new test next to `:242-262`. If `declarationsIn` (from `@creator-analytics/visual-system/testing`) throws on Tailwind's output, use `declarationsWrittenIn`'s approach from `apps/web/test/built-css.ts` through a new export instead.
- **Must preserve:** the #71 test at `:242-262` exactly as it is (the epic requires the existing tests unchanged), including its placeholder transition half; the visual system's transitions, which the served CSS legitimately holds.
- **Do not touch:** `transition` utilities in general, which the rule allows.
- **Proof:** `sh docs/reviews/creator-analytics-360/repro/plant-css-gaps.sh <scratch-dir>` prints `animation-utility: vitest exit 0` now and must print `exit 1` after; `pnpm exec vitest run apps/web/test/web.test.ts` green.

### 3. The shadcn radius check misses an important utility, which this codebase uses on purpose — LOW
- **Location:** `apps/web/test/built-css.ts:62-73` (`isSameValue`)
- **Attribution:** introduced in `9243844` (#362)
- **Real-world trigger:** a restyle that copies shadcn's radius as `rounded-[.625rem]!`, the `!` form the epic's restyles use to beat the unlayered `:focus-visible` rule (`rounded-field!`, `rounded-full!`). None exists today. LOW, capped: upgrade if `git grep -n '\.625rem\|10px' apps/web/src/components` finds one.

**Evidence**
```ts
const length = /^(-?\d*\.?\d+)([a-z%]*)$/i
function isSameValue(written: string, expected: string): boolean {
  const [, number = '', unit = ''] = length.exec(written) ?? []
```
**Failure mode** — `border-radius:.625rem!important` does not match the anchored pattern, so `isSameValue` falls back to a string compare and misses shadcn's `--radius` (repro: `radius-important: vitest exit 0`).
**Recommended fix**
```diff
 function isSameValue(written: string, expected: string): boolean {
-  const [, number = '', unit = ''] = length.exec(written) ?? []
+  const value = written.replace(/\s*!important$/i, '')
+  const [, number = '', unit = ''] = length.exec(value) ?? []
   const [, expectedNumber = '', expectedUnit = ''] = length.exec(expected) ?? []
   if (number && expectedNumber) {
     return Number(number) === Number(expectedNumber) && unit.toLowerCase() === expectedUnit
   }
-  return written.replace(/\s+/g, ' ') === expected
+  return value.replace(/\s+/g, ' ') === expected
 }
```
**Remediation brief**
- **Design intent:** a non-colour shadcn default is matched as a declaration's whole value, by number and unit, so `53.625rem` never reads as `.625rem`. The importance flag is not part of the value.
- **Full surface:** `apps/web/test/built-css.ts:62-73`; a case in `apps/web/test/built-css.test.ts` (an important `.625rem` radius is reported).
- **Must preserve:** the whole-value rule (`53.625rem` and `1.625rem` are not shadcn's radius, existing test in `built-css.test.ts`); the minifier's `.625rem` form matching `0.625rem`.
- **Do not touch:** px-to-rem equivalence, which no restyle writes; not required.
- **Proof:** the repro prints `radius-important: vitest exit 0` now and `exit 1` after; `pnpm exec vitest run apps/web/test/built-css.test.ts` green.

### 4. A route step of the browser walk never checks which screen it reached, so a broken route passes as the list — LOW
- **Location:** `apps/site/test/screenshot/browser-walk.ts:319-324` (`visit`), `:340-343` (the four visits); `ready` at `:266` and `screenLanded` in `apps/site/test/screenshot/screen-ready.ts`
- **Attribution:** introduced in `c0bc7a1` (#361 Browser walk)
- **Real-world trigger:** a renamed path or a broken `base` sends `/app/audience` or `/app/profile` to the list, because `routeOf` (`apps/web/src/route.ts:184-190`) maps any path it does not know to the list. The step's `ready()` only asks for a header, an `h1` and nothing busy, which the list has, so the walk says "No content security policy violation in 8 steps" without rendering that screen. No user path: this is a guard gap. LOW.

**Evidence**
```ts
async function visit(path: string): Promise<void> {
  await walk(`route: ${path}`, async () => {
    await send('Page.navigate', { url: `${stub.origin}${path}` })
    await ready()
  })
}
```
**Failure mode** — #361's criterion is that a step that cannot reach its state fails the walk. A route step that lands on the wrong screen reaches a state, just not its own, and passes.
**Recommended fix** — give `visit` the heading text of the screen it should land on, and wait for it after `ready()`:
```diff
-  async function visit(path: string): Promise<void> {
+  async function visit(path: string, heading: string): Promise<void> {
     await walk(`route: ${path}`, async () => {
       await send('Page.navigate', { url: `${stub.origin}${path}` })
       await ready()
+      await waitFor(
+        `document.querySelector('main h1')?.textContent.trim() === ${JSON.stringify(heading)}`,
+        `The screen at ${path} is not the one its heading names`,
+      )
     })
   }
```
with `newestVideo.title` for the video, the Audience screen's heading (`audienceHeading`, rendered at `apps/web/src/Audience.tsx:76`), the profile's heading (`apps/web/src/Profile.tsx:79`) and the channel's title for the list (the visually hidden `h1` at `apps/web/src/App.tsx:526`, the sample channel's title).
**Remediation brief**
- **Design intent:** the walk proves each step reached its state by what a person or the accessibility tree would see, never by class, and fails a step that cannot. A screen's `h1` names it, and it is how the app tests tell screens apart.
- **Full surface:** `apps/site/test/screenshot/browser-walk.ts:319-324` and the four calls at `:340-343`. The heading strings come from the web app's copy modules if the site's test tsconfig can import them (the walk already imports the stub and the sample channel); otherwise write them as literals, which observe which screen rendered and are not copy tests (CODING_STANDARDS.md 2).
- **Must preserve:** the walk's verdict and report shape (`walk-report.ts` and its tests); the list visited last so the open states start on it; `ready()` before the heading wait, so fonts and busy regions settle first.
- **Do not touch:** `screenLanded`'s class-free check (`screen-ready.ts`), which was #361 review pass 1 finding 1's fix.
- **Proof:** `pnpm test:browser` passes with the fix. Then, in a scratch worktree, change `visit('/app/audience', …)` to `visit('/app/audiencex', …)`: today the walk passes, after the fix it fails naming that step.

### 5. A toast test asserts that the close label constant equals its own literal, a copy test — LOW
- **Location:** `apps/web/src/app.test.ts:520`
- **Attribution:** introduced in `dfa9232` (#366 The toast becomes shadcn Toast on Base UI) (`git log --oneline -S"expect(toastCloseLabel).toBe('Close')" efdfc48..HEAD`)
- **Real-world trigger:** an approved edit of the close label fails the suite while no code broke. No user path. LOW.

**Evidence**
```ts
expect(close.getAttribute('aria-label')).toBe(toastCloseLabel)
expect(toastCloseLabel).toBe('Close')
```
**Failure mode** — CODING_STANDARDS.md 2: "No test asserts that fixed copy is present." The second line restates `preferences.ts`'s literal and states no rule.
**Recommended fix** — delete line 520 and keep line 519.
**Remediation brief**
- **Design intent:** copy is held by Nick's approval on its issue, not by the suite; a test may observe a branch through text, never pin the text itself.
- **Full surface:** `apps/web/src/app.test.ts:520` only.
- **Must preserve:** line 519 and the rest of that test (the close button found by its name on the accessibility tree).
- **Do not touch:** the `toastCloseLabel` constant in `apps/web/src/preferences.ts`.
- **Proof:** `pnpm exec vitest run apps/web/src/app.test.ts` green; `git grep -n "toBe('Close')" apps/web/src/app.test.ts` prints nothing.

### 6. A select test tests only the test file's own finder — LOW
- **Location:** `apps/web/src/app.test.ts:2506-2512` ("a name no select has finds none, and the find throws")
- **Attribution:** introduced in `4568a4b` (#363 The select becomes shadcn Native Select); green at `efdfc48` in the oracle run, and not a review-finding fix
- **Real-world trigger:** none; it costs a run and claims coverage the app does not get. LOW.

**Evidence**
```ts
test('a name no select has finds none, and the find throws', async () => {
  ...
  expect(() => selectNamed(container, 'Date')).toThrow('0 comboboxes named Date, not 1')
```
**Failure mode** — CODING_STANDARDS.md 2 deletes a scaffolding test and a test that states no rule. This one asserts `comboboxesNamed` and `selectNamed`, helpers in the same test file, and pins the helper's error text.
**Recommended fix** — delete the test.
**Remediation brief**
- **Design intent:** every test asserts one rule from the issue, as a fact about what the app renders.
- **Full surface:** `apps/web/src/app.test.ts:2506-2512` only.
- **Must preserve:** `comboboxesNamed` and `selectNamed` themselves, which the four select tests use; the "Channel is not on view with one channel" test, which asserts the real rule a missing select states.
- **Do not touch:** the other tests in "four selects".
- **Proof:** `pnpm exec vitest run apps/web/src/app.test.ts` green; `git grep -n "a name no select has" apps/web/src` prints nothing.

### 7. Comment hygiene — LOW (aggregated)
- `apps/web/src/app.css:12-13` — "or a --font-mono that would overwrite the visual system's own" → "or a font family other than the visual system's" (Tailwind's theme layer loses to the unlayered visual-system sheet, so it could not overwrite it)
- `apps/web/test/web.test.ts:809-810` — "Nick's browser walk at /app checks that every select draws the chevron." → "Nick's own pass in a browser at /app checks that every select draws the chevron; `pnpm test:browser` does not."
- `apps/site/test/screenshot/browser-walk.ts:6` — "so two runs never collide" → "so runs in two worktrees never collide (two runs in one worktree share apps/web/dist)"
- `apps/site/test/screenshot/browser-walk.ts:56` — "without the hosts that would send the walk's events or errors" → "without the shell's OpenPanel and GlitchTip hosts (Vite still reads an apps/web/.env file, and none exists)"
- `README.md:54` — "and on a request the stub has no answer for." → ", on a request the stub has no answer for, and on a step that cannot reach its state."
- `apps/web/src/AccountMenu.tsx:27-28` — "as it did before the menu was an ARIA menu" → delete the clause (narrates the change)
- `apps/web/src/App.tsx:560` — `{/* Wherever the creator scrolled. */}` → delete (`Toast.tsx`'s doc comment says it)

## Needs Further Investigation
### A. The toast's description is a status inside Base UI's polite "Notifications" region, which may be announced twice, and "Notifications" is a new string — confirm with VoiceOver
Base UI's viewport renders `role="region" aria-live="polite" aria-label="Notifications"` (`@base-ui/react/toast/viewport/ToastViewport.mjs:175-180`), and `components/ui/toast.tsx:116` keeps `role="status"` on the description, an implicit polite live region nested inside it. Some screen readers announce a nested live region twice. To confirm or kill: with VoiceOver on in Safari and Chrome on macOS, change Currency on the profile and count the announcements. If it is announced twice, drop one of the two regions (the viewport's `aria-live` or the description's `role`, keeping AC 1's find by role `status` working). Separately, the landmark name "Notifications" is copy no issue approved (#366's assumptions record it as Base UI's default); Nick to approve it or name a constant in the app's copy modules.

### B. An old toast's close could clear the new notice if it lands between a render and its effect — needs an executed interleaving
`apps/web/src/Toast.tsx:30-49`: `latest.current` moves to the new notice during render, and the old toast is closed in the effect's cleanup. If the old toast's 10-second timer fires in that window, `onClose` reads `latest.current` and runs the new notice's `onClose` (for example, clearing a failure that just arrived). The window is the gap between a commit and React's passive effect flush, so it is milliseconds wide; base gave each toast its own `onClose`. To confirm: a happy-dom test with fake timers that advances the success toast's timer to its last millisecond, triggers a failed save, and advances once more before effects flush. Capped at LOW whatever the result. Cheap guard if confirmed: return early in `onClose` when `latest.current?.key !== key`.

## Reviewed and Dismissed
- The walk does not catch a style written through CSSOM (`el.style.x = …`) — the policy allows CSSOM, so nothing is blocked and nothing breaks; React's `style` props already render this way in `AudienceRetention.tsx` and `Cards.tsx`, and ADR 0014 point 3 is about what the policy blocks.
- The toast's root is Base UI's nameless `role="dialog"` with `tabIndex=0` — #366's assumptions accept Base UI's semantics (same or better); it carries `aria-describedby` to the description, and it sits at the end of the tab order, after the page.
- `transparent` and `currentcolor` pass rule 3 while `#0000` fails — the shared colour reader treats both keywords as writing no colour of their own, on purpose; `[background:transparent]` minifies to `0 0` in the build.
- A declaration after a nested rule's `}` is skipped by `built-css.ts:19` — latent: Lightning CSS flattens nesting in the build.
- `shadcnDefaultsIn`'s colour half reports only what `coloursOutsideTokens` already reports — redundant, not wrong; the fixture is ADR 0014 rule 3's letter.
- The green-at-base app tests for the four selects, the custom range and sign-out from the profile — the epic is a preservation spec, and these guard behaviour that had to survive the move, found now by role.
- `components.test.ts`'s loosened `<option[^>]*value=` and `<input[^>]*type="date"` regexes — they accept the copied components' attributes and keep asserting values and order.
- The new `built-css`, `walk-report` and `screen-ready` tests green at base — they test new test-only modules, and the control plant (`bg-[#f00]`) shows the rule 3 test goes red on a real build.
- Profile chosen from the menu while already on the profile now scrolls to the top — the old code focused the avatar in the header, which brought the top into view as well.
- The deleted `toast.test.ts` — Base UI owns the timer now (#366's assumption); ten seconds, the pointer hold and the keyboard focus hold have app tests (`app.test.ts:438`, `:526`, `:549`).
- `Page.navigate` racing the old document in `visit` — `ready()` polls until the new screen settles and the walk passed in every run; no failure observed.

## Minor / nits
- `browser-walk.ts:116-124`, `:258-264`: a CDP call has no timeout and a closed socket rejects nothing, so a Chrome crash hangs `pnpm test:browser`.
- `browser-walk.ts:178-189`: no `'error'` listener on the Chrome spawn, so a missing Chrome throws ENOENT with no report and leaves the temp profile.
- `browser-walk.ts:599-602`: Chrome is killed but not awaited before its profile is removed.
- `walk-report.ts:67-83`: each violation arrives on both paths, so one blocked style is counted and printed twice.
- `browser-walk.ts:580`: the close-button check finds any button named Close on the page, not the toast's.
- `browser-walk.ts:308-317`: a violation slower than the 400 ms settle is filed under the next step.
- `walk-report.test.ts:43-68`: "each violation sits under the route it came from" asserts each line, not the order; the fallback for a violation outside every step has no test.
- `screen-ready.test.ts:14-26`: two tests assert the same landed case.
- `stub-api.ts` `audienceOf`: a lifetime window answers 404, recorded as unanswered, not the API's refusal; unreachable from today's walk.
- `components/ui/toast.tsx:143-153`: seven exports nobody imports; `ToastProvider` adds nothing over the primitive. `native-select.tsx:40-44` `NativeSelectOptGroup` has no caller (kept by #363's assumption). `button.tsx:8` `[&_svg]:pointer-events-none [&_svg]:shrink-0` style svgs no Button holds; `buttonVariants` is exported but used only in its file.
- `AccountMenu.tsx:21` imports `./components/ui/dropdown-menu.tsx`; every other caller imports `@/components/ui/…`.
- A modified click on Profile in the menu now closes the menu (Base UI's `closeOnClick`); base left it open.
- Base UI's toast adds Escape to close, F6 to jump to the toasts and swipe to dismiss; none removes a behaviour.
- `app.css:34` `--radius-pill` is used by no utility.
- `app.css:7` `source(".")` scans test files and comments, so the build emits `.hidden`, `.table`, `.container`, `.block`, `.blur` and others no element uses; `@source not "./**/*.test.ts";` would drop most.
- `web.test.ts:177-186` checks the theme and utilities layers exist, not their order.
- `app.test.ts:506-512` proves "no check mark" by counting svgs and sibling position.
- No app test now covers the pointer leaving while keyboard focus stays on the toast (Base UI's `expanded = hovering || focused` holds it).

## Test quality
Tests added or changed: 105 in-scope cases · green against `$BASE`: 55, of which 26 test new test-only modules and 27 guard preserved behaviour (legitimate), 2 are findings 5 and 6 · tautology shapes found: 1 copy assertion (finding 5), 1 helper-only test (finding 6), no snapshots, no assertion-free tests, no mocked unit under test. Two guards the epic relies on can be passed by a plant (findings 1 and 2), and one check misses an important value (finding 3).

## Before opening the PR
- **CI readiness:** lint, typecheck, build and test green (one unrelated flake on the first run, green on re-run); `pnpm test:browser` green.
- **Commit hygiene:** nothing uncommitted; this doc and `repro/plant-css-gaps.sh` are the review's own commit.
- **Likely reviewer asks:** the JS and CSS gzip sizes before and after, which the spec asks the PR to state: JS 131.1 kB gzip at #361 to 199.4 kB at HEAD (+68.3 kB), CSS 5.6 to 6.8 kB gzip; the "Notifications" landmark name (Needs Further Investigation A).

## Verdict
Ready to open the PR, with follow-ups. No finding is MEDIUM or higher. The six confirmed LOW findings and the comment hygiene batch are test-side and cheap, so fixing them in this branch before the PR keeps the guards honest for #359, which reuses them. Needs Further Investigation A wants a VoiceOver check and Nick's word on the landmark name before the PR, or a ticket.
