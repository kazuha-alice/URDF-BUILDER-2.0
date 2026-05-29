const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('urdfBuilder', {
  platform: process.platform,
  getRecentFiles: () => ipcRenderer.invoke('app:get-recent-files'),
  getRecentProjects: () => ipcRenderer.invoke('app:get-recent-projects'),
  removeRecentFile: (filePath) => ipcRenderer.invoke('app:remove-recent-file', filePath),
  broadcastAppState: (payload) => ipcRenderer.send('app-state:broadcast', payload),
  onAppStateUpdate: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('app-state:update', listener)
    return () => ipcRenderer.removeListener('app-state:update', listener)
  },
  loadWorkspaceSession: () => ipcRenderer.invoke('session:load'),
  saveWorkspaceSession: (session) => ipcRenderer.invoke('session:save', session),
  onWorkspaceSessionFlush: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('workspace-session:flush-request', listener)
    return () => ipcRenderer.removeListener('workspace-session:flush-request', listener)
  },
  loadPanelLayout: () => ipcRenderer.invoke('layout:get-panels'),
  savePanelLayout: (panels) => ipcRenderer.invoke('layout:save-panels', panels),
  setWindowTitle: (title) => ipcRenderer.invoke('window:set-title', title),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximizeWindow: () => ipcRenderer.invoke('window:toggle-maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  dockPanelWindow: (panelId) => ipcRenderer.invoke('window:dock-panel-back', panelId),
  onPanelWindowClosed: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('panel-window:closed', listener)
    return () => ipcRenderer.removeListener('panel-window:closed', listener)
  },
  openEditorWindow: () => ipcRenderer.invoke('window:open-editor'),
  openPanelWindow: (panelId) => ipcRenderer.invoke('window:open-panel', panelId),
  openUrdf: () => ipcRenderer.invoke('dialog:open-urdf'),
  confirmSaveCurrentDocument: (payload) => ipcRenderer.invoke('dialog:confirm-save-current', payload),
  readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),
  resolveMeshUrl: (payload) => ipcRenderer.invoke('mesh:resolve-url', payload),
  saveUrdf: (payload) => ipcRenderer.invoke('file:save-urdf', payload),
  openFolder: () => ipcRenderer.invoke('dialog:open-folder'),
  listDirectory: (rootPath) => ipcRenderer.invoke('fs:list-directory', rootPath),
  renamePath: (payload) => ipcRenderer.invoke('fs:rename', payload),
  deletePath: (filePath) => ipcRenderer.invoke('fs:delete', filePath),
  createFile: (payload) => ipcRenderer.invoke('fs:create-file', payload),
  createFolder: (payload) => ipcRenderer.invoke('fs:create-folder', payload),
  duplicatePath: (filePath) => ipcRenderer.invoke('fs:duplicate', filePath),
  revealPath: (filePath) => ipcRenderer.invoke('shell:reveal', filePath),
  exportPackage: (payload) => ipcRenderer.invoke('dialog:export-package', payload),
})
