// Pre-PR review 3, finding 3 (from the Grok trial second opinion, ported). Not a test file on its
// own: it uses `dashboard`, `contentList`, `stop`, `watchPage`, `redrawnFrom`, `shownFrom` and
// `passEveryMs` from `apps/extension/src/surfaces/page-watcher.test.ts`. Paste it inside
// `describe("a figure read by a pass ahead of WXT's report, ...")` in that file, then run from the
// repo root:
//   pnpm exec vitest run apps/extension/src/surfaces/page-watcher.test.ts -t 'repro:'
// Red at HEAD 8aff9d8d (ms 0, fromCache true), green once a redraw on a pass ahead of WXT's report
// carries that pass's start and its read's cache result to the navigation's own pass.
test("repro: a redraw during the read ahead of WXT's report is timed from that pass, with that read's cache result", async () => {
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
  watcher.navigated(contentList)
  await vi.advanceTimersByTimeAsync(passEveryMs + 50)

  expect(places).toBeGreaterThan(1)
  expect(report.mock.calls).toEqual([
    [
      {
        name: 'extension_surface_shown',
        surface: 'content_list',
        ms: 1_200 + passEveryMs,
        fromCache: false,
      },
    ],
  ])
})
