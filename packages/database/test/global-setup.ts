import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api'
import pg from 'pg'
import type { TestProject } from 'vitest/node'
import { forceRowLevelSecurity, migrate } from '../src/migrate.ts'
import * as schema from '../src/schema.ts'
import type { DatabaseUrls } from './database-urls.ts'
import * as fixtures from './fixtures.ts'

const database = 'creator_analytics_test'
const roles = ['app_test', 'bypass_test', 'app_web', 'app_worker', 'app_claim', 'app_migrator']

function urlFor(adminUrl: string, role?: string): string {
  const url = new URL(adminUrl)
  url.pathname = `/${database}`
  if (role) {
    url.username = role
    url.password = role
  }
  return url.toString()
}

async function withPool(url: string, work: (pool: pg.Pool) => Promise<void>): Promise<void> {
  const pool = new pg.Pool({ connectionString: url })
  try {
    await work(pool)
  } finally {
    await pool.end()
  }
}

async function prepare(adminUrl: string): Promise<DatabaseUrls> {
  await withPool(adminUrl, async (admin) => {
    await admin.query(`drop database if exists ${database} with (force)`)
    for (const role of roles) await admin.query(`drop role if exists ${role}`)
    await admin.query(`create role app_migrator login createrole password 'app_migrator'`)
    await admin.query(`create role app_test login password 'app_test'`)
    await admin.query(`create role bypass_test login bypassrls password 'bypass_test'`)
    await admin.query(`create database ${database} owner app_migrator`)
  })

  await withPool(urlFor(adminUrl, 'app_migrator'), async (migrator) => {
    await migrate(migrator)
    const statements = await generateMigration(
      generateDrizzleJson(schema),
      generateDrizzleJson({ ...schema, ...fixtures }),
    )
    for (const statement of statements) await migrator.query(statement)
    await forceRowLevelSecurity(migrator)
  })

  await withPool(urlFor(adminUrl), async (admin) => {
    await admin.query('grant app_web, app_worker to app_test')
  })

  return {
    admin: urlFor(adminUrl),
    migrator: urlFor(adminUrl, 'app_migrator'),
    app: urlFor(adminUrl, 'app_test'),
    bypass: urlFor(adminUrl, 'bypass_test'),
  }
}

export default async function setup(project: TestProject) {
  let container: StartedPostgreSqlContainer | undefined
  let adminUrl = process.env.TEST_DATABASE_ADMIN_URL
  if (!adminUrl) {
    container = await new PostgreSqlContainer('postgres:18-alpine').start()
    adminUrl = container.getConnectionUri()
  }
  project.provide('databaseUrls', await prepare(adminUrl))
  return async () => {
    await container?.stop()
  }
}
