import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsDownUp,
  Maximize2,
  PanelTopClose,
  Pin,
  ScreenShare,
  X,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { DockPanelId } from '../store/useWorkspaceStore'
import { useWorkspaceStore } from '../store/useWorkspaceStore'
import { IconButton } from './IconButton'

interface DockTab<T extends string> {
  id: T
  label: string
  icon?: ReactNode
}

interface DockPanelProps<T extends string> {
  panelId: DockPanelId
  title: string
  tabs?: DockTab<T>[]
  activeTab?: T
  onTabChange?: (tab: T) => void
  children: ReactNode
  collapsed?: boolean
  collapseSide?: 'left' | 'right' | 'bottom'
  onCollapse?: () => void
  onDetach?: () => void
  onClosePanel?: () => void
  className?: string
}

function CollapseIcon({ side }: { side?: 'left' | 'right' | 'bottom' }) {
  if (side === 'left') {
    return <ChevronLeft size={14} />
  }

  if (side === 'right') {
    return <ChevronRight size={14} />
  }

  return <ChevronDown size={14} />
}

export function DockPanel<T extends string>({
  panelId,
  title,
  tabs,
  activeTab,
  onTabChange,
  children,
  collapsed = false,
  collapseSide,
  onCollapse,
  onDetach,
  onClosePanel,
  className = '',
}: DockPanelProps<T>) {
  const maximizedPanel = useWorkspaceStore((state) => state.maximizedPanel)
  const maximizePanel = useWorkspaceStore((state) => state.maximizePanel)
  const restorePanel = useWorkspaceStore((state) => state.restorePanel)
  const isMaximized = maximizedPanel === panelId

  if (collapsed) {
    return (
      <section className={`dock-panel is-collapsed ${className}`}>
        <button type="button" className="dock-collapsed-button" onClick={onCollapse}>
          <PanelTopClose size={15} />
          <span>{title}</span>
        </button>
      </section>
    )
  }

  return (
    <section className={`dock-panel ${className}`}>
      <div className="dock-titlebar">
        <div className="dock-tabs" role="tablist" aria-label={title}>
          {tabs?.length ? (
            tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`dock-tab ${activeTab === tab.id ? 'is-active' : ''}`}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData('application/x-urdf-panel', tab.id)
                }}
                onClick={() => onTabChange?.(tab.id)}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))
          ) : (
            <div
              className="dock-tab is-active"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData('application/x-urdf-panel', panelId)
              }}
            >
              <Pin size={13} />
              <span>{title}</span>
            </div>
          )}
        </div>

        <div className="dock-actions">
          {onCollapse ? (
            <IconButton icon={<CollapseIcon side={collapseSide} />} label={`Collapse ${title}`} onClick={onCollapse} />
          ) : null}
          {onDetach ? (
            <IconButton icon={<ScreenShare size={14} />} label={`Move ${title} to New Window`} onClick={onDetach} />
          ) : null}
          <IconButton
            icon={isMaximized ? <ChevronsDownUp size={14} /> : <Maximize2 size={14} />}
            label={isMaximized ? 'Restore Panel' : `Maximize ${title}`}
            onClick={() => (isMaximized ? restorePanel() : maximizePanel(panelId))}
          />
          {onClosePanel ? (
            <IconButton icon={<X size={14} />} label={`Close ${title}`} onClick={onClosePanel} />
          ) : null}
          {isMaximized ? (
            <IconButton icon={<X size={14} />} label="Close Maximized View" onClick={() => restorePanel()} />
          ) : null}
        </div>
      </div>
      <div className="dock-content">{children}</div>
    </section>
  )
}
