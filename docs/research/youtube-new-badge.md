# YouTube's New badge, measured

Moved from nick-vogel/nlvogel-site at `6d5d921`, where it was `docs/design/youtube-new-badge.md`.
The paths, the spec, the issue numbers and "the site" it names are nlvogel-site's, except the size
table, which is now `packages/thumbnail-preview/src/thumbnail-sizes.ts`.

Measured 2026-09-19 for nick-vogel/nlvogel-site#61, with nlvogel-site's harness at
`scripts/measure/youtube-title-typography.mjs`, logged out, `en-US`. Re-run it rather than
re-guessing:

```
OUT=./yt-new-badge-measurements.json node scripts/measure/youtube-title-typography.mjs
```

That run writes every per-card record, every ancestor chain, and a per-surface reconciliation of
the New badge chips it saw against the ones it could measure, including the zeroes. The JSON is a
local working file and is gitignored: this document is the reviewed artefact, and it is written
from the JSON rather than from a console summary.

**This file was rewritten on 2026-09-19, the day it was written, and every number in it comes from
the second run.** The first matcher searched for the badge INSIDE a card resolved by climbing up
from a thumbnail image, and that climb returns nothing whenever its prose or second-image bounds
are not met. Chips in unresolved cards were therefore never seen, the first run matched 17 of
roughly 52 visible chips, and the document built on those counts called the badge sparse and
personalized. It is neither. The matcher now sweeps the whole document for the chip and attributes
each one back UP to a thumbnail, and it publishes what it could not attribute instead of dropping
it. Nothing from the first document was carried over, including the sentences that happened to
survive.

## Why this file exists at all

`youtube-duration-badge.md` records why one piece of YouTube's chrome is drawn in this tool and the
rest is not: the duration badge is painted ON the thumbnail and hides part of what the creator
designed, so it is the one thing a creator has to design around. **The New badge meets the same
test, and nothing about it is published.** The whole evidence base before this measurement was one
third party issue, https://github.com/YouTube-Enhancer/extension/issues/1425, opened 2026-09-18,
which gives one sentence and one CSS selector and no colour, size, placement or trigger rule.

The tool's existing YouTube values are measured. Inventing this one would have broken that standard
silently, because nothing downstream can tell a measured number from a guessed one.

## The headline finding

**The badge is real, it sits in the TOP LEFT corner, and it is the duration badge's chip in a
different skin.** Same 12px Roboto 500, same 20px chip height, same 4px radius, same `1px 4px`
padding, same `badge-shape.ytBadgeShapeHost` element carrying the fill. Only the colour and the
corner change, and the inset is the same inset the duration badge uses on that same tile.

**It is common on the two surfaces that carry it, and completely absent on the other two.** The run
scanned 455 cards across 18 surface and profile combinations and found 101 visible `New` chips. On
the surfaces that draw it, it is drawn on a large fraction of tiles: 4 of the 5 Shorts lockups in
desktop-UA search at 375, 6 of 15 in search at 1280, 3 of 8 on mobile search, and 30 chips beside
31 recorded tiles on the 1440 watch page. On the channel videos grid and the channel Shorts tab it
did not appear once, across four profiles and 246 cards. Presence is a property of the SURFACE far
more than of the card, which is the opposite of what the first run appeared to say.

**There are two skins, and the difference is the fill, not the geometry.** On a landscape watch
suggested tile the chip is WHITE with near-black text. On a Shorts lockup it is the duration
badge's own black at 60% with white text. The two use different variant classes on the same
component, `ytBadgeShapeThumbnailSpecial` and `ytBadgeShapeThumbnailDefault`.

## The badge text, exactly as measured

**`New`.** Capital N, lower case `ew`, and `text-transform: none`, so the case is authored rather
than applied by CSS. Every one of the 24 measured chips returned the same string, on both skins and
on all five profiles that produced one. It is not `NEW`.

## What is constant on every surface

Measured on `badge-shape.ytBadgeShapeHost`, which is the painted chip, exactly as the duration
badge document measures its own. All 24 measured chips agreed on every row below.

| Property | Value |
|---|---|
| Text | `New` |
| Font size | 12px |
| Font weight | 500 |
| Font family | `Roboto, Arial, sans-serif` |
| Line height | 18px |
| Letter spacing | normal |
| Chip height | 20px |
| Text height inside it | 18px |
| Chip width | 31.86px, and 32.02px at the 375 mobile profile |
| Text width inside it | 23.86px, and 24.02px at 375 mobile |
| Horizontal padding as rendered | 8px total, chip minus text |
| Corner radius | 4px |
| Padding | 1px 4px |
| Corner | top left |
| `text-transform` | none |

