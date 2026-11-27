// Moved from nick-vogel/nlvogel-site at `6d5d921`. The AC and issue numbers, the gate, the check
// scripts and any path outside `docs/research/` and this package that these comments cite are
// nlvogel-site's.

/**
 * The thumbnail tool's acceptance ladder, as pure logic.
 *
 * WHY IT IS A LADDER AND NOT AN ALLOWLIST. `File.type` is empty far more often
 * than it looks: a drag out of a Finder window and the common iPhone HEIC both
 * arrive with `type: ''`. A strict MIME allowlist therefore refuses valid PNGs,
 * which is the single most likely way this tool fails a real creator on their
 * first try. The three rungs are:
 *
 *   1. accept on the five supported MIME types
 *   2. on an EMPTY type, fall back to the file extension against the same list
 *   3. otherwise defer to the decode, and let the decode failure be the backstop
 *
 * Rung 3 is deliberate rather than lazy. Every MIME string here is supplied by
 * the operating system and can be wrong in both directions, so the decoder is
 * the only oracle that actually answers "is this an image". The ladder's job is
 * to refuse the cases a decoder cannot judge or would judge too late, and to
 * hand everything else to it.
 *
 * WHY IT LIVES IN ITS OWN MODULE, WITH NO UI. This is the part with the most
 * cases and the least visible surface: a rejection path shows one sentence, so
 * a wrong verdict looks like a working tool. It is written and tested before
 * any component imports it.
 *
 * A LADDER REJECTION NEVER CONSUMES A SLOT; A DECODE FAILURE DOES. This module
 * runs before slot assignment and the decode runs after it, which is the whole
 * reason `needs-decode` is a distinct verdict rather than being folded into
 * `accept`.
 */

/**
 * The extensions are DERIVED from the MIME map rather than being a second
 * hand-written list. The spec says rung 2 falls back "against the same list",
 * and keying them together is what makes that structurally true instead of a
 * claim two literals have to keep agreeing with.
 */
const ACCEPTED: Record<string, readonly string[]> = {
  'image/png': ['png'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/webp': ['webp'],
  'image/avif': ['avif'],
  'image/gif': ['gif'],
}

export const ACCEPTED_MIME_TYPES: readonly string[] = Object.keys(ACCEPTED)
export const ACCEPTED_EXTENSIONS: readonly string[] = Object.values(ACCEPTED).flat()

/**
 * The two named refusals, each with the reason it is named rather than left to
 * the decoder.
 *
 * SVG decodes perfectly well, so the decoder would accept it and every tile
 * would then scale it to fit. That is precisely wrong for this tool: an SVG has
 * no intrinsic pixel size, so "your thumbnail at 220 pixels" would be a
 * statement about nothing.
 *
 * HEIC is the opposite case. It is the default iPhone format and no browser
 * outside Safari can decode it, so leaving it to rung 3 produces a bare decode
 * failure for the most common single mistake this tool will see, at the exact
 * moment the creator needs to be told what to do instead.
 */
const REFUSED = {
  svg: {
    extensions: ['svg'],
    mimeTypes: ['image/svg+xml'],
    message:
      'SVG files have no fixed pixel size, so there is nothing to preview at a real width. Export a PNG or JPEG first.',
  },
  heic: {
    extensions: ['heic', 'heif'],
    mimeTypes: ['image/heic', 'image/heif'],
    message:
      'HEIC and HEIF files do not open in most browsers. Export a JPEG or PNG from Photos and try again.',
  },
} as const

/**
 * 25 MB, binary. The ceiling exists to refuse a video or a raw camera file
 * dropped by mistake, not to police thumbnails: a 4000px master is the normal
 * case here and there is no pixel-dimension ceiling at all. ABOVE the ceiling
 * is refused, so a file measuring exactly 25 MB is accepted.
 */
export const MAX_FILE_BYTES = 25 * 1024 * 1024

export type RejectReason = 'svg' | 'heic' | 'too-large'

export type AcceptVerdict =
  | { outcome: 'accept' }
  | { outcome: 'needs-decode' }
  | { outcome: 'reject'; reason: RejectReason; message: string }

/** Structural, so tests need no `File` and no DOM. */
export type CandidateFile = {
  name: string
  type: string
  size: number
}

export const TOO_LARGE_MESSAGE =
  'That file is larger than 25 MB. A thumbnail export is normally a small fraction of that.'

/** Lowercased, no dot. `''` for a file with no extension, and for `.hidden`. */
const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf('.')
  if (dot <= 0 || dot === name.length - 1) return ''
  return name.slice(dot + 1).toLowerCase()
}

/**
 * MIME types are matched case-insensitively and without parameters. A type can
 * arrive as `image/jpeg; charset=binary` or `IMAGE/JPEG`, and either would miss
 * an exact-equality check and fall through to rung 3, where a valid JPEG would
 * still decode. So this is not a correctness fix, it is a fix for the ladder
 * silently doing less work than it claims to.
 */
const normalizeType = (type: string): string => (type.split(';')[0] as string).trim().toLowerCase()

export const acceptImage = (file: CandidateFile): AcceptVerdict => {
  /**
   * SIZE FIRST, before the type ladder. A 400 MB `.mov` renamed to `.png` is a
   * size problem and reading it as an image problem would send the creator to
   * re-export a file that was never going to fit. It is also the one check that
   * cannot be deferred to the decoder without loading the whole file.
   */
  if (file.size > MAX_FILE_BYTES) {
    return { outcome: 'reject', reason: 'too-large', message: TOO_LARGE_MESSAGE }
  }

  const type = normalizeType(file.type)
  const extension = extensionOf(file.name)

  /**
   * The named refusals are checked on the type AND on the extension, not on the
   * type alone. HEIC is the case that makes this mandatory rather than tidy:
   * it is the format most likely to arrive with an empty `type`, so a
   * type-only check would miss it exactly when it matters and leave the common
   * iPhone drop to a bare decode failure.
   */
  for (const [reason, refusal] of Object.entries(REFUSED)) {
    const named =
      (refusal.mimeTypes as readonly string[]).includes(type) ||
      (refusal.extensions as readonly string[]).includes(extension)
    if (named) {
      return { outcome: 'reject', reason: reason as RejectReason, message: refusal.message }
    }
  }

  /**
   * Rung 1: the type says it is one of the five.
   *
   * `Object.hasOwn`, NOT `in`: `in` walks the prototype chain, so a file whose
   * type normalises to `constructor`, `toString`, `valueOf` or `hasOwnProperty`
   * would be accepted outright and skip both the extension fallback and the
   * decode backstop.
   */
  if (Object.hasOwn(ACCEPTED, type)) return { outcome: 'accept' }

  // Rung 2: an EMPTY type falls back to the extension, against the same list.
  if (type === '' && ACCEPTED_EXTENSIONS.includes(extension)) return { outcome: 'accept' }

  /**
   * Rung 3: unresolved, so the decoder decides.
   *
   * Reached by a non-empty type outside the list (`application/octet-stream`
   * with a `.png` name, which some tools produce and which decodes fine) and by
   * an empty type with an unknown extension. Both are more likely to be a real
   * image than not, and neither is a claim this module can settle.
   */
  return { outcome: 'needs-decode' }
}
