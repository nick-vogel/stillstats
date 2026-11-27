export interface Freshness {
  /** ISO 8601: when the API read the value from Google. */
  fetchedAt: string
  fromCache: boolean
}
