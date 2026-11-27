# Pre-PR review: creator-analytics#732 The thumbnail preview tool moves into Stillstats

**Branch:** `creator-analytics-732-thumbnail-preview-tool` vs `origin/main` (merge-base `d3553bea` "Merge pull request #778 from nick-vogel/release-2026.11.17", which is `origin/main` itself)
**Reviewed at:** HEAD `beb0edf1` ("creator-analytics#732 pre-PR review 2 remediation closure table"), clean tree, no uncommitted or untracked files at review time. Whole branch: 85 files, +11268 / −216.
**Delta under review:** since `7d857083` ("creator-analytics#732 pre-PR review 1 remediation closure table"), the HEAD that `pre-pr-review-2.md` reviewed. The delta is 4 files, +252: the review 2 doc and its repro (`432238fd` "creator-analytics#732 pre-PR review 2", `beb0edf1`), and the finding 1 fix `e3326171` ("creator-analytics#732 pre-PR review 2 finding 1: In focus mode on the opposite stage the focus ring and the warning marks fall below 3:1 contrast"), which touches 2 code files, +17: `packages/thumbnail-preview/src/styles.css` (one declaration) and `apps/site/test/screenshot/browser-walk.ts` (the `accentOnTheStage` check).
**Reviewed against:** epic creator-analytics#732, `pre-pr-review-2.md` (its finding 1 intent, its Approach decisions, its Needs Further Investigation B and C, and its remediation closure table), `pre-pr-review-1.md` findings 2 to 6, and `CODING_STANDARDS.md`.
**Date:** 2026-11-17
**Reviewer:** 1 code-review agent + verify pass (delta-scoped)

## What was verified and how

