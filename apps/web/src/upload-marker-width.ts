/**
 * The width of an upload marker's box in rem, the `.upload-marker` rule's in app.css (a tile's box
 * fits inside it): markers whose centres sit closer than this across the track would overlap, so
 * they join into one tile. web.test.ts holds app.css equal to it. Its own module, so that test can
 * import it without the browser's types.
 */
export const uploadMarkerRem = 1.5
