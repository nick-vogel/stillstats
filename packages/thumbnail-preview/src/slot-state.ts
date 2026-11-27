// Moved from nick-vogel/nlvogel-site at `6d5d921`. The AC and issue numbers, the gate, the check
// scripts and any path outside `docs/research/` and this package that these comments cite are
// nlvogel-site's.

/**
 * One reducer owns the three slots, their titles, their object URLs and the
 * render mode, plus the two pure rules that read an image's shape: which mode it
 * selects, and whether it is mismatched against the mode in force.
 *
 * THE THREE ARE ONE PIECE OF STATE BECAUSE THEIR LIFETIMES INTERLOCK. An
 * object URL has to be revoked by whatever drops the image, a title has to
 * survive a replace and die on a remove, and a decode that resolves late has to
 * be discarded by whatever moved the slot on. Splitting them into three hooks
 * puts those decisions in three places and the leak lands in the seam.
 *
 * WHAT COUNTS AS "DROPPING AN IMAGE", because the list is longer than it looks:
 * replacing it, removing it, unmounting the tool, and navigating away on the
 * client. The last is the same code path as unmount in React, which is the only
 * reason it needs no separate action.
 *
 * REPLACE KEEPS THE TITLE, REMOVE CLEARS IT. Replacing an image is how a
 * creator iterates on a thumbnail against a fixed title, so wiping the title
 * there destroys the comparison they are in the middle of making. Removing
 * empties the slot, so the title goes with it. One lifecycle for both is the
 * defect that leaves a stale title sitting under a new image.
 */

import { MASTER_LANDSCAPE, MASTER_SHORTS } from './thumbnail-sizes.ts'

export const SLOT_IDS = ['A', 'B', 'C'] as const
export type SlotId = (typeof SLOT_IDS)[number]

export type SlotImage = {
  /** The object URL. The reducer revokes it; nothing else may. */
  url: string
  name: string
  width: number
  height: number
}

export type Slot = {
  image: SlotImage | null
  title: string
  /**
   * The generation of the decode currently in flight for this slot, or `null`
   * when nothing is in flight.
   *
   * WHY A GENERATION EXISTS AT ALL. The acceptance ladder runs BEFORE slot
   * assignment and the decode runs AFTER it, so a decode can resolve into a
   * slot that has already moved on. Three real sequences do it: a replace while
   * the first decode is pending, a clear while a decode is pending, and two
   * drops onto one slot in flight together. Each can land a stale image, revoke
   * the wrong URL, or leave two live URLs for one slot. AC 15's own gate leg
   * exercises a strict serial swap-and-clear and would catch none of them.
   *
   * WHY THE CALLER SUPPLIES IT RATHER THAN THE REDUCER COUNTING. Deriving the
   * generation from rendered state re-opens the race it exists to close: two
   * handlers firing against one render would read the same value and mint the
   * same generation, so the first decode would still be treated as current. The
   * caller takes it from a ref, which increments synchronously, so two attempts
   * in one tick get two generations.
   */
  pendingGeneration: number | null
}

export const MODES = ['landscape', 'shorts'] as const
export type Mode = (typeof MODES)[number]

/** `default` is also "detection has not run and nothing has ended it". */
export type ModeSource = 'default' | 'detected' | 'selected'

export const PREVIEWS = ['color', 'grayscale'] as const
export type Preview = (typeof PREVIEWS)[number]

/**
 * WHICH GRAYSCALE CONVERSION A GRAY RENDER USES, and it is SUBORDINATE TO
 * `Preview` rather than a second axis of it.
 *
 * `luminance` is the shipped Rec. 709 conversion, `red` and `blue` are the two
 * channel filters a creator reaches for when luminance flattens a design that
 * separates by hue. Selecting one never flips `Preview`: it changes how a gray
 * render converts and does nothing while the preview is colour.
 *
 * THREE VALUES RATHER THAN A BOOLEAN PAIR, because the three are one choice. A
 * `redFilter`/`blueFilter` pair would carry an invariant nothing enforces, and
 * the state where both are true has no meaning.
 */
