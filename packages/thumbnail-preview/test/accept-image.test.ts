// Moved from nick-vogel/nlvogel-site at `6d5d921`. The AC and issue numbers, the gate, the check
// scripts and any path outside `docs/research/` and this package that these comments cite are
// nlvogel-site's.

import assert from 'node:assert/strict'
import { describe, it } from 'vitest'

import {
  ACCEPTED_EXTENSIONS,
  ACCEPTED_MIME_TYPES,
  acceptImage,
  type CandidateFile,
  MAX_FILE_BYTES,
} from '../src/accept-image.ts'

/**
 * The ladder has the most cases and the least visible surface in this feature:
 * a rejection shows one sentence, so a wrong verdict still looks like a working
 * tool. Every rung is exercised here, before any component imports it.
 */

const file = (over: Partial<CandidateFile> = {}): CandidateFile => ({
  name: 'thumbnail.png',
  type: 'image/png',
  size: 1024,
  ...over,
})

describe('rung 1: the type is one of the five', () => {
  for (const type of ACCEPTED_MIME_TYPES) {
    it(`accepts ${type}`, () => {
      assert.equal(acceptImage(file({ type, name: 'a' })).outcome, 'accept')
    })
  }

  it('accepts an animated GIF, which animates in the tiles rather than being flattened', () => {
    // Frame extraction needs a canvas draw and buys nothing, so GIF is a
    // first-class accepted type rather than a tolerated one.
    assert.equal(acceptImage(file({ type: 'image/gif', name: 'loop.gif' })).outcome, 'accept')
  })

  it('accepts a type carrying a parameter or odd casing', () => {
    // An OS can hand over `IMAGE/JPEG` or `image/jpeg; charset=binary`. Both
    // would miss an exact-equality check and drop to rung 3, where the file
    // still decodes, so the bug would be invisible while the ladder quietly
    // did less than it claims.
    assert.equal(acceptImage(file({ type: 'IMAGE/JPEG', name: 'a.jpg' })).outcome, 'accept')
    assert.equal(
      acceptImage(file({ type: 'image/jpeg; charset=binary', name: 'a.jpg' })).outcome,
      'accept',
    )
  })
})

describe('rung 2: an empty type falls back to the extension', () => {
  /**
   * THE CASE THAT MATTERS MOST IN THE FIELD. A PNG dragged out of a Finder
   * window arrives with `type: ''`, so a strict MIME allowlist refuses a
   * perfectly valid file. This is the single most likely way the tool fails a
   * real creator on their first attempt.
   */
  it('ACCEPTS a file with an empty type and a .png name', () => {
    assert.equal(acceptImage(file({ type: '', name: 'from-finder.png' })).outcome, 'accept')
  })

  for (const extension of ACCEPTED_EXTENSIONS) {
    it(`accepts an empty type with a .${extension} name`, () => {
      assert.equal(acceptImage(file({ type: '', name: `a.${extension}` })).outcome, 'accept')
    })
  }

  it('matches the extension case-insensitively', () => {
    assert.equal(acceptImage(file({ type: '', name: 'SCREENSHOT.PNG' })).outcome, 'accept')
  })

  it('reads the LAST dot, so a dotted name still resolves', () => {
    assert.equal(acceptImage(file({ type: '', name: 'thumb.v2.final.jpg' })).outcome, 'accept')
  })

  it('falls to rung 3 on an empty type with an unknown extension', () => {
    assert.equal(acceptImage(file({ type: '', name: 'mystery.dat' })).outcome, 'needs-decode')
  })

  it('falls to rung 3 on an empty type with no extension at all', () => {
    assert.equal(acceptImage(file({ type: '', name: 'screenshot' })).outcome, 'needs-decode')
  })

  it('does not read a leading dot as an extension', () => {
    assert.equal(acceptImage(file({ type: '', name: '.png' })).outcome, 'needs-decode')
  })
})

describe('rung 3: unresolved, so the decoder decides', () => {
  it('defers a non-image type to the decode rather than guessing', () => {
    // The decode failure is the backstop, per the spec. Refusing here on the
    // MIME string alone would re-introduce the allowlist rung 2 exists to fix.
    assert.equal(
      acceptImage(file({ type: 'text/plain', name: 'notes.txt' })).outcome,
      'needs-decode',
    )
    assert.equal(
      acceptImage(file({ type: 'application/pdf', name: 'a.pdf' })).outcome,
      'needs-decode',
    )
  })

  /**
   * `in` WALKS THE PROTOTYPE CHAIN. With rung 1 written as `type in ACCEPTED`,
   * a file typed `constructor` was accepted outright and skipped both the
   * extension fallback and the decode backstop.
   */
  it('does not accept a type that is only an Object prototype member', () => {
    for (const type of ['constructor', 'toString', 'valueOf', 'hasOwnProperty']) {
      assert.equal(acceptImage(file({ type, name: 'odd' })).outcome, 'needs-decode', type)
    }
  })

  it('defers application/octet-stream with a .png name, which some tools produce', () => {
    // The extension fallback is scoped to an EMPTY type by the spec, so this
    // does NOT take rung 2. It decodes fine, which is why deferring is safe.
    assert.equal(
      acceptImage(file({ type: 'application/octet-stream', name: 'a.png' })).outcome,
      'needs-decode',
    )
  })
})

