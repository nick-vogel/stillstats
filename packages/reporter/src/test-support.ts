// Shared by the reporter's tests only. The package exports neither this module nor its fixtures.

// The recording transport lives in the testing entry, so the API's tests read what leaves too.
export { recordingTransport, sentTransactions } from '../test/testing.ts'

export const refreshToken = '1//0gAbCdEf-refresh-token-from-google'
export const accessToken = 'ya29.a0AfB_access-token-from-google'
export const youtubeChannelId = 'UCabcdefghijklmnopqrstuv'
export const views = '48213'
/** An internal id with an all-digit group, so a number mask that reaches into a uuid shows. */
export const channelId = '5d1f5c1e-6c0b-4b8e-9051-0f6a1a1d3c01'
