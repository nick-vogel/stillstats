# Pre-PR review: creator-analytics#6 Compliance audit application

**Branch:** `creator-analytics-6-compliance-audit` vs `origin/main` (merge-base `20a6c7c2`, "Merge pull request #1059 from nick-vogel/creator-analytics-938-drop-copy-pins")
**Reviewed at:** HEAD `5aee9948` (creator-analytics#6 Question 3 covers the extension's youtube.com pills as well as Studio) + 0 files with uncommitted changes, 0 untracked files, 19 files total, +1849 / −13 (the full `$BASE` surface, review docs 1 to 3 included)
**Delta under review:** since `01964ec7` (creator-analytics#6 pre-PR review 2 remediation closure table), the HEAD that `pre-pr-review-3.md` reviewed: 4 files, +193 / −6, of which `docs/reviews/creator-analytics-6/pre-pr-review-3.md` (`9035426e`, creator-analytics#6 pre-PR review 3) is the prior doc and the other 3 are `5aee9948`, the fix for the run's proposal 7 (question 3 covers the youtube.com pills as well as Studio): `docs/audit-application/policy-questions.md`, `docs/audit-application.md`, `docs/audit-application/policy-questions.pdf`.
**Reviewed against:** prior review `pre-pr-review-3.md` (findings 1 to 7, Needs Further Investigation A to C, its Approach decisions and Verdict; no remediation ran after it, the round converged), the run's close-out decision 2 (proposal 7: "question 3 covers the youtube.com pills as well as Studio"), `docs/adr/0016-studio-by-default-www-youtube-com-on-request.md`, and the extension code the new question 3 text describes (`apps/extension/src/manifest.ts`, `entrypoints/youtube.content.ts`, `popup.ts`, `popup-page.ts`, `youtube-access.ts`, `surfaces/youtube-surfaces.ts`, `surfaces/feed.ts`, `surfaces/states.ts`, `surfaces/youtube-url.ts`, `surfaces/shorts.ts`, `surfaces/public-pages.ts`, `surfaces/watch-page.ts`, `selectors/feed.ts`), plus the published pages it must match (`apps/site/index.html`, `apps/site/privacy.html`). Epic #6's spec and sub-issues were read in round 1 and are unchanged in scope.
**Date:** 2026-11-24
**Reviewer:** 1 code-review agent + verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| The delta | `git diff 01964ec7 --stat`; `git diff 9035426e 5aee9948 -- . ':!*.pdf'` | question 3's title, Feature, Now and On a no; the two draft table rows; the PDF |
| Question 3's facts against the extension (a to h) | Agent read the extension sources named above and `apps/extension/test/manifest.test.ts:106-127`, `popup.test.ts:37` | (a) off by default: `www.youtube.com` only in `optional_host_permissions` (`manifest.ts:63`), the content script `registration: 'runtime'`; (b) the permission is asked in the popup's gesture (`popup-page.ts:54-55`), the same in the Chrome and Firefox builds; (c) channel pages, watch pages, feed, search and the Shorts tab hold, but "each" does not (finding 2); (d) under the channel name in the Shorts player (`shorts.ts:42-44`); (e) other channels get no pill (`public-pages.ts` `pillsOn`, `feed.ts` `takeDownAllBut`); (f) pills are inserted after YouTube's element, nothing of YouTube's is hidden; (g) every figure from the product API, never from the page (`youtube-url.ts:5`); (h) the Studio half unchanged in meaning |
| "each" in the Now paragraph | `grep -rn "awaitingProcessing) return" apps/extension/src`; `grep -rn "Shorts shelf" apps/extension/src`; `sed -n 12p apps/extension/src/surfaces/youtube-url.ts` | `states.ts:125` gives a video awaiting processing no pill; `feed.ts:94` and `selectors/feed.ts:30` skip a Shorts shelf's tiles; `channelTabPath` covers Home, Videos and Live only, the Shorts tab is separate, Playlists and Posts get none (finding 2) |
| Shots 37 and 40 to 44 against the new table row | `sed -n '289,296p' docs/audit-application.md` | match: off by default and Chrome's request (40), pills next to YouTube's view counts (41 to 43), only my own videos (42, 43), Shorts and the toggle off (44); shot 42's "show no number" reads as hiding YouTube's count (finding 2) |
| The old title anywhere | `git grep -n "in place of a Studio number"` | none |
| The PDF is the source | Scratch worktree at `5aee9948` under the scratchpad, node_modules linked, `node docs/audit-application/build-policy-questions-pdf.ts`, `pdftotext` of both PDFs, `diff` | exit 0, text identical, 5 pages; worktree removed |
| The PDF names no ADR or issue | `pdftotext docs/audit-application/policy-questions.pdf - \| grep -nE "ADR\|#[0-9]"` | none |
| Published pages against the new question 3 | `sed -n '64,76p' apps/site/index.html`; `grep -n "www.youtube.com" apps/site/privacy.html`; `sed -n 53p docs/audit-application.md`; shot 1 at `docs/audit-application.md:253` | the homepage says the extension "runs on YouTube Studio only", against the privacy policy, Section 3, question 3 and shots 40 to 44, and shot 1 records that block (finding 1) |
| Attribution of the homepage line | `git show 20a6c7c2:apps/site/index.html \| grep -n "Studio only"`; `git log --oneline -S"YouTube Studio only" -- apps/site/index.html` | on base at line 72, from `045bba44` (creator-analytics#478 Site: link the Studio extension's store listings from the homepage); the branch never changed it |
| Other "Studio only" surfaces | `git grep -n -i "studio only" -- apps packages docs ':!docs/reviews'` | `apps/extension/test/manifest.test.ts:363` (the one static content script, true) and ADR 0008, amended by ADR 0016 (dismissed) |
| Em-dashes in the delta | `git diff 01964ec7 -- . ':!*.pdf' ':!docs/reviews' \| grep -c $'—'` | 0 |
| Round 3's LOW findings 1 to 7 and items A to C | Re-ran each one's proof grep (`grep -c "OpenPanel\|GlitchTip"` on the architecture SVG, `grep -n "GAP #975"` on the PDF source, `grep -n monthly` and `grep -n "every app table"` on the SVGs, `grep -n legal-updated apps/site/privacy.html`); `git diff 01964ec7 --stat -- apps packages` | all still stand, the delta touched no app or package file; re-emitted as 3 to 9 and A to C |
| `pnpm lint` | `biome check .` at HEAD | exit 0, 865 files |
| Phase 4.5 test audit | | the delta adds no test |
| Typecheck, build, `pnpm test`, browser walk | Not run: the delta is two markdown files and a rebuilt PDF, and touches no code, test or build input | not run |
| Which extension version the stores serve | Not readable from the repo | not run (item D) |

**Overall:** the question 3 fix holds against its intent. Every new sentence about the youtube.com pills is true in the extension's code, the draft's two tables carry the new scope, and the PDF is exactly what its source builds. The review found one MEDIUM that three rounds missed, and it is older than this branch: the homepage says the extension "runs on YouTube Studio only", and the screencast's first shot scrolls through that block before shots 40 to 44 show the extension on www.youtube.com. Fix it before the PR opens, under a pending-approval comment. The rest is LOW: four places in question 3 and shot 42 say slightly more than the code, and round 3's seven LOWs are unchanged.

## Approach decisions
- A statement about the product to Google mirrors the published page that already makes it, and a published surface makes no claim stronger than the privacy policy's. Carried forward. Finding 1 applies it in the other direction: a published page doesn't say less than the application shows the reviewer, here where the extension runs.
- Changed published copy carries `<!-- Pending Nick's word-for-word approval, creator-analytics#6. -->` above it, as `apps/site/index.html:14` and `:222` do. Carried forward from round 2's remediation.
- What the screencast says the retention player does mirrors question 5's "Now" in `docs/audit-application/policy-questions.md`. Carried forward.
- A diagram change is made in the SVG and the PNG is regenerated with `node docs/audit-application/build-diagrams.ts`, never edited by hand. A diagram box keeps its 220-pixel width. Carried forward.
- The policy questions PDF is rebuilt with `node docs/audit-application/build-policy-questions-pdf.ts` after any change to its source, never edited by hand. Carried forward.
- Section 3's stated length is the `node` count of the text between the fences without its trailing line break. Carried forward.
- When production behaviour falsifies a true-in-code claim, the product is fixed in the repo rather than the claim softened, with the narrowest in-repo control (`<!--email_off-->` markers). Carried forward.

## Confirmed Issues
### 1. The homepage says the extension "runs on YouTube Studio only", while the application, the screencast and the privacy policy show it on www.youtube.com too — MEDIUM
- **Location:** `apps/site/index.html:68-74`
- **Attribution:** pre-existing, exposed. The sentence is on `$BASE` (`git show 20a6c7c2:apps/site/index.html | grep -n "Studio only"` prints line 72), written by `045bba44` (creator-analytics#478 Site: link the Studio extension's store listings from the homepage), and was already stale once the youtube.com pills shipped (ADR 0016, `5bca6e2b` creator-analytics#142 Say in the privacy policy what the extension does on www.youtube.com). This branch exposes it: `3d8a3348` (creator-analytics#974 Write the audit screencast shot list) puts the block in shot 1 (`docs/audit-application.md:253`, "Scroll through ... 'See your engaged views inside YouTube Studio'"), the primary website `https://stillstats.com` goes in the form (`docs/audit-application.md:31`, `:81`, `:132`), and Section 3 (`:53`) and now question 3 (`5aee9948`) tell Google the extension runs on www.youtube.com when the creator turns it on. Round 1's finding 3 fixed the same claim in the architecture diagram's extension box and left the homepage.
- **Real-world trigger:** Google's reviewer watches the screencast: shot 1 scrolls past "it runs on YouTube Studio only", and shots 40 to 44 show the extension asking for www.youtube.com and drawing pills there. Or the reviewer opens `https://stillstats.com`, the primary website in the form, beside question 3. Inconsistency between views, so it tops out at MEDIUM; its user path is the audit itself.
**Evidence** —
```
          <h2 id="extension-heading">See your engaged views inside YouTube Studio</h2>
          <p>
            The free Stillstats extension for Chrome and Firefox shows your engaged views in three
            places in YouTube Studio: the latest video card, the Content list, and each video's
            analytics page.
          </p>
          <p>
            It reads every number from your Stillstats account, never from the Studio page, and it
            runs on YouTube Studio only.
          </p>
```
against `apps/site/privacy.html:129-130`, "If you turn on "Show engaged views on youtube.com" in the extension's popup, the extension also works on www.youtube.com", and `apps/extension/src/manifest.ts:63`, which lists `www.youtube.com` in `optional_host_permissions`.
**Failure mode** — the published homepage, recorded in the screencast, says the extension never leaves Studio; the same submission shows it on www.youtube.com. A reviewer checking the app's public description against the application sees a false statement about where the extension runs. The homepage also never says the pills sit beside YouTube's view counts, which question 3's "Now" tells Google, so the youtube.com half of question 3 has no published page behind it.
**Recommended fix** — keep the heading (shot 1's narration names it) and change the two paragraphs, with the pending comment above them:
```diff
--- apps/site/index.html:67-75
           <h2 id="extension-heading">See your engaged views inside YouTube Studio</h2>
+          <!-- Pending Nick's word-for-word approval, creator-analytics#6. -->
           <p>
             The free Stillstats extension for Chrome and Firefox shows your engaged views in three
             places in YouTube Studio: the latest video card, the Content list, and each video's
-            analytics page.
+            analytics page. If you turn it on in the extension's popup, it also shows them beside
+            YouTube's view counts on your own videos on www.youtube.com.
           </p>
           <p>
-            It reads every number from your Stillstats account, never from the Studio page, and it
-            runs on YouTube Studio only.
+            It reads every number from your Stillstats account, never from the page, and it runs on
+            YouTube Studio, and on www.youtube.com only when you turn that on.
           </p>
```
The words are a recommendation for Nick, who approves site copy word for word; the facts they must carry are in Design intent.
**Remediation brief**
- **Design intent:** the homepage's extension block is the public description of the extension that the screencast records in shot 1 and the reviewer can open from the form. It must say where the extension runs (Studio always, www.youtube.com only after the creator turns it on in the popup and allows access), where its figures sit (beside Studio's and YouTube's own, never in place of them), and that it reads no number from the page. It says no more than `apps/site/privacy.html:115-134` and the first-run page (`apps/extension/src/first-run.ts:10-16`) say.
- **Full surface:** `apps/site/index.html:68-74`. Then check shot 1's narration (`docs/audit-application.md:253`), which names the heading and quotes no sentence of the block, and Section 3 (`:53`), which already says youtube.com; neither should need a change. No site test pins this copy (`grep -n "Studio only\|three places" apps/site/test/*.ts` prints nothing; #938 dropped the copy pins).
- **Must preserve:** `id="extension"`, `id="extension-heading"` and the heading's text; the "Add to Chrome" and "Add to Firefox" links at `:77-78`; one paragraph per `<p>`, no em-dash; the site suite (`pnpm exec vitest run apps/site/test/site.test.ts`), which builds every page and holds the em-dash and address rules.
- **Do not touch:** `apps/extension/test/manifest.test.ts:363` ("runs one content script, on Studio only", true of the static script) and ADR 0008's title (amended by ADR 0016, kept as written on purpose), both dismissed below; the Chrome Web Store short description at `apps/extension/src/manifest.ts:55-56`, which is #100's approved text and says nothing false.
- **Failure of the fix:** Nick may reword it. Whatever the words, the proof below must still hold, and the pending comment stays until he approves.
- **Proof:** `grep -c "YouTube Studio only" apps/site/index.html` prints 0 (1 at HEAD); `grep -c "www.youtube.com" apps/site/index.html` prints at least 1 (0 at HEAD); `pnpm exec vitest run apps/site/test/site.test.ts` passes.

### 2. Question 3 and shot 42 say slightly more than the code: "each" of the creator's videos, "beside YouTube's own figures" in the Shorts player, an ambiguous "it", and "show no number" — LOW
- **Location:** `docs/audit-application/policy-questions.md:44`, `:46`, `:48`; `docs/audit-application.md:294`
- **Attribution:** introduced, by `5aee9948` (creator-analytics#6 Question 3 covers the extension's youtube.com pills as well as Studio) for the three `policy-questions.md` lines; shot 42's narration by `3d8a3348` (creator-analytics#974 Write the audit screencast shot list), exposed by question 3, which now asks exactly whether the extension may replace YouTube's view count.
- **Real-world trigger:** a Google reviewer reads question 3 against shots 40 to 44 and finds a Short in a home-feed shelf, a just-uploaded video or the Playlists tab with no pill, or reads shot 42's "Videos from other channels show no number" as the extension hiding YouTube's counts. LOW: each sentence is near-true and the screencast shows the real behaviour.
**Evidence** —
```
policy-questions.md:46  Then each of the creator's own videos gets a pill beside YouTube's view count, on channel pages, watch pages, the home feed, search results and Shorts.
policy-questions.md:48  In Studio and on www.youtube.com, the extension keeps showing engaged views beside YouTube's own figures, never in place of them.
policy-questions.md:44  and, if the creator turns it on, it adds an engaged views pill
audit-application.md:294  Videos from other channels show no number.
apps/extension/src/surfaces/states.ts:125:  if (video.awaitingProcessing) return undefined
apps/extension/src/surfaces/youtube-url.ts:12:const channelTabPath = /^\/(?:@[^/]+|channel\/UC[\w-]{22})(?:\/featured|\/videos|\/streams)?\/?$/
```
**Failure mode** — a video awaiting processing gets no pill (`states.ts:125`); a Shorts shelf's tiles in the feed and in search get none (`surfaces/feed.ts:94`, `selectors/feed.ts:30`); a channel's Playlists and Posts tabs get none (`channelTabPath` covers Home, Videos and Live, `shortsTabPath` the Shorts tab). In the Shorts player there is no YouTube figure for the pill to sit beside, as `:46` itself says. In `:44`, "it" first means the pills setting and then the extension. In shot 42, other channels' videos keep YouTube's view count and get no pill.
**Recommended fix** —
- `docs/audit-application/policy-questions.md:44`: "and, if the creator turns it on, it adds an engaged views pill" → "and, if the creator turns this on in the extension's popup, it adds an engaged views pill".
- `:46`: "Then each of the creator's own videos gets a pill beside YouTube's view count, on channel pages, watch pages, the home feed, search results and Shorts." → "Then the creator's own videos get a pill beside YouTube's view count on the channel's Home, Videos, Live and Shorts tabs, on watch pages, in the home feed and in search results."
- `:48`: "the extension keeps showing engaged views beside YouTube's own figures, never in place of them." → "the extension keeps showing engaged views beside what YouTube shows, never in place of YouTube's figures."
- `docs/audit-application.md:294`: "Videos from other channels show no number." → "Videos from other channels show no pill."
- Rebuild the PDF: `node docs/audit-application/build-policy-questions-pdf.ts`.
**Remediation brief**
- **Design intent:** question 3 tells Google what the extension does today and asks whether it may do more; every "Now" sentence must be true of the code, never broader. The PDF is printed from `policy-questions.md` and the two must match. Shot narration is Nick's to approve before recording (#974's note), so a narration change is a recommendation he reads.
- **Full surface:** `docs/audit-application/policy-questions.md:44`, `:46`, `:48`; `docs/audit-application/policy-questions.pdf` (rebuilt); `docs/audit-application.md:294`. The draft's question 3 rows at `docs/audit-application.md:211` and `:312` keep their text.
- **Must preserve:** the III.I.4 quote at `:42`; the Studio half's sentences; "In the Shorts player, which shows no view count, the pill sits under the channel name."; "Videos from other channels get no pill, and YouTube's view counts stay exactly as YouTube shows them."; "Every number the extension shows comes from the YouTube Analytics API under the creator's own OAuth grant, never from a page in Studio or on www.youtube.com."; no ADR or issue named in the PDF source; no em-dash.
- **Do not touch:** the two questions' form ("May it replace ...?", "may the pill replace ...?"), which reads as a request.
- **Proof:** `pdftotext docs/audit-application/policy-questions.pdf - | grep -c "each of the creator's own videos"` prints 0 (1 at HEAD); `grep -c "show no number" docs/audit-application.md` prints 0 (1 at HEAD); `pdftotext docs/audit-application/policy-questions.pdf - | grep -nE "ADR|#[0-9]"` prints nothing.

### 3. The new address rule never sees the committed release notes, and a release note cannot carry Cloudflare's markers — LOW
Round 3's finding 1, untouched (the delta changed no file under `apps` or `packages`). Attribution, trigger, evidence, recommended fix and brief stand as written in `pre-pr-review-3.md` finding 1: add `emailAddress` and `refuseEmailAddress` beside `refuseEmDash` in `packages/releases/src/read-release-content.ts` (`:120-131`), call it at `:182-183` and `:205-206`, and add the `test.each` pair after `packages/releases/test/release-content.test.ts:363` and `:415`. Proof: `pnpm exec vitest run packages/releases/test/release-content.test.ts -t "email address"` red before, green after.

### 4. The address rule's srcset exclusion also skips a real address whose domain starts with digits and an x, such as `hi@10x.dev` — LOW
Round 3's finding 2, untouched. The brief in `pre-pr-review-3.md` finding 2 stands: narrow the lookahead at `apps/site/test/site.test.ts:354` to `(?!\d+(?:\.\d+)?x\.(?:png|jpe?g|webp|avif|gif|svg)\b)`, the same pattern as finding 3's constant. Proof: its `node -e` one-liner matches `hi@10x.dev`, `a@2x.co.uk` and `abuse@163.com` and prints `null` for `logo@2x.png` and `logo@1.5x.webp`.

### 5. The privacy policy still says "Last updated November 19, 2026", while this branch changes what it says about sharing twice — LOW
Round 3's finding 3, untouched (`grep -n legal-updated apps/site/privacy.html` prints line 12, November 19). The brief in `pre-pr-review-3.md` finding 3 stands: set the line to the merge day in the PR's last commit before merge, as `17ade8fc` did; `apps/site/terms.html` keeps its date. This is the merge owner's, not a remediation round's.

### 6. The architecture diagram leaves out three outward data flows the privacy policy names: product analytics, error reports, and YouTube's player and thumbnails — LOW
Round 2's finding 3, round 3's finding 4, untouched (`grep -c "OpenPanel\|GlitchTip" docs/audit-application/stillstats-architecture-diagram.svg` prints 0). The brief in `pre-pr-review-2.md` finding 3 stands; regenerate the PNG with `node docs/audit-application/build-diagrams.ts`.

### 7. The screencast's link goes in "Special Instructions for Access", while the form asks for it in Section 6's "Other Supporting Materials" — LOW
Round 2's finding 4, round 3's finding 5, untouched (`grep -n "GAP #975" docs/audit-application/policy-questions.md` prints nothing). The brief in `pre-pr-review-2.md` finding 4 stands. Finding 2's PDF rebuild and this one's can share one run of `node docs/audit-application/build-policy-questions-pdf.ts`.

### 8. Two diagram labels say more than the code does: every Pro video's retention curve downloaded every day, and row-level security "on every table, job queue" — LOW
Round 2's finding 5, round 3's finding 6, untouched (`grep -n monthly docs/audit-application/stillstats-user-flow-diagram.svg` and `grep -n "every app table" docs/audit-application/stillstats-architecture-diagram.svg` print nothing). The brief in `pre-pr-review-2.md` finding 5 stands.

### 9. Comment hygiene — LOW (aggregated)
Round 3's finding 7, unchanged; every entry still stands as written there:
- `apps/site/privacy.html:95` — "...and #751's feedback link, which the links sentence covers." → append ", but for the paragraph marked pending, creator-analytics#6."
- `apps/site/test/site.test.ts:345-346` — "...rewrites a bare address and injects its own decode script into the page (production /privacy and /terms, 2026-11-24)." → "...rewrites a bare address and injects its own decode script, which would make the policy's "no third-party script except YouTube's video player" false. The pattern skips an image density name such as `logo@2x.png`."
- `apps/site/test/site.test.ts:1465-1467` — "...and so does the Cloudflare Email Service test (#970), which holds the facts its paragraph names, and so do the reach report tests (#779)" → "...and so do the Cloudflare Email Service test (#970), the reach report tests (#779)".
- `apps/site/test/site.test.ts:1594-1597` — add "The email's side is held by `apps/api/src/feedback.test.ts`, 'one email per saved message, holding the type, the time and the admin link' and 'the email holds neither the text, nor the reply address, nor the user ID, nor the message ID'."
- `docs/audit-application.md:156` — say the `grep -rnoE "api\.[a-zA-Z.]+\("` finds single-line calls only, and that `identifyGrant`'s chained `.channels.list(` at `packages/youtube-gateway/src/youtube-gateway.ts:553` was read by hand.

## Needs Further Investigation
### A. The upgrade screen's "within 6 hours" (`apps/web/src/upgrade.ts:84`, approved in #913, shown in shot 12) against 24 hours elsewhere and the retention engine's 12-hour alarm (`packages/retention-engine/src/retention-engine.ts:25`). Unchanged from round 3: ask whether 6 hours was meant as a promise; if so, a follow-up ticket for Nick's approved copy, pre-existing and untouched.
### B. The user-flow diagram (`stillstats-user-flow-diagram.svg:51-52`) and shot 5 name two scopes, while the connect consent also asks for `openid` and `email` (`apps/api/src/connect.test.ts:46`). Unchanged: check Google's consent screen in #975's take.
### C. Other Cloudflare HTML rewrites on production (Bot Fight Mode, JavaScript detections, Web Analytics' `static.cloudflareinsights.com/beacon.min.js`), which "Before recording" item 2's `cdn-cgi` count does not catch. Unchanged: a dashboard check, or add `grep -c cloudflareinsights` printing 0.
### D. Question 3's "Now. Live." and shots 35 and 40 assume the store builds carry the "Show engaged views on youtube.com" toggle (ADR 0016). Not readable from the repo. Before the take, compare the version on the Chrome Web Store and on AMO with the first release that holds the toggle; if a store lags, the take waits for its review, as #970's deploy gate does.

## Reviewed and Dismissed
- Question 3's facts (a), (b), (d), (e), (f), (g) and (h) — each holds in the code, with the `file:line` evidence in the verification table.
- "beside YouTube's view count" on a watch page's sidebar, where the pill is a row of its own under the view count's row (`surfaces/feed.ts`) — close enough for a summary, and shot 42 shows it.
- The two questions' form ("May it replace ...?", then "On www.youtube.com, may the pill replace ...?") — reads as a request, the same form as the Studio half.
- `apps/extension/test/manifest.test.ts:363`, "runs one content script, on Studio only" — true: the youtube.com script is registered at runtime, so the manifest holds one static script.
- ADR 0008's title, "The extension runs on YouTube Studio only" — amended by ADR 0016, which keeps 0008 as written on purpose.
- The store short description at `apps/extension/src/manifest.ts:55-56` — #100's approved text, narrower but says nothing false.
- The PDF — rebuilt from the source in a scratch worktree, text identical.
- Round 3's dismissals stand (the "Before recording" renumbering, item 2's "prints 4", the privacy sentence on sharing, the pending comments, `CONTEXT.md:3`, `terms.html`, shots 1, 36 and 45, and round 2's list).

## Minor / nits
- Question 3's Feature paragraph holds two asks; a reviewer could miss the second. Splitting the youtube.com ask into its own paragraph is optional.
- Round 3's Minor list stands unchanged.

## Test quality
The delta adds no test. The branch's one new test (`apps/site/test/site.test.ts`, the `email_off` rule) was audited in round 3: red at `20a6c7c2`, no tautology shape, its reach and pattern short of its rule (findings 3 and 4).

## Prior-review closure
Against `pre-pr-review-3.md` (HEAD `01964ec7`), which converged with no remediation:
- **Fully fixed: 0.**
- **Partially fixed: 0.**
- **Untouched: 7**, all LOW: findings 1 to 7, re-emitted here as 3 to 9. Items A to C stay open.
- **Resolved only by editing a comment or doc:** none; the delta is the run's proposal 7, not a review fix, and it is copy, as intended.
- This is not the fix-begets-finding pattern. Question 3's fix brought only LOW precision points (finding 2); finding 1 is older than the branch and was missed in three rounds, not caused by a fix.

## Before opening the PR
- **CI readiness:** `pnpm lint` exits 0 at HEAD. The delta touches no code, so typecheck, build and the full `pnpm test` were not run; finding 1's fix touches `apps/site/index.html`, so run `pnpm exec vitest run apps/site/test/site.test.ts` with it.
- **Commit hygiene:** the tree was clean at review time.
- **Copy approval:** finding 1's homepage paragraphs join the lede, the refusals item, the privacy policy's extension sentence, the disclosure line and #970's paragraph in waiting for Nick's word-for-word approval; finding 2's narration change waits on his read of the shot list.
- **Merge day:** move the privacy policy's "Last updated" line to the merge day (finding 5).
- **Likely reviewer asks:** where the extension runs (finding 1); why the release notes don't share the address rule (finding 3); why the policy's date is older than its text (finding 5).

## Verdict
Ready to open the PR once finding 1 is fixed. The question 3 change is right: every new fact holds in the code, the tables follow it, and the PDF matches its source. The one MEDIUM is the homepage's "runs on YouTube Studio only". It is older than the branch, but this branch's screencast records it in shot 1, and its question 3 contradicts it. The fix is two paragraphs of site copy under a pending-approval comment. Finding 2 is small and can ride in the same pass. Findings 3 to 9 are round 3's unchanged LOW tail and can follow. The count went from 0 MEDIUM and 7 LOW to 1 MEDIUM and 9 LOW. The new MEDIUM came from a closer read of the published pages against question 3's new scope, not from a regression.

## Remediation — 2026-11-24
| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 1 (MEDIUM) | `866307a5` creator-analytics#6 pre-PR review 4 finding 1: the homepage said the extension runs on YouTube Studio only, while the application, the screencast and the privacy policy show it on www.youtube.com when the creator turns it on | red→green: `grep -c "YouTube Studio only" apps/site/index.html` 1→0, `grep -c "www.youtube.com" apps/site/index.html` 0→2; `pnpm exec vitest run apps/site/test/site.test.ts` 105 passed; `pnpm exec biome check apps/site/index.html` clean; `pnpm typecheck` passes | 0 code comments; 1 HTML pending-approval marker, per Approach decisions | proved by execution |
| 2 (LOW) | — deferred | — | — | LOW tail, not worked this round (default scope) |
| 3 to 8 (LOW) | — deferred | — | — | round 3's LOW tail, unchanged, not worked this round |
| 9 (LOW, comment hygiene) | — deferred | — | — | not worked this round |

The recommended diff was applied word for word. Shot 1's narration (`docs/audit-application.md:253`) names only the heading, which is unchanged, and Section 3 (`:53`) already says www.youtube.com, so neither needed a change. The two paragraphs wait for Nick's word-for-word approval under the marker.

### Known regressions, deferred
- None.

### Rework briefs
- None; no rework pass ran.

### Approach decisions (this round)
- Finding 1 uses the carried-forward pending-approval marker, one HTML comment above the block's first paragraph covering both changed paragraphs, as `apps/site/index.html:221` does above the refusals list.
