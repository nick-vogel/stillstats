import { expect, test } from 'vitest'
import { windowOptions } from './windows.ts'

test('the window control offers each window, in order', () => {
  expect(windowOptions.map(({ value }) => value)).toEqual([
    'lifetime',
    'last7',
    'last28',
    'last90',
    'last365',
    'custom',
    'first1',
    'first7',
    'first28',
    'first90',
    'first365',
  ])
})
