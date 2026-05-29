import { Canvas, useThree } from '@react-three/fiber'
import {
  ContactShadows,
  GizmoHelper,
  GizmoViewport,
  Grid,
  Line,
  OrbitControls,
  OrthographicCamera,
  PerspectiveCamera,
} from '@react-three/drei'
import {
  Bot,
  Box,
  Crosshair,
  Eye,
  EyeOff,
  Globe2,
  GitBranch,
  Layers,
  Magnet,
  MousePointer2,
  Move3D,
  Package,
  Radio,
  Rotate3D,
  Scale3D,
  ScanSearch,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { MOUSE, type Group } from 'three'
import {
  ContextMenu,
  type ContextMenuItem,
} from '../../components/ContextMenu'
import { buildRobotHierarchy } from '../../core/robot-model/hierarchy'
import type {
  PoseModel,
  RobotJointModel,
  RobotLinkModel,
  RobotModel,
  TransformModel,
} from '../../core/robot-model/types'
import {
  allHierarchyIds,
  entityIdsForSelection,
  isEntityEffectivelyVisible,
  type EntityVisibilityMap,
  type SelectionMode,
  type VisibilityLayerState,
} from '../../core/robot-model/visibility'
import { logContextMenuMouseEvent, pointFromKeyboardEvent } from '../../lib/contextMenuPosition'
import { useProjectStore, type ViewPreset } from '../../store/useProjectStore'
import {
  useWorkspaceStore,
  type ConstraintAxis,
  type TransformData,
  type TransformEditScope,
  type ViewportTool,
} from '../../store/useWorkspaceStore'
import { LoadedUrdfRobot } from './LoadedUrdfRobot'
import { SingleTransformControls } from './SingleTransformControls'
import {
  applySafeObjectTransform,
  isolateTransformForTool,
  readSafeObjectTransform,
} from './transformSafety'

type Position = [number, number, number]
type TransformTool = Extract<ViewportTool, 'move' | 'rotate' | 'scale'>

function urdfToThreePosition(xyz: { x: number; y: number; z: number }): Position {
  return [xyz.x, xyz.z, xyz.y]
}

function threeToUrdfPosition(position: Position) {
  return { x: position[0], y: position[2], z: position[1] }
}

function urdfToThreeRotation(rpy: { x: number; y: number; z: number }): Position {
  return [rpy.x, rpy.z, rpy.y]
}

function threeToUrdfRotation(rotation: Position) {
  return { x: rotation[0], y: rotation[2], z: rotation[1] }
}

function transformDataToModel(transform: TransformData): TransformModel {
  return {
    position: {
      x: transform.position[0],
      y: transform.position[1],
      z: transform.position[2],
    },
    rotation: {
      x: transform.rotation[0],
      y: transform.rotation[1],
      z: transform.rotation[2],
    },
    scale: {
      x: transform.scale[0],
      y: transform.scale[1],
      z: transform.scale[2],
    },
  }
}

function transformDataToPose(transform: TransformData): PoseModel {
  return {
    xyz: {
      x: transform.position[0],
      y: transform.position[1],
      z: transform.position[2],
    },
    rpy: {
      x: transform.rotation[0],
      y: transform.rotation[1],
      z: transform.rotation[2],
    },
  }
}

function modelToTransformData(transform?: TransformModel): TransformData {
  return {
    position: [transform?.position.x ?? 0, transform?.position.y ?? 0, transform?.position.z ?? 0],
    rotation: [transform?.rotation.x ?? 0, transform?.rotation.y ?? 0, transform?.rotation.z ?? 0],
    scale: [transform?.scale.x ?? 1, transform?.scale.y ?? 1, transform?.scale.z ?? 1],
  }
}

function robotEntityId(name: string) {
  return `robot:${name || 'robot'}`
}

function visibleEntity(
  hierarchy: ReturnType<typeof buildRobotHierarchy>,
  visibility: EntityVisibilityMap,
  entityId: string,
) {
  return isEntityEffectivelyVisible(hierarchy, visibility, entityId)
}

function transformScopeLabel(scope: TransformEditScope, selectionMode: SelectionMode) {
  if (scope === 'scene-root') {
    return 'Whole Robot Placement'
  }

  switch (selectionMode) {
    case 'joint':
      return 'Joint Origin Edit'
    case 'mesh':
      return 'Mesh Edit'
    case 'sensor':
      return 'Sensor Frame Edit'
    case 'link':
      return 'Link Edit'
    default:
      return 'Robot Entity Edit'
  }
}

function selectionModeLabel(mode: SelectionMode) {
  switch (mode) {
    case 'robot':
      return 'Object'
    case 'link':
      return 'Link'
    case 'joint':
      return 'Joint'
    case 'mesh':
      return 'Mesh'
    case 'sensor':
      return 'Sensor'
    default:
      return 'Object'
  }
}

function isTransformTool(tool: ViewportTool): tool is TransformTool {
  return tool === 'move' || tool === 'rotate' || tool === 'scale'
}

function transformModeForTool(tool: TransformTool) {
  if (tool === 'move') {
    return 'translate'
  }

  return tool
}

function axisVisible(axis: ConstraintAxis, target: 'x' | 'y' | 'z') {
  return axis === null || axis === target
}

function isEditableShortcutTarget(target: EventTarget | null) {
  const element = target instanceof HTMLElement ? target : null

  if (!element) {
    return false
  }

  return Boolean(
    element.closest(
      'input, textarea, select, [contenteditable="true"], .monaco-editor, .monaco-editor textarea',
    ),
  )
}

function addPositions(left: Position, right: Position): Position {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]]
}

function computeLinkPositions(robot: RobotModel): Record<string, Position> {
  const positions: Record<string, Position> = {}
  const rootLink = robot.links[0]?.name

  if (rootLink) {
    positions[rootLink] = [0, 0.2, 0]
  }

  for (let pass = 0; pass < robot.links.length; pass += 1) {
    robot.joints.forEach((joint) => {
      const parentPosition = positions[joint.parent]

      if (parentPosition && !positions[joint.child]) {
        const childLink = robot.links.find((link) => link.name === joint.child)
        positions[joint.child] = addPositions(
          parentPosition,
          urdfToThreePosition(childLink?.transform?.position ?? joint.origin.xyz),
        )
      }
    })
  }

  robot.links.forEach((link, index) => {
    if (!positions[link.name]) {
      positions[link.name] = [index * 0.7, 0.2, 0.8]
    }
  })

  return positions
}

function linkThreeTransform(link: RobotLinkModel, fallbackPosition: Position) {
  const transform = link.transform

  return {
    position: fallbackPosition,
    rotation: transform ? urdfToThreeRotation(transform.rotation) : ([0, 0, 0] as Position),
    scale: transform
      ? ([transform.scale.x, transform.scale.z, transform.scale.y] as Position)
      : ([1, 1, 1] as Position),
  }
}

function presetPosition(preset: ViewPreset): Position {
  switch (preset) {
    case 'front':
      return [0, 1.2, 5]
    case 'back':
      return [0, 1.2, -5]
    case 'left':
      return [-5, 1.2, 0]
    case 'right':
      return [5, 1.2, 0]
    case 'top':
      return [0, 5, 0.001]
    case 'bottom':
      return [0, -5, 0.001]
    case 'perspective':
    default:
      return [3.2, 2.4, 4]
  }
}

