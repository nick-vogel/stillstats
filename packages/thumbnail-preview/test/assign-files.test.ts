// Moved from nick-vogel/nlvogel-site at `6d5d921`. The AC and issue numbers, the gate, the check
// scripts and any path outside `docs/research/` and this package that these comments cite are
// nlvogel-site's.

import assert from 'node:assert/strict'
import { describe, it } from 'vitest'

import type { CandidateFile } from '../src/accept-image.ts'
import { overflowMessage, planAssignment, rejectionMessage } from '../src/assign-files.ts'
import { initialToolState, type SlotId, type ToolState, toolReducer } from '../src/slot-state.ts'

const png = (name: string): CandidateFile => ({ name, type: 'image/png', size: 2048 })
const svg = (name: string): CandidateFile => ({ name, type: 'image/svg+xml', size: 2048 })
const heic = (name: string): CandidateFile => ({ name, type: 'image/heic', size: 2048 })
const huge = (name: string): CandidateFile => ({ name, type: 'image/png', size: 40 * 1024 * 1024 })

/** Fills a slot without touching the object-URL ledger, which is step 5's suite. */
const filled = (state: ToolState, slot: SlotId, name = 'existing.png'): ToolState => {
  const generation = 1
  return [
    { type: 'decode-started' as const, slot, generation },
    {
      type: 'decode-succeeded' as const,
      slot,
      generation,
      source: 'drop' as const,
      image: { url: `blob:existing/${slot}`, name, width: 1280, height: 720 },
    },
  ].reduce(toolReducer, state)
}

describe('assignment is sequential over ACCEPTED files, not positional over dropped ones', () => {
  /**
   * THE RULE THAT MOST EASILY GOES WRONG. Dropping an SVG then a PNG must put
   * the PNG in slot A. A positional implementation leaves A empty because
   * position one was refused, which reads as the tool losing a valid file.
   */
  it('puts the first ACCEPTED file in slot A even when the first DROPPED file is refused', () => {
    const plan = planAssignment([svg('logo.svg'), png('real.png')], initialToolState())
    assert.deepEqual(
      plan.assignments.map((a) => [a.slot, a.file.name]),
      [['A', 'real.png']],
    )
    assert.equal(plan.rejected.length, 1)
    assert.equal(plan.overflow, 0)
  })

  it('fills A, B and C in order from an empty tool', () => {
    const plan = planAssignment([png('1.png'), png('2.png'), png('3.png')], initialToolState())
    assert.deepEqual(
      plan.assignments.map((a) => a.slot),
      ['A', 'B', 'C'],
    )
  })

  it('fills only the EMPTY slots, leaving a filled one alone', () => {
    const state = filled(initialToolState(), 'A')
    const plan = planAssignment([png('1.png'), png('2.png')], state)
    assert.deepEqual(
      plan.assignments.map((a) => a.slot),
      ['B', 'C'],
    )
  })

  it('counts a needs-decode file as accepted, because only the ladder can reject', () => {
    // A file the ladder cannot judge takes its slot and the decode settles it.
    // The spec's line is exact: a ladder rejection never consumes a slot, a
    // decode failure does.
    const unknown: CandidateFile = { name: 'mystery.dat', type: '', size: 100 }
    const plan = planAssignment([unknown], initialToolState())
    assert.equal(plan.assignments.length, 1)
    assert.equal(plan.rejected.length, 0)
  })
})

