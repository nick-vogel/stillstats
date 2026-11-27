// Moved from nick-vogel/nlvogel-site at `6d5d921`. The AC and issue numbers, the gate, the check
// scripts and any path outside `docs/research/` and this package that these comments cite are
// nlvogel-site's.

import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'vitest'

import {
  decodeOutcome,
  filledSlots,
  firstEmptySlot,
  initialToolState,
  isMismatched,
  isModeLatched,
  MISMATCH_MARGIN,
  modeForImage,
  modeRatio,
  revokeAll,
  SLOT_IDS,
  type SlotId,
  type SlotImage,
  type ToolAction,
  type ToolState,
  toolReducer,
} from '../src/slot-state.ts'

/**
 * AC 15 is a LEAK claim, and a leak is invisible from the rendered page: the
 * tool looks identical whether or not the URLs it stopped using were revoked.
 * So the whole suite runs against stubbed URL functions and asserts the ledger,
 * never the appearance.
 */

let created: string[] = []
let revoked: string[] = []
let nextUrl = 0

const realCreate = URL.createObjectURL
const realRevoke = URL.revokeObjectURL

beforeEach(() => {
  created = []
  revoked = []
  nextUrl = 0
  URL.createObjectURL = (() => {
    nextUrl += 1
    const url = `blob:stub/${nextUrl}`
    created.push(url)
    return url
  }) as typeof URL.createObjectURL
  URL.revokeObjectURL = ((url: string) => {
    revoked.push(url)
  }) as typeof URL.revokeObjectURL
})

afterEach(() => {
  URL.createObjectURL = realCreate
  URL.revokeObjectURL = realRevoke
})

/** Live URLs: created minus revoked. This is the number AC 15 is about. */
const live = (): number => created.length - revoked.length

/** Stands in for the caller: mints an object URL exactly as the component will. */
const decoded = (name = 'thumb.png'): SlotImage => ({
  url: URL.createObjectURL(new Blob([])),
  name,
  width: 1280,
  height: 720,
})

const run = (state: ToolState, ...actions: ToolAction[]): ToolState =>
  actions.reduce(toolReducer, state)

/** A full fill: the caller's generation comes from a ref, so it is monotonic. */
let generation = 0
const fill = (slot: SlotId, name?: string): ToolAction[] => {
  generation += 1
  const g = generation
  return [
    { type: 'decode-started', slot, generation: g },
    { type: 'decode-succeeded', source: 'drop', slot, generation: g, image: decoded(name) },
  ]
}

describe('the object URL ledger', () => {
  it('leaves one live URL per filled slot after three fills', () => {
    const state = run(initialToolState(), ...fill('A'), ...fill('B'), ...fill('C'))
    assert.equal(filledSlots(state).length, 3)
    assert.equal(live(), 3)
  })

  it('revokes the outgoing URL on a REPLACE, so a swap does not accumulate', () => {
    let state = run(initialToolState(), ...fill('A', 'first.png'))
    const firstUrl = state.slots.A.image?.url
    state = run(state, ...fill('A', 'second.png'))

    assert.equal(state.slots.A.image?.name, 'second.png')
    assert.ok(firstUrl && revoked.includes(firstUrl), 'the first URL was never revoked')
    assert.equal(live(), 1)
  })

  it('revokes on a REMOVE', () => {
    let state = run(initialToolState(), ...fill('A'), ...fill('B'))
    assert.equal(live(), 2)
    state = toolReducer(state, { type: 'removed', slot: 'A' })
    assert.equal(live(), 1)
    assert.equal(state.slots.A.image, null)
    assert.equal(state.slots.B.image?.url, created[1])
  })

  /**
   * DRIVEN THROUGH `revokeAll`, WHICH IS WHAT THE COMPONENT CALLS. This case
   * used to dispatch an `unmounted` action that no production code ever sent,
   * so it exercised a reducer branch the app could not reach and read as
   * unmount coverage it was not. The action is gone; this is the real path.
   */
  it('revokes EVERY live URL on unmount, which is also client-side navigation away', () => {
    const state = run(initialToolState(), ...fill('A'), ...fill('B'), ...fill('C'))
    assert.equal(live(), 3)
    revokeAll(state)
    assert.equal(live(), 0)
  })

  /**
   * THE PLAN'S STATED SEQUENCE, END TO END: a fill, a replace, a clear and an
   * unmount, asserting creates minus revokes equals the filled-slot count at
   * every stage rather than only at the end. A ledger checked once at the end
   * passes on a code path that leaks and then over-revokes.
   */
  it('holds creates minus revokes equal to the filled slots at every stage', () => {
    let state = initialToolState()
    const stage = (label: string) =>
      assert.equal(live(), filledSlots(state).length, `after ${label}`)

    state = run(state, ...fill('A'), ...fill('B'))
    stage('two fills')

    state = run(state, ...fill('A', 'replacement.png'))
    stage('a replace')

    state = toolReducer(state, { type: 'removed', slot: 'B' })
    stage('a clear')

    /**
     * UNMOUNT IS THE ONE STAGE THE INVARIANT DOES NOT HOLD AT, and that is
     * correct rather than an exception being made for it. `revokeAll` revokes
     * every live URL and deliberately does NOT reset the state: the component
     * is going away, so its state goes with it, and rebuilding an empty state
     * object nobody will read is work for nothing. So the assertion here is the
     * absolute one, zero live URLs, not the per-slot comparison.
     */
    revokeAll(state)
    assert.equal(live(), 0, 'after unmount')
  })
})

