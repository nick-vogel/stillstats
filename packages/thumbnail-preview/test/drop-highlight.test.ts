// Moved from nick-vogel/nlvogel-site at `6d5d921`. The AC and issue numbers, the gate, the check
// scripts and any path outside `docs/research/` and this package that these comments cite are
// nlvogel-site's.

import assert from 'node:assert/strict'
import { describe, it } from 'vitest'

import { createDropHighlight } from '../src/drop-highlight.ts'

/**
 * The reported defect is a drag path, not a value, so every case here is a
 * SEQUENCE of events in the order the browser fires them. The zone ids are the
 * slot letters the two consuming components use.
 *
 * The last describe block re-runs the same sequence against the logic this
 * module replaces, and asserts it gets the WRONG answer. That is the negative
 * control: without it, the cases above pass just as happily against a
 * reimplementation of the bug.
 */

type Zone = 'A' | 'B' | 'C'

describe('the highlight survives an interior dragleave', () => {
  it('holds while the pointer moves from the zone onto a child of the zone', () => {
    const highlight = createDropHighlight<Zone>()

    // The pointer enters the drop zone. Both events below bubble to the same
    // zone element, which is why both are reported against 'A'.
    assert.equal(highlight.enter('A'), 'A')
    assert.equal(highlight.depthOf('A'), 1)

    // The pointer moves onto the "Choose a file" button inside the zone. The
    // browser fires `dragenter` on the button first, then `dragleave` on the
    // surface behind it, and both bubble up.
    assert.equal(highlight.enter('A'), 'A')
    assert.equal(highlight.depthOf('A'), 2)

    assert.equal(highlight.leave('A'), 'A', 'the interior dragleave must not put the zone out')
    assert.equal(highlight.depthOf('A'), 1)

    // Still lit, which is the whole point of the fix.
    assert.equal(highlight.current(), 'A')
  })

  it('drops once the pointer leaves the zone itself', () => {
    const highlight = createDropHighlight<Zone>()

    highlight.enter('A')
    highlight.enter('A')
    highlight.leave('A')

    assert.equal(highlight.leave('A'), null)
    assert.equal(highlight.depthOf('A'), 0)
    assert.equal(highlight.current(), null)
  })

  it('moves the highlight to a neighbouring zone without the old zone putting it out', () => {
    const highlight = createDropHighlight<Zone>()

    // Crossing from A to B fires `dragenter` on B before `dragleave` on A, so
    // the A leave arrives while B is the lit zone and must be ignored.
    highlight.enter('A')
    assert.equal(highlight.enter('B'), 'B')
    assert.equal(highlight.leave('A'), 'B')
    assert.equal(highlight.current(), 'B')
    assert.equal(highlight.depthOf('A'), 0)
    assert.equal(highlight.depthOf('B'), 1)
  })

  it('clears on drop regardless of the depth left behind', () => {
    const highlight = createDropHighlight<Zone>()

    // Three enters and no leaves at all, which is what a drop onto a nested
    // child looks like: the drop ends the drag, so the unclosed enters never
    // get their leaves.
    highlight.enter('A')
    highlight.enter('A')
    highlight.enter('A')

    assert.equal(highlight.drop(), null)
    assert.equal(highlight.depthOf('A'), 0)
    assert.equal(highlight.current(), null)
  })

  it('ignores an unpaired leave rather than driving the count negative', () => {
    const highlight = createDropHighlight<Zone>()

    // A drag can begin inside the zone, so the first event can be a leave. If
    // that drove the depth to -1, the next real enter would come back at 0 and
    // the zone would never light.
    assert.equal(highlight.leave('A'), null)
    assert.equal(highlight.depthOf('A'), 0)
    assert.equal(highlight.enter('A'), 'A')
    assert.equal(highlight.depthOf('A'), 1)
  })
})

describe('reset recovers a drag that ended without a drop', () => {
  it('clears the depth and the highlight with no drop and no matching leaves', () => {
    const highlight = createDropHighlight<Zone>()

    // The creator drags in, moves onto a child, then drags back out of the
    // browser window or releases over something invalid. No `drop` arrives and
    // neither enter gets its leave, so without `reset` the zone stays lit for
    // the rest of the session.
    highlight.enter('A')
    highlight.enter('A')
    assert.equal(highlight.depthOf('A'), 2)

    assert.equal(highlight.reset(), null)
    assert.equal(highlight.depthOf('A'), 0)
    assert.equal(highlight.current(), null)
  })

  it('leaves the counter usable for the next drag', () => {
    const highlight = createDropHighlight<Zone>()

    highlight.enter('A')
    highlight.enter('B')
    highlight.reset()

    assert.equal(highlight.enter('A'), 'A')
    assert.equal(highlight.depthOf('A'), 1)
    assert.equal(highlight.depthOf('B'), 0)
  })
})

/**
 * THE NEGATIVE CONTROL, kept as running code rather than as a comment.
 *
 * This is the handler both components shipped before this module: one boolean
 * zone id, cleared on ANY `dragleave` naming the lit zone, with no depth and no
 * recovery path. The cases below run the same two sequences against it and
 * assert the wrong answers, so the delta is executable: if anyone reintroduces
 * clear-on-any-leave in `drop-highlight.ts`, the block above goes red while this
 * block stays green, and the pair names the defect.
 */
const createClearOnAnyLeave = () => {
  let over: Zone | null = null
  return {
    over: () => over,
    dragOver: (zone: Zone) => {
      over = zone
    },
    dragLeave: (zone: Zone) => {
      over = over === zone ? null : over
    },
    drop: () => {
      over = null
    },
  }
}

describe('negative control: the pre-fix clear-on-any-leave logic', () => {
  it('WRONGLY puts the zone out on the interior dragleave', () => {
    const old = createClearOnAnyLeave()

    old.dragOver('A')
    assert.equal(old.over(), 'A')

    // The same interior boundary crossing as the first case above. The old
    // logic has nothing to count, so the child's `dragleave` reads exactly like
    // leaving the zone.
    old.dragLeave('A')

    assert.equal(
      old.over(),
      null,
      'recorded defect: the highlight went out with the pointer still inside the zone',
    )
  })

  it('has no recovery path for a drag that ends without a drop', () => {
    const old = createClearOnAnyLeave()

    // The old handler's only clears are `dragleave` and `drop`. A drag out of
    // the window fires neither on the zone, so `onDragOver`'s unconditional
    // write was what covered this up: it relit the zone on every move, and it
    // is the write step 1 removes. Nothing here can clear the zone but the
    // events that never come.
    old.dragOver('A')
    assert.equal(old.over(), 'A')
    assert.equal(
      Object.hasOwn(old, 'reset'),
      false,
      'recorded defect: no reset, so a drag that ends outside the page leaves the zone lit',
    )
  })
})
