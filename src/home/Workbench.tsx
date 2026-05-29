/* @refresh reset */
import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  FolderTree,
  Gauge,
  GitBranch,
  ListTree,
  PanelRight,
  List,
  Terminal,
  TriangleAlert,
  History,
} from 'lucide-react'
import { useEffect, useMemo, useState, type CSSProperties, type DragEvent, type MouseEvent } from 'react'
import { ContextMenu, type ContextMenuItem } from '../components/ContextMenu'
import { DockPanel } from '../components/DockPanel'
import { Splitter } from '../components/Splitter'
import { useFileCommands } from '../hooks/useFileCommands'
import { useProjectBroadcast } from '../hooks/useProjectBroadcast'
import { useWorkspaceBroadcast } from '../hooks/useWorkspaceBroadcast'
import { useWorkspaceSession } from '../hooks/useWorkspaceSession'
import { useUrdfSyncPipeline } from '../hooks/useUrdfSyncPipeline'
import { ConsolePanel } from '../renderer/console/ConsolePanel'
import { ControllerErrorBoundary } from '../renderer/controller/ControllerErrorBoundary'
import { ControllerPanel } from '../renderer/controller/ControllerPanel'
import { DiagnosticsPanel } from '../renderer/diagnostics/DiagnosticsPanel'
import { UrdfEditor } from '../renderer/editor/UrdfEditor'
import { FileExplorer } from '../renderer/explorer/FileExplorer'
import { RobotHierarchy } from '../renderer/explorer/RobotHierarchy'
import { InspectorPanel } from '../renderer/inspector/InspectorPanel'
import { UrdfOutlinePanel } from '../renderer/outline/UrdfOutlinePanel'
import { Ribbon } from '../renderer/ribbon/Ribbon'
import { TfGraphPanel } from '../renderer/tf/TfGraphPanel'
import { TimelinePanel } from '../renderer/timeline/TimelinePanel'
import { RobotViewport } from '../renderer/viewport/RobotViewport'
import { StartupDashboard } from './StartupDashboard'
import { useProjectStore } from '../store/useProjectStore'
import {
  useWorkspaceStore,
  panelTitles,
  panelIds,
  type BottomDockTab,
  type DockPanelId,
  type LeftDockTab,
  type PanelState,
  type RightDockTab,
} from '../store/useWorkspaceStore'

const leftTabs = [
  { id: 'explorer' as LeftDockTab, label: 'Explorer', icon: <FolderTree size={14} /> },
  { id: 'hierarchy' as LeftDockTab, label: 'Hierarchy', icon: <ListTree size={14} /> },
]

const rightTabs = [
  { id: 'inspector' as RightDockTab, label: 'Inspector', icon: <PanelRight size={14} /> },
  { id: 'outline' as RightDockTab, label: 'Outline', icon: <List size={14} /> },
  { id: 'diagnostics' as RightDockTab, label: 'Diagnostics', icon: <TriangleAlert size={14} /> },
  { id: 'tfGraph' as RightDockTab, label: 'TF View', icon: <GitBranch size={14} /> },
  { id: 'timeline' as RightDockTab, label: 'Timeline', icon: <History size={14} /> },
]

const bottomTabs = [
  { id: 'editor' as BottomDockTab, label: 'Editor', icon: <Code2 size={14} /> },
  { id: 'controller' as BottomDockTab, label: 'Controller', icon: <Gauge size={14} /> },
  { id: 'console' as BottomDockTab, label: 'Console', icon: <Terminal size={14} /> },
]

function getDraggedPanel(event: DragEvent) {
  return event.dataTransfer.getData('application/x-urdf-panel') as DockPanelId | ''
}

function isPanelInMainLayout(panel?: PanelState) {
  return Boolean(panel?.isVisible && (panel.placement === 'docked' || panel.placement === 'floating'))
}