/**
 * TWO CASES, NOT ONE, and that is the point of them. A single case passes under
 * either rule, so a suite carrying only one of these proves nothing about which
 * rule is implemented.
 */
describe('a title outlives a replace and dies with a remove', () => {
  it('KEEPS the title when the image is replaced', () => {
    // Replacing an image is how a creator iterates on a thumbnail against a
    // fixed title. Wiping it here destroys the comparison in progress.
    let state = run(initialToolState(), ...fill('A', 'first.png'))
    state = toolReducer(state, { type: 'title-changed', slot: 'A', title: 'Six months of this' })
    state = run(state, ...fill('A', 'second.png'))

    assert.equal(state.slots.A.title, 'Six months of this')
    assert.equal(state.slots.A.image?.name, 'second.png')
  })

  it('CLEARS the title when the slot is removed', () => {
    let state = run(initialToolState(), ...fill('A'))
    state = toolReducer(state, { type: 'title-changed', slot: 'A', title: 'Six months of this' })
    state = toolReducer(state, { type: 'removed', slot: 'A' })

    assert.equal(state.slots.A.title, '')
    assert.equal(state.slots.A.image, null)
  })

  it('keeps a title independent per slot', () => {
    let state = initialToolState()
    state = toolReducer(state, { type: 'title-changed', slot: 'A', title: 'Title A' })
    state = toolReducer(state, { type: 'title-changed', slot: 'B', title: 'Title B' })
    state = toolReducer(state, { type: 'removed', slot: 'A' })

    assert.equal(state.slots.A.title, '')
    assert.equal(state.slots.B.title, 'Title B')
    assert.equal(state.slots.C.title, '')
  })

  it('accepts a title on an empty slot, because the fields are always visible', () => {
    const state = toolReducer(initialToolState(), {
      type: 'title-changed',
      slot: 'C',
      title: 'Typed before any image',
    })
    assert.equal(state.slots.C.title, 'Typed before any image')
    assert.equal(state.slots.C.image, null)
  })
})

/**
 * THREE RACES, each asserting the same two things: the stale result is
 * discarded, AND the URL ledger still balances. Discarding a result while
 * leaking its URL is the failure that looks correct on screen.
 */
describe('a decode that resolves after its slot moved on', () => {
  it('discards the first decode when a REPLACE started while it was pending', () => {
    let state = toolReducer(initialToolState(), {
      type: 'decode-started',
      slot: 'A',
      generation: 1,
    })
    const first = decoded('first.png')

    // The second attempt starts and lands while the first is still in flight.
    state = toolReducer(state, { type: 'decode-started', slot: 'A', generation: 2 })
    const second = decoded('second.png')
    state = toolReducer(state, {
      type: 'decode-succeeded',
      source: 'drop',
      slot: 'A',
      generation: 2,
      image: second,
    })

    // Now the FIRST decode finally resolves.
    state = toolReducer(state, {
      type: 'decode-succeeded',
      source: 'drop',
      slot: 'A',
      generation: 1,
      image: first,
    })

    assert.equal(state.slots.A.image?.name, 'second.png', 'the stale image took the slot')
    assert.ok(revoked.includes(first.url), 'the stale URL leaked')
    assert.equal(live(), 1)
  })

  it('discards a decode that resolves after the slot was CLEARED', () => {
    let state = run(initialToolState(), ...fill('A', 'original.png'))
    state = toolReducer(state, { type: 'decode-started', slot: 'A', generation: 99 })
    const late = decoded('late.png')

    state = toolReducer(state, { type: 'removed', slot: 'A' })
    assert.equal(live(), 1, 'only the late decode should still be live')

    state = toolReducer(state, {
      type: 'decode-succeeded',
      source: 'drop',
      slot: 'A',
      generation: 99,
      image: late,
    })

    assert.equal(state.slots.A.image, null, 'a cleared slot was refilled by a stale decode')
    assert.ok(revoked.includes(late.url), 'the stale URL leaked')
    assert.equal(live(), 0)
  })

  it('keeps only the later of two drops onto one slot in flight together', () => {
    // Both drops start before either resolves, and they resolve out of order:
    // the SECOND lands first, then the first. This is the sequence a
    // caller-derived generation would get wrong, because two handlers firing
    // against one render would mint the same number.
    let state = toolReducer(initialToolState(), {
      type: 'decode-started',
      slot: 'B',
      generation: 7,
    })
    state = toolReducer(state, { type: 'decode-started', slot: 'B', generation: 8 })

    const fromDropOne = decoded('drop-one.png')
    const fromDropTwo = decoded('drop-two.png')

    state = toolReducer(state, {
      type: 'decode-succeeded',
      source: 'drop',
      slot: 'B',
      generation: 8,
      image: fromDropTwo,
    })
    state = toolReducer(state, {
      type: 'decode-succeeded',
      source: 'drop',
      slot: 'B',
      generation: 7,
      image: fromDropOne,
    })

    assert.equal(state.slots.B.image?.name, 'drop-two.png')
    assert.ok(revoked.includes(fromDropOne.url), 'the superseded drop leaked its URL')
    assert.equal(live(), 1)
  })

  it('ignores a stale decode FAILURE, so it cannot cancel a newer attempt', () => {
    let state = toolReducer(initialToolState(), {
      type: 'decode-started',
      slot: 'A',
      generation: 1,
    })
    state = toolReducer(state, { type: 'decode-started', slot: 'A', generation: 2 })
    state = toolReducer(state, { type: 'decode-failed', slot: 'A', generation: 1 })

    assert.equal(
      state.slots.A.pendingGeneration,
      2,
      'the stale failure cleared the newer attempt, so its result will be discarded too',
    )
  })

  it('leaves the existing image alone when a REPLACE fails to decode', () => {
    // The creator is still looking at the old image. A failed replace is not a
    // reason to empty a working slot.
    let state = run(initialToolState(), ...fill('A', 'good.png'))
    state = toolReducer(state, { type: 'decode-started', slot: 'A', generation: 50 })
    state = toolReducer(state, { type: 'decode-failed', slot: 'A', generation: 50 })

    assert.equal(state.slots.A.image?.name, 'good.png')
    assert.equal(state.slots.A.pendingGeneration, null)
    assert.equal(live(), 1)
  })
})