| Check | Method | Result |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | run in the integration worktree | already up to date |
| `pnpm lint` | full run | green, 759 files |
| `pnpm typecheck` | full run | green |
| `pnpm build` | full run | green (the existing chunk-size warning on `apps/web` only) |
| `pnpm test` | full run, `TEST_DATABASE_ADMIN_URL` unset, Testcontainers Postgres | green: 190 files, 4858 passed, 1 expected fail |
| `pnpm run --if-present test:browser` | full browser walk in the system Chrome | green: 120 steps, no CSP violation. The same four signed-out 401s on the tool page as rounds 1 and 2 (the stub's answer to `GET /api/me` with no session) |
| Prior finding 1 against its intent | executed `repro/focus-stage-accent.html` in headless Chrome | fixed: every row gives `accent` `#065fd4` and `focusRingContrast` 5.84 on `stage: "light"`, `#3ea6ff` and 7.4 on `stage: "dark"`, on both page themes |
| Accent readers on the stage | agent: listed every `var(--accent)` reader in the package sheet (`:63`, `:76`, `:87`, `:163`, `:242`, `:288`, `:318`, `:422`, `:427`) and the visual system (`a:hover` `:192`, `:focus-visible` `:196`); probe page with `data-theme="dark"` read the computed borders and fills | `.t-notice--warn` left border, `.t-warnmark svg` and `.t-slot--over` border all paint `rgb(6, 95, 212)` on the light stage. No `color-mix`, relative colour, `accent-color`, `::selection` or `caret-color` derives from `--accent` on the stage. Contrast against the stage's chip and raised fills: 5.2:1 (`#f2f2f2`), 6.2:1 (`#212121`), 5.8:1 (`#272727`) |
| Page mode unchanged | agent probe: bare `.t-toolroot` | `--accent` reads the page's `oklch(0.77 0.055 308)` on the dark page, so nothing outside `.t-focus` changes |
| `--accent-hover` and `--on-accent` left unmapped (Approach decision) | agent: specificity of the overrides | still safe today: `.t-link:hover` (`styles.css:86`) loses to `.t-focus .t-link:hover` (`:801`), and the pressed `.t-seg` option (`:422-423`) is replaced by `.t-focus .t-seg button[aria-pressed="true"]` (`:767`). The tool renders no `.button`, `.avatar` or `<a>`. The header comment over the block does not say this (finding 1) |
| The new walk check `accentOnTheStage` | agent read it against `evaluate` (`browser-walk.ts:481-489`), the walk modes and both call sites (`:1533`, `:1587`) | can go red (remediation 2 recorded it red before the declaration: "In light mode at 1280px, on the light stage the accent is oklch(49% .06 308), not #065fd4"), covers both opposite-stage combinations through the Background switch, and a missing `.t-toolroot` throws rather than passes |
| Prior LOW findings 2 to 6 (round 1) | `git diff 7d857083 --stat`; executed `repro/focus-stage-contrast.html` | untouched: the delta touches none of their files except `styles.css:719`, and the dark stage's crop band still reads `rgb(241, 241, 241)` (round 1 finding 2) |
| NFI C (`color-scheme` on the stage) | executed: scratchpad page loading the real sheets, `getComputedStyle(root).colorScheme` for page theme × stage | half confirmed: the stage's computed `color-scheme` follows the page (`dark` on the light stage, `light` on the dark stage). A headless screenshot of the rail did not draw a scrollbar, so the visible effect is still unproved |
| Em-dash scan | `git diff 7d857083 -- apps packages`, added lines | none |
| Tautology audit | the delta adds no unit test; its one new check is the walk's `accentOnTheStage`, recorded red then green by remediation 2 | no tautology |
| What could not be run | a drawn focus ring in the walk (its clicks are scripted, so `:focus-visible` never applies); a scrollbar screenshot on the opposite stage (NFI C); React's flush order for NFI B | carried as a nit and as Needs Further Investigation |

**Overall:** Round 2's MEDIUM is fixed against its intent. The keyboard focus ring, the "Cropped" mark, the warning notice's edge and the drop highlight now take YouTube's blue on each stage, at 5.2:1 or better, and page mode is untouched. This round confirms one LOW, a header comment that says every token follows the stage while two accent tokens still follow the page. The PR is not gated by anything new. Round 1's five LOWs stay open by its remediation scope.

## Approach decisions

- Focus-stage token remap: the stage remaps the visual-system tokens to the `--yt-` stage palette inside `.t-focus`, as `styles.css:713` already does for `--ink`, `--ink-soft`, `--line`, `--bg`, `--bg-end` and now `--accent`. A token the chrome reads inside the stage that the block leaves out is the defect, and the fix adds it to that block rather than adding per-element `.t-focus .x` rules.
- Scrims: a darkening wash uses `var(--yt-scrim)`, the declared YouTube scrim, as `.t-card--overlay::after` (`styles.css:639`) does. Never a page token such as `--ink`, which flips lightness with the theme.
- Web dev proxy: each site path the web app links to gets its own `server.proxy` entry in `apps/web/vite.config.ts`, as `/privacy`, `/terms` and `/releases` do (`/releases` came with creator-analytics#577).
- Focus-stage colour proofs (remediation 1): the browser walk reads the computed colour of the element on the stage and compares it with the `youtube.css` value spelled as Chrome computes it, in a named constant beside `stageBackground` in `apps/site/test/screenshot/browser-walk.ts`, checked on the stage focus mode opens on and again after the Background switch.
- Focus-stage accent (review 2): `.t-focus` maps `--accent` to `var(--yt-link)`. `--accent-hover` and `--on-accent` stay unmapped, because every reader of them on the stage is already overridden by a `.t-focus .x` rule (`.t-focus .t-link:hover` at `styles.css:801`, `.t-focus .t-seg button[aria-pressed="true"]` at `:767`). This review keeps that decision and asks only that the block's comment record it (finding 1).
- Focus-stage accent proof (remediation 2): the walk reads `getPropertyValue('--accent').trim()` on `.t-toolroot` and compares it with `stageAccent`, because the walk's scripted clicks never draw a ring. This review keeps it; a drawn-ring check is a nit, not a gate.

## Prior-review closure

`pre-pr-review-2.md`, against `7d857083`:

| Prior finding | Status now | How checked |
| --- | --- | --- |
| 1 (MEDIUM) focus ring and warning marks below 3:1 on the opposite stage | **fully fixed** by `e3326171` | repro rows, the agent's probe of the drawn borders, and the walk's new check, all above |
| NFI B stale `from` after a decode | untouched, still unproved | carried as NFI B |
| NFI C `color-scheme` on the stage | half confirmed (computed value follows the page), visible effect unproved | carried as NFI C with the new evidence |
| Round 1 findings 2 to 6 (all LOW) | untouched, still open by round 1's remediation scope; finding 2 still reproduces | as in the table above; their briefs stay in `pre-pr-review-1.md` |

One prior finding of MEDIUM or higher, fully fixed. None partially fixed, none untouched, none resolved only by a comment or doc edit. Neither prior doc's closure table lists a known regression.

## Confirmed Issues

### 1. The focus stage's comment says every visual-system token follows the stage, but two accent tokens still follow the page — LOW

- **Location:** `packages/thumbnail-preview/src/styles.css:708-712` (the comment over the `.t-focus` block at `:713-723`).
- **Attribution:** introduced by the branch. `git log -S'point at the stage inside it' d3553bea..HEAD -- packages/thumbnail-preview/src/styles.css` gives only `e872b156` ("creator-analytics#797 Focus mode, the New badge and the duration badge"), and the package sheet is absent at `$BASE`. Against `7d857083` it is pre-existing and unchanged; the remediation narrowed the gap by mapping `--accent` but did not touch the comment. Neither prior doc names it.
- **Real-world trigger:** no user path today, so LOW. Every stage reader of the two unmapped tokens is overridden. The trap is for the next change: a contributor trusting the comment adds a stage rule reading `--accent-hover` or `--on-accent` (a hover fill on a chip's remove button, say), and on the opposite stage it paints the page's purple. Neither `accentOnTheStage` (it reads `--accent` only) nor `packages/thumbnail-preview/test/styles.test.ts` (no `.t-focus` or token assertions) would catch it.

**Evidence**

```css
/* Focus mode's stage: the tool alone on YouTube's own surface, across the whole window and at least
   as tall as it, so no page paper shows around a correctly coloured box. The visual system's tokens
   point at the stage inside it, so the chrome and the below and beside titles follow the stage, not
   the page; the overlay titles keep `--yt-overlay-fg`. The top padding keeps the focus bar off the
   window's top edge. */
```

**Failure mode:** the agent's probe page, with `data-theme="dark"` and the light stage, read `--accent-hover` as `oklch(0.83 0.05 308)`, the dark page's value. The comment states an invariant the block does not hold, and the reason it is safe today (the two `.t-focus .x` overrides) lives nowhere in the code.

**Recommended fix**

```diff
 /* Focus mode's stage: the tool alone on YouTube's own surface, across the whole window and at least
-   as tall as it, so no page paper shows around a correctly coloured box. The visual system's tokens
-   point at the stage inside it, so the chrome and the below and beside titles follow the stage, not
-   the page; the overlay titles keep `--yt-overlay-fg`. The top padding keeps the focus bar off the
-   window's top edge. */
+   as tall as it, so no page paper shows around a correctly coloured box. The tokens this block maps
+   point at the stage, so the chrome and the below and beside titles follow the stage, not the page;
+   the overlay titles keep `--yt-overlay-fg`. `--accent-hover` and `--on-accent` stay the page's,
+   because `.t-focus .t-link:hover` and `.t-focus .t-seg button[aria-pressed="true"]` override their
+   only stage readers, so a new stage reader of either needs a mapping here. The top padding keeps
+   the focus bar off the window's top edge. */
```

**Remediation brief**

- **Design intent:** focus mode is the tool alone on YouTube's own surface. Inside `.t-focus` every visual-system token the chrome reads must resolve against the stage (`.t-focus--light` or `.t-focus--dark`), never the page, because the Background control sets the stage to either theme whatever the page is. The `.t-focus` block is the one place that remap happens. Two tokens are deliberately left at the page's value because every stage reader of them is overridden; the comment is the only record of that, so it has to say it.
- **Full surface:** the comment at `packages/thumbnail-preview/src/styles.css:708-712` only. The overrides it names are `:801` (`.t-focus .t-link:hover`) and `:767` (`.t-focus .t-seg button[aria-pressed="true"]`), against the readers `:86` (`.t-link:hover`, `--accent-hover`) and `:423` (pressed `.t-seg`, `--on-accent`). The visual system's other readers (`packages/visual-system/src/styles.css:219`, `:227`, `:239`, `:249`, on `.button` and `.avatar`) do not reach the stage, since the tool renders no such class.
- **Must preserve:** every declaration in the `.t-focus` block, unchanged; this is a comment-only fix. `pnpm lint` and `pnpm exec vitest run packages/thumbnail-preview/test/styles.test.ts` stay green; the walk's `titleFieldsOnTheStage` and `accentOnTheStage` steps stay green.
- **Do not touch:** the Approach decision to leave `--accent-hover` and `--on-accent` unmapped. Mapping them instead is Nick's call and overturns that decision. `accentOnTheStage` (Reviewed and Dismissed).
- **Proof:** a comment fix has no red-to-green. Check the claim it makes: from the repo root, `grep -n 'var(--accent-hover)\|var(--on-accent)' packages/thumbnail-preview/src/styles.css` lists only `:86` and `:423`, and `sed -n '767,770p;801,803p' packages/thumbnail-preview/src/styles.css` shows the two overrides.

## Needs Further Investigation

### B. A mode switch right after a decode may report a stale `from` — confirm with a test that commits a decode and clicks in the same frame

Carried from rounds 1 and 2, unchanged. `thumbnail-tool.tsx:285-295` reads `stateRef.current`, which a passive effect updates. A click before that effect flushes could read the pre-decode mode, and `modeSwitchEvent` would then drop a real switch. The window is about one frame, and the code is identical to nlvogel-site's, so this is pre-existing and untouched.

### C. The stage keeps the page's `color-scheme`, so the browser's own drawing may follow the page — confirm with a headed screenshot of the rail's scrollbar on the opposite stage

Half confirmed this round. A scratchpad page loading `packages/visual-system/src/styles.css` and `packages/thumbnail-preview/src/styles.css` read `getComputedStyle(root).colorScheme` as `dark` for the dark page with `.t-focus--light`, and `light` for the light page with `.t-focus--dark`; `packages/visual-system/src/styles.css:51`, `:84` and `:88` set it from the page, and `youtube.css:105-127` does not override it. What is still unproved is what a creator sees: the sideways rail (`.t-rail__track`, `styles.css:474`, `overflow-x: auto`) and native form drawing. A headless screenshot drew no scrollbar (macOS overlay scrollbars), so confirm in a headed Chrome with "Show scroll bars: Always", on the dark site with Background set to Light and enough candidates to overflow the rail. If the scrollbar is dark on the white stage, the fix is `color-scheme: light` on `.t-focus--light` and `color-scheme: dark` on `.t-focus--dark` in `youtube.css`, after checking that `styles.test.ts`'s colour scanner accepts the property.

## Reviewed and Dismissed

- `accentOnTheStage` reading the token instead of a drawn colour, so a reader that stops reading `--accent` would stay green: the check can go red for the defect it was written for (recorded red before `e3326171`), the Approach decision chose the token because the walk's scripted clicks never draw a ring, and the neighbouring `titleFieldsOnTheStage` already reads drawn colours for the fields. Kept as a nit, not a finding.
- `stageAccent` holding hex where its siblings hold computed `rgb(...)`: an unregistered custom property returns its authored text, so `#065fd4` and `#3ea6ff` match exactly; a respelling in `youtube.css` would turn the walk red loudly, never pass it falsely. Nit.
- `--bg-glow` and `--grain` left unmapped: their only readers are `body` and `body::after` (`packages/visual-system/src/styles.css:151`, `:164`), ancestors of the stage, so the stage never draws them.
- `--accent` changing anything outside focus mode: the agent's probe read the page value on a bare `.t-toolroot`, and no other package or app applies `.t-focus`.
- `.t-button:hover` (`styles.css:63`) and `a:hover` reading the new accent: `.t-focus .t-button` sets `border: none`, and the tool renders no `<a>`.
- The `@media (max-width: 780px)` `.t-focus` block (`styles.css:851-854`): padding only, no token.

## Minor / nits

- `accentOnTheStage` (`browser-walk.ts:1422-1430`) proves the token, not the paint. A stronger check would Tab to a Background segment through CDP `Input.dispatchKeyEvent`, so `:focus-visible` applies, and compare `getComputedStyle(button).outlineColor` with `rgb(6, 95, 212)` and `rgb(62, 166, 255)`. That reads the ring the review 2 finding was about, and it removes the hex-spelling coupling too.
- `stageAccent` (`browser-walk.ts:1420`) is the one stage constant spelled as authored hex rather than computed `rgb(...)`. Its doc line says so, so this is consistency only.

## Test quality

The delta adds no unit test. It adds one walk check, `accentOnTheStage`, run in all four walk modes on the stage focus mode opens on and again after the Background switch. It is not a tautology: its expected values are literal `youtube.css` values rather than anything read from the code under test, and remediation 2 recorded it red before `e3326171` and green after. Tautology shapes found: 0. The branch-wide audit is in round 1.

## Before opening the PR

- **CI readiness:** lint, typecheck, build and test are green at `beb0edf1`, and the browser walk is green locally.
- **Commit hygiene:** commit this doc. No new repro; the round 2 repros stay.
- **Likely reviewer asks:** a screenshot of focus mode on both stages, with a focus ring visible, for the PR body; whether round 1's five LOWs ship now or become follow-ups; NFI C's scrollbar.

## Verdict

**Ready to open the PR.** No finding gates it. Round 2's one MEDIUM is fully fixed against its intent, proved by the repro, a probe of the drawn borders and a walk check that went red first, and none was resolved only by a comment or doc edit. This round's one confirmed finding is a LOW comment fix that can ride the PR or a follow-up, alongside round 1's five open LOWs. NFI B and C need no fix before the PR. The confirmed count fell from six to one to one LOW, and the delta's content has moved from behaviour to a comment, which is the review reaching the bottom of the barrel rather than the branch failing to improve. The `.t-focus` block has been edited twice in response to review, both times by adding a declaration to the same block as the Approach decision says, so no split ticket is called for.