function CameraRig() {
  const viewPreset = useProjectStore((state) => state.viewPreset)
  const robot = useProjectStore((state) => state.robot)
  const selection = useProjectStore((state) => state.selection)
  const frameRequestVersion = useWorkspaceStore((state) => state.frameRequestVersion)
  const { camera } = useThree()

  useEffect(() => {
    const [x, y, z] = presetPosition(viewPreset)
    camera.position.set(x, y, z)
    camera.lookAt(0, 0.2, 0)
    camera.updateProjectionMatrix()
  }, [camera, viewPreset])

  useEffect(() => {
    if (!frameRequestVersion) {
      return
    }

    const positions = computeLinkPositions(robot)
    const meshMatch = selection.kind === 'mesh' ? selection.id.match(/^mesh:(.*):(visual|collision)$/) : null
    const selectedPosition =
      selection.kind === 'link'
        ? positions[selection.id]
        : selection.kind === 'joint'
          ? positions[robot.joints.find((joint) => joint.name === selection.id)?.child ?? '']
          : meshMatch
            ? positions[meshMatch[1]]
            : undefined
    const visiblePositions = Object.values(positions)
    const target = selectedPosition ??
      (visiblePositions.length
        ? (visiblePositions.reduce(
            (sum, position) => addPositions(sum, position),
            [0, 0, 0] as Position,
          ).map((value) => value / visiblePositions.length) as Position)
        : ([0, 0.2, 0] as Position))
    const maxDistance = visiblePositions.reduce((distance, position) => {
      const dx = position[0] - target[0]
      const dy = position[1] - target[1]
      const dz = position[2] - target[2]

      return Math.max(distance, Math.hypot(dx, dy, dz))
    }, 1)
    const distance = Math.max(1.8, maxDistance * 2.5)

    camera.position.set(target[0] + distance, target[1] + distance * 0.7, target[2] + distance)
    camera.lookAt(target[0], target[1], target[2])
    camera.updateProjectionMatrix()
  }, [camera, frameRequestVersion, robot, selection])

  return null
}