export const CONVERSIONS = ['luminance', 'red', 'blue'] as const
export type Conversion = (typeof CONVERSIONS)[number]

/**
 * WHETHER THE RAILS DRAW YOUTUBE'S NEW BADGE (#63), and it is GLOBAL TO THE
 * TOOL rather than per slot.
 *
 * YouTube draws the chip per viewer: a viewer who has already watched the video
 * gets the tile without it. `show` is the first-sight view and `hide` is the
 * returning viewer's, and comparing three candidates under two different
 * chromes would defeat the tool's whole purpose, so one value covers every
 * slot. It controls the New badge ONLY. The duration badge has no control and
 * stays on in both states.
 *
 * TWO WORDS RATHER THAN A BOOLEAN, because the control is a segmented pair
 * whose options are these two words, and the reducer should speak the same
 * vocabulary the toolbar renders.
 */
export const NEW_BADGE_VISIBILITIES = ['show', 'hide'] as const
export type NewBadgeVisibility = (typeof NEW_BADGE_VISIBILITIES)[number]

/**
 * WHICH YOUTUBE SURFACE FOCUS MODE SIMULATES, and it is DELIBERATELY NOT A
 * `ToolState` FIELD.
 *
 * The name lives here because this module is the tool's vocabulary and a second
 * home for it is how `Mode` and `Preview` would have ended up spelled two ways.
 * The VALUE lives in `ThumbnailTool`'s component state, because entering focus
 * mode mutates DOM the page component does not own and leaving it has to undo
 * that. A reducer that has to be called for its side effects is not a reducer.
 */
export const SURFACES = ['light', 'dark'] as const
export type Surface = (typeof SURFACES)[number]

/**
 * HOW A FILE REACHED A SLOT, carried only so `thumbnail_load` can report it
 * (AC 22). No rendering and no reducer branch reads it.
 *
 * It is threaded as an argument rather than inferred at the analytics call
 * site, because by the time a decode resolves the originating event is long
 * gone. The three values are the three entry points the tool actually has: a
 * drag and drop, the file picker, and the clipboard.
 */
export const LOAD_SOURCES = ['drop', 'picker', 'paste'] as const
export type LoadSource = (typeof LOAD_SOURCES)[number]

/**
 * One landed image, as the REDUCER saw it. `thumbnail_load` is reported from
 * this and from nothing else.
 *
 * WHY THE REDUCER RECORDS IT RATHER THAN THE CALL SITE WORKING IT OUT. The
 * component's mirror of this state is assigned in a passive effect, so it lags
 * the tree by a scheduler task. Two decodes resolving inside that window both
 * read the pre-first-decode snapshot, so both would report `detected: true` and
 * the second would report a mode that never came into force. A three-file drop
 * does exactly that, and it is the tool's ordinary case rather than a corner.
 *
 * APPEND-ONLY, and never cleared. The component reports from a cursor it keeps
 * in a ref, so draining needs no action and no re-render, and a re-render
 * cannot replay an event. It grows by one entry per landed image for the life
 * of one page load, which is at most a handful.
 *
 * A STALE DECODE APPENDS NOTHING. Its image is revoked and no slot ever shows
 * it, so reporting a load for it would count an image the creator never saw.
 */
export type LoadReport = {
  slot: SlotId
  /** True when THIS load ran auto-detection, which happens at most once per page load. */
  detected: boolean
  /** The mode in force once this load had landed. */
  mode: Mode
  source: LoadSource
}

