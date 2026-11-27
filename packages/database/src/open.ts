import { drizzle } from 'drizzle-orm/node-postgres'
import type { Pool } from 'pg'
import {
  type ScopeOptions,
  type WebDatabase,
  type WorkerDatabase,
  webDatabase,
  workerDatabase,
} from './scopes.ts'

const unsafeLoginReasons = ['superuser', 'bypassrls', 'table_owner'] as const

export type UnsafeLoginReason = (typeof unsafeLoginReasons)[number]

export class UnsafeLoginRoleError extends Error {
  readonly reason: UnsafeLoginReason

  constructor(role: string, reason: UnsafeLoginReason) {
    super(`Login role ${role} is unsafe for row-level security: ${reason}`)
    this.name = 'UnsafeLoginRoleError'
    this.reason = reason
  }
}

// Superusers, BYPASSRLS roles and table owners skip the policies. Membership counts too, because
// the login role could SET ROLE to any role it is a member of.
const loginRoleCheck = `
  select
    session_user as role,
    exists (
      select 1 from pg_roles r
      where r.rolsuper and pg_has_role(session_user, r.oid, 'MEMBER')
    ) as superuser,
    exists (
      select 1 from pg_roles r
      where r.rolbypassrls and pg_has_role(session_user, r.oid, 'MEMBER')
    ) as bypassrls,
    exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where c.relkind in ('r', 'p')
        and n.nspname <> 'information_schema'
        and n.nspname not like 'pg\\_%'
        and pg_has_role(session_user, c.relowner, 'MEMBER')
    ) as table_owner`

export async function assertSafeLoginRole(pool: Pool): Promise<void> {
  const { rows } = await pool.query<{ role: string } & Record<UnsafeLoginReason, boolean>>(
    loginRoleCheck,
  )
  const login = rows[0]
  if (!login) throw new Error('The login role check returned no row')
  for (const reason of unsafeLoginReasons) {
    if (login[reason]) throw new UnsafeLoginRoleError(login.role, reason)
  }
}

export async function openWebDatabase(pool: Pool, options: ScopeOptions): Promise<WebDatabase> {
  await assertSafeLoginRole(pool)
  return webDatabase(drizzle({ client: pool }), options)
}

export async function openWorkerDatabase(
  pool: Pool,
  options: ScopeOptions,
): Promise<WorkerDatabase> {
  await assertSafeLoginRole(pool)
  return workerDatabase(drizzle({ client: pool }), options)
}
