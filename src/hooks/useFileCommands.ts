import { useCallback, useEffect } from 'react'
import { DEFAULT_URDF_FILENAME } from '../core/urdf/defaultUrdf'
import { electronBridge, type OpenUrdfResult } from '../lib/electron'
import { useEditorStore } from '../store/useEditorStore'
import { useHistoryStore } from '../store/useHistoryStore'
import { useProjectStore } from '../store/useProjectStore'
import { useWorkspaceStore, type DockPanelId } from '../store/useWorkspaceStore'

function hasUnsavedChanges() {
  const { document } = useProjectStore.getState()

  return document.dirty || document.isDirty
}

function isFileInsideWorkspace(filePath: string | null | undefined, rootPath: string | null | undefined) {
  if (!filePath || !rootPath) {
    return false
  }

  const normalizedFile = filePath.replace(/\//g, '\\').toLowerCase()
  const normalizedRoot = rootPath.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase()

  return normalizedFile === normalizedRoot || normalizedFile.startsWith(`${normalizedRoot}\\`)
}

function isNativeUndoTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return Boolean(
    target.closest('input, textarea, select, [contenteditable="true"], .monaco-editor'),
  )
}

async function refreshProjectFilesForDocument(filePath?: string | null, workspaceRoot?: string | null) {
  const api = electronBridge()
  const { setProjectFiles } = useProjectStore.getState()

  if (!api || !workspaceRoot || !isFileInsideWorkspace(filePath, workspaceRoot)) {
    setProjectFiles(null, [])
    return
  }

  const result = await api.listDirectory(workspaceRoot)
  useProjectStore.getState().setProjectFiles(result.rootPath, result.files)
}

