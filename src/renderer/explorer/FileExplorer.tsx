import {
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  FileCode2,
  FileJson,
  FilePlus2,
  Folder,
  FolderOpen,
  FolderPlus,
  Hammer,
  Package,
  ScrollText,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { useMemo, useState, type MouseEvent, type ReactNode } from 'react'
import { ContextMenu, type ContextMenuItem } from '../../components/ContextMenu'
import { PanelHeader } from '../../components/PanelHeader'
import { IconButton } from '../../components/IconButton'
import { electronBridge, type ProjectFileEntry } from '../../lib/electron'
import { languageForFile, useEditorStore } from '../../store/useEditorStore'
import { useProjectStore } from '../../store/useProjectStore'
import { useWorkspaceStore } from '../../store/useWorkspaceStore'
import type { useFileCommands } from '../../hooks/useFileCommands'

type FileCommands = ReturnType<typeof useFileCommands>

interface FileExplorerProps {
  commands: FileCommands
}

const supportedEditorExtensions = new Set([
  'urdf',
  'xacro',
  'stl',
  'dae',
  'yaml',
  'yml',
  'toml',
  'json',
  'launch',
  'py',
  'md',
  'xml',
])

function extensionFor(name: string) {
  return name.toLowerCase().split('.').pop() ?? ''
}

function isSupportedEditorFile(name: string) {
  return supportedEditorExtensions.has(extensionFor(name))
}

function fileIcon(entry: ProjectFileEntry) {
  if (entry.type === 'directory') {
    return <Folder size={14} />
  }

  switch (extensionFor(entry.name)) {
    case 'urdf':
    case 'xacro':
      return <Hammer size={14} />
    case 'stl':
    case 'dae':
    case 'obj':
    case 'glb':
    case 'gltf':
      return <Package size={14} />
    case 'yaml':
    case 'yml':
    case 'toml':
    case 'json':
      return <FileJson size={14} />
    case 'md':
      return <ScrollText size={14} />
    default:
      return <FileCode2 size={14} />
  }
}

function filterEntries(entries: ProjectFileEntry[], query: string): ProjectFileEntry[] {
  const normalized = query.trim().toLowerCase()

  if (!normalized) {
    return entries
  }

  return entries
    .map<ProjectFileEntry | null>((entry) => {
      const children = entry.children ? filterEntries(entry.children, normalized) : undefined
      const match = entry.name.toLowerCase().includes(normalized) || entry.path.toLowerCase().includes(normalized)

      return match || children?.length ? { ...entry, ...(children ? { children } : {}) } : null
    })
    .filter((entry): entry is ProjectFileEntry => Boolean(entry))
}

function TreeRow({
  icon,
  label,
  active,
  depth = 0,
  onClick,
  onContextMenu,
  expanded,
  expandable,
  onToggle,
}: {
  icon: ReactNode
  label: string
  active?: boolean
  depth?: number
  onClick?: () => void
  onContextMenu?: (event: MouseEvent) => void
  expanded?: boolean
  expandable?: boolean
  onToggle?: () => void
}) {
  return (
    <button
      type="button"
      className={`tree-row ${active ? 'is-active' : ''}`}
      style={{ paddingLeft: `${10 + depth * 14}px` }}
      onClick={onClick}
      onContextMenu={onContextMenu}
      title={label}
    >
      <span
        className={`hierarchy-chevron ${expandable ? '' : 'is-empty'}`}
        onClick={(event) => {
          event.stopPropagation()
          onToggle?.()
        }}
      >
        {expandable && expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
      </span>
      {icon}
      <span>{label}</span>
    </button>
  )
}

function ProjectFileTree({
  entries,
  depth = 0,
  commands,
  expandedFolders,
  toggleFolder,
  openMenu,
  openFile,
}: {
  entries: ProjectFileEntry[]
  depth?: number
  commands: FileCommands
  expandedFolders: Set<string>
  toggleFolder: (path: string) => void
  openMenu: (event: MouseEvent, entry: ProjectFileEntry) => void
  openFile: (entry: ProjectFileEntry) => void
}) {
  const activePath = useProjectStore((state) => state.document.filePath)

  return (
    <>
      {entries.map((entry) => {
        return (
          <div key={entry.path}>
            <TreeRow
              icon={fileIcon(entry)}
              label={entry.name}
              active={activePath === entry.path}
              depth={depth}
              expandable={entry.type === 'directory' && Boolean(entry.children?.length)}
              expanded={expandedFolders.has(entry.path)}
              onToggle={() => toggleFolder(entry.path)}
              onClick={
                entry.type === 'directory'
                  ? () => toggleFolder(entry.path)
                  : isSupportedEditorFile(entry.name)
                    ? () => openFile(entry)
                    : undefined
              }
              onContextMenu={(event) => openMenu(event, entry)}
            />
            {entry.children?.length && expandedFolders.has(entry.path) ? (
              <ProjectFileTree
                entries={entry.children}
                depth={depth + 1}
                commands={commands}
                expandedFolders={expandedFolders}
                toggleFolder={toggleFolder}
                openMenu={openMenu}
                openFile={openFile}
              />
            ) : null}
          </div>
        )
      })}
    </>
  )
}

export function FileExplorer({ commands }: FileExplorerProps) {
  const document = useProjectStore((state) => state.document)
  const projectFiles = useProjectStore((state) => state.projectFiles)
  const projectRoot = useProjectStore((state) => state.projectRoot)
  const setProjectFiles = useProjectStore((state) => state.setProjectFiles)
  const setActiveBottomTab = useWorkspaceStore((state) => state.setActiveBottomTab)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set())
  const [query, setQuery] = useState('')
  const [menu, setMenu] = useState<{ x: number; y: number; title: string; items: ContextMenuItem[] } | null>(null)
  const visibleFiles = useMemo(() => filterEntries(projectFiles, query), [projectFiles, query])

  async function refresh() {
    const api = electronBridge()

    if (!api || !projectRoot) {
      return
    }

    const result = await api.listDirectory(projectRoot)
    setProjectFiles(result.rootPath, result.files)
  }

  async function openFile(entry: ProjectFileEntry) {
    if (entry.name.toLowerCase().endsWith('.urdf')) {
      await commands.openRecent(entry.path)
      setActiveBottomTab('editor')
      return
    }

    const result = await electronBridge()?.readFile(entry.path)

    if (result?.error) {
      window.alert(result.error)
      return
    }

    if (!result?.content) {
      return
    }

    useEditorStore.getState().openTab({
      filePath: entry.path,
      fileName: entry.name,
      content: result.content,
      language: languageForFile(entry.name),
      isDirty: false,
      isDocumentTab: false,
    })
    setActiveBottomTab('editor')
  }

  async function refreshAndReport(result?: { ok: boolean; error?: string }) {
    if (result && !result.ok) {
      window.alert(result.error ?? 'File operation failed.')
      return
    }

    await refresh()
  }

  function toggleFolder(path: string) {
    setExpandedFolders((current) => {
      const next = new Set(current)

      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }

      return next
    })
  }

  function openMenu(event: MouseEvent, entry: ProjectFileEntry) {
    event.preventDefault()
    const api = electronBridge()
    const targetDirectory = entry.type === 'directory' ? entry.path : entry.path.replace(/[\\/][^\\/]+$/, '')
    const items: ContextMenuItem[] = [
      {
        id: 'open',
        label: entry.name.toLowerCase().endsWith('.urdf') ? 'Open URDF' : 'Open File',
        icon: <FileCode2 size={15} />,
        disabled: entry.type === 'directory' || !isSupportedEditorFile(entry.name),
        onSelect: () => void openFile(entry),
      },
      {
        id: 'new-file',
        label: 'New File',
        icon: <FilePlus2 size={15} />,
        onSelect: () => {
          const fileName = window.prompt('File name', 'new_file.urdf')

          if (fileName) {
            void api?.createFile({ directoryPath: targetDirectory, fileName }).then(refreshAndReport)
          }
        },
      },
      {
        id: 'new-folder',
        label: 'New Folder',
        icon: <FolderPlus size={15} />,
        onSelect: () => {
          const folderName = window.prompt('Folder name', 'new_folder')

          if (folderName) {
            void api?.createFolder({ directoryPath: targetDirectory, folderName }).then(refreshAndReport)
          }
        },
      },
      {
        id: 'duplicate',
        label: 'Duplicate',
        icon: <Copy size={15} />,
        onSelect: () => void api?.duplicatePath(entry.path).then(refreshAndReport),
      },
      {
        id: 'reveal',
        label: 'Reveal in Explorer',
        icon: <ExternalLink size={15} />,
        onSelect: () => void commands.revealPath(entry.path),
      },
      {
        id: 'refresh',
        label: 'Refresh',
        icon: <RefreshCw size={15} />,
        onSelect: () => void refresh(),
      },
      {
        id: 'rename',
        label: 'Rename',
        icon: <Pencil size={15} />,
        onSelect: () => {
          const nextName = window.prompt('New name', entry.name)

          if (nextName && nextName !== entry.name) {
            void api?.renamePath({ fromPath: entry.path, toName: nextName }).then(() => refresh())
          }
        },
      },
      {
        id: 'delete',
        label: 'Delete',
        icon: <Trash2 size={15} />,
        onSelect: () => {
          if (window.confirm(`Delete ${entry.name}?`)) {
            void api?.deletePath(entry.path).then(() => refresh())
          }
        },
      },
    ]

    setMenu({ x: event.clientX, y: event.clientY, title: entry.name, items })
  }

  return (
    <aside
      className="file-explorer"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        const droppedFile = event.dataTransfer.files[0] as (File & { path?: string }) | undefined
        const droppedPath = droppedFile?.path

        if (droppedPath?.toLowerCase().endsWith('.urdf')) {
          void commands.openRecent(droppedPath)
        }
      }}
    >
      <PanelHeader
        title="Explorer"
        actions={
          <>
            <IconButton
              icon={<FolderOpen size={14} />}
              label="Open Folder"
              onClick={commands.openFolder}
            />
            <IconButton
              icon={<RefreshCw size={14} />}
              label="Refresh Explorer"
              onClick={() => void refresh()}
            />
            <IconButton
              icon={<MoreHorizontal size={14} />}
              label="Reveal Current File"
              onClick={() => void commands.revealPath(document.filePath)}
            />
          </>
        }
      />

      <div className="tree-section">
        <div className="tree-section-label">Workspace</div>
        <label className="panel-search explorer-search">
          <FileCode2 size={14} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search files..."
          />
        </label>
        <TreeRow
          icon={<FileCode2 size={14} />}
          label={document.fileName}
          active
        />
        {projectRoot ? (
          <>
            <TreeRow
              icon={<FolderOpen size={14} />}
              label={projectRoot.split(/[\\/]/).filter(Boolean).at(-1) ?? projectRoot}
              expanded
              expandable={Boolean(projectFiles.length)}
              onToggle={() => {
                if (projectFiles.length) {
                  setExpandedFolders((current) => {
                    const next = new Set(current)

                    projectFiles.forEach((entry) => {
                      if (entry.type === 'directory') {
                        next.add(entry.path)
                      }
                    })

                    return next
                  })
                }
              }}
            />
            <ProjectFileTree
              entries={visibleFiles}
              commands={commands}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
              openMenu={openMenu}
              openFile={openFile}
            />
          </>
        ) : (
          <div className="empty-state">No folder opened</div>
        )}
      </div>

      {menu ? (
        <ContextMenu x={menu.x} y={menu.y} title={menu.title} items={menu.items} onClose={() => setMenu(null)} />
      ) : null}
    </aside>
  )
}