**The fill is never on the element the word matches.** `div.ytBadgeShapeText` is transparent on
every one of the 24 measured chips, and its parent `badge-shape.ytBadgeShapeHost` carries the fill,
the padding and the radius. The harness records five levels of the ancestor chain for each chip and
flags a suspect selection, and `suspectFill` was `false` on all 24, so the numbers above are the
chip's and not a wrapper's.

## What varies: the fill, and the offset

Measured from the thumbnail's top left corner to the CHIP's top left corner, not to its text. The
denominator is the tiles in that box group whose cover image had loaded, which is what the harness
can measure against.

| Tool surface | Measured box | Left | Top | Chip fill | Text colour | Tiles with a badge |
|---|---|---|---|---|---|---|
| Watch suggested, landscape @1440 | 248x139 | 4px | 4px | `rgb(255, 255, 255)` | `rgb(15, 15, 15)` | 4 of 31 |
| Watch suggested, landscape @1280x1080 | 220x124 | 4px | 4px | `rgb(255, 255, 255)` | `rgb(15, 15, 15)` | 4 of 34 |
| Watch suggested, landscape @375 desktop UA | 427x240 | 8px | 8px | `rgb(255, 255, 255)` | `rgb(15, 15, 15)` | 3 of 9 |
| Search results, Shorts lockup @1280 | 219x329 | 5px | 5px | `rgba(0, 0, 0, 0.6)` | `rgb(255, 255, 255)` | 6 of 15 |
| Search results, Shorts lockup @375 mobile | 168x251 | 5px | 5px | `rgba(0, 0, 0, 0.6)` | `rgb(255, 255, 255)` | 3 of 8 |
| Search results, Shorts lockup @375 desktop UA | 160x239 | 5px | 5px | `rgba(0, 0, 0, 0.6)` | `rgb(255, 255, 255)` | 4 of 5 |

**Left equals top on every row.** The 427x240 row reads 8.01px on the vertical axis and the 1440
Shorts lockup read 5.01px in the previous run, which is the same whole number through a fractional
layout box.

**The landscape inset is not a constant, it tracks the duration badge on the same tile.** On the
220x124 and 248x139 suggested tiles both badges are inset 4px; on the 427x240 tile both are inset
8px, measured in the same records. So the rule to carry forward is "the New badge uses the duration
badge's inset from the opposite corner", not "the New badge is 4px in".

Shorts lockups are the exception to that, at a flat 5px on all three boxes, and they carry no
duration badge to compare against.

## The reconciliation: 101 chips seen, 24 measured, and what happened to the rest

This section exists because the first run had no reconciliation at all, so a card climb that failed
and a page with no badge produced the same output, and the document was written from the second
reading of the first fact. The harness now publishes all three numbers per surface.

| Kind of chip | Count | What it is |
|---|---|---|
| Measured | 24 | A `ytBadgeShapeThumbnail*` chip on a tile whose cover image had loaded |
| Thumbnail chip, not measurable | 64 | The same variant class, on a tile whose cover image had not loaded yet |
| Metadata chip, not this badge | 13 | `ytBadgeShapeDefault` or `ytBadgeShapeModern`, 18px tall, near-transparent grey, in a text row beside a title or a channel line |
| **Total visible `New` chips** | **101** | |

**The 64 are real badges and they are not measurable here.** They wear the same
`ytBadgeShapeThumbnailSpecial` or `ytBadgeShapeThumbnailDefault` class as the 24, but every one of
them sits in a tile whose `img` had not yet loaded a `ytimg.com` cover, so there is no thumbnail box
to measure an offset against. They are concentrated in the watch page related rail far below the
fold, which renders its badges before its covers: 26 of the 30 chips at 1440 and 29 of the 33 at
1280x1080. They are counted as evidence of prevalence and excluded from every geometry number.

**The 13 are not this badge.** The word `New` is also rendered in YouTube's metadata rows, next to a
title or a channel name, on a chip that is 18px tall with a near-transparent grey fill, where the
thumbnail badge is 20px on an opaque or 60% fill. That chip is not painted on the thumbnail and
hides nothing the creator designed, which is the whole test this tool uses to decide what it draws.
Attributing those by ancestry alone is what produced offsets of -5940px and +6055px in an
intermediate run, and two chips landing on one tile.

