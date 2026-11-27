# Pre-PR review: creator-analytics#6 Compliance audit application

**Branch:** `creator-analytics-6-compliance-audit` vs `origin/main` (merge-base `20a6c7c2`, "Merge pull request #1059 from nick-vogel/creator-analytics-938-drop-copy-pins")
**Reviewed at:** HEAD `67e7d408` (creator-analytics#6 pre-PR review 4 remediation closure table) + 0 files with uncommitted changes, 0 untracked files, 20 files total, +2054 / −16 (the full `$BASE` surface, review docs 1 to 4 included)
**Delta under review:** since `5aee9948` (creator-analytics#6 Question 3 covers the extension's youtube.com pills as well as Studio), the HEAD that `pre-pr-review-4.md` reviewed: 2 files, +205 / −3. `docs/reviews/creator-analytics-6/pre-pr-review-4.md` is the prior doc (`b2e28b7c` creator-analytics#6 pre-PR review 4, and `67e7d408`, its closure table); the other file is `apps/site/index.html`, changed by `866307a5` (creator-analytics#6 pre-PR review 4 finding 1: the homepage said the extension runs on YouTube Studio only, while the application, the screencast and the privacy policy show it on www.youtube.com when the creator turns it on).
**Reviewed against:** prior review `pre-pr-review-4.md` (findings 1 to 9, Needs Further Investigation A to D, its Approach decisions, Verdict and remediation closure table), finding 1's brief as the intent of `866307a5`, the published pages it must match (`apps/site/privacy.html:112-135`, `apps/extension/src/first-run.ts:10-16`), and the extension code the new sentences describe (`apps/extension/src/manifest.ts`, `youtube-access.ts`, `popup.ts`, `popup-page.ts`, `surfaces/shorts.ts`, `surfaces/feed.ts`, `surfaces/watch-page.ts`, `surfaces/channel-page.ts`, `selectors/lockup.ts`), plus the site build (`apps/site/vite.config.ts`). Epic #6's spec and sub-issues were read in round 1 and are unchanged in scope.
**Date:** 2026-11-24
**Reviewer:** 1 code-review agent + verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| The delta | `git diff 5aee9948 --stat`; `git diff 5aee9948 -- apps/site/index.html` | two paragraphs of the homepage's extension block and one pending-approval marker above them |
| Finding 1's proof | `grep -c "YouTube Studio only" apps/site/index.html`; `grep -c "www.youtube.com" apps/site/index.html` | 0 and 2, as the closure table says |
| Where the extension runs, against the code | Agent read `manifest.ts:57-59` (host permissions Studio and stillstats.com, `optional_host_permissions` www.youtube.com from `youtube-access.ts:9`) and `youtube-access.ts:36` (asked from the popup toggle) | holds: Studio always, www.youtube.com only after the creator turns it on |
| "reads every number ... never from the page" | Agent read `selectors/lockup.ts:29-33` | holds: `viewCountIn` finds YouTube's view count element only to place the pill after it, and parses nothing |
| "beside YouTube's view counts on your own videos" | Agent read `watch-page.ts:8`, `channel-page.ts:15`, `feed.ts:90`, `shorts.ts:42`; `sed -n 38,46p apps/extension/src/surfaces/shorts.ts` | holds on channel pages, watch pages, feed, search and the Shorts tab; in the Shorts player there is no YouTube view count, and the pill sits under the channel name (finding 1) |
| The new copy against the privacy policy and the first-run page | `sed -n 112,136p apps/site/privacy.html`; `sed -n 1,30p apps/extension/src/first-run.ts` | no claim stronger than either; both name the toggle "Show engaged views on youtube.com", the homepage says only "turn it on" (finding 1) |
| Old copy anywhere else | `git grep -n -i "studio only\|never from the studio page\|three places in YouTube Studio" -- apps packages docs ':!docs/reviews'` | only `apps/extension/test/manifest.test.ts:363` and ADRs 0008 and 0016, all dismissed in round 4 |
| Meta description and structured data | `grep -n -i "meta\|ld+json" apps/site/index.html`; agent read `apps/site/vite.config.ts:237-249` | `index.html:6` names no extension behaviour; the JSON-LD extension node has no description |
| The pending marker in the build | Agent read `apps/site/vite.config.ts:33` (`/<!-- include (\S+) -->/g`) and searched for minify or comment stripping | the marker does not match the include pattern and passes through; markers at `index.html:14` and `:224` already ship the same way |
| Pending markers | `grep -n "Pending Nick" apps/site/index.html` | lines 14, 67 and 224 |
| Em-dashes in the delta | `git diff 5aee9948 -- apps \| grep -c $'—'` | 0 |
| Shot 1 and Section 3 | `sed -n 253p docs/audit-application.md`; `sed -n 53p docs/audit-application.md` | shot 1 names the heading only, which is unchanged; Section 3 already says www.youtube.com |
| Round 4's LOW findings 2 to 9 and items A to D | Re-ran each one's proof: `grep -c "each of the creator's own videos" docs/audit-application/policy-questions.md` (2), `grep -c "show no number" docs/audit-application.md` (1), `grep -c "emailAddress\|refuseEmailAddress" packages/releases/src/read-release-content.ts` (0), the lookahead at `apps/site/test/site.test.ts:355`, `grep -n legal-updated apps/site/privacy.html` (line 12, November 19), `grep -c "OpenPanel\|GlitchTip"` on the architecture SVG (0), `grep -n "GAP #975"` on the PDF source (none), `grep -n monthly` and `grep -n "every app table"` on the SVGs (none) | all still stand; the delta touched no file they name |
| `pnpm install --frozen-lockfile` | at HEAD | done, lockfile unchanged |
| `pnpm lint` | `biome check .` at HEAD | exit 0, 865 files |
| Site suite | `pnpm exec vitest run apps/site/test/site.test.ts` | 105 passed |
| Phase 4.5 test audit | | the delta adds no test |
| Typecheck, build, full `pnpm test`, browser walk | Not run: the delta is two paragraphs of static HTML copy and a review doc, and touches no code, test or build input; the site suite builds every page | not run |
| Which extension version the stores serve | Not readable from the repo | not run (item D) |

**Overall:** round 4's MEDIUM is fixed against its intent. The homepage now says the extension runs on YouTube Studio, and on www.youtube.com only when the creator turns that on, it reads no number from the page, and it says nothing stronger than the privacy policy or the first-run page. The new sentence brings one LOW precision point: the Shorts player has no YouTube view count for the pill to sit beside, and the sentence does not name the toggle the policy names. The remaining eight LOWs are round 4's tail, unchanged. Nothing blocks the PR.

## Approach decisions
- A statement about the product to Google mirrors the published page that already makes it, and a published surface makes no claim stronger than the privacy policy's, nor weaker than what the application shows the reviewer. Carried forward from rounds 1 and 4.
- Changed published copy carries `<!-- Pending Nick's word-for-word approval, creator-analytics#6. -->` above it, as `apps/site/index.html:14`, `:67` and `:224` do. Carried forward; finding 1 changes copy already under the `:67` marker, so it adds none.
- What the screencast says the retention player does mirrors question 5's "Now" in `docs/audit-application/policy-questions.md`. Carried forward.
- A diagram change is made in the SVG and the PNG is regenerated with `node docs/audit-application/build-diagrams.ts`, never edited by hand. A diagram box keeps its 220-pixel width. Carried forward.
- The policy questions PDF is rebuilt with `node docs/audit-application/build-policy-questions-pdf.ts` after any change to its source, never edited by hand. Carried forward.
- Section 3's stated length is the `node` count of the text between the fences without its trailing line break. Carried forward.
- When production behaviour falsifies a true-in-code claim, the product is fixed in the repo rather than the claim softened, with the narrowest in-repo control (`<!--email_off-->` markers). Carried forward.

## Confirmed Issues
### 1. The homepage's new sentence puts the pill "beside YouTube's view counts" in the Shorts player too, which shows none, and does not name the toggle — LOW
- **Location:** `apps/site/index.html:71-72`
- **Attribution:** introduced, by `866307a5` (creator-analytics#6 pre-PR review 4 finding 1: ...), round 4's recommended diff applied word for word. `git show 5aee9948:apps/site/index.html | grep -c "beside"` prints 0. It is the homepage twin of round 4's finding 2 ("beside YouTube's own figures" in question 3's "On a no"), carried into a new surface by the fix; one instance, not the fix-begets-finding pattern.
- **Real-world trigger:** Google's reviewer reads the homepage from the form, then watches shot 44, where a Short in the Shorts player shows the pill under the channel name with no YouTube view count beside it. LOW: the sentence is true on every other www.youtube.com surface, and the screencast shows the real behaviour.
**Evidence** —
```
apps/site/index.html:71            analytics page. If you turn it on in the extension's popup, it also shows them beside
apps/site/index.html:72            YouTube's view counts on your own videos on www.youtube.com.
apps/extension/src/surfaces/shorts.ts:42  * The creator's Shorts on youtube.com: the engaged views pill after YouTube's view count on each
apps/extension/src/surfaces/shorts.ts:43  * Short of a channel's Shorts tab, and under the channel name in the Shorts player, which shows no
apps/extension/src/surfaces/shorts.ts:44  * view count, for each Short among the creator's uploads (`publicPageReads`).
apps/site/privacy.html:129         If you turn on "Show engaged views on youtube.com" in the extension's popup, the extension
```
**Failure mode** — in the Shorts player the pill sits under the channel name, because YouTube shows no view count there, so "beside YouTube's view counts" is not literally true of every surface the sentence covers. "If you turn it on" reads as turning the extension on, where the privacy policy (`privacy.html:129`) and the first-run page (`first-run.ts:14`) name the setting, "Show engaged views on youtube.com", that the screencast shows in shot 40.
**Recommended fix** —
```diff
--- apps/site/index.html:69-73
             The free Stillstats extension for Chrome and Firefox shows your engaged views in three
             places in YouTube Studio: the latest video card, the Content list, and each video's
-            analytics page. If you turn it on in the extension's popup, it also shows them beside
-            YouTube's view counts on your own videos on www.youtube.com.
+            analytics page. If you turn on "Show engaged views on youtube.com" in the extension's
+            popup, it also shows them on your own videos on www.youtube.com, beside what YouTube shows.
           </p>
```
The words are a recommendation for Nick, who approves site copy word for word; the facts they must carry are in Design intent.
**Remediation brief**
- **Design intent:** the homepage's extension block is the public description of the extension that the screencast records in shot 1 and the reviewer opens from the form. It says where the extension runs (Studio always, www.youtube.com only after the creator turns on "Show engaged views on youtube.com" in the popup), that its figures sit beside YouTube's and never in place of them, and that it reads no number from the page, and it says no more than `apps/site/privacy.html:129-135` and `apps/extension/src/first-run.ts:14`.
- **Full surface:** `apps/site/index.html:71-72`, already under the pending marker at `:67`. No site test pins the block's text (`apps/site/test/site.test.ts:1082-1105` checks only the block's position and store links). Shot 1 (`docs/audit-application.md:253`) quotes only the heading, so it needs no change.
- **Must preserve:** the marker at `:67`; the second paragraph (`:74-77`) word for word; `id="extension"`, `id="extension-heading"` and the heading's text; the "Add to Chrome" and "Add to Firefox" links and their include comments; one paragraph per `<p>`; no em-dash; `pnpm exec vitest run apps/site/test/site.test.ts`, which builds every page and holds the em-dash and address rules; `pnpm exec biome check apps/site/index.html`.
- **Do not touch:** the second paragraph's "never from the page" and "runs on YouTube Studio, and on www.youtube.com only when you turn that on", both dismissed below; the first-run page's text, approved word for word in #97, #202 and #485.
- **Failure of the fix:** Nick may reword it. Whatever the words, the proof below must hold, and the marker stays until he approves.
- **Proof:** `grep -c "beside YouTube's view counts" apps/site/index.html` prints 0 (1 at HEAD); `grep -c "Show engaged views on youtube.com" apps/site/index.html` prints 1 (0 at HEAD); `pnpm exec vitest run apps/site/test/site.test.ts` passes.

### 2. Question 3 and shot 42 say slightly more than the code: "each" of the creator's videos, "beside YouTube's own figures" in the Shorts player, an ambiguous "it", and "show no number" — LOW
Round 4's finding 2, untouched (`grep -c "each of the creator's own videos" docs/audit-application/policy-questions.md` prints 2, at `:44` and `:46`; `grep -c "show no number" docs/audit-application.md` prints 1). The brief in `pre-pr-review-4.md` finding 2 stands: the four sentence changes at `docs/audit-application/policy-questions.md:44`, `:46`, `:48` and `docs/audit-application.md:294`, then `node docs/audit-application/build-policy-questions-pdf.ts`. Its `:48` change ("beside what YouTube shows, never in place of YouTube's figures") and finding 1's homepage wording carry the same fact and can be approved together.

### 3. The new address rule never sees the committed release notes, and a release note cannot carry Cloudflare's markers — LOW
Round 3's finding 1, round 4's finding 3, untouched (`grep -c "emailAddress\|refuseEmailAddress" packages/releases/src/read-release-content.ts` prints 0). The brief in `pre-pr-review-3.md` finding 1 stands.

### 4. The address rule's srcset exclusion also skips a real address whose domain starts with digits and an x, such as `hi@10x.dev` — LOW
Round 3's finding 2, round 4's finding 4, untouched. The lookahead is at `apps/site/test/site.test.ts:355` (`(?!\d+(?:\.\d+)?x\.)`). The brief in `pre-pr-review-3.md` finding 2 stands.

### 5. The privacy policy still says "Last updated November 19, 2026", while this branch changes what it says about sharing twice — LOW
Round 3's finding 3, round 4's finding 5, untouched (`grep -n legal-updated apps/site/privacy.html` prints line 12, November 19). The merge owner's, in the PR's last commit before merge, as `17ade8fc` did. The homepage has no date line, so finding 1 adds nothing here.

### 6. The architecture diagram leaves out three outward data flows the privacy policy names: product analytics, error reports, and YouTube's player and thumbnails — LOW
Round 2's finding 3, untouched (`grep -c "OpenPanel\|GlitchTip" docs/audit-application/stillstats-architecture-diagram.svg` prints 0). The brief in `pre-pr-review-2.md` finding 3 stands.

### 7. The screencast's link goes in "Special Instructions for Access", while the form asks for it in Section 6's "Other Supporting Materials" — LOW
Round 2's finding 4, untouched (`grep -n "GAP #975" docs/audit-application/policy-questions.md` prints nothing). The brief in `pre-pr-review-2.md` finding 4 stands.

### 8. Two diagram labels say more than the code does: every Pro video's retention curve downloaded every day, and row-level security "on every table, job queue" — LOW
Round 2's finding 5, untouched. The brief in `pre-pr-review-2.md` finding 5 stands.

### 9. Comment hygiene — LOW (aggregated)
Round 4's finding 9, unchanged; every entry stands as written in `pre-pr-review-4.md` finding 9 (`apps/site/privacy.html:95`, `apps/site/test/site.test.ts:345-346`, `:1465-1467`, `:1594-1597`, `docs/audit-application.md:156`).

## Needs Further Investigation
### A. The upgrade screen's "within 6 hours" (`apps/web/src/upgrade.ts:84`) against 24 hours elsewhere and the retention engine's 12-hour alarm. Unchanged from round 4: ask whether 6 hours was meant as a promise.
### B. The user-flow diagram and shot 5 name two scopes, while the connect consent also asks for `openid` and `email` (`apps/api/src/connect.test.ts:46`). Unchanged: check Google's consent screen in #975's take.
### C. Other Cloudflare HTML rewrites on production, which "Before recording" item 2's `cdn-cgi` count does not catch. Unchanged: a dashboard check, or add `grep -c cloudflareinsights` printing 0.
### D. Question 3's "Now. Live." and shots 35 and 40 assume the store builds carry the "Show engaged views on youtube.com" toggle (ADR 0016). The homepage's new sentences now assume it too. Before the take, compare the Chrome Web Store and AMO versions with the first release that holds the toggle.

## Reviewed and Dismissed
- "It reads every number from your Stillstats account, never from the page" (`apps/site/index.html:75`) — true on both sites: `selectors/lockup.ts:29-33` only locates YouTube's view count element to place the pill, and the privacy policy says "It reads no number from the page". "the page" reads as whichever page the extension is on.
- "it runs on YouTube Studio, and on www.youtube.com only when you turn that on" (`:75-76`) — true: only `entrypoints/studio.content.ts` and `entrypoints/youtube.content.ts` exist; stillstats.com is a host the extension talks to, not a page it runs on, and the old copy had the same shape.
- The pending marker reaching production HTML — the include pattern at `apps/site/vite.config.ts:33` does not match it, and the markers at `:14` and `:224` already ship; Nick's convention, carried forward.
- The heading "See your engaged views inside YouTube Studio" — narrower than the block now, but not false, and shot 1's narration names it; kept by round 4's brief.
- The homepage not naming the browser's access prompt — the popup says it (`apps/extension/src/popup.ts:20`), and the privacy policy does not name it either, so the homepage is not weaker than the policy.
- Round 4's dismissals stand (`apps/extension/test/manifest.test.ts:363`, ADR 0008's title, the store short description at `manifest.ts:55-56`, the PDF, and rounds 2 and 3's lists).

## Minor / nits
- Round 4's Minor list stands unchanged.

## Test quality
The delta adds no test. No site test pins the extension block's text, by #938's choice to drop copy pins; the site suite passes at HEAD (105).

## Prior-review closure
Against `pre-pr-review-4.md` (HEAD `5aee9948`):
- **Fully fixed: 1.** Finding 1 (MEDIUM), by `866307a5`: the homepage no longer says "runs on YouTube Studio only", and says where the extension runs as the privacy policy does. Verified against its intent, not just its proof greps.
- **Partially fixed: 0.**
- **Untouched: 8**, all LOW: findings 2 to 9, deferred by the round's default scope as the closure table records, re-emitted here as 2 to 9. Items A to D stay open.
- **Resolved only by editing a comment or doc:** none; finding 1's fix is published copy, which is what it indicted.
- Not the fix-begets-finding pattern: finding 1 here is one LOW precision point in the fix's new sentence, the same point round 4 already made about question 3.

## Before opening the PR
- **CI readiness:** `pnpm lint` exits 0 and the site suite passes (105) at HEAD. The delta touches no code, so typecheck, build and the full `pnpm test` were not run this round.
- **Commit hygiene:** the tree was clean at review time.
- **Copy approval:** the homepage's extension paragraphs (finding 1's wording included) join the lede, the refusals item, the privacy policy's extension sentence, the disclosure line and #970's paragraph in waiting for Nick's word-for-word approval.
- **Merge day:** move the privacy policy's "Last updated" line to the merge day (finding 5).
- **Likely reviewer asks:** why the release notes don't share the address rule (finding 3); why the policy's date is older than its text (finding 5).

## Verdict
Ready to open the PR, with follow-ups. Round 4's one MEDIUM is fixed: the homepage now says the extension runs on Studio, and on www.youtube.com only when the creator turns that on, matching the privacy policy, question 3 and the screencast. No MEDIUM or higher finding remains. The nine LOWs can ship as follow-ups or ride in Nick's copy pass: finding 1 (the new sentence's Shorts player and toggle wording) and finding 2 (question 3's precision) carry the same fact and are best approved together. The count went from 1 MEDIUM and 9 LOW to 0 MEDIUM and 9 LOW, the one new LOW from the fix's own sentence replacing the closed MEDIUM; the list is shrinking toward copy precision, which is convergence, not a branch failing to improve.
