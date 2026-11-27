import { describe, expect, test } from 'vitest'
import { grayscaleToggleEvent, modeSwitchEvent } from '../src/events.ts'

describe('the mode switch event', () => {
  test('a switch from landscape to Shorts reports where it came from and where it went', () => {
    expect(modeSwitchEvent('landscape', 'shorts')).toEqual({
      name: 'thumbnail_mode_switch',
      properties: { from: 'landscape', to: 'shorts' },
    })
  })

  test('a switch from Shorts to landscape reports the reverse', () => {
    expect(modeSwitchEvent('shorts', 'landscape')).toEqual({
      name: 'thumbnail_mode_switch',
      properties: { from: 'shorts', to: 'landscape' },
    })
  })

  test('a press on the mode already in force switches nothing, so it reports nothing', () => {
    expect(modeSwitchEvent('landscape', 'landscape')).toBeNull()
    expect(modeSwitchEvent('shorts', 'shorts')).toBeNull()
  })
})

describe('the grayscale toggle event', () => {
  test('a switch from colour to grayscale reports grayscale on', () => {
    expect(grayscaleToggleEvent('color', 'grayscale')).toEqual({
      name: 'thumbnail_grayscale_toggle',
      properties: { on: true },
    })
  })

  test('a switch from grayscale to colour reports grayscale off', () => {
    expect(grayscaleToggleEvent('grayscale', 'color')).toEqual({
      name: 'thumbnail_grayscale_toggle',
      properties: { on: false },
    })
  })

  test('a press on the preview already in force toggles nothing, so it reports nothing', () => {
    expect(grayscaleToggleEvent('color', 'color')).toBeNull()
    expect(grayscaleToggleEvent('grayscale', 'grayscale')).toBeNull()
  })
})
