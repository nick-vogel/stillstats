// Ported from nick-vogel/nlvogel-site's `src/components/tools/TitleFields.tsx` at `6d5d921`. The AC
// numbers these comments cite are nlvogel-site's.
import { SLOT_IDS, type SlotId } from './slot-state.ts'

type Props = {
  titles: Record<SlotId, string>
  onTitleChange: (slot: SlotId, title: string) => void
  /**
   * A COMMITTED title, wired to blur. React's `onChange` on a text input is the native `input`
   * event, so it fires per keystroke; this is the only path that may reach analytics, or
   * `thumbnail_title_entered` would send one event per character.
   */
  onTitleCommit: (slot: SlotId, title: string) => void
}

const TITLE_MAX_LENGTH = 100

/**
 * A carries a realistic example, because "Title for thumbnail A" teaches nothing about what the
 * field is for. B and C are quiet: the example three times reads as three instructions.
 */
const PLACEHOLDERS: Record<SlotId, string> = {
  A: 'e.g. I rebuilt my entire workflow in one weekend',
  B: 'Title for thumbnail B',
  C: 'Title for thumbnail C',
}

/**
 * The three optional title fields, shown at all times: a title is what a creator iterates on
 * hardest, so it is never behind a disclosure once an image loads.
 *
 * THE CAP IS THE NATIVE `maxLength`, never a truncate in `onChange`, which would cut an IME
 * composition a writer is still assembling. The browser's cap is composition-aware and applies to
 * paste as well.
 */
export function TitleFields({ titles, onTitleChange, onTitleCommit }: Props) {
  return (
    <div className="t-titles">
      {SLOT_IDS.map((id) => (
        <div className="t-titlefield" key={id}>
          <label htmlFor={`title-${id}`}>Title {id}</label>
          <input
            id={`title-${id}`}
            className="t-input"
            type="text"
            maxLength={TITLE_MAX_LENGTH}
            placeholder={PLACEHOLDERS[id]}
            value={titles[id]}
            onChange={(event) => onTitleChange(id, event.target.value)}
            onBlur={(event) => onTitleCommit(id, event.target.value)}
          />
        </div>
      ))}

      {/* It may not say the title renders "under" the thumbnail: five of the nine measured
          surfaces put it beside or on the thumbnail. */}
      <p className="t-titles__hint">
        Optional. Each title renders the way YouTube sets it for that surface, so you can judge the
        thumbnail and the title together.
      </p>
    </div>
  )
}
