# Pre-PR review: creator-analytics#732 The thumbnail preview tool moves into Stillstats

**Branch:** `creator-analytics-732-thumbnail-preview-tool` vs `origin/main` (merge-base `d3553bea` "Merge pull request #778 from nick-vogel/release-2026.11.17", which is `origin/main` itself)
**Reviewed at:** HEAD `7d857083` ("creator-analytics#732 pre-PR review 1 remediation closure table"), clean tree, no uncommitted or untracked files at review time. Whole branch: 83 files, +11016 / −216, of which 3 are binary and 1 is `pnpm-lock.yaml`.
**Delta under review:** since `048ab205` ("creator-analytics#797 Focus mode, the New badge and the duration badge"), the HEAD that `pre-pr-review-1.md` reviewed. The delta is 4 files, +414: the review 1 doc and its repro (`cd2b0635`, `7d857083`), and the finding 1 fix `35337eff` ("creator-analytics#732 pre-PR review 1 finding 1: In focus mode the title fields keep the page's background under the stage's ink"), which touches 2 code files, +27: `packages/thumbnail-preview/src/styles.css` and `apps/site/test/screenshot/browser-walk.ts`.
**Reviewed against:** epic creator-analytics#732 and `pre-pr-review-1.md` (its finding 1 intent, its Approach decisions, its Needs Further Investigation A and B, and its remediation closure table), `CODING_STANDARDS.md`, and nlvogel-site at `613c0ba` (a local checkout) for the original focus stage.
**Date:** 2026-11-17
**Reviewer:** 1 code-review agent + verify pass (delta-scoped)

## What was verified and how

