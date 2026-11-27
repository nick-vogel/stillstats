// Ported from nick-vogel/nlvogel-site's `src/components/tools/Rails.tsx` at `6d5d921`. The AC
// numbers these comments cite are nlvogel-site's.
import { TriangleAlert } from 'lucide-react'
import { type CSSProperties, type RefObject, useEffect, useRef, useState } from 'react'
import { durationBadgeBox, newBadgeBox } from './badge-placement.ts'
import { TILE_MARKER } from './mismatch-notice.ts'
import {
  isMismatched,
  type Mode,
  type NewBadgeVisibility,
  SLOT_IDS,
  type SlotId,
  type ToolState,
} from './slot-state.ts'
import {
  DURATION_BADGE,
  DURATION_BADGE_TEXT,
  LANDSCAPE_TILES,
  MASTER_LANDSCAPE,
  MASTER_SHORTS,
  NEW_BADGE,
  SHORTS_CROP_BAND_FRACTION,
  SHORTS_TILES,
  type TileSize,
} from './thumbnail-sizes.ts'

type Candidate = { id: SlotId; url: string; title: string; cropped: boolean }

/** The filled slots, in A, B, C order. An empty slot has no tile. */
const candidatesOf = (state: ToolState): Candidate[] =>
  SLOT_IDS.flatMap((id) => {
    const { image, title } = state.slots[id]
    return image ? [{ id, url: image.url, title, cropped: isMismatched(image, state.mode) }] : []
  })

/**
 * The marker on a mismatched tile. It names what the tile does to the image, so it is the same
 * word in every mode; the chip's marker names what the image is, and varies. The icon is hidden
 * from assistive technology, since the word already says it.
 */
function CropMarker() {
  return (
    <span className="t-warnmark">
      <TriangleAlert size={12} aria-hidden="true" />
      {TILE_MARKER}
    </span>
  )
}

/**
 * Whether a rail's track is wider than its box, the browser's own answer. `contents` re-runs the
 * measure when the track's content changes: a `ResizeObserver` on the track sees its box, which is
 * the same with one candidate as with three, so a rail that mounted short would otherwise never
 * become scrollable, or reachable by keyboard.
 */
const useOverflowing = (contents: string): [RefObject<HTMLDivElement | null>, boolean] => {
  const ref = useRef<HTMLDivElement | null>(null)
  const [overflowing, setOverflowing] = useState(false)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `contents` is the re-measure trigger.
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const measure = () => setOverflowing(node.scrollWidth > node.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [contents])

  return [ref, overflowing]
}

/**
 * What a track holds, in the two respects that change its width: which candidates, and whether
 * each has a title, since a beside card widens by its column only when one is shown.
 */
const trackSignature = (candidates: Candidate[]): string =>
  candidates.map((c) => `${c.id}${c.title ? ':titled' : ''}`).join('|')

/**
 * A card is tile plus title, and only the card grows: a beside card is tile + gap + column, the
 * tile image never changes size. An overlay card takes no gap, since an overlay's `gapPx` is its
 * bottom anchor, not a flex gap.
 */
const cardStyle = (size: TileSize, candidate: Candidate): CSSProperties => {
  if (!candidate.title) return { width: `${size.width}px` }
  const { placement, gapPx, columnPx } = size.title
  if (placement === 'beside') {
    return { width: `${size.width + gapPx + columnPx}px`, gap: `${gapPx}px` }
  }
  if (placement === 'overlay') return { width: `${size.width}px` }
  return { width: `${size.width}px`, gap: `${gapPx}px` }
}

const cardClass = (size: TileSize, candidate: Candidate): string => {
  if (!candidate.title) return 't-card'
  if (size.title.placement === 'beside') return 't-card t-card--beside'
  if (size.title.placement === 'overlay') return 't-card t-card--overlay'
  return 't-card'
}

/**
 * The title, set the way YouTube sets it for this surface. Every value comes from the size table,
 * which traces each one to `docs/research/youtube-title-typography.md`. The clamp needs the
 * `-webkit-box` display the sheet gives `.t-vtitle`. An overlay is anchored from the bottom, so its
 * offset does not depend on how many lines the title renders.
 */
function TileTitle({ size, title }: { size: TileSize; title: string }) {
  const spec = size.title
  const overlay =
    spec.placement === 'overlay'
      ? { bottom: `${spec.gapPx}px`, left: `${spec.insetLeftPx ?? 0}px` }
      : null

  return (
    <figcaption
      className="t-vtitle"
      style={{
        width: `${spec.columnPx}px`,
        fontSize: `${spec.fontSizePx}px`,
        fontWeight: spec.fontWeight,
        lineHeight: `${spec.lineHeightPx}px`,
        WebkitLineClamp: spec.lineClamp,
        color: `var(${spec.colorVar})`,
        ...overlay,
      }}
    >
      {title}
    </figcaption>
  )
}

