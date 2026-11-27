import pg from 'pg'
import { migrate } from './migrate.ts'

const url = process.env.MIGRATION_DATABASE_URL
if (!url) throw new Error('MIGRATION_DATABASE_URL is not set')

const pool = new pg.Pool({ connectionString: url })
try {
  await migrate(pool)
} finally {
  await pool.end()
}
