import type { ChannelsRead, UploadsRead, VideosRead } from './product-api.ts'

/**
 * A read that needed the creator's session: a failed read says nothing about it, and nor does one
 * with host access to stillstats.com withheld, which the background makes without asking the API.
 */
export const showsSignedIn = (read: ChannelsRead | VideosRead | UploadsRead): boolean =>
  read.state !== 'signed-out' && read.state !== 'failed' && read.state !== 'host-access-withheld'
