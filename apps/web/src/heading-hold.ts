/** The sizes the offset is worked out from, in viewport pixels (`getBoundingClientRect`). */
export interface HeadingSizes {
  /** The controls bar's bottom edge. */
  barBottom: number
  /** The table's own top, which a transform on its heading cells does not move. */
  tableTop: number
  tableHeight: number
  /** Both heading rows when the revenue sources show. */
  headingHeight: number
}

/**
 * How far the video list's heading rows move down, so they sit right under the controls bar once
 * the page scrolls past the list's top, and leave with the list past its last row.
 */
export function headingOffsetOf({
  barBottom,
  tableTop,
  tableHeight,
  headingHeight,
}: HeadingSizes): number {
  // Never past the table's box, which the list's sideways scroll would clip and grow.
  return Math.min(Math.max(0, barBottom - tableTop), Math.max(0, tableHeight - headingHeight))
}

/** The sizes a pager link's landing is worked out from, in pixels. */
export interface LandingSizes {
  /** How far the page is scrolled (`window.scrollY`). */
  scrollY: number
  /** The table's top in the viewport (`getBoundingClientRect`). */
  tableTop: number
  /** The controls bar's height, 0 with no bar. */
  barHeight: number
}

/**
 * The page scroll that puts the video list's table's top right under the controls bar. The bar's
 * height, not its bottom: it sticks at the top of the screen, so once the page scrolls to the table
 * its bottom is its height, whether or not it was stuck at the click.
 */
export function listLandingTopOf({ scrollY, tableTop, barHeight }: LandingSizes): number {
  return Math.max(0, scrollY + tableTop - barHeight)
}

/**
 * Brings the video list's table under the controls bar, at once as the top of the screen was, and
 * gives it focus without scrolling again, so a screen reader starts at the page's rows.
 */
export function landOnList(
  table: HTMLTableElement | null,
  bar: HTMLElement | null | undefined,
  window: Pick<Window, 'scrollY' | 'scrollTo'>,
): void {
  if (!table) return
  window.scrollTo({
    top: listLandingTopOf({
      scrollY: window.scrollY,
      tableTop: table.getBoundingClientRect().top,
      barHeight: bar?.offsetHeight ?? 0,
    }),
  })
  table.focus({ preventScroll: true })
}

/** The browser's frame, window events and ResizeObserver the hold uses, faked in its tests. */
export interface HoldBrowser {
  requestAnimationFrame(callback: () => void): number
  cancelAnimationFrame(handle: number): void
  addEventListener(
    type: 'scroll' | 'resize',
    listener: () => void,
    options?: { passive: boolean },
  ): void
  removeEventListener(type: 'scroll' | 'resize', listener: () => void): void
  ResizeObserver: new (
    onResize: () => void,
  ) => { observe(target: Element): void; disconnect(): void }
}

/** The custom property the heading cells move down by, in app.css. */
const offsetProperty = '--heading-offset'

/**
 * Holds the video list's heading rows under the controls bar as the page scrolls past the list:
 * each scroll, resize of the window, of the bar (one that wraps) or of the table (rows that load,
 * columns switched) works out the offset again in the next frame, and writes it on the table's
 * style as `--heading-offset` when it changed. The write goes through the CSSOM, never a `style`
 * attribute, so the content security policy holds. Returns the cleanup.
 */
export function holdHeadingUnderBar(
  table: HTMLTableElement,
  bar: HTMLElement,
  browser: HoldBrowser,
): () => void {
  let frame: number | null = null
  let written: number | null = null

  function write() {
    frame = null
    const { top, height } = table.getBoundingClientRect()
    const offset = headingOffsetOf({
      barBottom: bar.getBoundingClientRect().bottom,
      tableTop: top,
      tableHeight: height,
      headingHeight: table.tHead?.offsetHeight ?? 0,
    })
    if (offset === written) return
    written = offset
    table.style.setProperty(offsetProperty, `${offset}px`)
  }

  function schedule() {
    if (frame === null) frame = browser.requestAnimationFrame(write)
  }

  browser.addEventListener('scroll', schedule, { passive: true })
  browser.addEventListener('resize', schedule)
  const resizes = new browser.ResizeObserver(schedule)
  resizes.observe(bar)
  resizes.observe(table)
  schedule()

  return () => {
    browser.removeEventListener('scroll', schedule)
    browser.removeEventListener('resize', schedule)
    resizes.disconnect()
    if (frame !== null) browser.cancelAnimationFrame(frame)
    frame = null
  }
}

/** The page's own browser, for the hold. */
export function browserOf(window: Window & typeof globalThis): HoldBrowser {
  return {
    requestAnimationFrame: (callback) => window.requestAnimationFrame(callback),
    cancelAnimationFrame: (handle) => window.cancelAnimationFrame(handle),
    addEventListener: (type, listener, options) => window.addEventListener(type, listener, options),
    removeEventListener: (type, listener) => window.removeEventListener(type, listener),
    ResizeObserver: window.ResizeObserver,
  }
}
