// @vitest-environment happy-dom
// Limits: these tests cover the theme's rule as pure functions, on a root element and a storage
// passed in. None evaluates a stylesheet, so none shows that the attribute draws the dark or the
// light tokens, or that the head script runs before the first paint; the browser walk checks both
// in Chrome. The built page's script tag is `test/web.test.ts`'s.
import { describe, expect, test } from 'vitest'
import { applyTheme, storedTheme, themeCopyKey, themeOfCopy } from './theme.ts'

// A storage like the browser's localStorage, held in a map.
function storageOf(entries: Record<string, string> = {}) {
  const items = new Map(Object.entries(entries))
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value)
    },
    removeItem: (key: string) => {
      items.delete(key)
    },
  }
}

// A storage the browser blocks, as a private window or a blocked site's storage can.
const blockedStorage = {
  getItem: (): string | null => {
    throw new DOMException('The operation is insecure.', 'SecurityError')
  },
  setItem: () => {
    throw new DOMException('The operation is insecure.', 'SecurityError')
  },
  removeItem: () => {
    throw new DOMException('The operation is insecure.', 'SecurityError')
  },
}

describe('the theme a stored copy gives', () => {
  test('is the copy, when it is Light or Dark', () => {
    expect(themeOfCopy('light')).toBe('light')
    expect(themeOfCopy('dark')).toBe('dark')
  })

  test.for([
    ['a missing copy', null],
    ['an unknown copy', 'sepia'],
    ['a copy in another case', 'Dark'],
    ['an empty copy', ''],
    ['a copy of System', 'system'],
  ] as const)('is System, for %s', ([, copy]) => {
    expect(themeOfCopy(copy)).toBe('system')
  })
})

describe('the theme the browser stored', () => {
  test('is the copy under its key', () => {
    expect(storedTheme(storageOf({ [themeCopyKey]: 'dark' }))).toBe('dark')
    expect(storedTheme(storageOf({ other: 'dark' }))).toBe('system')
  })

  test('is System, when the browser blocks its storage', () => {
    expect(storedTheme(blockedStorage)).toBe('system')
  })
})

describe('the theme applied to the page', () => {
  test.for(['light', 'dark'] as const)('%s sets the attribute and the copy', (theme) => {
    const root = document.createElement('html')
    const storage = storageOf()

    applyTheme(theme, root, storage)

    expect(root.getAttribute('data-theme')).toBe(theme)
    expect(storage.items).toEqual(new Map([[themeCopyKey, theme]]))
  })

  test('a change from Dark to Light replaces both', () => {
    const root = document.createElement('html')
    const storage = storageOf()
    applyTheme('dark', root, storage)

    applyTheme('light', root, storage)

    expect(root.getAttribute('data-theme')).toBe('light')
    expect(storage.items).toEqual(new Map([[themeCopyKey, 'light']]))
  })

  test('System removes the attribute and the copy, and leaves every other stored value', () => {
    const root = document.createElement('html')
    root.setAttribute('data-theme', 'dark')
    const storage = storageOf({ [themeCopyKey]: 'dark', other: 'kept' })

    applyTheme('system', root, storage)

    expect(root.hasAttribute('data-theme')).toBe(false)
    expect(storage.items).toEqual(new Map([['other', 'kept']]))
  })

  test('a blocked storage still sets the attribute', () => {
    const root = document.createElement('html')

    expect(() => applyTheme('dark', root, blockedStorage)).not.toThrow()
    expect(root.getAttribute('data-theme')).toBe('dark')
  })

  test('a blocked storage still removes the attribute for System', () => {
    const root = document.createElement('html')
    root.setAttribute('data-theme', 'light')

    applyTheme('system', root, blockedStorage)

    expect(root.hasAttribute('data-theme')).toBe(false)
  })
})