| Check | Method | Result |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | run in the integration worktree | already up to date |
| `pnpm lint` | full run | green, 758 files |
| `pnpm typecheck` | full run | green |
| `pnpm build` | full run | green |
| `pnpm test` | full run, `TEST_DATABASE_ADMIN_URL` unset, Testcontainers Postgres | green: 190 files, 4858 passed, 1 expected fail |
| `pnpm run --if-present test:browser` | full browser walk in the system Chrome | green: 120 steps, no CSP violation. The same four signed-out 401s on the tool page as round 1 (the stub's answer to `GET /api/me` with no session) |
| Prior finding 1 against its intent | executed `repro/focus-stage-contrast.html` in headless Chrome; agent swept every `var(--…)` the package sheet reads against the visual system's page-theme tokens | fixed: every `stage: "light"` row gives the field `rgb(255, 255, 255)` with `rgb(15, 15, 15)` text, every `stage: "dark"` row `rgb(33, 33, 33)` with `rgb(241, 241, 241)`, on both page themes. Apart from the accent family, every page-theme token the chrome reads on the stage is now remapped |
| `--bg-end` spillover | agent: `git grep -- --bg-end`; read the visual system's descendant rules | the only reader inside the stage is `.t-input` (`styles.css:121`); `body` reads it as an ancestor and keeps the page value |
| The new walk check `titleFieldsOnTheStage` | agent read it against the DOM, the walk modes and the transitions | can go red (the pre-fix CSS mismatches on both opposite-stage combinations, and `35337eff`'s own closure row records it red at `cd2b0635`), cannot pass on an empty match, no transition on `.t-input` or `.t-focus` |
| Needs Further Investigation A (accent on the opposite stage) | executed: new `repro/focus-stage-accent.html` in headless Chrome, WCAG contrast of the computed `--accent` and the `.t-warnmark` icon against the stage surface, page theme × stage | confirmed below 3:1 on both opposite stages (finding 1) |
| Finding 1's recommended fix | executed: the same measurement in a scratchpad copy with `.t-focus { --accent: var(--yt-link) }` added | 5.84:1 on the light stage and 7.40:1 on the dark stage, on both page themes |
| Accent readers on the stage | `grep -n 'var(--accent\|var(--on-accent' packages/thumbnail-preview/src/styles.css packages/visual-system/src/*.css apps/site/src/styles.css`; read every `.t-focus .x` override | the readers are listed in finding 1's Full surface |
| Em-dash scan | `git diff 048ab205 -- apps packages`, added lines | none |
| Tautology audit | the delta adds no unit test; its one new check is the walk's `titleFieldsOnTheStage`, which the remediator ran red at `cd2b0635` and green at `35337eff`. No base-worktree run was needed | no tautology |
| What could not be run | `color-scheme` on the stage drawn in a real scroll (NFI C); React's flush order for NFI B | carried as Needs Further Investigation |

**Overall:** Round 1's MEDIUM is fixed against its intent. The title fields now take the stage's colours on every combination of page theme and Background, and a walk step that can go red holds it. Measuring round 1's open question about the accent colour turned it into this round's one MEDIUM: on the opposite stage, the keyboard focus ring, the "Cropped" warning icon, the warning notice's edge and the drop highlight fall to 2.1:1 and 3.0:1. The fix is one declaration in the same block as round 1's fix. Round 1's five LOW findings were left for Nick by remediation scope and still stand.

## Approach decisions

- Focus-stage token remap: the stage remaps the visual-system tokens to the `--yt-` stage palette inside `.t-focus`, as `styles.css:713` already does for `--ink`, `--ink-soft`, `--line`, `--bg` and `--bg-end`. A token the chrome reads inside the stage that the block leaves out is the defect, and the fix adds it to that block rather than adding per-element `.t-focus .x` rules.
- Scrims: a darkening wash uses `var(--yt-scrim)`, the declared YouTube scrim, as `.t-card--overlay::after` (`styles.css:639`) does. Never a page token such as `--ink`, which flips lightness with the theme.
- Web dev proxy: each site path the web app links to gets its own `server.proxy` entry in `apps/web/vite.config.ts`, as `/privacy`, `/terms` and `/releases` do (`/releases` came with creator-analytics#577).
- Focus-stage colour proofs (remediation 1): the browser walk reads the computed colour of the element on the stage and compares it with the `youtube.css` value spelled as Chrome computes it, in a named constant beside `stageBackground` in `apps/site/test/screenshot/browser-walk.ts`, checked on the stage focus mode opens on and again after the Background switch.
- Focus-stage accent (this review): `.t-focus` maps `--accent` to `var(--yt-link)`, YouTube's own interactive colour on each stage, in the same block. `--accent-hover` and `--on-accent` stay unmapped, because every reader of them on the stage is already overridden by a `.t-focus .x` rule (`.t-focus .t-link:hover` at `styles.css:800`, `.t-focus .t-seg button[aria-pressed="true"]` at `:766`).

## Prior-review closure

`pre-pr-review-1.md`, against `048ab205`:

| Prior finding | Status now | How checked |
| --- | --- | --- |
| 1 (MEDIUM) title fields on the opposite stage | **fully fixed** by `35337eff` | repro rows and the walk's new check, both above |
| 2 (LOW) Shorts crop bands lighten in dark mode | untouched, still reproduces: `repro/focus-stage-contrast.html` gives the band `rgb(241, 241, 241)` on the dark stage | remediation scope: LOW tail left for Nick (closure row "deferred") |
| 3 (LOW) web dev proxy misses `/tools` | untouched, no change to `apps/web/vite.config.ts` in the delta | as above |
| 4 (LOW) two moved negative controls | untouched, no test file changed in the delta | as above |
| 5 (LOW) orphaned avatar-menu icon | untouched | as above |
| 6 (LOW) comment hygiene | untouched | as above |
| NFI A accent on the opposite stage | **confirmed**, now finding 1 here | measured |
| NFI B stale `from` after a decode | untouched, still unproved | carried as NFI B |

One prior finding of MEDIUM or higher, fully fixed. None partially fixed, none resolved only by a comment or doc edit. The five LOWs keep their briefs in `docs/reviews/creator-analytics-732/pre-pr-review-1.md` (findings 2 to 6), and nothing in the delta changes their surface or their recommended fixes.

## Confirmed Issues

### 1. In focus mode on the opposite stage, the focus ring and the warning marks fall below 3:1 contrast — MEDIUM

- **Location:** `packages/thumbnail-preview/src/styles.css:713-724` (the `.t-focus` block, which leaves `--accent` at the page's value), read by `packages/visual-system/src/styles.css:195-199` (`:focus-visible` ring) and the package sheet at `:163`, `:242`, `:288`, `:318`, `:427`.
- **Attribution:** introduced by the move. The package sheet is absent at `$BASE` (`git show d3553bea:packages/thumbnail-preview/src/styles.css` fails), `.t-seg button:focus-visible { outline: 2px solid var(--accent) }` comes with `859c7f49` ("creator-analytics#795 Shorts mode and the mismatch notice"), and the `.t-focus` remap without the accent comes with `e872b156` ("creator-analytics#797 Focus mode, the New badge and the duration badge"). The visual system's `:focus-visible` ring is on `$BASE`, but no stage existed for it to land on. nlvogel-site's sheet reads different tokens (its `.t-warnmark svg` reads `--status-warn`), so whether the original had the same contrast is not established. Against `048ab205` it is unchanged: round 1 recorded it as NFI A, and the remediation did not work it (closure "NFI A and B were not worked"). It is not in round 1's deferred list.
- **Real-world trigger:** a creator on the dark site enters focus mode and sets Background to Light, YouTube's default look, then moves through the controls with Tab, or loads a candidate that gets the "Cropped" mark. The light site with Background set to Dark is the milder mirror case. Default entry is fine, since the stage opens on the page's theme.

**Evidence**

```css
.t-focus {
  --ink: var(--yt-fg);
  --ink-soft: var(--yt-fg2);
  --line: var(--yt-border);
  --bg: var(--yt-surface);
  --bg-end: var(--yt-raised);
  --text-primary: var(--yt-fg);
```

```css
:focus-visible {
  outline: 2px solid var(--accent);
```

**Failure mode:** `--accent` is `oklch(0.49 0.06 308)` on the light page and `oklch(0.77 0.055 308)` on the dark page (`packages/visual-system/src/styles.css:59`, `:96`, `:121`), and the stage keeps it. Executed, `repro/focus-stage-accent.html`:

| Page | Stage | Focus ring and warn icon against the stage |
| --- | --- | --- |
| light | light | 6.44:1 |
| light | dark | **2.98:1** |
| dark | light | **2.12:1** |
| dark | dark | 9.06:1 |

WCAG 1.4.11 asks 3:1 for a focus indicator and a meaningful graphic against its background. The readers on the stage are every keyboard focus ring (the toolbar, the Background and mode controls, the title fields, "Exit focus mode"), the `.t-warnmark` "Cropped" icon, the `.t-notice--warn` left border, and the drop highlight on a slot or chip. The walk switches Background by a scripted click, so it never draws a ring, and it reads no accent colour.

**Recommended fix**

```diff
 .t-focus {
   --ink: var(--yt-fg);
   --ink-soft: var(--yt-fg2);
   --line: var(--yt-border);
   --bg: var(--yt-surface);
   --bg-end: var(--yt-raised);
+  --accent: var(--yt-link);
   --text-primary: var(--yt-fg);
```

`--yt-link` is `#065fd4` on `.t-focus--light` and `#3ea6ff` on `.t-focus--dark` (`youtube.css:112`, `:124`), declared on the same element as `.t-focus` (`thumbnail-tool.tsx:456`), so the reference resolves. Executed in a scratchpad copy: 5.84:1 on the light stage and 7.40:1 on the dark stage, on both page themes.

**Remediation brief**

- **Design intent:** focus mode is the tool alone on YouTube's own surface. Inside `.t-focus` every visual-system token the chrome reads must resolve against the stage (`.t-focus--light` or `.t-focus--dark`), never against the page's theme, because the Background control can set the stage to either theme whatever the page is. The `.t-focus` block is the one place that remap happens. On the stage the interactive colour is YouTube's, `--yt-link`.
- **Full surface:** add the declaration at `packages/thumbnail-preview/src/styles.css:713-724`. Readers that change with it, inside the stage: `packages/visual-system/src/styles.css:195-199` (`:focus-visible` outline), package `styles.css:427` (`.t-seg button:focus-visible`), `:163` (`.t-slot--over` border), `:242` (`.t-chip--over` border), `:288` (`.t-notice--warn` left border), `:318` (`.t-warnmark svg`), `:87` (`.t-link:hover` underline colour; its text colour is overridden at `:800`). Readers already overridden on the stage, so unchanged: `:63` (`.t-button:hover` border, and `.t-focus .t-button` sets `border: none` at `:775`), `:422` (pressed seg background, overridden at `:766`). The tool renders no `<a>`, `.button` or `.avatar` (`grep -n 'className="button\|className="avatar\|<a ' packages/thumbnail-preview/src/*.tsx` is empty), so the visual system's `a:hover`, `.button` and `.avatar` accent reads do not reach the stage. Add a walk check in `apps/site/test/screenshot/browser-walk.ts`: a named constant beside `stageTitleField` (`:1414`) holding the `--yt-link` values (`light: '#065fd4'`, `dark: '#3ea6ff'`, the spelling `getPropertyValue('--accent').trim()` returns on `.t-toolroot`), compared at the two `titleFieldsOnTheStage` call sites (`:1518` and `:1571`) or inside that helper.
- **Must preserve:** the page-mode look, since the remap applies only under `.t-focus`. `--accent-hover` and `--on-accent` stay unmapped (Approach decisions). On the stage that matches the page, the ring, the warn icon, the notice edge and the drop highlight change from the page's purple to YouTube's blue, which is intended by the design intent above. `packages/thumbnail-preview/test/styles.test.ts` stays green (no literal colour is added). The walk's focus-mode step, `titleFieldsOnTheStage`, and the "New" badge step stay green.
- **Do not touch:** the title field's boundary contrast (Reviewed and Dismissed). `enterFocusStage` (`focus-stage.ts`). The Shorts crop band scrim, which is round 1 finding 2 with its own brief.
- **Proof:** from the repo root, `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --allow-file-access-from-files --user-data-dir="$(mktemp -d)" --dump-dom "file://$PWD/docs/reviews/creator-analytics-732/repro/focus-stage-accent.html" | sed -n '/<pre id="out">/,/<\/pre>/p'`. Today the light page with the dark stage gives `focusRingContrast: 2.98`, and the dark page with the light stage `2.12`. After the fix every row gives `5.84` on `stage: "light"` and `7.4` on `stage: "dark"`, and `accent` reads `#065fd4` and `#3ea6ff`. The walk check above is the lasting red-to-green test: `pnpm run test:browser`, red before the declaration, green after.

## Needs Further Investigation

### B. A mode switch right after a decode may report a stale `from` — confirm with a test that commits a decode and clicks in the same frame

Carried from round 1, unchanged. `thumbnail-tool.tsx:285-295` reads `stateRef.current`, which a passive effect updates. A click before that effect flushes could read the pre-decode mode, and `modeSwitchEvent` would then drop a real switch. The window is about one frame, and the code is identical to nlvogel-site's, so this is pre-existing and untouched.

### C. The stage does not set `color-scheme`, so the browser's own drawing may follow the page — confirm with a screenshot of the rail's scrollbar on the opposite stage

`packages/visual-system/src/styles.css:51`, `:84` and `:88` set `color-scheme` from the page theme, and neither `.t-focus--light` nor `.t-focus--dark` (`youtube.css:105-127`) overrides it. On the dark site with Background set to Light, the sideways rail's scrollbar (`styles.css:474`, `overflow-x: auto`) and the title fields' native selection and autofill drawing may stay dark on the white stage. To confirm, take a headless screenshot of a filled rail in that state, or read `getComputedStyle(root).colorScheme`. If it holds, the fix is `color-scheme: light` and `color-scheme: dark` on the two `youtube.css` blocks, after checking that `styles.test.ts`'s colour scanner accepts the property.

## Reviewed and Dismissed

- The title field's boundary against the stage (`#fff` on `#fff` with a `#e5e5e5` border, `#212121` on `#0f0f0f` with `#3f3f3f`): these are YouTube's own values, which focus mode reproduces on purpose, and the page-mode field has a similarly soft border. A design choice, not a regression.
- `--bg-end` changing anything besides the title fields: its only reader inside the stage is `styles.css:121`; `body` (`packages/visual-system/src/styles.css:152`) is an ancestor and keeps the page value.
- `--yt-raised` failing to resolve: `t-toolroot t-focus t-focus--${surface}` are one element (`thumbnail-tool.tsx:451-456`), so the reference resolves where it is declared.
- The walk check false-passing or flaking: `.t-toolroot .t-input` matches the three fields that `TitleFields` always renders (`title-fields.tsx:42-51`, `thumbnail-tool.tsx:468`), the empty match throws, the `--yt` hex values serialise exactly as the constants, and no transition applies to `.t-input` or `.t-focus`.
- The walk's two titled call sites and the `evaluate` result shape: they match the file's existing `.map` pattern (`browser-walk.ts:1082`, `:1348`) and run after `toolRootState` has seen the new class.

## Minor / nits

- `titleFieldsOnTheStage` (`browser-walk.ts:1419-1435`) reads the background and text colour only. A later break in the field's border (`--line`) or placeholder (`--ink-soft`) on the stage would stay green. Adding `borderTopColor` against `--yt-border` (`rgb(229, 229, 229)`, `rgb(63, 63, 63)`) would cover the border.
- When no title field matches, the error reads "the title fields draw [], not {…}". A separate message for the empty case would read more plainly.

## Test quality

The delta adds no unit test. It adds one walk check, `titleFieldsOnTheStage`, run in all four walk modes on the stage focus mode opens on and again after the Background switch. It is not a tautology: its expected values are literal `youtube.css` values rather than anything read from the code under test, and the remediator recorded it red at `cd2b0635` ("on the light stage the title fields draw … oklch(1 0 0)") and green at `35337eff`. Tautology shapes found: 0. The branch-wide audit is in round 1.

## Before opening the PR

- **CI readiness:** lint, typecheck, build and test are green at `7d857083`, and the browser walk is green locally.
- **Commit hygiene:** commit this doc and `repro/focus-stage-accent.html`.
- **Likely reviewer asks:** the contrast of the tool's controls on the opposite stage (finding 1); a screenshot of focus mode on both stages for the PR body; whether round 1's five LOWs ship now or become follow-ups.

## Verdict

**Ready to open the PR once finding 1 is fixed.** Finding 1 (MEDIUM) gates the PR: keyboard focus and the warning marks fall below 3:1 on the opposite stage, which a creator meets with two clicks, and the fix is one declaration plus a walk check. Round 1's MEDIUM is fully fixed, and none was resolved only by a comment or doc edit. Round 1's five LOWs remain open by remediation scope and can ride the same pass or become follow-ups. NFI B and C need no fix before the PR. The `.t-focus` block has now been edited once in response to review, and this would be the second, so no split ticket is called for. The confirmed count fell from six to one, and that one is a measured behaviour defect, not drift.

## Remediation — 2026-11-17

| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 1 (MEDIUM) | `e3326171` creator-analytics#732 pre-PR review 2 finding 1: In focus mode on the opposite stage the focus ring and the warning marks fall below 3:1 contrast | red→green: `repro/focus-stage-accent.html` gave `focusRingContrast` 2.98 (light page, dark stage) and 2.12 (dark page, light stage) before, and 5.84 on every `stage: "light"` row and 7.4 on every `stage: "dark"` row after, `accent` reading `#065fd4` and `#3ea6ff`. `pnpm run test:browser` red before the declaration ("In light mode at 1280px, on the light stage the accent is oklch(49% .06 308), not #065fd4"), green after (120 steps, no CSP violation) | 1 (the `stageAccent` doc line, which names its coupling to `youtube.css` as the neighbouring `stageBackground` and `stageTitleField` lines do) | proved by execution (MEDIUM, proof executed, preserve suites green); no verify agent |

Surface re-verified before the fix: the `var(--accent)` readers match the brief. The one reader the brief did not list, `.t-link` text colour (`packages/thumbnail-preview/src/styles.css:76`), is overridden on the stage by `.t-focus .t-link { color: var(--yt-link) }`, so it is unchanged. `apps/site/src/styles.css:299` (`.legal li::marker`) and the visual system's `a:hover`, `.button` and `.avatar` readers do not reach the stage.

Preserve suites: `pnpm exec vitest run packages/thumbnail-preview/test/styles.test.ts` green (4 tests). Full checks at `e3326171`: `pnpm lint` green (759 files), `pnpm typecheck` green, `pnpm build` green, `pnpm test` green (190 files, 4858 passed, 1 expected fail, `TEST_DATABASE_ADMIN_URL` unset), `pnpm run test:browser` green.

Deferred: none from this doc. Round 1's LOW findings 2 to 6 stay open by its remediation scope, with their briefs in `pre-pr-review-1.md`. NFI B and C were not worked.

### Known regressions, deferred

- None.

### Rework briefs

- None. No verify pass ran, so no rework.

### Approach decisions (remediation 2)

- Focus-stage accent proof: the browser walk reads `getPropertyValue('--accent').trim()` on `.t-toolroot` and compares it with `stageAccent`, the `--yt-link` values of `youtube.css`, in a helper `accentOnTheStage` called beside `titleFieldsOnTheStage` on the stage focus mode opens on and after the Background switch. It mirrors remediation 1's colour proof, and it reads the token rather than a drawn ring because the walk's scripted clicks never draw one.
