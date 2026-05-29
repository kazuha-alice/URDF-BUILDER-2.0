import type { SelectionRef } from './types'
import type { RobotHierarchyModel, RobotNode } from './hierarchy'

export type SelectionMode = 'robot' | 'link' | 'joint' | 'mesh' | 'sensor'
export type TransformScope = 'robot' | 'subtree' | 'entity'
export type VisibilityLayer = 'visual' | 'collision' | 'sensor' | 'tf' | 'joint' | 'debug' | 'grid' | 'axes'

export interface VisibilityState {
  visible: boolean
  inheritedHidden: boolean
  effectiveVisible: boolean
}

export type EntityVisibilityMap = Record<string, VisibilityState>
export type VisibilityLayerState = Record<VisibilityLayer, boolean>

export const defaultLayerVisibility: VisibilityLayerState = {
  visual: true,
  collision: false,
  sensor: false,
  tf: true,
  joint: false,
  debug: false,
  grid: true,
  axes: true,
}

export function entityIdForSelection(selection: SelectionRef, robotName: string) {
  if (selection.kind === 'robot') {
    return `robot:${selection.id || robotName || 'robot'}`
  }

  if (selection.kind === 'mesh') {
    return selection.id
  }

  return `${selection.kind}:${selection.id}`
}

export function visibilityState(
  visibility: EntityVisibilityMap,
  entityId: string,
): VisibilityState {
  return visibility[entityId] ?? { visible: true, inheritedHidden: false, effectiveVisible: true }
}

export function isEntityExplicitlyVisible(visibility: EntityVisibilityMap, entityId: string) {
  return visibilityState(visibility, entityId).visible
}

export function collectDescendantIds(hierarchy: RobotHierarchyModel, nodeId: string): string[] {
  const node = hierarchy.nodes[nodeId]

  if (!node) {
    return []
  }

  return node.children.flatMap((childId) => [childId, ...collectDescendantIds(hierarchy, childId)])
}

export function collectAncestorIds(hierarchy: RobotHierarchyModel, nodeId: string): string[] {
  const ids: string[] = []
  let current = hierarchy.nodes[nodeId]?.parentId ?? null

  while (current) {
    ids.push(current)
    current = hierarchy.nodes[current]?.parentId ?? null
  }

  return ids
}

export function collectSubtreeIds(hierarchy: RobotHierarchyModel, nodeId: string): string[] {
  return hierarchy.nodes[nodeId] ? [nodeId, ...collectDescendantIds(hierarchy, nodeId)] : []
}

export function allHierarchyIds(hierarchy: RobotHierarchyModel) {
  return Object.keys(hierarchy.nodes)
}

export function entityIdsForSelection(
  hierarchy: RobotHierarchyModel,
  selection: SelectionRef,
  robotName: string,
  options: { includeAncestors?: boolean; includeDescendants?: boolean } = {},
) {
  const entityId = entityIdForSelection(selection, robotName)
  const ids = new Set<string>()

  if (!hierarchy.nodes[entityId]) {
    ids.add(entityId)
    return [...ids]
  }

  ids.add(entityId)

  if (options.includeAncestors) {
    collectAncestorIds(hierarchy, entityId).forEach((id) => ids.add(id))
  }

  if (options.includeDescendants) {
    collectDescendantIds(hierarchy, entityId).forEach((id) => ids.add(id))
  }

  return [...ids]
}

export function isEntityEffectivelyVisible(
  hierarchy: RobotHierarchyModel,
  visibility: EntityVisibilityMap,
  entityId: string,
) {
  if (!isEntityExplicitlyVisible(visibility, entityId)) {
    return false
  }

  return collectAncestorIds(hierarchy, entityId).every((ancestorId) =>
    isEntityExplicitlyVisible(visibility, ancestorId),
  )
}

export function layerForNode(node: RobotNode): VisibilityLayer | null {
  if (node.type === 'mesh') {
    return node.metadata?.meshRole === 'collision' ? 'collision' : 'visual'
  }

  if (node.type === 'joint') {
    return 'joint'
  }

  if (node.type === 'sensor') {
    return 'sensor'
  }

  return null
}

export function isLayerVisibleForNode(node: RobotNode, layers: VisibilityLayerState) {
  const layer = layerForNode(node)

  return layer ? layers[layer] : true
}
