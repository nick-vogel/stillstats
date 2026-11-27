/**
 * Just enough of a browser for seam 1: it keeps the API's cookies, sends the Origin header a
 * browser sends on a POST (or the one the caller set, as an extension's background script sends
 * its own), and follows redirects across origins. It holds no cookie for any other origin, which
 * is all the fake Google server needs.
 */
export class Browser {
  readonly origin: string
  readonly #cookies = new Map<string, string>()

  constructor(origin: string) {
    this.origin = origin
  }

  /** The API's cookies as a Cookie header, to replay them after the browser has dropped them. */
  get cookieHeader(): string {
    return [...this.#cookies].map(([name, value]) => `${name}=${value}`).join('; ')
  }

  async fetch(path: string, init: RequestInit = {}): Promise<Response> {
    const url = new URL(path, this.origin)
    const sameOrigin = url.origin === this.origin
    const headers = new Headers(init.headers)
    if (sameOrigin && this.#cookies.size > 0 && !headers.has('cookie')) {
      headers.set('cookie', this.cookieHeader)
    }
    if (init.method && init.method !== 'GET' && !headers.has('origin')) {
      headers.set('origin', this.origin)
    }
    const response = await fetch(url, { ...init, headers, redirect: 'manual' })
    if (sameOrigin) this.#store(response.headers.getSetCookie())
    return response
  }

  postJson(path: string, body: unknown): Promise<Response> {
    return this.fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  /**
   * Follows redirects the way a browser does, and returns the page it lands on. With `stopAt`, a
   * redirect to a location it matches is not followed: the browser stays on the redirecting page,
   * and its response carries the location, as a creator who closes the tab before it loads.
   */
  async navigate(
    path: string,
    { stopAt }: { stopAt?: (location: URL) => boolean } = {},
  ): Promise<{ url: URL; response: Response }> {
    let url = new URL(path, this.origin)
    for (let hop = 0; hop < 10; hop++) {
      const response = await this.fetch(url.toString())
      const location = response.headers.get('location')
      if (response.status < 300 || response.status >= 400 || !location) return { url, response }
      const next = new URL(location, url)
      if (stopAt?.(next)) return { url, response }
      url = next
    }
    throw new Error(`More than 10 redirects from ${path}`)
  }

  #store(setCookies: string[]): void {
    for (const setCookie of setCookies) {
      const [pair = '', ...attributes] = setCookie.split(';')
      const separator = pair.indexOf('=')
      const name = pair.slice(0, separator).trim()
      const value = pair.slice(separator + 1).trim()
      const expired = attributes.some((attribute) => /^\s*max-age=0\s*$/i.test(attribute))
      if (expired || value === '') this.#cookies.delete(name)
      else this.#cookies.set(name, value)
    }
  }
}