describe('a drop aimed at a FILLED slot', () => {
  /**
   * AC 16's stated case: three files onto a filled slot A replaces A and fills
   * B and C.
   */
  it('replaces the target, then fills the empty slots in order', () => {
    const state = filled(initialToolState(), 'A')
    const plan = planAssignment([png('1.png'), png('2.png'), png('3.png')], state, 'A')
    assert.deepEqual(
      plan.assignments.map((a) => [a.slot, a.file.name]),
      [
        ['A', '1.png'],
        ['B', '2.png'],
        ['C', '3.png'],
      ],
    )
    assert.equal(plan.overflow, 0)
  })

  it('never assigns the target twice', () => {
    // The target is removed from the tail, so a drop on B cannot put a second
    // file back into B after the first one took it.
    const state = filled(initialToolState(), 'B')
    const plan = planAssignment([png('1.png'), png('2.png')], state, 'B')
    const slots = plan.assignments.map((a) => a.slot)
    assert.deepEqual(slots, ['B', 'A'])
    assert.equal(new Set(slots).size, slots.length)
  })

  it('starts at an EMPTY target too, rather than always starting at A', () => {
    const plan = planAssignment([png('1.png'), png('2.png')], initialToolState(), 'B')
    assert.deepEqual(
      plan.assignments.map((a) => a.slot),
      ['B', 'A'],
    )
  })
})

describe('overflow', () => {
  it('takes the first three of five and reports two over', () => {
    const five = ['1', '2', '3', '4', '5'].map((n) => png(`${n}.png`))
    const plan = planAssignment(five, initialToolState())
    assert.equal(plan.assignments.length, 3)
    assert.equal(plan.overflow, 2)
  })

  /**
   * OVERFLOW COUNTS ACCEPTED FILES ONLY. Five files where two are refused is
   * three accepted into three slots, which is not an overflow at all. Counting
   * dropped files instead would tell the creator two were skipped for being
   * surplus when they were skipped for being SVGs.
   */
  it('does not count REJECTED files as overflow', () => {
    const plan = planAssignment(
      [png('1.png'), svg('a.svg'), png('2.png'), heic('b.heic'), png('3.png')],
      initialToolState(),
    )
    assert.equal(plan.assignments.length, 3)
    assert.equal(plan.overflow, 0)
    assert.equal(plan.rejected.length, 2)
  })

  it('reports every accepted file as overflow when the tool is already full', () => {
    let state = filled(initialToolState(), 'A')
    state = filled(state, 'B')
    state = filled(state, 'C')
    const plan = planAssignment([png('1.png')], state)
    assert.equal(plan.assignments.length, 0)
    assert.equal(plan.overflow, 1)
  })
})

