export interface DatabaseUrls {
  /** A superuser, for setup and for the superuser refusal test only. */
  admin: string
  /** The migration role, which owns every table, for setup and the table owner refusal test. */
  migrator: string
  /** The non-owner login role the harness `test` runs as, a member of app_web and app_worker. */
  app: string
  /** A login role with BYPASSRLS, for the BYPASSRLS refusal test. */
  bypass: string
}

declare module 'vitest' {
  interface ProvidedContext {
    databaseUrls: DatabaseUrls
  }
}
