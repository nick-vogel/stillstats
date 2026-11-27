# YouTube's duration badge, measured

Moved from nick-vogel/nlvogel-site at `6d5d921`, where it was
`docs/design/youtube-duration-badge.md`. The paths, the spec, the issue numbers and "the site" it
names are nlvogel-site's, except the size table, which is now
`packages/thumbnail-preview/src/thumbnail-sizes.ts`.

Measured 2026-08-13 for nlvogel-site's NLV-34, with nlvogel-site's harness at
`scripts/measure/youtube-title-typography.mjs`. Re-run it rather than re-guessing:

```
OUT=./yt-badge-measurements.json node scripts/measure/youtube-title-typography.mjs
```

## Why this file exists at all

`youtube-title-typography.md` records a decision from 2026-08-11 that kept several pieces of
YouTube's chrome out of this tool, because the title is the only piece of the card the creator
authors. **That note is the single statement of the list, and this file does not restate it.**

**The duration badge came off that list on 2026-08-13, and nothing else did.** Nick: "adding
timestamps out of that whole list is the only thing worth adding." The badge is different from the
rest because it is drawn ON the thumbnail and HIDES part of what the creator designed. A channel
name and a view count sit outside the image and hide nothing. The badge is the one piece of chrome a
creator has to design around, which is the tool's whole subject.

## The headline finding

**The badge does not scale with the thumbnail.** It is 12px type in a 20px-tall chip on a 160px
thumbnail and on a 500px one, across every profile measured. Only its OFFSET from the corner
changes, and it takes three values across the four surfaces this tool draws.

That is the finding that justifies measuring rather than deriving. The approved design derives title
size from tile width by formula, and any formula applied to the badge would have scaled it, which
would have understated how much of a small thumbnail it covers and overstated it on a large one.

## WHICH ELEMENT IS THE BADGE, and the correction that question forced

**The first version of this file measured the wrong box**, and the numbers below replace it. The
badge is two nested elements: `div.ytBadgeShapeText` holds the digits, and its parent
`badge-shape.ytBadgeShapeHost` carries the fill, the padding and the radius. The first run reported
the TEXT box as the badge and read the padding and radius off the parent, so it published a box
from one element and a padding from another, and every offset was measured to the text rather than
to the edge a creator actually sees.

The correction is not a re-measurement of the same thing. It is the same run read correctly: the
chip is exactly 4px wider on each side and 1px taller on each side than its text, so every published
offset moved by that much and nothing else changed. Both runs agree once that is applied.

**How it was settled.** The harness records the whole ancestor chain of the matched clock, five
levels with each one's box, background, padding and radius, so the rule that picks the chip is read
off data rather than guessed. The chain is kept in the output for the same reason.

**The rule is right most of the time and not all of the time, and the harness now says so.** The
first painted ancestor is `badge-shape.ytBadgeShapeHost`, the chip, on most cards; on some desktop
search and suggested cards it is a right-aligned wrapper instead, 5 of 10 and 6 of 28 in the
2026-08-13 run. **The published OFFSETS survive that, measured rather than assumed**: the wrapper
shares the chip's bottom-right corner, so the clean cards and the flagged cards return identical
right and bottom values on every group. The chip's WIDTH and PADDING would not survive it, which is
why every record now carries a `suspectFill` flag and every group a count of them.

## What is constant on every surface

Measured on `badge-shape.ytBadgeShapeHost`, which is the painted chip.

| Property | Value |
|---|---|
| Font size | 12px |
| Font weight | 500 |
| Chip height | 20px |
| Text height inside it | 18px |
| Background | `rgba(0, 0, 0, 0.6)` |
| Corner radius | 4px |
| Padding | 1px 4px |
| Font family | `Roboto, Arial, sans-serif` |
| Corner | bottom right |

The chip WIDTH follows the digits, because the padding is fixed: it is the text width plus 4px on
each side. The text runs 30.45px for `m:ss` and `mm:ss` and 40.44px for `h:mm:ss`, so the chip is
38.45px and 48.44px.

## What varies, and it is only the offset

