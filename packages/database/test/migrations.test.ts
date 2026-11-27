import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api'
import { describe, expect, test } from 'vitest'
import * as schema from '../src/schema.ts'

// The migrations folder as drizzle-kit writes it and drizzle's migrator reads it. Two branches that
// each generate a migration number the same file, and a merge of both keeps a journal and snapshot
// chain that git accepts and drizzle does not: the migrator runs migrations in journal order and
// skips one older than the last applied, and drizzle-kit refuses two snapshots on one parent
// (creator-analytics#238, after #356, #357 and #338 each took 0016 or 0017).

const folder = join(import.meta.dirname, '../drizzle')
const meta = join(folder, 'meta')

type JournalEntry = { idx: number; when: number; tag: string }
type Snapshot = { id: string; prevId: string }

const journal = (
  JSON.parse(readFileSync(join(meta, '_journal.json'), 'utf8')) as { entries: JournalEntry[] }
).entries
const numberOf = (idx: number) => String(idx).padStart(4, '0')
const snapshotIn = (name: string) => JSON.parse(readFileSync(join(meta, name), 'utf8')) as Snapshot
const filesIn = (directory: string, suffix: string) =>
  readdirSync(directory)
    .filter((name) => name.endsWith(suffix))
    .sort()

describe('the migrations folder', () => {
  test('numbers each journal entry by its place, once, with a later time than the one before', () => {
    expect(journal.map(({ idx }) => idx)).toEqual(journal.map((_, place) => place))
    expect(journal.filter(({ tag, idx }) => !tag.startsWith(`${numberOf(idx)}_`))).toEqual([])
    expect(new Set(journal.map(({ tag }) => tag.slice(0, 4))).size).toBe(journal.length)
    const times = journal.map(({ when }) => when)
    expect(times).toEqual([...new Set(times)].sort((a, b) => a - b))
  })

  test('holds one SQL file for each journal entry and no other', () => {
    expect(filesIn(folder, '.sql')).toEqual(journal.map(({ tag }) => `${tag}.sql`).sort())
  })

  test('chains one snapshot for each journal entry, each on the one before', () => {
    expect(filesIn(meta, '_snapshot.json')).toEqual(
      journal.map(({ idx }) => `${numberOf(idx)}_snapshot.json`),
    )
    const snapshots = journal.map(({ idx }) => snapshotIn(`${numberOf(idx)}_snapshot.json`))
    expect(snapshots.map(({ prevId }) => prevId)).toEqual([
      '00000000-0000-0000-0000-000000000000',
      ...snapshots.slice(0, -1).map(({ id }) => id),
    ])
    expect(new Set(snapshots.map(({ id }) => id)).size).toBe(snapshots.length)
  })

  test('leaves no change in the schema for drizzle-kit generate to write', async () => {
    const last = snapshotIn(filesIn(meta, '_snapshot.json').at(-1) ?? '')
    expect(
      await generateMigration(
        last as Parameters<typeof generateMigration>[0],
        generateDrizzleJson(schema),
      ),
    ).toEqual([])
  })
})
