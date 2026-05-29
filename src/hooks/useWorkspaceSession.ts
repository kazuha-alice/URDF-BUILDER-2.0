import { useEffect, useRef } from 'react'
import { electronBridge, type WorkspaceSession } from '../lib/electron'
import { useProjectStore } from '../store/useProjectStore'
import { useWorkspaceStore, type DockPanelId, type PanelState } from '../store/useWorkspaceStore'

type PersistedPanelLayout = {
  panels?: Partial<Record<DockPanelId, PanelState>>
  leftWidth?: number
  rightWidth?: number
  bottomHeight?: number
  leftCollapsed?: boolean
  rightCollapsed?: boolean
  bottomCollapsed?: boolean
  activeLeftTab?: unknown
  activeRightTab?: unknown
  activeBottomTab?: unknown
  maximizedPanel?: DockPanelId | null
}

function isDetachedPanelRoute() {
  const hashRoute = window.location.hash.replace(/^#\/?/, '')

  return hashRoute.startsWith('panel/') || new URLSearchParams(window.location.search).has('panel')
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object')
}

function isPersistedPanelLayout(value: unknown): value is PersistedPanelLayout {
  return isObject(value)
}

function applyPanelLayout(layout: unknown) {
  if (!isPersistedPanelLayout(layout)) {
    return
  }

  const workspace = useWorkspaceStore.getState()
  const panels = layout.panels ? { ...workspace.panels, ...layout.panels } : workspace.panels

  useWorkspaceStore.setState({
    panels,
    leftWidth: typeof layout.leftWidth === 'number' ? layout.leftWidth : workspace.leftWidth,
    rightWidth: typeof layout.rightWidth === 'number' ? layout.rightWidth : workspace.rightWidth,
    bottomHeight: typeof layout.bottomHeight === 'number' ? layout.bottomHeight : workspace.bottomHeight,
    leftCollapsed:
      typeof layout.leftCollapsed === 'boolean' ? layout.leftCollapsed : workspace.leftCollapsed,
    rightCollapsed:
      typeof layout.rightCollapsed === 'boolean' ? layout.rightCollapsed : workspace.rightCollapsed,
    bottomCollapsed:
      typeof layout.bottomCollapsed === 'boolean' ? layout.bottomCollapsed : workspace.bottomCollapsed,
    activeLeftTab:
      layout.activeLeftTab === 'explorer' || layout.activeLeftTab === 'hierarchy'
        ? layout.activeLeftTab
        : workspace.activeLeftTab,
    activeRightTab:
      layout.activeRightTab === 'inspector' ||
      layout.activeRightTab === 'diagnostics' ||
      layout.activeRightTab === 'tfGraph'
        ? layout.activeRightTab
        : workspace.activeRightTab,
    activeBottomTab:
      layout.activeBottomTab === 'editor' ||
      layout.activeBottomTab === 'controller' ||
      layout.activeBottomTab === 'console'
        ? layout.activeBottomTab
        : workspace.activeBottomTab,
    maximizedPanel:
      layout.maximizedPanel && panels[layout.maximizedPanel]
        ? layout.maximizedPanel
        : workspace.maximizedPanel,
  })
}

function buildPanelLayout(): PersistedPanelLayout {
  const workspace = useWorkspaceStore.getState()

  return {
    panels: workspace.panels,
    leftWidth: workspace.leftWidth,
    rightWidth: workspace.rightWidth,
    bottomHeight: workspace.bottomHeight,
    leftCollapsed: workspace.leftCollapsed,
    rightCollapsed: workspace.rightCollapsed,
    bottomCollapsed: workspace.bottomCollapsed,
    activeLeftTab: workspace.activeLeftTab,
    activeRightTab: workspace.activeRightTab,
    activeBottomTab: workspace.activeBottomTab,
    maximizedPanel: workspace.maximizedPanel,
  }
}

function buildWorkspaceSession(): WorkspaceSession {
  const project = useProjectStore.getState()
  const document = project.document

  return {
    activeFilePath: document.filePath,
    activeFileName: document.fileName,
    documentContent: document.xml,
    isDirty: document.dirty || document.isDirty,
    isUntitled: document.isUntitled,
    robotModelSnapshot: project.robot,
    selectedObjectId: project.selection.id || null,
    selectedObjectKind: project.selection.kind,
    controllerState: project.controllerState,
    panelLayout: buildPanelLayout(),
    projectDir: document.projectDir,
    projectRoot: project.projectRoot,
    projectFiles: project.projectFiles,
    cameraMode: project.cameraMode,
    viewPreset: project.viewPreset,
    lastSavedAt: Date.now(),
  }
}

export function useWorkspaceSession() {
  const saveTimerRef = useRef<number | undefined>(undefined)
  const saveEnabledRef = useRef(false)
  const savingRef = useRef(false)

  useEffect(() => {
    const api = electronBridge()
    const panelWindow = isDetachedPanelRoute()

    if (!api || panelWindow) {
      if (!panelWindow) {
        useProjectStore.getState().markSessionReady()
      }

      return undefined
    }

    const saveNow = () => {
      if (!saveEnabledRef.current || savingRef.current) {
        return
      }

      if (useProjectStore.getState().appView === 'dashboard') {
        return
      }

      savingRef.current = true
      void api.saveWorkspaceSession(buildWorkspaceSession()).finally(() => {
        savingRef.current = false
      })
    }

    const scheduleSave = () => {
      if (!saveEnabledRef.current) {
        return
      }

      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = window.setTimeout(saveNow, 220)
    }

    let disposed = false

    void api.loadWorkspaceSession().then((session) => {
      if (disposed) {
        return
      }

      if (session) {
        applyPanelLayout(session.panelLayout)
        useProjectStore.getState().setPendingWorkspaceSession(session)
        useProjectStore.getState().markSessionReady()
      } else {
        useProjectStore.getState().markSessionReady()
      }

      saveEnabledRef.current = true
      scheduleSave()
    })

    const unsubscribeProject = useProjectStore.subscribe(() => scheduleSave())
    const unsubscribeWorkspace = useWorkspaceStore.subscribe(() => scheduleSave())
    const removeFlushListener = api.onWorkspaceSessionFlush(saveNow)

    window.addEventListener('beforeunload', saveNow)
    document.addEventListener('visibilitychange', saveNow)

    return () => {
      disposed = true
      window.clearTimeout(saveTimerRef.current)
      saveNow()
      unsubscribeProject()
      unsubscribeWorkspace()
      removeFlushListener()
      window.removeEventListener('beforeunload', saveNow)
      document.removeEventListener('visibilitychange', saveNow)
    }
  }, [])
}
