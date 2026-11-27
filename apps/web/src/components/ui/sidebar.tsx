import { mergeProps } from '@base-ui/react/merge-props'
import { useRender } from '@base-ui/react/use-render'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import * as React from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { sidebarColumnQuery } from '../../sidebar-column.ts'

// shadcn's Sidebar, cut down to the parts the app's sidebar uses and restyled in the visual system
// (ADR 0014 rule 2). From `sidebarColumnQuery` it is shadcn's fixed panel, at the window's left
// edge and its full height, with a header, a content and a footer, and it collapses to a column of
// icons only (`collapsible="icon"`); below it, the sidebar renders nothing and the header's Menu
// holds its links (creator-analytics#891), and nothing reads the collapsed state. The widths, the
// panel's place and the collapsed column's look are app.css's, so the provider writes no inline
// style, and the screen beside the panel is app.css's offset, not shadcn's gap element or its
// SidebarInset, a block's page layout (rule 2).
// Taken out (creator-analytics#417): the open state is the app's saved preference, so the provider
// is controlled only and writes no `sidebar_state` cookie; no Ctrl+B or Cmd+B shortcut; no Sheet
// drawer, as the header's Menu holds the links outside the column; no rail, a second toggle with no
// name of its own; and shadcn's colours, radius, shadows, rings, and every transition. The input,
// separator, skeleton, group, action, badge and sub-menu parts are not kept: Tailwind's source scan
// would emit their classes, and a later use copies them again, restyled.
type SidebarContextProps = {
  state: 'expanded' | 'collapsed'
  open: boolean
  /** Whether the sidebar is the column it is from `sidebarColumnQuery`, shadcn's `!isMobile`. */
  column: boolean
  toggleSidebar: () => void
}

function subscribeToViewport(onChange: () => void): () => void {
  const query = window.matchMedia(sidebarColumnQuery)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

/**
 * Whether the window is wide and tall enough for the sidebar's column, shadcn's `useIsMobile`
 * turned round.
 */
function useSidebarColumn(): boolean {
  return React.useSyncExternalStore(
    subscribeToViewport,
    () => window.matchMedia(sidebarColumnQuery).matches,
    // No server renders the app, and no test renders the sidebar on one: below the column.
    () => false,
  )
}

const SidebarContext = React.createContext<SidebarContextProps | null>(null)

function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider.')
  }
  return context
}

function SidebarProvider({
  open,
  onOpenChange,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const column = useSidebarColumn()
  const contextValue = React.useMemo<SidebarContextProps>(
    () => ({
      state: column && !open ? 'collapsed' : 'expanded',
      open,
      column,
      toggleSidebar: () => onOpenChange(!open),
    }),
    [open, column, onOpenChange],
  )

  return (
    <SidebarContext.Provider value={contextValue}>
      <TooltipProvider>
        <div data-slot="sidebar-wrapper" {...props}>
          {children}
        </div>
      </TooltipProvider>
    </SidebarContext.Provider>
  )
}

/** The sidebar's panel, which names its open state for app.css. */
function Sidebar({ ...props }: React.ComponentProps<'div'>) {
  const { state } = useSidebar()
  return (
    <div
      data-slot="sidebar"
      data-state={state}
      data-collapsible={state === 'collapsed' ? 'icon' : ''}
      {...props}
    />
  )
}

function SidebarHeader({ ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="sidebar-header" data-sidebar="header" {...props} />
}

/** The part between the header and the footer, which app.css stretches to push the footer down. */
function SidebarContent({ ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="sidebar-content" data-sidebar="content" {...props} />
}

function SidebarFooter({ ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="sidebar-footer" data-sidebar="footer" {...props} />
}

function SidebarMenu({ ...props }: React.ComponentProps<'ul'>) {
  return <ul data-slot="sidebar-menu" data-sidebar="menu" {...props} />
}

function SidebarMenuItem({ ...props }: React.ComponentProps<'li'>) {
  return <li data-slot="sidebar-menu-item" data-sidebar="menu-item" {...props} />
}

/**
 * A link or button of the menu, its icon before its text. With `tooltip`, collapsed, a hover or a
 * focus shows the text beside the icon, which app.css hides from view but keeps as the accessible
 * name; open, the tooltip is off, as the text is on view. It keeps its line's height when the text
 * leaves, so the collapsed icons sit where the open links do.
 */
function SidebarMenuButton({
  render,
  tooltip,
  className,
  ...props
}: useRender.ComponentProps<'button'> &
  React.ComponentProps<'button'> & {
    tooltip?: string
  }) {
  const { state } = useSidebar()
  const comp = useRender({
    defaultTagName: 'button',
    props: mergeProps<'button'>(
      {
        className: cn(
          'flex min-h-[1lh] items-center gap-2 [&_svg]:size-4 [&_svg]:shrink-0',
          className,
        ),
      },
      props,
    ),
    render: tooltip === undefined ? render : <TooltipTrigger render={render} />,
    state: {
      slot: 'sidebar-menu-button',
      sidebar: 'menu-button',
    },
  })

  if (tooltip === undefined) return comp

  return (
    <Tooltip disabled={state !== 'collapsed'}>
      {comp}
      <TooltipContent side="right" align="center" className="max-md:hidden">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * The toggle, a button of the menu: its icon says the change a press makes, and `label`, which the
 * caller gives, says it in words, as its visible text open and as its name and tooltip collapsed,
 * where the text leaves the view, so the name is the text either way (WCAG 2.5.3). The caller
 * renders it in the column only.
 */
function SidebarTrigger({
  label,
  className,
  onClick,
  ...props
}: React.ComponentProps<'button'> & { label: string }) {
  const { open, toggleSidebar } = useSidebar()
  const Icon = open ? PanelLeftClose : PanelLeftOpen

  return (
    <SidebarMenuButton
      type="button"
      tooltip={label}
      className={cn(
        'w-full cursor-pointer border-0 text-muted-foreground [background:0_0] [&:hover]:text-foreground',
        className,
      )}
      onClick={(event) => {
        onClick?.(event)
        toggleSidebar()
      }}
      {...props}
    >
      <Icon aria-hidden="true" />
      <span>{label}</span>
    </SidebarMenuButton>
  )
}

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
  useSidebarColumn,
}
