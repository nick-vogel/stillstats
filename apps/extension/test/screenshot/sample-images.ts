// The sample channel's images for the store screenshots (creator-analytics#100): its uploads'
// thumbnails, drawn as the homepage screenshot draws them, and its avatar.
import { thumbnailOf } from '../../../site/test/screenshot/stub-api.ts'

/**
 * A thumbnail at YouTube's size: `mqdefault` is 320 by 180, and `sddefault` is 640 by 480, the
 * picture between black bars, as YouTube letterboxes it. Studio's latest video card crops the bars.
 */
export function thumbnailSvgOf(id: string, size: 'mqdefault' | 'sddefault'): string {
  const picture = thumbnailOf(id)
  if (size === 'mqdefault') return picture
  const inner = picture.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 320 240">
<rect width="320" height="240" fill="#000"/>
<svg y="30" width="320" height="180" viewBox="0 0 320 180">${inner}</svg>
</svg>`
}

/** The channel's avatar: a warm plate on a terracotta ground, in the thumbnails' colours. */
export const avatarSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="176" height="176" viewBox="0 0 176 176">
<rect width="176" height="176" fill="hsl(18 55% 52%)"/>
<circle cx="88" cy="92" r="52" fill="hsl(40 30% 94%)"/>
<circle cx="88" cy="92" r="36" fill="hsl(150 32% 44%)"/>
<circle cx="102" cy="80" r="11" fill="hsl(40 60% 70%)"/>
</svg>`
