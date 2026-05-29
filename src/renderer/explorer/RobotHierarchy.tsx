import {
  Bot,
  Box,
  ChevronDown,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  Copy,
  Eye,
  EyeOff,
  Focus,
  GitBranch,
  Link2,
  Package,
  Pencil,
  Plus,
  Radio,
  Trash2,
} from 'lucide-react'
import { useMemo, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import {
  ContextMenu,
  type ContextMenuItem,
} from '../../components/ContextMenu'
import { IconButton } from '../../components/IconButton'
import { PanelHeader } from '../../components/PanelHeader'
import { buildRobotHierarchy, type RobotNode } from '../../core/robot-model/hierarchy'
import {
  allHierarchyIds,
  collectAncestorIds,
  collectSubtreeIds,
  entityIdsForSelection,
  isEntityEffectivelyVisible,
  isEntityExplicitlyVisible,
  isLayerVisibleForNode,
} from '../../core/robot-model/visibility'
import { logContextMenuMouseEvent, pointFromKeyboardEvent } from '../../lib/contextMenuPosition'
import { useProjectStore } from '../../store/useProjectStore'
import { useWorkspaceStore } from '../../store/useWorkspaceStore'

function nodeIcon(node: RobotNode) {
  if (node.type === 'robot') {
    return <Bot size={14} />
  }

  if (node.type === 'joint') {
    return <GitBranch size={14} />
  }

  if (node.type === 'sensor') {
    return <Radio size={14} />
  }

  if (node.type === 'mesh') {
    return <Package size={14} />
  }

  return <Box size={14} />
}

function nodeSubtitle(node: RobotNode) {
  if (node.type === 'joint') {
    return node.metadata?.jointType
  }

  if (node.type === 'sensor') {
    return node.metadata?.jointType
  }

  if (node.type === 'mesh') {
    return node.metadata?.meshRole
  }

  return undefined
}

function isNodeActive(node: RobotNode, selection: ReturnType<typeof useProjectStore.getState>['selection']) {
  return selection.kind === node.selection.kind && selection.id === node.selection.id
}

export function RobotHierarchy() {
  const robot = useProjectStore((state) => state.robot)
  const selection = useProjectStore((state) => state.selection)
  const select = useProjectStore((state) => state.select)
  const setViewPreset = useProjectStore((state) => state.setViewPreset)
  const addLink = useProjectStore((state) => state.addLink)
  const addChildLink = useProjectStore((state) => state.addChildLink)
  const addJoint = useProjectStore((state) => state.addJoint)
  const addSensor = useProjectStore((state) => state.addSensor)
  const duplicateLink = useProjectStore((state) => state.duplicateLink)
  const deleteSelection = useProjectStore((state) => state.deleteSelection)
  const renameRobot = useProjectStore((state) => state.renameRobot)
  const renameLink = useProjectStore((state) => state.renameLink)
  const updateJoint = useProjectStore((state) => state.updateJoint)
  const entityVisibility = useWorkspaceStore((state) => state.entityVisibility)
  const layerVisibility = useWorkspaceStore((state) => state.layerVisibility)
  const showHiddenItems = useWorkspaceStore((state) => state.showHiddenItems)
  const setEntitySubtreeVisibility = useWorkspaceStore((state) => state.setEntitySubtreeVisibility)
  const isolateEntities = useWorkspaceStore((state) => state.isolateEntities)
  const revealAllEntities = useWorkspaceStore((state) => state.revealAllEntities)
  const toggleShowHiddenItems = useWorkspaceStore((state) => state.toggleShowHiddenItems)
  const hierarchy = useMemo(() => buildRobotHierarchy(robot), [robot])
  const expandableIds = useMemo(
    () => Object.values(hierarchy.nodes).filter((node) => node.children.length).map((node) => node.id),
    [hierarchy],
  )
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const [menu, setMenu] = useState<{ x: number; y: number; title: string; items: ContextMenuItem[] } | null>(
    null,
  )

  function expandAll() {
    setCollapsed(new Set())
  }

  function collapseAll() {
    setCollapsed(new Set(expandableIds.filter((id) => id !== hierarchy.rootId)))
  }

  function collectDescendants(nodeId: string) {
    const ids: string[] = []
    const node = hierarchy.nodes[nodeId]

    if (!node) {
      return ids
    }

    node.children.forEach((childId) => {
      ids.push(childId, ...collectDescendants(childId))
    })

    return ids
  }

  function expandBranch(nodeId: string) {
    setCollapsed((current) => {
      const next = new Set(current)

      next.delete(nodeId)
      collectDescendants(nodeId).forEach((id) => {
        next.delete(id)
      })

      return next
    })
  }

  function collapseBranch(nodeId: string) {
    setCollapsed((current) => {
      const next = new Set(current)
      const collapsibleIds = [nodeId, ...collectDescendants(nodeId)].filter(
        (id) => id !== hierarchy.rootId && Boolean(hierarchy.nodes[id]?.children.length),
      )

      collapsibleIds.forEach((id) => next.add(id))

      return next
    })
  }

  function toggleNode(nodeId: string) {
    setCollapsed((current) => {
      const next = new Set(current)

      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }

      return next
    })
  }

  function renameNode(node: RobotNode) {
    const nextName = window.prompt('Rename', node.name)

    if (!nextName || nextName === node.name) {
      return
    }

    if (node.type === 'robot') {
      renameRobot(nextName)
      return
    }

    if (node.type === 'link') {
      renameLink(node.name, nextName)
      return
    }

    if (node.type === 'joint') {
      updateJoint(node.name, { name: nextName })
    }
  }

  function isNodeVisible(node: RobotNode) {
    return (
      isEntityEffectivelyVisible(hierarchy, entityVisibility, node.id) &&
      isLayerVisibleForNode(node, layerVisibility)
    )
  }

  function toggleNodeVisibility(node: RobotNode) {
    const nextVisible = !isEntityExplicitlyVisible(entityVisibility, node.id)
    setEntitySubtreeVisibility(collectSubtreeIds(hierarchy, node.id), nextVisible)
  }

  function isolateNode(node: RobotNode) {
    isolateEntities(
      [...collectAncestorIds(hierarchy, node.id), ...collectSubtreeIds(hierarchy, node.id)],
      allHierarchyIds(hierarchy),
    )
  }

  function isolateCurrentSelection() {
    isolateEntities(
      entityIdsForSelection(hierarchy, selection, robot.name, {
        includeAncestors: true,
        includeDescendants: true,
      }),
      allHierarchyIds(hierarchy),
    )
  }

  function openNodeMenu(node: RobotNode, x: number, y: number) {
    select(node.selection)

    const isRobot = node.type === 'robot'
    const isLink = node.type === 'link'
    const isJoint = node.type === 'joint'
    const linkName = node.metadata?.linkName ?? (isLink ? node.name : undefined)
    const explicitVisible = isEntityExplicitlyVisible(entityVisibility, node.id)
    const items: ContextMenuItem[] = [
      {
        id: 'visibility',
        label: explicitVisible ? 'Hide Subtree' : 'Show Subtree',
        icon: explicitVisible ? <EyeOff size={15} /> : <Eye size={15} />,
        onSelect: () => toggleNodeVisibility(node),
      },
      {
        id: 'isolate',
        label: 'Isolate Selection',
        icon: <Focus size={15} />,
        onSelect: () => isolateNode(node),
      },
      {
        id: 'reveal-all',
        label: 'Reveal All',
        icon: <Eye size={15} />,
        onSelect: revealAllEntities,
      },
      {
        id: 'expand',
        label: 'Recursive Expand',
        icon: <ChevronsDown size={15} />,
        disabled: !node.children.length,
        onSelect: () => expandBranch(node.id),
      },
      {
        id: 'collapse',
        label: 'Recursive Collapse',
        icon: <ChevronsUp size={15} />,
        disabled: !node.children.length,
        onSelect: () => collapseBranch(node.id),
      },
      {
        id: 'focus',
        label: 'Focus in Viewport',
        icon: <Focus size={15} />,
        onSelect: () => setViewPreset('perspective'),
      },
      {
        id: 'rename',
        label: 'Rename',
        icon: <Pencil size={15} />,
        disabled: node.type === 'sensor' || node.type === 'mesh',
        onSelect: () => renameNode(node),
      },
    ]

    if (isRobot) {
      items.push(
        { id: 'create-link', label: 'Create Link', icon: <Plus size={15} />, onSelect: addLink },
        {
          id: 'create-joint',
          label: 'Create Joint',
          icon: <GitBranch size={15} />,
          onSelect: () => addJoint('fixed'),
        },
        {
          id: 'attach-sensor',
          label: 'Attach Sensor',
          icon: <Radio size={15} />,
          onSelect: () => addSensor('camera'),
        },
      )
    }

    if (isLink && linkName) {
      items.push(
        {
          id: 'create-child',
          label: 'Create Child Link',
          icon: <Plus size={15} />,
          onSelect: () => addChildLink(linkName),
        },
        {
          id: 'create-joint',
          label: 'Create Joint',
          icon: <GitBranch size={15} />,
          onSelect: () => addJoint('fixed', linkName),
        },
        {
          id: 'duplicate',
          label: 'Duplicate',
          icon: <Copy size={15} />,
          onSelect: () => duplicateLink(linkName),
        },
        {
          id: 'attach-mesh',
          label: 'Attach Mesh',
          icon: <Link2 size={15} />,
          disabled: true,
          onSelect: () => undefined,
        },
        {
          id: 'attach-sensor',
          label: 'Attach Sensor',
          icon: <Radio size={15} />,
          onSelect: () => addSensor('camera'),
        },
        {
          id: 'create-parent',
          label: 'Create Parent Link',
          disabled: true,
          onSelect: () => undefined,
        },
      )
    }

    if (isJoint) {
      items.push({
        id: 'delete-joint',
        label: 'Delete Joint',
        icon: <Trash2 size={15} />,
        onSelect: deleteSelection,
      })
    }

    if (isLink) {
      items.push({
        id: 'delete-link',
        label: 'Delete',
        icon: <Trash2 size={15} />,
        onSelect: deleteSelection,
      })
    }

    setMenu({
      x,
      y,
      title: node.name,
      items,
    })
  }

  function openNodePointerMenu(event: MouseEvent, node: RobotNode) {
    event.preventDefault()
    logContextMenuMouseEvent(`hierarchy:${node.type}`, event)
    openNodeMenu(node, event.clientX, event.clientY)
  }

  function openNodeKeyboardMenu(event: KeyboardEvent, node: RobotNode) {
    if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) {
      return
    }

    event.preventDefault()
    const point = pointFromKeyboardEvent(event, 0)
    openNodeMenu(node, point.x, point.y)
  }

  function renderNode(nodeId: string, depth = 0): ReactNode {
    const node = hierarchy.nodes[nodeId]

    if (!node) {
      return null
    }

    const hasChildren = node.children.length > 0
    const isExpanded = hasChildren && !collapsed.has(nodeId)
    const subtitle = nodeSubtitle(node)
    const explicitVisible = isEntityExplicitlyVisible(entityVisibility, node.id)
    const isVisible = isNodeVisible(node)
    const inheritedHidden = explicitVisible && !isVisible

    if (!showHiddenItems && !isVisible) {
      return null
    }

    return (
      <div key={nodeId} className="hierarchy-node">
        <button
          type="button"
          className={`tree-row hierarchy-row hierarchy-row-${node.type} ${
            isNodeActive(node, selection) ? 'is-active' : ''
          } ${isVisible ? '' : 'is-hidden'} ${inheritedHidden ? 'is-inherited-hidden' : ''}`}
          style={{ paddingLeft: `${8 + depth * 18}px` }}
          title={subtitle ? `${node.name} (${subtitle})` : node.name}
          aria-haspopup="menu"
          onClick={() => select(node.selection)}
          onDoubleClick={() => setViewPreset('perspective')}
          onContextMenu={(event) => openNodePointerMenu(event, node)}
          onKeyDown={(event) => openNodeKeyboardMenu(event, node)}
        >
          <span
            className={`hierarchy-chevron ${hasChildren ? '' : 'is-empty'}`}
            onClick={(event) => {
              event.stopPropagation()

              if (hasChildren) {
                toggleNode(nodeId)
              }
            }}
          >
            {hasChildren && isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </span>
          <span className="hierarchy-icon">{nodeIcon(node)}</span>
          <span
            className={`hierarchy-visibility ${isVisible ? '' : 'is-off'}`}
            role="button"
            tabIndex={-1}
            title={explicitVisible ? 'Hide subtree in viewport' : 'Show subtree in viewport'}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              toggleNodeVisibility(node)
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') {
                return
              }

              event.preventDefault()
              event.stopPropagation()
              toggleNodeVisibility(node)
            }}
          >
            {explicitVisible ? <Eye size={13} /> : <EyeOff size={13} />}
          </span>
          <span className="hierarchy-label">{node.name}</span>
          {subtitle ? <span className="hierarchy-meta">{subtitle}</span> : null}
        </button>
        {hasChildren && isExpanded ? (
          <div className="hierarchy-children">
            {node.children.map((childId) => renderNode(childId, depth + 1))}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <aside className="robot-hierarchy">
      <PanelHeader
        title="Hierarchy"
        actions={
          <>
            <IconButton icon={<Focus size={14} />} label="Isolate Selection" onClick={isolateCurrentSelection} />
            <IconButton icon={<Eye size={14} />} label="Reveal All" onClick={revealAllEntities} />
            <IconButton
              icon={showHiddenItems ? <EyeOff size={14} /> : <Eye size={14} />}
              label={showHiddenItems ? 'Hide Hidden Rows' : 'Show Hidden Rows'}
              onClick={toggleShowHiddenItems}
            />
            <IconButton icon={<ChevronsDown size={14} />} label="Expand Hierarchy" onClick={expandAll} />
            <IconButton icon={<ChevronsUp size={14} />} label="Collapse Hierarchy" onClick={collapseAll} />
          </>
        }
      />
      <div className="hierarchy-summary">
        <span>{robot.links.length} links</span>
        <span>{robot.joints.length} joints</span>
        <span>{robot.sensors.length} sensors</span>
      </div>
      <div className="hierarchy-tree">{renderNode(hierarchy.rootId)}</div>
      {menu ? (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          debugSource="hierarchy"
          title={menu.title}
          items={menu.items}
          onClose={() => setMenu(null)}
        />
      ) : null}
    </aside>
  )
}
