import type { LoadSource, Mode, Preview, SlotId, Surface } from './slot-state.ts'

/**
 * The slot as the events report it: lowercase, as nlvogel.com sent it
 * (`slot.toLowerCase()`), so an event reads the same before and after the tool moved here.
 */
type EventSlot = Lowercase<SlotId>

/**
 * Every event the tool reports, shaped for OpenPanel's `track(name, properties)`. Each property is
 * a boolean or one of the tool's own closed vocabularies, so no event can carry an image, a file
 * name or the text of a title.
 */
export type ThumbnailToolEvent =
  | {
      name: 'thumbnail_load'
      properties: { slot: EventSlot; mode: Mode; detected: boolean; source: LoadSource }
    }
  | { name: 'thumbnail_title_entered'; properties: { slot: EventSlot } }
  | { name: 'thumbnail_mode_switch'; properties: { from: Mode; to: Mode } }
  | { name: 'thumbnail_grayscale_toggle'; properties: { on: boolean } }
  | { name: 'thumbnail_focus_toggle'; properties: { on: boolean; surface: Surface } }

/**
 * `thumbnail_mode_switch` for a press on the Format control or a mismatch notice's action, or
 * `null` when the press is on the mode already in force. The event fires on a real switch and the
 * latch on every press, two different conditions: an event whose `from` and `to` hold the same
 * value is a switch that did not switch, and it would inflate the one count the event answers
 * (nlvogel.com's rule, `ThumbnailTool.tsx` `onModeChange` at `6d5d921`).
 */
export const modeSwitchEvent = (from: Mode, to: Mode): ThumbnailToolEvent | null =>
  from === to ? null : { name: 'thumbnail_mode_switch', properties: { from, to } }

/**
 * `thumbnail_grayscale_toggle` for a press on the Preview control, or `null` when the press is on
 * the preview already in force: a re-selection is not a toggle, so it counts nothing, by the same
 * rule as `modeSwitchEvent` (nlvogel.com's `onPreviewChange` at `6d5d921`).
 */
export const grayscaleToggleEvent = (from: Preview, to: Preview): ThumbnailToolEvent | null =>
  from === to
    ? null
    : { name: 'thumbnail_grayscale_toggle', properties: { on: to === 'grayscale' } }
