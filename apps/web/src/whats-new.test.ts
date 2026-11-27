// Limits: these tests cover a highlight's links as pure values. No test here renders the screen;
// app.test.ts renders it over the fake API with the web app's fixture highlights, and the browser
// walk visits it in Chrome.
import { describe, expect, test } from 'vitest'
import { addressOf, routeOf } from './route.ts'
import {
  type BuiltHighlight,
  bannerReleaseOf,
  markerAfterOpen,
  releaseLinkTextOf,
  screenRouteOf,
} from './whats-new.ts'

describe("a highlight's screen link (creator-analytics#577)", () => {
  test('opens the screen its path under /app names, on the channel on view', () => {
    const onView = routeOf('whats-new', '?channel=c-2&window=last90&page=3')

    expect(addressOf(screenRouteOf('/app/audience', onView))).toBe('audience?channel=c-2')
  })

  test('with no channel in the address, opens the screen on the first channel', () => {
    expect(addressOf(screenRouteOf('/app/audience', routeOf('whats-new', '')))).toBe('audience')
  })

  test.each([
    ['/app', ''],
    ['/app/', ''],
    ['/app/videos/abc', 'videos/abc'],
    ['/app/?window=last90', '?window=last90'],
  ])('reads %o as the web app reads that address', (screen, address) => {
    expect(addressOf(screenRouteOf(screen, routeOf('whats-new', '')))).toBe(address)
  })
})

describe("a highlight's release link (creator-analytics#577)", () => {
  test('names the release as its page does', () => {
    expect(releaseLinkTextOf('2026.11.9')).toBe('Stillstats 2026.11.9')
  })
})

function highlightOf(release: string, releaseDate: string): BuiltHighlight {
  return {
    name: `highlight-${release}`,
    title: 'A highlight',
    html: '<p>A highlight.</p>',
    release,
    releaseDate,
    releasePath: `/releases/${release}`,
  }
}

// Newest release first, as the build hands them over.
const highlights = [highlightOf('2026.11.9', '2026-11-09'), highlightOf('2026.11.2', '2026-11-02')]
const createdBefore = '2026-11-01T08:00:00.000Z'

describe('the "What\'s new" banner (creator-analytics#580)', () => {
  test('shows the newest highlighted release when it is newer than the marker and the account', () => {
    expect(bannerReleaseOf(highlights, undefined, createdBefore)).toBe('2026.11.9')
    expect(bannerReleaseOf(highlights, '2026.11.2', createdBefore)).toBe('2026.11.9')
  })

  test.each([
    ['equal to', '2026.11.9'],
    ['newer than', '2026.11.9.1'],
    ['a release newer than', '2026.12.1'],
  ])('shows nothing with a marker %s the newest highlighted release', (_, marker) => {
    expect(bannerReleaseOf(highlights, marker, createdBefore)).toBeNull()
  })

  test('shows nothing when the build holds no highlight', () => {
    expect(bannerReleaseOf([], undefined, createdBefore)).toBeNull()
  })

  test.each([
    ['on the release day', '2026-11-09T00:00:00.000Z'],
    ['late on the release day, in UTC', '2026-11-09T23:59:59.000Z'],
    ['after the release day', '2026-11-10T12:00:00.000Z'],
  ])('shows nothing to an account created %s', (_, createdAt) => {
    expect(bannerReleaseOf(highlights, undefined, createdAt)).toBeNull()
  })

  test('shows an account created the day before the release', () => {
    expect(bannerReleaseOf(highlights, undefined, '2026-11-08T23:59:59.000Z')).toBe('2026.11.9')
  })

  test("reads a day's second release as newer than its first", () => {
    const sameDay = [highlightOf('2026.11.9.1', '2026-11-09'), ...highlights]

    expect(bannerReleaseOf(sameDay, '2026.11.9', createdBefore)).toBe('2026.11.9.1')
  })
})

describe('the "What\'s new" marker after an open (creator-analytics#580)', () => {
  test('moves to the newest highlighted release when unset or older', () => {
    expect(markerAfterOpen(highlights, undefined)).toBe('2026.11.9')
    expect(markerAfterOpen(highlights, '2026.11.2')).toBe('2026.11.9')
  })

  test('stays when it is the newest highlighted release or newer, so it never goes back', () => {
    expect(markerAfterOpen(highlights, '2026.11.9')).toBeUndefined()
    expect(markerAfterOpen(highlights, '2026.12.1')).toBeUndefined()
  })

  test('stays with no highlight in the build', () => {
    expect(markerAfterOpen([], undefined)).toBeUndefined()
  })
})
