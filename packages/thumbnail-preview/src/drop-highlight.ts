// Moved from nick-vogel/nlvogel-site at `6d5d921`. The AC and issue numbers, the gate, the check
// scripts and any path outside `docs/research/` and this package that these comments cite are
// nlvogel-site's.

/**
 * The drop-zone highlight, as a depth counter per zone.
 *
 * WHY A COUNTER AND NOT A BOOLEAN. `dragenter` and `dragleave` both bubble, so a
 * pointer moving from a zone's own surface onto a button inside that zone fires
 * `dragleave` (leaving the surface) and `dragenter` (entering the button), and
 * both reach the zone. The shipped handler was
 * `setOver((current) => (current === id ? null : current))`, which cleared on
 * that interior `dragleave` and dropped the highlight while the pointer was
 * still inside the zone. Counting enters against leaves is the standard answer:
 * the zone is lit while its depth is above zero, so an interior boundary
 * crossing nets out to no change.
 *
 * WHY IT IS A MODULE AND NOT A HOOK. Two components own this state, `Slots` and
 * `CandidateBar`, and they carried two copies of the same handler. There is also
 * no component test runner in this repo, so behavior left inside a component is
 * behavior no test can reach. Pure functions over a plain object are testable by
 * the suite that already exists.
 *
 * WHY `reset()` IS PART OF THE PUBLIC API. A counter can be left above zero by a
 * drag that never produces a `drop`: the creator drags back out of the browser
 * window, or releases over something that refuses the drop, or re-drags fast
 * enough across a nested boundary that the enter and leave pairing desyncs.
 * Every one of those leaves the highlight lit forever, and nothing in the suite
 * would see it, because the browser gate dispatches only synthetic `dragover`
 * and `drop` and never `dragenter` or `dragleave`. So the recovery path is
 * exported rather than left to each consumer to invent, and each consumer
 * attaches it to the window events that mean "this drag is over".
 */

/** Zone ids are the caller's own union, so a typo cannot address a zone. */
export type DropHighlight<Zone extends string> = {
  /** A `dragenter` for `zone`: deepens it by one and lights it. */
  enter: (zone: Zone) => Zone | null
  /** A `dragleave` for `zone`: shallows it by one, clearing only at zero. */
  leave: (zone: Zone) => Zone | null
  /** A `drop`: the drag ended where it meant to, so everything clears. */
  drop: () => null
  /** The recovery path: the drag ended anywhere else, so everything clears. */
  reset: () => null
  /** The lit zone, or null. This is what drives the `--over` class. */
  current: () => Zone | null
  /** How many unclosed enters `zone` holds. Exposed for the tests. */
  depthOf: (zone: Zone) => number
}

/**
 * Every mutator RETURNS the lit zone rather than only recording it, because
 * every caller is a React event handler that has to feed `setOver`. A getter
 * alone would make each of the eight call sites two statements, and the second
 * statement is the one that gets forgotten.
 */
export const createDropHighlight = <Zone extends string>(): DropHighlight<Zone> => {
  const depth = new Map<Zone, number>()
  let over: Zone | null = null

  /**
   * `drop` and `reset` do the same thing on purpose, and they are two names
   * because they answer two different questions. `drop` is the expected end of a
   * drag and belongs on the element; `reset` is the recovery for a drag that
   * ended without one and belongs on the window. Reading `reset` at a `drop`
   * call site, or the reverse, would hide which case the code is handling.
   */
  const clear = (): null => {
    depth.clear()
    over = null
    return null
  }

  return {
    enter: (zone) => {
      depth.set(zone, (depth.get(zone) ?? 0) + 1)
      over = zone
      return over
    },

    leave: (zone) => {
      /**
       * Floored at zero, so an unpaired `dragleave` cannot drive the count
       * negative and then swallow the next real enter. A first event that is a
       * leave is normal: the drag can start inside the zone.
       */
      const next = Math.max(0, (depth.get(zone) ?? 0) - 1)
      if (next === 0) depth.delete(zone)
      else depth.set(zone, next)

      /**
       * The zone clears only when it is BOTH the lit one and fully exited. The
       * `over === zone` half is the shipped bugfix this replaces: a leave from a
       * neighbouring zone must not put out a zone the pointer already moved to.
       */
      if (next === 0 && over === zone) over = null
      return over
    },

    drop: clear,
    reset: clear,
    current: () => over,
    depthOf: (zone) => depth.get(zone) ?? 0,
  }
}
