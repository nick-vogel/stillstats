import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { type JobQueue, webDatabase } from '@creator-analytics/database'
import { test } from '@creator-analytics/database/testing'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { describe, expect, onTestFinished } from 'vitest'
import { indexHtml, startApi, webRootWithIndex } from '../test/start-api.ts'

const appJs = 'console.log("web app")'

/** The API with a database pool that cannot connect: nothing listens on port 1. */
function startApiWithUnreadableDatabase(jobs: JobQueue) {
  const pool = new pg.Pool({ connectionString: 'postgres://nobody@127.0.0.1:1/none' })
  onTestFinished(() => pool.end())
  return startApi(webDatabase(drizzle({ client: pool }), { jobs }))
}

describe('seam 1: the private product API', () => {
  test('the health route reports ok when it reads the database', async ({ web }) => {
    const { origin } = await startApi(web)

    const response = await fetch(`${origin}/health`)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })

  test('the health route reports unavailable when the database cannot be read', async ({
    jobs,
  }) => {
    const { origin } = await startApiWithUnreadableDatabase(jobs)

    const response = await fetch(`${origin}/health`)

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ status: 'unavailable' })
  })

  test('a health check that cannot read the database logs an error without the connection string', async ({
    jobs,
  }) => {
    const { origin, logs } = await startApiWithUnreadableDatabase(jobs)

    await fetch(`${origin}/health`)

    expect(logs.map((line) => JSON.parse(line))).toContainEqual(
      expect.objectContaining({
        level: 'error',
        message: 'Health check could not read the database',
      }),
    )
    expect(logs.join('\n')).not.toContain('nobody@')
    expect(logs.join('\n')).not.toContain('postgres://')
  })

  test('a request that throws is reported by its route, and the client gets no detail', async ({
    web,
  }) => {
    const { origin, app, reporter } = await startApi(web)
    const failure = new Error('the handler failed')
    app.post('/fails/:channelId', () => {
      throw failure
    })

    const response = await fetch(`${origin}/fails/5d1f5c1e-6c0b-4b8e-9051-0f6a1a1d3c01`, {
      method: 'POST',
    })

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'internal' })
    expect(reporter.reports).toEqual([
      {
        message: 'The API failed a request',
        context: { method: 'POST', route: '/fails/:channelId' },
        error: failure,
      },
    ])
  })

  test("the API serves the web app's built files under /app from its own origin", async ({
    web,
  }) => {
    const webRoot = await webRootWithIndex()
    await writeFile(join(webRoot, 'app.js'), appJs)
    const { origin } = await startApi(web, { webRoot })

    const response = await fetch(`${origin}/app/app.js`)

    expect(await response.text()).toBe(appJs)
  })

  test("/app and a client-side route under it get the web app's entry page", async ({ web }) => {
    const { origin } = await startApi(web)

    for (const path of ['/app', '/app/', '/app/channels/connect']) {
      const response = await fetch(`${origin}${path}`)

      expect({ path, status: response.status, body: await response.text() }).toEqual({
        path,
        status: 200,
        body: indexHtml,
      })
    }
  })
})
