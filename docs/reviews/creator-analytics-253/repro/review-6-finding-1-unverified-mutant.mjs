// Pre-PR review 6, finding 1. Adds one sentence that calls Stillstats an unverified app to the
// homepage's free plan status, in the index.html passed as the only argument. Run it on a scratch
// worktree, never on the integration worktree: the unverified-app guard should go red on the
// result, and today it stays green, because `\bverif` cannot match inside "unverified".
import { readFileSync, writeFileSync } from 'node:fs'

const [path] = process.argv.slice(2)
if (path === undefined) throw new Error('Pass the path of a scratch apps/site/index.html')

const html = readFileSync(path, 'utf8')
const status = '<p class="plan-status">Open now, in the beta.'
if (!html.includes(status)) throw new Error('No free plan status to extend')

writeFileSync(path, html.replace(status, `${status} Google calls Stillstats an unverified app.`))
