# Pre-PR review: creator-analytics#732 The navigation bar, the full-width tool page, and the web app's small-screen Menu

**Branch:** `creator-analytics-732-thumbnail-preview-tool` vs `origin/main` (merge-base `269d4c8b` "Merge pull request #886 from nick-vogel/creator-analytics-732-thumbnail-preview-tool", which is `origin/main` itself)
**Reviewed at:** HEAD `3f00d864` ("creator-analytics#889 The thumbnail preview tool page uses the full width, with a back link above the title"), clean tree, no uncommitted or untracked files at review time. Whole branch: 34 files, +2437 / −324, 13 commits, carrying four landed children: #888 (`d51b9f97`, `210cc7af`, `d74251f1`, merge `d72c93c8`), #889 (`7d88072a`, merge `3f00d864`), #890 (`c116855d`, merge `804d61c9`) and #891 (`88226db7`, `15e5b9ac`, `f1226572`, `35690061`, merge `135879aa`).
**Delta under review:** the whole `$BASE` surface. `pre-pr-review-1.md` to `pre-pr-review-3.md` reviewed the epic's first PR (#886, last reviewed HEAD `beb0edf1` "creator-analytics#732 pre-PR review 2 remediation closure table"), which is an ancestor of `$BASE`, so none of this surface was under review before and this run is a full review of it.
**Reviewed against:** epic creator-analytics#732, sub-issues #888, #889, #890 and #891 (bodies and acceptance criteria), the four tickets' recorded assumptions and lane review outcomes (the lanes' open LOW findings are listed under Minor and not re-raised), `CODING_STANDARDS.md` standards 1 to 3, ADR 0012 and ADR 0021. No plan docs under `docs/specs/` or `docs/plans/`.
**Date:** 2026-11-18
**Reviewer:** 3 code-review agents (site, web app, browser walk plus tautology audit) + 1 disprove-mode measurement agent + verify pass

## What was verified and how

| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` in the integration worktree | ok |
| Lint | `pnpm lint` | green |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` | green |
| Unit and integration suites | `pnpm test` (Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | green: 191 files, 4916 passed, 1 expected fail |
| Browser walk | `pnpm run --if-present test:browser` (system Chrome) | green: 122 steps, no content security policy violation; four expected 401s on the signed-out tool page |
| Tautology audit | the 7 changed test files copied into a scratch worktree at `269d4c8b`, run with `pnpm exec vitest run <files>` | 79 added or changed tests: 73 red at base, 6 green (see Test quality) |
| Open sidebar's "Thumbnail preview" row overflow | headless system Chrome over DevTools against the repo's stub API (`apps/site/test/screenshot/stub-api.ts`) serving `apps/web/dist`, at 1280x800 scale 1 and 1.5 and at 768x900 | disproved: the external link icon ends 10.48px inside the link (see Reviewed and Dismissed) |
| `:where()` selector claim in `apps/site/src/styles.css` | the repo's lightningcss 1.33.0 over the rule with and without `:where()` | the comment holds: without it the build emits one `:is()` at (0,2,2) |
| aria-current build plugin | read `apps/site/dist` | only the tool page carries `aria-current`, on its two header links; no page keeps an `<!-- include` directive |
| CSP | read the built tool page and homepage | no `style="..."` and no inline script beyond JSON-LD; `site-nav.ts` toggles `hidden` only |
| Em-dashes in shipped copy | grep over every added line | none |
| Stale references to the removed small-screen row | grep over `apps/web` for "row of links", `sidebar-quiet`, "in the row" | one stale stylesheet comment (Comment hygiene) |
| iOS Safari, bfcache restore, text zoom overlap | not run: no iOS device, and the walk does not drive Back from a same-tab navigation or zoom | recorded under Needs Further Investigation |

**Overall:** The four children integrate cleanly: the walk's steps leave no state for each other, focus mode on the tool page hides and inerts the new header navigation, the `:where()` keeps focus mode's padding reset winning over the full-width rule, and the web app's column and Menu panel send the right `source` each. Nothing reaches MEDIUM. Three LOW findings remain: the README's event catalogue misses the new site event and the panel's support events, a stylesheet rule and its test hold a layout that no longer renders, and a batch of comment drift. Open the PR after one remediation pass, or with these as follow-ups; the copy approvals the tickets reserve for the PR review still stand.

## Approach decisions

- README event list: the README's analytics section is the catalogue of every event and every surface that sends it, and an event change edits it in the same commit, as `88226db7` did for `tool_link_clicked`, `whats_new_opened` and `feedback_opened` (README.md:114, :117, :119).
- Small-screen web layout: the row layout is gone below the column (`Sidebar.tsx` returns null when `!column`); `.sidebar-support` now renders only in the column and in the header's Menu panel, and each of those writes its own alignment. Fixes remove what the row needed rather than scope it back.

## Prior-review closure

Not applicable. The three earlier docs reviewed the #886 surface, which landed on `origin/main` before this branch's merge-base; their open items (pre-PR review 3 finding 1, Needs Further Investigation B and C) live in `packages/thumbnail-preview`, which this surface does not touch.

## Confirmed Issues

### 1. The README's event catalogue leaves out `site_nav_clicked`, and the Menu panel's support events — LOW

- **Location:** `README.md:148`, `README.md:115`, `README.md:116`
- **Attribution:** introduced. `d51b9f97` ("creator-analytics#888 A navigation bar on every public page...") added `site_nav_clicked` (`apps/site/src/site-nav.ts:24`, wired at `apps/site/src/main.ts:32-35`) and updated `apps/site/src/analytics.ts` and `apps/site/privacy.html`, not the README: `git grep -ln site_nav_clicked` lists only `analytics.ts`, `site-nav.ts`, `main.test.ts`, `site-nav.test.ts` and `site.test.ts`. `88226db7` ("creator-analytics#891 One header row with a Menu button...") added the Menu panel to README lines 114, 117 and 119 but not 115 and 116, though the panel's support item sends both events (`apps/web/src/App.tsx:614`, `onSupportOpened: () => track(supportOpenedEvent('sidebar'))`).
- **Real-world trigger:** Nick or a later session builds an OpenPanel report or audits what the site records (for the privacy policy, which now names navigation clicks) from the README, and does not find the navigation event at all, or reads the support events as desktop-only.

**Evidence** — README.md:148 lists the site's events and stops at the tool's:

```
It sends page views, `sign_in_clicked`, which carries `source: 'thumbnail-preview'` from the tool page's sign-in band and no `source` from the homepage, and, from the tool page, the thumbnail preview tool's `thumbnail_load` ...
```

README.md:115-116 name only the sidebar's link:

```
- `support_opened`, with `surface`: `sidebar` or `settings`, sent on a click of the sidebar's "Support Stillstats" link or the Settings screen's "Leave a tip" link, before Stripe's page opens
- `support_prompt_dismissed`, sent on "Hide" beside the sidebar's "Support Stillstats" link
```

**Failure mode** — The README describes three surfaces less than the code sends from. The same paragraph at :148 also says a signed-in visitor sees the avatar and "Open your dashboard" "with no new event", and omits the tool page's back link, which turns from "Home" to "Back to your account" in the same task (`apps/site/src/main.ts:107`, `pointBackLinks('/app', accountBackLinkText)`).

**Recommended fix** — In README.md:148, after "`sign_in_clicked`, which carries ... no `source` from the homepage,", add: "`site_nav_clicked`, with `link`: `thumbnail-preview`, `mid-roll-manager`, `chrome-extension` or `firefox-extension`, sent on a click of a link in the header's navigation, in the wide list, the Extensions menu or the Menu panel below 48rem, on every page (opening or closing a menu sends nothing),". In the same paragraph, change "signed in, the header shows the avatar, a link to `/app`, and the homepage's and the tool page's "Sign in with Google" button becomes "Open your dashboard", with no new event" to "signed in, the header shows the avatar, a link to `/app`, the homepage's and the tool page's "Sign in with Google" button becomes "Open your dashboard", and the tool page's "Home" link above its title becomes "Back to your account", to `/app`, with no new event". In README.md:115, after "the sidebar's "Support Stillstats" link" add ", the same item in the header's Menu below 48rem, which also sends `sidebar`,". In README.md:116, change "beside the sidebar's "Support Stillstats" link" to "beside the "Support Stillstats" link in the sidebar or in the header's Menu below 48rem".

**Remediation brief**
- **Design intent:** The README's analytics section is the one list of every event and every surface that sends it; the privacy policy's analytics sentence and OpenPanel reports are checked against it. The site's events are in the paragraph at :148, the web app's in the list that runs through :120. The README is a developer document, not shipped copy, so it needs no approval, but it carries no em-dash either.
- **Full surface:** `README.md:115`, `README.md:116`, `README.md:148`. The facts come from `apps/site/src/site-nav.ts:9-26` (the four `link` values), `apps/site/partials/header.html` (the wide list, the Extensions menu and the Menu panel all carry `data-nav-link`), `apps/site/src/main.ts:82-108` (the back link swap), and `apps/web/src/App.tsx:609-618` (the panel's support handlers send `supportOpenedEvent('sidebar')` and the dismissal event).
- **Must preserve:** README.md:114, :117 and :119 as they are (already correct for the Menu); the rest of the :148 paragraph's event list and its ADR 0007 sentence.
- **Do not touch:** the decision that the panel's `support_opened` and `whats_new_opened` keep `sidebar` (a #891 assumption, with a proposal in `.epic-loop/tickets/891/proposals.md`); document it, do not change the code.
- **Proof:** `git grep -n site_nav_clicked README.md` prints a line (prints nothing now); `grep -n "header's Menu" README.md` lists :114, :115, :116, :117 and :119.

### 2. The support item's base rule lays out a row that no longer renders, and a test pins its `baseline` — LOW

- **Location:** `apps/web/src/app.css:2461-2468`, `apps/web/test/web.test.ts:851`
- **Attribution:** pre-existing, exposed. The base rule is unchanged from `$BASE` (`git show 269d4c8b:apps/web/src/app.css` lines 2473-2478 hold the same `display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.25rem 0.75rem`), and so is the assertion (`$BASE` web.test.ts:799). `88226db7` removed the row layout below the column, the rule's one surface that used `baseline`, and rewrote the comment above it to say "below the column, in the header's Menu panel" while the unscoped rule also styles the column.
- **Real-world trigger:** none for a user; the rendered result is correct. A maintainer who changes the base `align-items`, trusting the comment and the test, gets a red test for a value nothing renders (standard 2: a test asserting what no rule cares about; standard 3: the refactor #891's path walked past).

**Evidence**

```css
/* The support item: below the column, in the header's Menu panel, the Hide control a plain text
   button on the support link's row. No badge, count, transition or animation (ADR 0011). */
.sidebar-support {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.25rem 0.75rem;
}
```

`.header-menu-panel .sidebar-support { align-items: center; ... }` (app.css:2572) overrides it in the panel, and the column's media block sets `.sidebar-support { flex-wrap: nowrap; align-items: center; gap: 0.25rem; }` (app.css:2734). `Sidebar.tsx:98` returns null below the column, and the panel renders only below it, so every rendered support item takes `center`.

**Failure mode** — `align-items: baseline` applies to no rendered element, and `expect(valueIn(own, '.sidebar-support', 'align-items')).toBe('baseline')` holds it in place. The comment names one surface for a rule that styles two.

**Recommended fix**

```diff
-/* The support item: below the column, in the header's Menu panel, the Hide control a plain text
-   button on the support link's row. No badge, count, transition or animation (ADR 0011). */
+/* The support item, in the column and in the header's Menu panel: the hide control sits on the
+   support link's row. No badge, count, transition or animation (ADR 0011). */
 .sidebar-support {
   display: flex;
   flex-wrap: wrap;
-  align-items: baseline;
   gap: 0.25rem 0.75rem;
 }
```

```diff
       expect(valueIn(own, '.sidebar-support', 'display')).toBe('flex')
-      expect(valueIn(own, '.sidebar-support', 'align-items')).toBe('baseline')
```

**Remediation brief**
- **Design intent:** Below the sidebar's column (`sidebarColumnQuery`, `apps/web/src/sidebar-column.ts`) the sidebar renders nothing and the header's Menu panel holds the support item; from the column up the column's footer holds it. The CSS media block and the JS query use the same string, which `web.test.ts` holds equal. Each surface sets its own `align-items: center`, so the base rule needs only what both share: `display: flex`, the wrap and the gap the panel uses (the column overrides the gap).
- **Full surface:** `apps/web/src/app.css:2461-2468` (comment and base rule), `apps/web/test/web.test.ts:851` (the `baseline` assertion). The filter at web.test.ts:860-876 allows `baseline` or `center` and needs no change.
- **Must preserve:** `display: flex` and `gap: 0.25rem 0.75rem` on the base rule (the panel's row spacing comes from it); `flex-wrap: wrap` on the base rule (declared kept, since a narrow panel may need it); `.header-menu-panel .sidebar-support { align-items: center }` (app.css:2572) and the column's `.sidebar-support` media rule (app.css:2734); web.test.ts's test "the support item's hide button sits on the link's row..." (web.test.ts:843) with its other assertions; the browser walk's `sidebarSupportItem` checks at 375px and 1280px.
- **Do not touch:** the panel's support markup in `apps/web/src/HeaderMenu.tsx` and its reuse of `.sidebar-support` (a #891 assumption; the class rename is a known lane LOW, F3.12).
- **Proof:** `pnpm exec vitest run apps/web/test/web.test.ts` green after the change, and `pnpm test:browser` green (the walk's support-row steps measure the rendered row at both widths). Before the fix, deleting only the CSS line turns web.test.ts:851 red, which is the pin this finding removes.

### 3. Comment hygiene — LOW (aggregated)

- `apps/web/src/app.css:2393-2395` — "Below the tablet width they stack, the sidebar's links in a row under the header with no menu button; from it the sidebar is a column" → "Below the tablet width the sidebar renders nothing and the header's Menu holds its items (creator-analytics issue 891); from it the sidebar is a column"
- `apps/web/src/sidebar-column.ts:8-11` — "\"Thumbnail preview\" now sits in the list (creator-analytics issue 890), where rows are 0.25rem apart instead of the footer's 1rem, so the rows take less and 36rem still holds; the walk's minimum height step proves it. A phone held sideways, about 340px tall, keeps the header, with its Menu (creator-analytics issue 891). The sidebar reads it ..." (narrates the change, and line 11 runs to 146 columns) → "\"Thumbnail preview\" sits in the list (creator-analytics issue 890), where rows are 0.25rem apart rather than the footer's 1rem, so the rows take less than that and 36rem still holds; the walk's minimum height step proves it. A phone held sideways, about 340px tall, keeps the header, with its Menu (creator-analytics issue 891)." wrapped at 100 columns, then "The sidebar reads it through matchMedia, ..." on its own wrapped lines
- `apps/site/src/main.ts:30-31` — "A click before the settings land still sends its event, and the link never waits on it." → "A click on a new-tab link before the settings land still sends its event, and no link waits on it; a click on the same-tab \"Thumbnail preview\" link before then can unload the page first, and its event is lost." (copied from `signIn`, which awaits a fetch before it navigates; the nav's same-tab link does not)
- `apps/web/src/app.test.ts:5745` — "(creator-analytics#891 review pass 1 finding 1)" → drop the parenthesis, keep the reason
- `apps/web/src/app.test.ts:5767` — "(review pass 2 finding 1)" → drop the parenthesis, keep the reason
- `apps/web/test/web.test.ts:859` — "(review pass 1 finding 2)" → drop the parenthesis, keep the reason
- `apps/site/test/screenshot/browser-walk.ts:5672` — "(review pass 1 finding 1: in the row, ..." → keep the reason, drop "review pass 1 finding 1"
- `apps/web/test/web.test.ts:745` — the test name "... 36rem with the four items of the list, two channels, ..." → "... 36rem with the list's items, two channels, ..." (nothing in the test counts four items; its assertion is unchanged from `$BASE`)

## Needs Further Investigation

### A. On iOS Safari a tap on page text may not close the site's Menu panel — confirm on an iPhone

`apps/site/src/site-nav.ts:88-97` closes an open menu from a `click` listener on `document`. WebKit on iOS does not fire `click` for a tap on a non-interactive element without a `cursor: pointer` or its own handler, so a tap on a paragraph may leave the panel open. Confirm: on an iPhone, open the homepage, press Menu, tap body text. If the panel stays open, the fix is a `pointerdown` listener, as the web app's `HeaderMenu` uses. Kill: the panel closes.

### B. A menu left open comes back open from the back-forward cache — confirm in Chrome at 375px

Open the homepage's Menu panel, tap "Thumbnail preview" (same tab), press Back. `apps/site/src/main.ts:169` re-reads the session on a persisted `pageshow` but does not close the navigation's disclosures, so the panel may be restored open with `aria-expanded="true"`. Confirm with that sequence in Chrome's device mode or a phone; the fix would close every disclosure on a persisted `pageshow`.

### C. Escape in the account menu while the web app's Menu panel is open may move focus to the Menu button

`apps/web/src/HeaderMenu.tsx` listens for Escape on `document` while the panel is open (a known lane LOW, #891 F3.4). With the panel open, Tab to the avatar, open the account menu, press Escape: Base UI returns focus to the avatar, and the panel's listener also calls `button.current?.focus()`. Which one lands last decides focus. Confirm with that sequence at 375px; this would raise F3.4's reach.

### D. The site's menus share `z-index: 10` with the tool's sticky toolbar

`.site-nav-menu, .site-nav-panel` (apps/site/src/styles.css:90) and `.t-toolbar` (`packages/thumbnail-preview/src/styles.css:329`) are both at 10, and the toolbar comes later in the page, so it paints over a menu where they overlap. The estimate is no overlap at rest (panel bottom about 317px, toolbar top about 390px at 375px). Confirm at 375px with 200% text zoom on the tool page, Menu open.

### E. The web app's Menu panel survives a consent screen open

`App.tsx:605` hides the header behind a consent screen without unmounting it, so `HeaderMenu`'s `open` state survives and the panel returns open. Confirm whether a consent request can arrive with the panel open.

## Reviewed and Dismissed

- The open sidebar's "Thumbnail preview" row overflows its 14rem column — measured in Chrome: Switzer at 17px, text 146.5px, external link icon 194.5 to 208.5 against a link right edge of 219, so the icon sits 10.48px inside the link; the row overruns the content box by 1.5px into the link's 12px padding. No clip, no scroll. Do not add `overflow` or truncation to `.sidebar-tool`.
- The full-width tool page breaks focus mode — `:where(body:has(> main.tool-page)) > .site-header` holds at (0,1,1); the built CSS keeps a plain list, and focus mode's `.t-focus-locked .t-focus-host` (0,2,0) wins.
- The nav's Escape fights the tool's focus-mode Escape — focus mode hides and inerts the header, a menu cannot be open as focus mode starts (the press closes it as an outside click), and neither handler stops propagation.
- The back link swap races the nav script — both run in one chunk, `startSiteNav` never touches the back link, and `pointBackLinks` edits the same node in place.
- The busy column shows the wrong number of places — 3 route places plus 1 tool place match the four items of the landed nav.
- A stale reference to the removed row or `.sidebar-quiet` — none in source, tests or CSS beyond the app.css comment in finding 3.
- `tool_link_clicked` carries the wrong `source` — `sidebar` in the column, `menu` in the panel, both held by app.test.ts.
- Hiding support in the panel and then widening the window brings it back — `hideSupport` is App state, so the column also hides it.
- The panel's channel picker closes the panel on an outside press during a pick — it is a native select (`NativeSelect`), so nothing is portalled.
- The walk's steps from the four tickets leak state — each navigates fresh or restores the viewport in `finally`, and both Menu steps close their panel and reset the second channel. The press-outside point (8, 600) sits in #889's 2rem gutter, outside every control.
- Release note naming — "the Studio extension" matches 2026.11.11.1 and 2026.11.11.3.

## Minor / nits

- The column's and the panel's `nav` is named "Channel screens" (`sidebarLabel`, approved in creator-analytics#328) and now holds the external "Thumbnail preview" link, as #890 placed it in the main list. A landmark name such as "Screens and tools" would be Nick's copy call, not a remediation item.
- The busy column's fourth place (`apps/web/src/Sidebar.tsx:183`) is held by no test; a nav item added without a place would shift the list on load.
- `apps/web/src/account-menu.test.ts:40-44` — the added `'menu'` expectation cannot fail at runtime (`toolLinkClickedEvent` passes `source` through; only `tsc` holds the union). app.test.ts's "a click on Thumbnail preview sends tool_link_clicked from the menu" holds the behaviour.
- The privacy policy changed without a release note line; 2026.11.12, 2026.11.12.1 and 2026.11.17 each carry a "The [Privacy Policy](...) now says ..." line. Nick's call at the PR review, with the other pending copy.
- `apps/site/privacy.html:241` is a 138-column source line among ~95-column neighbours. `apps/web/src/sidebar.ts:95` (133) and `apps/web/src/support.ts:15` (124) run past biome's 100-column width in comments.
- The browser walk: the open sidebar's tool row check (browser-walk.ts:2008-2019) cannot see an overflow (a blockified span reports one client rect, and `visibility` stays `visible` past the edge); the signed-out back link step throws a misleading error when the signed-in step failed for that mode (browser-walk.ts:982-985); #889's width step never measures the header's right gutter (browser-walk.ts:1020-1054); the "is the header's link" predicate cannot tell the wide list from the panel (browser-walk.ts:1141-1146, use `this.closest('.site-nav-list')`); `stub.listSecondChannel(true)` and the viewport override sit before `try` (browser-walk.ts:5694-5695); `sidebarSupportItem`'s error text still says "The sidebar's" when run on the panel (browser-walk.ts:611); three steps hard-code `width < 768` rather than `sidebarColumnQuery` (browser-walk.ts:4773, 4941, 5062).
- Focus falls to the body when the window crosses the column query with a panel link focused (the header or the sidebar unmounts); the old row had the same loss in one direction.
- Below the column the Menu button shows once the session lands and goes again when a no-channel answer arrives, as the old row did.
- The lanes' open LOW findings stand as recorded in `.epic-loop/tickets/<n>/report.md`: #888 F2.1 to F2.14, #889 F1.1 to F1.8, #890 F1.1 to F1.9 (F1.9 is resolved by #891), #891 F3.1 to F3.14. This review confirmed #891 F3.3 (a short wide window takes the Menu, now also pinned by the walk's minimum height step at browser-walk.ts:2522-2537, which a fix must change in the same commit), F3.8 (dead header row picker, `Header.tsx:114`) and F3.9 still present, with no wider reach found.

## Test quality

Tests added or changed: 79 · green against `$BASE`: 6 · tautology shapes found: 2.

- Green at base, kept: app.test.ts "%s, the header holds the wait with its avatar placeholder, and no sidebar or Menu shows" (2 instances) and "a creator with no channel has no Menu button" are absence guards that can go red at HEAD; sidebar.test.ts "opens the tool page in a new tab..." changed only its argument.
- Green at base, weak: account-menu.test.ts's `'menu'` expectation (Minor); web.test.ts:745 changed only its name and comment (finding 3).
- `apps/site/src/site-nav.test.ts:183-189` "the wordmark and the avatar place track nothing" clicks only the wordmark, through `wordmark?.click()`, so a missed selector passes it (the lane's #888 F2.10; strengthen with a throw on a missing wordmark and a click on the avatar place).
- `apps/site/test/site.test.ts:1695` asserts the literal "Home" rather than `homeBackLinkText` from `apps/site/src/signed-in.ts` (the lane's #889 F1.2).
- `apps/site/test/site.test.ts:1468-1485` holds privacy sentences by regex, a copy test by standard 2 that the #888 ticket's criterion asks for (the lane's #888 F2.7, recorded for Nick).
- No snapshots, no mocked unit under test, no assertion-free test.

## Before opening the PR

- **CI readiness:** lint, typecheck, build and the suite are green at `3f00d864`; the browser walk is green locally.
- **Commit hygiene:** nothing uncommitted; this doc is the only addition.
- **Likely reviewer asks:** the copy reserved for Nick's word-for-word approval at the PR review: the navigation's accessible name "Site"; the privacy policy's analytics sentence and its "Last updated November 18, 2026"; the three release note lines in `packages/releases/notes/2026.11.17.1.md` (navigation bar, full-width tool page, phone Menu); the channel picker as a ninth panel item (#891 F3.2); and the lanes' look proposals (footer measure and Menu panel gutter on the full-width tool page).

## Verdict

Ready to open the PR with follow-ups. Zero CRITICAL, HIGH or MEDIUM findings; three LOW (two documentation and stylesheet tidy-ups and one comment hygiene batch), none of which gates the PR. Needs Further Investigation A and B are the two worth a phone check before release, since the site's Menu is the phone's only way to the navigation.
