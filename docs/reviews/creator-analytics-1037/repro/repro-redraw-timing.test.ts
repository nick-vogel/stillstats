// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://studio.youtube.com/channel/UC1/dashboard"}
// Repro for creator-analytics#1037 pre-PR review 1, finding 1. Copy into
// apps/extension/src/surfaces/ and run from the repo root:
//   pnpm exec vitest run apps/extension/src/surfaces/repro-redraw-timing.test.ts
// Red on 7aea7d5f; green once a figure drawn after a redraw in the same navigation is timed from
// the pass that first found its element, with the cache result of the read the creator waited on.
// Amended 2026-11-24: the mock answers the `Redrawn` answer of the amended fix, not a bare
// 'not-found', which the fix leaves untimed.
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import {
  type PlaceAnswer,
  passEveryMs,
  type Surface,
  shownFrom,
  watchPage,
} from './page-watcher.ts'

let stop = () => {}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  stop()
  vi.useRealTimers()
})

test('a card Studio redraws while its cold read is out is timed from the pass that found it, as a cold read', async () => {
  let calls = 0
  const card: Surface = {
    name: 'card',
    isOn: () => true,
    found: () => true,
    place: async () => {
      calls += 1
      if (calls === 1) {
        await new Promise((resolve) => setTimeout(resolve, 1_200))
        document.body.append(document.createElement('div'))
        // The redrawn answer of the amended fix, as a literal: `redrawnFrom` does not exist before it.
        return {
          placement: 'redrawn',
          fromCache: false,
          counts: 'not-found',
        } as unknown as PlaceAnswer
      }
      return shownFrom(true)
    },
  }
  const report = vi.fn()
  const watcher = watchPage({
    document,
    url: () => 'https://studio.youtube.com/channel/UC1/dashboard',
    surfaces: [card],
    report,
  })
  stop = watcher.stop

  await vi.advanceTimersByTimeAsync(passEveryMs + 1_200 + 3 * passEveryMs)

  const shown = report.mock.calls.map(([event]) => event)
  expect(shown).toHaveLength(1)
  expect(shown[0]).toEqual({
    name: 'extension_surface_shown',
    surface: 'card',
    ms: expect.toSatisfy((ms: number) => ms >= 1_200),
    fromCache: false,
  })
})
