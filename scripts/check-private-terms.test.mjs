import { spawnSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

// check-private-terms.mjs against a scratch git repository and a scratch terms file. The terms here are made up:
// the real list stays outside the repository, since it names what it guards (.claude/rules/public-repository.md).
const SCRIPT = fileURLToPath(new URL('./check-private-terms.mjs', import.meta.url))
const TERMS = ['# a comment', '', 'Example Fellowship', 'word:EXF', 'retired-host-01'].join('\n')

let dir
afterEach(async () => {
  if (dir) await rm(dir, { recursive: true, force: true })
})

function git(...args) {
  const result = spawnSync('git', args, { cwd: dir, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}`)
  return result.stdout.trim()
}

async function scratch(email = 'maintainer@users.noreply.github.com') {
  dir = await mkdtemp(join(tmpdir(), 'private-terms-'))
  git('init', '-q', '-b', 'main')
  git('config', 'user.name', 'Maintainer')
  git('config', 'user.email', email)
  await writeFile(join(dir, 'terms.txt'), TERMS)
  await writeFile(join(dir, 'README.md'), 'A creator analytics app.\n')
  git('add', 'README.md')
  git('commit', '-q', '-m', 'First commit')
  return git('rev-parse', 'HEAD')
}

async function commit(file, text, message = 'A change') {
  await writeFile(join(dir, file), text)
  git('add', file)
  git('commit', '-q', '-m', message)
  return git('rev-parse', 'HEAD')
}

function check(args, { terms = join(dir, 'terms.txt'), input } = {}) {
  return spawnSync('node', [SCRIPT, ...args], {
    cwd: dir,
    encoding: 'utf8',
    input,
    env: { ...process.env, PRIVATE_TERMS_FILE: terms },
  })
}

describe('pnpm check:private', () => {
  it('passes a tree and a range that hold no private term', async () => {
    const first = await scratch()
    await commit('notes.md', 'The weekly report, with an EXFIL line that is no whole word.\n')
    expect(check([]).status).toBe(0)
    expect(check(['--range', `${first}..HEAD`]).status).toBe(0)
  })

  it('fails a tracked file that holds a term, in any letter case, and names the file and the line', async () => {
    await scratch()
    await commit('notes.md', 'one\nViews at example fellowship.\n')
    const result = check([])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('notes.md:2')
  })

  it('reads a tracked file whose name is not ASCII', async () => {
    await scratch()
    await commit('café.md', 'clean\n')
    expect(check([]).status).toBe(0)
    await commit('café.md', 'clean\nExample Fellowship\n')
    const result = check([])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('café.md:2 holds the term on line 3')
  })

  it('matches a word: term as a whole word only', async () => {
    await scratch()
    await commit('notes.md', 'Ready for the EXF channel.\n')
    const result = check([])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('notes.md:1 holds the term on line 4')
  })

  it('fails a range in which one commit adds a term and a later one removes it, since the history is public too', async () => {
    const first = await scratch()
    await commit('notes.md', 'retired-host-01.local\n')
    await commit('notes.md', 'the production box\n')
    expect(check([]).status).toBe(0)
    const result = check(['--range', `${first}..HEAD`])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('notes.md')
  })

  it('reads an added line that starts with "++ " as a line, not as a file header', async () => {
    const first = await scratch()
    await commit('notes.md', '++ Example Fellowship\nthe EXF channel\n')
    const result = check(['--range', `${first}..HEAD`])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(', notes.md holds the term on line 3')
    expect(result.stderr).toContain(', notes.md holds the term on line 4')
  })

  it('fails a tracked file whose name holds a term, a binary one too', async () => {
    await scratch()
    await commit('retired-host-01.png', Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2]))
    const result = check([])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('path retired-host-01.png holds the term on line 5')
  })

  it('fails a range that adds a file, or renames one, to a name that holds a term', async () => {
    const first = await scratch()
    await commit('Example Fellowship.md', 'clean body\n')
    const added = check(['--range', `${first}..HEAD`])
    expect(added.status).toBe(1)
    expect(added.stderr).toContain(', path Example Fellowship.md holds the term on line 3')

    const before = git('rev-parse', 'HEAD')
    git('mv', 'README.md', 'retired-host-01.md')
    git('commit', '-q', '-m', 'Rename')
    const renamed = check(['--range', `${before}..HEAD`])
    expect(renamed.status).toBe(1)
    expect(renamed.stderr).toContain(', path retired-host-01.md holds the term on line 5')
  })

  it('passes a range that deletes a file whose name holds a term', async () => {
    await scratch()
    await commit('retired-host-01.md', 'clean\n')
    const before = git('rev-parse', 'HEAD')
    git('rm', '-q', 'retired-host-01.md')
    git('commit', '-q', '-m', 'Remove the old note')
    expect(check(['--range', `${before}..HEAD`]).status).toBe(0)
  })

  it('reads the lines of a root commit even where git is set not to show one', async () => {
    const root = await scratch()
    await writeFile(join(dir, 'terms.txt'), `${TERMS}\ncreator analytics app`)
    const result = spawnSync('node', [SCRIPT, '--range', root], {
      cwd: dir,
      encoding: 'utf8',
      env: {
        ...process.env,
        PRIVATE_TERMS_FILE: join(dir, 'terms.txt'),
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: 'log.showRoot',
        GIT_CONFIG_VALUE_0: 'false',
      },
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(', README.md holds the term on line 6')
  })

  it('fails a range whose commit message holds a term', async () => {
    const first = await scratch()
    await commit('notes.md', 'clean\n', 'Charts for Example Fellowship')
    const result = check(['--range', `${first}..HEAD`])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain("'s message holds the term on line 3")
  })

  it('fails a range with a commit whose author or committer address holds a term', async () => {
    const first = await scratch()
    git('config', 'user.email', 'me@retired-host-01.example')
    await commit('notes.md', 'clean\n')
    const author = check(['--range', `${first}..HEAD`])
    expect(author.status).toBe(1)
    expect(author.stderr).toContain("'s author and committer holds the term on line 5")

    git('config', 'user.email', 'maintainer@users.noreply.github.com')
    const before = git('rev-parse', 'HEAD')
    const committed = spawnSync('git', ['commit', '-q', '--allow-empty', '-m', 'Clean'], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, GIT_COMMITTER_EMAIL: 'ops@retired-host-01.example' },
    })
    expect(committed.status).toBe(0)
    const committer = check(['--range', `${before}..HEAD`])
    expect(committer.status).toBe(1)
    expect(committer.stderr).toContain("'s author and committer holds the term on line 5")
  })

  it('fails text on stdin that holds a term, for a pull request title and body', async () => {
    await scratch()
    const dirty = check(['--stdin'], { input: 'Fix the chart\n\nFor Example Fellowship.' })
    expect(dirty.status).toBe(1)
    expect(dirty.stderr).toContain('stdin holds the term on line 3')
    expect(check(['--stdin'], { input: 'Fix the chart' }).status).toBe(0)
  })

  it.for([
    { args: ['--', '--stdin'] },
    { args: ['--', '--range', 'HEAD~1..HEAD'] },
    { args: ['--rang', 'HEAD~1..HEAD'] },
    { args: ['--stdin', '--range', 'HEAD~1..HEAD'] },
    { args: ['--range', ''] },
    { args: ['--range=--stdin'] },
    { args: ['--range=--branches=nope'] },
    { args: ['--range', 'HEAD~1..HEAD', '--range', 'HEAD..HEAD'] },
    { args: ['--stdin', '--stdin'] },
    { args: ['--'] },
    { args: ['--range', 'no-such-ref..HEAD'] },
  ])('refuses $args with exit 2 and checks nothing, even with no terms file', async ({ args }) => {
    await scratch()
    await commit('notes.md', 'clean\n')
    const result = check(args, { terms: join(dir, 'no-such-terms.txt') })
    expect(result.status).toBe(2)
    expect(result.stderr).toMatch(/^check:private: /)
    expect(result.stderr).not.toContain('no private terms file')
  })

  it('reads --range=<range> as --range <range>', async () => {
    const first = await scratch()
    await commit('notes.md', 'retired-host-01\n')
    await commit('notes.md', 'clean\n')
    const result = check([`--range=${first}..HEAD`])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('notes.md holds the term on line 5')
  })

  it('skips with a note, exit 0, where no terms file exists, as in a contributor clone', async () => {
    await scratch()
    await commit('notes.md', 'Example Fellowship\n')
    const result = check([], { terms: join(dir, 'no-such-terms.txt') })
    expect(result.status).toBe(0)
    expect(result.stderr).toContain('no private terms file')
  })
})
