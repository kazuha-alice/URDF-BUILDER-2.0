import '@xyflow/react/dist/style.css'
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react'
import { Bot, Box, GitBranch, Radio } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { PanelHeader } from '../../components/PanelHeader'
import {
  buildRobotHierarchy,
  flattenRobotHierarchy,
  type RobotNode,
  type RobotNodeType,
} from '../../core/robot-model/hierarchy'
import type { SelectionRef } from '../../core/robot-model/types'
import { useProjectStore } from '../../store/useProjectStore'
import { useTheme } from '../../theme/theme'

type TfNodeData = {
  label: ReactNode
  selection: SelectionRef
  nodeType: RobotNodeType
}

function isTfNode(node: RobotNode) {
  return node.type !== 'mesh'
}

function isActiveNode(node: RobotNode, selection: SelectionRef) {
  return node.selection.kind === selection.kind && node.selection.id === selection.id
}

function iconForNode(node: RobotNode) {
  if (node.type === 'robot') {
    return <Bot size={14} />
  }

  if (node.type === 'joint') {
    return <GitBranch size={14} />
  }

  if (node.type === 'sensor') {
    return <Radio size={14} />
  }

  return <Box size={14} />
}

function subtitleForNode(node: RobotNode) {
  if (node.type === 'joint') {
    return node.metadata?.jointType ?? 'joint'
  }

  if (node.type === 'sensor') {
    return node.metadata?.jointType ?? 'sensor'
  }

  return node.type
}

function nodeLabel(node: RobotNode) {
  return (
    <div className="tf-node-label">
      <span className="tf-node-icon">{iconForNode(node)}</span>
      <span className="tf-node-copy">
        <strong>{node.name}</strong>
        <small>{subtitleForNode(node)}</small>
      </span>
    </div>
  )
}

export function TfGraphPanel() {
  const robot = useProjectStore((state) => state.robot)
  const selection = useProjectStore((state) => state.selection)
  const select = useProjectStore((state) => state.select)
  const setViewPreset = useProjectStore((state) => state.setViewPreset)
  const { mode } = useTheme()
  const hierarchy = useMemo(() => buildRobotHierarchy(robot), [robot])
  const graph = useMemo(() => {
    const rows = flattenRobotHierarchy(hierarchy, isTfNode)
    const rowByDepth = new Map<number, number>()
    const visibleIds = new Set(rows.map((row) => row.id))
    const nodes: Node<TfNodeData>[] = rows.map(({ id, node, depth }) => {
      const rowIndex = rowByDepth.get(depth) ?? 0

      rowByDepth.set(depth, rowIndex + 1)

      return {
        id,
        type: 'default',
        position: {
          x: depth * 230,
          y: rowIndex * 92,
        },
        data: {
          label: nodeLabel(node),
          selection: node.selection,
          nodeType: node.type,
        },
        className: `tf-node tf-node-${node.type} ${isActiveNode(node, selection) ? 'is-selected' : ''}`,
        draggable: false,
        selectable: true,
      }
    })
    const edges: Edge[] = []

    Object.values(hierarchy.nodes).forEach((node) => {
      if (!visibleIds.has(node.id)) {
        return
      }

      node.children.forEach((childId) => {
        if (!visibleIds.has(childId)) {
          return
        }

        edges.push({
          id: `${node.id}->${childId}`,
          source: node.id,
          target: childId,
          type: 'smoothstep',
          markerEnd: {
            type: MarkerType.ArrowClosed,
          },
          className: 'tf-edge',
        })
      })
    })

    return { nodes, edges }
  }, [hierarchy, selection])

  return (
    <aside className="tf-graph-panel">
      <PanelHeader title="TF View" />
      <div className="tf-graph-summary">
        <span>{robot.links.length} frames</span>
        <span>{robot.joints.length} transforms</span>
        <span>{robot.sensors.length} sensor frames</span>
      </div>
      <div className="tf-graph-canvas">
        <ReactFlow
          nodes={graph.nodes}
          edges={graph.edges}
          colorMode={mode}
          fitView
          fitViewOptions={{ padding: 0.22 }}
          minZoom={0.18}
          maxZoom={2.1}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          proOptions={{ hideAttribution: true }}
          onNodeClick={(_, node) => select(node.data.selection)}
          onNodeDoubleClick={(_, node) => {
            select(node.data.selection)
            setViewPreset('perspective')
          }}
        >
          <Background gap={22} size={1} />
          <MiniMap pannable zoomable nodeStrokeWidth={2} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </aside>
  )
}
