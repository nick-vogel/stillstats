import { Window } from 'happy-dom'
import { describe, expect, test } from 'vitest'
import { screenLanded } from './screen-ready.ts'

function screenOf(body: string) {
  const { document } = new Window()
  document.body.innerHTML = body
  return document
}

const header = '<header class="app-header" aria-busy="false"><button>Settings</button></header>'

describe('when the browser walk takes a screen to have landed', () => {
  test('a landed screen whose fields carry a placeholder utility class has landed', () => {
    // Every shadcn Input and Native Select carries `placeholder:text-muted-foreground`.
    const screen = screenOf(
      `<main class="app app-signed-in">${header}<h1>Videos</h1>
        <select class="placeholder:text-muted-foreground"><option>Last 28 days</option></select>
        <input class="placeholder:text-muted-foreground" type="date"></main>`,
    )
    expect(screenLanded(screen)).toBe(true)
  })

  test('a signed-in screen has landed whatever classes its main element carries', () => {
    expect(screenLanded(screenOf(`<main>${header}<h1>Videos</h1></main>`))).toBe(true)
  })

  test("from 48rem a signed-in screen has landed with the sidebar's nav in place of the header", () => {
    const sidebar =
      '<div data-slot="sidebar"><nav aria-label="Channel screens"><a href="/app/">Videos</a></nav></div>'
    expect(screenLanded(screenOf(`<main>${sidebar}<h1>Videos</h1></main>`))).toBe(true)
  })

  test('a region still waiting on its answer holds the screen back', () => {
    const screen = screenOf(
      `<main>${header}<h1>Videos</h1>
        <div aria-busy="true"><div class="placeholder placeholder-card" aria-hidden="true"></div></div></main>`,
    )
    expect(screenLanded(screen)).toBe(false)
  })

  test('the header while the session is read holds the screen back', () => {
    const screen = screenOf('<main><header aria-busy="true"></header><h1>Videos</h1></main>')
    expect(screenLanded(screen)).toBe(false)
  })

  test('the signed-out screen is not a landed session', () => {
    expect(screenLanded(screenOf('<main><h1>Stillstats</h1><button>Sign in</button></main>'))).toBe(
      false,
    )
  })

  test('a signed-in screen without its heading yet has not landed', () => {
    expect(screenLanded(screenOf(`<main>${header}</main>`))).toBe(false)
  })
})
