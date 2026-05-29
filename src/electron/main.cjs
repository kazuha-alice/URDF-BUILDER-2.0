const { app, BrowserWindow, Menu, dialog, ipcMain, net, protocol, screen, shell } = require('electron')
const fse = require('fs-extra')
const path = require('node:path')
const { fileURLToPath, pathToFileURL } = require('node:url')
const { XMLBuilder, XMLParser } = require('fast-xml-parser')
const ElectronStore = require('electron-store').default

const devServerUrl = process.env.VITE_DEV_SERVER_URL
const recentLimit = 12
const meshExtensions = new Set(['.stl', '.dae', '.obj', '.glb', '.gltf'])
const layoutStore = new ElectronStore({ name: 'urdf-builder-layout' })
const workspaceSessionKey = 'workspace.session'

let mainWindow
const panelWindows = new Map()
const panelClosingReasons = new Map()

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'urdf-file',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
])

function encodeFilePath(filePath) {
  return Buffer.from(filePath, 'utf8').toString('base64url')
}

function decodeFilePath(value) {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function filePathToUrdfUrl(filePath) {
  return `urdf-file://local/${encodeFilePath(filePath)}`
}

function directoryPathToUrdfUrl(directoryPath) {
  return `urdf-file://dir/${encodeFilePath(directoryPath)}/`
}

function registerFileProtocol() {
  protocol.handle('urdf-file', async (request) => {
    const requestUrl = new URL(request.url)
    const pathParts = requestUrl.pathname.replace(/^\//, '').split('/')
    let filePath

    if (requestUrl.hostname === 'dir') {
      const [encodedDir, ...relativeParts] = pathParts
      const directoryPath = decodeFilePath(encodedDir)
      filePath = path.resolve(directoryPath, relativeParts.map(decodeURIComponent).join('/'))
    } else {
      filePath = decodeFilePath(pathParts[0])
    }

    if (!(await fse.pathExists(filePath))) {
      return new Response('File not found', { status: 404 })
    }

    return net.fetch(pathToFileURL(filePath).toString())
  })
}

function getAppIconPath() {
  return path.join(__dirname, '..', 'icons', 'urdf-builder.png')
}

function getRecentFilesPath() {
  return path.join(app.getPath('userData'), 'recent-files.json')
}

function getPreviewCacheDir() {
  return path.join(app.getPath('userData'), '.cache', 'previews')
}

function getPreviewCachePath(filePath) {
  return path.join(getPreviewCacheDir(), `${encodeFilePath(filePath)}.svg`)
}

function escapeSvgText(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function getPreviewAccent(filePath) {
  const accents = ['#6ed6c5', '#5ba8ff', '#d8a14a', '#65d28b']
  let hash = 0

  for (const character of filePath) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  }

  return accents[hash % accents.length]
}

function buildProjectPreviewSvg(filePath, stats) {
  const fileName = escapeSvgText(path.basename(filePath, path.extname(filePath)) || 'Robot')
  const accent = getPreviewAccent(filePath)
  const updatedAt = stats?.mtime
    ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(stats.mtime)
    : 'Recent'

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360" role="img" aria-label="${fileName} preview">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#20272d"/>
      <stop offset="0.58" stop-color="#151a1f"/>
      <stop offset="1" stop-color="#101316"/>
    </linearGradient>
    <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse">
      <path d="M 28 0 L 0 0 0 28" fill="none" stroke="#7f8a94" stroke-opacity="0.15" stroke-width="1"/>
    </pattern>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="16" flood-color="#000000" flood-opacity="0.38"/>
    </filter>
  </defs>
  <rect width="640" height="360" rx="28" fill="url(#bg)"/>
  <rect x="0" y="188" width="640" height="172" fill="url(#grid)" opacity="0.78"/>
  <path d="M 0 250 L 640 156" stroke="#d7e4ef" stroke-opacity="0.16" stroke-width="2"/>
  <path d="M 62 360 L 392 124 L 640 264" stroke="#d7e4ef" stroke-opacity="0.14" stroke-width="2"/>
  <g filter="url(#softShadow)">
    <rect x="234" y="150" width="172" height="88" rx="24" fill="${accent}" fill-opacity="0.82"/>
    <rect x="275" y="103" width="90" height="62" rx="18" fill="${accent}" fill-opacity="0.55"/>
    <circle cx="260" cy="252" r="22" fill="#0b0e12"/>
    <circle cx="380" cy="252" r="22" fill="#0b0e12"/>
    <path d="M 320 150 L 320 72" stroke="#22c55e" stroke-width="5" stroke-linecap="round"/>
    <path d="M 320 150 L 238 188" stroke="#ef4444" stroke-width="5" stroke-linecap="round"/>
    <path d="M 320 150 L 426 204" stroke="#3b82f6" stroke-width="5" stroke-linecap="round"/>
  </g>
  <rect x="28" y="26" width="584" height="58" rx="18" fill="#ffffff" fill-opacity="0.055" stroke="#ffffff" stroke-opacity="0.1"/>
  <text x="52" y="60" fill="#f4f0e8" font-family="Segoe UI, Arial, sans-serif" font-size="24" font-weight="700">${fileName}</text>
  <text x="52" y="320" fill="#b9c3cb" font-family="Segoe UI, Arial, sans-serif" font-size="18">URDF robot description</text>
  <text x="496" y="320" fill="#87929b" font-family="Segoe UI, Arial, sans-serif" font-size="16">${escapeSvgText(updatedAt)}</text>
</svg>`
}

async function getCachedPreviewUrl(filePath) {
  const previewPath = getPreviewCachePath(filePath)

  await fse.ensureDir(getPreviewCacheDir())

  let sourceStats
  let previewStats

  try {
    sourceStats = await fse.stat(filePath)
  } catch {
    sourceStats = undefined
  }

  try {
    previewStats = await fse.stat(previewPath)
  } catch {
    previewStats = undefined
  }

  if (!previewStats || (sourceStats && previewStats.mtimeMs < sourceStats.mtimeMs)) {
    await fse.writeFile(previewPath, buildProjectPreviewSvg(filePath, sourceStats), 'utf8')
  }

  return filePathToUrdfUrl(previewPath)
}

async function readRecentFiles() {
  try {
    const files = await fse.readJson(getRecentFilesPath())
    return Array.isArray(files) ? files.filter((file) => typeof file === 'string') : []
  } catch {
    return []
  }
}

async function writeRecentFiles(files) {
  await fse.ensureDir(app.getPath('userData'))
  await fse.writeJson(getRecentFilesPath(), files.slice(0, recentLimit), { spaces: 2 })
}

async function addRecentFile(filePath) {
  if (!filePath) {
    return readRecentFiles()
  }

  const recentFiles = await readRecentFiles()
  const nextFiles = [filePath, ...recentFiles.filter((file) => file !== filePath)].slice(
    0,
    recentLimit,
  )

  await writeRecentFiles(nextFiles)
  return nextFiles
}

async function removeRecentFile(filePath) {
  const recentFiles = await readRecentFiles()
  const nextFiles = recentFiles.filter((file) => file !== filePath)

  await writeRecentFiles(nextFiles)
  return nextFiles
}

async function readRecentProjects() {
  const recentFiles = await readRecentFiles()

  return Promise.all(
    recentFiles.map(async (filePath, index) => {
      let stats

      try {
        stats = await fse.stat(filePath)
      } catch {
        stats = undefined
      }

      return {
        id: filePath,
        filePath,
        fileName: path.basename(filePath),
        workspaceRoot: path.dirname(filePath),
        workspaceKind: 'single-urdf',
        thumbnail: await getCachedPreviewUrl(filePath),
        lastOpenedAt: stats?.mtimeMs ?? Date.now() - index,
        lastEditedAt: stats?.mtimeMs,
        isDirtyDraftAvailable: false,
      }
    }),
  )
}

function toFilePayload(filePath, content, recentFiles = [], resourceDiagnostics = []) {
  return {
    canceled: false,
    cancelled: false,
    filePath,
    fileName: path.basename(filePath),
    projectDir: path.dirname(filePath),
    content,
    recentFiles,
    resourceDiagnostics,
  }
}

function getFocusedWindow(event) {
  return BrowserWindow.fromWebContents(event.sender) ?? mainWindow
}

function getWindowStateKey(kind, panelId) {
  return panelId ? `windows.panels.${panelId}` : `windows.${kind}`
}

function getSavedWindowState(kind, panelId) {
  return layoutStore.get(getWindowStateKey(kind, panelId))
}

function debounce(fn, delay = 250) {
  let timer

  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

function getWindowBoundsSnapshot(window) {
  const bounds = window.isMaximized() ? window.getNormalBounds() : window.getBounds()

  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    isMaximized: window.isMaximized(),
  }
}

function updateWorkspaceSession(patch) {
  const currentSession = layoutStore.get(workspaceSessionKey)
  const nextSession = {
    ...(currentSession && typeof currentSession === 'object' ? currentSession : {}),
    ...(patch && typeof patch === 'object' ? patch : {}),
    lastSavedAt: Date.now(),
  }

  layoutStore.set(workspaceSessionKey, nextSession)
  return nextSession
}

function saveWindowState(window, kind, panelId) {
  if (!window || window.isDestroyed()) {
    return
  }

  const windowBounds = getWindowBoundsSnapshot(window)

  layoutStore.set(getWindowStateKey(kind, panelId), {
    bounds: {
      x: windowBounds.x,
      y: windowBounds.y,
      width: windowBounds.width,
      height: windowBounds.height,
    },
    isMaximized: windowBounds.isMaximized,
  })

  if (!panelId && kind === 'main') {
    updateWorkspaceSession({ windowBounds })
  }
}

function requestWorkspaceSessionFlush(window) {
  if (!window || window.isDestroyed() || window.webContents.isDestroyed()) {
    return
  }

  window.webContents.send('workspace-session:flush-request')
}

async function loadWorkspaceSession() {
  const session = layoutStore.get(workspaceSessionKey)

  if (!session || typeof session !== 'object') {
    return null
  }

  const normalized = { ...session }
  const hasDraftContent = typeof normalized.documentContent === 'string' && normalized.documentContent.length > 0

  if (typeof normalized.activeFilePath === 'string' && normalized.activeFilePath) {
    if (await fse.pathExists(normalized.activeFilePath)) {
      normalized.activeFileName = path.basename(normalized.activeFilePath)
      normalized.projectDir = path.dirname(normalized.activeFilePath)
      normalized.isUntitled = false

      if (!normalized.isDirty) {
        normalized.documentContent = await fse.readFile(normalized.activeFilePath, 'utf8')
      }

      return normalized
    }

    if (normalized.isDirty && hasDraftContent) {
      normalized.activeFilePath = null
      normalized.projectDir = null
      normalized.isUntitled = true
      return normalized
    }

    return null
  }

  if (normalized.isUntitled && hasDraftContent) {
    return normalized
  }

  return null
}

function installWindowLifecycle(window, kind, panelId) {
  const saveDebounced = debounce(() => saveWindowState(window, kind, panelId), 220)
  const saveNow = () => saveWindowState(window, kind, panelId)
  const saveAndFlush = () => {
    saveNow()

    if (!panelId) {
      requestWorkspaceSessionFlush(window)
    }
  }

  window.on('resize', saveDebounced)
  window.on('move', saveDebounced)
  window.on('maximize', saveAndFlush)
  window.on('unmaximize', saveAndFlush)
  window.on('minimize', saveAndFlush)
  window.on('restore', saveAndFlush)
}

function defaultPanelBounds(panelId, opener) {
  const openerBounds = opener && !opener.isDestroyed() ? opener.getBounds() : undefined
  const display = openerBounds
    ? screen.getDisplayNearestPoint({ x: openerBounds.x + 40, y: openerBounds.y + 40 })
    : screen.getPrimaryDisplay()
  const workArea = display.workArea
  const sizes = {
    viewport: { width: 1220, height: 820 },
    editor: { width: 1080, height: 740 },
    inspector: { width: 420, height: 760 },
    explorer: { width: 420, height: 760 },
    hierarchy: { width: 420, height: 760 },
    diagnostics: { width: 660, height: 520 },
    tfGraph: { width: 760, height: 620 },
    controller: { width: 640, height: 520 },
    console: { width: 720, height: 520 },
  }
  const size = sizes[panelId] ?? { width: 900, height: 640 }
  const cascade = panelWindows.size * 28

  return {
    x: Math.round(workArea.x + Math.max(16, (workArea.width - size.width) / 2) + cascade),
    y: Math.round(workArea.y + Math.max(16, (workArea.height - size.height) / 2) + cascade),
    width: Math.min(size.width, workArea.width),
    height: Math.min(size.height, workArea.height),
  }
}

function broadcastToRendererWindows(channel, payload, exceptWebContents) {
  BrowserWindow.getAllWindows().forEach((window) => {
    if (window.isDestroyed() || window.webContents === exceptWebContents) {
      return
    }

    window.webContents.send(channel, payload)
  })
}

function loadWindowRoute(window, route = '') {
  if (devServerUrl) {
    window.loadURL(route ? `${devServerUrl}#${route}` : devServerUrl)
    return
  }

  window.loadFile(path.join(__dirname, '..', '..', 'dist', 'index.html'), {
    hash: route || undefined,
  })
}

function createAppWindow({ kind, panelId, opener }) {
  const savedState = getSavedWindowState(kind, panelId)
  const savedBounds = savedState?.bounds
  const fallbackBounds = panelId
    ? defaultPanelBounds(panelId, opener)
    : { width: 1440, height: 900 }
  const window = new BrowserWindow({
    ...(savedBounds ?? fallbackBounds),
    minWidth: panelId ? 360 : 1120,
    minHeight: panelId ? 360 : 720,
    backgroundColor: '#16171d',
    title: panelId ? `URDF Builder - ${panelId}` : 'URDF Builder',
    icon: getAppIconPath(),
    frame: false,
    titleBarStyle: 'hidden',
    trafficLightPosition: undefined,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  window.once('ready-to-show', () => {
    if (savedState?.isMaximized) {
      window.maximize()
    }

    window.show()
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  installWindowLifecycle(window, kind, panelId)

  window.on('close', () => {
    if (!panelId) {
      requestWorkspaceSessionFlush(window)
    }

    saveWindowState(window, kind, panelId)

    if (panelId) {
      const reason = panelClosingReasons.get(panelId) ?? 'hidden'
      panelClosingReasons.delete(panelId)
      broadcastToRendererWindows('panel-window:closed', {
        panelId,
        windowId: window.id,
        reason,
      })
      return
    }

    panelWindows.forEach((panelWindow, openPanelId) => {
      if (!panelWindow.isDestroyed()) {
        panelClosingReasons.set(openPanelId, 'hidden')
        panelWindow.close()
      }
    })
  })

  window.on('closed', () => {
    if (!panelId) {
      if (mainWindow === window) {
        mainWindow = undefined
      }
      return
    }

    if (panelWindows.get(panelId) === window) {
      panelWindows.delete(panelId)
    }
  })

  return window
}

function createMainWindow() {
  const window = createAppWindow({ kind: 'main' })
  loadWindowRoute(window)

  return window
}

function createPanelWindow(panelId, opener) {
  const existingWindow = panelWindows.get(panelId)

  if (existingWindow && !existingWindow.isDestroyed()) {
    existingWindow.focus()
    return existingWindow
  }

  const window = createAppWindow({
    kind: 'panel',
    panelId,
    opener,
  })

  panelWindows.set(panelId, window)
  loadWindowRoute(window, `/panel/${panelId}`)

  return window
}

function restoreDetachedPanelWindows() {
  const panels = layoutStore.get('layout.panels')

  if (!panels || typeof panels !== 'object') {
    return
  }

  Object.values(panels).forEach((panel) => {
    if (panel?.placement === 'detached' && panel?.id) {
      createPanelWindow(panel.id, mainWindow)
    }
  })
}

function shouldRestoreLastProjectOnStartup() {
  return layoutStore.get('startup.behavior') === 'restore-last-project'
}

function isPathInside(parentPath, childPath) {
  const relativePath = path.relative(parentPath, childPath)
  return Boolean(relativePath) && !relativePath.startsWith('..') && !path.isAbsolute(relativePath)
}

async function listDirectoryTree(rootDir, depth = 8) {
  if (!rootDir || !(await fse.pathExists(rootDir))) {
    return []
  }

  async function walk(currentDir, currentDepth) {
    if (currentDepth > depth) {
      return []
    }

    const entries = await fse.readdir(currentDir, { withFileTypes: true })
    const visibleEntries = entries
      .filter((entry) => !entry.name.startsWith('.') && entry.name !== 'node_modules')
      .sort((left, right) => {
        if (left.isDirectory() !== right.isDirectory()) {
          return left.isDirectory() ? -1 : 1
        }

        return left.name.localeCompare(right.name)
      })

    return Promise.all(
      visibleEntries.map(async (entry) => {
        const fullPath = path.join(currentDir, entry.name)
        const isDirectory = entry.isDirectory()

        return {
          name: entry.name,
          path: fullPath,
          type: isDirectory ? 'directory' : 'file',
          children: isDirectory ? await walk(fullPath, currentDepth + 1) : [],
        }
      }),
    )
  }

  return walk(rootDir, 0)
}

async function scanRobotWorkspace(rootDir) {
  const urdfCandidates = []
  const xacroCandidates = []
  const meshDirectories = new Set()
  const controllerFiles = []
  let packageXmlPath

  async function walk(currentDir) {
    const entries = await fse.readdir(currentDir, { withFileTypes: true })

    await Promise.all(
      entries.map(async (entry) => {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') {
          return
        }

        const fullPath = path.join(currentDir, entry.name)

        if (entry.isDirectory()) {
          if (/mesh/i.test(entry.name)) {
            meshDirectories.add(fullPath)
          }

          await walk(fullPath)
          return
        }

        const extension = path.extname(entry.name).toLowerCase()
        const relativePath = path.relative(rootDir, fullPath)

        if (extension === '.urdf') {
          urdfCandidates.push(fullPath)
        }

        if (extension === '.xacro') {
          xacroCandidates.push(fullPath)
        }

        if (entry.name === 'package.xml') {
          packageXmlPath = fullPath
        }

        if (
          extension === '.yaml' ||
          extension === '.yml' ||
          /controller|ros2_control|diff_drive/i.test(relativePath)
        ) {
          controllerFiles.push(fullPath)
        }
      }),
    )
  }

  await walk(rootDir)

  return {
    urdfCandidates: urdfCandidates.sort((left, right) => left.localeCompare(right)),
    xacroCandidates: xacroCandidates.sort((left, right) => left.localeCompare(right)),
    meshDirectories: [...meshDirectories].sort((left, right) => left.localeCompare(right)),
    controllerFiles: controllerFiles.sort((left, right) => left.localeCompare(right)),
    packageXmlPath,
  }
}

async function chooseUrdfFromWorkspace(window, rootDir, urdfCandidates) {
  if (!urdfCandidates.length) {
    return undefined
  }

  if (urdfCandidates.length === 1) {
    return urdfCandidates[0]
  }

  const relativeCandidates = urdfCandidates.map((candidate) => path.relative(rootDir, candidate))
  const result = await dialog.showMessageBox(window, {
    type: 'question',
    title: 'Select robot description',
    message: 'Select robot description to load:',
    buttons: [...relativeCandidates.slice(0, 20), 'Cancel'],
    cancelId: Math.min(relativeCandidates.length, 20),
    noLink: true,
  })

  if (result.response >= relativeCandidates.length || result.response >= 20) {
    return undefined
  }

  return urdfCandidates[result.response]
}

function resolveMeshSource(filename, sourceUrdfPath, projectDir, workspaceRoot) {
  if (!filename) {
    return undefined
  }

  if (filename.startsWith('file://')) {
    try {
      return fileURLToPath(filename)
    } catch {
      return undefined
    }
  }

  if (filename.startsWith('package://')) {
    const withoutProtocol = filename.replace('package://', '')
    const [packageName, ...restParts] = withoutProtocol.split(/[\\/]/)
    const restPath = restParts.join(path.sep)
    const candidates = [
      projectDir ? path.join(projectDir, restPath) : undefined,
      projectDir ? path.join(path.dirname(projectDir), packageName, restPath) : undefined,
      workspaceRoot ? path.join(workspaceRoot, restPath) : undefined,
      workspaceRoot ? path.join(workspaceRoot, packageName, restPath) : undefined,
      workspaceRoot ? path.join(path.dirname(workspaceRoot), packageName, restPath) : undefined,
    ].filter(Boolean)

    return candidates.find((candidate) => fse.existsSync(candidate)) ?? candidates[0]
  }

  if (path.isAbsolute(filename)) {
    return filename
  }

  const baseDir = sourceUrdfPath ? path.dirname(sourceUrdfPath) : projectDir
  return baseDir ? path.resolve(baseDir, filename.replace(/^\.\//, '')) : undefined
}

function collectMeshFilenamesFromXml(xml) {
  const filenames = new Set()
  const meshPattern = /<mesh\b[^>]*\bfilename\s*=\s*["']([^"']+)["'][^>]*>/gi
  let match = meshPattern.exec(xml)

  while (match) {
    filenames.add(match[1])
    match = meshPattern.exec(xml)
  }

  return [...filenames]
}

async function collectMeshDiagnostics(xml, sourceUrdfPath, workspaceRoot) {
  const diagnostics = []
  const projectDir = sourceUrdfPath ? path.dirname(sourceUrdfPath) : workspaceRoot
  const meshFilenames = collectMeshFilenamesFromXml(xml)

  await Promise.all(
    meshFilenames.map(async (filename, index) => {
      const sourcePath = resolveMeshSource(filename, sourceUrdfPath, projectDir, workspaceRoot)

      if (!sourcePath || !(await fse.pathExists(sourcePath))) {
        diagnostics.push({
          id: `missing-mesh-${index}`,
          severity: 'warning',
          message: `Missing Mesh: ${filename}`,
        })
      }
    }),
  )

  return diagnostics
}

async function toFilePayloadWithDiagnostics(filePath, content, recentFiles = [], workspaceRoot) {
  return toFilePayload(
    filePath,
    content,
    recentFiles,
    await collectMeshDiagnostics(content, filePath, workspaceRoot),
  )
}

function ensureUniqueMeshName(meshDir, originalName, usedNames) {
  const parsed = path.parse(originalName)
  let candidate = originalName
  let index = 1

  while (usedNames.has(candidate) || fse.existsSync(path.join(meshDir, candidate))) {
    candidate = `${parsed.name}_${index}${parsed.ext}`
    index += 1
  }

  usedNames.add(candidate)
  return candidate
}

async function normalizeAndCopyMeshes(xml, sourceUrdfPath, exportRoot, packageDir) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    allowBooleanAttributes: true,
  })
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    format: true,
    suppressEmptyNode: true,
  })
  const parsed = parser.parse(xml)
  const meshDir = path.join(exportRoot, 'meshes')
  const copiedMeshes = []
  const warnings = []
  const usedMeshNames = new Set()

  await fse.ensureDir(meshDir)

  async function visit(node, key) {
    if (!node || typeof node !== 'object') {
      return
    }

    if (Array.isArray(node)) {
      await Promise.all(node.map((item) => visit(item, key)))
      return
    }

    if (key === 'mesh' && typeof node.filename === 'string') {
      const sourcePath = resolveMeshSource(node.filename, sourceUrdfPath, packageDir, packageDir)
      const extension = path.extname(node.filename).toLowerCase()
      const meshName = ensureUniqueMeshName(meshDir, path.basename(node.filename), usedMeshNames)
      const targetPath = path.join(meshDir, meshName)

      if (!meshExtensions.has(extension)) {
        warnings.push(`Unsupported mesh type referenced: ${node.filename}`)
      } else if (sourcePath && (await fse.pathExists(sourcePath))) {
        await fse.copy(sourcePath, targetPath, { overwrite: true })
        copiedMeshes.push(targetPath)
      } else {
        warnings.push(`Missing mesh file: ${node.filename}`)
      }

      node.filename = `./meshes/${meshName}`
    }

    await Promise.all(Object.entries(node).map(([childKey, childValue]) => visit(childValue, childKey)))
  }

  await visit(parsed, 'root')

  return {
    xml: builder.build(parsed),
    copiedMeshes,
    warnings,
  }
}

function registerIpc() {
  ipcMain.handle('app:get-recent-files', async () => readRecentFiles())
  ipcMain.handle('app:get-recent-projects', async () => readRecentProjects())
  ipcMain.handle('app:remove-recent-file', async (_event, filePath) => removeRecentFile(filePath))

  ipcMain.on('app-state:broadcast', (event, payload) => {
    broadcastToRendererWindows('app-state:update', payload, event.sender)
  })

  ipcMain.handle('session:load', async () => loadWorkspaceSession())

  ipcMain.handle('session:save', async (event, session) => {
    if (!session || typeof session !== 'object') {
      return false
    }

    const window = getFocusedWindow(event)
    const windowBounds = window && !window.isDestroyed() ? getWindowBoundsSnapshot(window) : session.windowBounds

    updateWorkspaceSession({
      ...session,
      windowBounds,
    })
    return true
  })

  ipcMain.handle('layout:get-panels', async () => layoutStore.get('layout.panels') ?? null)

  ipcMain.handle('layout:save-panels', async (_event, panels) => {
    layoutStore.set('layout.panels', panels ?? {})
    return true
  })

  ipcMain.handle('window:set-title', async (event, title) => {
    getFocusedWindow(event)?.setTitle(title || 'URDF Builder')
    return true
  })

  ipcMain.handle('window:minimize', async (event) => {
    getFocusedWindow(event)?.minimize()
    return true
  })

  ipcMain.handle('window:toggle-maximize', async (event) => {
    const window = getFocusedWindow(event)

    if (!window) {
      return false
    }

    if (window.isMaximized()) {
      window.unmaximize()
    } else {
      window.maximize()
    }

    return window.isMaximized()
  })

  ipcMain.handle('window:close', async (event) => {
    const window = getFocusedWindow(event)

    if (!window) {
      return false
    }

    const panelEntry = Array.from(panelWindows.entries()).find(([, panelWindow]) => panelWindow === window)

    if (panelEntry) {
      panelClosingReasons.set(panelEntry[0], 'hidden')
    }

    window.close()
    return true
  })

  ipcMain.handle('window:open-editor', async () => {
    const window = createPanelWindow('editor', mainWindow)
    return { ok: true, panelId: 'editor', windowId: window.id }
  })

  ipcMain.handle('window:open-panel', async (event, panelId) => {
    const cleanPanelId = panelId || 'editor'
    const window = createPanelWindow(cleanPanelId, getFocusedWindow(event))

    return { ok: true, panelId: cleanPanelId, windowId: window.id }
  })

  ipcMain.handle('window:dock-panel-back', async (_event, panelId) => {
    const window = panelWindows.get(panelId)

    if (!window || window.isDestroyed()) {
      return false
    }

    panelClosingReasons.set(panelId, 'docked')
    window.close()
    return true
  })

  ipcMain.handle('dialog:open-urdf', async (event) => {
    const result = await dialog.showOpenDialog(getFocusedWindow(event), {
      title: 'Open URDF',
      properties: ['openFile'],
      filters: [{ name: 'URDF Files', extensions: ['urdf'] }],
    })

    if (result.canceled || !result.filePaths[0]) {
      return { canceled: true, cancelled: true }
    }

    const filePath = result.filePaths[0]

    if (path.extname(filePath).toLowerCase() !== '.urdf') {
      return { canceled: true, cancelled: true, error: 'Only .urdf files can be opened.' }
    }

    const content = await fse.readFile(filePath, 'utf8')
    const recentFiles = await addRecentFile(filePath)

    return toFilePayloadWithDiagnostics(filePath, content, recentFiles)
  })

  ipcMain.handle('dialog:confirm-save-current', async (event, payload) => {
    const fileName = payload?.fileName || 'untitled.urdf'
    const result = await dialog.showMessageBox(getFocusedWindow(event), {
      type: 'warning',
      buttons: ['Save', "Don't Save", 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      noLink: true,
      title: 'Unsaved changes',
      message: `Save changes to ${fileName}?`,
      detail: 'Your changes will be lost if you do not save them.',
    })
    const actions = ['save', 'discard', 'cancel']

    return { action: actions[result.response] ?? 'cancel' }
  })

  ipcMain.handle('file:read', async (_event, filePath) => {
    if (!filePath || !(await fse.pathExists(filePath))) {
      return { canceled: true, cancelled: true, error: 'File does not exist.' }
    }

    if (path.extname(filePath).toLowerCase() !== '.urdf') {
      return { canceled: true, cancelled: true, error: 'Only .urdf files can be opened.' }
    }

    const content = await fse.readFile(filePath, 'utf8')
    return toFilePayloadWithDiagnostics(filePath, content, await addRecentFile(filePath))
  })

  ipcMain.handle('mesh:resolve-url', async (_event, payload) => {
    const filename = payload?.filename
    const sourceUrdfPath = payload?.filePath
    const projectDir = payload?.projectDir

    if (!filename) {
      return { ok: false, error: 'Missing mesh filename.' }
    }

    const filePath = resolveMeshSource(filename, sourceUrdfPath, projectDir, payload?.workspaceRoot)

    if (!filePath) {
      return { ok: false, filename, error: 'Unable to resolve mesh path.' }
    }

    const exists = await fse.pathExists(filePath)

    return {
      ok: exists,
      filename,
      filePath,
      url: exists ? filePathToUrdfUrl(filePath) : undefined,
      directoryUrl: exists ? directoryPathToUrdfUrl(path.dirname(filePath)) : undefined,
      error: exists ? undefined : `Mesh file not found: ${filePath}`,
    }
  })

  ipcMain.handle('file:save-urdf', async (event, payload) => {
    const saveAs = Boolean(payload?.saveAs)
    let filePath = payload?.filePath

    if (saveAs || !filePath) {
      const result = await dialog.showSaveDialog(getFocusedWindow(event), {
        title: 'Save URDF',
        defaultPath: filePath || 'untitled.urdf',
        filters: [{ name: 'URDF Files', extensions: ['urdf'] }],
      })

      if (result.canceled || !result.filePath) {
        return { canceled: true, cancelled: true }
      }

      filePath = result.filePath
    }

    await fse.ensureDir(path.dirname(filePath))
    await fse.writeFile(filePath, payload.content ?? '', 'utf8')

    const recentFiles = await addRecentFile(filePath)
    return toFilePayloadWithDiagnostics(filePath, payload.content ?? '', recentFiles)
  })

  ipcMain.handle('dialog:open-folder', async (event) => {
    const result = await dialog.showOpenDialog(getFocusedWindow(event), {
      title: 'Open Project Folder',
      properties: ['openDirectory'],
    })

    if (result.canceled || !result.filePaths[0]) {
      return { canceled: true }
    }

    const rootPath = result.filePaths[0]
    const workspaceScan = await scanRobotWorkspace(rootPath)
    const selectedUrdf = await chooseUrdfFromWorkspace(
      getFocusedWindow(event),
      rootPath,
      workspaceScan.urdfCandidates,
    )
    const files = await listDirectoryTree(rootPath)
    const activeUrdf = selectedUrdf
      ? await toFilePayloadWithDiagnostics(
          selectedUrdf,
          await fse.readFile(selectedUrdf, 'utf8'),
          await addRecentFile(selectedUrdf),
          rootPath,
        )
      : undefined

    return {
      canceled: false,
      rootName: path.basename(rootPath),
      rootPath,
      files,
      urdfCandidates: workspaceScan.urdfCandidates.map((candidate) => path.relative(rootPath, candidate)),
      xacroCandidates: workspaceScan.xacroCandidates.map((candidate) => path.relative(rootPath, candidate)),
      meshDirectories: workspaceScan.meshDirectories.map((candidate) => path.relative(rootPath, candidate)),
      controllerFiles: workspaceScan.controllerFiles.map((candidate) => path.relative(rootPath, candidate)),
      packageXmlPath: workspaceScan.packageXmlPath
        ? path.relative(rootPath, workspaceScan.packageXmlPath)
        : undefined,
      activeUrdf,
      warnings: selectedUrdf || !workspaceScan.urdfCandidates.length ? [] : ['No URDF selected.'],
    }
  })

  ipcMain.handle('fs:list-directory', async (_event, rootPath) => ({
    rootPath,
    files: await listDirectoryTree(rootPath),
  }))

  ipcMain.handle('fs:rename', async (_event, payload) => {
    const fromPath = payload?.fromPath
    const toName = payload?.toName

    if (!fromPath || !toName) {
      return { ok: false, error: 'Missing rename target.' }
    }

    const toPath = path.join(path.dirname(fromPath), toName)
    await fse.move(fromPath, toPath, { overwrite: false })
    return { ok: true, path: toPath }
  })

  ipcMain.handle('fs:delete', async (_event, filePath) => {
    if (!filePath || !(await fse.pathExists(filePath))) {
      return { ok: false, error: 'File does not exist.' }
    }

    await fse.remove(filePath)
    return { ok: true }
  })

  ipcMain.handle('fs:create-file', async (_event, payload) => {
    const directoryPath = payload?.directoryPath
    const fileName = payload?.fileName

    if (!directoryPath || !fileName) {
      return { ok: false, error: 'Missing file target.' }
    }

    const filePath = path.join(directoryPath, fileName)

    if (await fse.pathExists(filePath)) {
      return { ok: false, error: 'File already exists.' }
    }

    await fse.ensureDir(directoryPath)
    await fse.writeFile(filePath, payload?.content ?? '', 'utf8')
    return { ok: true, path: filePath }
  })

  ipcMain.handle('fs:create-folder', async (_event, payload) => {
    const directoryPath = payload?.directoryPath
    const folderName = payload?.folderName

    if (!directoryPath || !folderName) {
      return { ok: false, error: 'Missing folder target.' }
    }

    const folderPath = path.join(directoryPath, folderName)

    if (await fse.pathExists(folderPath)) {
      return { ok: false, error: 'Folder already exists.' }
    }

    await fse.ensureDir(folderPath)
    return { ok: true, path: folderPath }
  })

  ipcMain.handle('fs:duplicate', async (_event, filePath) => {
    if (!filePath || !(await fse.pathExists(filePath))) {
      return { ok: false, error: 'Path does not exist.' }
    }

    const parsed = path.parse(filePath)
    let index = 1
    let nextPath = path.join(parsed.dir, `${parsed.name}_copy${parsed.ext}`)

    while (await fse.pathExists(nextPath)) {
      index += 1
      nextPath = path.join(parsed.dir, `${parsed.name}_copy_${index}${parsed.ext}`)
    }

    await fse.copy(filePath, nextPath, { overwrite: false, errorOnExist: true })
    return { ok: true, path: nextPath }
  })

  ipcMain.handle('shell:reveal', async (_event, filePath) => {
    if (filePath) {
      shell.showItemInFolder(filePath)
    }

    return true
  })

  ipcMain.handle('dialog:export-package', async (event, payload) => {
    const sourceName = path.parse(payload?.fileName || 'untitled.urdf').name || 'untitled'
    const result = await dialog.showOpenDialog(getFocusedWindow(event), {
      title: 'Choose Export Location',
      properties: ['openDirectory', 'createDirectory'],
    })

    if (result.canceled || !result.filePaths[0]) {
      return { canceled: true }
    }

    const exportRoot = path.join(result.filePaths[0], sourceName)

    if (isPathInside(exportRoot, payload?.filePath || '')) {
      return {
        canceled: true,
        error: 'Choose an export folder outside the current URDF package.',
      }
    }

    await fse.ensureDir(exportRoot)

    const normalized = await normalizeAndCopyMeshes(
      payload?.content ?? '',
      payload?.filePath,
      exportRoot,
      payload?.projectDir,
    )
    const urdfPath = path.join(exportRoot, `${sourceName}.urdf`)

    await fse.writeFile(urdfPath, normalized.xml, 'utf8')

    return {
      canceled: false,
      exportRoot,
      urdfPath,
      copiedMeshes: normalized.copiedMeshes,
      warnings: normalized.warnings,
    }
  })
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  registerFileProtocol()
  registerIpc()
  mainWindow = createMainWindow()
  if (shouldRestoreLastProjectOnStartup()) {
    restoreDetachedPanelWindows()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow()
      if (shouldRestoreLastProjectOnStartup()) {
        restoreDetachedPanelWindows()
      }
    }
  })
})

app.on('before-quit', () => {
  BrowserWindow.getAllWindows().forEach((window) => {
    requestWorkspaceSessionFlush(window)
    const panelEntry = Array.from(panelWindows.entries()).find(([, panelWindow]) => panelWindow === window)
    saveWindowState(window, panelEntry ? 'panel' : 'main', panelEntry?.[0])
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
