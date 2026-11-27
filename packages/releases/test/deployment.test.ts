// Limits: these tests read the committed fixture notes and notes written to a temporary folder,
// never the package's own notes/, so they hold the rules and not the version Nick commits. That the
// API and the worker read their deployment at start is held by their own spawned-process tests.
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { deploymentOf } from '../src/index.ts'
import { fixtureContentRoot } from './testing.ts'

const commit = '0123456789abcdef0123456789abcdef01234567'

/** A content root holding each note at `notes/<version>.md`. */
async function contentRootWith(notes: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'deployment-'))
  await mkdir(join(root, 'notes'))
  for (const [version, text] of Object.entries(notes)) {
    await writeFile(join(root, 'notes', `${version}.md`), text)
  }
  return root
}

function note(product: 'app' | 'extension', date: string): string {
  return `---\nproduct: ${product}\ndate: ${date}\nsummary: A fix.\nhighlights: []\nremoves: false\n---\n\nA fix.\n`
}

describe('the deployment the API and the worker report', () => {
  test.for(['production', 'staging'] as const)('runs as %s when the setting says so', (name) => {
    const env = { STILLSTATS_ENVIRONMENT: name, RELEASE_CONTENT_ROOT: fixtureContentRoot }

    expect(deploymentOf(env).environment).toBe(name)
  })

  test.for([
    ['unset', undefined],
    ['empty', ''],
    ['an unknown environment', 'preview'],
    ['the right word in the wrong case', 'Production'],
  ] as const)('refuses to start with the environment %s', ([, value]) => {
    const env = { STILLSTATS_ENVIRONMENT: value, RELEASE_CONTENT_ROOT: fixtureContentRoot }

    expect(() => deploymentOf(env)).toThrow(/STILLSTATS_ENVIRONMENT.*production.*staging/)
  })

  test("its version is the build's newest app release note", () => {
    const env = { STILLSTATS_ENVIRONMENT: 'production', RELEASE_CONTENT_ROOT: fixtureContentRoot }

    expect(deploymentOf(env).version).toBe('2026.11.9.1')
  })

  test('it has no version when the build holds no release note', async () => {
    const env = {
      STILLSTATS_ENVIRONMENT: 'production',
      RELEASE_CONTENT_ROOT: await contentRootWith({}),
    }

    expect(deploymentOf(env).version).toBeNull()
  })

  test('an extension release note is never its version, even the newest note', async () => {
    const env = {
      STILLSTATS_ENVIRONMENT: 'staging',
      RELEASE_CONTENT_ROOT: await contentRootWith({
        '2026.11.2': note('app', '2026-11-02'),
        '1.2.0': note('extension', '2026-11-09'),
      }),
    }

    expect(deploymentOf(env).version).toBe('2026.11.2')
  })

  test('its commit is the first 7 characters of the commit the image was built from', () => {
    const env = {
      STILLSTATS_ENVIRONMENT: 'staging',
      RELEASE_CONTENT_ROOT: fixtureContentRoot,
      COMMIT_SHA: commit,
    }

    expect(deploymentOf(env).commit).toBe('0123456')
  })

  test('it has no commit when the build was given none', () => {
    const env = { STILLSTATS_ENVIRONMENT: 'staging', RELEASE_CONTENT_ROOT: fixtureContentRoot }

    expect(deploymentOf(env).commit).toBeNull()
  })
})
