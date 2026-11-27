import type { Browser } from 'wxt/browser'

/**
 * The one answer to whether the extension has host access, read over every required host origin,
 * the manifest's `host_permissions`. The popup and the background both read it here, so they
 * cannot disagree on which origins count. YouTube access, an optional host permission, never
 * counts: without it the extension still has all the host access it needs (`youtube-access.ts`).
 */
export function hostAccessOf({
  manifest,
  permissions,
}: {
  // The rest of the manifest passes through, so `runtime.getManifest()`'s answer fits as it is.
  manifest: { host_permissions?: string[] | undefined; [key: string]: unknown }
  permissions: Pick<typeof Browser.permissions, 'contains' | 'request'>
}): { granted: () => Promise<boolean>; request: () => Promise<boolean> } {
  const origins = manifest.host_permissions ?? []
  return {
    granted: () => permissions.contains({ origins }),
    // Asks on the call itself, with no await before it, so a click that calls it keeps the
    // request inside the user gesture both browsers require.
    request: () => permissions.request({ origins }),
  }
}
