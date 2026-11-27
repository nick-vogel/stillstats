// @vitest-environment happy-dom
// Repro: RetentionComparison UI defects found in pre-PR review 5. Each test asserts the expected
// behaviour, so all four are red at 27cff35c and turn green once Findings 1 to 3 are fixed.
//
// Limits: happy-dom renders the real React components against the fake API and mocked fetch, so it
// cannot check real CSS layout or browser navigation outside happy-dom's History API.
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { App } from '../../../../apps/web/src/App.tsx'
import { fakeVideo, installFakeApi } from '../../../../apps/web/src/fake-api.ts'
import { PreferencesContext } from '../../../../apps/web/src/preferences.ts'
import { notProcessedText } from '../../../../apps/web/src/processing.ts'
import { RetentionComparison } from '../../../../apps/web/src/RetentionComparison.tsx'
import { routeOf } from '../../../../apps/web/src/route.ts'
import { emptyListTextOf } from '../../../../apps/web/src/video-list.ts'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

async function flush(): Promise<void> {
  for (let i = 0; i < 6; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }
}

let cleanup: (() => void) | null = null

afterEach(() => {
  cleanup?.()
  cleanup = null
  vi.restoreAllMocks()
})

async function renderAppAt(path: string): Promise<HTMLElement> {
  window.history.replaceState(null, '', path)
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  cleanup = () => {
    act(() => root.unmount())
    container.remove()
  }
  await act(async () => {
    root.render(createElement(App))
  })
  await flush()
  return container
}

describe('pre-PR review 5 repro: RetentionComparison', () => {
  test('Finding 1: a video awaiting processing shows Not processed yet instead of Average viewed 0%', async () => {
    const api = installFakeApi()
    api.videos = [
      {
        ...fakeVideo,
        id: 'fresh-upload',
        title: 'Brand new upload',
        engagedViews: 0,
        views: 0,
        averageViewPercentage: 0,
        subscribersGained: 0,
        estimatedMinutesWatched: 0,
        awaitingProcessing: true,
      },
    ]

    const container = await renderAppAt('/retention?window=lifetime')
    const rowText = container.querySelector('.comparison-videos li')?.textContent ?? ''

    expect(rowText).toContain(notProcessedText)
    expect(rowText).not.toContain('Average viewed 0%')
  })

  test('Finding 2a: an empty format filter shows the empty-list message instead of an empty list', async () => {
    const api = installFakeApi()
    api.videos = []

    const container = await renderAppAt('/retention?window=lifetime&format=live')
    const pickerText = container.querySelector('.comparison-picker')?.textContent ?? ''

    expect(container.querySelector('.comparison-videos')).toBeNull()
    expect(pickerText).toContain(emptyListTextOf('live', 'public'))
  })

  test('Finding 2b: a page past the last page clamps to the last page instead of showing Page 5 of 2', async () => {
    const api = installFakeApi()
    api.videos = []
    api.pageCount = 2

    const container = await renderAppAt('/retention?window=lifetime&page=5&pageSize=10')

    expect(window.location.search).toContain('page=2')
    expect(container.querySelector('.video-list-pager-place')?.textContent).not.toBe('Page 5 of 2')
  })

  test('Finding 3: changing channelId clears the previous channel curves and picker list while the new channel loads', async () => {
    const ch1Curves = {
      curves: [
        {
          video: {
            id: 'a1',
            title: 'Channel A Secret Video',
            durationSeconds: 120,
            publishedAt: '2026-10-01T00:00:00Z',
          },
          readAt: '2026-11-18T12:00:00.000Z',
          points: [
            { elapsedVideoTimeRatio: 0.01, audienceWatchRatio: 1 },
            { elapsedVideoTimeRatio: 1, audienceWatchRatio: 0.5 },
          ],
        },
      ],
      unread: 0,
    }
    const ch1List = {
      videos: [{ ...fakeVideo, id: 'a1', title: 'Channel A Secret Video' }],
      window: 'lifetime',
      page: 1,
      pageSize: 25,
      pageCount: 1,
      lastProcessedDay: '2026-11-18',
      creationDay: '2020-01-01',
      fetchedAt: '2026-11-18T12:00:00.000Z',
      fromCache: false,
    }
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input)
      if (url.includes('/channels/ch-1/retention-curves')) {
        return Promise.resolve(
          new Response(JSON.stringify(ch1Curves), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        )
      }
      if (url.includes('/channels/ch-1/videos')) {
        return Promise.resolve(
          new Response(JSON.stringify(ch1List), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        )
      }
      return new Promise(() => {})
    })

    const prefs = {
      saved: {},
      save: () => {},
      settled: () => Promise.resolve(),
    }
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    cleanup = () => {
      act(() => root.unmount())
      container.remove()
    }
    const navigate = vi.fn()

    await act(async () => {
      root.render(
        createElement(
          PreferencesContext.Provider,
          { value: prefs },
          createElement(RetentionComparison, {
            channelId: 'ch-1',
            route: routeOf('retention', '?channel=ch-1&window=lifetime&curves=a1'),
            navigate,
          }),
        ),
      )
    })
    await flush()
    expect(container.textContent).toContain('Channel A Secret Video')

    await act(async () => {
      root.render(
        createElement(
          PreferencesContext.Provider,
          { value: prefs },
          createElement(RetentionComparison, {
            channelId: 'ch-2',
            route: routeOf('retention', '?channel=ch-2&window=lifetime'),
            navigate,
          }),
        ),
      )
    })
    await flush()

    expect(container.textContent).not.toContain('Channel A Secret Video')
  })
})