describe('slot helpers', () => {
  it('reports the filled slots in A, B, C order regardless of fill order', () => {
    const state = run(initialToolState(), ...fill('C'), ...fill('A'))
    assert.deepEqual(filledSlots(state), ['A', 'C'])
  })

  it('finds the first empty slot, and null when all three are full', () => {
    let state = initialToolState()
    assert.equal(firstEmptySlot(state), 'A')
    state = run(state, ...fill('A'))
    assert.equal(firstEmptySlot(state), 'B')
    state = run(state, ...fill('B'), ...fill('C'))
    assert.equal(firstEmptySlot(state), null)
  })

  /**
   * A SLOT MID-DECODE IS NOT EMPTY, and its `image` is still null the whole
   * time, which is why a rule reading `image` alone cannot tell them apart. The
   * paste handler targets `firstEmptySlot`, so a second paste arriving before a
   * slow decode resolves would be handed slot A a second time: the second
   * `decode-started` supersedes the first generation, and the first image is
   * revoked on arrival without the creator ever seeing it.
   */
  it('SKIPS a slot whose decode is still in flight, so a second paste fills the next one', () => {
    generation += 1
    const state = toolReducer(initialToolState(), {
      type: 'decode-started',
      slot: 'A',
      generation,
    })

    assert.equal(state.slots.A.image, null, 'the slot is still imageless, which is the trap')
    assert.equal(firstEmptySlot(state), 'B')
  })

  /**
   * AND IT GOES BACK TO BEING EMPTY WHEN THE DECODE FAILS. Without this, the
   * fix above would strand a slot forever on a corrupt file: the pending
   * generation is what makes it unavailable, so clearing it has to make it
   * available again.
   */
  it('returns a slot to the empty list when its decode FAILS', () => {
    generation += 1
    const g = generation
    let state = toolReducer(initialToolState(), {
      type: 'decode-started',
      slot: 'A',
      generation: g,
    })
    assert.equal(firstEmptySlot(state), 'B')

    state = toolReducer(state, { type: 'decode-failed', slot: 'A', generation: g })
    assert.equal(firstEmptySlot(state), 'A')
  })

  it('carries exactly three slots, side by side', () => {
    assert.deepEqual([...SLOT_IDS], ['A', 'B', 'C'])
    assert.equal(Object.keys(initialToolState().slots).length, 3)
  })
})

/**
 * THE DELTA, MADE EXECUTABLE. This block reimplements the pre-fix selector,
 * `image === null` alone, and asserts the WRONG answers it gives. Kept as a pair
 * with the two cases above: if anyone reverts `firstEmptySlot` to reading
 * `image` alone, that block goes red while this one stays green, and the pair
 * names the defect rather than leaving a bare failure.
 */
const preFixFirstEmptySlot = (state: ToolState): SlotId | null =>
  SLOT_IDS.find((id) => state.slots[id].image === null) ?? null

describe('negative control: the pre-fix image-only firstEmptySlot', () => {
  it('WRONGLY hands out slot A again while its decode is still in flight', () => {
    generation += 1
    const state = toolReducer(initialToolState(), {
      type: 'decode-started',
      slot: 'A',
      generation,
    })

    assert.equal(
      preFixFirstEmptySlot(state),
      'A',
      'recorded defect: a second paste retargets slot A and discards the image already decoding into it',
    )
  })

  it('agrees with the fixed selector on every state with nothing in flight', () => {
    // The three assertions the fix must not move. The two selectors are only
    // allowed to differ while a decode is pending.
    let state = initialToolState()
    assert.equal(preFixFirstEmptySlot(state), firstEmptySlot(state))
    state = run(state, ...fill('A'))
    assert.equal(preFixFirstEmptySlot(state), firstEmptySlot(state))
    state = run(state, ...fill('B'), ...fill('C'))
    assert.equal(preFixFirstEmptySlot(state), firstEmptySlot(state))
  })
})

/**
 * AC 10: the one detection rule.
 *
 * EVERY CASE HERE IS A CASE THE RENDERED PAGE CANNOT DISTINGUISH. A tool that
 * re-detects on a drained-and-refilled slot looks identical to one that does
 * not, until the day a creator drops a Short after a thumbnail and the rails
 * change under them. So the rule is asserted as state, on the reducer, and the
 * browser gate asserts only that the page is wired to it.
 */
