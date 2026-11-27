// Limits: these tests fake `permissions.contains` and `permissions.request`, so they cannot see
// Chrome's or Firefox's real answer, their site access settings, or the browser's own permission
// prompt. creator-analytics#101 checks those by hand.
import { describe, expect, test, vi } from 'vitest'
import { hostAccessOf } from './host-access.ts'

const manifest = {
  host_permissions: ['https://studio.youtube.com/*', 'https://stillstats.example/*'],
}

function permissionsAnswering(answer: boolean) {
  return {
    contains: vi.fn(async () => answer),
    request: vi.fn(async () => answer),
  }
}

describe('hostAccessOf', () => {
  test.each([true, false])(
    'granted answers %s when the browser does for every manifest host origin',
    async (answer) => {
      const permissions = permissionsAnswering(answer)

      await expect(hostAccessOf({ manifest, permissions }).granted()).resolves.toBe(answer)
      expect(permissions.contains).toHaveBeenCalledWith({
        origins: ['https://studio.youtube.com/*', 'https://stillstats.example/*'],
      })
    },
  )

  test('request asks for the same origins granted asks about, so the two cannot disagree', async () => {
    const permissions = permissionsAnswering(true)
    const hostAccess = hostAccessOf({ manifest, permissions })

    await expect(hostAccess.request()).resolves.toBe(true)
    await hostAccess.granted()

    expect(permissions.request).toHaveBeenCalledWith({
      origins: ['https://studio.youtube.com/*', 'https://stillstats.example/*'],
    })
    expect(permissions.request.mock.calls[0]).toEqual(permissions.contains.mock.calls[0])
  })

  test('request reaches the browser on the call itself, so a click keeps it as its first await', () => {
    const permissions = permissionsAnswering(true)

    void hostAccessOf({ manifest, permissions }).request()

    expect(permissions.request).toHaveBeenCalledOnce()
  })

  test('YouTube access never counts: granted and request name the required host origins only', async () => {
    const permissions = permissionsAnswering(true)
    const hostAccess = hostAccessOf({
      manifest: { ...manifest, optional_host_permissions: ['https://www.youtube.com/*'] },
      permissions,
    })

    await hostAccess.granted()
    await hostAccess.request()

    const required = { origins: ['https://studio.youtube.com/*', 'https://stillstats.example/*'] }
    expect(permissions.contains.mock.calls).toEqual([[required]])
    expect(permissions.request.mock.calls).toEqual([[required]])
  })

  test('a manifest that names no host origins asks about none', async () => {
    const permissions = permissionsAnswering(true)
    const hostAccess = hostAccessOf({ manifest: {}, permissions })

    await hostAccess.granted()
    await hostAccess.request()

    expect(permissions.contains).toHaveBeenCalledWith({ origins: [] })
    expect(permissions.request).toHaveBeenCalledWith({ origins: [] })
  })
})
