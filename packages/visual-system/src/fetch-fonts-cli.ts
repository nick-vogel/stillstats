// Copies the Fontshare fonts into packages/visual-system/fonts/, which .gitignore leaves out.
//
//   pnpm fonts                                  clones the private fonts repository with gh, on a
//                                               machine signed in to an account that can read it
//   node packages/visual-system/src/fetch-fonts-cli.ts --from <folder>
//                                               copies from a checkout of it, as CI does
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  copyFontshareFiles,
  fontsDirectory,
  fontshareFiles,
  fontshareRepository,
} from './fontshare.ts'

const args = process.argv.slice(2)
const from = args.length === 2 && args[0] === '--from' && args[1] ? args[1] : undefined
if (args.length !== 0 && !from) {
  throw new Error('Run it with no arguments, or with --from <a checkout of the fonts repository>')
}

const clone = from ? undefined : mkdtempSync(join(tmpdir(), 'stillstats-fonts-'))
try {
  if (clone) {
    execFileSync('gh', ['repo', 'clone', fontshareRepository, clone, '--', '--depth', '1'], {
      stdio: 'inherit',
    })
  }
  copyFontshareFiles(from ?? clone ?? '')
  console.log(`Copied ${fontshareFiles.join(', ')} into ${fileURLToPath(fontsDirectory)}`)
} finally {
  if (clone) rmSync(clone, { recursive: true, force: true })
}