const decodedAt = (width: number, height: number, name = 'thumb.png'): SlotImage => ({
  url: URL.createObjectURL(new Blob([])),
  name,
  width,
  height,
})

/** A full fill at an explicit size, so a case can name the ratio it is about. */
const fillAt = (slot: SlotId, width: number, height: number, name?: string): ToolAction[] => {
  generation += 1
  const g = generation
  return [
    { type: 'decode-started', slot, generation: g },
    {
      type: 'decode-succeeded',
      source: 'drop',
      slot,
      generation: g,
      image: decodedAt(width, height, name),
    },
  ]
}

describe('mode detection', () => {
  it('selects Shorts from a 9:16 first image and landscape from a 16:9 one', () => {
    assert.equal(run(initialToolState(), ...fillAt('A', 1080, 1920)).mode, 'shorts')
    assert.equal(run(initialToolState(), ...fillAt('A', 1280, 720)).mode, 'landscape')
  })

  it('puts a square image in landscape, because the boundary is ratio < 1', () => {
    assert.equal(modeForImage({ width: 1000, height: 1000 }), 'landscape')
    assert.equal(modeForImage({ width: 999, height: 1000 }), 'shorts')
  })

  it('starts in landscape, unlatched, before anything decodes', () => {
    const state = initialToolState()
    assert.equal(state.mode, 'landscape')
    assert.equal(state.modeSource, 'default')
  })

  /**
   * THE CASE A SLOT COUNT GETS WRONG. Draining all three slots and dropping a
   * fourth image passes zero-filled-to-one-filled a second time, so a
   * count-based rule detects again here. The latch does not.
   */
  it('does NOT re-detect on a drained and refilled tool', () => {
    let state = run(initialToolState(), ...fillAt('A', 1280, 720))
    assert.equal(state.mode, 'landscape')

    state = toolReducer(state, { type: 'removed', slot: 'A' })
    assert.equal(filledSlots(state).length, 0, 'the tool is drained')

    state = run(state, ...fillAt('A', 1080, 1920))
    assert.equal(filledSlots(state).length, 1, 'and refilled, zero to one a second time')
    assert.equal(state.mode, 'landscape', 'a Shorts cover must not flip a latched mode')
  })

  it('detects on the FIRST file of a multi-file drop and not on the second', () => {
    const state = run(
      initialToolState(),
      ...fillAt('A', 1080, 1920, 'short.png'),
      ...fillAt('B', 1280, 720, 'thumb.png'),
    )
    assert.equal(state.mode, 'shorts')
  })

  /**
   * THE REJECTED-FIRST-FILE CASE, which is the half of AC 10 that a naive
   * "detect on the first file" rule fails. A rejection never reaches
   * `decode-succeeded`, so the second file wins.
   */
  it('detects on the first file that DECODES when the first file is rejected', () => {
    let state = initialToolState()
    generation += 1
    const g = generation
    state = run(
      state,
      { type: 'decode-started', slot: 'A', generation: g },
      { type: 'decode-failed', slot: 'A', generation: g },
    )
    assert.equal(state.modeSource, 'default', 'a failed decode must not latch')
    assert.equal(state.mode, 'landscape')

    state = run(state, ...fillAt('B', 1080, 1920))
    assert.equal(state.mode, 'shorts')
  })

  /**
   * A STALE DECODE MUST NOT DETECT. It resolves first in the sequence that
   * produces it (two drops onto one slot in flight together), it is revoked,
   * and the slot never takes it. Detecting from it sets the mode from an image
   * the creator never sees.
   */
  it('does NOT detect from a decode the stale-result guard discards', () => {
    let state = initialToolState()
    state = toolReducer(state, { type: 'decode-started', slot: 'A', generation: 101 })
    state = toolReducer(state, { type: 'decode-started', slot: 'A', generation: 102 })

    // The superseded decode arrives first, carrying a Shorts cover.
    state = toolReducer(state, {
      type: 'decode-succeeded',
      source: 'drop',
      slot: 'A',
      generation: 101,
      image: decodedAt(1080, 1920, 'superseded.png'),
    })
    assert.equal(state.modeSource, 'default', 'the discarded image must not latch')
    assert.equal(state.mode, 'landscape')

    // The current one lands, and it is what sets the mode.
    state = toolReducer(state, {
      type: 'decode-succeeded',
      source: 'drop',
      slot: 'A',
      generation: 102,
      image: decodedAt(1280, 720, 'current.png'),
    })
    assert.equal(state.slots.A.image?.name, 'current.png')
    assert.equal(state.mode, 'landscape')
    assert.equal(state.modeSource, 'detected')
  })
})

