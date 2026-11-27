// Rerun after any change to policy-questions.md: `node docs/audit-application/build-policy-questions-pdf.ts`.

// Prints policy-questions.md to policy-questions.pdf beside it, the PDF uploaded in Section 6 of the
// audit application (docs/audit-application.md, creator-analytics#971). The markdown is rendered by
// the release pages' own `htmlOf`, whose `typographer: false` keeps `---` from becoming an em-dash,
// and printed by the system Chrome the browser walk uses, at CHROME_PATH or in /Applications. So the
// PDF adds no dependency.
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { htmlOf } from '../../packages/releases/src/markdown.ts'

const title = 'Policy questions for the API Services team'
const here = fileURLToPath(new URL('.', import.meta.url))
const source = join(here, 'policy-questions.md')
const output = join(here, 'policy-questions.pdf')
const chrome =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const style = `
  @page { size: Letter; margin: 22mm 20mm; }
  body { font: 11pt/1.45 Georgia, 'Times New Roman', serif; color: #111; }
  h1 { font-size: 18pt; margin: 0 0 12pt; }
  h2 { font-size: 13pt; margin: 18pt 0 6pt; break-after: avoid; }
  p, li { margin: 0 0 6pt; }
  blockquote { margin: 6pt 0 8pt; padding-left: 10pt; border-left: 2pt solid #999; color: #333; }
  code { font-family: Menlo, monospace; font-size: 9.5pt; }
`

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>${style}</style>
</head>
<body>
${htmlOf(await readFile(source, 'utf8'))}
</body>
</html>
`

const directory = await mkdtemp(join(tmpdir(), 'policy-questions-'))
try {
  const html = join(directory, 'policy-questions.html')
  await writeFile(html, page)
  const code = await new Promise<number | null>((resolve, reject) => {
    const child = spawn(
      chrome,
      [
        '--headless',
        '--disable-gpu',
        '--no-pdf-header-footer',
        `--user-data-dir=${join(directory, 'profile')}`,
        `--print-to-pdf=${output}`,
        `file://${html}`,
      ],
      { stdio: 'inherit' },
    )
    child.on('error', reject)
    child.on('exit', resolve)
  })
  if (code !== 0) throw new Error(`Chrome exited with ${code} while printing ${output}`)
  console.log(`Wrote ${output}`)
} finally {
  await rm(directory, { recursive: true, force: true })
}
