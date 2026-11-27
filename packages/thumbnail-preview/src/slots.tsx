// Ported from nick-vogel/nlvogel-site's `src/components/tools/Slots.tsx` at `6d5d921`.
import { Clipboard, Upload } from 'lucide-react'
import { type DragEvent, useEffect, useRef, useState } from 'react'
import { ACCEPTED_MIME_TYPES } from './accept-image.ts'
import { createDropHighlight, type DropHighlight } from './drop-highlight.ts'
import { type LoadSource, SLOT_IDS, type SlotId } from './slot-state.ts'

/**
 * The two formats a creator exports a thumbnail as, not all five the tool accepts: this is the
 * first sentence a first-time visitor reads, and the file dialog's `accept` is where the full list
 * belongs.
 */
const HINT = 'JPG or PNG, up to 25 MB. Or press Ctrl/Cmd+V anywhere on the page.'

/** Derived from the ladder's own map, so the dialog can never filter out a format a drop accepts. */
export const ACCEPT_ATTRIBUTE = ACCEPTED_MIME_TYPES.join(',')

export type FilesHandler = (files: File[], slot: SlotId, source: LoadSource) => void

/**
 * A zone's drag handlers and the zone a drag lights, on a depth counter, so a `dragleave` from a
 * child does not unlight its zone. The window listeners recover a drag that never drops: `dragend`
 * for one that started in the page, a `dragleave` with no related target for a file dragged back
 * out of the window, and `drop` as the backstop.
 */
export function useDropZones(onFiles: FilesHandler) {
  const [over, setOver] = useState<SlotId | null>(null)
  const highlightRef = useRef<DropHighlight<SlotId> | null>(null)
  highlightRef.current ??= createDropHighlight<SlotId>()
  const highlight = highlightRef.current

  useEffect(() => {
    const recover = () => setOver(highlight.reset())
    const recoverIfLeftWindow = (event: globalThis.DragEvent) => {
      if (event.relatedTarget === null) recover()
    }
    window.addEventListener('dragend', recover)
    window.addEventListener('drop', recover)
    window.addEventListener('dragleave', recoverIfLeftWindow)
    return () => {
      window.removeEventListener('dragend', recover)
      window.removeEventListener('drop', recover)
      window.removeEventListener('dragleave', recoverIfLeftWindow)
    }
  }, [highlight])

  const dropHandlers = (id: SlotId) => ({
    onDragEnter: () => setOver(highlight.enter(id)),
    // `preventDefault` only, which makes the zone droppable. `dragover` fires continuously, so
    // lighting the zone here too would relight one the counter had just cleared.
    onDragOver: (event: DragEvent) => event.preventDefault(),
    onDragLeave: () => setOver(highlight.leave(id)),
    onDrop: (event: DragEvent) => {
      event.preventDefault()
      setOver(highlight.drop())
      onFiles([...event.dataTransfer.files], id, 'drop')
    },
  })

  return { over, dropHandlers }
}

/**
 * One hidden file input per slot, opened by a real button, since a visible file input reads as a
 * form field. It is reset after each pick, so choosing the same file again fires a change.
 */
export function useFilePickers(onFiles: FilesHandler) {
  const inputs = useRef<Partial<Record<SlotId, HTMLInputElement | null>>>({})
  const open = (id: SlotId) => inputs.current[id]?.click()
  const picker = (id: SlotId) => (
    <input
      ref={(node) => {
        inputs.current[id] = node
      }}
      type="file"
      multiple
      accept={ACCEPT_ATTRIBUTE}
      className="t-visually-hidden"
      tabIndex={-1}
      aria-hidden="true"
      onChange={(event) => {
        onFiles([...(event.target.files ?? [])], id, 'picker')
        event.target.value = ''
      }}
    />
  )
  return { open, picker }
}

type Props = {
  onFiles: FilesHandler
  onPaste: (slot: SlotId) => void
}

/**
 * The three drop zones, shown while every slot is empty. Slot A carries the weight: most people
 * arrive with one thumbnail. Paste is first-class, since a thumbnail in progress is usually in a
 * design tool rather than saved to disk.
 */
export function Slots({ onFiles, onPaste }: Props) {
  const { over, dropHandlers } = useDropZones(onFiles)
  const { open, picker } = useFilePickers(onFiles)

  return (
    <div className="t-slots">
      <div
        className={`t-slot${over === 'A' ? ' t-slot--over' : ''}`}
        data-slot="A"
        {...dropHandlers('A')}
      >
        <span className="t-tag">A</span>
        <Upload size={22} aria-hidden="true" />
        <span className="t-slot__big">Drop thumbnail A here</span>
        <div className="t-slot__actions">
          <button type="button" className="t-button" onClick={() => open('A')}>
            Choose a file
          </button>
          <button type="button" className="t-button t-button--ghost" onClick={() => onPaste('A')}>
            <Clipboard size={14} aria-hidden="true" />
            Paste from clipboard
          </button>
        </div>
        <span className="t-slot__hint">{HINT}</span>
        {picker('A')}
      </div>

      {SLOT_IDS.filter((id) => id !== 'A').map((id) => (
        <div
          key={id}
          className={`t-slot t-slot--quiet${over === id ? ' t-slot--over' : ''}`}
          data-slot={id}
          {...dropHandlers(id)}
        >
          <span className="t-tag">{id}</span>
          <span className="t-slot__quiettext">Drop thumbnail {id}</span>
          <span className="t-slot__actions">
            <button type="button" className="t-link" onClick={() => open(id)}>
              Choose a file
            </button>
            <button type="button" className="t-link" onClick={() => onPaste(id)}>
              Paste
            </button>
          </span>
          {picker(id)}
        </div>
      ))}
    </div>
  )
}
