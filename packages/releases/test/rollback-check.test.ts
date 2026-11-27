import { describe, expect, test } from 'vitest'
import { checkRollback, type Release, rollbackFor } from '../src/index.ts'
import { fixtureContentRoot } from './testing.ts'

function release(
  product: Release['product'],
  version: string,
  date: string,
  removes = false,
): Release {
  return {
    product,
    version,
    date,
    summary: 'A fix.',
    removes,
    highlights: [],
    html: '',
    body: '',
    path: `/releases/${version}`,
  }
}

function refusalOf(target: string, releases: readonly Release[]): string {
  try {
    checkRollback(target, releases)
  } catch (error) {
    return (error as Error).message
  }
  throw new Error(`checkRollback passed ${target}`)
}

describe('the rollback check', () => {
  test('a rollback past no remove release passes, answering the target', () => {
    const releases = [
      release('app', '2026.11.12', '2026-11-12'),
      release('app', '2026.11.10', '2026-11-10'),
      release('app', '2026.11.9', '2026-11-09'),
    ]

    expect(checkRollback('2026.11.9', releases)).toEqual({ version: '2026.11.9' })
  })

  test('a rollback past one remove release is refused, naming it', () => {
    const releases = [
      release('app', '2026.11.12', '2026-11-12'),
      release('app', '2026.11.10', '2026-11-10', true),
      release('app', '2026.11.9', '2026-11-09'),
    ]

    expect(refusalOf('2026.11.9', releases)).toMatch(
      /2026\.11\.9 .*past 2026\.11\.10, which removes something/,
    )
  })

  test('a rollback past two remove releases is refused, naming both, oldest first', () => {
    const releases = [
      release('app', '2026.11.12.1', '2026-11-12', true),
      release('app', '2026.11.12', '2026-11-12'),
      release('app', '2026.11.10', '2026-11-10', true),
      release('app', '2026.11.9', '2026-11-09'),
    ]

    expect(refusalOf('2026.11.9', releases)).toMatch(
      /past 2026\.11\.10 and 2026\.11\.12\.1, which remove something/,
    )
  })

  test('a rollback to a remove release itself passes, since its own code expects the removal', () => {
    const releases = [
      release('app', '2026.11.12', '2026-11-12'),
      release('app', '2026.11.10', '2026-11-10', true),
      release('app', '2026.11.9', '2026-11-09'),
    ]

    expect(checkRollback('2026.11.10', releases)).toEqual({ version: '2026.11.10' })
  })

  test('a remove release older than the target does not block it', () => {
    const releases = [
      release('app', '2026.11.12', '2026-11-12'),
      release('app', '2026.11.10', '2026-11-10'),
      release('app', '2026.11.9', '2026-11-09', true),
    ]

    expect(checkRollback('2026.11.10', releases)).toEqual({ version: '2026.11.10' })
  })

  // The extension's SemVer number is chosen to compare newer than the CalVer target, so only the
  // product, not the number, keeps it out.
  test('a newer extension release that removes something does not block an app rollback', () => {
    const releases = [
      release('extension', '2026.12.0', '2026-11-12', true),
      release('app', '2026.11.10', '2026-11-10'),
      release('app', '2026.11.9', '2026-11-09'),
    ]

    expect(checkRollback('2026.11.9', releases)).toEqual({ version: '2026.11.9' })
  })

  test('a rollback to the newest app release passes, putting the same images back', () => {
    const releases = [
      release('app', '2026.11.10', '2026-11-10', true),
      release('app', '2026.11.9', '2026-11-09'),
    ]

    expect(checkRollback('2026.11.10', releases)).toEqual({ version: '2026.11.10' })
  })

  test('a rollback to a version with no release note is refused', () => {
    const releases = [
      release('app', '2026.11.10', '2026-11-10'),
      release('app', '2026.11.9', '2026-11-09'),
    ]

    expect(refusalOf('2026.11.8', releases)).toMatch(/2026\.11\.8 has no app release note/)
  })

  test('a rollback to an extension version is refused, since it names no app release', () => {
    const releases = [
      release('extension', '1.0.0', '2026-11-08'),
      release('app', '2026.11.9', '2026-11-09'),
    ]

    expect(refusalOf('1.0.0', releases)).toMatch(/not a valid app version/)
  })

  test.each(['v2026.11.9', '2026.11.09', '2026.2.30', 'latest', 'sha-abc1234', ''])(
    'a target that is no app version is refused: "%s"',
    (target) => {
      const releases = [release('app', '2026.11.9', '2026-11-09')]

      expect(refusalOf(target, releases)).toMatch(/not a valid app version/)
    },
  )
})

// The fixture root's app notes are 2026.11.9 and 2026.11.9.1, neither a remove release.
describe('the rollback, read from the release content', () => {
  test('a rollback to an older app release past no remove release passes', () => {
    expect(rollbackFor('2026.11.9', fixtureContentRoot)).toEqual({ version: '2026.11.9' })
  })

  test('a rollback to a version with no note in the content is refused', () => {
    expect(() => rollbackFor('2026.11.8', fixtureContentRoot)).toThrow(
      /2026\.11\.8 has no app release note/,
    )
  })
})
