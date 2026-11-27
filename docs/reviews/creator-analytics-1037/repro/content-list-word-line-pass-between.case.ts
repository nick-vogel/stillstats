// Pre-PR review 3, finding 1. Not a test file on its own: it uses `viewsWordLine`, `showListFor`,
// `fromCacheIn`, `answerForRows` and `eventsAsked` from
// `apps/extension/src/surfaces/content-list.test.ts`. Paste it at the end of that file, then run
// from the repo root:
//   pnpm exec vitest run apps/extension/src/surfaces/content-list.test.ts -t 'repro:'
// Red at HEAD 8aff9d8d for "a pass between: true" (ms 0), green for "false" (ms 1460). Green for
// both once a kept answer that still waits on the "Views" line keeps the redraw's start.
describe('repro: the Content list word line drawn after a cold read', () => {
  for (const between of [false, true])
    test(`repro: the "Views" line Studio draws after a cold 1,200 ms read, with a pass between: ${between}, is timed from the pass that found the list, as a cold read`, async () => {
      const line = viewsWordLine() as Element
      const parent = line.parentElement as Element
      const next = line.nextSibling
      line.remove()
      let reads = 0
      await showListFor(passEveryMs + 1_210, async (ids) => {
        reads += 1
        if (reads === 1) await new Promise((resolve) => setTimeout(resolve, 1_200))
        return fromCacheIn(answerForRows(ids), reads > 1)
      })
      if (between) {
        document.body.append(document.createElement('div'))
        await vi.advanceTimersByTimeAsync(2 * passEveryMs)
      }
      parent.insertBefore(line, next)
      await vi.advanceTimersByTimeAsync(giveUpAfterMs)

      expect(eventsAsked()).toEqual([
        {
          name: 'extension_surface_shown',
          surface: 'content_list',
          ms: expect.toSatisfy((ms: number) => ms >= 1_200),
          fromCache: false,
        },
      ])
    })
})
