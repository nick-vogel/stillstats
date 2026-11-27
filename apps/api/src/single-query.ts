/**
 * Reads one value of each query parameter `refusals` names, or answers the refusal of the first one
 * sent more than once, in the order `refusals` lists them.
 *
 * Hono's `c.req.query()` keeps the first value of a repeated parameter and drops the rest without
 * saying so, so `?format=short&format=video` would answer for `short`. A route reads its query
 * through this from `c.req.queries()` instead, and refuses a repeat. Parameters outside `refusals`
 * are ignored, repeated or not.
 */
export function singleQueryOf<K extends string, E>(
  queries: Record<string, string[]>,
  refusals: Readonly<Record<K, E>>,
): { ok: true; query: Partial<Record<K, string>> } | { ok: false; error: E } {
  const query: Partial<Record<K, string>> = {}
  for (const name of Object.keys(refusals) as K[]) {
    const values = queries[name]
    if (!values) continue
    if (values.length > 1) return { ok: false, error: refusals[name] }
    query[name] = values[0]
  }
  return { ok: true, query }
}