export type ToolState = {
  slots: Record<SlotId, Slot>
  mode: Mode
  /**
   * WHERE THE CURRENT MODE CAME FROM. It is also the latch: anything other than
   * `default` means detection is over for this page load.
   *
   * ONE FIELD COVERS BOTH ENDINGS, because the spec gives detection one trigger
   * and two terminators and they are the same event set: "no image has yet
   * decoded on this page load" is the trigger, a successful decode is what makes
   * that false, and "any use of the segmented selector ends detection for that
   * page load, whether or not detection has run" is the other terminator.
   *
   * IT IS NOT A SLOT COUNT, and that is the whole reason it exists as its own
   * field. A count-based rule ("detect when the tool goes from zero images to
   * one") contradicts itself on a drained-and-refilled tool: emptying all three
   * slots and dropping a fourth image passes zero-to-one a second time, so the
   * count says detect and the spec says do not. This field only ever moves away
   * from `default`, so the two can never disagree.
   *
   * IT IS AN ENUM RATHER THAN A BOOLEAN because the toolbar's detection hint
   * needs the third state. "Shorts was set from your first image" may only be
   * shown when the tool set it: saying it to a creator who just pressed Shorts
   * themselves reads as the tool not having noticed. A boolean latch cannot tell
   * those two apart, and a second boolean beside it would carry an invariant
   * nothing enforces.
   */
  modeSource: ModeSource
  /**
   * Colour or grayscale, and it is NOT PERSISTED. Grayscale is a judging tool
   * rather than a setting: a creator turns it on to ask one question about one
   * design, and a tool that remembered the answer would open gray for someone
   * who had forgotten they ever asked.
   */
  preview: Preview
  /**
   * Which conversion a grayscale render uses, and it is NOT PERSISTED either,
   * for the same reason `preview` is not: it is part of one question asked about
   * one design, so a fresh load starts at `luminance` no matter what the last
   * one ended on.
   */
  conversion: Conversion
  /**
   * Show or hide the New badge, and it is NOT PERSISTED, for the reason the two
   * above are not: hiding the chip is one question asked about one design, so
   * a fresh load starts on `show` no matter what the last one ended on. No
   * storage key and no cookie, so the privacy page's inventory does not move.
   */
  newBadge: NewBadgeVisibility
  /** Every image that has LANDED in a slot this page load, in the order it landed. */
  loads: LoadReport[]
}

export type ToolAction =
  /** A file passed the ladder and its decode has started. Also the REPLACE path. */
  | { type: 'decode-started'; slot: SlotId; generation: number }
  /**
   * `source` rides on this action because it is the only thing about a load the
   * reducer cannot work out for itself, and `loads` has to carry it.
   */
  | {
      type: 'decode-succeeded'
      slot: SlotId
      generation: number
      image: SlotImage
      source: LoadSource
    }
  | { type: 'decode-failed'; slot: SlotId; generation: number }
  | { type: 'title-changed'; slot: SlotId; title: string }
  /** Remove and clear are ONE path: the slot is being emptied, so the title goes too. */
  | { type: 'removed'; slot: SlotId }
  /** The segmented Format control. Sets the mode AND ends detection. */
  | { type: 'mode-selected'; mode: Mode }
  /** The segmented Preview control. Colour is the default on every load. */
  | { type: 'preview-selected'; preview: Preview }
  /** The segmented Conversion control. Luminance is the default on every load. */
  | { type: 'conversion-selected'; conversion: Conversion }
  /** The segmented New badge control. Show is the default on every load. */
  | { type: 'new-badge-selected'; newBadge: NewBadgeVisibility }

const emptySlot = (): Slot => ({ image: null, title: '', pendingGeneration: null })

/**
 * Landscape before anything decodes, because 16:9 is what a thumbnail is unless
 * an image says otherwise, and the tool renders its rails before any file
 * arrives.
 */
export const initialToolState = (): ToolState => ({
  slots: { A: emptySlot(), B: emptySlot(), C: emptySlot() },
  mode: 'landscape',
  modeSource: 'default',
  preview: 'color',
  conversion: 'luminance',
  newBadge: 'show',
  loads: [],
})

/** Detection is over for this page load. Read it; never re-derive it. */
export const isModeLatched = (state: ToolState): boolean => state.modeSource !== 'default'

/**
 * THE ONE DETECTION RULE, as a function so the reducer reads as one line and the
 * rule can be tested without building a state.
 *
 * Below 1 is Shorts, 1 and above is landscape. A square image is landscape:
 * the boundary has to fall somewhere, and 1:1 is closer to a thumbnail's job
 * than to a Shorts cover's.
 */