describe('the mode latch', () => {
  it('ends detection when the selector is used BEFORE any image decodes', () => {
    let state = toolReducer(initialToolState(), { type: 'mode-selected', mode: 'landscape' })
    assert.equal(state.modeSource, 'selected')

    state = run(state, ...fillAt('A', 1080, 1920))
    assert.equal(state.mode, 'landscape', 'a Shorts cover must not override the creator')
    assert.equal(state.modeSource, 'selected', 'and the source still says the creator chose it')
  })

  /**
   * SELECTING THE MODE THE TOOL IS ALREADY IN STILL LATCHES. This is the case a
   * `if (state.mode === action.mode) return state` short-circuit gets wrong: the
   * creator has used the selector, so detection is over, and the next image must
   * not move the mode.
   */
  it('latches on a no-op selection of the mode already active', () => {
    let state = initialToolState()
    assert.equal(state.mode, 'landscape')

    state = toolReducer(state, { type: 'mode-selected', mode: 'landscape' })
    assert.equal(state.modeSource, 'selected', 'a no-op selection is still a use of the selector')

    state = run(state, ...fillAt('A', 1080, 1920))
    assert.equal(state.mode, 'landscape')
  })

  it('lets the selector override a mode detection already chose', () => {
    let state = run(initialToolState(), ...fillAt('A', 1080, 1920))
    assert.equal(state.mode, 'shorts')
    assert.equal(state.modeSource, 'detected')

    state = toolReducer(state, { type: 'mode-selected', mode: 'landscape' })
    assert.equal(state.mode, 'landscape')
    assert.equal(state.modeSource, 'selected')

    state = run(state, ...fillAt('B', 1080, 1920))
    assert.equal(state.mode, 'landscape', 'and no later image takes it back')
  })

  /**
   * THE SOURCE IS WHAT THE DETECTION HINT IS BOUND TO. "Shorts was set from your
   * first image" is only true of a mode the tool chose. A boolean latch cannot
   * tell these two states apart, and showing the sentence to a creator who just
   * pressed Shorts reads as the tool not having noticed.
   */
  it('separates a mode the tool detected from one the creator chose', () => {
    const detected = run(initialToolState(), ...fillAt('A', 1080, 1920))
    assert.equal(detected.mode, 'shorts')
    assert.equal(detected.modeSource, 'detected')

    const chosen = toolReducer(initialToolState(), { type: 'mode-selected', mode: 'shorts' })
    assert.equal(chosen.mode, 'shorts')
    assert.equal(chosen.modeSource, 'selected')

    assert.equal(isModeLatched(detected), true)
    assert.equal(isModeLatched(chosen), true)
    assert.equal(isModeLatched(initialToolState()), false)
  })

  it('keeps the mode and the latch across a title change and a removal', () => {
    let state = run(initialToolState(), ...fillAt('A', 1080, 1920))
    state = toolReducer(state, { type: 'title-changed', slot: 'A', title: 'a title' })
    assert.equal(state.mode, 'shorts')
    state = toolReducer(state, { type: 'removed', slot: 'A' })
    assert.equal(state.mode, 'shorts')
    assert.equal(state.modeSource, 'detected')
  })
})

/**
 * AC 11's mismatch band. FOUR CASES, and the two the spec names by fixture are
 * the ones that decide the margin: 16:10 in landscape must NOT fire and 9:16 in
 * landscape must.
 *
 * The percentages are asserted alongside the booleans, because a predicate that
 * returns the right answers from the wrong formula is the defect a boolean-only
 * suite cannot see. 16:10 sits at exactly 10.00% against the mode ratio and
 * 11.11% against its own, and only one of those readings puts it under 0.12.
 */
const offBy = (width: number, height: number, mode: 'landscape' | 'shorts'): number => {
  const target = modeRatio(mode)
  return Math.abs(width / height - target) / target
}

describe('the mismatch band', () => {
  it('takes the mode ratio from the AUTHORED master size, not from the 2:3 tiles', () => {
    assert.equal(modeRatio('landscape'), 16 / 9)
    assert.equal(modeRatio('shorts'), 9 / 16)
    assert.notEqual(modeRatio('shorts'), 2 / 3)
  })

  it('does NOT flag a 16:10 image in landscape, which sits at exactly 10%', () => {
    assert.ok(
      Math.abs(offBy(1600, 1000, 'landscape') - 0.1) < 1e-12,
      'the fixture is not 10.00% off',
    )
    assert.equal(isMismatched({ width: 1600, height: 1000 }, 'landscape'), false)
  })

  it('DOES flag a 9:16 image in landscape', () => {
    assert.ok(offBy(1080, 1920, 'landscape') > 0.6, 'the fixture should be far off')
    assert.equal(isMismatched({ width: 1080, height: 1920 }, 'landscape'), true)
  })

  /**
   * THE ACCEPTED FALSE-SOUNDING FLAG. A creator who pre-cropped for the Shorts
   * grid exports at 2:3, which is 18.5% off the authored 9:16. It is flagged,
   * deliberately: the 9:16 tile and the crop overlay are what such a file can no
   * longer be judged against.
   */
  it('flags a 2:3 cover in Shorts mode, at the 18.5% the spec accepts', () => {
    const off = offBy(1080, 1620, 'shorts')
    assert.ok(off > 0.18 && off < 0.19, `expected ~18.5%, got ${(off * 100).toFixed(2)}%`)
    assert.equal(isMismatched({ width: 1080, height: 1620 }, 'shorts'), true)
  })

  it('flags nothing when the image matches the mode it is in', () => {
    assert.equal(isMismatched({ width: 1280, height: 720 }, 'landscape'), false)
    assert.equal(isMismatched({ width: 1080, height: 1920 }, 'shorts'), false)
  })

  /**
   * THE THRESHOLD SITS AT 0.12 AND NOWHERE ELSE, pinned from both sides one
   * thousandth apart. Without this, a margin edited to 0.2 or to 0.05 still
   * passes every case above: 16:10 is 10% off and 9:16 is 68% off, so any
   * threshold between them satisfies them both, and the two fixtures the spec
   * names cannot tell those apart.
   *
   * IT DOES NOT ASSERT THE STRICTNESS OF `>` AT EXACTLY 0.12. An image whose
   * ratio lands on the boundary to the last bit is not constructible in binary
   * floating point, so a test claiming to sit on it would really be testing
   * whichever way the rounding fell.
   */
  it('fires just outside 0.12 and not just inside it', () => {
    const atOffset = (off: number) => ({ width: modeRatio('landscape') * (1 - off), height: 1 })
    assert.equal(MISMATCH_MARGIN, 0.12)
    assert.equal(isMismatched(atOffset(0.119), 'landscape'), false)
    assert.equal(isMismatched(atOffset(0.121), 'landscape'), true)
  })
})

