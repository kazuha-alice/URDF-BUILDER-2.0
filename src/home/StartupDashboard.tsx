import {
  Bot,
  Box,
  ChevronRight,
  Clock3,
  FilePlus2,
  FolderOpen,
  FolderTree,
  Gauge,
  History,
  Package,
  Plus,
  Radio,
  Search,
  Settings,
  X,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react'
import logoUrl from '../icons/urdf-builder.png'
import type { RecentProject, WorkspaceKind } from '../lib/electron'
import { electronBridge, type WorkspaceSession } from '../lib/electron'
import type { useFileCommands } from '../hooks/useFileCommands'
import { DEFAULT_URDF_FILENAME } from '../core/urdf/defaultUrdf'
import { useProjectStore } from '../store/useProjectStore'

type FileCommands = ReturnType<typeof useFileCommands>
type StartupAction = 'new' | 'open-file' | 'open-folder' | 'open-recent' | 'open-template'

type RobotTemplate = {
  id: string
  name: string
  subtitle: string
  category: string
  icon: ReactNode
  preview: 'blank' | 'arm' | 'drive' | 'agv' | 'amr' | 'mobile' | 'sensor' | 'conveyor' | 'empty'
}

const templates: RobotTemplate[] = [
  {
    id: 'blank',
    name: 'Blank URDF',
    subtitle: 'Clean robot file',
    category: 'Starter',
    icon: <Plus size={21} />,
    preview: 'blank',
  },
  {
    id: 'robot-arm',
    name: 'Robot Arm',
    subtitle: '6-DOF Manipulator',
    category: 'Manipulator',
    icon: <Bot size={21} />,
    preview: 'arm',
  },
  {
    id: 'differential-drive',
    name: 'Differential Drive Robot',
    subtitle: 'Two wheel base',
    category: 'Mobile',
    icon: <Gauge size={21} />,
    preview: 'drive',
  },
  {
    id: 'agv',
    name: 'AGV',
    subtitle: 'Factory vehicle',
    category: 'Logistics',
    icon: <Box size={21} />,
    preview: 'agv',
  },
  {
    id: 'amr',
    name: 'AMR',
    subtitle: 'Autonomous mobile robot',
    category: 'Mobile',
    icon: <Package size={21} />,
    preview: 'amr',
  },
  {
    id: 'mobile-manipulator',
    name: 'Mobile Manipulator',
    subtitle: 'Base plus arm',
    category: 'Hybrid',
    icon: <Bot size={21} />,
    preview: 'mobile',
  },
  {
    id: 'sensor-platform',
    name: 'Sensor Platform',
    subtitle: 'Camera, lidar, IMU',
    category: 'Perception',
    icon: <Radio size={21} />,
    preview: 'sensor',
  },
  {
    id: 'conveyor',
    name: 'Conveyor Robot',
    subtitle: 'Industrial line module',
    category: 'Factory',
    icon: <Package size={21} />,
    preview: 'conveyor',
  },
  {
    id: 'empty-scene',
    name: 'Empty Scene',
    subtitle: 'Viewport only',
    category: 'Scene',
    icon: <Box size={21} />,
    preview: 'empty',
  },
]

function formatTimestamp(value?: number) {
  if (!value) {
    return 'Recently used'
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function workspaceKindLabel(kind?: WorkspaceKind) {
  switch (kind) {
    case 'robot-package':
      return 'Robot package'
    case 'factory-layout':
      return 'Factory layout'
    case 'simulation-project':
      return 'Simulation'
    case 'single-urdf':
    default:
      return 'Single URDF'
  }
}

function workspaceKindIcon(kind?: WorkspaceKind) {
  switch (kind) {
    case 'robot-package':
      return <Package size={13} />
    case 'factory-layout':
      return <Box size={13} />
    case 'simulation-project':
      return <Gauge size={13} />
    case 'single-urdf':
    default:
      return <FilePlus2 size={13} />
  }
}

function displayProjectName(project: RecentProject) {
  return project.fileName.replace(/\.urdf$/i, '')
}

function pendingSessionProject(session: WorkspaceSession | null): RecentProject | null {
  if (!session) {
    return null
  }

  const fileName = session.activeFileName || DEFAULT_URDF_FILENAME
  const filePath = session.activeFilePath ?? fileName

  return {
    id: `pending:${filePath}`,
    filePath,
    fileName,
    workspaceRoot: session.projectRoot ?? session.projectDir ?? undefined,
    workspaceKind: session.projectRoot ? 'robot-package' : 'single-urdf',
    lastOpenedAt: session.lastSavedAt,
    lastEditedAt: session.lastSavedAt,
    isDirtyDraftAvailable: Boolean(session.isDirty || session.isUntitled),
  }
}

function TemplatePreview({ template }: { template: RobotTemplate }) {
  return (
    <div className={`startup-template-preview preview-${template.preview}`} aria-hidden="true">
      <span className="preview-gridline" />
      <span className="preview-axis preview-axis-x" />
      <span className="preview-axis preview-axis-y" />
      <span className="preview-shape shape-a" />
      <span className="preview-shape shape-b" />
      <span className="preview-shape shape-c" />
    </div>
  )
}

function RecentPreview({ project }: { project: RecentProject }) {
  if (project.thumbnail) {
    return (
      <div className="startup-recent-preview has-thumbnail">
        <img src={project.thumbnail} alt="" />
      </div>
    )
  }

  return (
    <div className="startup-recent-preview" aria-hidden="true">
      <span className="recent-preview-grid" />
      <span className="recent-preview-robot" />
      <span className="recent-preview-link link-a" />
      <span className="recent-preview-link link-b" />
      <span className="recent-preview-dot dot-a" />
      <span className="recent-preview-dot dot-b" />
    </div>
  )
}

export function StartupDashboard({ commands }: { commands: FileCommands }) {
  const pendingSession = useProjectStore((state) => state.pendingWorkspaceSession)
  const restorePendingWorkspaceSession = useProjectStore((state) => state.restorePendingWorkspaceSession)
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([])
  const [query, setQuery] = useState('')
  const pendingProject = useMemo(() => pendingSessionProject(pendingSession), [pendingSession])
  const normalizedQuery = query.trim().toLowerCase()

  const filteredTemplates = useMemo(() => {
    if (!normalizedQuery) {
      return templates
    }

    return templates.filter((template) =>
      `${template.name} ${template.subtitle} ${template.category}`.toLowerCase().includes(normalizedQuery),
    )
  }, [normalizedQuery])

  const filteredProjects = useMemo(() => {
    if (!normalizedQuery) {
      return recentProjects
    }

    return recentProjects.filter((project) =>
      `${project.fileName} ${project.filePath} ${workspaceKindLabel(project.workspaceKind)}`
        .toLowerCase()
        .includes(normalizedQuery),
    )
  }, [normalizedQuery, recentProjects])

  useEffect(() => {
    let disposed = false

    void electronBridge()
      ?.getRecentProjects()
      .then((projects) => {
        if (!disposed) {
          setRecentProjects(projects)
        }
      })

    return () => {
      disposed = true
    }
  }, [])

  function launchWorkspace(action: StartupAction, payload?: { filePath?: string; templateId?: string; draft?: boolean }) {
    if (action === 'new' || action === 'open-template') {
      void commands.createNew()
      return
    }

    if (action === 'open-file') {
      void commands.openUrdf()
      return
    }

    if (action === 'open-folder') {
      void commands.openFolder()
      return
    }

    if (action === 'open-recent' && payload?.draft) {
      restorePendingWorkspaceSession()
      return
    }

    if (action === 'open-recent' && payload?.filePath) {
      void commands.openRecent(payload.filePath)
    }
  }

  async function removeRecent(event: MouseEvent, filePath: string) {
    event.preventDefault()
    event.stopPropagation()
    await commands.removeRecentFile(filePath)
    setRecentProjects((projects) => projects.filter((project) => project.filePath !== filePath))
  }

  return (
    <motion.main
      className="startup-dashboard startup-launcher"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, ease: 'easeOut' }}
    >
      <section className="startup-launcher-header">
        <div className="startup-brand-block">
          <img src={logoUrl} alt="" />
          <div>
            <span>Robotics engineering workspace</span>
            <h1>URDF Builder</h1>
          </div>
        </div>

        <label className="startup-global-search">
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search recent projects, templates, workspaces..."
          />
        </label>

        <button type="button" className="startup-settings-button" title="Startup settings">
          <Settings size={18} />
        </button>
      </section>

      <section className="startup-quick-actions" aria-label="Quick actions">
        <button type="button" onClick={() => launchWorkspace('new')}>
          <FilePlus2 size={16} />
          <span>New URDF</span>
        </button>
        <button type="button" onClick={() => launchWorkspace('open-file')}>
          <FolderOpen size={16} />
          <span>Open File</span>
        </button>
        <button type="button" onClick={() => launchWorkspace('open-folder')}>
          <FolderTree size={16} />
          <span>Open Folder</span>
        </button>
        <button type="button" onClick={() => launchWorkspace('open-file')}>
          <Package size={16} />
          <span>Import Robot</span>
        </button>
        <a href="#recent-projects">
          <History size={16} />
          <span>Recent Projects</span>
        </a>
      </section>

      <section className="startup-template-section">
        <div className="startup-section-title">
          <div>
            <span>Start a new robot</span>
            <h2>Template Gallery</h2>
          </div>
          <button type="button" className="startup-section-link">
            Template gallery
            <ChevronRight size={15} />
          </button>
        </div>

        <div className="startup-template-strip">
          <motion.button
            type="button"
            className="startup-new-document-card"
            onClick={() => launchWorkspace('new')}
            whileHover={{ y: -4, scale: 1.012 }}
            whileTap={{ scale: 0.99 }}
          >
            <span className="startup-new-plus">
              <Plus size={38} />
            </span>
            <strong>New URDF</strong>
            <small>Create a new robot description</small>
          </motion.button>

          {filteredTemplates.map((template) => (
            <motion.button
              key={template.id}
              type="button"
              className="startup-template-card"
              onClick={() => launchWorkspace('open-template', { templateId: template.id })}
              whileHover={{ y: -4, scale: 1.012 }}
              whileTap={{ scale: 0.99 }}
            >
              <TemplatePreview template={template} />
              <span className="startup-template-icon">{template.icon}</span>
              <strong>{template.name}</strong>
              <small>{template.subtitle}</small>
            </motion.button>
          ))}
        </div>
      </section>

      <section className="startup-recent-section" id="recent-projects">
        <div className="startup-section-title">
          <div>
            <span>Continue work</span>
            <h2>Recent Projects</h2>
          </div>
          <div className="startup-recent-tools">
            <span>{filteredProjects.length + (pendingProject ? 1 : 0)} shown</span>
          </div>
        </div>

        <div className="startup-recent-grid">
          {pendingProject ? (
            <motion.button
              type="button"
              className="startup-project-card is-draft"
              onClick={() => launchWorkspace('open-recent', { draft: true })}
              whileHover={{ y: -3, scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <RecentPreview project={pendingProject} />
              <div className="startup-project-body">
                <span className="startup-badge is-draft">Unsaved Draft Available</span>
                <strong>{displayProjectName(pendingProject)}</strong>
                <small>{pendingProject.filePath}</small>
                <span className="startup-card-meta">
                  <Clock3 size={14} />
                  Restore previous session
                </span>
              </div>
            </motion.button>
          ) : null}

          {filteredProjects.map((project) => (
            <motion.div
              key={project.filePath}
              role="button"
              tabIndex={0}
              className="startup-project-card"
              onClick={() => launchWorkspace('open-recent', { filePath: project.filePath })}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  launchWorkspace('open-recent', { filePath: project.filePath })
                }
              }}
              title={project.filePath}
              whileHover={{ y: -3, scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <button
                type="button"
                className="startup-remove-recent"
                title="Remove from recent"
                onClick={(event) => void removeRecent(event, project.filePath)}
              >
                <X size={14} />
              </button>
              <RecentPreview project={project} />
              <div className="startup-project-body">
                <span className="startup-badge">
                  {workspaceKindIcon(project.workspaceKind)}
                  {workspaceKindLabel(project.workspaceKind)}
                </span>
                <strong>{displayProjectName(project)}</strong>
                <small>{project.workspaceRoot ?? project.filePath}</small>
                <span className="startup-card-meta">
                  <Clock3 size={14} />
                  Opened {formatTimestamp(project.lastEditedAt ?? project.lastOpenedAt)}
                </span>
              </div>
            </motion.div>
          ))}

          {!pendingProject && !filteredProjects.length ? (
            <div className="startup-empty-state">
              <div className="startup-empty-illustration">
                <Bot size={38} />
              </div>
              <strong>No recent projects yet</strong>
              <span>Create your first URDF robot or open an existing robot package.</span>
              <button type="button" onClick={() => launchWorkspace('new')}>
                Create your first URDF robot
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <footer className="startup-footer">
        <span>URDF Builder desktop workspace</span>
        <span>Preview cache: .cache/previews</span>
        <span>Documentation and examples ready for robotics workflows</span>
      </footer>
    </motion.main>
  )
}