export const modeForImage = (image: Pick<SlotImage, 'width' | 'height'>): Mode =>
  image.width / image.height < 1 ? 'shorts' : 'landscape'

/**
 * THE MODE'S RATIO IS THE AUTHORED ONE, and it is derived from the master sizes
 * rather than retyped as 16/9 and 9/16.
 *
 * Shorts is 9:16, NOT 2:3. Three of the four Shorts tiles render at 2:3, but
 * they are a CROP of the authored frame rather than a second mode, so nothing
 * about detection or the mismatch band changes because they exist. Taking the
 * ratio from `MASTER_SHORTS` makes that structural: there is one authored size
 * per mode and this reads it.
 */
export const modeRatio = (mode: Mode): number =>
  mode === 'shorts'
    ? MASTER_SHORTS.width / MASTER_SHORTS.height
    : MASTER_LANDSCAPE.width / MASTER_LANDSCAPE.height

/**
 * THE MARGIN IS 0.12 AND THE DENOMINATOR IS THE MODE'S RATIO. Both halves are
 * stated because "differs by more than 10%" has two denominators and they
 * disagree on the case the band exists for: a 16:10 image in landscape is 10.00%
 * off against the mode ratio and 11.11% off against its own. 0.12 clears that
 * case under either reading.
 */
export const MISMATCH_MARGIN = 0.12

/**
 * Whether an image is far enough from the mode's authored shape that the tool
 * says so.
 *
 * A SHORTS COVER ALREADY EXPORTED AT 2:3 IS FLAGGED, at 18.5% off, and that is
 * accepted rather than tuned away. The input is plausible: a creator who
 * pre-cropped for the grid. The flag is still correct, because the 9:16 tile and
 * the crop overlay are exactly what such a file can no longer be judged against.
 * The notice copy earns it by saying the image is already cropped rather than
 * that it is the wrong format.
 */
export const isMismatched = (image: Pick<SlotImage, 'width' | 'height'>, mode: Mode): boolean => {
  const target = modeRatio(mode)
  return Math.abs(image.width / image.height - target) / target > MISMATCH_MARGIN
}

/**
 * What a resolved decode does to the tool: whether the result is stale, whether
 * it runs detection, and which mode is in force once it has landed.
 *
 * ONE RULE, ONE CALLER, AND THE CALLER IS THE REDUCER. It is a named function
 * rather than three inline branches because its answer is also what
 * `thumbnail_load` reports: the reducer appends it to `loads`, and the
 * component reads it from there. AC 22 asks that event for `mode` "after the
 * load" and for `detected`, which are precisely the two things this decides, so
 * an analytics call site working them out for itself would be a second copy of
 * the detection rule racing the first.
 *
 * IT ALSO ANSWERS THE STALE QUESTION, which is what keeps a superseded decode
 * out of `loads`: such a decode is revoked and never reaches a slot, so
 * reporting a load for it would count an image the creator never sees. The
 * generation race that makes this possible is documented on
 * `Slot.pendingGeneration` above.
 *
 * PURE, AND IT READS THE STATE BEFORE THE ACTION, which is the state the
 * reducer is given.
 */
export type DecodeOutcome = {
  /** The decode was superseded, so nothing lands and nothing is reported. */
  stale: boolean
  /** This load ran auto-detection, which can be true at most once per page load. */
  detected: boolean
  /** The mode in force once this decode has landed. */
  mode: Mode
}

export const decodeOutcome = (
  state: ToolState,
  slot: SlotId,
  generation: number,
  image: Pick<SlotImage, 'width' | 'height'>,
): DecodeOutcome => {
  if (state.slots[slot].pendingGeneration !== generation) {
    return { stale: true, detected: false, mode: state.mode }
  }
  if (isModeLatched(state)) return { stale: false, detected: false, mode: state.mode }
  return { stale: false, detected: true, mode: modeForImage(image) }
}

