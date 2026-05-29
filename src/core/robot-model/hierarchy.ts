import type { RobotModel, SelectionRef, Vector3Tuple } from './types'
import { meshSelectionId } from './selection'

export type RobotNodeType = 'robot' | 'link' | 'joint' | 'sensor' | 'mesh'

export interface RobotNode {
  id: string
  name: string
  type: RobotNodeType
  parentId: string | null
  children: string[]
  selection: SelectionRef
  transform?: {
    position: [number, number, number]
    rotation: [number, number, number]
  }
  metadata?: {
    linkName?: string
    jointType?: string
    meshRole?: 'visual' | 'collision'
    filename?: string
  }
}

export interface RobotHierarchyModel {
  rootId: string
  nodes: Record<string, RobotNode>
}

const robotId = (name: string) => `robot:${name || 'robot'}`
const linkId = (name: string) => `link:${name}`
const jointId = (name: string) => `joint:${name}`
const sensorId = (name: string) => `sensor:${name}`
const meshId = meshSelectionId

function tupleFromVector(value?: Vector3Tuple): [number, number, number] {
  return [value?.x ?? 0, value?.y ?? 0, value?.z ?? 0]
}

function addChild(nodes: Record<string, RobotNode>, parentId: string, childId: string) {
  const parent = nodes[parentId]

  if (!parent || parent.children.includes(childId)) {
    return
  }

  parent.children.push(childId)
}

function setParent(nodes: Record<string, RobotNode>, childId: string, parentId: string | null) {
  const child = nodes[childId]

  if (!child) {
    return
  }

  child.parentId = parentId

  if (parentId) {
    addChild(nodes, parentId, childId)
  }
}

export function buildRobotHierarchy(robot: RobotModel): RobotHierarchyModel {
  const rootId = robotId(robot.name)
  const nodes: Record<string, RobotNode> = {
    [rootId]: {
      id: rootId,
      name: robot.name || 'Robot',
      type: 'robot',
      parentId: null,
      children: [],
      selection: { kind: 'robot', id: robot.name },
    },
  }

  robot.links.forEach((link) => {
    nodes[linkId(link.name)] = {
      id: linkId(link.name),
      name: link.name,
      type: 'link',
      parentId: null,
      children: [],
      selection: { kind: 'link', id: link.name },
      transform: link.transform
        ? {
            position: tupleFromVector(link.transform.position),
            rotation: tupleFromVector(link.transform.rotation),
          }
        : undefined,
      metadata: { linkName: link.name },
    }
  })

  robot.joints.forEach((joint) => {
    nodes[jointId(joint.name)] = {
      id: jointId(joint.name),
      name: joint.name,
      type: 'joint',
      parentId: null,
      children: [],
      selection: { kind: 'joint', id: joint.name },
      transform: {
        position: tupleFromVector(joint.origin.xyz),
        rotation: tupleFromVector(joint.origin.rpy),
      },
      metadata: {
        jointType: joint.type,
        linkName: joint.child,
      },
    }
  })

  robot.joints.forEach((joint) => {
    const currentJointId = jointId(joint.name)
    const parentLinkId = linkId(joint.parent)
    const childLinkId = linkId(joint.child)

    setParent(nodes, currentJointId, nodes[parentLinkId] ? parentLinkId : rootId)

    if (nodes[childLinkId]) {
      setParent(nodes, childLinkId, currentJointId)
    }
  })

  robot.links.forEach((link) => {
    const currentLinkId = linkId(link.name)

    if (!nodes[currentLinkId]?.parentId) {
      setParent(nodes, currentLinkId, rootId)
    }

    const visualMesh = link.visual?.geometry?.mesh
    const collisionMesh = link.collision?.geometry?.mesh

    if (visualMesh?.filename) {
      const currentMeshId = meshId(link.name, 'visual')
      nodes[currentMeshId] = {
        id: currentMeshId,
        name: visualMesh.filename,
        type: 'mesh',
        parentId: null,
        children: [],
        selection: { kind: 'mesh', id: currentMeshId },
        metadata: {
          linkName: link.name,
          meshRole: 'visual',
          filename: visualMesh.filename,
        },
      }
      setParent(nodes, currentMeshId, currentLinkId)
    }

    if (collisionMesh?.filename) {
      const currentMeshId = meshId(link.name, 'collision')
      nodes[currentMeshId] = {
        id: currentMeshId,
        name: collisionMesh.filename,
        type: 'mesh',
        parentId: null,
        children: [],
        selection: { kind: 'mesh', id: currentMeshId },
        metadata: {
          linkName: link.name,
          meshRole: 'collision',
          filename: collisionMesh.filename,
        },
      }
      setParent(nodes, currentMeshId, currentLinkId)
    }
  })

  robot.sensors.forEach((sensor) => {
    const currentSensorId = sensorId(sensor.name)
    const attachedLinkId = linkId(sensor.attachedTo)
    nodes[currentSensorId] = {
      id: currentSensorId,
      name: sensor.name,
      type: 'sensor',
      parentId: null,
      children: [],
      selection: { kind: 'sensor', id: sensor.name },
      transform: sensor.origin
        ? {
            position: tupleFromVector(sensor.origin.xyz),
            rotation: tupleFromVector(sensor.origin.rpy),
          }
        : undefined,
      metadata: {
        linkName: sensor.attachedTo,
        jointType: sensor.type,
      },
    }
    setParent(nodes, currentSensorId, nodes[attachedLinkId] ? attachedLinkId : rootId)
  })

  return { rootId, nodes }
}

export function flattenRobotHierarchy(
  hierarchy: RobotHierarchyModel,
  includeNode: (node: RobotNode) => boolean = () => true,
) {
  const rows: Array<{ id: string; node: RobotNode; depth: number }> = []

  function visit(nodeId: string, depth: number) {
    const node = hierarchy.nodes[nodeId]

    if (!node) {
      return
    }

    if (includeNode(node)) {
      rows.push({ id: nodeId, node, depth })
    }

    node.children.forEach((childId) => visit(childId, depth + 1))
  }

  visit(hierarchy.rootId, 0)
  return rows
}
