// Ported from nick-vogel/nlvogel-site's `src/components/tools/Toolbar.tsx` at `6d5d921`.
import { Maximize2, Minimize2 } from 'lucide-react'
import { SegmentedControl } from './segmented-control.tsx'
import type { Conversion, Mode, NewBadgeVisibility, Preview, Surface } from './slot-state.ts'

const FORMAT_OPTIONS = [
  { value: 'landscape', label: 'Landscape' },
  { value: 'shorts', label: 'Shorts' },
] as const satisfies readonly { value: Mode; label: string }[]

const PREVIEW_OPTIONS = [
  { value: 'color', label: 'Color' },
  { value: 'grayscale', label: 'Grayscale' },
] as const satisfies readonly { value: Preview; label: string }[]

/**
 * Offered only while Preview is Grayscale, absent rather than disabled in Color: a press there
 * would change nothing visible, which reads as broken, and a disabled state's encoding is the kind
 * of thing grayscale flattens. These three labels, not shorter ones: they do not fit one line at
 * 375px, and Nick kept them and accepted the wrap (2026-08-23), which `.t-seg`'s `flex-wrap`
 * absorbs. The shipped conversion first, then the two filters.
 */
const CONVERSION_OPTIONS = [
  { value: 'luminance', label: 'Luminance' },
  { value: 'red', label: 'Red filter' },
  { value: 'blue', label: 'Blue filter' },
] as const satisfies readonly { value: Conversion; label: string }[]

/**
 * Offered only in Landscape: the measurement found the badge on no Shorts surface the tool draws,
 * so in Shorts the control would toggle nothing visible. A segmented pair, not a checkbox, since
 * every other control in the strip is one. The label quotes the word, because the chip's text is
 * the word itself and `New badge` reads as a badge that is new (Nick, 2026-09-19). Show first: it
 * is the default, and Hide is the returning viewer's tile, the comparison a creator opts into.
 */
const NEW_BADGE_OPTIONS = [
  { value: 'show', label: 'Show' },
  { value: 'hide', label: 'Hide' },
] as const satisfies readonly { value: NewBadgeVisibility; label: string }[]

/**
 * The stage opens on the surface the page's theme resolves to, and then belongs to this control
 * alone: the page around the tool is hidden and inert while it shows.
 */
const BACKGROUND_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const satisfies readonly { value: Surface; label: string }[]

/**
 * One claim in two places, and a person keeps them in step: the tool page's prose section "What
 * is the difference between the three conversions?" in `apps/site/tools/thumbnail-preview.html`
 * makes it at length. If you edit that section, re-read this sentence, and if you edit this
 * sentence, re-read that section. No test asserts their agreement, by Nick's call of 2026-09-01.
 * Static rather than per-conversion, so the creator reads it before choosing. The filter matches
 * the subject, not the background: each one lifts its own temperature off the opposite one.
 */
const CONVERSION_HINT =
  'Start with luminance. If the subject and background come out the same gray, switch: red for a warm subject, blue for a cool one.'

/**
 * Shown only when detection chose Shorts, never after the creator chose it: telling someone the
 * tool set a mode they just set themselves reads as the tool not having noticed.
 */
const DETECTED_SHORTS_HINT = 'Shorts was set from your first image. Switch back any time.'

type Props = {
  mode: Mode
  modeWasDetected: boolean
  onModeChange: (mode: Mode) => void
  preview: Preview
  onPreviewChange: (preview: Preview) => void
  conversion: Conversion
  onConversionChange: (conversion: Conversion) => void
  newBadge: NewBadgeVisibility
  onNewBadgeChange: (newBadge: NewBadgeVisibility) => void
  inFocusMode: boolean
  onEnterFocus: () => void
  onExitFocus: () => void
  surface: Surface
  onSurfaceChange: (surface: Surface) => void
}

/**
 * The strip between the notices and the rails. It renders on the empty tool too (Nick,
 * 2026-08-12, on nlvogel.com): any use of the Format control ends detection "whether or not
 * detection has run", and a strip gated on a loaded image could never be the thing that ended it,
 * since a decode always ends detection first. It also lets a creator who knows they are working on
 * Shorts say so before loading anything.
 *
 * One strip in and out of focus mode, its class swapped, so Format, Preview and the rest keep
 * their state across the boundary and the next control has one place to be added.
 */
export function Toolbar({
  mode,
  modeWasDetected,
  onModeChange,
  preview,
  onPreviewChange,
  conversion,
  onConversionChange,
  newBadge,
  onNewBadgeChange,
  inFocusMode,
  onEnterFocus,
  onExitFocus,
  surface,
  onSurfaceChange,
}: Props) {
  return (
    <>
      <div className={inFocusMode ? 't-focusbar' : 't-toolbar'}>
        {inFocusMode ? (
          <SegmentedControl
            label="Background"
            onChange={onSurfaceChange}
            options={BACKGROUND_OPTIONS}
            value={surface}
          />
        ) : null}
        <SegmentedControl
          label="Format"
          onChange={onModeChange}
          options={FORMAT_OPTIONS}
          value={mode}
        />
        <SegmentedControl
          label="Preview"
          onChange={onPreviewChange}
          options={PREVIEW_OPTIONS}
          value={preview}
        />
        {preview === 'grayscale' ? (
          <SegmentedControl
            label="Conversion"
            onChange={onConversionChange}
            options={CONVERSION_OPTIONS}
            value={conversion}
          />
        ) : null}
        {mode === 'landscape' ? (
          <SegmentedControl
            label={'"New" badge'}
            onChange={onNewBadgeChange}
            options={NEW_BADGE_OPTIONS}
            value={newBadge}
          />
        ) : null}
        <span className="t-toolbar__spacer" />
        {/* Distinct keys, so exiting unmounts one button and mounts the other, and focus lands
            back on "Focus mode" because `ThumbnailTool` puts it there. Without them React reuses
            the node and focus survives by accident: on nlvogel.com a mutation run deleted the
            restore and nothing noticed. */}
        {inFocusMode ? (
          <button
            className="t-button t-focusbar__exit"
            key="exit-focus"
            onClick={onExitFocus}
            type="button"
          >
            <Minimize2 aria-hidden="true" size={16} />
            Exit focus mode
          </button>
        ) : (
          <button
            className="t-button t-toolbar__focus"
            key="enter-focus"
            onClick={onEnterFocus}
            type="button"
          >
            <Maximize2 aria-hidden="true" size={16} />
            Focus mode
          </button>
        )}
      </div>
      {/* Above the Shorts hint: this one explains the control directly above it. Both can show at
          once, since their conditions are independent. Not in focus mode: it is guidance for the
          composed page, not the stripped-back stage. */}
      {preview === 'grayscale' && !inFocusMode ? <p className="t-hint">{CONVERSION_HINT}</p> : null}
      {mode === 'shorts' && modeWasDetected ? (
        <p className="t-hint">{DETECTED_SHORTS_HINT}</p>
      ) : null}
    </>
  )
}
