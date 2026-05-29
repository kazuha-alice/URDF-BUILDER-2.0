import {
  Box,
  Camera,
  Check,
  Code2,
  FilePlus2,
  FolderOpen,
  HelpCircle,
  Home,
  Layers3,
  Minus,
  Moon,
  Package,
  PanelLeftClose,
  RotateCcw,
  Save,
  SaveAll,
  Square,
  Sun,
  Redo2,
  Undo2,
  X,
} from 'lucide-react'
import type { MouseEvent, ReactNode } from 'react'
import logoUrl from '../../icons/urdf-builder.png'
import { IconButton } from '../../components/IconButton'
import { useTheme } from '../../theme/theme'
import { useProjectStore, type CameraMode, type ViewPreset } from '../../store/useProjectStore'
import type { useFileCommands } from '../../hooks/useFileCommands'
import type { DockPanelId } from '../../store/useWorkspaceStore'
import { panelIds, panelTitles, useWorkspaceStore } from '../../store/useWorkspaceStore'

type FileCommands = ReturnType<typeof useFileCommands>

interface RibbonProps {
  commands: FileCommands
  detachedPanelId?: DockPanelId | null
  detachedPanelTitle?: string
}

function RibbonMenu({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="ribbon-menu">
      <button type="button" className="ribbon-menu-trigger">
        {label}
      </button>
      <div className="ribbon-menu-popover">{children}</div>
    </div>
  )
}

