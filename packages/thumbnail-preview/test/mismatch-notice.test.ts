// Moved from nick-vogel/nlvogel-site at `6d5d921`. The AC and issue numbers, the gate, the check
// scripts and any path outside `docs/research/` and this package that these comments cite are
// nlvogel-site's.

import assert from 'node:assert/strict'
import { describe, it } from 'vitest'

import { mismatchNotice, TILE_MARKER } from '../src/mismatch-notice.ts'
import { isMismatched } from '../src/slot-state.ts'

/**
 * FOUR CASES, one per cell of mode x belongs-elsewhere. Each asserts the exact
 * strings, because the copy is the deliverable here: the notice exists to
 * explain what the preview is doing, and a sentence that is merely plausible
 * rather than true is the whole failure mode.
 *
 * EVERY FIXTURE IS ALSO ASSERTED TO BE MISMATCHED. Without that, a case could
 * describe an image the notice would never appear for, and the suite would still
 * be green.
 */
const px = (width: number, height: number) => ({ width, height })

describe('the mismatch notice', () => {
  it('names a VERTICAL image in landscape mode, which is the spec-written case', () => {
    const image = px(1080, 1920)
    assert.equal(isMismatched(image, 'landscape'), true, 'the fixture must actually be mismatched')
    const n = mismatchNotice('B', image, 'landscape')
    assert.equal(n.headline, 'B is a vertical image.')
    assert.equal(
      n.body,
      'Landscape mode crops it to 16:9, so the edges you designed are gone. Switch to Shorts to judge it fairly.',
    )
    assert.equal(n.actionLabel, 'Switch to Shorts')
    assert.equal(n.targetMode, 'shorts')
    assert.equal(n.chipMarker, 'Vertical')
  })

  /**
   * THE CASE A THREE-WAY BRANCH GETS WRONG. A 4:3 photo is 25% off 16:9 and is
   * plainly not vertical, so a branch that only asked "is it mismatched" in
   * landscape would have told the creator their photo is a vertical image.
   */
  it('does NOT call a 4:3 photo vertical in landscape mode', () => {
    const image = px(1600, 1200)
    assert.equal(isMismatched(image, 'landscape'), true, 'the fixture must actually be mismatched')
    const n = mismatchNotice('A', image, 'landscape')
    assert.equal(n.headline, 'A is not 16:9.')
    assert.equal(n.body, 'Landscape mode crops A to 16:9, so the edges you designed are gone.')
    assert.equal(n.chipMarker, 'Cropped')
    assert.equal(n.targetMode, 'shorts')
  })

  it('names a LANDSCAPE image in Shorts mode', () => {
    const image = px(1280, 720)
    assert.equal(isMismatched(image, 'shorts'), true, 'the fixture must actually be mismatched')
    const n = mismatchNotice('C', image, 'shorts')
    assert.equal(n.headline, 'C is a landscape image.')
    assert.equal(n.body, 'Shorts mode shows a 9:16 frame, so most of C is cropped away.')
    assert.equal(n.actionLabel, 'Switch to Landscape')
    assert.equal(n.targetMode, 'landscape')
    assert.equal(n.chipMarker, 'Landscape')
  })

  /**
   * THE 2:3 PRE-CROPPED COVER, which is the case the spec names for the Shorts
   * wording: it must say the image is already cropped rather than that it is the
   * wrong format. It is 18.5% off and IS flagged, which the spec accepts.
   */
  it('says a 2:3 cover in Shorts mode is already cropped, not the wrong format', () => {
    const image = px(1080, 1620)
    assert.equal(isMismatched(image, 'shorts'), true, 'the fixture must actually be mismatched')
    const n = mismatchNotice('A', image, 'shorts')
    assert.equal(n.headline, 'A is already cropped.')
    assert.equal(
      n.body,
      'Shorts mode shows the full 9:16 frame, so A is judged against more height than it was exported with.',
    )
    assert.equal(n.chipMarker, 'Cropped')
  })

  it('always offers the OTHER mode, so the action is never a no-op', () => {
    for (const [image, mode] of [
      [px(1080, 1920), 'landscape'],
      [px(1600, 1200), 'landscape'],
      [px(1280, 720), 'shorts'],
      [px(1080, 1620), 'shorts'],
    ] as const) {
      assert.notEqual(mismatchNotice('A', image, mode).targetMode, mode)
    }
  })

  /**
   * THE TWO MARKERS SAY DIFFERENT THINGS. The tile's names what the tile DOES;
   * the chip's names what the image IS. Where they would coincide the chip's is
   * "Cropped" too, and that is the only case they agree.
   */
  it('keeps the tile marker fixed while the chip marker varies', () => {
    assert.equal(TILE_MARKER, 'Cropped')
    assert.equal(mismatchNotice('A', px(1080, 1920), 'landscape').chipMarker, 'Vertical')
    assert.equal(mismatchNotice('A', px(1280, 720), 'shorts').chipMarker, 'Landscape')
    assert.equal(mismatchNotice('A', px(1080, 1620), 'shorts').chipMarker, 'Cropped')
  })

  it('carries no em-dash and no exclamation mark in any string', () => {
    for (const [image, mode] of [
      [px(1080, 1920), 'landscape'],
      [px(1600, 1200), 'landscape'],
      [px(1280, 720), 'shorts'],
      [px(1080, 1620), 'shorts'],
    ] as const) {
      const n = mismatchNotice('A', image, mode)
      for (const text of [n.headline, n.body, n.actionLabel, n.chipMarker]) {
        assert.ok(!text.includes('—'), `em-dash in ${JSON.stringify(text)}`)
        assert.ok(!text.includes('!'), `exclamation mark in ${JSON.stringify(text)}`)
      }
    }
  })
})