function getDetachedPanelRoute() {
  const hashRoute = window.location.hash.replace(/^#\/?/, '')

  if (hashRoute.startsWith('panel/')) {
    return hashRoute.replace('panel/', '') as DockPanelId
  }

  return new URLSearchParams(window.location.search).get('panel') as DockPanelId | null
}

export function Workbench() {
  useWorkspaceSession()
  useProjectBroadcast()
  useWorkspaceBroadcast()
  useUrdfSyncPipeline()

  const commands = useFileCommands()
  const appView = useProjectStore((state) => state.appView)
  const document = useProjectStore((state) => state.document)
  const diagnostics = useProjectStore((state) => state.diagnostics)
  const saveNotice = useProjectStore((state) => state.saveNotice)
  const panels = useWorkspaceStore((state) => state.panels)
  const leftWidth = useWorkspaceStore((state) => state.leftWidth)
  const rightWidth = useWorkspaceStore((state) => state.rightWidth)
  const bottomHeight = useWorkspaceStore((state) => state.bottomHeight)
  const leftCollapsed = useWorkspaceStore((state) => state.leftCollapsed)
  const rightCollapsed = useWorkspaceStore((state) => state.rightCollapsed)
  const bottomCollapsed = useWorkspaceStore((state) => state.bottomCollapsed)
  const activeLeftTab = useWorkspaceStore((state) => state.activeLeftTab)
  const activeRightTab = useWorkspaceStore((state) => state.activeRightTab)
  const activeBottomTab = useWorkspaceStore((state) => state.activeBottomTab)
  const maximizedPanel = useWorkspaceStore((state) => state.maximizedPanel)
  const setLeftWidth = useWorkspaceStore((state) => state.setLeftWidth)
  const setRightWidth = useWorkspaceStore((state) => state.setRightWidth)
  const setBottomHeight = useWorkspaceStore((state) => state.setBottomHeight)
  const setActiveLeftTab = useWorkspaceStore((state) => state.setActiveLeftTab)
  const setActiveRightTab = useWorkspaceStore((state) => state.setActiveRightTab)
  const setActiveBottomTab = useWorkspaceStore((state) => state.setActiveBottomTab)
  const toggleLeftCollapsed = useWorkspaceStore((state) => state.toggleLeftCollapsed)
  const toggleRightCollapsed = useWorkspaceStore((state) => state.toggleRightCollapsed)
  const toggleBottomCollapsed = useWorkspaceStore((state) => state.toggleBottomCollapsed)
  const dockPanel = useWorkspaceStore((state) => state.dockPanel)
  const restorePanel = useWorkspaceStore((state) => state.restorePanel)
  const panelParam = getDetachedPanelRoute()
  const errorCount = diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length
  const warningCount = diagnostics.filter((diagnostic) => diagnostic.severity === 'warning').length
  const hiddenPanelItems = useMemo<ContextMenuItem[]>(
    () =>
      panelIds
        .filter((panelId) => !panels[panelId]?.isVisible || panels[panelId]?.placement === 'hidden')
        .map((panelId) => ({
          id: `show-${panelId}`,
          label: `Show ${panelTitles[panelId]}`,
          onSelect: () => {
            void commands.restorePanel(panelId)
          },
        })),
    [commands, panels],
  )
  const [workspaceMenu, setWorkspaceMenu] = useState<{
    x: number
    y: number
    items: ContextMenuItem[]
  } | null>(null)
  const visibleLeftTabs = leftTabs.filter((tab) => isPanelInMainLayout(panels[tab.id]))
  const visibleRightTabs = rightTabs.filter((tab) => isPanelInMainLayout(panels[tab.id]))
  const visibleBottomTabs = bottomTabs.filter((tab) => isPanelInMainLayout(panels[tab.id]))
  const leftDockVisible = visibleLeftTabs.length > 0
  const rightDockVisible = visibleRightTabs.length > 0
  const bottomDockVisible = visibleBottomTabs.length > 0
  const viewportVisible = isPanelInMainLayout(panels.viewport)
  const resolvedLeftTab = visibleLeftTabs.some((tab) => tab.id === activeLeftTab)
    ? activeLeftTab
    : visibleLeftTabs[0]?.id
  const resolvedRightTab = visibleRightTabs.some((tab) => tab.id === activeRightTab)
    ? activeRightTab
    : visibleRightTabs[0]?.id
  const resolvedBottomTab = visibleBottomTabs.some((tab) => tab.id === activeBottomTab)
    ? activeBottomTab
    : visibleBottomTabs[0]?.id

  useEffect(() => {
    if (maximizedPanel && !isPanelInMainLayout(panels[maximizedPanel])) {
      restorePanel()
    }
  }, [maximizedPanel, panels, restorePanel])

  function detachPanel(panel: DockPanelId) {
    void commands.detachPanel(panel)
  }

  function panelContent(panel: DockPanelId) {
    switch (panel) {
      case 'explorer':
        return <FileExplorer commands={commands} />
      case 'hierarchy':
        return <RobotHierarchy />
      case 'inspector':
        return <InspectorPanel />
      case 'outline':
        return <UrdfOutlinePanel />
      case 'diagnostics':
        return <DiagnosticsPanel />
      case 'tfGraph':
        return <TfGraphPanel />
      case 'timeline':
        return <TimelinePanel />
      case 'controller':
        return (
          <ControllerErrorBoundary>
            <ControllerPanel />
          </ControllerErrorBoundary>
        )
      case 'console':
        return <ConsolePanel />
      case 'editor':
        return <UrdfEditor commands={commands} />
      case 'viewport':
      default:
        return <RobotViewport />
    }
  }

  function handleDockDrop(event: DragEvent, dock: 'left' | 'right' | 'bottom') {
    event.preventDefault()
    const panel = getDraggedPanel(event)

    if (!panel) {
      return
    }

    if (dock === 'left' && (panel === 'explorer' || panel === 'hierarchy')) {
      dockPanel(panel)
      setActiveLeftTab(panel)
    }

    if (
      dock === 'right' &&
      (panel === 'inspector' ||
        panel === 'diagnostics' ||
        panel === 'outline' ||
        panel === 'tfGraph' ||
        panel === 'timeline')
    ) {
      dockPanel(panel)
      setActiveRightTab(panel)
    }

    if (dock === 'bottom' && (panel === 'editor' || panel === 'controller' || panel === 'console')) {
      dockPanel(panel)
      setActiveBottomTab(panel)
    }
  }

  function openWorkspaceContextMenu(event: MouseEvent<HTMLElement>) {
    const target = event.target instanceof HTMLElement ? event.target : null

    if (target?.closest('.dock-panel, .splitter, .app-ribbon, .status-bar, .context-menu')) {
      return
    }

    event.preventDefault()
    setWorkspaceMenu({
      x: event.clientX,
      y: event.clientY,
      items: hiddenPanelItems.length
        ? [
            ...hiddenPanelItems,
            {
              id: 'reset-layout',
              label: 'Restore Default Layout',
              onSelect: () => {
                void commands.resetLayout()
              },
            },
          ]
        : [
            {
              id: 'reset-layout',
              label: 'Restore Default Layout',
              onSelect: () => {
                void commands.resetLayout()
              },
            },
          ],
    })
  }

  const layoutStyle = {
    '--left-width': `${!leftDockVisible ? 0 : leftCollapsed ? 48 : leftWidth}px`,
    '--right-width': `${!rightDockVisible ? 0 : rightCollapsed ? 48 : rightWidth}px`,
    '--bottom-height': `${!bottomDockVisible ? 0 : bottomCollapsed ? 46 : bottomHeight}px`,
  } as CSSProperties

  if (panelParam) {
    return (
      <div className="workbench detached-panel-mode">
        <Ribbon
          commands={commands}
          detachedPanelId={panelParam}
          detachedPanelTitle={panelTitles[panelParam]}
        />
        <main className="detached-editor-layout">
          <DockPanel panelId={panelParam} title={panelTitles[panelParam]}>
            {panelContent(panelParam)}
          </DockPanel>
        </main>
      </div>
    )
  }

  if (appView === 'dashboard') {
    return (
      <div className="workbench dashboard-mode">
        <Ribbon commands={commands} />
        <StartupDashboard commands={commands} />
      </div>
    )
  }

  if (maximizedPanel) {
    if (!isPanelInMainLayout(panels[maximizedPanel])) {
      return null
    }

    return (
      <div className="workbench">
        <Ribbon commands={commands} />
        <main className="maximized-workspace">
          <DockPanel
            panelId={maximizedPanel}
            title={panelTitles[maximizedPanel]}
            onDetach={() => detachPanel(maximizedPanel)}
            onClosePanel={() => commands.closePanel(maximizedPanel)}
          >
            {panelContent(maximizedPanel)}
          </DockPanel>
        </main>
        <StatusBar
          errorCount={errorCount}
          warningCount={warningCount}
          dirty={document.dirty || document.isDirty || document.isUntitled}
          path={document.filePath ?? document.fileName}
          saveNotice={saveNotice}
        />
      </div>
    )
  }

  return (
    <div className="workbench" style={layoutStyle} onContextMenu={openWorkspaceContextMenu}>
      <Ribbon commands={commands} />
      <main className="workbench-grid">
        {leftDockVisible && resolvedLeftTab ? (
          <div
            className="dock-zone left-dock"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => handleDockDrop(event, 'left')}
          >
            <DockPanel
              panelId={resolvedLeftTab}
              title="Navigation"
              tabs={visibleLeftTabs}
              activeTab={resolvedLeftTab}
              onTabChange={setActiveLeftTab}
              collapsed={leftCollapsed}
              collapseSide="left"
              onCollapse={toggleLeftCollapsed}
              onDetach={() => detachPanel(resolvedLeftTab)}
              onClosePanel={() => commands.closePanel(resolvedLeftTab)}
            >
              {panelContent(resolvedLeftTab)}
            </DockPanel>
          </div>
        ) : (
          <div />
        )}

        {leftDockVisible ? (
          <Splitter
            orientation="vertical"
            value={leftCollapsed ? 48 : leftWidth}
            onResize={setLeftWidth}
          />
        ) : (
          <div />
        )}

        <div className="center-stack">
          {viewportVisible ? (
            <DockPanel
              panelId="viewport"
              title="Viewport"
              onDetach={() => detachPanel('viewport')}
              onClosePanel={() => commands.closePanel('viewport')}
            >
              <RobotViewport />
            </DockPanel>
          ) : (
            <DetachedPanelPlaceholder panelId="viewport" commands={commands} />
          )}
          {bottomDockVisible ? (
            <Splitter
              orientation="horizontal"
              reverse
              value={bottomCollapsed ? 46 : bottomHeight}
              onResize={setBottomHeight}
            />
          ) : (
            <div />
          )}
          {bottomDockVisible && resolvedBottomTab ? (
            <div
              className="dock-zone bottom-dock"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleDockDrop(event, 'bottom')}
            >
              <DockPanel
                panelId={resolvedBottomTab}
                title="Work Area"
                tabs={visibleBottomTabs}
                activeTab={resolvedBottomTab}
                onTabChange={setActiveBottomTab}
                collapsed={bottomCollapsed}
                collapseSide="bottom"
                onCollapse={toggleBottomCollapsed}
                onDetach={() => detachPanel(resolvedBottomTab)}
                onClosePanel={() => commands.closePanel(resolvedBottomTab)}
              >
                {panelContent(resolvedBottomTab)}
              </DockPanel>
            </div>
          ) : (
            <div />
          )}
        </div>

        {rightDockVisible ? (
          <Splitter
            orientation="vertical"
            reverse
            value={rightCollapsed ? 48 : rightWidth}
            onResize={setRightWidth}
          />
        ) : (
          <div />
        )}

        {rightDockVisible && resolvedRightTab ? (
          <div
            className="dock-zone right-dock"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => handleDockDrop(event, 'right')}
          >
            <DockPanel
              panelId={resolvedRightTab}
              title="Properties"
              tabs={visibleRightTabs}
              activeTab={resolvedRightTab}
              onTabChange={setActiveRightTab}
              collapsed={rightCollapsed}
              collapseSide="right"
              onCollapse={toggleRightCollapsed}
              onDetach={() => detachPanel(resolvedRightTab)}
              onClosePanel={() => commands.closePanel(resolvedRightTab)}
            >
              {panelContent(resolvedRightTab)}
            </DockPanel>
          </div>
        ) : (
          <div />
        )}
      </main>
      <StatusBar
        errorCount={errorCount}
        warningCount={warningCount}
        dirty={document.dirty || document.isDirty || document.isUntitled}
        path={document.filePath ?? document.fileName}
        saveNotice={saveNotice}
      />
      {workspaceMenu ? (
        <ContextMenu
          x={workspaceMenu.x}
          y={workspaceMenu.y}
          debugSource="workspace"
          title="Workspace"
          items={workspaceMenu.items}
          onClose={() => setWorkspaceMenu(null)}
        />
      ) : null}
    </div>
  )
}

