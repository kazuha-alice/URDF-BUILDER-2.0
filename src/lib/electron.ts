/* eslint-disable @typescript-eslint/no-empty-object-type */
export interface ProjectFileEntry {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: ProjectFileEntry[]
}

export interface OpenUrdfResult {
  canceled: boolean
  cancelled?: boolean
  filePath?: string
  fileName?: string
  projectDir?: string
  content?: string
  recentFiles?: string[]
  resourceDiagnostics?: Array<{
    id: string
    severity: 'error' | 'warning' | 'info'
    message: string
  }>
  error?: string
}

export type WorkspaceKind =
  | 'single-urdf'
  | 'robot-package'
  | 'factory-layout'
  | 'simulation-project'

export interface RecentProject {
  id: string
  filePath: string
  fileName: string
  workspaceRoot?: string
  workspaceKind?: WorkspaceKind
  thumbnail?: string
  lastOpenedAt: number
  lastEditedAt?: number
  isDirtyDraftAvailable?: boolean
}

export interface SaveUrdfPayload {
  filePath?: string | null
  fileName: string
  content: string
  saveAs?: boolean
}

export interface SaveUrdfResult extends OpenUrdfResult {}

export interface ConfirmSaveCurrentDocumentPayload {
  fileName: string
}

export interface ConfirmSaveCurrentDocumentResult {
  action: 'save' | 'discard' | 'cancel'
}

export interface OpenFolderResult {
  canceled: boolean
  rootPath?: string
  rootName?: string
  files?: ProjectFileEntry[]
  urdfCandidates?: string[]
  xacroCandidates?: string[]
  meshDirectories?: string[]
  controllerFiles?: string[]
  packageXmlPath?: string
  activeUrdf?: OpenUrdfResult
  warnings?: string[]
}

export interface ListDirectoryResult {
  rootPath: string
  files: ProjectFileEntry[]
}

export interface ExportPackagePayload {
  filePath?: string | null
  fileName: string
  projectDir?: string | null
  content: string
}

export interface ExportPackageResult {
  canceled: boolean
  exportRoot?: string
  urdfPath?: string
  copiedMeshes?: string[]
  warnings?: string[]
  error?: string
}

export interface RenamePathPayload {
  fromPath: string
  toName: string
}

export interface CreateFilePayload {
  directoryPath: string
  fileName: string
  content?: string
}

export interface CreateFolderPayload {
  directoryPath: string
  folderName: string
}

export interface ResolveMeshUrlPayload {
  filename: string
  filePath?: string | null
  projectDir?: string | null
  workspaceRoot?: string | null
}

export interface ResolveMeshUrlResult {
  ok: boolean
  filename?: string
  filePath?: string
  url?: string
  directoryUrl?: string
  error?: string
}

export interface WindowBoundsSnapshot {
  x?: number
  y?: number
  width: number
  height: number
  isMaximized: boolean
}

export interface WorkspaceSession {
  activeFilePath: string | null
  activeFileName: string
  documentContent: string
  isDirty: boolean
  isUntitled: boolean
  robotModelSnapshot: unknown
  selectedObjectId: string | null
  selectedObjectKind?: string | null
  controllerState?: unknown
  panelLayout: unknown
  windowBounds?: WindowBoundsSnapshot
  projectDir?: string | null
  projectRoot?: string | null
  projectFiles?: ProjectFileEntry[]
  cameraMode?: string
  viewPreset?: string
  lastSavedAt: number
}

export type AppStateUpdatePayload =
  | { type: 'project-state'; payload: unknown }
  | { type: 'workspace-state'; payload: unknown }
  | { type: 'request-project-state'; payload: null }

export interface PanelWindowClosedPayload {
  panelId: string
  windowId?: number
  reason?: 'hidden' | 'docked'
}

export interface OpenPanelWindowResult {
  ok: boolean
  panelId: string
  windowId: number
}

export interface ElectronBridge {
  platform: string
  getRecentFiles: () => Promise<string[]>
  getRecentProjects: () => Promise<RecentProject[]>
  removeRecentFile: (filePath: string) => Promise<string[]>
  broadcastAppState: (payload: AppStateUpdatePayload) => void
  onAppStateUpdate: (callback: (payload: AppStateUpdatePayload) => void) => () => void
  loadWorkspaceSession: () => Promise<WorkspaceSession | null>
  saveWorkspaceSession: (session: WorkspaceSession) => Promise<boolean>
  onWorkspaceSessionFlush: (callback: () => void) => () => void
  loadPanelLayout: () => Promise<unknown>
  savePanelLayout: (panels: unknown) => Promise<boolean>
  setWindowTitle: (title: string) => Promise<boolean>
  minimizeWindow: () => Promise<boolean>
  toggleMaximizeWindow: () => Promise<boolean>
  closeWindow: () => Promise<boolean>
  dockPanelWindow: (panelId: string) => Promise<boolean>
  onPanelWindowClosed: (callback: (payload: PanelWindowClosedPayload) => void) => () => void
  openEditorWindow: () => Promise<OpenPanelWindowResult>
  openPanelWindow: (panelId: string) => Promise<OpenPanelWindowResult>
  openUrdf: () => Promise<OpenUrdfResult>
  confirmSaveCurrentDocument: (
    payload: ConfirmSaveCurrentDocumentPayload,
  ) => Promise<ConfirmSaveCurrentDocumentResult>
  readFile: (filePath: string) => Promise<OpenUrdfResult>
  resolveMeshUrl: (payload: ResolveMeshUrlPayload) => Promise<ResolveMeshUrlResult>
  saveUrdf: (payload: SaveUrdfPayload) => Promise<SaveUrdfResult>
  openFolder: () => Promise<OpenFolderResult>
  listDirectory: (rootPath: string) => Promise<ListDirectoryResult>
  renamePath: (payload: RenamePathPayload) => Promise<{ ok: boolean; path?: string; error?: string }>
  deletePath: (filePath: string) => Promise<{ ok: boolean; error?: string }>
  createFile: (payload: CreateFilePayload) => Promise<{ ok: boolean; path?: string; error?: string }>
  createFolder: (payload: CreateFolderPayload) => Promise<{ ok: boolean; path?: string; error?: string }>
  duplicatePath: (filePath: string) => Promise<{ ok: boolean; path?: string; error?: string }>
  revealPath: (filePath: string) => Promise<boolean>
  exportPackage: (payload: ExportPackagePayload) => Promise<ExportPackageResult>
}

export const electronBridge = (): ElectronBridge | undefined => window.urdfBuilder

declare global {
  interface Window {
    urdfBuilder?: ElectronBridge
  }
}
