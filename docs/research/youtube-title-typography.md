# How YouTube really renders a video title beside a thumbnail, measured

Moved from nick-vogel/nlvogel-site at `6d5d921`, where it was
`docs/design/youtube-title-typography.md`. The paths, the spec, the issue numbers and "the site" it
names are nlvogel-site's, except the size table, which is now
`packages/thumbnail-preview/src/thumbnail-sizes.ts`.

**Measured 2026-08-11** by driving headless Chromium (Playwright, the repo's own dependency) against
the live product, logged out, `en-US`. Harness: nlvogel-site's
`scripts/measure/youtube-title-typography.mjs`, committed this time so the numbers can be re-derived
rather than re-guessed.

This is the companion to `youtube-measured-sizes.md`, which measured thumbnail boxes only. The
approved design derives every title font size from the tile width by formula
(`w>=400?18:w>=300?16:w>=180?14:w>=140?12:9`). That formula is an estimate, and this file exists
because an estimated number in this tool is the exact defect the tool is built to prevent.

**Deliberately not measured, and deliberately not shipped: view counts, timestamps, channel names,
avatars and duration badges** (Nick, 2026-08-11). The title is the only piece of YouTube's card that
the creator authors, so it is the only piece being judged. The rest is chrome.

> **AMENDED 2026-08-13 (nlvogel-site's NLV-34): the duration badge came OFF that list, and nothing
> else did.**
> Nick: "adding timestamps out of that whole list is the only thing worth adding." It is measured in
> `youtube-duration-badge.md` and it ships on the four landscape surfaces.
>
> **"Timestamps" and "duration badges" were the same item named twice**, which is why the list of
> five leaves three rather than four. Nick's own words on 2026-08-13, "adding timestamps out of that
> whole list is the only thing worth adding", are what settle it: the thing he named as timestamps
> is the duration badge, and no upload date was ever measured or drawn.
>
> **What still stays out: view counts, channel names and avatars.** Those three sit outside the
> image and hide nothing, so the 2026-08-11 reasoning holds for them exactly as written. The badge
> is the one item on that list a creator has to design around, which is this tool's subject.
>
> This is a narrowing of the decision, not a reversal of its principle. Do not read it as an opening
> to add chrome generally.

## Method

Every `<img>` on `ytimg.com` larger than 50x30, grouped by rounded box, each surface scrolled to
force lazy loading. Finding the *title* inside each card took five revisions, and the four that
failed are recorded here because each one produced plausible wrong numbers rather than an error:

| Rule tried | How it failed |
|---|---|
| Largest text in the card | Picked the duration badge `1:02:25` on desktop search, and `3.3M views` on mobile Shorts. |
| ...ignoring text drawn ON the thumbnail | Correct on six surfaces. On mobile Shorts it climbed into the grid row and measured the NEIGHBOURING card's title. |
| ...preferring text nearest THIS thumbnail | Picked the shelf heading `Latest` and `Shorts remixing this video`. |
| ...stopping the climb at a single-thumbnail card | Broke desktop search, whose thumbnail anchor holds `8:46` and `Now playing`. |
| **A title is PROSE: 15+ characters, not a clock, count, date or status word** | Correct on every surface, and the rule that shipped. |

**The line clamp is read from the ancestors, not from the text element.** YouTube puts
`-webkit-line-clamp` on a wrapper, so reading the text element alone reports `none` everywhere.

**No number below comes from a single card.** An earlier revision published the first sample, and
one unrepresentative card set the value: a title shorter than the clamp, or one caught rendering
unclamped mid-layout. That is how the two overlay columns were first published as 136px and 128px
when the real values are 148px and 111px. Two different aggregations are used, because one does not
fit both kinds of field:

- **Median** for the five numeric fields: font size, line height, column width, gap and left inset.
- **Mode** for the four categorical ones: line clamp, placement, weight and colour. A median of
  "below" and "overlay" is meaningless, and the clamp is exactly the field an unclamped mid-layout
  card would distort.

Each row also lists three of the sampled titles, and **the per-card records are kept in the output**
rather than discarded, because seeing that 48px and 88px were per-card artefacts needed them.

**The overlay rows are measured from the title block's BOTTOM edge.** They are bottom-anchored on
the cover, so measuring to the title's top makes the number a function of how many lines the sampled
title rendered. That error published 48px and 88px for two surfaces that both sit 32px off the
bottom.

## Control leg: does this harness reproduce the 2026-08-10 boxes?

Eight of nine box groups reproduce exactly: 347x195, 500x281, 160x90, 375x210, 214x321, 186x278,
148x263 and 115x172.

**One does not. The watch page suggested rail measures 220x124 at 1280, not 194x109.** At 1440 it
measures 248x139, not 208x117. This is not a fluke of the run:

- Stable across window heights 720, 900 and 1080, so it is not the player sizing the sidebar.
- Stable across three different videos (`dQw4w9WgXcQ`, `jNQXAC9IVRw`, `9bZkp7q19f0`).

Both sweeps are re-runnable from the committed harness, which is the point of committing it.
`DESKTOP_HEIGHT` and `VIDEO_ID` are the two inputs they vary, and both default to the values this
table was measured at:

```
DESKTOP_HEIGHT=720 ONLY_PROFILE=1440 node scripts/measure/youtube-title-typography.mjs
VIDEO_ID=jNQXAC9IVRw ONLY_PROFILE=1440 node scripts/measure/youtube-title-typography.mjs
```

They were literals in the script until 2026-08-12, so neither sweep could be reproduced from it.

The 2026-08-10 file's own first limit is "one sample, one day, logged out. YouTube A/B tests its
layouts continuously." That limit has now been demonstrated rather than merely stated. **`194` is a
shipped constant in `packages/thumbnail-preview/src/thumbnail-sizes.ts` and in nlvogel-site's spec
AC 7, and it is replaced by 220.**

## The headline finding: there are THREE placements, not two

**On mobile, a Shorts title is drawn ON the cover in white, not below or beside it.** The card holds
no text outside the image at all: only the title and the view count, both white, both overlaid on
the lower part of the cover.

This matters more than the type does. **An overlaid title covers part of the thumbnail**, so on the
two mobile Shorts surfaces a creator's own title is competing with the design underneath it. That is
exactly the kind of loss this tool exists to show, and no amount of measuring font sizes would have
surfaced it.

## Landscape

| Surface | Thumb box | Title | Line height | Clamp | Placement | Gap | Title column |
|---|---|---|---|---|---|---|---|
| Grid card (channel videos, proxy for home feed) @1280 and @1440 | 347 x 195 | **16px / 500** | 22px | **2 lines** | below | 13px | 306px (0.88x) |
| Search results @1280 and @1440 | 500 x 281 | **18px / 400** | 26px | **2 lines** | **beside** | 16px | 481px (0.96x) |
| Watch page, suggested @1280 | 220 x 124 | **14px / 500** | 20px | **3 lines** | **beside** | 8px | 121px to 126px (0.55x) |
| Watch page, suggested @1440 | 248 x 139 | 14px / 500 | 20px | 3 lines | beside | 8px | 126px (0.51x) |
| Grid card @375, mobile UA | 160 x 90 | **14px / 400** | 17.5px | **3 lines** | **beside** | 8px | 119px (0.744x) |
| Search results @375, mobile UA | 375 x 210 | 14px / 400 | 17.5px | 2 lines | below | 12px | 215px (0.57x) |

**The watch-suggested column is the one unstable number in this file**, reading 121px on two runs and
126px on two others at the same viewport. Everything else reproduced to the pixel across five runs.
Treat it as 121px to 126px, and assert it with tolerance rather than as an exact value.

## Shorts

| Surface | Thumb box | Title | Line height | Clamp | Placement | Gap | Title column |
|---|---|---|---|---|---|---|---|
| Channel Shorts tab @1280 and @1440 | 214 x 321 | **16px / 500** | 22px | 2 lines | below | 9px | 153px (0.715x) |
| Watch page, suggested Shorts @1280 | 115 x 172 | 16px / 500 | 22px | 2 lines | below | 9px | 70px (0.61x) |
| Channel Shorts tab @375, mobile UA | 186 x 278 | **14px / 400** | 20px | **3 lines** | **OVERLAY, white** | 32px | 148px (0.795x) |
| Watch suggested Shorts @375, mobile UA | 148 x 263 | **14px / 400** | 20px | **3 lines** | **OVERLAY, white** | 32px | 111px (0.75x) |

**Gap means a different distance per placement.** Below: image bottom to title top. Beside: image
right to title left. **Overlay: image bottom to the title block's BOTTOM**, which is 32px on both
overlay surfaces.

## The overlay geometry, measured in full

A white title on a photograph is unreadable without something behind it, so the overlay needs four
facts, not one. All four are measured, and the tool cannot render this placement honestly without
them.

| Fact | Value | Both surfaces? |
|---|---|---|
| Bottom anchor | **32px** from the cover's bottom edge to the title block's bottom edge | Yes |
| Left inset | **8px** from the cover's left edge | Yes |
| Colour | `rgb(255, 255, 255)` | Yes |
| Scrim | **`linear-gradient(to top, rgba(0, 0, 0, 0.6) 0px, rgba(0, 0, 0, 0) 100%)`**, full cover height, bottom-aligned | Yes |

**The scrim sits on a real element, not a pseudo-element**: a `div.shortsLockupViewModelHostInlineMetadata`
that wraps the title. Its reported extent is therefore its own box, not a host's, so "full cover
height, bottom-aligned" is measured rather than inferred. **The gradient's second stop varies**,
reading `100%` on the two Shorts surfaces and `30%` on a Shorts result inside mobile search, so the
stop positions are recorded as observed and the spec leaves them to the plan.

**The scrim was nearly missed twice**, and both misses would have shipped white text on a bare
thumbnail. The first probe skipped elements that CONTAIN the title, and YouTube paints the gradient
on exactly that wrapper. The second read only the elements themselves, and a gradient can live on
`::before` or `::after`, which `querySelectorAll` cannot see. **A preview with no scrim overstates
legibility**, which is the one direction this tool must never err in.

**The two overlay rows were marked *uncertain* in this file's first version and are now measured.**
The first harness could not see them because it excluded text drawn on the thumbnail, which is
correct on every other surface and exactly wrong here. Both rows were then confirmed by a targeted
probe that dumped every text node in the card, and by the rewritten harness at n=29 and n=3, with
every published value taken as the group median.

## Constant across every surface

- **Family: `Roboto, Arial, sans-serif`**, computed. YouTube serves Roboto as a webfont, so YouTube
  always renders Roboto. A machine without Roboto renders Arial, which sets different glyph widths
  and therefore truncates the clamp at a different word.
- **Letter spacing: `normal`** on every surface.
- **Weight is 500 on desktop and 400 on mobile**, with desktop search the one exception at 400.
- **Colour is `rgb(15, 15, 15)` on every non-overlay surface**, which is `#0F0F0F`, already the focus
  palette's `--yt-fg` light value. **Both overlay surfaces are `rgb(255, 255, 255)`.**

## What the approved design gets wrong

| Design | Measured reality |
|---|---|
| `line-height: 1.3` everywhere | Wrong on every surface. Real ratios are 1.375 (16/22), 1.444 (18/26), 1.429 (14/20) and 1.25 (14/17.5 on mobile). Line height is per surface, not one value. |
| `font-weight: 500` everywhere | Desktop search is **400** at 18px, and every mobile surface is 400. |
| 2 line clamp everywhere | Watch suggested, the mobile grid card and **both mobile Shorts surfaces** clamp to **3**. |
| Every title below its thumbnail | **Four of the nine measured surfaces put it below.** Three put it beside, and **two draw it ON the cover in white.** |
| Size from tile width by formula | **Wrong on five of the nine measured surfaces, not two.** Applying the design's own `w>=400?18:w>=300?16:w>=180?14:w>=140?12:9` to every row of both tables above: 160 is **14px, not 12px**; 375 is **14px, not 16px**; 214 is **16px, not 14px**; 115 is **16px, not 9px**; and 148 is **14px, not 12px**. It is right on the other four (347, 500, watch-suggested at both 220 and 248, and 186). The earlier "wrong on two" named only the two checked by hand, and **148 is a shipped tile**. |
| Title column equals the tile width | Never true. It runs 0.51x to 0.96x of the thumbnail width, because an avatar indents it on the grid card and a menu button truncates it on the Shorts card. Both are chrome this tool does not ship. |
| One title colour | Two: `#0F0F0F` where the title sits outside the image, white where it is drawn on it. |

## Limits, stated so nobody over-trusts this

- **One sample, one day, logged out**, exactly like the thumbnail measurement. The 194 to 220 drift
  documented above is what that limit looks like when it fires.
- **The watch-suggested title column varied 121px to 126px across runs.** It is the only number here
  that did not reproduce exactly, and it is recorded as a range rather than averaged into a
  false-precision single value.
- **The 72px stress tile has no YouTube equivalent**, so it has no measured title type. Whatever it
  renders is an extrapolation and has to be labelled as one.
- **Notifications were not measured.** That surface needs a signed-in account.
- **Only the light theme was measured.** The dark theme title colour was not captured; `--yt-fg`
  already carries `#F1F1F1` for the dark surface from the earlier palette work.
- **The scrim's stop positions are as reported by computed style and they are NOT constant**:
  `0px` to `100%` on both Shorts surfaces, `0px` to `30%` on a Shorts result inside mobile search.
  The 0.6 alpha and the bottom-aligned direction held everywhere. YouTube may author it in other
  units; the rendered result is what is recorded.
- The title column widths include indents caused by avatars and menu buttons, which this tool does
  not render. They are recorded as measured, not as a target.
- **A character outside the shipped Roboto subset falls back to Arial** and wraps at a different
  word. Emoji always fall back to a system emoji face, on YouTube as well as here.
