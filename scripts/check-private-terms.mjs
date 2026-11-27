#!/usr/bin/env node
// Fails when the tree, a range of commits, or text on stdin holds a term from the maintainer's private list
// (.claude/rules/public-repository.md). The list lives outside the repository, at PRIVATE_TERMS_FILE or
// ~/.config/stillstats/private-terms.txt, because it names what it guards. Where no list exists, as in a
// contributor's clone, the check notes that and passes.
//
//   node scripts/check-private-terms.mjs                 every tracked text file of the working tree
//   node scripts/check-private-terms.mjs --range A..B    each line the commits in A..B add, their messages, and their
//                                                        author and committer names and addresses
//   node scripts/check-private-terms.mjs --stdin         the text on stdin, such as a pull request's title and body
//
// Binary files are not read: a term inside an image's bytes is outside what this check can see.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parseArgs } from 'node:util'

const refuse = (problem) => {
  console.error(`check:private: ${problem}`)
  process.exit(2)
}
const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 1024 })
let parsed
try {
  parsed = parseArgs({
    options: {
      stdin: { type: 'boolean', multiple: true },
      range: { type: 'string', multiple: true },
    },
    tokens: true,
  })
} catch (error) {
  refuse(error instanceof Error ? error.message : String(error))
}
const stdins = parsed.values.stdin ?? []
const ranges = parsed.values.range ?? []
if (parsed.tokens.some((token) => token.kind === 'option-terminator'))
  refuse('"--" is not taken: pass the flags straight to the check')
if (stdins.length > 1 || ranges.length > 1) refuse('pass --stdin or --range once')
if (stdins.length > 0 && ranges.length > 0) refuse('pass --stdin or --range, not both')
const range = ranges[0]
if (range === '') refuse('--range needs a range, such as origin/main..HEAD')
if (range?.startsWith('-')) refuse(`--range ${range} is no range: a range cannot start with "-"`)
let commits = []
if (range !== undefined) {
  try {
    commits = execFileSync('git', ['rev-list', '--end-of-options', range], {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
      .split('\n')
      .filter(Boolean)
  } catch (error) {
    refuse(
      `git cannot read --range ${range}: ${
        ((lines) => lines.find((line) => /^(fatal|error):/.test(line)) ?? lines[0])(
          String(error.stderr ?? '')
            .trim()
            .split('\n'),
        ) || error.code
      }`,
    )
  }
}

const termsFile =
  process.env.PRIVATE_TERMS_FILE || join(homedir(), '.config/stillstats/private-terms.txt')
if (!existsSync(termsFile)) {
  console.error(`check:private: no private terms file at ${termsFile}, so nothing was checked.`)
  process.exit(0)
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const terms = readFileSync(termsFile, 'utf8')
  .split('\n')
  .map((line, index) => ({ line: line.trim(), number: index + 1 }))
  .filter(({ line }) => line !== '' && !line.startsWith('#'))
  .map(({ line, number }) => {
    const word = line.startsWith('word:')
    const term = word ? line.slice('word:'.length) : line
    return {
      number,
      pattern: new RegExp(
        word ? `(?<![\\p{L}\\p{N}_])${escapeRegExp(term)}(?![\\p{L}\\p{N}_])` : escapeRegExp(term),
        'iu',
      ),
    }
  })

const found = []
const scan = (where, text) => {
  for (const { number, pattern } of terms)
    if (pattern.test(text)) found.push(`${where} holds the term on line ${number} of ${termsFile}`)
}

if (stdins.length > 0) {
  scan('stdin', readFileSync(0, 'utf8'))
} else if (range !== undefined) {
  for (const sha of commits) {
    const short = sha.slice(0, 7)
    scan(`commit ${short}'s message`, git('show', '-s', '--format=%B', sha))
    scan(
      `commit ${short}'s author and committer`,
      git('show', '-s', '--format=%an <%ae>%n%cn <%ce>', sha),
    )
    for (const path of git(
      'diff-tree',
      '--no-commit-id',
      '--name-only',
      '--diff-filter=AMCR',
      '-r',
      '-z',
      '--root',
      '-c',
      sha,
    )
      .split('\0')
      .filter(Boolean)) {
      scan(`commit ${short}, path ${path}`, path)
    }
    let file = ''
    let inHunk = false
    for (const line of git(
      'show',
      '--root',
      '--format=',
      '--unified=0',
      '--no-color',
      '--no-ext-diff',
      sha,
    ).split('\n')) {
      if (line.startsWith('diff ')) {
        file = ''
        inHunk = false
      } else if (/^@{2,} /.test(line)) inHunk = true
      else if (!inHunk && line.startsWith('+++ ')) file = line.replace(/^\+\+\+ (b\/)?/, '')
      else if (inHunk && line.startsWith('+')) scan(`commit ${short}, ${file}`, line.slice(1))
    }
  }
} else {
  for (const file of git('ls-files', '-z').split('\0').filter(Boolean)) scan(`path ${file}`, file)
  for (const file of git('grep', '-I', '-z', '--name-only', '-e', '', '--', '.', ':!pnpm-lock.yaml')
    .split('\0')
    .filter(Boolean)) {
    for (const [index, line] of readFileSync(file, 'utf8').split('\n').entries()) {
      scan(`${file}:${index + 1}`, line)
    }
  }
}

if (found.length > 0) {
  for (const each of found) console.error(`check:private: ${each}`)
  process.exit(1)
}
