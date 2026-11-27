// Ported from nick-vogel/nlvogel-site's `src/components/tools/ThumbnailTool.tsx` at `6d5d921`. The
// AC numbers these comments cite are nlvogel-site's.
import { Info, TriangleAlert } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'
import { overflowMessage, planAssignment, rejectionMessage } from './assign-files.ts'
import { CandidateBar } from './candidate-bar.tsx'
import { grayscaleToggleEvent, modeSwitchEvent, type ThumbnailToolEvent } from './events.ts'
import { enterFocusStage } from './focus-stage.ts'
import { BLUE_FILTER_WEIGHTS, colorMatrixValues, RED_FILTER_WEIGHTS } from './grayscale-weights.ts'
import { mismatchNotice } from './mismatch-notice.ts'
import { Rails } from './rails.tsx'
import {
  type Conversion,
  filledSlots,
  firstEmptySlot,
  initialToolState,
  isMismatched,
  type LoadSource,
  type Mode,
  type NewBadgeVisibility,
  type Preview,
  revokeAll,
  SLOT_IDS,
  type SlotId,
  type Surface,
  type ToolState,
  toolReducer,
} from './slot-state.ts'
import { Slots } from './slots.tsx'
import { TitleFields } from './title-fields.tsx'
import { Toolbar } from './toolbar.tsx'

export type ThumbnailToolProps = {
  /** Every event the tool reports, for the page to hand its analytics. */
  onEvent: (event: ThumbnailToolEvent) => void
}

type Notice = { text: string; tone: 'info' | 'warn' }

/** The slot as the events report it, lowercase, as nlvogel.com sent it. */
const eventSlot = (slot: SlotId) => slot.toLowerCase() as Lowercase<SlotId>

/**
 * The zoom note, two sentences of the tool page's approved prose under "Why are these sizes
 * accurate at 100% browser zoom?" (creator-analytics#732).
 */
const ZOOM_NOTE =
  'Every tile is drawn at its true width and never scales to fit. That guarantee depends on your browser set to 100% zoom.'

/**
 * Built from `colorMatrixValues`, the one thing allowed to turn a weight triple into a matrix, so
 * no coefficient is written in this file: a matrix typed here could disagree with
 * `grayscale-weights.ts` invisibly in both files.
 */
const RED_MATRIX = colorMatrixValues(RED_FILTER_WEIGHTS)
const BLUE_MATRIX = colorMatrixValues(BLUE_FILTER_WEIGHTS)

/**
 * The focusables a pinned bar would pass over, which is every one outside the two bars: a control
 * inside the pinned bar travels with it. This mirrors the stylesheet's `scroll-margin-top` pair
 * for the pinned state, so change one and change the other; nothing checks it for you.
 */
const CLEARED_FOCUSABLES =
  ':is(a[href], button, input, select, textarea, [tabindex]):not(.t-toolbar *):not(.t-focusbar *)'

/**
 * The surface the stage opens on: the page's `data-theme`, which the web app sets, and otherwise
 * the system's preference, which the site's pages follow. Read once, on entry, never subscribed.
 */