/**
 * `decodeOutcome` has ONE caller, the reducer, and the suite that matters is
 * still the AGREEMENT one: the outcome the function returns must describe what
 * the reducer actually did with it.
 *
 * That is worth pinning because the outcome is ALSO what gets recorded into
 * `loads` and reported as `thumbnail_load`. If the reducer's mode branch and
 * the recorded report were ever computed from different readings, the event
 * would describe a tool that behaved differently, which is the whole failure
 * this function exists to make impossible.
 *
 * A suite that only checked the outcome's fields in isolation would pass while
 * the reducer quietly stopped using it. It was measured: a mutant that makes
 * the reducer ignore `outcome.detected` leaves the field assertions green and
 * fails here.
 */
describe('decodeOutcome, and the reducer agreeing with it', () => {
  /** What the reducer did, in the outcome's own vocabulary. */
  const reducerDid = (before: ToolState, action: ToolAction & { type: 'decode-succeeded' }) => {
    const after = toolReducer(before, action)
    return {
      stale: after === before,
      detected: before.modeSource !== 'detected' && after.modeSource === 'detected',
      mode: after.mode,
    }
  }

  it('reports detection and the detected mode on the first landing decode', () => {
    const before = toolReducer(initialToolState(), {
      type: 'decode-started',
      slot: 'A',
      generation: 1,
    })
    const image = { ...decoded('portrait.png'), width: 1080, height: 1920 }

    const outcome = decodeOutcome(before, 'A', 1, image)
    assert.deepEqual(outcome, { stale: false, detected: true, mode: 'shorts' })
    assert.deepEqual(
      outcome,
      reducerDid(before, {
        type: 'decode-succeeded',
        source: 'drop',
        slot: 'A',
        generation: 1,
        image,
      }),
    )
  })

  it('reports no detection, and the mode still in force, once the latch is set', () => {
    let before = toolReducer(initialToolState(), { type: 'mode-selected', mode: 'landscape' })
    before = toolReducer(before, { type: 'decode-started', slot: 'A', generation: 1 })
    const image = { ...decoded('portrait.png'), width: 1080, height: 1920 }

    const outcome = decodeOutcome(before, 'A', 1, image)
    assert.deepEqual(outcome, { stale: false, detected: false, mode: 'landscape' })
    assert.deepEqual(
      outcome,
      reducerDid(before, {
        type: 'decode-succeeded',
        source: 'drop',
        slot: 'A',
        generation: 1,
        image,
      }),
    )
  })

  /**
   * THE STALE CASE IS THE ONE THE ANALYTICS CALLER NEEDS MOST. A superseded
   * decode is revoked and never reaches a slot, so reporting a load for it
   * would count an image the creator never sees.
   */
  it('reports stale for a decode whose generation was superseded', () => {
    let before = toolReducer(initialToolState(), {
      type: 'decode-started',
      slot: 'A',
      generation: 1,
    })
    before = toolReducer(before, { type: 'decode-started', slot: 'A', generation: 2 })
    const image = { ...decoded('late.png'), width: 1080, height: 1920 }

    const outcome = decodeOutcome(before, 'A', 1, image)
    assert.equal(outcome.stale, true)
    assert.equal(outcome.detected, false, 'a stale decode must never claim detection')
    assert.deepEqual(
      outcome,
      reducerDid(before, {
        type: 'decode-succeeded',
        source: 'drop',
        slot: 'A',
        generation: 1,
        image,
      }),
    )
  })

  /**
   * A SECOND LANDING DECODE DETECTS NOTHING, which is the case that separates
   * "the first image" from "every image". Without it, an outcome hardcoded to
   * `detected: true` passes the first test above and this suite would still be
   * green.
   */
  it('detects on the first landing decode and on no later one', () => {
    let state = run(initialToolState(), ...fill('A'))
    state = toolReducer(state, { type: 'decode-started', slot: 'B', generation: 500 })
    const second = { ...decoded('second.png'), width: 1080, height: 1920 }

    const outcome = decodeOutcome(state, 'B', 500, second)
    assert.equal(outcome.detected, false)
    assert.equal(outcome.mode, 'landscape', 'the second image must not re-detect')
    assert.deepEqual(
      outcome,
      reducerDid(state, {
        type: 'decode-succeeded',
        source: 'drop',
        slot: 'B',
        generation: 500,
        image: second,
      }),
    )
  })
})

/**
 * `loads` is what `thumbnail_load` is reported from, so its invariants ARE the
 * event's invariants. AC 22 asks the event for `detected` and for the mode
 * after the load, and both are properties of the sequence rather than of any
 * single action.
 *
 * THE COMPONENT USED TO WORK THESE OUT FOR ITSELF, from a ref an effect assigns
 * after the commit. That ref lags the tree by a scheduler task, so two decodes
 * resolving inside the window both read the pre-first-decode snapshot: both
 * claimed detection, and the second reported a mode that never came into force.
 * A three-file drop reproduces it every time. The reducer records the answer
 * now, and these are the invariants that made the old version wrong.
 */
