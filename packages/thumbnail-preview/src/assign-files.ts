// Moved from nick-vogel/nlvogel-site at `6d5d921`. The AC and issue numbers, the gate, the check
// scripts and any path outside `docs/research/` and this package that these comments cite are
// nlvogel-site's.

/**
 * Where a dropped set of files goes, and what the tool says about it.
 *
 * PURE, AND SEPARATE FROM THE UI, because the rules have more cases than the
 * screen shows. Five files onto an empty tool, three onto a filled slot A, a
 * rejected first file, a set that is entirely rejected: each produces a
 * different assignment and a different pair of messages, and none of that is
 * visible in a component that mostly renders three boxes.
 *
 * REJECTED FILES ARE REMOVED FROM THE SET FIRST, THEN THE ACCEPTED FILES FILL
 * THE SLOTS. Assignment is sequential over ACCEPTED files, never positional
 * over dropped files. The difference is the whole rule: dropping an SVG and a
 * PNG in that order must put the PNG in slot A, not leave A empty because
 * position one was refused.
 */

/**
 * The `.ts` extensions are load-bearing: this module is imported by a
 * `node --test` suite, which resolves specifiers itself rather than through the
 * bundler, so an extensionless relative import fails there while typechecking
 * and building cleanly.
 */
import { acceptImage, type CandidateFile } from './accept-image.ts'
import { SLOT_IDS, type SlotId, type ToolState } from './slot-state.ts'

export type Rejection = {
  name: string
  message: string
}

/**
 * GENERIC OVER THE FILE TYPE, so a caller passing real `File` objects gets real
 * `File` objects back. The module only ever reads `name`, `type` and `size`,
 * which is what makes it testable with plain objects; widening the return to
 * the structural type instead would force the component to cast a `File` back
 * to a `File`, and a cast is where a genuine mismatch would hide.
 */
export type AssignmentPlan<T extends CandidateFile = CandidateFile> = {
  /** Accepted files paired with the slot each one takes, in order. */
  assignments: { slot: SlotId; file: T }[]
  /** Refused by the ladder. These never consume a slot. */
  rejected: Rejection[]
  /** ACCEPTED files with no slot left to take. */
  overflow: number
  /**
   * How many files were DROPPED, which is not the accepted count.
   *
   * Carried separately because the remainder message opens "You dropped N
   * files", and deriving N from `assignments.length + overflow` counts only the
   * accepted ones: six files with one SVG among them reported "You dropped five
   * files."
   */
  dropped: number
}

/**
 * The order slots are filled in.
 *
 * A drop aimed at a slot starts THERE, whether or not it is already full: the
 * creator pointed at it, and on a filled slot that is a replace. Everything
 * after the first file goes to the empty slots in A, B, C order, which is why
 * the target is removed from that tail rather than being allowed to appear
 * twice.
 */
const slotOrder = (state: ToolState, target: SlotId | null): SlotId[] => {
  const empty = SLOT_IDS.filter((id) => state.slots[id].image === null && id !== target)
  return target ? [target, ...empty] : empty
}

export const planAssignment = <T extends CandidateFile>(
  files: T[],
  state: ToolState,
  target: SlotId | null = null,
): AssignmentPlan<T> => {
  const accepted: T[] = []
  const rejected: Rejection[] = []

  for (const file of files) {
    const verdict = acceptImage(file)
    if (verdict.outcome === 'reject') {
      rejected.push({ name: file.name, message: verdict.message })
      continue
    }
    /**
     * `needs-decode` counts as ACCEPTED here, and that is not a shortcut. The
     * spec draws the line at the ladder: a ladder rejection never consumes a
     * slot, a decode failure does. A file the ladder cannot judge has not been
     * rejected, so it takes its slot and the decode settles it.
     */
    accepted.push(file)
  }

  const order = slotOrder(state, target)
  const assignments = accepted
    .slice(0, order.length)
    .map((file, index) => ({ slot: order[index] as SlotId, file }))

  return {
    assignments,
    rejected,
    overflow: accepted.length - assignments.length,
    dropped: files.length,
  }
}

/**
 * Spelled, up to five, because a numeral in a sentence reads as a measurement
 * on a page whose numerals are all pixel counts. Above five it falls back to
 * digits rather than growing a word list nobody will maintain.
 */
const COUNT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five']
const spell = (n: number): string => COUNT_WORDS[n] ?? String(n)

/**
 * The rejection message, or `null` when nothing was rejected.
 *
 * IT NAMES THE FILES. "Some files were skipped" makes the creator work out
 * which, and they are looking at a Finder window with eight similar names in
 * it. A single rejection also carries its REASON, which is the actionable half;
 * with several reasons in play the sentence names the files and gives the
 * shared constraint, because three stacked explanations is not a message.
 */
export const rejectionMessage = (rejected: Rejection[]): string | null => {
  if (rejected.length === 0) return null

  const names = rejected.map((r) => r.name)
  if (rejected.length === 1)
    return `${names[0]} was not added. ${(rejected[0] as Rejection).message}`

  const reasons = new Set(rejected.map((r) => r.message))
  if (reasons.size === 1) return `${names.join(', ')} were not added. ${[...reasons][0]}`

  return `${names.join(', ')} were not added. Use a JPG, PNG, WebP, AVIF or GIF of 25 MB or less.`
}

/**
 * The remainder message, or `null` when every accepted file found a slot.
 *
 * SEPARATE FROM THE REJECTION MESSAGE, and shown only when its own condition
 * occurred. Folding them into one sentence means a drop of five valid files
 * reads as though something was wrong with two of them, when the tool simply
 * holds three.
 */
export const overflowMessage = (plan: AssignmentPlan<CandidateFile>): string | null => {
  if (plan.overflow <= 0) return null

  const took = plan.assignments.map((a) => a.slot)
  const files = (n: number) => `${spell(n)} ${n === 1 ? 'file' : 'files'}`

  /**
   * NOTHING WAS TAKEN, so there is no "A, B and C took the first three" clause
   * to write. This is the full tool: three slots filled and another image
   * arriving, which the document-level Ctrl+V reaches whether or not any paste
   * control is on screen.
   *
   * The general sentence degenerated badly here. With no assignments,
   * `took[0]` is `undefined` and `spell(0)` is "zero", so it read: "You dropped
   * one files. undefined took the first zero." A creator pasting into a full
   * tool saw the word "undefined" in the interface.
   */
  if (took.length === 0) {
    return `The tool holds three thumbnails at a time and all three slots are full. Remove one, then add ${plan.overflow === 1 ? 'this image' : 'these images'}.`
  }

  const taken =
    took.length > 1 ? `${took.slice(0, -1).join(', ')} and ${took[took.length - 1]}` : took[0]

  return `You dropped ${files(plan.dropped)}. ${taken} took the first ${spell(took.length)}. The tool holds three at a time, so the other ${spell(plan.overflow)} ${plan.overflow === 1 ? 'was' : 'were'} not added.`
}
