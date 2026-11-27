import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmod, copyFile, mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fontshareFiles } from '../../../../packages/visual-system/src/fontshare.ts'

async function isolatedCli(): Promise<{ root: string; cli: string; fontsDir: string }> {
  const root = await mkdtemp(join(tmpdir(), 'review-2-fetch-fonts-'))
  const srcDir = join(root, 'src')
  const fontsDir = join(root, 'fonts')
  await mkdir(srcDir)
  await mkdir(fontsDir)
  await copyFile(
    new URL('../../../../packages/visual-system/src/fetch-fonts-cli.ts', import.meta.url),
    join(srcDir, 'fetch-fonts-cli.ts'),
  )
  await copyFile(
    new URL('../../../../packages/visual-system/src/fontshare.ts', import.meta.url),
    join(srcDir, 'fontshare.ts'),
  )
  return { root, cli: join(srcDir, 'fetch-fonts-cli.ts'), fontsDir }
}

test('Finding 2a: a source missing LICENSE-ITF-FFL.txt copies no Fontshare font into fonts/', async () => {
  const { root, cli, fontsDir } = await isolatedCli()
  try {
    const partial = join(root, 'partial')
    await mkdir(partial)
    await writeFile(join(partial, 'CabinetGrotesk-Variable.woff2'), 'font-a')
    await writeFile(join(partial, 'Switzer-Variable.woff2'), 'font-b')

    const result = spawnSync(process.execPath, [cli, '--from', partial], { encoding: 'utf8' })
    assert.notEqual(result.status, 0)
    assert.deepEqual(await readdir(fontsDir), [])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('Finding 2b: a non-ENOENT copy failure (EACCES) does not claim the file is absent from the repository', async () => {
  const { root, cli, fontsDir } = await isolatedCli()
  try {
    const complete = join(root, 'complete')
    await mkdir(complete)
    for (const file of fontshareFiles) await writeFile(join(complete, file), 'content')
    await chmod(fontsDir, 0o555)

    const result = spawnSync(process.execPath, [cli, '--from', complete], { encoding: 'utf8' })
    assert.notEqual(result.status, 0)
    assert.doesNotMatch(result.stderr, /is not at the root of nick-vogel\/stillstats-fonts/)
  } finally {
    await chmod(fontsDir, 0o755)
    await rm(root, { recursive: true, force: true })
  }
})

test('Finding 2c: extra positional arguments after --from <folder> are refused', async () => {
  const { root, cli } = await isolatedCli()
  try {
    const complete = join(root, 'complete')
    await mkdir(complete)
    for (const file of fontshareFiles) await writeFile(join(complete, file), 'content')

    const result = spawnSync(process.execPath, [cli, '--from', complete, 'unexpected-extra'], {
      encoding: 'utf8',
    })
    assert.notEqual(result.status, 0)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