export function useFileCommands() {
  const document = useProjectStore((state) => state.document)
  const appView = useProjectStore((state) => state.appView)
  const newDocument = useProjectStore((state) => state.newDocument)
  const showDashboardState = useProjectStore((state) => state.showDashboard)
  const resetWorkspaceForNewDocument = useProjectStore((state) => state.resetWorkspaceForNewDocument)
  const openExistingDocument = useProjectStore((state) => state.openExistingDocument)
  const markSaved = useProjectStore((state) => state.markSaved)
  const setProjectFiles = useProjectStore((state) => state.setProjectFiles)
  const setRecentFiles = useProjectStore((state) => state.setRecentFiles)

  const updateWindowTitle = useCallback(() => {
    const api = electronBridge()
    const { appView: currentView } = useProjectStore.getState()

    if (currentView === 'dashboard') {
      void api?.setWindowTitle('URDF Builder')
      return
    }

    const { document: currentDocument } = useProjectStore.getState()
    const title = `${currentDocument.fileName || DEFAULT_URDF_FILENAME}${
      currentDocument.dirty || currentDocument.isDirty || currentDocument.isUntitled ? ' *' : ''
    }`

    void api?.setWindowTitle(title)
  }, [])

  const saveUrdf = useCallback(
    async (saveAs = false) => {
      const api = electronBridge()
      const {
        document: currentDocument,
        projectRoot,
      } = useProjectStore.getState()

      if (!api) {
        return false
      }

      const result = await api.saveUrdf({
        filePath: saveAs || currentDocument.isUntitled ? null : currentDocument.filePath,
        fileName: currentDocument.fileName || DEFAULT_URDF_FILENAME,
        content: currentDocument.xml,
        saveAs: saveAs || currentDocument.isUntitled,
      })

      if (result.error) {
        window.alert(result.error)
        return false
      }

      if (result.canceled || !result.content || !result.fileName) {
        return false
      }

      markSaved({
        fileName: result.fileName,
        filePath: result.filePath ?? null,
        projectDir: result.projectDir ?? null,
        xml: result.content,
        dirty: false,
        recentFiles: result.recentFiles,
      })
      useHistoryStore.getState().addTimelineEntry({
        type: 'save',
        title: `Saved ${result.fileName}`,
        filePath: result.filePath,
      })
      await refreshProjectFilesForDocument(result.filePath, projectRoot)
      return true
    },
    [markSaved],
  )

  const confirmDiscardOrSaveCurrentDocument = useCallback(async () => {
    const api = electronBridge()

    if (!hasUnsavedChanges()) {
      return true
    }

    const { document: currentDocument } = useProjectStore.getState()

    if (!api) {
      return window.confirm('Discard unsaved changes?')
    }

    const result = await api.confirmSaveCurrentDocument({
      fileName: currentDocument.fileName || DEFAULT_URDF_FILENAME,
    })

    if (result.action === 'cancel') {
      return false
    }

    if (result.action === 'save') {
      return saveUrdf(false)
    }

    return true
  }, [saveUrdf])

  const createNew = useCallback(async () => {
    if (!(await confirmDiscardOrSaveCurrentDocument())) {
      return
    }

    newDocument()
    useHistoryStore.getState().clear()
    useEditorStore.getState().clearTabs()
  }, [confirmDiscardOrSaveCurrentDocument, newDocument])

  const showDashboard = useCallback(async () => {
    if (useProjectStore.getState().appView === 'dashboard') {
      return
    }

    if (!(await confirmDiscardOrSaveCurrentDocument())) {
      return
    }

    showDashboardState('user')
  }, [confirmDiscardOrSaveCurrentDocument, showDashboardState])

  const replaceActiveDocument = useCallback(
    async (
      result: OpenUrdfResult,
      previousProjectRoot: string | null,
      workspaceRoot?: string | null,
      workspaceFiles?: ReturnType<typeof useProjectStore.getState>['projectFiles'],
    ) => {
      resetWorkspaceForNewDocument()
      useHistoryStore.getState().clear()
      useEditorStore.getState().clearTabs()
      openExistingDocument({
        fileName: result.fileName ?? DEFAULT_URDF_FILENAME,
        filePath: result.filePath ?? null,
        projectDir: result.projectDir ?? null,
        content: result.content ?? '',
        dirty: false,
        recentFiles: result.recentFiles,
        resourceDiagnostics: result.resourceDiagnostics,
        projectRoot: workspaceRoot ?? null,
        projectFiles: workspaceFiles ?? [],
      })

      if (!workspaceRoot) {
        await refreshProjectFilesForDocument(result.filePath, previousProjectRoot)
      }
      useHistoryStore.getState().addTimelineEntry({
        type: 'import',
        title: `Opened ${result.fileName ?? DEFAULT_URDF_FILENAME}`,
        filePath: result.filePath,
      })
    },
    [openExistingDocument, resetWorkspaceForNewDocument],
  )

  const openUrdf = useCallback(async () => {
    const api = electronBridge()

    if (!api || !(await confirmDiscardOrSaveCurrentDocument())) {
      return
    }

    const previousProjectRoot = useProjectStore.getState().projectRoot
    const result = await api.openUrdf()

    if (result.error) {
      window.alert(result.error)
      return
    }

    if (result.canceled || !result.content || !result.fileName) {
      return
    }

    await replaceActiveDocument(result, previousProjectRoot)
  }, [confirmDiscardOrSaveCurrentDocument, replaceActiveDocument])

  const openRecent = useCallback(
    async (filePath: string) => {
      const api = electronBridge()

      if (!api || !(await confirmDiscardOrSaveCurrentDocument())) {
        return
      }

      const previousProjectRoot = useProjectStore.getState().projectRoot
      const result = await api.readFile(filePath)

      if (result.error) {
        window.alert(result.error)
        return
      }

      if (result.canceled || !result.content || !result.fileName) {
        return
      }

      await replaceActiveDocument(result, previousProjectRoot)
    },
    [confirmDiscardOrSaveCurrentDocument, replaceActiveDocument],
  )

  const exportPackage = useCallback(async () => {
    const api = electronBridge()
    const { document: currentDocument } = useProjectStore.getState()

    if (!api) {
      return
    }

    const result = await api.exportPackage({
      fileName: currentDocument.fileName,
      filePath: currentDocument.filePath,
      projectDir: currentDocument.projectDir,
      content: currentDocument.xml,
    })

    if (result.error) {
      window.alert(result.error)
      return
    }

    if (!result.canceled && result.warnings?.length) {
      window.alert(result.warnings.join('\n'))
    }
  }, [])

  const openFolder = useCallback(async () => {
    const api = electronBridge()

    if (!api || !(await confirmDiscardOrSaveCurrentDocument())) {
      return
    }

    const result = await api.openFolder()

    if (!result.canceled && result.rootPath) {
      setProjectFiles(result.rootPath, result.files ?? [])

      if (result.activeUrdf?.content && result.activeUrdf.fileName) {
        await replaceActiveDocument(
          result.activeUrdf,
          result.rootPath,
          result.rootPath,
          result.files ?? [],
        )
      }

      if (result.warnings?.length) {
        window.alert(result.warnings.join('\n'))
      }
    }
  }, [confirmDiscardOrSaveCurrentDocument, replaceActiveDocument, setProjectFiles])

  const revealPath = useCallback(async (filePath?: string | null) => {
    if (!filePath) {
      return
    }

    await electronBridge()?.revealPath(filePath)
  }, [])

  const removeRecentFile = useCallback(
    async (filePath: string) => {
      const files = await electronBridge()?.removeRecentFile(filePath)

      if (files) {
        setRecentFiles(files)
      }
    },
    [setRecentFiles],
  )

  const minimizeWindow = useCallback(async () => {
    await electronBridge()?.minimizeWindow()
  }, [])

  const toggleMaximizeWindow = useCallback(async () => {
    await electronBridge()?.toggleMaximizeWindow()
  }, [])

  const closeWindow = useCallback(
    async (panelId?: DockPanelId | null) => {
      const api = electronBridge()

      if (!api) {
        return
      }

      if (panelId) {
        useWorkspaceStore.getState().hidePanel(panelId)
        await api.closeWindow()
        return
      }

      if (!(await confirmDiscardOrSaveCurrentDocument())) {
        return
      }

      await api.closeWindow()
    },
    [confirmDiscardOrSaveCurrentDocument],
  )

  const detachPanel = useCallback(async (panelId: DockPanelId) => {
    const api = electronBridge()
    const workspace = useWorkspaceStore.getState()

    workspace.detachPanel(panelId)

    if (!api) {
      return
    }

    const result = await api.openPanelWindow(panelId)

    if (!result.ok) {
      workspace.dockPanel(panelId)
      return
    }

    workspace.setPanelWindowId(panelId, result.windowId)
  }, [])

  const dockPanelBack = useCallback(async (panelId: DockPanelId) => {
    const workspace = useWorkspaceStore.getState()

    workspace.restorePanel(panelId)
    await electronBridge()?.dockPanelWindow(panelId)
  }, [])

  const closePanel = useCallback((panelId: DockPanelId) => {
    useWorkspaceStore.getState().hidePanel(panelId)
  }, [])

  const restorePanel = useCallback(async (panelId: DockPanelId) => {
    const workspace = useWorkspaceStore.getState()
    const wasDetached = workspace.panels[panelId]?.placement === 'detached'

    workspace.restorePanel(panelId)

    if (wasDetached) {
      await electronBridge()?.dockPanelWindow(panelId)
    }
  }, [])

  const resetLayout = useCallback(async () => {
    const api = electronBridge()
    const workspace = useWorkspaceStore.getState()
    const detachedPanels = Object.values(workspace.panels)
      .filter((panel) => panel.placement === 'detached')
      .map((panel) => panel.id)

    workspace.resetLayout()
    await Promise.all(detachedPanels.map((panelId) => api?.dockPanelWindow(panelId)))
  }, [])

  const detachEditor = useCallback(async () => {
    await detachPanel('editor')
  }, [detachPanel])

  useEffect(() => {
    const api = electronBridge()

    void api?.getRecentFiles().then((files) => {
      setRecentFiles(files)
    })
  }, [setRecentFiles])

  useEffect(() => {
    updateWindowTitle()
  }, [
    appView,
    document.fileName,
    document.dirty,
    document.isDirty,
    document.isUntitled,
    updateWindowTitle,
  ])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) {
        return
      }

      const key = event.key.toLowerCase()
      const commandOrControl = event.ctrlKey || event.metaKey

      if (commandOrControl && key === 's') {
        event.preventDefault()
        void saveUrdf(event.shiftKey)
        return
      }

      if (commandOrControl && !isNativeUndoTarget(event.target)) {
        if (key === 'z' && !event.shiftKey) {
          event.preventDefault()
          useHistoryStore.getState().undo()
          return
        }

        if (key === 'y' || (key === 'z' && event.shiftKey)) {
          event.preventDefault()
          useHistoryStore.getState().redo()
          return
        }
      }

      if (commandOrControl && key === 'o') {
        event.preventDefault()
        void openUrdf()
        return
      }

      if (commandOrControl && key === 'n') {
        event.preventDefault()
        void createNew()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [createNew, openUrdf, saveUrdf])

  return {
    createNew,
    showDashboard,
    openUrdf,
    openRecent,
    saveUrdf,
    saveAs: () => saveUrdf(true),
    exportPackage,
    openFolder,
    removeRecentFile,
    revealPath,
    minimizeWindow,
    toggleMaximizeWindow,
    closeWindow,
    detachEditor,
    detachPanel,
    dockPanelBack,
    closePanel,
    restorePanel,
    resetLayout,
    undo: () => useHistoryStore.getState().undo(),
    redo: () => useHistoryStore.getState().redo(),
  }
}