Per surface and profile, in full. `Chips` is every visible `New` chip on the page; `measured` is
those attributed to a loaded thumbnail cover; the last two columns are the two ways a chip went
unmeasured.

| Profile | Surface | Cards | Chips | Measured | Thumbnail chip, no cover | Metadata chip |
|---|---|---|---|---|---|---|
| @1280 | Grid | 32 | 0 | 0 | 0 | 0 |
| @1280 | Search | 26 | 7 | 6 | 0 | 1 |
| @1280 | Watch suggested | 23 | 2 | 0 | 0 | 2 |
| @1280 | Channel Shorts tab | 48 | 0 | 0 | 0 | 0 |
| @1440 | Grid | 32 | 0 | 0 | 0 | 0 |
| @1440 | Search | 15 | 7 | 0 | 6 | 1 |
| @1440 | Watch suggested | 31 | 30 | 4 | 26 | 0 |
| @1440 | Channel Shorts tab | 48 | 0 | 0 | 0 | 0 |
| @375 mobile | Grid | 29 | 0 | 0 | 0 | 0 |
| @375 mobile | Search | 18 | 3 | 3 | 0 | 0 |
| @375 mobile | Watch suggested | 13 | 5 | 0 | 0 | 5 |
| @375 mobile | Channel Shorts tab | 29 | 0 | 0 | 0 | 0 |
| @375 desktop UA | Grid | 16 | 0 | 0 | 0 | 0 |
| @375 desktop UA | Search | 19 | 8 | 4 | 3 | 1 |
| @375 desktop UA | Watch suggested | 9 | 3 | 3 | 0 | 0 |
| @375 desktop UA | Channel Shorts tab | 12 | 0 | 0 | 0 | 0 |
| @1280x720 | Watch suggested | 21 | 3 | 0 | 0 | 3 |
| @1280x1080 | Watch suggested | 34 | 33 | 4 | 29 | 0 |
| | **Total** | **455** | **101** | **24** | **64** | **13** |

All 24 measured chips were attributed by ancestry, three or four levels up, and none by the
geometric fallback. No chip was attributed to a thumbnail that another chip already held.

## Surfaces that were measured and found to have no badge

An absence here is a result, not a gap, and it now means what it says: the page showed no `New`
chip of any kind, not that a card climb came back empty.

| Surface | Profiles | Cards scanned | Chips on the page |
|---|---|---|---|
| Grid card (channel videos, home feed proxy) | @1280, @1440, @375 mobile, @375 desktop UA | 32, 32, 29, 16 | 0 on all four |
| Channel Shorts tab | @1280, @1440, @375 mobile, @375 desktop UA | 48, 48, 29, 12 | 0 on all four |

That is 8 of the 18 surface and profile combinations, 246 cards, and not one chip. The other 10
combinations all produced at least one.

**The landscape search tile also produced no badge, but for a different reason and with a weaker
claim behind it.** The four landscape search box groups in this run hold 11 + 15 + 10 + 14 = 50
cards and none carried a badge, while the Shorts lockups on the same four pages carried 13 of the
run's 24. So the badge is in search, it just was not on the landscape tiles this time. The grid and
the Shorts tab negatives are stronger: those pages rendered the word nowhere at all.

## Do the New badge and the duration badge ever share a corner?

**No.** The New badge measured top left on all 24 chips. The duration badge's corner is now derived
from its own four offsets by the same code rather than assumed, and it measured bottom right on
every card in this run that carried both.

**Eleven cards carried both badges at once**, which is every landscape hit in the run: 4 on the
248x139 tile at 1440, 4 on the 220x124 tile at 1280x1080, and 3 on the 427x240 tile at 375 desktop
UA. On each of them the New badge sits the same distance from the top left as the duration badge
sits from the bottom right: 4px and 4px on the two smaller tiles, 8px and 7.99px on the 427x240.
They are diagonally opposite and they do not collide, so the open question the epic left for this
measurement is answered: the tool can draw both without a placement rule to separate them.

The 13 Shorts lockups that carried a New badge carried no duration badge at all, which agrees with
the duration badge document's own measured negative for Shorts.

## Does the badge appear on Shorts?

**Yes, and the answer depends on which Shorts surface you mean, so it has to be stated as two
facts.**

