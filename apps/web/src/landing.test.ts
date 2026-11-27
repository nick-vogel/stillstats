import { describe, expect, test } from 'vitest'
import { readLanding } from './landing.ts'

describe('the landing of the web app', () => {
  test('a landing after a connected channel records channel_connected and shows no message', () => {
    expect(readLanding('?connected=1')).toEqual({
      message: null,
      event: { name: 'channel_connected' },
    })
  })

  test('a landing after a refused connection records the refusal code and explains it', () => {
    expect(readLanding('?connect_error=channel_held_elsewhere')).toEqual({
      message: 'Another user has already connected this channel.',
      event: { name: 'channel_connect_refused', refusal: 'channel_held_elsewhere' },
    })
  })

  test('a reconnect of a channel still being disconnected says to try again in a minute', () => {
    expect(readLanding('?connect_error=channel_disconnecting')).toEqual({
      message: 'This channel is still disconnecting. Try again in a minute.',
      event: { name: 'channel_connect_refused', refusal: 'channel_disconnecting' },
    })
  })

  test('a refusal code the API does not send is recorded as unknown', () => {
    expect(readLanding('?connect_error=creator%40example.com').event).toEqual({
      name: 'channel_connect_refused',
      refusal: 'unknown',
    })
  })

  test('a landing after a revenue consent records revenue_consent_given and shows no message', () => {
    expect(readLanding('?revenue_consented=1')).toEqual({
      message: null,
      event: { name: 'revenue_consent_given' },
    })
  })

  test('a landing after a refused revenue consent records the refusal code and explains it', () => {
    expect(readLanding('?revenue_error=channel_mismatch')).toEqual({
      message:
        'You picked a different channel on Google. Give revenue consent again and pick this channel.',
      event: { name: 'revenue_consent_refused', refusal: 'channel_mismatch' },
    })
  })

  test('a revenue refusal code the API does not send is recorded as unknown', () => {
    expect(readLanding('?revenue_error=creator%40example.com')).toEqual({
      message: 'Revenue consent failed: creator@example.com',
      event: { name: 'revenue_consent_refused', refusal: 'unknown' },
    })
  })

  test('a sign-in cancelled on Google says the creator is not signed in, and records nothing', () => {
    expect(readLanding('?error=access_denied')).toEqual({
      message: 'You cancelled the Google sign-in, so you are not signed in.',
      event: null,
    })
  })

  test('any other sign-in error says to try again, without its code', () => {
    expect(readLanding('?error=state_mismatch').message).toBe('Google sign-in failed. Try again.')
    expect(readLanding('?error=creator%40example.com').message).toBe(
      'Google sign-in failed. Try again.',
    )
  })

  test('a landing with no parameter records nothing', () => {
    expect(readLanding('')).toEqual({ message: null, event: null })
  })
})