describe('the named refusals', () => {
  it('refuses image/svg+xml by name', () => {
    const verdict = acceptImage(file({ type: 'image/svg+xml', name: 'logo.svg' }))
    assert.equal(verdict.outcome, 'reject')
    assert.equal(verdict.outcome === 'reject' && verdict.reason, 'svg')
  })

  it('refuses an SVG on its extension too, with an empty type', () => {
    const verdict = acceptImage(file({ type: '', name: 'logo.svg' }))
    assert.equal(verdict.outcome === 'reject' && verdict.reason, 'svg')
  })

  it('refuses image/heic and image/heif by name', () => {
    for (const type of ['image/heic', 'image/heif']) {
      const verdict = acceptImage(file({ type, name: 'IMG_0001' }))
      assert.equal(verdict.outcome === 'reject' && verdict.reason, 'heic')
    }
  })

  /**
   * HEIC IS THE CASE THAT MAKES THE EXTENSION CHECK MANDATORY. It is the
   * default iPhone format and the format most likely to arrive with an empty
   * `type`, so a type-only check would miss it exactly when it matters and
   * leave the most common single mistake this tool will see to a bare decode
   * failure with no instruction in it.
   */
  it('refuses a .heic and a .heif on the extension, with an empty type', () => {
    for (const name of ['IMG_0001.heic', 'IMG_0001.HEIF']) {
      const verdict = acceptImage(file({ type: '', name }))
      assert.equal(verdict.outcome === 'reject' && verdict.reason, 'heic', name)
    }
  })

  it('names what to do instead, in every rejection message', () => {
    // A rejection that only says no is the failure mode here: the creator is
    // holding a file and needs the next action, not a verdict.
    for (const candidate of [
      file({ type: 'image/svg+xml', name: 'a.svg' }),
      file({ type: 'image/heic', name: 'a.heic' }),
      file({ size: MAX_FILE_BYTES + 1 }),
    ]) {
      const verdict = acceptImage(candidate)
      assert.equal(verdict.outcome, 'reject')
      if (verdict.outcome !== 'reject') continue
      assert.ok(verdict.message.length > 20, verdict.message)
      assert.ok(/\b(export|try again|thumbnail)\b/i.test(verdict.message), verdict.message)
    }
  })

  it('writes no em-dash and no exclamation mark in any message', () => {
    // The design contract bans both site-wide, and these strings reach the
    // page without passing through any copy check that scans source files.
    for (const candidate of [
      file({ type: 'image/svg+xml', name: 'a.svg' }),
      file({ type: 'image/heic', name: 'a.heic' }),
      file({ size: MAX_FILE_BYTES + 1 }),
    ]) {
      const verdict = acceptImage(candidate)
      if (verdict.outcome !== 'reject') continue
      assert.ok(!verdict.message.includes('—'), verdict.message)
      assert.ok(!verdict.message.includes('!'), verdict.message)
    }
  })
})

describe('the 25 MB ceiling', () => {
  it('accepts a file measuring exactly 25 MB, because ABOVE the ceiling is refused', () => {
    assert.equal(acceptImage(file({ size: MAX_FILE_BYTES })).outcome, 'accept')
  })

  it('refuses one byte over', () => {
    const verdict = acceptImage(file({ size: MAX_FILE_BYTES + 1 }))
    assert.equal(verdict.outcome === 'reject' && verdict.reason, 'too-large')
  })

  /**
   * SIZE IS CHECKED BEFORE THE TYPE LADDER, and this is the leg that proves it.
   * A 400 MB file with an accepted type would otherwise be accepted outright,
   * and a 400 MB `.mov` renamed `.png` would be sent back as an image problem
   * when it is a size problem.
   */
  it('refuses an oversized file even when its type is one of the five', () => {
    const verdict = acceptImage(file({ type: 'image/png', size: 400 * 1024 * 1024 }))
    assert.equal(verdict.outcome === 'reject' && verdict.reason, 'too-large')
  })

  it('states the ceiling as 25 binary megabytes, so the message and the check agree', () => {
    assert.equal(MAX_FILE_BYTES, 26_214_400)
  })
})

describe('the two lists are one list', () => {
  /**
   * Rung 2 falls back "against the same list" per the spec. The extensions are
   * derived from the MIME map rather than hand-written, so this asserts the
   * shape that makes the claim structural instead of a coincidence two literals
   * have to keep.
   */
  it('derives five MIME types and six extensions from one map', () => {
    assert.deepEqual(
      [...ACCEPTED_MIME_TYPES],
      ['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif'],
    )
    assert.deepEqual([...ACCEPTED_EXTENSIONS], ['png', 'jpg', 'jpeg', 'webp', 'avif', 'gif'])
  })

  it('lists no accepted extension that is also a named refusal', () => {
    for (const extension of ['svg', 'heic', 'heif']) {
      assert.ok(!ACCEPTED_EXTENSIONS.includes(extension), extension)
    }
  })
})