- **The channel Shorts tab: no.** Zero chips of any kind across all four profiles and 137 cards. The
  word `New` did not appear anywhere in those documents.
- **Shorts lockups inside search results: yes, and heavily.** Thirteen of the 24 measured chips in
  this run were Shorts lockups in the search results Shorts shelf, at 219x329, 168x251 and 160x239,
  including 4 of the 5 lockups on one page.

So a rule of the form "the badge does not apply to Shorts" is false. The Shorts cover is one of the
two places it is drawn, and it is drawn there in the black skin with a 5px inset.

## The one public selector is neither necessary nor sufficient

The selector in the third party sighting ends in
`yt-thumbnail-overlay-badge-view-model:has(yt-thumbnail-badge-view-model)`, scoped to the watch page
related rail. The harness records, per chip, whether it was inside that selector, and it sweeps by
TEXT instead so the selector is checked rather than trusted.

- **Not sufficient.** The run found 93 of those hosts, all 93 carrying a `yt-thumbnail-badge-view-model`
  child, and 90 of them inside the related rail. Their text was `Mix`, `New`, `11 songs`,
  `24 videos`, `25 videos`, `37 lessons`, `38 videos`, `44 videos`, `49 videos`, `80 videos` and
  `99 videos`. It is the generic thumbnail overlay badge slot, not the New badge.
- **Not necessary.** Only 11 of the 24 measured chips were inside it, and all 11 were watch page
  suggested tiles. The 13 Shorts hits sit in `yt-badge-view-model.shortsLockupViewModelHostBadge`
  instead, which the published selector does not reach.

Matching on the rendered word is what found the Shorts case at all, and that is the same lesson the
duration badge harness learned when it matched a clock rather than a class name.

## Control leg: does this run still reproduce the measured boxes?

Mostly yes, and the one deviation is named rather than buried. It is the same deviation the first
run of the day reported.

**Every landscape box the tool draws reproduced exactly**, against `youtube-measured-sizes.md` as
amended on 2026-08-11: grid 347x195 at 1280 and 1440 and 160x90 at 375 mobile, search 500x281 at
1280 and 1440 and 375x210 at 375 mobile, watch suggested 220x124 at 1280 and 248x139 at 1440 and
375x224 at 375 mobile. The desktop watch suggested Shorts box reproduced at 115x172. The mobile
Shorts tab reproduced at 186x278.

**One box did not. The channel Shorts tab measured 208x311 at both 1280 and 1440, not 214x321.** The
ratio is unchanged at 0.669, so this is the same 2:3 desktop crop at a slightly smaller tile, and it
is consistent across both widths and 96 cards, in both of today's runs. No New badge was found on
that surface on any profile, so no number in this document rests on it. It is recorded here because
the measured sizes file's first stated limit is "one sample, one day", and this is the second time
that limit has been demonstrated rather than merely stated. **Anyone re-deriving the Shorts tab tile
should re-measure it rather than trust either value.**

## Sample and limits, stated so nobody over-trusts this

- **One run, one day, logged out, `en-US`, headless Chromium.** 455 cards across 18 surface and
  profile combinations, 101 visible chips, 24 of them measurable.
- **The chip COUNT is the least stable thing here, and it moves with what YouTube had rendered, not
  with the badge.** Four runs of the same sweep within the hour returned 43, 55, 57 and 101 visible
  chips, because the watch page related rail renders a different amount of itself each time and
  because search returns a different mix of Shorts and landscape results. The GEOMETRY was identical
  on every chip in every run: same text, same corner, same insets, same two skins. Read the geometry
  as measured and the counts as one sample.
- **The 64 unmeasurable chips are a limit of the harness, not a finding about the badge.** Scrolling
  further, or waiting longer for the related rail to load its covers, would convert some of them
  into measurements. Nothing suggests they differ from the 24.
- **Nothing here explains the trigger.** The sighting calls it "videos that are considered new to
  them", which reads as per viewer. This run neither confirms nor refutes that, and the tool does
  not need it to: the badge is drawn as decoration behind a show and hide control, exactly as the
  duration badge draws a placeholder time. That control does not depend on the badge being rare,
  and on this evidence it is not.
- **The badge may vanish.** The total absence of vendor communication alongside a same week sighting
  is consistent with a live experiment. The date and the command at the top of this file are here so
  a later reader can re-run it and find out rather than inherit a number.
- **The 72px stress tile is out of scope**, for the reason the duration badge document gives: its
  rail already says it is not a YouTube context.
