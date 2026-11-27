/**
 * How long a signed-in read of the Stillstats API is kept. Short, so a channel connected in the web
 * app shows on a popup opened half a minute later, while Studio's in-page navigations back to a
 * page do not repeat its reads. The background keeps its reads this long, a Studio surface
 * keeps a line as long before it asks again (see `isKept`), and a public page surface keeps a read
 * that holds no answer as long (see `publicPageReads`). It lives here, not in product-api.ts,
 * because only the background script may import the product API client.
 */
export const signedInReadKeptMs = 30_000
