# YouTube's real rendered thumbnail sizes, measured

Moved from nick-vogel/nlvogel-site at `6d5d921`, where it was
`docs/design/youtube-measured-sizes.md`. The paths, the spec, the issue numbers and "the site" it
names are nlvogel-site's, except the size table, which is now
`packages/thumbnail-preview/src/thumbnail-sizes.ts`.

**Measured 2026-08-10** by driving headless Chromium (Playwright, the repo's own dependency) against
the live product, logged out, `en-US`. Every number is a **CSS-pixel bounding box** read off the
rendered `<img>`, which is what the tool's tiles have to match.

> **SUPERSEDED IN ONE ROW, 2026-08-11.** A re-measurement for the title work read the watch-page
> suggested rail at **220 x 124** at 1280 and **248 x 139** at 1440, not the 194 x 109 and 208 x 117
> recorded below. The new reading is stable across window heights 720, 900 and 1080 and across three
> different videos. **220 x 124 is the value the tool ships** (spec decision 14). Every other row
> here reproduced exactly. Companion file, with the harness that produced it:
> `youtube-title-typography.md` and nlvogel-site's `scripts/measure/youtube-title-typography.mjs`.
>
> **The harness behind THIS file was never committed and cannot be re-run**, which is why the
> disagreement cannot be resolved by re-measuring the old way, and why the new harness is committed.
> This row is the first demonstration that the "one sample, one day" limit below is real rather than
> merely prudent.

This exists because the approved design's tile sizes were estimated, and **most of them are wrong**.
The tool's entire premise is that its sizes are real, so an estimated number in this tool is not a
rounding error, it is the defect the tool is built to prevent.

## Method

Every `<img>` whose `src` is on `ytimg.com` and larger than 50x30 was measured and grouped by
rounded box. Grouping by rendered box rather than by DOM selector keeps the measurement independent
of YouTube's markup, which changes. Each surface was scrolled to force lazy loading.

**The logged-out home feed could not be measured directly**: it renders no videos at all, showing
"Start watching videos to help us build a feed of videos you'll love". The **channel Videos tab**
uses the same `ytd-rich-grid-media` card as the home feed grid, so it is the proxy, and it returned
the identical box at both desktop widths.

## Landscape (16:9). Every surface measured ratio 1.778 to 1.786.

| Surface | @1280 | @1440 | @375 |
|---|---|---|---|
| Grid card (home feed / channel videos) | **347 x 195** | **347 x 195** | **160 x 90** |
| Search results | **500 x 281** | **500 x 281** | **375 x 210** |
| Watch page, suggested | ~~194 x 109~~ **220 x 124** | ~~208 x 117~~ 248 x 139 | 375 x 224 |

The grid card does not change between 1280 and 1440: YouTube's grid adds a column rather than
growing the card. The watch-page suggested rail DOES grow with the viewport.

## Shorts. **Two different aspect ratios, and this is the headline finding.**

| Surface | @1280 | @1440 | @375 | Ratio |
|---|---|---|---|---|
| Channel Shorts tab | **214 x 321** | **214 x 321** | **186 x 278** | **0.667 = 2:3** |
| Watch page, suggested Shorts | 115 x 172 | 123 x 185 | **148 x 263** | 0.667 desktop, **0.563 = 9:16 mobile** |

**A Shorts cover is authored at 9:16 and YouTube crops it to 2:3 in every desktop grid**, taking a
slice off the top and the bottom. On mobile it survives at 9:16. So a Shorts thumbnail has to be
checked at BOTH ratios, and the 2:3 crop is where a design actually loses content. A tool that only
renders Shorts at 9:16 shows the creator a frame YouTube will never display on desktop.

## What the approved design got wrong

| Design tile | Measured reality |
|---|---|
| "Home feed, 360 x 202" | 347 x 195. Off by 13px. |
| "Suggested sidebar, 168 x 94" | 220 x 124 at 1280 (194 x 109 when first measured on 2026-08-10). Off by at least 26px either way. |
| "Search and notifications, 120 x 68" | Search is 500 x 281 on desktop and 375 x 210 on mobile. Off by a factor of four. |
| "Shorts shelf, 158 x 281" @ 9:16 | 214 x 321 at **2:3**. Wrong number and wrong ratio. |
| "Channel page, 120 x 213" @ 9:16 | Same surface as above: 214 x 321 at 2:3. |
| "Stress test, 72 x 41" / "72 x 128" | Not a YouTube context. Keep as the deliberate stress size. |

## Limits of this measurement, stated so nobody over-trusts it

- **One sample, one day, logged out.** YouTube A/B tests its layouts continuously.
- **Notifications were not measured**: that surface needs a signed-in account. The design's 120px
  figure for it is still an estimate.
- **The 375px watch-suggested landscape box (375 x 224, ratio 1.674)** does not match 16:9 and is
  probably not a standard video thumbnail. It is excluded from the recommended set.
- Headless Chromium at a forced viewport is not identical to a real browser at that window size,
  though the CSS-pixel geometry is the part that carries over.
- **The measurement captured box SIZES, not crop POSITION.** The 2:3 crop is assumed to be centred,
  which is what makes the tool's crop overlay an even 7.8% at the top and 7.8% at the bottom. If
  YouTube anchors the crop off-centre the total removed is still 15.625%, but the split is not
  even. That one number is inferred, and it is the only inferred number here.
