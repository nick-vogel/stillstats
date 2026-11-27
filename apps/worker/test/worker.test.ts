// Limits: these tests start the worker's entry script as its own process with no database, so its
// start fails at DATABASE_URL, after the settings it reads first. They show what the process does
// before it opens the database, not a running worker: the image's smoke run in CI starts one.
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { fixtureContentRoot } from '@creator-analytics/releases/testing'
import { startFakeGlitchTip } from '@creator-analytics/reporter/testing'
import { describe, expect, onTestFinished, test } from 'vitest'

const entry = fileURLToPath(new URL('../src/worker.ts', import.meta.url))

/** Starts the worker's entry script with `env` and nothing else but PATH, and waits for its exit. */
async function startWith(env: Record<string, string>): Promise<{ code: number; stderr: string }> {
  try {
    await promisify(execFile)(process.execPath, [entry], {
      env: { PATH: process.env.PATH ?? '', ...env },
      timeout: 30_000,
    })
    return { code: 0, stderr: '' }
  } catch (error) {
    const { code, stderr } = error as { code: number; stderr: string }
    return { code, stderr }
  }
}

describe('the worker at start', () => {
  test.for([
    ['unset', {}],
    ['unknown', { STILLSTATS_ENVIRONMENT: 'preview' }],
  ] as const)('refuses to start with the environment %s, before the database', async ([, env]) => {
    const { code, stderr } = await startWith({ RELEASE_CONTENT_ROOT: fixtureContentRoot, ...env })

    expect(code).not.toBe(0)
    expect(stderr).toContain('STILLSTATS_ENVIRONMENT')
    expect(stderr).not.toContain('DATABASE_URL')
  })

  test('reports an error with its environment and its version as the release', async () => {
    const glitchTip = await startFakeGlitchTip()
    onTestFinished(() => glitchTip.close())

    const { code } = await startWith({
      STILLSTATS_ENVIRONMENT: 'staging',
      RELEASE_CONTENT_ROOT: fixtureContentRoot,
      GLITCHTIP_DSN: glitchTip.dsn,
    })

    expect(code).not.toBe(0)
    const [event] = glitchTip.events()
    expect(event?.exception?.values?.map(({ value }) => value)).toContain('DATABASE_URL is not set')
    expect({ environment: event?.environment, release: event?.release }).toEqual({
      environment: 'staging',
      release: '2026.11.9.1',
    })
  })

  test('refuses to start with a malformed trace sample rate, naming the setting, before the database', async () => {
    const { code, stderr } = await startWith({
      STILLSTATS_ENVIRONMENT: 'production',
      RELEASE_CONTENT_ROOT: fixtureContentRoot,
      GLITCHTIP_TRACES_SAMPLE_RATE: '1.5',
    })

    expect(code).not.toBe(0)
    expect(stderr).toContain('GLITCHTIP_TRACES_SAMPLE_RATE must be a number from 0 to 1')
    expect(stderr).not.toContain('DATABASE_URL')
  })

  test('with a trace sample rate of 1.0, the start goes on to the database', async () => {
    const { code, stderr } = await startWith({
      STILLSTATS_ENVIRONMENT: 'production',
      RELEASE_CONTENT_ROOT: fixtureContentRoot,
      GLITCHTIP_TRACES_SAMPLE_RATE: '1.0',
    })

    expect(code).not.toBe(0)
    expect(stderr).not.toContain('GLITCHTIP_TRACES_SAMPLE_RATE')
    expect(stderr).toContain('DATABASE_URL is not set')
  })
})
