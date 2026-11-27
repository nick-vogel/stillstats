import { AsyncLocalStorage } from 'node:async_hooks'
import {
  accounts,
  type DrizzleTransaction,
  sessions,
  users,
  verifications,
  type WebDatabase,
} from '@creator-analytics/database'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import type { BetterAuthOptions } from 'better-auth/types'

type Adapter = ReturnType<ReturnType<typeof drizzleAdapter>>

/**
 * Better Auth's drizzle adapter, with every adapter call run in its own anonymous scope. Better
 * Auth holds one adapter for the life of the process, so the adapter's database handle is a
 * stand-in that resolves to the transaction of the scope the current call opened.
 *
 * Every Better Auth call runs in the anonymous scope, the session lookup on each signed-in route
 * and sign-out included: the session lookup is how the API learns who the user is, so it runs
 * before a user is known and no user scope can be opened for it.
 */
export function anonymousScopeAdapter(
  database: WebDatabase,
): (options: BetterAuthOptions) => Adapter {
  const current = new AsyncLocalStorage<DrizzleTransaction>()
  const handle = new Proxy({} as DrizzleTransaction, {
    get(_, key) {
      const transaction = current.getStore()
      if (!transaction) throw new Error('Better Auth reached the database outside a scope')
      const value: unknown = Reflect.get(transaction, key, transaction)
      return typeof value === 'function' ? value.bind(transaction) : value
    },
  })

  const adapter = drizzleAdapter(handle, {
    provider: 'pg',
    schema: { users, sessions, accounts, verifications },
    usePlural: true,
    transaction: true,
  })

  return (options) =>
    new Proxy(adapter(options), {
      get(target, key, receiver) {
        const value: unknown = Reflect.get(target, key, receiver)
        if (typeof value !== 'function') return value
        return (...args: unknown[]) =>
          database.asAnonymous((scope) => current.run(scope.sql, () => value.apply(target, args)))
      },
    })
}
