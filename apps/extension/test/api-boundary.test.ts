// Limits: a scan of the extension's source for the ways a script reaches the network. It cannot see
// a request a dependency makes, or one a built bundle adds; creator-analytics#101 watches both
// browsers' network panels. It sees only a request API called by name (`fetch(`, `XMLHttpRequest`,
// `sendBeacon`, `WebSocket`) and a static `import` of the client written `'…/product-api.ts'`, not
// an extensionless, `.js`, double-quoted or dynamic import, an aliased fetch, or an `export ...
// from` re-export.
import { globSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'

const src = join(import.meta.dirname, '../src')

const sources = globSync('**/*.ts', { cwd: src })
  .filter((file) => !file.endsWith('.test.ts'))
  .map((file) => ({ file, source: readFileSync(join(src, file), 'utf8') }))

test('only the product API client makes a network request', () => {
  const requesting = sources
    .filter(({ source }) => /\bfetch\s*\(|XMLHttpRequest|sendBeacon|new\s+WebSocket/.test(source))
    .map(({ file }) => file)

  expect(requesting).toEqual(['product-api.ts'])
})

test('only the background script holds the product API client', () => {
  const importing = sources
    .filter(({ source }) =>
      /^import\s+(?!type\s)[^']*from\s+'[^']*\/product-api\.ts'/m.test(source),
    )
    .map(({ file }) => file)

  expect(importing).toEqual(['entrypoints/background.ts'])
})
