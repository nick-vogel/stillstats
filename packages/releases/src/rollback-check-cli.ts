import { parseArgs } from 'node:util'
import { packageContentRoot } from './read-release-content.ts'
import { rollbackFor } from './rollback-check.ts'

/**
 * The rollback workflow's check, run in a checkout of the newest release tag. On a pass it prints
 * a `version=` line for `$GITHUB_OUTPUT`. A refused rollback prints the refusal on stderr and
 * exits 1, which fails the job before `latest` moves.
 */
const { values } = parseArgs({ options: { version: { type: 'string' } } })
const { version } = values
if (version === undefined) {
  console.error('Usage: rollback-check --version <version>')
  process.exit(1)
}
try {
  const rollback = rollbackFor(version, process.env.RELEASE_CONTENT_ROOT || packageContentRoot)
  console.log(`version=${rollback.version}`)
} catch (error) {
  console.error((error as Error).message)
  process.exit(1)
}
