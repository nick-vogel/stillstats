// Limits: these tests read the committed fixture notes, never the package's own notes/, so they
// hold the answer's rules and not the version Nick commits. The image's smoke run in CI reads the
// answer from a built image, which shows the image's install carries the release content.
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ClientSettingsAnswer } from '@creator-analytics/api-types'
import { test } from '@creator-analytics/database/testing'
import { deploymentOf } from '@creator-analytics/releases'
import { fixtureContentRoot } from '@creator-analytics/releases/testing'
import { describe, expect } from 'vitest'
import { startApi } from '../test/start-api.ts'
import { clientSettingsOf } from './routes/client-settings.ts'

const commit = '89abcdef0123456789abcdef0123456789abcdef'
const openPanelClientId = 'a-web-client-id'
const env = { OPENPANEL_WEB_CLIENT_ID: openPanelClientId }

async function read(origin: string): Promise<{ status: number; body: ClientSettingsAnswer }> {
  const response = await fetch(`${origin}/api/client-settings`)
  return { status: response.status, body: (await response.json()) as ClientSettingsAnswer }
}

describe('the client settings', () => {
  test('answer a visitor who is not signed in, and are never cached', async ({ web }) => {
    const { origin } = await startApi(web)

    const response = await fetch(`${origin}/api/client-settings`)

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  test.for(['production', 'staging'] as const)(
    'on %s, carry the environment, the version, the short commit, its release page and the client ID',
    async (environment, { web }) => {
      const deployment = deploymentOf({
        STILLSTATS_ENVIRONMENT: environment,
        RELEASE_CONTENT_ROOT: fixtureContentRoot,
        COMMIT_SHA: commit,
      })
      const { origin } = await startApi(web, {
        clientSettings: clientSettingsOf(deployment, env),
      })

      expect(await read(origin)).toEqual({
        status: 200,
        body: {
          environment,
          version: '2026.11.9.1',
          commit: '89abcde',
          releasePath: '/releases/2026.11.9.1',
          openPanelClientId,
        },
      })
    },
  )

  test('with no release note in the build, carry no version and no release page', async ({
    web,
  }) => {
    const deployment = deploymentOf({
      STILLSTATS_ENVIRONMENT: 'production',
      RELEASE_CONTENT_ROOT: await mkdtemp(join(tmpdir(), 'no-notes-')),
      COMMIT_SHA: commit,
    })
    const { origin } = await startApi(web, {
      clientSettings: clientSettingsOf(deployment, env),
    })

    const { body } = await read(origin)
    expect({ version: body.version, releasePath: body.releasePath }).toEqual({
      version: null,
      releasePath: null,
    })
  })

  test('with no OpenPanel client ID set, carry none', async ({ web }) => {
    const deployment = deploymentOf({
      STILLSTATS_ENVIRONMENT: 'production',
      RELEASE_CONTENT_ROOT: fixtureContentRoot,
    })
    const { origin } = await startApi(web, {
      clientSettings: clientSettingsOf(deployment, {}),
    })

    expect((await read(origin)).body.openPanelClientId).toBeNull()
  })

  // Each OpenPanel project has two clients: the website client the browser sends with, and the
  // write client the relay sends with beside its secret. The answer is the website client's.
  test("carry the website client ID, never the relay's", async ({ web }) => {
    const deployment = deploymentOf({
      STILLSTATS_ENVIRONMENT: 'production',
      RELEASE_CONTENT_ROOT: fixtureContentRoot,
    })
    const { origin } = await startApi(web, {
      clientSettings: clientSettingsOf(deployment, {
        OPENPANEL_CLIENT_ID: 'a-write-client-id',
        OPENPANEL_WEB_CLIENT_ID: openPanelClientId,
      }),
    })

    expect((await read(origin)).body.openPanelClientId).toBe(openPanelClientId)
  })

  test("with only the relay's client ID set, carry none", async ({ web }) => {
    const deployment = deploymentOf({
      STILLSTATS_ENVIRONMENT: 'production',
      RELEASE_CONTENT_ROOT: fixtureContentRoot,
    })
    const { origin } = await startApi(web, {
      clientSettings: clientSettingsOf(deployment, { OPENPANEL_CLIENT_ID: 'a-write-client-id' }),
    })

    expect((await read(origin)).body.openPanelClientId).toBeNull()
  })
})
