/**
 * The cold-cache walk (creator-analytics#1055), run by hand for the baseline (#1056). It requests
 * every read each budget screen makes, in every preset window, cold and then warm, and writes each
 * request's timing from its `Server-Timing` header to a new file. It holds no database credential
 * and stores no credential: it reads them from the environment and sends them only to the target.
 *
 * To run it against staging:
 *
 * 1. Sign in at https://staging.stillstats.com with the channel to walk, and copy the request's
 *    whole `Cookie` header from the browser's network panel. Note the channel's internal id, the
 *    uuid in the API's channel routes.
 * 2. In the shell, set `STILLSTATS_SESSION_COOKIE` to that header, and `CF_ACCESS_CLIENT_ID` and
 *    `CF_ACCESS_CLIENT_SECRET` to staging's Access service token, the one the staging extension
 *    build reads. The walk does not run through the env wrapper (`scripts/with-env.mjs`), so the
 *    shell must hold the token: copy the two values from `creator-analytics/local.env` in the
 *    secrets repo, decrypted in your own terminal. Against a local API, set the cookie only.
 * 3. From the repository root, run
 *    `pnpm --filter @creator-analytics/api cold-cache-walk --channel <id> --target https://staging.stillstats.com --out <file>`.
 *    A relative file is the directory you ran pnpm from's, and a file that exists is refused.
 * 4. The walk prints the one statement that deletes the channel's `read_cache` rows. Run it as the
 *    superuser in the staging database terminal, then press Enter: the cold pass starts, and the
 *    warm pass follows it with no other step.
 * 5. After a fix lands on staging, run it again from step 3 with a new file, and compare the two.
 */
import { existsSync } from 'node:fs'
import { promptClear, walk, walkSettingsOf, walkUsage, writeWalkFile } from './cold-cache-walk.ts'

const parsed = walkSettingsOf(process.argv.slice(2), process.env)
if (!parsed.ok) {
  console.error(parsed.usage)
  process.exit(1)
}
const { settings } = parsed
if (existsSync(settings.out)) {
  console.error(
    `--out names a file that exists; name a new one, so no walk is written over.\n${walkUsage}`,
  )
  process.exit(1)
}
try {
  const file = await walk({
    ...settings,
    clearCache: (statement) =>
      promptClear(statement, { input: process.stdin, output: process.stdout }),
    log: (line) => console.log(line),
  })
  await writeWalkFile(settings.out, file)
  console.log(`Wrote ${file.timings.length} timings to ${settings.out}`)
} catch (error) {
  console.error((error as Error).message)
  process.exit(1)
}