function DetachedPanelPlaceholder({
  panelId,
  commands,
}: {
  panelId: DockPanelId
  commands: ReturnType<typeof useFileCommands>
}) {
  return (
    <section className="detached-panel-placeholder">
      <div>
        <strong>{panelTitles[panelId]}</strong>
        <span>Panel is outside the main workspace.</span>
      </div>
      <button type="button" onClick={() => void commands.dockPanelBack(panelId)}>
        Dock Back
      </button>
    </section>
  )
}

function StatusBar({
  errorCount,
  warningCount,
  dirty,
  path,
  saveNotice,
}: {
  errorCount: number
  warningCount: number
  dirty: boolean
  path: string
  saveNotice: ReturnType<typeof useProjectStore.getState>['saveNotice']
}) {
  const saveTime = saveNotice
    ? new Intl.DateTimeFormat(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(saveNotice.savedAt)
    : null

  return (
    <footer className="status-bar">
      <div className="status-item">
        {errorCount ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
        <span>
          {errorCount} errors, {warningCount} warnings
        </span>
      </div>
      <div
        key={saveNotice?.savedAt ?? 'save-state'}
        className={`status-item save-status ${!dirty && saveNotice ? 'is-saved-flash' : ''}`}
      >
        {!dirty && saveNotice ? (
          <>
            <CheckCircle2 size={14} />
            <span>
              {saveNotice.message}
              {saveTime ? ` at ${saveTime}` : ''}
            </span>
          </>
        ) : (
          <span>{dirty ? 'Unsaved changes' : 'Saved'}</span>
        )}
      </div>
      <div className="status-item">{path}</div>
    </footer>
  )
}