function LinkPlaceholder({
  link,
  position,
  parentPosition,
  index,
  onTransformDraggingChange,
}: {
  link: RobotLinkModel
  position: Position
  parentPosition: Position
  index: number
  onTransformDraggingChange: (dragging: boolean) => void
}) {
  const name = link.name
  const groupRef = useRef<Group>(null)
  const initialTransformRef = useRef<TransformData | null>(null)
  const [hovered, setHovered] = useState(false)
  const selection = useProjectStore((state) => state.selection)
  const select = useProjectStore((state) => state.select)
  const updateLinkTransform = useProjectStore((state) => state.updateLinkTransform)
  const viewportTool = useWorkspaceStore((state) => state.viewportTool)
  const selectionMode = useWorkspaceStore((state) => state.selectionMode)
  const transformEditScope = useWorkspaceStore((state) => state.transformEditScope)
  const transformSpace = useWorkspaceStore((state) => state.transformSpace)
  const constraintAxis = useWorkspaceStore((state) => state.constraintAxis)
  const transformSession = useWorkspaceStore((state) => state.transformSession)
  const activeTransformOwnerId = useWorkspaceStore((state) => state.activeTransformOwnerId)
  const transformCancelVersion = useWorkspaceStore((state) => state.transformCancelVersion)
  const startTransformSession = useWorkspaceStore((state) => state.startTransformSession)
  const updateTransformSession = useWorkspaceStore((state) => state.updateTransformSession)
  const confirmTransformSession = useWorkspaceStore((state) => state.confirmTransformSession)
  const snapEnabled = useWorkspaceStore((state) => state.snapEnabled)
  const snapStep = useWorkspaceStore((state) => state.snapStep)
  const selected = selection.kind === 'link' && selection.id === name
  const color = selected ? '#f2b84b' : hovered ? '#7dd3fc' : index === 0 ? '#5b9dff' : '#43d39e'
  const transform = linkThreeTransform(link, position)
  const transformOwnerId = `placeholder-link:${name}`
  const canTransform =
    selected &&
    transformEditScope === 'robot-entity' &&
    isTransformTool(viewportTool) &&
    (!activeTransformOwnerId || activeTransformOwnerId === transformOwnerId)

  function readTransformData(): TransformData | null {
    const object = groupRef.current

    if (!object) {
      return null
    }

    const position = threeToUrdfPosition([
      object.position.x - parentPosition[0],
      object.position.y - parentPosition[1],
      object.position.z - parentPosition[2],
    ])
    const rotation = threeToUrdfRotation([object.rotation.x, object.rotation.y, object.rotation.z])

    return {
      position: [position.x, position.y, position.z],
      rotation: [rotation.x, rotation.y, rotation.z],
      scale: [object.scale.x, object.scale.z, object.scale.y],
    }
  }

  const applyTransformData = useCallback((transformData: TransformData) => {
    const object = groupRef.current

    if (!object) {
      return
    }

    const position = urdfToThreePosition({
      x: transformData.position[0],
      y: transformData.position[1],
      z: transformData.position[2],
    })
    const rotation = urdfToThreeRotation({
      x: transformData.rotation[0],
      y: transformData.rotation[1],
      z: transformData.rotation[2],
    })

    object.position.set(
      parentPosition[0] + position[0],
      parentPosition[1] + position[1],
      parentPosition[2] + position[2],
    )
    object.rotation.set(rotation[0], rotation[1], rotation[2])
    object.scale.set(transformData.scale[0], transformData.scale[2], transformData.scale[1])
  }, [parentPosition])

  function beginTransform() {
    if (!canTransform) {
      return
    }

    if (transformSession?.objectId === name && transformSession.tool === viewportTool) {
      initialTransformRef.current = transformSession.initialTransform
      return
    }

    const transformData = readTransformData()

    if (!transformData) {
      return
    }

    initialTransformRef.current = transformData
    startTransformSession(
      viewportTool,
      name,
      transformData,
      { type: 'link', linkId: name },
      'urdf-entity-edit',
      transformOwnerId,
    )
  }

  function commitTransform() {
    const transformData = readTransformData()

    if (!transformData || !isTransformTool(viewportTool)) {
      return
    }

    const initialTransform = initialTransformRef.current ?? transformData
    const nextTransform = isolateTransformForTool(viewportTool, transformData, initialTransform)

    applyTransformData(nextTransform)
    updateLinkTransform(name, transformDataToModel(nextTransform), 'viewport')
    confirmTransformSession()
  }

  function handleObjectChange() {
    const transformData = readTransformData()

    if (!transformData || !isTransformTool(viewportTool)) {
      return
    }

    const initialTransform = initialTransformRef.current ?? transformData
    const nextTransform = isolateTransformForTool(viewportTool, transformData, initialTransform)

    applyTransformData(nextTransform)
    updateTransformSession(nextTransform)
  }

  useEffect(() => {
    if (!selected || !initialTransformRef.current) {
      return
    }

    applyTransformData(initialTransformRef.current)
  }, [applyTransformData, selected, transformCancelVersion])

  const node = (
    <group
      ref={groupRef}
      position={transform.position}
      rotation={transform.rotation}
      scale={transform.scale}
      onPointerOver={(event) => {
        if (viewportTool === 'view') {
          return
        }

        event.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
      onClick={(event) => {
        if (viewportTool === 'view') {
          return
        }

        event.stopPropagation()

        if (selectionMode === 'robot') {
          select({ kind: 'robot', id: useProjectStore.getState().robot.name })
          return
        }

        select({ kind: 'link', id: name })
      }}
    >
      <mesh castShadow receiveShadow>
        <boxGeometry args={index === 0 ? [0.7, 0.28, 0.7] : [0.42, 0.42, 0.42]} />
        <meshStandardMaterial color={color} roughness={0.48} metalness={0.16} />
      </mesh>
      {selected || hovered ? (
        <mesh scale={index === 0 ? [0.78, 0.34, 0.78] : [0.5, 0.5, 0.5]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color={selected ? '#facc15' : '#7dd3fc'} wireframe transparent opacity={0.82} />
        </mesh>
      ) : null}
    </group>
  )

  return canTransform ? (
    <SingleTransformControls
      mode={transformModeForTool(viewportTool)}
      space={transformSpace}
      showX={axisVisible(constraintAxis, 'x')}
      showY={axisVisible(constraintAxis, 'y')}
      showZ={axisVisible(constraintAxis, 'z')}
      translationSnap={snapEnabled ? snapStep : null}
      rotationSnap={snapEnabled ? Math.PI / 24 : null}
      scaleSnap={snapEnabled ? snapStep : null}
      onMouseDown={() => {
        onTransformDraggingChange(true)
        beginTransform()
      }}
      onMouseUp={() => {
        onTransformDraggingChange(false)
        commitTransform()
      }}
      onObjectChange={handleObjectChange}
    >
      {node}
    </SingleTransformControls>
  ) : (
    node
  )
}

function JointMarker({
  joint,
  parentPosition,
  childPosition,
  onTransformDraggingChange,
}: {
  joint: RobotJointModel
  parentPosition: Position
  childPosition: Position
  onTransformDraggingChange: (dragging: boolean) => void
}) {
  const markerRef = useRef<Group>(null)
  const initialTransformRef = useRef<TransformData | null>(null)
  const selection = useProjectStore((state) => state.selection)
  const select = useProjectStore((state) => state.select)
  const updateJoint = useProjectStore((state) => state.updateJoint)
  const viewportTool = useWorkspaceStore((state) => state.viewportTool)
  const selectionMode = useWorkspaceStore((state) => state.selectionMode)
  const transformEditScope = useWorkspaceStore((state) => state.transformEditScope)
  const transformSpace = useWorkspaceStore((state) => state.transformSpace)
  const constraintAxis = useWorkspaceStore((state) => state.constraintAxis)
  const transformSession = useWorkspaceStore((state) => state.transformSession)
  const activeTransformOwnerId = useWorkspaceStore((state) => state.activeTransformOwnerId)
  const transformCancelVersion = useWorkspaceStore((state) => state.transformCancelVersion)
  const startTransformSession = useWorkspaceStore((state) => state.startTransformSession)
  const updateTransformSession = useWorkspaceStore((state) => state.updateTransformSession)
  const confirmTransformSession = useWorkspaceStore((state) => state.confirmTransformSession)
  const snapEnabled = useWorkspaceStore((state) => state.snapEnabled)
  const snapStep = useWorkspaceStore((state) => state.snapStep)
  const selected = selection.kind === 'joint' && selection.id === joint.name
  const transformOwnerId = `joint:${joint.name}`
  const canTransform =
    selected &&
    transformEditScope === 'robot-entity' &&
    (viewportTool === 'move' || viewportTool === 'rotate') &&
    (!activeTransformOwnerId || activeTransformOwnerId === transformOwnerId)
  const rotation = urdfToThreeRotation(joint.origin.rpy)

  function readTransformData(): TransformData | null {
    const object = markerRef.current

    if (!object) {
      return null
    }

    const localPosition = threeToUrdfPosition([
      object.position.x - parentPosition[0],
      object.position.y - parentPosition[1],
      object.position.z - parentPosition[2],
    ])
    const localRotation = threeToUrdfRotation([
      object.rotation.x,
      object.rotation.y,
      object.rotation.z,
    ])

    return {
      position: [localPosition.x, localPosition.y, localPosition.z],
      rotation: [localRotation.x, localRotation.y, localRotation.z],
      scale: [1, 1, 1],
    }
  }

  const applyTransformData = useCallback(
    (transformData: TransformData) => {
      const object = markerRef.current

      if (!object) {
        return
      }

      const position = urdfToThreePosition({
        x: transformData.position[0],
        y: transformData.position[1],
        z: transformData.position[2],
      })
      const nextRotation = urdfToThreeRotation({
        x: transformData.rotation[0],
        y: transformData.rotation[1],
        z: transformData.rotation[2],
      })

      object.position.set(
        parentPosition[0] + position[0],
        parentPosition[1] + position[1],
        parentPosition[2] + position[2],
      )
      object.rotation.set(nextRotation[0], nextRotation[1], nextRotation[2])
      object.scale.set(1, 1, 1)
    },
    [parentPosition],
  )

  function beginTransform() {
    if (!canTransform) {
      return
    }

    if (transformSession?.objectId === joint.name && transformSession.tool === viewportTool) {
      initialTransformRef.current = transformSession.initialTransform
      return
    }

    const transformData = readTransformData()

    if (!transformData) {
      return
    }

    initialTransformRef.current = transformData
    startTransformSession(
      viewportTool,
      joint.name,
      transformData,
      { type: 'joint', jointId: joint.name },
      'urdf-entity-edit',
      transformOwnerId,
    )
  }

  function handleObjectChange() {
    const transformData = readTransformData()

    if (!transformData || !isTransformTool(viewportTool)) {
      return
    }

    const initialTransform = initialTransformRef.current ?? transformData
    const nextTransform = isolateTransformForTool(viewportTool, transformData, initialTransform)

    applyTransformData(nextTransform)
    updateTransformSession(nextTransform)
  }

  function commitTransform() {
    const transformData = readTransformData()

    if (!transformData || !isTransformTool(viewportTool)) {
      return
    }

    const initialTransform = initialTransformRef.current ?? transformData
    const nextTransform = isolateTransformForTool(viewportTool, transformData, initialTransform)

    applyTransformData(nextTransform)
    updateJoint(joint.name, { origin: transformDataToPose(nextTransform) }, 'viewport')
    confirmTransformSession()
  }

  useEffect(() => {
    if (!selected || !initialTransformRef.current) {
      return
    }

    applyTransformData(initialTransformRef.current)
  }, [applyTransformData, selected, transformCancelVersion])

  const marker = (
    <group
      ref={markerRef}
      position={childPosition}
      rotation={rotation}
      onClick={(event) => {
        if (selectionMode !== 'joint') {
          return
        }

        event.stopPropagation()
        select({ kind: 'joint', id: joint.name })
      }}
    >
      <mesh>
        <sphereGeometry args={[selected ? 0.075 : 0.048, 18, 18]} />
        <meshStandardMaterial color={selected ? '#f97316' : '#94a3b8'} />
      </mesh>
      {selected ? (
        <Line
          points={[
            [-0.16, 0, 0],
            [0.16, 0, 0],
          ]}
          color="#f97316"
          lineWidth={2}
        />
      ) : null}
    </group>
  )

  return (
    <group>
      <Line
        points={[parentPosition, childPosition]}
        color={selected ? '#f97316' : '#94a3b8'}
        lineWidth={selected ? 3 : 1}
      />
      {canTransform ? (
        <SingleTransformControls
          mode={transformModeForTool(viewportTool as TransformTool)}
          space={transformSpace}
          showX={axisVisible(constraintAxis, 'x')}
          showY={axisVisible(constraintAxis, 'y')}
          showZ={axisVisible(constraintAxis, 'z')}
          translationSnap={snapEnabled ? snapStep : null}
          rotationSnap={snapEnabled ? Math.PI / 24 : null}
          scaleSnap={null}
          onMouseDown={() => {
            onTransformDraggingChange(true)
            beginTransform()
          }}
          onMouseUp={() => {
            onTransformDraggingChange(false)
            commitTransform()
          }}
          onObjectChange={handleObjectChange}
        >
          {marker}
        </SingleTransformControls>
      ) : (
        marker
      )}
    </group>
  )
}

function JointGizmos({
  robot,
  positions,
  hierarchy,
  entityVisibility,
  layerVisibility,
  onTransformDraggingChange,
}: {
  robot: RobotModel
  positions: Record<string, Position>
  hierarchy: ReturnType<typeof buildRobotHierarchy>
  entityVisibility: EntityVisibilityMap
  layerVisibility: VisibilityLayerState
  onTransformDraggingChange: (dragging: boolean) => void
}) {
  const selection = useProjectStore((state) => state.selection)

  return (
    <>
      {robot.joints.map((joint) => {
        const selected = selection.kind === 'joint' && selection.id === joint.name

        if (
          (!layerVisibility.joint && !selected) ||
          !visibleEntity(hierarchy, entityVisibility, `joint:${joint.name}`)
        ) {
          return null
        }

        const parent = positions[joint.parent]
        const child = positions[joint.child]

        if (!parent || !child) {
          return null
        }

        return (
          <JointMarker
            key={joint.name}
            joint={joint}
            parentPosition={parent}
            childPosition={child}
            onTransformDraggingChange={onTransformDraggingChange}
          />
        )
      })}
    </>
  )
}

function SensorMarkers({
  robot,
  positions,
  hierarchy,
  entityVisibility,
  layerVisibility,
}: {
  robot: RobotModel
  positions: Record<string, Position>
  hierarchy: ReturnType<typeof buildRobotHierarchy>
  entityVisibility: EntityVisibilityMap
  layerVisibility: VisibilityLayerState
}) {
  const selection = useProjectStore((state) => state.selection)
  const select = useProjectStore((state) => state.select)
  const selectionMode = useWorkspaceStore((state) => state.selectionMode)

  if (!layerVisibility.sensor && selection.kind !== 'sensor') {
    return null
  }

  return (
    <>
      {robot.sensors.map((sensor) => {
        const linkPosition = positions[sensor.attachedTo]

        const selected = selection.kind === 'sensor' && selection.id === sensor.name

        if (
          !linkPosition ||
          (!layerVisibility.sensor && !selected) ||
          !visibleEntity(hierarchy, entityVisibility, `sensor:${sensor.name}`)
        ) {
          return null
        }

        const sensorOffset = urdfToThreePosition(sensor.origin?.xyz ?? { x: 0, y: 0, z: 0 })
        const position = addPositions(linkPosition, sensorOffset)

        return (
          <group
            key={sensor.name}
            position={position}
            onClick={(event) => {
              if (selectionMode !== 'sensor') {
                return
              }

              event.stopPropagation()
              select({ kind: 'sensor', id: sensor.name })
            }}
          >
            <mesh>
              <sphereGeometry args={[selected ? 0.07 : 0.045, 18, 18]} />
              <meshStandardMaterial
                color={selected ? '#5ba8ff' : '#6ed6c5'}
                emissive={selected ? '#1d4ed8' : '#0f766e'}
                emissiveIntensity={selected ? 0.45 : 0.18}
              />
            </mesh>
            {selected ? (
              <Line
                points={[
                  [-0.14, 0, 0],
                  [0.14, 0, 0],
                ]}
                color="#5ba8ff"
                lineWidth={2}
              />
            ) : null}
          </group>
        )
      })}
    </>
  )
}

function RootOverlayGroup({
  robot,
  enableControls,
  onTransformDraggingChange,
  children,
}: {
  robot: RobotModel
  enableControls: boolean
  onTransformDraggingChange: (dragging: boolean) => void
  children: ReactNode
}) {
  const groupRef = useRef<Group>(null)
  const initialTransformRef = useRef<TransformData | null>(null)
  const selection = useProjectStore((state) => state.selection)
  const viewportTool = useWorkspaceStore((state) => state.viewportTool)
  const transformEditScope = useWorkspaceStore((state) => state.transformEditScope)
  const transformSpace = useWorkspaceStore((state) => state.transformSpace)
  const constraintAxis = useWorkspaceStore((state) => state.constraintAxis)
  const transformSession = useWorkspaceStore((state) => state.transformSession)
  const activeTransformOwnerId = useWorkspaceStore((state) => state.activeTransformOwnerId)
  const transformCancelVersion = useWorkspaceStore((state) => state.transformCancelVersion)
  const startTransformSession = useWorkspaceStore((state) => state.startTransformSession)
  const updateTransformSession = useWorkspaceStore((state) => state.updateTransformSession)
  const confirmTransformSession = useWorkspaceStore((state) => state.confirmTransformSession)
  const snapEnabled = useWorkspaceStore((state) => state.snapEnabled)
  const snapStep = useWorkspaceStore((state) => state.snapStep)
  const robotSceneTransform = useWorkspaceStore((state) => state.robotSceneTransform)
  const setRobotSceneTransform = useWorkspaceStore((state) => state.setRobotSceneTransform)
  const transform = robotSceneTransform
  const transformOwnerId = `placeholder-robot:${robotEntityId(robot.name)}`
  const canTransform =
    enableControls &&
    selection.kind === 'robot' &&
    transformEditScope === 'scene-root' &&
    isTransformTool(viewportTool) &&
    (!activeTransformOwnerId || activeTransformOwnerId === transformOwnerId)

  function readTransformData(): TransformData | null {
    const object = groupRef.current

    if (!object) {
      return null
    }

    return readSafeObjectTransform(object)
  }

  function beginTransform() {
    const transformData = readTransformData()

    if (!transformData) {
      return
    }

    if (transformSession?.objectId === robotEntityId(robot.name) && transformSession.tool === viewportTool) {
      initialTransformRef.current = transformSession.initialTransform
      return
    }

    initialTransformRef.current = transformData
    startTransformSession(
      viewportTool as TransformTool,
      robotEntityId(robot.name),
      transformData,
      { type: 'robot', robotId: robot.name },
      'scene-placement',
      transformOwnerId,
    )
  }

  function handleObjectChange() {
    const transformData = readTransformData()

    if (!transformData || !isTransformTool(viewportTool) || !groupRef.current) {
      return
    }

    const initialTransform = initialTransformRef.current ?? transformData
    const nextTransform = isolateTransformForTool(viewportTool, transformData, initialTransform)

    applySafeObjectTransform(groupRef.current, nextTransform)
    updateTransformSession(nextTransform)
  }

  function commitTransform() {
    const transformData = readTransformData()

    if (!transformData || !isTransformTool(viewportTool) || !groupRef.current) {
      return
    }

    const initialTransform = initialTransformRef.current ?? transformData
    const nextTransform = isolateTransformForTool(viewportTool, transformData, initialTransform)

    applySafeObjectTransform(groupRef.current, nextTransform)
    setRobotSceneTransform(nextTransform)
    confirmTransformSession()
  }

  useEffect(() => {
    if (!groupRef.current || !initialTransformRef.current) {
      return
    }

    applySafeObjectTransform(groupRef.current, initialTransformRef.current)
  }, [transformCancelVersion])

  const node = (
    <group
      ref={groupRef}
      name="RobotSceneRoot"
      position={transform.position}
      rotation={transform.rotation}
      scale={transform.scale}
      userData={{ sceneObjectKind: 'robot', transformScope: 'scene-root' }}
    >
      {children}
    </group>
  )

  return canTransform ? (
    <SingleTransformControls
      mode={transformModeForTool(viewportTool)}
      space={transformSpace}
      showX={axisVisible(constraintAxis, 'x')}
      showY={axisVisible(constraintAxis, 'y')}
      showZ={axisVisible(constraintAxis, 'z')}
      translationSnap={snapEnabled ? snapStep : null}
      rotationSnap={snapEnabled ? Math.PI / 24 : null}
      scaleSnap={snapEnabled ? snapStep : null}
      onMouseDown={() => {
        onTransformDraggingChange(true)
        beginTransform()
      }}
      onMouseUp={() => {
        onTransformDraggingChange(false)
        commitTransform()
      }}
      onObjectChange={handleObjectChange}
    >
      {node}
    </SingleTransformControls>
  ) : (
    node
  )
}

function ViewportScene() {
  const document = useProjectStore((state) => state.document)
  const robot = useProjectStore((state) => state.robot)
  const selection = useProjectStore((state) => state.selection)
  const select = useProjectStore((state) => state.select)
  const viewportTool = useWorkspaceStore((state) => state.viewportTool)
  const entityVisibility = useWorkspaceStore((state) => state.entityVisibility)
  const layerVisibility = useWorkspaceStore((state) => state.layerVisibility)
  const viewportDebug = useWorkspaceStore((state) => state.viewportDebug)
  const [orbitEnabled, setOrbitEnabled] = useState(true)
  const [urdfLoadState, setUrdfLoadState] = useState({
    ready: false,
    hasRenderableGeometry: false,
    errors: [] as string[],
  })
  const handleUrdfLoadStateChange = useCallback((state: typeof urdfLoadState) => {
    setUrdfLoadState(state)
  }, [])
  const positions = useMemo(() => computeLinkPositions(robot), [robot])
  const hierarchy = useMemo(() => buildRobotHierarchy(robot), [robot])
  const hasMeshReferences = useMemo(
    () =>
      robot.links.some(
        (link) =>
          Boolean(link.visual?.geometry?.mesh?.filename) ||
          Boolean(link.collision?.geometry?.mesh?.filename),
      ),
    [robot.links],
  )
  const isDefaultUntitledSkeleton =
    document.isUntitled && !document.filePath && !hasMeshReferences && robot.links.length > 0
  const showPlaceholders =
    !urdfLoadState.hasRenderableGeometry &&
    !hasMeshReferences &&
    (viewportDebug.showPlaceholderLinks || isDefaultUntitledSkeleton)
  const showJointMarkers =
    (layerVisibility.joint && viewportDebug.showJointMarkers) || selection.kind === 'joint'
  const showSensorMarkers =
    (layerVisibility.sensor && viewportDebug.showSensorMarkers) || selection.kind === 'sensor'
  const robotVisible = visibleEntity(hierarchy, entityVisibility, robotEntityId(robot.name))
  const parentPositions = useMemo(() => {
    const lookup: Record<string, Position> = {}

    robot.joints.forEach((joint) => {
      lookup[joint.child] = positions[joint.parent] ?? [0, 0, 0]
    })

    return lookup
  }, [positions, robot.joints])

  return (
    <>
      <CameraRig />
      <ambientLight intensity={0.54} />
      <hemisphereLight args={['#eef6ff', '#172033', 0.65]} />
      <directionalLight position={[3, 5, 4]} intensity={1.35} castShadow />
      {layerVisibility.grid ? (
        <Grid
          args={[18, 18]}
          cellSize={0.25}
          sectionSize={1}
          cellColor="#536173"
          sectionColor="#8ba4bd"
          fadeDistance={24}
          fadeStrength={1.4}
          infiniteGrid
        />
      ) : null}
      <ContactShadows position={[0, 0.01, 0]} opacity={0.34} scale={8} blur={2.8} far={4} />
      {layerVisibility.axes ? <axesHelper args={[1.3]} /> : null}
      <LoadedUrdfRobot
        onLoadStateChange={handleUrdfLoadStateChange}
        onTransformDraggingChange={(dragging) => setOrbitEnabled(!dragging)}
      />
      <RootOverlayGroup
        robot={robot}
        enableControls={showPlaceholders && robotVisible}
        onTransformDraggingChange={(dragging) => setOrbitEnabled(!dragging)}
      >
        {robotVisible ? (
          <>
            {showJointMarkers ? (
              <JointGizmos
                robot={robot}
                positions={positions}
                hierarchy={hierarchy}
                entityVisibility={entityVisibility}
                layerVisibility={layerVisibility}
                onTransformDraggingChange={(dragging) => setOrbitEnabled(!dragging)}
              />
            ) : null}
            {showSensorMarkers ? (
              <SensorMarkers
                robot={robot}
                positions={positions}
                hierarchy={hierarchy}
                entityVisibility={entityVisibility}
                layerVisibility={layerVisibility}
              />
            ) : null}
          </>
        ) : null}
        <group
          visible={robotVisible}
          onClick={() => {
            if (viewportTool !== 'view') {
              select({ kind: 'robot', id: robot.name })
            }
          }}
        >
          {showPlaceholders ? (
            <>
              {robot.links
                .filter((link) => visibleEntity(hierarchy, entityVisibility, `link:${link.name}`))
                .map((link, index) => (
                  <LinkPlaceholder
                    key={link.name}
                    link={link}
                    position={positions[link.name]}
                    parentPosition={parentPositions[link.name] ?? [0, 0, 0]}
                    index={index}
                    onTransformDraggingChange={(dragging) => setOrbitEnabled(!dragging)}
                  />
                ))}
            </>
          ) : null}
        </group>
      </RootOverlayGroup>
      <GizmoHelper alignment="bottom-right" margin={[72, 72]}>
        <GizmoViewport axisColors={['#ef4444', '#22c55e', '#3b82f6']} labelColor="#f8fafc" />
      </GizmoHelper>
      <OrbitControls
        makeDefault
        enabled={orbitEnabled}
        enableDamping
        dampingFactor={0.08}
        mouseButtons={{
          LEFT: MOUSE.ROTATE,
          MIDDLE: MOUSE.PAN,
          RIGHT: undefined,
        }}
      />
    </>
  )
}

function ToolButton({
  active,
  icon,
  label,
  title,
  onClick,
}: {
  active: boolean
  icon: ReactNode
  label: string
  title: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`viewport-tool-button ${active ? 'is-active' : ''}`}
      title={title}
      aria-label={title}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

export function RobotViewport() {
  const viewportRef = useRef<HTMLElement>(null)
  const cameraMode = useProjectStore((state) => state.cameraMode)
  const viewPreset = useProjectStore((state) => state.viewPreset)
  const selection = useProjectStore((state) => state.selection)
  const robot = useProjectStore((state) => state.robot)
  const select = useProjectStore((state) => state.select)
  const addChildLink = useProjectStore((state) => state.addChildLink)
  const addJoint = useProjectStore((state) => state.addJoint)
  const deleteSelection = useProjectStore((state) => state.deleteSelection)
  const resetLinkTransform = useProjectStore((state) => state.resetLinkTransform)
  const updateLinkTransform = useProjectStore((state) => state.updateLinkTransform)
  const updateJoint = useProjectStore((state) => state.updateJoint)
  const setCameraMode = useProjectStore((state) => state.setCameraMode)
  const setViewPreset = useProjectStore((state) => state.setViewPreset)
  const viewportTool = useWorkspaceStore((state) => state.viewportTool)
  const transformMode = useWorkspaceStore((state) => state.transformMode)
  const selectionMode = useWorkspaceStore((state) => state.selectionMode)
  const transformScope = useWorkspaceStore((state) => state.transformScope)
  const transformEditScope = useWorkspaceStore((state) => state.transformEditScope)
  const transformSpace = useWorkspaceStore((state) => state.transformSpace)
  const constraintAxis = useWorkspaceStore((state) => state.constraintAxis)
  const transformSession = useWorkspaceStore((state) => state.transformSession)
  const snapEnabled = useWorkspaceStore((state) => state.snapEnabled)
  const layerVisibility = useWorkspaceStore((state) => state.layerVisibility)
  const viewportDebug = useWorkspaceStore((state) => state.viewportDebug)
  const setViewportTool = useWorkspaceStore((state) => state.setViewportTool)
  const setSelectionMode = useWorkspaceStore((state) => state.setSelectionMode)
  const setTransformEditScope = useWorkspaceStore((state) => state.setTransformEditScope)
  const setTransformSpace = useWorkspaceStore((state) => state.setTransformSpace)
  const setConstraintAxis = useWorkspaceStore((state) => state.setConstraintAxis)
  const startTransformSession = useWorkspaceStore((state) => state.startTransformSession)
  const confirmTransformSession = useWorkspaceStore((state) => state.confirmTransformSession)
  const cancelTransformSession = useWorkspaceStore((state) => state.cancelTransformSession)
  const clearTransformSession = useWorkspaceStore((state) => state.clearTransformSession)
  const toggleSnap = useWorkspaceStore((state) => state.toggleSnap)
  const hideEntities = useWorkspaceStore((state) => state.hideEntities)
  const isolateEntities = useWorkspaceStore((state) => state.isolateEntities)
  const revealAllEntities = useWorkspaceStore((state) => state.revealAllEntities)
  const setLayerVisibility = useWorkspaceStore((state) => state.setLayerVisibility)
  const toggleLayerVisibility = useWorkspaceStore((state) => state.toggleLayerVisibility)
  const setViewportDebugSetting = useWorkspaceStore((state) => state.setViewportDebugSetting)
  const robotSceneTransform = useWorkspaceStore((state) => state.robotSceneTransform)
  const setRobotSceneTransform = useWorkspaceStore((state) => state.setRobotSceneTransform)
  const requestFrameSelection = useWorkspaceStore((state) => state.requestFrameSelection)
  const [menu, setMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null)
  const viewportItemsRef = useRef<ContextMenuItem[]>([])

  const selectedLink = selection.kind === 'link' ? selection.id : null
  const selectedLinkModel = selectedLink
    ? robot.links.find((link) => link.name === selectedLink)
    : undefined
  const selectedRobot = selection.kind === 'robot'
  const hierarchy = useMemo(() => buildRobotHierarchy(robot), [robot])
  const activeAxisLabel = constraintAxis ? constraintAxis.toUpperCase() : 'Free'
  const toolLabel = viewportTool[0].toUpperCase() + viewportTool.slice(1)
  const editScopeLabel = transformScopeLabel(transformEditScope, selectionMode)
  const jointMarkersVisible = layerVisibility.joint && viewportDebug.showJointMarkers
  const sensorMarkersVisible = layerVisibility.sensor && viewportDebug.showSensorMarkers
  const helperDebugVisible = layerVisibility.debug && viewportDebug.showDebugHelpers
  const transformTargetLabel = transformSession
    ? transformSession.target.type === 'robot'
      ? transformSession.target.robotId || 'robot'
      : transformSession.target.type === 'link'
        ? transformSession.target.linkId
        : transformSession.target.type === 'joint'
          ? transformSession.target.jointId
          : transformSession.target.type === 'sensor'
            ? transformSession.target.sensorId
            : transformSession.target.meshId
    : null
  const statusText = transformSession
    ? `Tool: ${transformSession.tool} | Target: ${transformTargetLabel} | Mode: ${transformSession.transformEditScope === 'scene-root' ? 'Whole Robot Placement' : 'URDF Entity Edit'} | Context: ${transformSession.transformContext} | Space: ${transformSpace} | Patch: ${transformSession.tool === 'move' ? 'xyz only' : transformSession.tool === 'rotate' ? 'rpy only' : 'scale only'} | Constraint: ${activeAxisLabel}`
    : `Tool: ${toolLabel} | Mode: ${selectionModeLabel(selectionMode)} | Scope: ${editScopeLabel}${
        isTransformTool(viewportTool) ? ` | Axis: ${activeAxisLabel}` : ''
      }`

  useEffect(() => {
    clearTransformSession()
  }, [clearTransformSession, selection.id, selection.kind, selectionMode, transformEditScope, transformScope])

  useEffect(() => {
    setTransformEditScope(selection.kind === 'robot' ? 'scene-root' : 'robot-entity')
  }, [selection.kind, setTransformEditScope])

  const selectedEntityIds = useCallback(
    (options: { includeAncestors?: boolean; includeDescendants?: boolean } = {}) =>
      entityIdsForSelection(hierarchy, selection, robot.name, options),
    [hierarchy, robot.name, selection],
  )

  const hideSelected = useCallback(() => {
    hideEntities(selectedEntityIds({ includeDescendants: true }))
  }, [hideEntities, selectedEntityIds])

  const isolateSelected = useCallback(() => {
    isolateEntities(
      selectedEntityIds({ includeAncestors: true, includeDescendants: true }),
      allHierarchyIds(hierarchy),
    )
  }, [hierarchy, isolateEntities, selectedEntityIds])

  const setJointMarkersVisible = useCallback(
    (visible: boolean) => {
      setLayerVisibility('joint', visible)
      setViewportDebugSetting('showJointMarkers', visible)
    },
    [setLayerVisibility, setViewportDebugSetting],
  )

  const setSensorMarkersVisible = useCallback(
    (visible: boolean) => {
      setLayerVisibility('sensor', visible)
      setViewportDebugSetting('showSensorMarkers', visible)
    },
    [setLayerVisibility, setViewportDebugSetting],
  )

  const setHelperDebugVisible = useCallback(
    (visible: boolean) => {
      setLayerVisibility('debug', visible)
      setViewportDebugSetting('showDebugHelpers', visible)
      setViewportDebugSetting('showBoundingSpheres', visible)
    },
    [setLayerVisibility, setViewportDebugSetting],
  )

  const activateRobotPlacement = useCallback(
    (tool: TransformTool = 'move') => {
      select({ kind: 'robot', id: robot.name })
      setSelectionMode('robot')
      setTransformEditScope('scene-root')
      setViewportTool(tool)
    },
    [robot.name, select, setSelectionMode, setTransformEditScope, setViewportTool],
  )

  function startShortcutTransform(mode: TransformTool) {
    if (selectedRobot) {
      setTransformEditScope('scene-root')
      setViewportTool(mode)
      startTransformSession(
        mode,
        robotEntityId(robot.name),
        robotSceneTransform,
        { type: 'robot', robotId: robot.name },
        'scene-placement',
      )
      return
    }

    if (!selectedLink || !selectedLinkModel) {
      setViewportTool(mode)
      return
    }

    startTransformSession(
      mode,
      selectedLink,
      modelToTransformData(selectedLinkModel.transform),
      { type: 'link', linkId: selectedLink },
      'urdf-entity-edit',
    )
  }

  function confirmShortcutTransform() {
    if (!transformSession) {
      return
    }

    if (selection.kind === 'robot') {
      setRobotSceneTransform(transformSession.currentTransform)
    } else if (selection.kind === 'joint') {
      updateJoint(
        transformSession.objectId,
        { origin: transformDataToPose(transformSession.currentTransform) },
        'viewport',
      )
    } else {
      updateLinkTransform(
        transformSession.objectId,
        transformDataToModel(transformSession.currentTransform),
        'viewport',
      )
    }
    confirmTransformSession()
  }

  function handleShortcut(event: KeyboardEvent<HTMLElement>) {
    if (event.defaultPrevented) {
      return
    }

    if (isEditableShortcutTarget(event.target)) {
      return
    }

    const key = event.key.toLowerCase()
    const code = event.code
    const commandOrControl = event.ctrlKey || event.metaKey

    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      event.preventDefault()
      const point = pointFromKeyboardEvent(event, 0)
      setMenu({ x: point.x, y: point.y, items: viewportItemsRef.current })
      return
    }

    if (commandOrControl) {
      return
    }

    if (transformSession && ['x', 'y', 'z'].includes(key)) {
      event.preventDefault()
      setConstraintAxis(key as Exclude<ConstraintAxis, null>)
      return
    }

    if (key === 'escape') {
      event.preventDefault()
      cancelTransformSession()
      return
    }

    if (key === 'enter') {
      event.preventDefault()
      confirmShortcutTransform()
      return
    }

    if (key === 'g') {
      event.preventDefault()
      startShortcutTransform('move')
      return
    }

    if (key === 'r') {
      event.preventDefault()
      startShortcutTransform('rotate')
      return
    }

    if (key === 's') {
      event.preventDefault()
      startShortcutTransform('scale')
      return
    }

    if (key === 'delete' || key === 'backspace') {
      event.preventDefault()
      deleteSelection()
      return
    }

    if (key === 'h' && event.altKey) {
      event.preventDefault()
      revealAllEntities()
      return
    }

    if (key === 'h' && event.shiftKey) {
      event.preventDefault()
      isolateSelected()
      return
    }

    if (key === 'h') {
      event.preventDefault()
      hideSelected()
      return
    }

    if (key === 'f' || key === 'home' || code === 'Numpad0') {
      event.preventDefault()
      requestFrameSelection()
      return
    }

    if (key === 'a' && event.altKey) {
      event.preventDefault()
      select({ kind: 'robot', id: robot.name })
      return
    }

    if (key === 'a') {
      event.preventDefault()
      select({ kind: 'robot', id: robot.name })
      return
    }

    if (code === 'Numpad1' || (event.shiftKey && key === '1')) {
      event.preventDefault()
      setViewPreset('front')
      return
    }

    if (code === 'Numpad3' || (event.shiftKey && key === '3')) {
      event.preventDefault()
      setViewPreset('right')
      return
    }

    if (code === 'Numpad7' || (event.shiftKey && key === '7')) {
      event.preventDefault()
      setViewPreset('top')
      return
    }

    if (code === 'Numpad5' || (event.shiftKey && key === '5')) {
      event.preventDefault()
      setCameraMode(cameraMode === 'perspective' ? 'orthographic' : 'perspective')
    }
  }

  const viewportItems = useMemo<ContextMenuItem[]>(
    () => [
      { id: 'move', label: 'Move', icon: <Move3D size={15} />, onSelect: () => setViewportTool('move') },
      { id: 'rotate', label: 'Rotate', icon: <Rotate3D size={15} />, onSelect: () => setViewportTool('rotate') },
      { id: 'scale', label: 'Scale', icon: <Scale3D size={15} />, onSelect: () => setViewportTool('scale') },
      {
        id: 'move-robot',
        label: 'Move Whole Robot',
        icon: <Bot size={15} />,
        onSelect: () => activateRobotPlacement('move'),
      },
      {
        id: 'rotate-robot',
        label: 'Rotate Whole Robot',
        icon: <Rotate3D size={15} />,
        onSelect: () => activateRobotPlacement('rotate'),
      },
      {
        id: 'select-robot',
        label: 'Select Whole Robot',
        icon: <Box size={15} />,
        onSelect: () => activateRobotPlacement('move'),
      },
      {
        id: 'scope',
        label:
          transformEditScope === 'scene-root'
            ? 'Use Entity Editing'
            : 'Use Whole Robot Placement',
        icon: <Layers size={15} />,
        onSelect: () => {
          if (transformEditScope === 'scene-root') {
            setTransformEditScope('robot-entity')
            return
          }

          activateRobotPlacement('move')
        },
      },
      {
        id: 'space',
        label: transformSpace === 'world' ? 'Use Local Space' : 'Use World Space',
        icon: <Crosshair size={15} />,
        onSelect: () => setTransformSpace(transformSpace === 'world' ? 'local' : 'world'),
      },
      {
        id: 'snap',
        label: snapEnabled ? 'Disable Grid Snap' : 'Enable Grid Snap',
        icon: <Magnet size={15} />,
        onSelect: toggleSnap,
      },
      {
        id: 'focus',
        label: 'Frame Selection',
        icon: <ScanSearch size={15} />,
        onSelect: requestFrameSelection,
      },
      {
        id: 'isolate',
        label: 'Isolate Selection',
        icon: <Eye size={15} />,
        onSelect: isolateSelected,
      },
      {
        id: 'hide-selected',
        label: 'Hide Selected',
        icon: <EyeOff size={15} />,
        onSelect: hideSelected,
      },
      {
        id: 'reveal-all',
        label: 'Reveal All',
        icon: <Eye size={15} />,
        onSelect: revealAllEntities,
      },
      {
        id: 'collision-layer',
        label: layerVisibility.collision ? 'Hide Collision Meshes' : 'Show Collision Meshes',
        icon: <Package size={15} />,
        onSelect: () => toggleLayerVisibility('collision'),
      },
      {
        id: 'sensor-layer',
        label: sensorMarkersVisible ? 'Hide Sensors' : 'Show Sensors',
        icon: <Radio size={15} />,
        onSelect: () => setSensorMarkersVisible(!sensorMarkersVisible),
      },
      {
        id: 'joint-layer',
        label: jointMarkersVisible ? 'Hide Joint Markers' : 'Show Joint Markers',
        icon: <GitBranch size={15} />,
        onSelect: () => setJointMarkersVisible(!jointMarkersVisible),
      },
      {
        id: 'helper-layer',
        label: helperDebugVisible ? 'Hide Helpers' : 'Show Helpers',
        icon: <Layers size={15} />,
        onSelect: () => setHelperDebugVisible(!helperDebugVisible),
      },
      {
        id: 'child-link',
        label: 'Create Child Link',
        icon: <Box size={15} />,
        disabled: !selectedLink,
        onSelect: () => selectedLink && addChildLink(selectedLink, 'fixed'),
      },
      {
        id: 'joint',
        label: 'Create Revolute Joint',
        icon: <Crosshair size={15} />,
        disabled: !selectedLink,
        onSelect: () => selectedLink && addJoint('revolute'),
      },
      {
        id: 'reset-transform',
        label: 'Reset Transform',
        icon: <Crosshair size={15} />,
        disabled: !selectedLink,
        onSelect: () => selectedLink && resetLinkTransform(selectedLink),
      },
    ],
    [
      addChildLink,
      addJoint,
      activateRobotPlacement,
      hideSelected,
      isolateSelected,
      layerVisibility.collision,
      sensorMarkersVisible,
      jointMarkersVisible,
      helperDebugVisible,
      resetLinkTransform,
      requestFrameSelection,
      revealAllEntities,
      selectedLink,
      setHelperDebugVisible,
      setJointMarkersVisible,
      setSensorMarkersVisible,
      setTransformEditScope,
      setTransformSpace,
      setViewportTool,
      snapEnabled,
      toggleSnap,
      toggleLayerVisibility,
      transformEditScope,
      transformSpace,
    ],
  )

  useEffect(() => {
    viewportItemsRef.current = viewportItems
  }, [viewportItems])

  return (
    <section
      ref={viewportRef}
      className={`viewport-panel viewport-tool-${viewportTool}`}
      tabIndex={0}
      onKeyDown={handleShortcut}
      onMouseDown={() => viewportRef.current?.focus()}
      onContextMenu={(event) => {
        event.preventDefault()
        logContextMenuMouseEvent('viewport', event)
        setMenu({ x: event.clientX, y: event.clientY, items: viewportItems })
      }}
    >
      <div className="viewport-toolbar">
        <span>Viewport</span>
        <div className="viewport-pills">
          <span>{cameraMode}</span>
          <span>{viewPreset}</span>
          <span>{transformMode}</span>
          <span>{transformSpace}</span>
          {isTransformTool(viewportTool) ? <span>{activeAxisLabel}</span> : null}
          {snapEnabled ? <span>snap</span> : null}
        </div>
      </div>
      <div className="viewport-tool-strip" aria-label="Viewport tools">
        <ToolButton
          active={viewportTool === 'view'}
          icon={<Eye size={17} />}
          label="View"
          title="View: orbit/pan/zoom only"
          onClick={() => setViewportTool('view')}
        />
        <ToolButton
          active={viewportTool === 'select'}
          icon={<MousePointer2 size={17} />}
          label="Select"
          title="Select: select objects"
          onClick={() => setViewportTool('select')}
        />
        <ToolButton
          active={viewportTool === 'move'}
          icon={<Move3D size={17} />}
          label="Move"
          title="Move: translate selected object"
          onClick={() => setViewportTool('move')}
        />
        <ToolButton
          active={viewportTool === 'rotate'}
          icon={<Rotate3D size={17} />}
          label="Rotate"
          title="Rotate: rotate selected object"
          onClick={() => setViewportTool('rotate')}
        />
        <ToolButton
          active={viewportTool === 'scale'}
          icon={<Scale3D size={17} />}
          label="Scale"
          title="Scale: scale selected object"
          onClick={() => setViewportTool('scale')}
        />
        <ToolButton
          active={selectedRobot && transformEditScope === 'scene-root' && viewportTool === 'move'}
          icon={<Bot size={17} />}
          label="Move Robot"
          title="Move Robot: scene placement only, does not edit URDF"
          onClick={() => activateRobotPlacement('move')}
        />
        <ToolButton
          active={selectedRobot && transformEditScope === 'scene-root' && viewportTool === 'rotate'}
          icon={<Rotate3D size={17} />}
          label="Rotate Robot"
          title="Rotate Robot: scene placement only, does not edit URDF"
          onClick={() => activateRobotPlacement('rotate')}
        />
        <ToolButton
          active={transformSpace === 'local'}
          icon={<Globe2 size={17} />}
          label={transformSpace === 'world' ? 'World' : 'Local'}
          title="Toggle local/world transform orientation"
          onClick={() => setTransformSpace(transformSpace === 'world' ? 'local' : 'world')}
        />
        <ToolButton
          active={snapEnabled}
          icon={<Magnet size={17} />}
          label="Snap"
          title="Toggle transform snapping"
          onClick={toggleSnap}
        />
      </div>
      <div className="viewport-mode-strip" aria-label="Selection modes">
        <ToolButton
          active={selectionMode === 'robot'}
          icon={<Bot size={16} />}
          label="Object"
          title="Object mode: select whole robot assemblies"
          onClick={() => setSelectionMode('robot')}
        />
        <ToolButton
          active={selectionMode === 'link'}
          icon={<Box size={16} />}
          label="Link"
          title="Link mode: select and transform link subtrees"
          onClick={() => setSelectionMode('link')}
        />
        <ToolButton
          active={selectionMode === 'joint'}
          icon={<GitBranch size={16} />}
          label="Joint"
          title="Joint mode: select joint frames"
          onClick={() => setSelectionMode('joint')}
        />
        <ToolButton
          active={selectionMode === 'mesh'}
          icon={<Package size={16} />}
          label="Mesh"
          title="Mesh mode: select visual/collision geometry"
          onClick={() => setSelectionMode('mesh')}
        />
        <ToolButton
          active={selectionMode === 'sensor'}
          icon={<Radio size={16} />}
          label="Sensor"
          title="Sensor mode: select sensor frames"
          onClick={() => setSelectionMode('sensor')}
        />
      </div>
      <div className="viewport-layer-strip" aria-label="Viewport visibility layers">
        <ToolButton
          active={layerVisibility.visual}
          icon={<Eye size={16} />}
          label="Visual"
          title="Toggle visual mesh layer"
          onClick={() => toggleLayerVisibility('visual')}
        />
        <ToolButton
          active={layerVisibility.collision}
          icon={<Package size={16} />}
          label="Collision"
          title="Toggle collision mesh layer"
          onClick={() => toggleLayerVisibility('collision')}
        />
        <ToolButton
          active={sensorMarkersVisible}
          icon={<Radio size={16} />}
          label="Sensors"
          title="Toggle sensor markers"
          onClick={() => setSensorMarkersVisible(!sensorMarkersVisible)}
        />
        <ToolButton
          active={jointMarkersVisible}
          icon={<GitBranch size={16} />}
          label="Joints"
          title="Toggle joint markers"
          onClick={() => setJointMarkersVisible(!jointMarkersVisible)}
        />
        <ToolButton
          active={layerVisibility.grid}
          icon={<Layers size={16} />}
          label="Grid"
          title="Toggle grid"
          onClick={() => toggleLayerVisibility('grid')}
        />
        <ToolButton
          active={layerVisibility.axes}
          icon={<Crosshair size={16} />}
          label="Axes"
          title="Toggle axes helper"
          onClick={() => toggleLayerVisibility('axes')}
        />
      </div>
      <div className="viewport-tool-status">{statusText}</div>
      <Canvas shadows dpr={[1, 1.5]} gl={{ antialias: true }} onPointerMissed={() => null}>
        {cameraMode === 'perspective' ? (
          <PerspectiveCamera makeDefault fov={45} position={[3.2, 2.4, 4]} />
        ) : (
          <OrthographicCamera makeDefault zoom={90} position={[3.2, 2.4, 4]} />
        )}
        <ViewportScene />
      </Canvas>
      {menu ? (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          debugSource="viewport"
          title={selectedLink ?? 'Viewport'}
          items={menu.items}
          onClose={() => setMenu(null)}
        />
      ) : null}
    </section>
  )
}
