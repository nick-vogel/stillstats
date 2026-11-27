// creator-analytics#1108, pre-PR review 3 finding 2: the mutants of the extension's redraw
// branches. Applies each one to the source at a time, runs the tests, and reports whether a test
// went red (killed) or every test stayed green (survived). It puts each file back after its run, and
// on SIGINT, SIGTERM or SIGHUP. From the repo root:
//   node docs/reviews/creator-analytics-1108/mutants.mjs . [--full] [id ...] [@file-of-ids]
// Without `--full`, a mutant runs against its source file's own test files; with it, against every
// test of `apps/extension`.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.argv[2]
const full = process.argv.includes('--full')
const only = new Set(
  process.argv
    .slice(3)
    .filter((arg) => arg !== '--full')
    .flatMap((arg) =>
      arg.startsWith('@') ? readFileSync(arg.slice(1), 'utf8').split('\n').filter(Boolean) : [arg],
    ),
)
const t = (...names) => names.map((name) => `apps/extension/src/surfaces/${name}.test.ts`)
/** The test files a mutant of each source file runs against, unless `--full`. */
const testsOf = {
  'content-list.ts': t('content-list', 'studio-surfaces'),
  'video-row.ts': t('video-row', 'card', 'analytics', 'studio-surfaces'),
  'analytics.ts': t('analytics', 'studio-surfaces'),
  'watch-page.ts': t('watch-page', 'youtube-surfaces'),
  'shorts.ts': t('shorts', 'youtube-surfaces'),
  'feed.ts': t('feed', 'youtube-surfaces'),
  'channel-page.ts': t('channel-page', 'youtube-surfaces'),
  'page-watcher.ts': ['apps/extension/src/surfaces'],
}
const s = (file) => join(root, 'apps/extension/src/surfaces', file)

