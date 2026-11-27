import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { describe, expect, onTestFinished, test } from 'vitest'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const biome = `${root}node_modules/.bin/biome`

/**
 * Lints source written into a package's src directory, and says whether the gateway boundary
 * refused it. Any other lint failure throws, so it cannot pass for the boundary.
 */
async function boundaryRefuses(directory: string, source: string): Promise<boolean> {
  const file = `${root}${directory}/boundary-probe-${randomUUID()}.ts`
  await writeFile(file, source)
  onTestFinished(() => rm(file, { force: true }))
  try {
    await promisify(execFile)(biome, ['lint', file], { cwd: root })
    return false
  } catch (error) {
    const { stdout, stderr } = error as { stdout: string; stderr: string }
    if (`${stdout}${stderr}`.includes('Only the YouTube gateway calls')) return true
    throw error
  }
}

const callers = {
  'an import of @googleapis/*': `import { youtube } from '@googleapis/youtube'\nexport const client = youtube\n`,
  'a YouTube API host': `export const host = 'https://youtubeanalytics.googleapis.com/v2/reports'\n`,
  'a YouTube host in a template':
    // biome-ignore lint/suspicious/noTemplateCurlyInString: the probe is source text that holds a template.
    'export const host = (id: string) => `https://youtube.googleapis.com/youtube/v3/channels?id=${id}`\n',
}

describe('the YouTube gateway boundary', () => {
  test.each(Object.entries(callers))(
    'lint fails %s outside the gateway, and passes it inside',
    async (_, source) => {
      expect(await boundaryRefuses('packages/accounts/src', source)).toBe(true)
      expect(await boundaryRefuses('apps/api/src', source)).toBe(true)
      expect(await boundaryRefuses('packages/youtube-gateway/src', source)).toBe(false)
    },
  )

  test('lint passes an OAuth scope URL outside the gateway', async () => {
    const scope = `export const scope = 'https://www.googleapis.com/auth/youtube.readonly'\n`

    expect(await boundaryRefuses('packages/accounts/src', scope)).toBe(false)
  })
})
