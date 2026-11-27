import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './drizzle',
  entities: { roles: true },
  dbCredentials: { url: process.env.MIGRATION_DATABASE_URL ?? '' },
})
