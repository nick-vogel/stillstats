/**
 * The custom property the video screen holds the controls bar's height in, which app.css sticks
 * the video player under. Its own module, with no browser types, so web.test.ts can import it.
 */
export const controlsBarHeightProperty = '--controls-bar-height'

/** The controls bar, sticky at the top of the screen. */
interface Bar {
  readonly offsetHeight: number
}

/** The element both the bar and what sticks under it sit inside. */
interface Screen {
  readonly style: { setProperty(name: string, value: string): void }
}

type Resizes<B> = new (onResize: () => void) => { observe(target: B): void; disconnect(): void }

/**
 * Writes the controls bar's height on `screen` as `--controls-bar-height`, at once and again each
 * time the bar resizes, since it wraps on a narrower window. The custom range's fields open in a
 * Popover, so they no longer grow it. The write goes through the CSSOM, never a `style` attribute,
 * so the content security policy holds. Returns the cleanup.
 */
export function holdBarHeightOn<B extends Bar>(
  screen: Screen,
  bar: B,
  ResizeObserver: Resizes<NoInfer<B>>,
): () => void {
  let written: number | null = null

  function write() {
    const height = bar.offsetHeight
    if (height === written) return
    written = height
    screen.style.setProperty(controlsBarHeightProperty, `${height}px`)
  }

  const resizes = new ResizeObserver(write)
  resizes.observe(bar)
  write()
  return () => resizes.disconnect()
}
