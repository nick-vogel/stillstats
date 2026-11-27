// Pre-PR review 4, finding 2. Moves the homepage's extension block above the "Honest numbers" points,
// where the approved placement on creator-analytics#478 says it must not go, in the index.html
// passed as the only argument. Run it on a scratch worktree, never on the integration worktree:
// the extension test should go red on the result, and today it stays green.
import { readFileSync, writeFileSync } from 'node:fs'

const [path] = process.argv.slice(2)
if (path === undefined) throw new Error('Pass the path of a scratch apps/site/index.html')

const html = readFileSync(path, 'utf8')
const block = /\n {8}<div class="extension-block" id="extension">[\s\S]*?<\/div>\n/.exec(html)?.[0]
const heading = '<h2 id="differentiators-heading">Honest numbers, and nothing else.</h2>\n'
if (block === undefined || !html.includes(heading)) throw new Error('No extension block to move')

writeFileSync(path, html.replace(block, '\n').replace(heading, `${heading}${block.slice(1)}`))
