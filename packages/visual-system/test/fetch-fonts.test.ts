import { spawnSync } from 'node:child_process'
import { chmod, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, onTestFinished, test } from 'vitest'
import { copyFontshareFiles, fontshareFiles } from '../src/fontshare.ts'

async function scratch(): Promise<{ source: string; destination: string }> {
  const root = await mkdtemp(join(tmpdir(), 'fetch-fonts-'))
  onTestFinished(() => rm(root, { recursive: true, force: true }))
  const source = join(root, 'source')
  const destination = join(root, 'fonts')
  await mkdir(source)
  await mkdir(destination)
  return { source, destination }
}

const asFolderUrl = (folder: string) => pathToFileURL(`${folder}/`)

test('the three Fontshare files are copied together', async () => {
  const { source, destination } = await scratch()
  for (const file of fontshareFiles) await writeFile(join(source, file), file)

  copyFontshareFiles(source, asFolderUrl(destination))

  expect((await readdir(destination)).sort()).toEqual([...fontshareFiles].sort())
  expect(await readFile(join(destination, 'LICENSE-ITF-FFL.txt'), 'utf8')).toBe(
    'LICENSE-ITF-FFL.txt',
  )
})

test('a source without the licence copies no font, and the error names the file and its folder', async () => {
  const { source, destination } = await scratch()
  await writeFile(join(source, 'CabinetGrotesk-Variable.woff2'), 'a')
  await writeFile(join(source, 'Switzer-Variable.woff2'), 'b')

  let thrown: unknown
  try {
    copyFontshareFiles(source, asFolderUrl(destination))
  } catch (error) {
    thrown = error
  }

  expect((thrown as Error).message).toBe(
    `${source} does not hold LICENSE-ITF-FFL.txt, which nick-vogel/stillstats-fonts holds at its root`,
  )
  expect(((thrown as Error).cause as NodeJS.ErrnoException).code).toBe('ENOENT')
  expect(await readdir(destination)).toEqual([])
})

test('a copy that fails for another reason surfaces its own error, not a missing file', async () => {
  const { source, destination } = await scratch()
  for (const file of fontshareFiles) await writeFile(join(source, file), file)
  await chmod(destination, 0o555)
  onTestFinished(() => chmod(destination, 0o755))

  expect(() => copyFontshareFiles(source, asFolderUrl(destination))).toThrow(
    expect.objectContaining({ code: 'EACCES' }),
  )
})

test.each([
  ['an argument after the folder', ['--from', 'somewhere', 'extra']],
  ['an unknown flag', ['--unknown']],
  ['--from with no folder', ['--from']],
])('the script refuses %s', (_name, args) => {
  const result = spawnSync(
    process.execPath,
    [new URL('../src/fetch-fonts-cli.ts', import.meta.url).pathname, ...args],
    { encoding: 'utf8' },
  )

  expect(result.status).not.toBe(0)
  expect(result.stderr).toContain(
    'Run it with no arguments, or with --from <a checkout of the fonts repository>',
  )
})
