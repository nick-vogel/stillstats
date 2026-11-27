import { globSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { expect, onTestFinished, test } from 'vitest'

// Test files run in parallel against one database, each test in a transaction that rolls back.
// Two files that seed the same user id wait on each other's uncommitted row, and two such ids
// seeded in opposite orders deadlock. So each file seeds user ids no other file uses.

const root = join(import.meta.dirname, '../../..')
const self = relative(root, import.meta.filename)

// A user id literal (`user-a`, `retention-user-b`), or any literal seeded directly. The HTTP header
// `user-agent` has a user id's shape and is no user id.
const userIdLiteral = /'((?:[a-z0-9]+-)*user-(?!agent')[a-z0-9]+)'/g
const seededLiteral = /seed(?:User|Channel|SignIn)\([^)]*?'([^']+)'\)/g

function seededIds(source: string): Set<string> {
  const ids = new Set<string>()
  for (const pattern of [userIdLiteral, seededLiteral]) {
    for (const [, id] of source.matchAll(pattern)) if (id) ids.add(id)
  }
  return ids
}

/** Reads each file, relative to `cwd`, and returns the ids it seeds by file. */
function seededIdsByFile(cwd: string, files: string[]): Map<string, Set<string>> {
  const idsByFile = new Map<string, Set<string>>()
  for (const file of files) {
    let source: string
    try {
      source = readFileSync(join(cwd, file), 'utf8')
    } catch (error) {
      // The youtube-gateway boundary test writes `boundary-probe-<uuid>.ts` into a package's src
      // directory and removes it when its test ends. Test files run in parallel, so a file the glob
      // listed can be gone by the time it is read. A gone file seeds nothing; any other error fails.
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue
      throw error
    }
    idsByFile.set(file, seededIds(source))
  }
  return idsByFile
}

test('no two test files seed the same user id', () => {
  const files = globSync('{apps,packages}/*/{src,test}/**/*.ts', { cwd: root }).filter(
    (file) => file !== self && !file.includes('node_modules'),
  )
  const filesById = new Map<string, string[]>()
  for (const [file, ids] of seededIdsByFile(root, files)) {
    for (const id of ids) filesById.set(id, [...(filesById.get(id) ?? []), file])
  }

  const shared = [...filesById].filter(([, inFiles]) => inFiles.length > 1)
  expect(Object.fromEntries(shared)).toEqual({})
})

test('a file gone between the glob and the read is skipped', () => {
  const dir = mkdtempSync(join(tmpdir(), 'seed-ids-'))
  onTestFinished(() => rmSync(dir, { recursive: true, force: true }))
  writeFileSync(join(dir, 'present.test.ts'), "seedUser(db, 'gone-probe-user-a')\n")

  const idsByFile = seededIdsByFile(dir, ['present.test.ts', 'gone.test.ts'])

  expect(Object.fromEntries([...idsByFile].map(([file, ids]) => [file, [...ids]]))).toEqual({
    'present.test.ts': ['gone-probe-user-a'],
  })
})