describe('the load reports the reducer records', () => {
  it('appends exactly one report per landed image, in order', () => {
    const state = run(initialToolState(), ...fill('A'), ...fill('B'), ...fill('C'))
    assert.equal(state.loads.length, 3)
    assert.deepEqual(
      state.loads.map((l) => l.slot),
      ['A', 'B', 'C'],
    )
  })

  /**
   * THE INVARIANT THE OLD CALL SITE BROKE. Detection happens at most once per
   * page load, so at most one report may claim it, and it must be the first.
   */
  it('marks detection on the FIRST landed image and on no other', () => {
    const state = run(initialToolState(), ...fill('A'), ...fill('B'), ...fill('C'))
    assert.deepEqual(
      state.loads.map((l) => l.detected),
      [true, false, false],
    )
  })

  it('reports the mode in force after each load, not the mode each image implies', () => {
    // A landscape image lands first and latches landscape by detection. A
    // portrait image landing second does NOT re-detect, so it must report the
    // landscape it actually arrived into.
    let state = run(initialToolState(), ...fillAt('A', 1280, 720))
    state = run(state, ...fillAt('B', 1080, 1920))

    assert.deepEqual(
      state.loads.map((l) => l.mode),
      ['landscape', 'landscape'],
    )
    assert.equal(state.mode, 'landscape', 'the tool and the reports must agree')
  })

  it('carries the source it was given', () => {
    let state = toolReducer(initialToolState(), {
      type: 'decode-started',
      slot: 'A',
      generation: 1,
    })
    state = toolReducer(state, {
      type: 'decode-succeeded',
      slot: 'A',
      generation: 1,
      source: 'paste',
      image: decoded('pasted.png'),
    })
    assert.equal(state.loads[0]?.source, 'paste')
  })

  /**
   * A STALE DECODE APPENDS NOTHING. Its image is revoked and no slot ever shows
   * it, so a report for it would count an image the creator never saw.
   */
  it('records nothing for a decode whose generation was superseded', () => {
    let state = toolReducer(initialToolState(), {
      type: 'decode-started',
      slot: 'A',
      generation: 1,
    })
    state = toolReducer(state, { type: 'decode-started', slot: 'A', generation: 2 })
    const late = decoded('late.png')

    state = toolReducer(state, {
      type: 'decode-succeeded',
      slot: 'A',
      generation: 1,
      source: 'drop',
      image: late,
    })

    assert.equal(state.loads.length, 0)
  })

  /** A failed decode is not a load either, and it has its own action. */
  it('records nothing for a decode that failed', () => {
    let state = toolReducer(initialToolState(), {
      type: 'decode-started',
      slot: 'A',
      generation: 1,
    })
    state = toolReducer(state, { type: 'decode-failed', slot: 'A', generation: 1 })
    assert.equal(state.loads.length, 0)
  })

  /**
   * REMOVING A SLOT DOES NOT REWRITE HISTORY. The list answers "what has been
   * loaded on this page load", which a later removal does not change, and the
   * component reports from a cursor into it that only ever moves forward.
   */
  it('keeps a report after its slot is cleared', () => {
    let state = run(initialToolState(), ...fill('A'))
    state = toolReducer(state, { type: 'removed', slot: 'A' })
    assert.equal(state.loads.length, 1)
    assert.equal(state.slots.A.image, null)
  })
})

/**
 * AC 15, plus AC 16's two reducer-tier halves. AC 16's third half is the focus
 * mode round trip, which is component state the reducer never sees, so it is
 * carried by a browser leg rather than from here.
 *
 * THE FIRST CASE COMPARES EVERY OTHER FIELD RATHER THAN A CHOSEN FEW, and it
 * takes the field list from the state object at runtime. A list retyped into
 * this file stops covering AC 15 the moment a later phase adds a field to
 * `ToolState`, and it stops SILENTLY, which is the failure a green suite hides.
 */
