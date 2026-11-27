import { describe, expect, it } from 'vitest'

import { shellQuote } from './shell-quote.mjs'

// eng-pipeline#51. `sops exec-env` takes one command string for `/bin/sh -c`, so
// the env wrapper and `pnpm env:check` quote each argument they put in it.

describe('shellQuote', () => {
  it('quotes a plain word', () => {
    expect(shellQuote('--fast')).toBe("'--fast'")
  })

  // The string goes to `/bin/sh -c`, so a quote inside an argument must not end
  // the quoting and let the rest run as shell.
  it('survives a single quote inside the argument', () => {
    expect(shellQuote("a'; rm -rf /; '")).toBe("'a'\\''; rm -rf /; '\\'''")
  })
})
