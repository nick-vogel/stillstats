// Pre-PR review 1, finding 1. Not a test file on its own: it uses `dashboard`, `contentList`,
// `stop`, `watchPage`, `redrawnFrom`, `shownFrom` and `passEveryMs` from
// `apps/extension/src/surfaces/page-watcher.test.ts`. Paste it inside
// `describe("a figure read by a pass ahead of WXT's report, ...")` in that file, then run from the
// repo root:
//   pnpm exec vitest run apps/extension/src/surfaces/page-watcher.test.ts -t 'repro:'
// Red at HEAD 0a24108c: leaving to the dashboard or to a page with no active surface (Playlists)
// for 60 s after an ahead redrawn answer reports ms 61450 and fromCache false (rule: ms 0,
// fromCache true); leaving after an ahead shown answer reports ms 1200 and fromCache false (rule:
// ms 50, fromCache true). Green once a pass on another URL clears `readAhead`.
describe('repro: readAhead after leaving the ahead URL without WXT reporting', () => {
  const playlists = 'https://studio.youtube.com/channel/UC1/content/playlists'

  for (const detour of ['dashboard', 'playlists'] as const) {
    test(`repro: an ahead redraw left behind for ${detour} does not time a later navigation to that URL`, async () => {
      let studioUrl = dashboard
      let places = 0
      const report = vi.fn()
      const watcher = watchPage({
        document,
        url: () => studioUrl,
        surfaces: [
          {
            name: 'content_list',
            isOn: (url) => url === contentList,
            found: () => true,
            place: async () => {
              places += 1
              if (places === 1) {
                await new Promise((resolve) => setTimeout(resolve, 1_200))
                return redrawnFrom(false, 'not-found')
              }
              return shownFrom(true)
            },
          },
        ],
        report,
      })
      // biome-ignore lint/suspicious/noGlobalAssign: `stop` is the host test file's own `let`, where this case is pasted.
      stop = watcher.stop
      await vi.advanceTimersByTimeAsync(passEveryMs)

      studioUrl = contentList
      document.body.append(document.createElement('div'))
      await vi.advanceTimersByTimeAsync(passEveryMs + 1_200)
      expect(places).toBe(1)

      studioUrl = detour === 'dashboard' ? dashboard : playlists
      document.body.append(document.createElement('div'))
      await vi.advanceTimersByTimeAsync(60_000)

      studioUrl = contentList
      watcher.navigated(contentList)
      await vi.advanceTimersByTimeAsync(passEveryMs + 50)

      expect(report.mock.calls).toEqual([
        [{ name: 'extension_surface_shown', surface: 'content_list', ms: 0, fromCache: true }],
      ])
    })
  }

  test('repro: an ahead figure left behind for the dashboard does not time a later navigation to that URL', async () => {
    let studioUrl = dashboard
    let places = 0
    const report = vi.fn()
    const watcher = watchPage({
      document,
      url: () => studioUrl,
      surfaces: [
        {
          name: 'content_list',
          isOn: (url) => url === contentList,
          found: () => true,
          place: async () => {
            places += 1
            if (places === 1) {
              await new Promise((resolve) => setTimeout(resolve, 1_200))
              return shownFrom(false)
            }
            await new Promise((resolve) => setTimeout(resolve, 50))
            return shownFrom(true)
          },
        },
      ],
      report,
    })
    // biome-ignore lint/suspicious/noGlobalAssign: `stop` is the host test file's own `let`, where this case is pasted.
    stop = watcher.stop
    await vi.advanceTimersByTimeAsync(passEveryMs)

    studioUrl = contentList
    document.body.append(document.createElement('div'))
    await vi.advanceTimersByTimeAsync(passEveryMs + 1_200)
    expect(places).toBe(1)

    studioUrl = dashboard
    document.body.append(document.createElement('div'))
    await vi.advanceTimersByTimeAsync(60_000)

    studioUrl = contentList
    watcher.navigated(contentList)
    await vi.advanceTimersByTimeAsync(passEveryMs + 100)

    expect(report.mock.calls).toEqual([
      [{ name: 'extension_surface_shown', surface: 'content_list', ms: 50, fromCache: true }],
    ])
  })
})