describe('the conversion selector', () => {
  /** Everything except `conversion`, keyed off whatever the state actually carries. */
  const exceptConversion = (state: ToolState): Omit<ToolState, 'conversion'> => {
    const { conversion: _conversion, ...rest } = state
    return rest
  }

  it('changes conversion and NOTHING else on conversion-selected', () => {
    // A state with something to lose: two images, a title, a creator-chosen
    // mode with its latch, and the load reports the two decodes recorded.
    let before = run(initialToolState(), ...fill('A', 'first.png'), ...fill('B', 'second.png'))
    before = toolReducer(before, { type: 'title-changed', slot: 'A', title: 'Six months of this' })
    before = toolReducer(before, { type: 'mode-selected', mode: 'shorts' })

    /**
     * THE PREVIEW STARTS AT COLOUR ON PURPOSE. The rule is that choosing a
     * conversion never flips the preview, so a `before` already in grayscale
     * would hide exactly that defect: a reducer that also set
     * `preview: 'grayscale'` would still compare equal.
     */
    assert.equal(before.preview, 'color')
    assert.equal(before.conversion, 'luminance')

    /**
     * A DEEP SNAPSHOT, not a reference to the same objects. Comparing `after`
     * against live `before` would let an in-place mutation of a nested object
     * pass, because both sides would be the one mutated object.
     */
    const snapshot = structuredClone(before)

    const after = toolReducer(before, { type: 'conversion-selected', conversion: 'red' })

    assert.equal(after.conversion, 'red', 'the action did not change the field it exists for')

    const others = exceptConversion(snapshot)
    assert.ok(Object.keys(others).length > 0, 'the comparison covers no fields at all')
    assert.deepEqual(exceptConversion(after), others)
  })

  it('keeps the conversion across preview-selected and mode-selected', () => {
    let state = toolReducer(initialToolState(), { type: 'conversion-selected', conversion: 'blue' })

    state = toolReducer(state, { type: 'preview-selected', preview: 'grayscale' })
    assert.equal(state.preview, 'grayscale')
    assert.equal(state.conversion, 'blue', 'going gray reset the conversion')

    // Back to colour, which is the half a reset-on-colour reducer would fail.
    state = toolReducer(state, { type: 'preview-selected', preview: 'color' })
    assert.equal(state.conversion, 'blue', 'returning to colour reset the conversion')

    state = toolReducer(state, { type: 'mode-selected', mode: 'shorts' })
    assert.equal(state.mode, 'shorts', 'the mode selection did nothing, so it proves nothing')
    assert.equal(state.conversion, 'blue', 'changing the format reset the conversion')
  })

  it('starts at luminance on a fresh initialToolState', () => {
    assert.equal(initialToolState().conversion, 'luminance')

    /**
     * AND A LATER LOAD STILL STARTS THERE. Nothing writes the conversion to any
     * storage, so the reset is structural: this asserts the second fresh state
     * after a selection, which is what a persisted choice would break.
     */
    toolReducer(initialToolState(), { type: 'conversion-selected', conversion: 'red' })
    assert.equal(
      initialToolState().conversion,
      'luminance',
      'a fresh load remembered the last conversion',
    )
  })
})

describe('the New badge toggle (#63)', () => {
  /** Everything except `newBadge`, keyed off whatever the state actually carries. */
  const exceptNewBadge = (state: ToolState): Omit<ToolState, 'newBadge'> => {
    const { newBadge: _newBadge, ...rest } = state
    return rest
  }

  it('starts on show on a fresh initialToolState, and a later load still does', () => {
    assert.equal(initialToolState().newBadge, 'show')

    /**
     * NOTHING WRITES THE TOGGLE ANYWHERE, so the reset on the next visit is
     * structural: this asserts the second fresh state after a selection, which
     * is what a persisted choice would break.
     */
    toolReducer(initialToolState(), { type: 'new-badge-selected', newBadge: 'hide' })
    assert.equal(initialToolState().newBadge, 'show', 'a fresh load remembered the last toggle')
  })

  it('changes the toggle and NOTHING else on new-badge-selected', () => {
    let before = run(initialToolState(), ...fill('A', 'first.png'), ...fill('B', 'second.png'))
    before = toolReducer(before, { type: 'title-changed', slot: 'A', title: 'Six months of this' })
    before = toolReducer(before, { type: 'preview-selected', preview: 'grayscale' })
    before = toolReducer(before, { type: 'conversion-selected', conversion: 'red' })
    assert.equal(before.newBadge, 'show')

    const snapshot = structuredClone(before)
    const after = toolReducer(before, { type: 'new-badge-selected', newBadge: 'hide' })

    assert.equal(after.newBadge, 'hide', 'the action did not change the field it exists for')
    const others = exceptNewBadge(snapshot)
    assert.ok(Object.keys(others).length > 0, 'the comparison covers no fields at all')
    assert.deepEqual(exceptNewBadge(after), others)

    const restored = toolReducer(after, { type: 'new-badge-selected', newBadge: 'show' })
    assert.equal(restored.newBadge, 'show', 'show did not bring the badge back')
    assert.deepEqual(exceptNewBadge(restored), others)
  })

  it('is independent of Format, Preview and Conversion in both directions', () => {
    let state = toolReducer(initialToolState(), { type: 'new-badge-selected', newBadge: 'hide' })

    state = toolReducer(state, { type: 'mode-selected', mode: 'shorts' })
    assert.equal(state.mode, 'shorts', 'the mode selection did nothing, so it proves nothing')
    assert.equal(state.newBadge, 'hide', 'changing the format reset the toggle')

    state = toolReducer(state, { type: 'mode-selected', mode: 'landscape' })
    assert.equal(state.newBadge, 'hide', 'returning to landscape reset the toggle')

    state = toolReducer(state, { type: 'preview-selected', preview: 'grayscale' })
    assert.equal(state.preview, 'grayscale')
    assert.equal(state.newBadge, 'hide', 'going gray reset the toggle')

    state = toolReducer(state, { type: 'conversion-selected', conversion: 'blue' })
    assert.equal(state.conversion, 'blue')
    assert.equal(state.newBadge, 'hide', 'choosing a conversion reset the toggle')

    // And the other direction: the toggle never moves the three controls.
    const before = structuredClone(state)
    state = toolReducer(state, { type: 'new-badge-selected', newBadge: 'show' })
    assert.equal(state.mode, before.mode, 'the toggle moved the format')
    assert.equal(state.modeSource, before.modeSource, 'the toggle touched the latch')
    assert.equal(state.preview, before.preview, 'the toggle moved the preview')
    assert.equal(state.conversion, before.conversion, 'the toggle moved the conversion')
  })
})