/**
 * THE REDUCER REVOKES, and that is a deliberate impurity rather than an
 * oversight. It is the only place that can see an image leaving a slot, which
 * is exactly the set of moments a URL must be revoked at. Emitting the URLs
 * instead and revoking them in an effect keeps the reducer pure and moves the
 * leak to whether that effect is wired up, which is the failure this module is
 * written to make impossible.
 *
 * Safe under StrictMode's double invocation: revoking a URL twice is a no-op,
 * and `createObjectURL` is called by the caller, never here, so the
 * creates-minus-revokes count cannot drift from a repeated reduce.
 */
const revoke = (image: SlotImage | null): void => {
  if (image && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(image.url)
  }
}

/**
 * Revokes every live URL. This is the UNMOUNT and client-side-navigation path,
 * and it is a plain function rather than a reducer action on purpose.
 *
 * A React cleanup cannot rely on `dispatch`: an update queued while the
 * component is being torn down is not guaranteed to be processed, so an unmount
 * routed through the reducer can silently revoke nothing, which is exactly the
 * leak AC 15 is about. The component's cleanup calls this directly, off a ref.
 *
 * **There WAS an `unmounted` action beside it, and it was removed 2026-08-12.**
 * Nothing dispatched it: the component could not, for the reason above, so the
 * only code that reached it was the suite testing it. That made the mutation
 * table read as unmount coverage it was not. The tests now drive this function,
 * which is the thing production actually calls.
 */
export const revokeAll = (state: ToolState): void => {
  for (const id of SLOT_IDS) revoke(state.slots[id].image)
}

const withSlot = (state: ToolState, id: SlotId, next: Slot): ToolState => ({
  ...state,
  slots: { ...state.slots, [id]: next },
})

