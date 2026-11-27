interface ImportMetaEnv {
  /**
   * The API this build calls, written in by `wxt.config.ts` from `apiOriginOf` in `manifest.ts`.
   */
  readonly API_ORIGIN: string
  /**
   * The headers every API request carries, written in by `wxt.config.ts` from `accessHeadersOf` in
   * `staging-access.ts`: the Access service token in a staging build, none in any other.
   */
  readonly API_HEADERS: Readonly<Record<string, string>>
}