/**
 * The description snippet's placeholder, on the one surface that has one: decoration, so hidden
 * from assistive technology. It renders before the image because the title is the `figcaption`,
 * which HTML puts first or last in its `figure`; the grid places it.
 */
function DescriptionSkeleton({ lines }: { lines: number }) {
  return (
    <span aria-hidden="true" className="t-vdesc">
      {Array.from({ length: lines }, (_, index) => (
        <span
          className={`t-vdesc__line${index === lines - 1 ? ' t-vdesc__line--last' : ''}`}
          // biome-ignore lint/suspicious/noArrayIndexKey: the bars are identical and never reorder.
          key={index}
        />
      ))}
    </span>
  )
}

/**
 * YouTube's duration badge, the one piece of its chrome drawn on the image, so the one a creator
 * designs around. Positioned from the card, not from a wrapper around the image, which would make
 * the wrapper the grid item and move every measured box. `aria-hidden`: the duration is a
 * placeholder, and announcing it would state a fact about the video nobody supplied.
 */
function DurationBadge({ size, hasTitle }: { size: TileSize; hasTitle: boolean }) {
  const box = durationBadgeBox(size, hasTitle)
  if (!box) return null
  return (
    <span
      aria-hidden="true"
      className="t-badge"
      style={{
        top: `${box.topPx}px`,
        right: `${box.rightPx}px`,
        height: `${DURATION_BADGE.heightPx}px`,
        fontSize: `${DURATION_BADGE.fontSizePx}px`,
        fontWeight: DURATION_BADGE.fontWeight,
        borderRadius: `${DURATION_BADGE.radiusPx}px`,
        padding: `${DURATION_BADGE.paddingYPx}px ${DURATION_BADGE.paddingXPx}px`,
        background: `var(${DURATION_BADGE.backgroundVar})`,
        color: `var(${DURATION_BADGE.colorVar})`,
      }}
    >
      {DURATION_BADGE_TEXT}
    </span>
  )
}

/**
 * YouTube's "New" badge, painted on the image as the duration badge is. Hidden means not
 * rendered: Hide is the tile a returning viewer gets, which has no chip. `aria-hidden`, since
 * YouTube draws it per viewer by a rule the tool does not know, so the word claims nothing.
 */
function NewBadge({ size, visibility }: { size: TileSize; visibility: NewBadgeVisibility }) {
  const box = newBadgeBox(size, visibility)
  if (!box || !size.newBadge) return null
  return (
    <span
      aria-hidden="true"
      className="t-newbadge"
      style={{
        top: `${box.topPx}px`,
        left: `${box.leftPx}px`,
        height: `${NEW_BADGE.heightPx}px`,
        fontSize: `${NEW_BADGE.fontSizePx}px`,
        fontWeight: NEW_BADGE.fontWeight,
        borderRadius: `${NEW_BADGE.radiusPx}px`,
        padding: `${NEW_BADGE.paddingYPx}px ${NEW_BADGE.paddingXPx}px`,
        background: `var(${size.newBadge.backgroundVar})`,
        color: `var(${size.newBadge.colorVar})`,
      }}
    >
      {NEW_BADGE.text}
    </span>
  )
}

/** A rail that scrolls is a tab stop with its group name, so a keyboard can reach what it hides. */
const scrollableTrack = (label: string) => ({
  tabIndex: 0,
  role: 'group',
  'aria-label': `${label}, scrollable`,
})

function Rail({
  size,
  candidates,
  newBadge,
}: {
  size: TileSize
  candidates: Candidate[]
  newBadge: NewBadgeVisibility
}) {
  const [ref, overflowing] = useOverflowing(trackSignature(candidates))
  // The stress plate wraps rather than scrolling, so it never takes a tab stop that does nothing.
  const scrollable = !size.plate && overflowing

  return (
    <section className={`t-rail${size.plate ? ' t-plate' : ''}`}>
      <header className="t-rail__head">
        <span className="t-rail__ctx">{size.context}</span>
        <span className="t-rail__px">{size.dimensions}</span>
        {scrollable ? <span className="t-rail__scroll">scroll →</span> : null}
      </header>

      {/* The plate publishes its tile width for its wrapping track, so the sheet never holds a
          second copy of the measured 72. */}
      <div
        className="t-rail__track"
        ref={ref}
        style={size.plate ? ({ '--t-plate-col': `${size.width}px` } as CSSProperties) : undefined}
        {...(scrollable ? scrollableTrack(size.context) : {})}
      >
        {candidates.map((candidate) => (
          <div className="t-tile" key={candidate.id}>
            <span className="t-tile__head">
              <span className="t-tag">{candidate.id}</span>
              {candidate.cropped ? <CropMarker /> : null}
            </span>
            <figure className={cardClass(size, candidate)} style={cardStyle(size, candidate)}>
              {size.descriptionLines && candidate.title ? (
                <DescriptionSkeleton lines={size.descriptionLines} />
              ) : null}
              {/* The width in pixels, and the height from `aspect-ratio`, never a second number
                  that could disagree with the box. */}
              <img
                src={candidate.url}
                alt={`Thumbnail ${candidate.id} at ${size.width}px`}
                style={{ width: `${size.width}px`, aspectRatio: size.ratio }}
              />
              {/* Both badges after the image and before the title, which is the `figcaption` and so
                  first or last in its `figure`. They are positioned, so the order costs nothing. */}
              <DurationBadge hasTitle={Boolean(candidate.title)} size={size} />
              <NewBadge size={size} visibility={newBadge} />
              {candidate.title ? <TileTitle size={size} title={candidate.title} /> : null}
            </figure>
          </div>
        ))}
      </div>
    </section>
  )
}

