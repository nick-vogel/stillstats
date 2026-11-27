import { describe, expect, test } from 'vitest'
import { reportOf, type WalkRun } from './walk-report.ts'

const clean: WalkRun = {
  sizes: { js: 412_000, jsGzip: 121_345, css: 64_000, cssGzip: 14_210 },
  steps: ['route: /app/', 'state: account menu open'],
  violations: [],
  failedSteps: [],
  unanswered: [],
  consoleErrors: [],
}

describe('the browser walk report', () => {
  test('a walk with no violation passes and prints the JS and CSS gzip sizes', () => {
    const { passed, text } = reportOf(clean)
    expect(passed).toBe(true)
    expect(text).toContain('JS 412.0 kB, 121.3 kB gzip')
    expect(text).toContain('CSS 64.0 kB, 14.2 kB gzip')
    expect(text).toContain('No content security policy violation in 2 steps.')
  })

  test('a violation fails the walk and names the state it came from', () => {
    const { passed, text } = reportOf({
      ...clean,
      violations: [
        {
          step: 'state: account menu open',
          source: 'listener',
          directive: 'style-src-attr',
          blockedUri: 'inline',
          sample: 'color:red',
          location: 'http://127.0.0.1:5000/app/assets/index.js:1:200',
        },
      ],
    })
    expect(passed).toBe(false)
    expect(text).toContain(
      'state: account menu open: style-src-attr blocked inline "color:red" at http://127.0.0.1:5000/app/assets/index.js:1:200 (listener)',
    )
    expect(text).toContain('1 content security policy violation.')
  })

  test('each violation sits under the route it came from', () => {
    const { text } = reportOf({
      ...clean,
      violations: [
        {
          step: 'route: /app/profile',
          source: 'log',
          directive: 'style-src-elem',
          blockedUri: 'inline',
          sample: '',
          location: '',
        },
        {
          step: 'route: /app/',
          source: 'listener',
          directive: 'img-src',
          blockedUri: 'https://example.com/a.png',
          sample: '',
          location: '',
        },
      ],
    })
    expect(text).toContain('route: /app/profile: style-src-elem blocked inline (log)')
    expect(text).toContain('route: /app/: img-src blocked https://example.com/a.png (listener)')
    expect(text).toContain('2 content security policy violations.')
  })

  test('the walk fails on nothing about size', () => {
    const { passed } = reportOf({
      ...clean,
      sizes: { js: 90_000_000, jsGzip: 40_000_000, css: 9_000_000, cssGzip: 3_000_000 },
    })
    expect(passed).toBe(true)
  })

  test('a request the stub left unanswered fails the walk and is named', () => {
    const { passed, text } = reportOf({ ...clean, unanswered: ['GET /api/channels/c/audience'] })
    expect(passed).toBe(false)
    expect(text).toContain('The stub had no answer for: GET /api/channels/c/audience')
  })

  test('a step that could not reach its state fails the walk and is named', () => {
    const { passed, text } = reportOf({
      ...clean,
      failedSteps: [{ step: 'state: toast shown', error: 'No toast showed' }],
    })
    expect(passed).toBe(false)
    expect(text).toContain('state: toast shown did not complete: No toast showed')
  })

  test('a console error is printed under its step and does not fail the walk', () => {
    const { passed, text } = reportOf({
      ...clean,
      consoleErrors: [{ step: 'route: /app/', text: 'Failed to load resource' }],
    })
    expect(passed).toBe(true)
    expect(text).toContain('route: /app/: Failed to load resource')
  })
})