Measured from the thumbnail's bottom-right corner to the CHIP's, not to its text.

| Tool surface | Measured box | Right | Bottom |
|---|---|---|---|
| Search results, 500 x 281 | 500x281 | 8px | 8px |
| Home feed, 347 x 195 | 347x195 | 8px | 8px |
| Suggested, beside a video, 220 x 124 | 220x124 and 248x139 | 4px | 4px |
| Home feed on a phone, 160 x 90 | 160x90 | 5px | 5px |

**Search and the home feed are the same, and the two smaller surfaces each differ.** Three values,
not two. The correction subtracted the same 4px and 1px from every row, so it did not change how
many distinct offsets there are; what it changed is that right now equals bottom within each pair,
which is what a corner inset usually is. In the first version right and bottom differed by 3 on
every one of the four rows, which is the chip's 4px horizontal padding minus its
1px vertical padding showing up as a difference between the axes.

The mobile search and mobile suggested surfaces both return 8 and 8 as well, at boxes this tool does
not render.

## Sample and limits

Fourteen box groups across six profiles carried a badge. The four desktop and mobile profiles agree
with each other on every constant.

**Not every card has one, and the tool should not imply otherwise.** On desktop search only 9 of 12
and 10 of 12 cards in the 500x281 group carried a badge; the rest are live streams, playlists and
channel rows, which have none. Every grid and suggested group was 100%.

**Shorts have no badge at all.** The `shorts-tab` surface returned zero badge groups on every
profile, at 1280, 1440, 375 mobile and 375 with a desktop user agent. That is a measured negative
rather than an assumption, and it is why the tool draws the badge on landscape tiles only.

**The 72px stress tile is out of scope.** Its rail already says "not a YouTube context", and a
20px chip on a 41px-tall tile is not a surface YouTube renders.

**The fill is NEVER on the element the clock matches.** `div.ytBadgeShapeText` is always
transparent, and its parent `badge-shape.ytBadgeShapeHost` always carries the fill. An earlier
version of this note said the fill sits on the matched element "on some surfaces" and on a parent on
others; that was a guess written before the ancestor chain was recorded, and the chain shows it is
the parent every time, on every surface and every profile. The harness climbs at most four levels
and records which one it found, so the claim stays checkable rather than remembered.

**The tool reproduces YouTube's digit widths exactly, because it serves the same face.** Both Roboto
weights are in `public/fonts` and both report `loaded`. Measured on 2026-08-13 on a page with the
badge rendered: `1:02:25` at 12px/500 is 40.44px in Roboto, which is YouTube's measured text width
to the hundredth, and 40.05px in Arial and in the site's own `--font-sans`. The rendered chip is
48.44px, which is the measured text plus the measured padding.

**An earlier version of this paragraph said the opposite, and the error is worth keeping.** It
reported that `Roboto, Arial, sans-serif` fell through to Arial and that `Roboto` alone rendered
36.67px. Both figures came from probing a page with no title on it. `.t-vtitle` is the only other
consumer of Roboto, so with no title rendered the face had never been used, had never been fetched,
and every probe silently got a fallback. 36.67px is the default serif, not Roboto. **Measure a font
on a page that is already using it.**

**The width cannot police the typeface, and leg (as) no longer pretends to.** Roboto renders the
chip at 48.44px and the site's own Switzer at 48.23px, so separating them by width needs a tolerance
under 0.21px, which is a flake waiting for a different machine. The width leg keeps a half-pixel
tolerance and catches a padding or digit-count mistake. Two other legs hold the face: the declared
family, and `document.fonts.check('500 12px Roboto')`, which observes the face actually loading.
That second one matters because `getComputedStyle` returns the declared list whether or not the file
was ever served, and the badge is the only consumer of Roboto 500 in the application.

**How the badge is identified.** A clock, `^\d+:\d{2}(:\d{2})?$`, whose box overlaps the thumbnail.
Both halves are load-bearing: a clock that does not overlap is a timestamp elsewhere in the card,
and an overlapping element that is not a clock is the scrim or a "Now playing" chip. Matching on the
clock shape alone picked up the watch page's own player time on the suggested surface.