/** The caption under the Shorts reference: what the bands mean, then what survives. */
const SHORTS_CROP_CAPTION =
  'Shaded bands show what every 2:3 grid crops away. The full 9:16 frame survives only in mobile suggested.'

/**
 * The two crop bands over the 9:16 reference. Not a warning state: the crop is normal and
 * unavoidable. The height is the size table's arithmetic, so a band cannot disagree with the crop
 * it depicts.
 */
function CropBands() {
  const height = `${SHORTS_CROP_BAND_FRACTION * 100}%`
  return (
    <>
      <span className="t-cropband t-cropband--top" style={{ height }} />
      <span className="t-cropband t-cropband--btm" style={{ height }} />
    </>
  )
}

/**
 * The scaled reference, the one rail whose tiles are not true-pixel, so it says "not to scale". It
 * carries no title: YouTube shows no full-size thumbnail beside a title, so any type it carried
 * would be invented. Nor a "Cropped" marker, since a scaled reference shows the whole frame.
 */
function ScaledReference({ candidates, mode }: { candidates: Candidate[]; mode: Mode }) {
  const [ref, overflowing] = useOverflowing(trackSignature(candidates))
  const master = mode === 'shorts' ? MASTER_SHORTS : MASTER_LANDSCAPE
  const shortsFrame = mode === 'shorts'

  return (
    <section className="t-rail t-rail--scaled">
      <header className="t-rail__head">
        <span className="t-rail__ctx">Full size</span>
        <span className="t-rail__px">
          {master.width} x {master.height} (not to scale)
        </span>
        {overflowing ? <span className="t-rail__scroll">scroll →</span> : null}
      </header>
      <div
        className="t-rail__track"
        ref={ref}
        {...(overflowing ? scrollableTrack('Full size') : {})}
      >
        {candidates.map((candidate) => (
          <div className="t-tile" key={candidate.id}>
            <span className="t-tile__head">
              <span className="t-tag">{candidate.id}</span>
            </span>
            <figure
              className={`t-card t-card--scaled${shortsFrame ? ' t-card--scaled-shorts' : ''}`}
            >
              {shortsFrame ? (
                <span className="t-cropwrap">
                  <img
                    src={candidate.url}
                    alt={`Thumbnail ${candidate.id} at full size`}
                    style={{ aspectRatio: `${master.width}/${master.height}` }}
                  />
                  <CropBands />
                </span>
              ) : (
                <img
                  src={candidate.url}
                  alt={`Thumbnail ${candidate.id} at full size`}
                  style={{ aspectRatio: `${master.width}/${master.height}` }}
                />
              )}
            </figure>
          </div>
        ))}
      </div>
      {shortsFrame ? <p className="t-rail__cap">{SHORTS_CROP_CAPTION}</p> : null}
    </section>
  )
}

/** Each set comes whole from the size table: `SHORTS_TILES` holds two aspect ratios. */
const tilesFor = (mode: Mode): readonly TileSize[] =>
  mode === 'shorts' ? SHORTS_TILES : LANDSCAPE_TILES

/**
 * One rail per size, each holding every filled candidate at that size, then the scaled
 * reference. A tile is a true-pixel box and never scales to fit: at 375px the rail scrolls. The
 * scaled reference carries no badge, since YouTube draws none on a full-size frame.
 */
export function Rails({ state }: { state: ToolState }) {
  const candidates = candidatesOf(state)
  if (candidates.length === 0) return null

  return (
    <div className="t-rails">
      {tilesFor(state.mode).map((size) => (
        <Rail candidates={candidates} key={size.width} newBadge={state.newBadge} size={size} />
      ))}
      <ScaledReference candidates={candidates} mode={state.mode} />
    </div>
  )
}
