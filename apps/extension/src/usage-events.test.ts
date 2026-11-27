import type { ExtensionEvent } from '@creator-analytics/api-types'
import { describe, expect, test } from 'vitest'
import { usageEventSettled, usageEventsAllowed } from './usage-events.ts'

test('Firefox that declined usage data sends no usage event', () => {
  expect(usageEventsAllowed({ browser: 'firefox', dataCollection: ['authenticationInfo'] })).toBe(
    false,
  )
})

test('Firefox that granted usage data sends usage events', () => {
  expect(
    usageEventsAllowed({
      browser: 'firefox',
      dataCollection: ['authenticationInfo', 'technicalAndInteraction'],
    }),
  ).toBe(true)
})

test('Firefox that reports no data collection at all sends no usage event', () => {
  expect(usageEventsAllowed({ browser: 'firefox', dataCollection: undefined })).toBe(false)
})

test('Chrome, which asks no data consent, sends usage events', () => {
  expect(usageEventsAllowed({ browser: 'chrome', dataCollection: undefined })).toBe(true)
})

describe('settling a usage event', () => {
  /** A `sendEvent` that records each event it is handed and reports it accepted. */
  function recordingSendEvent() {
    const sent: ExtensionEvent[] = []
    const sendEvent = async (event: ExtensionEvent) => {
      sent.push(event)
      return true
    }
    return { sent, sendEvent }
  }

  test('in Chrome, the popup\'s "Open Stillstats" event is handed to the product API', async () => {
    const { sent, sendEvent } = recordingSendEvent()

    const settled = await usageEventSettled({
      event: { name: 'extension_popup_web_app_opened' },
      browser: 'chrome',
      dataCollection: undefined,
      sendEvent,
    })

    expect(settled).toBe(true)
    expect(sent).toEqual([{ name: 'extension_popup_web_app_opened' }])
  })

  test('in Firefox that declined usage data, the event is settled and not sent', async () => {
    const { sent, sendEvent } = recordingSendEvent()

    const settled = await usageEventSettled({
      event: { name: 'extension_popup_web_app_opened' },
      browser: 'firefox',
      dataCollection: ['authenticationInfo'],
      sendEvent,
    })

    expect(settled).toBe(true)
    expect(sent).toEqual([])
  })
})
