/**
 * On a window this wide and this tall the sidebar is a column at the window's left edge, its full
 * height, and holds the wordmark, the account menu and the picker the header holds below it. 48rem
 * is the 768px of a tablet held upright (creator-analytics issue 274). The column does not scroll,
 * so it shows only where its rows fit: 36rem held the 565.2px they took with the three links,
 * every footer item, two channels, "Thumbnail preview", "Send feedback" and the support item
 * shown, measured in the browser walk at 1280px (creator-analytics issues 531, 577, 582, 590 and
 * 799). "Thumbnail preview" now sits in the list (creator-analytics issue 890), where rows are
 * 0.25rem apart instead of the footer's 1rem, so the rows took less and 36rem still held. The
 * "Retention" link (creator-analytics issue 951) takes them to 597.2px, so 38rem, 608px, holds
 * them; the walk's minimum height step proves it. A phone held sideways, about 340px tall, keeps the header,
 * with its Menu (creator-analytics issue 891). The sidebar reads it through matchMedia, and app.css writes it again for the column's rules, which
 * web.test.ts holds equal to it. Its own module, so that test can import it without the browser's
 * types.
 */
export const sidebarColumnQuery = '(min-width: 48rem) and (min-height: 38rem)'
