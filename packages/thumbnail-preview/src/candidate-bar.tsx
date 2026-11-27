// Ported from nick-vogel/nlvogel-site's `src/components/tools/CandidateBar.tsx` at `6d5d921`.
import { TriangleAlert, Upload } from 'lucide-react'
import { Fragment } from 'react'
import { mismatchNotice } from './mismatch-notice.ts'
import {
  firstEmptySlot,
  isMismatched,
  SLOT_IDS,
  type SlotId,
  type ToolState,
} from './slot-state.ts'
import { type FilesHandler, useDropZones, useFilePickers } from './slots.tsx'

type Props = {
  state: ToolState
  onFiles: FilesHandler
  onPaste: (slot: SlotId) => void
  onRemove: (slot: SlotId) => void
}

/**
 * The candidate bar, which replaces the drop zones once any slot fills, so the tiles the creator
 * came for are not pushed below the fold. Each chip is a drop target too, or drag and drop would
 * stop working the moment the tool holds an image. Replace and Remove are two controls because
 * they treat the title differently: Replace keeps it, Remove empties the slot.
 */
export function CandidateBar({ state, onFiles, onPaste, onRemove }: Props) {
  const { over, dropHandlers } = useDropZones(onFiles)
  const { open, picker } = useFilePickers(onFiles)
  const firstEmpty = firstEmptySlot(state)

  return (
    <div className="t-candbar">
      {SLOT_IDS.map((id) => {
        const slot = state.slots[id]

        if (!slot.image) {
          return (
            <Fragment key={id}>
              <button
                type="button"
                className={`t-chip t-chip--add${over === id ? ' t-chip--over' : ''}`}
                data-slot={id}
                onClick={() => open(id)}
                {...dropHandlers(id)}
              >
                <Upload size={15} aria-hidden="true" />
                Add {id}
              </button>
              {picker(id)}
            </Fragment>
          )
        }

        return (
          <div
            className={`t-chip${over === id ? ' t-chip--over' : ''}`}
            key={id}
            data-slot={id}
            {...dropHandlers(id)}
          >
            {/* The slot letter alone: a chip marks identity, and a width it does not render at
                would be a false description. */}
            <img src={slot.image.url} alt={`Thumbnail ${id}`} />
            <span className="t-tag">{id}</span>
            <span className="t-chip__name">{slot.image.name}</span>
            {/* What the image is ("Vertical", "Landscape" or "Cropped"), where the tile's marker
                says what the tile does. A sibling of the name, not a child: the name truncates
                with an ellipsis, which a flex container cannot. */}
            {isMismatched(slot.image, state.mode) ? (
              <span className="t-warnmark">
                <TriangleAlert size={12} aria-hidden="true" />
                {mismatchNotice(id, slot.image, state.mode).chipMarker}
              </span>
            ) : null}
            <button type="button" className="t-link" onClick={() => open(id)}>
              Replace
            </button>
            <button type="button" className="t-link t-chip__remove" onClick={() => onRemove(id)}>
              Remove
            </button>
            {picker(id)}
          </div>
        )
      })}

      {/* The first empty slot, not A: pasting into A here would replace a candidate the creator is
          comparing. */}
      {firstEmpty ? (
        <span className="t-candbar__hint">
          or paste with Ctrl+V.{' '}
          <button type="button" className="t-link" onClick={() => onPaste(firstEmpty)}>
            Paste from clipboard
          </button>
        </span>
      ) : null}
    </div>
  )
}