describe('the two messages, each shown only when its condition occurred', () => {
  it('says nothing at all about a clean three-file drop', () => {
    const plan = planAssignment([png('1.png'), png('2.png'), png('3.png')], initialToolState())
    assert.equal(rejectionMessage(plan.rejected), null)
    assert.equal(overflowMessage(plan), null)
  })

  it('names the single refused file and gives its reason', () => {
    const plan = planAssignment([svg('logo.svg'), png('ok.png')], initialToolState())
    const message = rejectionMessage(plan.rejected)
    assert.ok(message?.includes('logo.svg'), message ?? '')
    assert.ok(/no fixed pixel size/i.test(message ?? ''), message ?? '')
  })

  it('names every refused file when several share one reason', () => {
    const plan = planAssignment([svg('a.svg'), svg('b.svg')], initialToolState())
    const message = rejectionMessage(plan.rejected) ?? ''
    assert.ok(message.includes('a.svg') && message.includes('b.svg'), message)
  })

  it('falls back to the shared constraint when the reasons differ', () => {
    // Three stacked explanations is not a message. The files are still named,
    // because that is the half the creator cannot work out for themselves.
    const plan = planAssignment([svg('a.svg'), heic('b.heic'), huge('c.png')], initialToolState())
    const message = rejectionMessage(plan.rejected) ?? ''
    assert.ok(
      message.includes('a.svg') && message.includes('b.heic') && message.includes('c.png'),
      message,
    )
    assert.ok(/25 MB or less/.test(message), message)
  })

  it('reports the five-file drop as three taken and two not added', () => {
    const five = ['1', '2', '3', '4', '5'].map((n) => png(`${n}.png`))
    const plan = planAssignment(five, initialToolState())
    const message = overflowMessage(plan) ?? ''
    assert.ok(/five files/.test(message), message)
    assert.ok(/A, B and C/.test(message), message)
    assert.ok(/other two were not added/.test(message), message)
  })

  /**
   * "SKIPPED" READS AS A VERDICT ON THE FILES, which is exactly the reading the
   * two-message split exists to prevent: nothing was wrong with them, the tool
   * simply holds three. The sentence now says so.
   */
  it('does not call the surplus files skipped, which would blame them', () => {
    const five = ['1', '2', '3', '4', '5'].map((n) => png(`${n}.png`))
    const message = overflowMessage(planAssignment(five, initialToolState())) ?? ''
    assert.ok(!/skipped/i.test(message), message)
    assert.ok(/holds three at a time/.test(message), message)
  })

  /**
   * THE FULL TOOL. Reached by the document-level Ctrl+V, which fires whether or
   * not a paste control is on screen, so it is not a hypothetical: three slots
   * filled and one image pasted produced "You dropped one files. undefined took
   * the first zero." The word `undefined` reached the interface.
   */
  it('says the tool is full rather than emitting undefined when nothing was taken', () => {
    let state = filled(initialToolState(), 'A')
    state = filled(state, 'B')
    state = filled(state, 'C')
    const plan = planAssignment([png('one-more.png')], state)

    assert.equal(plan.assignments.length, 0)
    const message = overflowMessage(plan) ?? ''
    assert.ok(!/undefined/.test(message), message)
    assert.ok(!/\bzero\b/.test(message), message)
    assert.ok(/all three slots are full/.test(message), message)
    assert.ok(/Remove one/.test(message), message)
  })

  it('agrees in number when a single file is dropped into a full tool', () => {
    let state = filled(initialToolState(), 'A')
    state = filled(state, 'B')
    state = filled(state, 'C')
    const message = overflowMessage(planAssignment([png('a.png')], state)) ?? ''
    assert.ok(/this image/.test(message), message)
    assert.ok(!/these images/.test(message), message)
  })

  /**
   * "ONE FILES" was reachable on the general sentence too, so the noun agrees
   * with its own number rather than being hardcoded plural.
   */
  it('never writes a singular count against a plural noun', () => {
    const state = filled(filled(initialToolState(), 'A'), 'B')
    const plan = planAssignment([png('1.png'), png('2.png')], state)
    const message = overflowMessage(plan) ?? ''
    assert.ok(!/\bone files\b/.test(message), message)
  })

  it('agrees in number when exactly one file is over', () => {
    const state = filled(initialToolState(), 'A')
    const plan = planAssignment([png('1.png'), png('2.png'), png('3.png')], state)
    const message = overflowMessage(plan) ?? ''
    assert.ok(/other one was not added/.test(message), message)
    assert.ok(!/were not added\./.test(message), message)
  })

  /**
   * THE COUNT IS THE FILES DROPPED, NOT THE FILES ACCEPTED. Deriving it from
   * the assignments plus the overflow counted only the accepted ones, so six
   * files with one SVG among them announced "You dropped five files."
   */
  it('says how many files were DROPPED, counting the refused ones too', () => {
    const plan = planAssignment(
      [png('1.png'), png('2.png'), png('3.png'), png('4.png'), png('5.png'), svg('a.svg')],
      initialToolState(),
    )
    assert.equal(plan.dropped, 6)
    assert.equal(plan.overflow, 2)
    const message = overflowMessage(plan) ?? ''
    assert.ok(/You dropped 6 files/.test(message), message)
  })

  it('shows BOTH messages when both conditions occurred', () => {
    const plan = planAssignment(
      [svg('a.svg'), png('1.png'), png('2.png'), png('3.png'), png('4.png')],
      initialToolState(),
    )
    assert.ok(rejectionMessage(plan.rejected))
    assert.ok(overflowMessage(plan))
  })

  it('writes no em-dash and no exclamation mark in either message', () => {
    const plan = planAssignment(
      [svg('a.svg'), png('1.png'), png('2.png'), png('3.png'), png('4.png')],
      initialToolState(),
    )
    for (const message of [rejectionMessage(plan.rejected), overflowMessage(plan)]) {
      assert.ok(message && !message.includes('—'), message ?? '')
      assert.ok(message && !message.includes('!'), message ?? '')
    }
  })
})
