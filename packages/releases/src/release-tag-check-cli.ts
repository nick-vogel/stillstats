import { writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { packageContentRoot } from './read-release-content.ts'
import { releaseForTag } from './tag-check.ts'

/**
 * The release workflow's tag check, run in a checkout of the tagged commit. It prints `deploy=`
 * and, on a deploy, `version=` lines for `$GITHUB_OUTPUT`, and writes the note's markdown to the
 * notes file for the GitHub release body. A refused tag prints the refusal on stderr and exits 1,
 * which fails the job before any migration.
 */
const { values } = parseArgs({
  options: { tag: { type: 'string' }, 'notes-file': { type: 'string' } },
})
const { tag, 'notes-file': notesFile } = values
if (!tag || !notesFile) {
  console.error('Usage: release-tag-check --tag <tag> --notes-file <path>')
  process.exit(1)
}
try {
  const release = releaseForTag(tag, process.env.RELEASE_CONTENT_ROOT || packageContentRoot)
  if (release.deploy) {
    writeFileSync(notesFile, `${release.body}\n`)
    console.log(`deploy=true\nversion=${release.version}`)
  } else {
    console.log('deploy=false')
  }
} catch (error) {
  console.error((error as Error).message)
  process.exit(1)
}
