// Rerun after any change to a diagram's SVG: `node docs/audit-application/build-diagrams.ts`.

// Renders each `*-diagram.svg` in this folder to a PNG beside it with the same base name, the two
// diagrams uploaded in Section 6 of the audit application (docs/audit-application.md,
// creator-analytics#973). Before it renders, it fails on a `data-code` path that does not exist in
// the repository, so a box or arrow cannot cite code that has moved, and on an em-dash. The PNG is a
// screenshot by the system Chrome the browser walk uses, at CHROME_PATH or in /Applications, at
// device scale 2, so the diagrams add no dependency.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const repository = fileURLToPath(new URL('../..', import.meta.url))
const chrome =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const scale = 2

function attributeOf(tag: string, name: string): string | undefined {
  return new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1]
}

/** Every problem in one diagram's source, so a run names them all at once. */
function problemsOf(name: string, svg: string): string[] {
  const problems: string[] = []
  if (svg.includes('\u2014')) problems.push(`${name} holds an em-dash`)
  for (const [tag] of svg.matchAll(/<g\b[^>]*>/g)) {
    const code = attributeOf(tag, 'data-code')
    if (code === undefined) continue
    const id = attributeOf(tag, 'id') ?? tag
    const paths = code.split(/\s+/).filter(Boolean)
    if (paths.length === 0) problems.push(`${name}: ${id} has an empty data-code`)
    for (const path of paths) {
      if (!existsSync(join(repository, path))) {
        problems.push(`${name}: ${id} cites ${path}, which does not exist`)
      }
    }
  }
  return problems
}

function sizeOf(name: string, svg: string): { width: number; height: number } {
  const root = /<svg\b[^>]*>/.exec(svg)?.[0] ?? ''
  const width = Number(attributeOf(root, 'width'))
  const height = Number(attributeOf(root, 'height'))
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    throw new Error(`${name} has no whole-pixel width and height on its root element`)
  }
  return { width, height }
}

async function screenshot(source: string, output: string, size: { width: number; height: number }) {
  const directory = await mkdtemp(join(tmpdir(), 'audit-diagram-'))
  try {
    const code = await new Promise<number | null>((resolve, reject) => {
      const child = spawn(
        chrome,
        [
          '--headless',
          '--disable-gpu',
          '--hide-scrollbars',
          `--force-device-scale-factor=${scale}`,
          `--user-data-dir=${join(directory, 'profile')}`,
          `--window-size=${size.width},${size.height}`,
          `--screenshot=${output}`,
          `file://${source}`,
        ],
        { stdio: 'inherit' },
      )
      child.on('error', reject)
      child.on('exit', resolve)
    })
    if (code !== 0) throw new Error(`Chrome exited with ${code} while rendering ${output}`)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

const names = (await readdir(here)).filter((name) => name.endsWith('-diagram.svg')).sort()
if (names.length === 0) throw new Error(`No *-diagram.svg in ${here}`)
const sources = await Promise.all(
  names.map(async (name) => ({ name, svg: await readFile(join(here, name), 'utf8') })),
)
const problems = sources.flatMap(({ name, svg }) => problemsOf(name, svg))
if (problems.length > 0)
  throw new Error(`Fix each diagram before it renders:\n${problems.join('\n')}`)

for (const { name, svg } of sources) {
  const output = join(here, name.replace(/\.svg$/, '.png'))
  await screenshot(join(here, name), output, sizeOf(name, svg))
  console.log(`Wrote ${output}`)
}