function resolveSurface(): Surface {
  const theme = document.documentElement.dataset.theme
  if (theme === 'dark' || theme === 'light') return theme
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * The tool's root. It owns the reducer, and nothing else owns state. NOTHING HERE SENDS A BYTE:
 * images load through `URL.createObjectURL`, and no event carries a file name or a title.
 */
export function ThumbnailTool({ onEvent }: ThumbnailToolProps) {
  const [state, dispatch] = useReducer(toolReducer, undefined, initialToolState)
  const [notices, setNotices] = useState<Notice[]>([])

  /**
   * A ref mirrors the state for the unmount cleanup, since an update queued while React tears the
   * component down may never run, and for the document handlers, which are bound once and would
   * otherwise read the first render's empty tool. Assigned after every commit, never during
   * render, so a discarded render cannot leave it pointing at state the tree never had.
   */
  const stateRef = useRef<ToolState>(state)
  useEffect(() => {
    stateRef.current = state
  })

  /** The latest callback, for the same bound-once handlers. */
  const onEventRef = useRef(onEvent)
  useEffect(() => {
    onEventRef.current = onEvent
  })

  /** From a ref, which increments synchronously, so two drops in one tick get two generations. */
  const generationRef = useRef(0)

  /**
   * Every URL a decode minted. A pending decode's URL is in no slot, so `revokeAll` alone would
   * leak it on an unmount before it lands. A landed one stays in the set too: deleting it before
   * the dispatch would leave a window where an unmount loses it from both.
   */
  const inFlightUrls = useRef<Set<string>>(new Set())

  useEffect(() => {
    const urls = inFlightUrls.current
    return () => {
      revokeAll(stateRef.current)
      for (const url of urls) URL.revokeObjectURL(url)
      urls.clear()
    }
  }, [])

  const decode = useCallback((file: File, slot: SlotId, source: LoadSource) => {
    generationRef.current += 1
    const generation = generationRef.current
    dispatch({ type: 'decode-started', slot, generation })

    const url = URL.createObjectURL(file)
    inFlightUrls.current.add(url)
    const probe = new Image()

    probe.onload = () => {
      dispatch({
        type: 'decode-succeeded',
        slot,
        generation,
        source,
        image: { url, name: file.name, width: probe.naturalWidth, height: probe.naturalHeight },
      })
    }
    // The decode is the ladder's backstop: a file the ladder could not judge is refused here.
    // Appended, so the ladder's refusals from the same drop stay on screen.
    probe.onerror = () => {
      inFlightUrls.current.delete(url)
      URL.revokeObjectURL(url)
      dispatch({ type: 'decode-failed', slot, generation })
      setNotices((current) => [
        ...current,
        {
          text: `${file.name} was not added. The file did not open as an image, so it may be damaged or saved in a format this browser cannot read.`,
          tone: 'warn',
        },
      ])
    }
    probe.src = url
  }, [])

  const takeFiles = useCallback(
    (files: File[], target: SlotId | null, source: LoadSource) => {
      if (files.length === 0) return

      const plan = planAssignment(files, stateRef.current, target)
      for (const { slot, file } of plan.assignments) decode(file, slot, source)

      // Each message only when its condition occurred: five valid files are not a fault.
      const rejection = rejectionMessage(plan.rejected)
      const overflow = overflowMessage(plan)
      setNotices([
        ...(rejection ? [{ text: rejection, tone: 'warn' as const }] : []),
        ...(overflow ? [{ text: overflow, tone: 'info' as const }] : []),
      ])
    },
    [decode],
  )

  /** A browser can refuse to read the clipboard, and that gets a named message, never silence. */
  const takePaste = useCallback(
    async (target: SlotId | null) => {
      try {
        const items = await navigator.clipboard.read()
        const files: File[] = []
        for (const item of items) {
          const type = item.types.find((t) => t.startsWith('image/'))
          if (!type) continue
          const blob = await item.getType(type)
          files.push(new File([blob], `pasted-image.${type.split('/')[1]}`, { type }))
        }
        if (files.length === 0) {
          setNotices([
            {
              text: 'There is no image on the clipboard. Copy an image, then paste it here.',
              tone: 'warn',
            },
          ])
          return
        }
        takeFiles(files, target, 'paste')
      } catch {
        setNotices([
          {
            text: 'This browser did not allow reading the clipboard. Use Choose a file instead, or allow clipboard access for this site and try again.',
            tone: 'warn',
          },
        ])
      }
    },
    [takeFiles],
  )

  /**
   * A file dropped outside a slot would make the browser navigate to it, and every loaded
   * candidate would be gone. The default `dragover` is what refuses a drop, so both are swallowed.
   */
  useEffect(() => {
    const swallow = (event: DragEvent) => event.preventDefault()
    window.addEventListener('dragover', swallow)
    window.addEventListener('drop', swallow)
    return () => {
      window.removeEventListener('dragover', swallow)
      window.removeEventListener('drop', swallow)
    }
  }, [])

  /** Ctrl+V anywhere on the page fills the first empty slot; a paste into a field is the field's. */
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      const files = [...(event.clipboardData?.files ?? [])]
      if (files.length === 0) return
      event.preventDefault()
      takeFiles(files, firstEmptySlot(stateRef.current), 'paste')
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [takeFiles])

  /**
   * `thumbnail_load`, drained from what the reducer recorded, from a cursor: `state.loads` is
   * append-only, so nothing replays on a re-render, and a three-file drop that lands in one commit
   * reports three loads.
   */
  const reportedLoads = useRef(0)
  useEffect(() => {
    for (const load of state.loads.slice(reportedLoads.current)) {
      onEventRef.current({
        name: 'thumbnail_load',
        properties: {
          slot: eventSlot(load.slot),
          mode: load.mode,
          detected: load.detected,
          source: load.source,
        },
      })
    }
    reportedLoads.current = state.loads.length
  }, [state.loads])

  const onTitleChange = useCallback((slot: SlotId, title: string) => {
    dispatch({ type: 'title-changed', slot, title })
  }, [])

  /**
   * `thumbnail_title_entered`, once per slot per page load, on the first blur with a title that is
   * not blank. Not cleared by Remove: the event asks whether the titles feature is used at all.
   */
  const titleReported = useRef<Set<SlotId>>(new Set())
  const onTitleCommit = useCallback((slot: SlotId, title: string) => {
    if (titleReported.current.has(slot) || title.trim() === '') return
    titleReported.current.add(slot)
    onEventRef.current({
      name: 'thumbnail_title_entered',
      properties: { slot: eventSlot(slot) },
    })
  }, [])

  const onRemove = useCallback((slot: SlotId) => {
    dispatch({ type: 'removed', slot })
    setNotices([])
  }, [])

  /**
   * The one path that switches the mode: the toolbar and every mismatch notice's action call it,
   * so the latch has one place to be written. The event fires on a real switch and the latch on
   * every press (`modeSwitchEvent`): the reducer writes `modeSource: 'selected'` even for the mode
   * already in force, since any use of the control ends detection.
   */
  const onModeChange = useCallback((mode: Mode) => {
    const event = modeSwitchEvent(stateRef.current.mode, mode)
    if (event) onEventRef.current(event)
    dispatch({ type: 'mode-selected', mode })
  }, [])

  const onPreviewChange = useCallback((preview: Preview) => {
    const event = grayscaleToggleEvent(stateRef.current.preview, preview)
    if (event) onEventRef.current(event)
    dispatch({ type: 'preview-selected', preview })
  }, [])

  // No event, unlike the handler above: the conversion choice is untracked (Nick, 2026-08-23).
  const onConversionChange = useCallback((conversion: Conversion) => {
    dispatch({ type: 'conversion-selected', conversion })
  }, [])

  // No event either: a new event name is a decision, not a side effect of a control (nlvogel.com),
  // and the spec names five.
  const onNewBadgeChange = useCallback((newBadge: NewBadgeVisibility) => {
    dispatch({ type: 'new-badge-selected', newBadge })
  }, [])

  const anyFilled = filledSlots(state).length > 0

  /**
   * The document listeners are bound in effects, so this marks the tool live, not just drawn: an
   * event dispatched before it would find no listener.
   */
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])

  /**
   * Keyboard focus survives the swap between the slots and the candidate bar: the swap removes
   * the focused control, and the browser would drop focus on the body. Focus moves only when the
   * focused element was removed, so a mouse user's focus never moves.
   */
  const rootRef = useRef<HTMLDivElement>(null)
  const lastFocused = useRef<HTMLElement | null>(null)
  const wasFilled = useRef(anyFilled)

  useLayoutEffect(() => {
    const swapped = wasFilled.current !== anyFilled
    wasFilled.current = anyFilled
    if (!swapped) return
    const removed = lastFocused.current
    if (!removed || removed.isConnected) return
    const region = rootRef.current?.querySelector(anyFilled ? '.t-candbar' : '.t-slots')
    region
      ?.querySelector<HTMLElement>(
        'button:not([tabindex="-1"]), [href], input:not([tabindex="-1"])',
      )
      ?.focus()
  }, [anyFilled])

  /**
   * Focus mode is component state, not reducer state: entering it changes DOM this component does
   * not own, and the reducer stays a pure function of its actions. The surface is separate state,
   * since it is resolved on entry and then belongs to the Background control. Neither outlives
   * focus mode: re-entering resolves the surface again.
   */
  const [inFocusMode, setInFocusMode] = useState(false)
  const [surface, setSurface] = useState<Surface>('light')

  const onEnterFocus = useCallback(() => {
    setSurface(resolveSurface())
    setInFocusMode(true)
  }, [])
  const onExitFocus = useCallback(() => setInFocusMode(false), [])
  const onSurfaceChange = useCallback((next: Surface) => setSurface(next), [])

  /**
   * The page half of focus mode, in one effect whose cleanup is the one undo for every exit: the
   * exit button, Escape and an unmount. A layout effect, so the page never paints one frame of the
   * stage inset in the page with the page still around it. Entry scrolls to the top, since the
   * button sits well down the page and the stage would otherwise open in its own middle;
   * `instant`, since this is not motion the creator asked for.
   */
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!inFocusMode || !root) return
    const leave = enterFocusStage(root)
    window.scrollTo({ top: 0, behavior: 'instant' })
    return leave
  }, [inFocusMode])

  /**
   * Focus moves to the stage on entry and back to "Focus mode" on exit. Not in the cleanup above:
   * "Focus mode" is not in the document until the render after the exit. A ref fires it on the
   * transition only, so StrictMode's double run does not pull focus back from where the creator
   * went. `preventScroll`, since the effect above already owns the scroll.
   */
  const focusMoved = useRef(false)
  useLayoutEffect(() => {
    if (inFocusMode === focusMoved.current) return
    focusMoved.current = inFocusMode
    if (inFocusMode) rootRef.current?.focus({ preventScroll: true })
    else rootRef.current?.querySelector<HTMLElement>('.t-toolbar__focus')?.focus()
  }, [inFocusMode])

  /**
   * `thumbnail_focus_toggle`, on the transition rather than in the handlers, so every exit path
   * reports once and a path added later cannot report nothing. Its own ref: two effects sharing
   * one would race, and the second would see no transition. `surface` is this render's, the
   * resolved one on the way in and the creator's last choice on the way out.
   */
  const focusReported = useRef(false)
  useEffect(() => {
    if (inFocusMode === focusReported.current) return
    focusReported.current = inFocusMode
    onEventRef.current({ name: 'thumbnail_focus_toggle', properties: { on: inFocusMode, surface } })
  }, [inFocusMode, surface])

  // Bound only in focus mode, so the tool never swallows Escape from the rest of the page.
  useEffect(() => {
    if (!inFocusMode) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setInFocusMode(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [inFocusMode])

  /**
   * The stuck bar's clearance, measured from the bar rendered, never modelled: on nlvogel.com
   * three modelled bounds each went short at a width or root font nobody had measured. While the
   * window less the bar still holds the tallest control the bar passes over, the bar pins and a
   * Tab scrolls each control clear of it by the bar's height; otherwise it unpins and the offset
   * is 0. Nothing sticks above the bar on the Stillstats site, whose header scrolls away. Re-run
   * on `inFocusMode`, since the swap mounts the other bar. Neither write resizes the bar or the
   * root, so the observer cannot loop: `scroll-margin-top` lays out nothing, and a sticky box
   * takes the same space as a static one.
   */
  useEffect(() => {
    const root = rootRef.current
    const bar = root?.querySelector<HTMLElement>(inFocusMode ? '.t-focusbar' : '.t-toolbar')
    if (!root || !bar) return

    const write = () => {
      const barHeight = bar.getBoundingClientRect().height
      let tallest = 0
      for (const focusable of root.querySelectorAll(CLEARED_FOCUSABLES)) {
        tallest = Math.max(tallest, focusable.getBoundingClientRect().height)
      }
      const pinned = document.documentElement.clientHeight - barHeight >= tallest
      root.dataset.barPinned = pinned ? 'true' : 'false'
      root.style.setProperty('--t-bar-clearance', pinned ? `${barHeight}px` : '0px')
    }

    write()
    const observer = new ResizeObserver(write)
    observer.observe(bar)
    observer.observe(root)
    window.addEventListener('resize', write)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', write)
    }
  }, [inFocusMode])

  const warned = notices.some((notice) => notice.tone === 'warn')

  return (
    <div
      // Luminance takes no class: its rule is the plain `grayscale(1)`. Each conversion class does
      // nothing without `t-toolroot--grey`, which stays the single gate.
      className={[
        't-toolroot',
        state.preview === 'grayscale' ? 't-toolroot--grey' : '',
        state.conversion === 'red' ? 't-toolroot--conv-red' : '',
        state.conversion === 'blue' ? 't-toolroot--conv-blue' : '',
        inFocusMode ? `t-focus t-focus--${surface}` : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-tool-ready={ready ? 'true' : undefined}
      onFocusCapture={(event) => {
        lastFocused.current = event.target as HTMLElement
      }}
      ref={rootRef}
      // The destination of focus mode's focus move, never a tab stop.
      tabIndex={-1}
    >
      <TitleFields
        titles={{ A: state.slots.A.title, B: state.slots.B.title, C: state.slots.C.title }}
        onTitleChange={onTitleChange}
        onTitleCommit={onTitleCommit}
      />

      {anyFilled ? (
        <CandidateBar state={state} onFiles={takeFiles} onPaste={takePaste} onRemove={onRemove} />
      ) : (
        <Slots onFiles={takeFiles} onPaste={takePaste} />
      )}

      {/* At the input, above the rails, where the outcome of the action just taken is seen. Always
          mounted with only its contents conditional: a live region that arrives holding its text
          is often read as part of the page, not announced. `status`, so it waits for a pause. */}
      <div
        className={
          notices.length === 0 ? 't-notice' : `t-notice t-notice--${warned ? 'warn' : 'info'}`
        }
        role="status"
      >
        {notices.length > 0 ? (
          <>
            {warned ? (
              <TriangleAlert size={18} aria-hidden="true" />
            ) : (
              <Info size={18} aria-hidden="true" />
            )}
            <div className="t-notice__body">
              {notices.map((notice, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: two files of one name that both fail write the same sentence, and the list is replaced whole, never reordered.
                <p key={`${index}-${notice.text}`}>{notice.text}</p>
              ))}
            </div>
          </>
        ) : null}
      </div>

      {/* One mismatch notice per filled slot whose image does not fit the mode. Plain content, not
          a live region: the region above reports the outcome of an action and clears, and these
          describe standing state for as long as the candidate is loaded. */}
      {SLOT_IDS.flatMap((id) => {
        const image = state.slots[id].image
        if (!image || !isMismatched(image, state.mode)) return []
        const notice = mismatchNotice(id, image, state.mode)
        return [
          <div className="t-notice t-notice--warn" data-mismatch={id} key={id}>
            <TriangleAlert size={18} aria-hidden="true" />
            <div className="t-notice__body">
              <p>
                <strong>{notice.headline}</strong> {notice.body}
              </p>
              <p>
                <button
                  className="t-button"
                  onClick={() => onModeChange(notice.targetMode)}
                  type="button"
                >
                  {notice.actionLabel}
                </button>
              </p>
            </div>
          </div>,
        ]
      })}

      <Toolbar
        mode={state.mode}
        modeWasDetected={state.modeSource === 'detected'}
        onModeChange={onModeChange}
        preview={state.preview}
        onPreviewChange={onPreviewChange}
        conversion={state.conversion}
        onConversionChange={onConversionChange}
        newBadge={state.newBadge}
        onNewBadgeChange={onNewBadgeChange}
        inFocusMode={inFocusMode}
        onEnterFocus={onEnterFocus}
        onExitFocus={onExitFocus}
        surface={surface}
        onSurfaceChange={onSurfaceChange}
      />

      <p className="t-hint">{ZOOM_NOTE}</p>

      <Rails state={state} />

      {/* The two conversion filters, once per document, on the root, which never unmounts, so the
          `url(#id)` references always resolve. The last child, since it is a definition, not
          content. `sRGB` is load-bearing: SVG's default linearRGB gives pixels the weights were
          never fitted to, with nothing wrong to read in the markup. */}
      <svg aria-hidden="true" className="t-filters" height="0" width="0">
        <filter colorInterpolationFilters="sRGB" id="conv-red">
          <feColorMatrix type="matrix" values={RED_MATRIX} />
        </filter>
        <filter colorInterpolationFilters="sRGB" id="conv-blue">
          <feColorMatrix type="matrix" values={BLUE_MATRIX} />
        </filter>
      </svg>
    </div>
  )
}