/** [id, file, find, replace, nth occurrence (0-based)] */
const mutants = [
  // Content list
  [
    'CL-after-read-bare',
    'content-list.ts',
    "return read.state === 'read' ? redrawnFrom(read.answer.fromCache, 'not-found') : 'not-found'\n\n      takeDownPage()",
    "return 'not-found'\n\n      takeDownPage()",
  ],
  [
    'CL-after-read-guard',
    'content-list.ts',
    "return read.state === 'read' ? redrawnFrom(read.answer.fromCache, 'not-found') : 'not-found'\n\n      takeDownPage()",
    "return redrawnFrom(read.state === 'read' && read.answer.fromCache, 'not-found')\n\n      takeDownPage()",
  ],
  [
    'CL-after-read-heading-guard',
    'content-list.ts',
    "((!headingNow || !titleNow) && read.state !== 'read')",
    '((!headingNow || !titleNow) && false)',
  ],
  [
    'CL-after-read-heading-keep',
    'content-list.ts',
    "answered = { ...page, pageHosts: [], placement: view.kind !== 'line' ? 'shown' : 'placed' }\n",
    '',
  ],
  [
    'CL-after-read-heading-bare',
    'content-list.ts',
    "takeDownPageAndRows(list)\n        return redrawnFrom(read.state === 'read' && read.answer.fromCache, 'not-found')\n      }\n      // An answer with figures",
    "takeDownPageAndRows(list)\n        return 'not-found'\n      }\n      // An answer with figures",
  ],
  [
    'CL-word-line-after-read-bare',
    'content-list.ts',
    "takeDownPageAndRows(list)\n        return redrawnFrom(read.state === 'read' && read.answer.fromCache, 'not-found')\n      }\n      const pageHosts",
    "takeDownPageAndRows(list)\n        return 'not-found'\n      }\n      const pageHosts",
  ],
  [
    'CL-kept-word-line-bare',
    'content-list.ts',
    "? redrawnFrom(answered.read.answer.fromCache, 'not-found')\n            : 'not-found'\n        }",
    "? 'not-found'\n            : 'not-found'\n        }",
  ],
  [
    'CL-kept-word-line-here',
    'content-list.ts',
    "return answeredHere && answered.read.state === 'read'",
    "return answered.read.state === 'read'",
  ],
  [
    'CL-kept-heading-bare',
    'content-list.ts',
    "? redrawnFrom(answered.read.answer.fromCache, 'not-found')\n          : 'not-found'",
    "? 'not-found'\n          : 'not-found'",
  ],
  [
    'CL-kept-heading-here',
    'content-list.ts',
    "|| !answeredHere) return 'not-found'",
    ") return 'not-found'",
  ],
  [
    'CL-kept-heading-key',
    'content-list.ts',
    'if (answered?.key !== key || !isKept(answered)',
    'if (answered === undefined || !isKept(answered)',
  ],
  ['CL-kept-heading-ahead', 'content-list.ts', '        if (!ahead) answered.ahead = false\n', ''],
  // The card's and analytics page's video row
  [
    'VR-after-read-bare',
    'video-row.ts',
    "return read.state === 'read' ? redrawnFrom(read.answer.fromCache, 'not-found') : 'not-found'",
    "return 'not-found'",
  ],
  [
    'VR-after-read-guard',
    'video-row.ts',
    "return read.state === 'read' ? redrawnFrom(read.answer.fromCache, 'not-found') : 'not-found'",
    "return redrawnFrom(read.state === 'read' && read.answer.fromCache, 'not-found')",
  ],
  [
    'VR-after-compare-bare',
    'video-row.ts',
    "? redrawnFrom(read.answer.fromCache && (compared?.fromCache ?? true), 'not-found')",
    "? 'not-found'",
    0,
  ],
  [
    'VR-after-compare-d5',
    'video-row.ts',
    'read.answer.fromCache && (compared?.fromCache ?? true)',
    'read.answer.fromCache',
    0,
  ],
  [
    'VR-after-render-bare',
    'video-row.ts',
    "? redrawnFrom(read.answer.fromCache && (compared?.fromCache ?? true), 'not-found')",
    "? 'not-found'",
    1,
  ],
  [
    'VR-after-render-d5',
    'video-row.ts',
    'read.answer.fromCache && (compared?.fromCache ?? true)',
    'read.answer.fromCache',
    1,
  ],
  [
    'AN-no-views-row-bare',
    'analytics.ts',
    "? redrawnFrom(placement.fromCache, 'not-found')",
    "? 'not-found'",
  ],
  // Watch page
  [
    'WP-bare',
    'watch-page.ts',
    "return answered ? redrawnFrom(fromCache, 'not-found') : 'not-found'",
    "return 'not-found'",
  ],
  [
    'WP-guard',
    'watch-page.ts',
    "return answered ? redrawnFrom(fromCache, 'not-found') : 'not-found'",
    "return redrawnFrom(fromCache, 'not-found')",
  ],
  // Shorts
  [
    'SH-tiles-bare',
    'shorts.ts',
    "? redrawnFrom(fromCache, 'placed')\n      : 'placed'",
    "? 'placed'\n      : 'placed'",
  ],
  [
    'SH-tiles-guard',
    'shorts.ts',
    'return answered && tiles.length > 0 && repointed === tiles.length',
    'return tiles.length > 0 && repointed === tiles.length',
  ],
  ['SH-tiles-every', 'shorts.ts', 'repointed === tiles.length', 'repointed > 0'],
  [
    'SH-player-bare',
    'shorts.ts',
    "return answered ? redrawnFrom(fromCache, 'placed') : 'placed'",
    "return 'placed'",
  ],
  [
    'SH-player-guard',
    'shorts.ts',
    "return answered ? redrawnFrom(fromCache, 'placed') : 'placed'",
    "return redrawnFrom(fromCache, 'placed')",
  ],
  // Feed
  ['FD-bare', 'feed.ts', "? redrawnFrom(fromCache, 'placed')", "? 'placed'"],
  [
    'FD-guard',
    'feed.ts',
    'return answered && tiles.length > 0 && repointed === tiles.length',
    'return tiles.length > 0 && repointed === tiles.length',
  ],
  ['FD-every', 'feed.ts', 'repointed === tiles.length', 'repointed > 0'],
  // Channel page
  ['CP-bare', 'channel-page.ts', "? redrawnFrom(fromCache, 'placed')", "? 'placed'"],
  [
    'CP-guard',
    'channel-page.ts',
    'return answered && tiles.length > 0 && repointed === tiles.length',
    'return tiles.length > 0 && repointed === tiles.length',
  ],
  ['CP-every', 'channel-page.ts', 'repointed === tiles.length', 'repointed > 0'],
  // The watch's records
  [
    'PW-ahead-noted-wins',
    'page-watcher.ts',
    "if (noted && !('redrawn' in noted)) return",
    'if (false) return',
  ],
  [
    'PW-ahead-bare-ends',
    'page-watcher.ts',
    '      if (noted) readAhead.surfaces.delete(name)\n',
    '',
  ],
  [
    'PW-ahead-redrawn-fold',
    'page-watcher.ts',
    'if (noted) noted.fromCache &&= answer.fromCache',
    'if (noted) {}',
  ],
  [
    'PW-ahead-redrawn-notes',
    'page-watcher.ts',
    'readAhead.surfaces.set(name, { since: start, fromCache: answer.fromCache, redrawn: true })',
    '{}',
  ],
  [
    'PW-ahead-since',
    'page-watcher.ts',
    'const since = noted?.since ?? start',
    'const since = start',
  ],
  [
    'PW-ahead-from-cache',
    'page-watcher.ts',
    'const fromCache = (noted?.fromCache ?? true) && answer.fromCache',
    'const fromCache = answer.fromCache',
  ],
  ['PW-off-url-clears', 'page-watcher.ts', 'if (ahead) nav.redrawn.clear()', ''],
  [
    'PW-ahead-left-clears',
    'page-watcher.ts',
    "if (readAhead.url !== '' && here !== readAhead.url)\n      readAhead = { url: '', count: Number.NaN, surfaces: new Map() }\n",
    '',
  ],
]