export const toolReducer = (state: ToolState, action: ToolAction): ToolState => {
  switch (action.type) {
    case 'decode-started': {
      /**
       * The image is NOT dropped here. A decode can fail, and dropping the
       * current image at the start would empty a working slot on a corrupt
       * file. Setting the generation is what supersedes any earlier in-flight
       * decode: the older one no longer matches and is discarded on arrival.
       */
      const slot = state.slots[action.slot]
      return withSlot(state, action.slot, { ...slot, pendingGeneration: action.generation })
    }

    case 'decode-succeeded': {
      const slot = state.slots[action.slot]
      /**
       * BOTH DECISIONS COME FROM `decodeOutcome`, so the reducer and the
       * `thumbnail_load` call site cannot disagree about what this decode did.
       */
      const outcome = decodeOutcome(state, action.slot, action.generation, action.image)
      /**
       * THE STALE-RESULT GUARD. A result whose generation no longer matches
       * belongs to an attempt something else superseded, so its URL is revoked
       * HERE rather than being left to leak. Nothing else holds a reference to
       * it: the slot never took it.
       */
      if (outcome.stale) {
        revoke(action.image)
        return state
      }
      // The outgoing image goes now. This is the replace path, and the title
      // is deliberately untouched.
      revoke(slot.image)
      const next = withSlot(state, action.slot, {
        ...slot,
        image: action.image,
        pendingGeneration: null,
      })

      /**
       * DETECTION HAPPENS HERE, AFTER the stale-result guard, and the placement
       * is the rule rather than a detail.
       *
       * A stale decode did successfully decode, so a rule reading only "the
       * first image that decodes" would fire on it. It must not. The stale one
       * is revoked and the slot never takes it, so detecting from it would set
       * the mode from an image the creator never sees. It also arrives FIRST in
       * the sequence that produces it: two drops onto one slot in flight
       * together mean the LAST `decode-started` owns the generation, so the
       * earlier decode resolves stale and the later one resolves current. The
       * guard above returns before this line, so only an image that actually
       * lands in a slot can set the mode.
       *
       * A REJECTED FILE NEVER REACHES HERE AT ALL. The acceptance ladder runs
       * upstream and dispatches `decode-failed`, which has no detection branch.
       * That is what satisfies "if the first file of a multi-file drop is
       * rejected, the first file that decodes wins": the rejected one never
       * touches this action.
       */
      /**
       * THE REPORT IS APPENDED HERE, in the one place that knows the answer.
       * `outcome` is the same value the branch below acts on, so the event and
       * the tool can never describe different things.
       */
      const landed: ToolState = {
        ...next,
        loads: [
          ...next.loads,
          {
            slot: action.slot,
            detected: outcome.detected,
            mode: outcome.mode,
            source: action.source,
          },
        ],
      }

      if (!outcome.detected) return landed
      return { ...landed, mode: outcome.mode, modeSource: 'detected' }
    }

    case 'decode-failed': {
      const slot = state.slots[action.slot]
      if (slot.pendingGeneration !== action.generation) return state
      /**
       * A decode failure leaves whatever was already in the slot alone. The
       * spec's "a decode failure consumes a slot" is about slot ASSIGNMENT,
       * which happens upstream of here; it does not mean a failed replace
       * destroys the image the creator is still looking at.
       */
      return withSlot(state, action.slot, { ...slot, pendingGeneration: null })
    }

    case 'title-changed': {
      const slot = state.slots[action.slot]
      return withSlot(state, action.slot, { ...slot, title: action.title })
    }

    case 'removed': {
      const slot = state.slots[action.slot]
      revoke(slot.image)
      // Clearing the generation is what discards a decode still in flight for
      // this slot. Without it, that decode arrives into an emptied slot and
      // refills it.
      return withSlot(state, action.slot, emptySlot())
    }

    case 'mode-selected': {
      /**
       * THE LATCH IS WRITTEN EVEN WHEN THE MODE DOES NOT CHANGE. Clicking
       * "Landscape" while already in landscape is still a use of the segmented
       * selector, and the spec ends detection on any use of it "whether or not
       * detection has run". Returning `state` unchanged on an equal mode would
       * leave a tool that then re-detects on the next image, which is the exact
       * behaviour the creator just told it not to do.
       */
      return { ...state, mode: action.mode, modeSource: 'selected' }
    }

    case 'preview-selected': {
      /**
       * IT TOUCHES NOTHING ELSE, and that is what step 9's leg is written to
       * prove. Graying the preview must not disturb a slot, a title or the mode:
       * the only thing that changes is how the same state is painted.
       */
      return { ...state, preview: action.preview }
    }

    case 'conversion-selected': {
      /**
       * IT MIRRORS `preview-selected` EXACTLY: it touches only its own field.
       * No slot, no title, no mode, no load report changes, so the titles
       * survive leg keeps the meaning it already had. Choosing a conversion
       * also never flips `preview`, because a creator who is looking at colour
       * is not asking to be moved to gray.
       */
      return { ...state, conversion: action.conversion }
    }

    case 'new-badge-selected': {
      /**
       * THE THIRD OF A KIND: it touches only its own field, exactly as
       * `preview-selected` and `conversion-selected` do. No slot, no title, no
       * mode, no latch, no load report, so the "titles survive" and "toggle
       * independence" tests keep their meaning.
       */
      return { ...state, newBadge: action.newBadge }
    }

    default:
      return state
  }
}

/** The slots holding an image, in A, B, C order. */
export const filledSlots = (state: ToolState): SlotId[] =>
  SLOT_IDS.filter((id) => state.slots[id].image !== null)

/**
 * The first slot with no image AND no decode in flight, or `null` when all
 * three are taken.
 *
 * A SLOT WITH A PENDING DECODE IS NOT EMPTY, even though its `image` is still
 * null. The image arrives after the decode, so a rule reading `image` alone
 * hands the same slot out twice: a second paste during a slow decode retargets
 * slot A, and the first image is superseded and discarded before the creator
 * ever sees it. `CandidateBar` asks the same question to say which slot is
 * next, and a slot mid-decode is not the next one there either, so both callers
 * want this answer and the rule lives here rather than at either call site.
 */
export const firstEmptySlot = (state: ToolState): SlotId | null =>
  SLOT_IDS.find(
    (id) => state.slots[id].image === null && state.slots[id].pendingGeneration === null,
  ) ?? null
