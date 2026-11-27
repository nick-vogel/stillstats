// Limits: these tests cover the policy's text and which image URLs its host-sources admit. No test
// here loads a page, so none shows a browser fetching the thumbnails, or a site page loading, with
// no policy violation in the console. Nick checks that at /app and on the site in a real browser.
import { describe, expect, test } from 'vitest'
import {
  contentSecurityPolicyOf,
  toolPageContentSecurityPolicyOf,
} from '../src/content-security-policy.ts'

function directivesOf(policy: string): Record<string, string> {
  return Object.fromEntries(
    policy.split(';').map((directive) => {
      const [name = '', ...sources] = directive.trim().split(/\s+/)
      return [name, sources.join(' ')]
    }),
  )
}

// Host-sources only, as CSP3 matches them: the same scheme, then the exact host, or for `*.` any
// host ending in the rest on a dot boundary. Keywords, scheme-sources, ports and paths are ignored.
function hostSourcesAdmit(sources: string, url: string): boolean {
  const { protocol, hostname } = new URL(url)
  return sources.split(' ').some((source) => {
    const [scheme, host] = source.split('://')
    if (host === undefined || `${scheme}:` !== protocol) return false
    return host.startsWith('*.') ? hostname.endsWith(host.slice(1)) : hostname === host
  })
}

const imageSources = directivesOf(contentSecurityPolicyOf({}))['img-src'] ?? ''

describe("the content security policy of the site's pages and the web app's page", () => {
  test("allows images from the page's own origin and YouTube's image hosts only", () => {
    expect(imageSources).toBe("'self' data: https://*.ytimg.com")
  })

  test("loads a public video's thumbnail from i.ytimg.com", () => {
    expect(hostSourcesAdmit(imageSources, 'https://i.ytimg.com/vi/ANIQ6TTkj70/mqdefault.jpg')).toBe(
      true,
    )
  })

  test("loads a private or unlisted video's signed thumbnail from a numbered ytimg.com host", () => {
    const signed =
      'https://i9.ytimg.com/vi/ANIQ6TTkj70/mqdefault.jpg?sqp=CJzDoNYG&rs=AOn4CLBuWfYLg_1SQ8ETBSwiLMovE1oP1Q'

    expect(hostSourcesAdmit(imageSources, signed)).toBe(true)
  })

  test('loads no image from a host outside ytimg.com', () => {
    expect(hostSourcesAdmit(imageSources, 'https://ytimg.com.evil.example/x.jpg')).toBe(false)
    expect(hostSourcesAdmit(imageSources, 'https://example.com/x.jpg')).toBe(false)
  })

  test("runs only scripts the page's own origin and YouTube's player API host serve, and no plugin", () => {
    const policy = directivesOf(contentSecurityPolicyOf({}))

    expect(policy['default-src']).toBe("'self'")
    expect(policy['script-src']).toBe("'self' https://www.youtube.com")
    expect(policy['object-src']).toBe("'none'")
    expect(policy['base-uri']).toBe("'self'")
  })

  test("frames only YouTube's privacy-enhanced player host", () => {
    expect(directivesOf(contentSecurityPolicyOf({}))['frame-src']).toBe(
      'https://www.youtube-nocookie.com',
    )
  })

  test('names only the directives the site and the web app need', () => {
    expect(Object.keys(directivesOf(contentSecurityPolicyOf({}))).sort()).toEqual([
      'base-uri',
      'connect-src',
      'default-src',
      'font-src',
      'form-action',
      'frame-src',
      'img-src',
      'object-src',
      'script-src',
      'style-src',
    ])
  })

  test('allows no inline or evaluated code, no nonce and no hash-trusted script anywhere', () => {
    const sources = Object.values(
      directivesOf(
        contentSecurityPolicyOf({
          openPanelApiUrl: 'https://openpanel.example.com/api',
          glitchtipDsn: 'https://public-key@glitchtip.example.com/4',
        }),
      ),
    ).flatMap((value) => value.split(' '))

    expect(
      sources.filter((source) =>
        /^'(unsafe-.*|nonce-.*|sha(256|384|512)-.*|strict-dynamic)'$/.test(source),
      ),
    ).toEqual([])
  })

  test("loads styles and fonts from the page's own origin only", () => {
    const policy = directivesOf(contentSecurityPolicyOf({}))

    expect(policy['style-src']).toBe("'self'")
    expect(policy['font-src']).toBe("'self'")
  })

  test("sends forms to the page's own origin only", () => {
    expect(directivesOf(contentSecurityPolicyOf({}))['form-action']).toBe("'self'")
  })

  test("with no OpenPanel or GlitchTip, connects to the page's own origin only", () => {
    expect(directivesOf(contentSecurityPolicyOf({}))['connect-src']).toBe("'self'")
  })

  test('connects to the OpenPanel API and the GlitchTip host the build names', () => {
    const policy = directivesOf(
      contentSecurityPolicyOf({
        openPanelApiUrl: 'https://openpanel.example.com/api',
        glitchtipDsn: 'https://public-key@glitchtip.example.com/4',
      }),
    )

    expect(policy['connect-src']).toBe(
      "'self' https://openpanel.example.com https://glitchtip.example.com",
    )
  })
})

describe('the content security policy of a tool page', () => {
  const bothHosts = {
    openPanelApiUrl: 'https://openpanel.example.com/api',
    glitchtipDsn: 'https://public-key@glitchtip.example.com/4',
  }

  test.each([
    ['no OpenPanel or GlitchTip', {}],
    ['the OpenPanel API and the GlitchTip host', bothHosts],
  ])(
    'with %s, is the base policy with blob: added to img-src and nothing else different',
    (_, hosts) => {
      const base = directivesOf(contentSecurityPolicyOf(hosts))
      const toolPage = directivesOf(toolPageContentSecurityPolicyOf(hosts))

      expect(toolPage['img-src']).toBe("'self' data: https://*.ytimg.com blob:")
      expect({ ...toolPage, 'img-src': base['img-src'] }).toEqual(base)
    },
  )
})
