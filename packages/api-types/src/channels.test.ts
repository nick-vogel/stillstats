import { describe, expect, test } from 'vitest'
import { listedChannel } from '../test/testing.ts'
import { channelNameOf } from './channels.ts'

describe('the name a channel goes by', () => {
  test('a channel with a title and a handle is named by both', () => {
    expect(channelNameOf(listedChannel({ title: 'Nick Vogel', handle: '@nick_vogel' }))).toBe(
      'Nick Vogel (@nick_vogel)',
    )
  })

  test('a channel with no handle is named by its title', () => {
    expect(channelNameOf(listedChannel({ title: 'Nick Vogel' }))).toBe('Nick Vogel')
  })

  test('a channel YouTube did not name is named by its YouTube channel id', () => {
    expect(channelNameOf(listedChannel())).toBe('UC-c-1')
  })
})
