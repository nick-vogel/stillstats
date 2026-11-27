import { describe, expect, test } from 'vitest'
import { checkReleaseTag, type Release, releaseForTag } from '../src/index.ts'
import { fixtureContentRoot } from './testing.ts'

function release(product: Release['product'], version: string, date: string): Release {
  return {
    product,
    version,
    date,
    summary: 'A fix.',
    removes: false,
    highlights: [],
    html: '',
    body: '',
    path: `/releases/${version}`,
  }
}

// Newest first, as readReleaseContent returns them, with a newer extension note on top.
const releases = [
  release('extension', '1.1.0', '2026-11-10'),
  release('app', '2026.11.9.1', '2026-11-09'),
  release('app', '2026.11.9', '2026-11-09'),
]

function refusalOf(tag: string, from: Release[] = releases): string {
  try {
    checkReleaseTag(tag, from)
  } catch (error) {
    return (error as Error).message
  }
  throw new Error(`checkReleaseTag passed ${tag}`)
}

describe('the release tag check', () => {
  test('a tag equal to the newest app release note deploys that version', () => {
    expect(checkReleaseTag('2026.11.9.1', releases)).toEqual({
      deploy: true,
      version: '2026.11.9.1',
    })
  })

  test('an extension tag answers no deploy', () => {
    expect(checkReleaseTag('extension-1.1.0', releases)).toEqual({ deploy: false })
  })

  test('a tag behind the newest app release note is refused, naming the newest', () => {
    expect(refusalOf('2026.11.9')).toMatch(/2026\.11\.9\b.*2026\.11\.9\.1/)
  })

  test('a valid app version with no release note is refused', () => {
    expect(refusalOf('2026.11.10')).toMatch(/2026\.11\.10\b.*2026\.11\.9\.1/)
  })

  test('an app tag on a commit with no app release note is refused', () => {
    expect(refusalOf('2026.11.9', [release('extension', '1.1.0', '2026-11-10')])).toMatch(
      /no app release note/,
    )
  })

  test.each([
    'v2026.11.9.1',
    '2026.11.09',
    '2026.2.30',
    '1.1.0',
    'extension-2026.11.9.1',
    'extension-v1.1.0',
    'latest',
  ])('a tag that is no app version and no extension tag is refused: %s', (tag) => {
    expect(refusalOf(tag)).toMatch(/not a valid app version/)
  })
})

// The fixture root's newest app note is 2026.11.9.1, and its one extension note is 1.0.0.
describe('the release for a tag, read from the tagged commit', () => {
  test("a tag equal to the newest app release note deploys that version, with the note's markdown", () => {
    expect(releaseForTag('2026.11.9.1', fixtureContentRoot)).toEqual({
      deploy: true,
      version: '2026.11.9.1',
      body: 'The video list kept the old date range after you changed it. It now follows the controls bar.',
    })
  })

  test('an extension tag answers no deploy', () => {
    expect(releaseForTag('extension-1.0.0', fixtureContentRoot)).toEqual({ deploy: false })
  })

  test('a tag behind the newest app release note is refused, naming the newest', () => {
    expect(() => releaseForTag('2026.11.9', fixtureContentRoot)).toThrow(
      /2026\.11\.9\b.*2026\.11\.9\.1/,
    )
  })

  test('a tag that is no app version and no extension tag is refused', () => {
    expect(() => releaseForTag('v2026.11.9.1', fixtureContentRoot)).toThrow(
      /not a valid app version/,
    )
  })
})