function MenuButton({
  icon,
  label,
  onClick,
  disabled,
  checked,
}: {
  icon: ReactNode
  label: string
  onClick?: () => void
  disabled?: boolean
  checked?: boolean
}) {
  return (
    <button
      type="button"
      className={`ribbon-menu-item ${checked ? 'is-checked' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
      <span>{label}</span>
      {checked ? <Check size={14} className="ribbon-menu-check" /> : null}
    </button>
  )
}

function WindowControls({
  commands,
  panelId,
}: {
  commands: FileCommands
  panelId?: DockPanelId | null
}) {
  return (
    <div className="window-controls">
      {panelId ? (
        <button
          type="button"
          className="window-control window-control-dock"
          onClick={() => void commands.dockPanelBack(panelId)}
          title="Dock Panel Back"
        >
          <PanelLeftClose size={15} />
        </button>
      ) : null}
      <button
        type="button"
        className="window-control"
        onClick={() => void commands.minimizeWindow()}
        title="Minimize"
      >
        <Minus size={15} />
      </button>
      <button
        type="button"
        className="window-control"
        onClick={() => void commands.toggleMaximizeWindow()}
        title="Maximize or Restore"
      >
        <Square size={13} />
      </button>
      <button
        type="button"
        className="window-control window-control-close"
        onClick={() => void commands.closeWindow(panelId)}
        title="Close"
      >
        <X size={15} />
      </button>
    </div>
  )
}

export function Ribbon({ commands, detachedPanelId, detachedPanelTitle }: RibbonProps) {
  const { mode, toggleMode } = useTheme()
  const document = useProjectStore((state) => state.document)
  const cameraMode = useProjectStore((state) => state.cameraMode)
  const setCameraMode = useProjectStore((state) => state.setCameraMode)
  const setViewPreset = useProjectStore((state) => state.setViewPreset)
  const addLink = useProjectStore((state) => state.addLink)
  const addJoint = useProjectStore((state) => state.addJoint)
  const addSensor = useProjectStore((state) => state.addSensor)
  const panels = useWorkspaceStore((state) => state.panels)

  const setCamera = (mode: CameraMode) => setCameraMode(mode)
  const setView = (preset: ViewPreset) => setViewPreset(preset)
  const isDetachedPanel = Boolean(detachedPanelId)

  function handleDoubleClick(event: MouseEvent<HTMLElement>) {
    const target = event.target as HTMLElement

    if (target.closest('button, input, select, textarea, .ribbon-tabs, .window-controls')) {
      return
    }

    void commands.toggleMaximizeWindow()
  }

  return (
    <header className={`app-ribbon app-titlebar ${isDetachedPanel ? 'is-panel-window' : ''}`} onDoubleClick={handleDoubleClick}>
      <div className="app-brand">
        <img src={logoUrl} alt="" />
        <div>
          <strong>{isDetachedPanel ? `URDF Builder - ${detachedPanelTitle}` : 'URDF Builder'}</strong>
          <span>{isDetachedPanel ? document.fileName : document.fileName}</span>
        </div>
      </div>

      {isDetachedPanel ? (
        <div className="panel-window-title">
          <span>{detachedPanelTitle}</span>
          <small>{document.fileName}</small>
        </div>
      ) : (
      <nav className="ribbon-tabs" aria-label="Application ribbon">
        <RibbonMenu label="File">
          <MenuButton icon={<Home size={16} />} label="Home" onClick={commands.showDashboard} />
          <MenuButton icon={<FilePlus2 size={16} />} label="New" onClick={commands.createNew} />
          <MenuButton icon={<FolderOpen size={16} />} label="Open URDF" onClick={commands.openUrdf} />
          <MenuButton icon={<Save size={16} />} label="Save" onClick={() => void commands.saveUrdf()} />
          <MenuButton icon={<SaveAll size={16} />} label="Save As" onClick={commands.saveAs} />
          <MenuButton
            icon={<Package size={16} />}
            label="Export URDF Package"
            onClick={commands.exportPackage}
          />
          <div className="ribbon-menu-divider" />
          {document.recentFiles.length ? (
            document.recentFiles.map((filePath) => (
              <button
                key={filePath}
                type="button"
                className="ribbon-recent-item"
                onClick={() => void commands.openRecent(filePath)}
                title={filePath}
              >
                {filePath}
              </button>
            ))
          ) : (
            <span className="ribbon-empty">No recent files</span>
          )}
        </RibbonMenu>

        <RibbonMenu label="Edit">
          <MenuButton icon={<Undo2 size={16} />} label="Undo" onClick={commands.undo} />
          <MenuButton icon={<Redo2 size={16} />} label="Redo" onClick={commands.redo} />
          <div className="ribbon-menu-divider" />
          <MenuButton icon={<Code2 size={16} />} label="Detach Editor" onClick={commands.detachEditor} />
          <MenuButton icon={<RotateCcw size={16} />} label="Reset Pose" disabled />
        </RibbonMenu>

        <RibbonMenu label="View">
          <MenuButton icon={<Camera size={16} />} label="Perspective" onClick={() => setView('perspective')} />
          <MenuButton icon={<Camera size={16} />} label="Orthographic" onClick={() => setCamera('orthographic')} />
          <MenuButton icon={<Camera size={16} />} label="Front" onClick={() => setView('front')} />
          <MenuButton icon={<Camera size={16} />} label="Top" onClick={() => setView('top')} />
          <MenuButton icon={<Camera size={16} />} label="Side" onClick={() => setView('right')} />
          <MenuButton icon={<Home size={16} />} label="Reset Camera" onClick={() => setView('perspective')} />
          <div className="ribbon-menu-divider" />
          {panelIds.map((panelId) => (
            <MenuButton
              key={panelId}
              icon={<Check size={16} />}
              label={panelTitles[panelId]}
              checked={panels[panelId]?.placement !== 'hidden'}
              onClick={() => void commands.restorePanel(panelId)}
            />
          ))}
          <div className="ribbon-menu-divider" />
          <MenuButton icon={<PanelLeftClose size={16} />} label="Reset Layout" onClick={() => void commands.resetLayout()} />
          <MenuButton
            icon={<PanelLeftClose size={16} />}
            label="Restore Default Layout"
            onClick={() => void commands.resetLayout()}
          />
        </RibbonMenu>

        <RibbonMenu label="Insert">
          <MenuButton icon={<Box size={16} />} label="Link" onClick={addLink} />
          <MenuButton icon={<Layers3 size={16} />} label="Joint" onClick={() => addJoint('fixed')} />
          <MenuButton icon={<Package size={16} />} label="Mesh" disabled />
          <MenuButton icon={<Camera size={16} />} label="Sensor" onClick={() => addSensor('camera')} />
          <MenuButton icon={<Box size={16} />} label="Robot Base" disabled />
          <MenuButton icon={<Layers3 size={16} />} label="Differential Drive" disabled />
        </RibbonMenu>

        <RibbonMenu label="Robot">
          <MenuButton icon={<HelpCircle size={16} />} label="Validate URDF" disabled />
          <MenuButton icon={<RotateCcw size={16} />} label="Reset Pose" disabled />
          <MenuButton icon={<Home size={16} />} label="Home Pose" disabled />
          <MenuButton icon={<Layers3 size={16} />} label="Joint Controller" disabled />
          <MenuButton icon={<Camera size={16} />} label="Sensor Preview" disabled />
        </RibbonMenu>

        <RibbonMenu label="Export">
          <MenuButton
            icon={<Package size={16} />}
            label="Export URDF Package"
            onClick={commands.exportPackage}
          />
        </RibbonMenu>

        <RibbonMenu label="Help">
          <MenuButton icon={<HelpCircle size={16} />} label="URDF Builder Help" disabled />
        </RibbonMenu>
      </nav>
      )}

      <div className="ribbon-actions">
        {isDetachedPanel ? null : (
          <IconButton
            icon={cameraMode === 'perspective' ? <Camera size={16} /> : <Box size={16} />}
            label={cameraMode === 'perspective' ? 'Perspective Camera' : 'Orthographic Camera'}
            active={cameraMode === 'orthographic'}
            onClick={() => setCamera(cameraMode === 'perspective' ? 'orthographic' : 'perspective')}
          />
        )}
        <IconButton
          icon={mode === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
          label="Toggle Theme"
          onClick={toggleMode}
        />
        <WindowControls commands={commands} panelId={detachedPanelId} />
      </div>
    </header>
  )
}