function replaceNth(text, find, replace, nth) {
  let at = -1
  for (let i = 0; i <= nth; i += 1) {
    at = text.indexOf(find, at + 1)
    if (at < 0) return undefined
  }
  return text.slice(0, at) + replace + text.slice(at + find.length)
}

const results = []
/** The file under mutation and its original text, put back should the run be stopped. */
let pending
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'])
  process.on(signal, () => {
    if (pending) writeFileSync(pending.path, pending.original)
    process.exit(1)
  })
for (const [id, file, find, replace, nth] of mutants) {
  if (only.size > 0 && !only.has(id)) continue
  const path = s(file)
  const original = readFileSync(path, 'utf8')
  if (nth === undefined && original.split(find).length !== 2) {
    results.push([id, `NOT UNIQUE (${original.split(find).length - 1})`])
    continue
  }
  const mutated = replaceNth(original, find, replace, nth ?? 0)
  if (mutated === undefined) {
    results.push([id, 'NOT FOUND'])
    continue
  }
  pending = { path, original }
  writeFileSync(path, mutated)
  let verdict
  try {
    const targets = full ? ['apps/extension'] : testsOf[file]
    execFileSync('pnpm', ['exec', 'vitest', 'run', ...targets, '--bail=1'], {
      cwd: root,
      stdio: 'pipe',
    })
    verdict = 'SURVIVED'
  } catch (error) {
    const out = `${error.stdout ?? ''}${error.stderr ?? ''}`
    const failed = [...out.matchAll(/FAIL\s+(\S+)\s+>\s+([^\n]+)/g)].map((m) => `${m[1]} > ${m[2]}`)
    verdict = `killed: ${failed[0] ?? out.split('\n').filter(Boolean).slice(-3).join(' | ')}`
  } finally {
    writeFileSync(path, original)
    pending = undefined
  }
  results.push([id, verdict])
  console.log(`${id}\t${verdict}`)
}
console.log('\nSUMMARY')
for (const [id, verdict] of results)
  console.log(`${id}\t${verdict.startsWith('killed') ? 'killed' : verdict}`)
