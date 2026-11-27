import { execFile } from 'node:child_process'
import { parseArgs, promisify } from 'node:util'
import { mergedSinceRelease } from './merged-since-release.ts'

const { values } = parseArgs({
  options: { since: { type: 'string' }, to: { type: 'string' } },
})
const { stdout } = await promisify(execFile)('git', ['rev-parse', '--show-toplevel'])
const result = await mergedSinceRelease({
  repo: stdout.trim(),
  ...(values.since === undefined ? {} : { since: values.since }),
  ...(values.to === undefined ? {} : { to: values.to }),
})
console.log(JSON.stringify(result, null, 2))
