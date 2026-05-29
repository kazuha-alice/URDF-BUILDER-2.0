import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BoxHelper, Group, LoadingManager, Mesh, MeshStandardMaterial, Object3D } from 'three'
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import URDFLoader, {
  type URDFCollider,
  type URDFJoint,
  type URDFLink,
  type URDFRobot,
  type URDFVisual,
} from 'urdf-loader'
import {
  clampJointValue,
  detectDifferentialWheelGroups,
  getWheelJointNames,
} from '../../core/controllers/previewController'
import { meshSelectionId, parseMeshSelectionId, type MeshRole } from '../../core/robot-model/selection'
import { buildRobotHierarchy } from '../../core/robot-model/hierarchy'
import { XML_PATCH_THROTTLE_MS } from '../../core/sync/types'
import {
  isEntityEffectivelyVisible,
  type EntityVisibilityMap,
  type VisibilityLayerState,
} from '../../core/robot-model/visibility'
import { electronBridge } from '../../lib/electron'
import { createHistoryEntry, useHistoryStore } from '../../store/useHistoryStore'
import { useProjectStore } from '../../store/useProjectStore'
import {
  useWorkspaceStore,
  type ConstraintAxis,
  type TransformData,
  type TransformTarget,
  type ViewportTool,
} from '../../store/useWorkspaceStore'
import { SingleTransformControls } from './SingleTransformControls'
import {
  applySafeObjectTransform,
  isolateTransformForTool,
  readSafeObjectTransform,
} from './transformSafety'

interface LoadedUrdfRobotProps {
  onLoadStateChange: (state: {
    ready: boolean
    hasRenderableGeometry: boolean
    errors: string[]
  }) => void
  onTransformDraggingChange: (dragging: boolean) => void
}

type TransformTool = Extract<ViewportTool, 'move' | 'rotate' | 'scale'>
type EditableGeometryObject = URDFVisual | URDFCollider
type EditableGeometryTarget = {
  kind: 'mesh'
  object: EditableGeometryObject
  linkName: string
  role: MeshRole
  entityId: string
}
type LinkTransformTarget = {
  kind: 'link'
  object: URDFJoint | Group
  linkName: string
  jointName?: string
  transformOwner: 'incoming-joint' | 'root-scene'
  entityId: string
}
type RobotTransformTarget = {
  kind: 'robot'
  object: Group
  entityId: string
}
type EditableTransformTarget = EditableGeometryTarget | LinkTransformTarget | RobotTransformTarget
type HistoryTransformTarget =
  | {
      kind: 'robot'
      robotId: string
    }
  | {
      kind: 'link-joint'
      linkName: string
      jointName: string
    }
  | {
      kind: 'mesh'
      linkName: string
      role: MeshRole
      entityId: string
    }
type SelectionTarget =
  | { kind: 'robot-root'; robotId: string }
  | { kind: 'link'; linkId: string }
  | { kind: 'joint'; jointId: string }
  | { kind: 'mesh'; meshId: string }
  | { kind: 'sensor'; sensorId: string }

const MIN_MESH_SCALE = 0.0001
const MAX_CONTROLLER_FRAME_DELTA = 0.05
const WHEEL_ANGLE_WRAP = Math.PI * 2

function safeNumber(value: number, fallback = 0) {
  return Number.isFinite(value) ? value : fallback
}

function clampUnit(value: number) {
  return Math.min(1, Math.max(-1, safeNumber(value)))
}

function safeControllerDelta(delta: number) {
  return Math.min(MAX_CONTROLLER_FRAME_DELTA, Math.max(0, safeNumber(delta)))
}

function wrapWheelAngle(value: number) {
  const safeValue = safeNumber(value)
  return ((((safeValue + Math.PI) % WHEEL_ANGLE_WRAP) + WHEEL_ANGLE_WRAP) % WHEEL_ANGLE_WRAP) - Math.PI
}

function setPreviewJointValue(robot: URDFRobot, jointName: string, value: number) {
  if (!jointName || !Number.isFinite(value) || !robot.joints[jointName]) {
    return false
  }

  return robot.setJointValue(jointName, value)
}

function hasRenderableGeometry(object: Object3D) {
  let hasGeometry = false

  object.traverse((child) => {
    if (child instanceof Mesh && child.geometry) {
      hasGeometry = true
    }
  })

  return hasGeometry
}

function prepareRobotForScene(robot: URDFRobot) {
  robot.traverse((child) => {
    child.castShadow = true
    child.receiveShadow = true

    if (child instanceof Mesh) {
      child.geometry?.computeBoundingSphere()
      child.geometry?.computeBoundingBox()

      if (findUrdfAncestor(child, 'isURDFCollider')) {
        child.material = new MeshStandardMaterial({
          color: '#38bdf8',
          depthWrite: false,
          opacity: 0.22,
          transparent: true,
          wireframe: true,
        })
      }
    }
  })
}

function findUrdfAncestor(object: Object3D | null, flag: 'isURDFCollider' | 'isURDFVisual') {
  let current: Object3D | null = object

  while (current) {
    if ((current as unknown as Record<string, unknown>)[flag]) {
      return current
    }

    current = current.parent
  }

  return null
}

function findLinkFromObject(object: Object3D | null): URDFLink | null {
  let current: Object3D | null = object

  while (current) {
    const candidate = current as URDFLink & { isURDFLink?: boolean }

    if (candidate.isURDFLink) {
      return candidate
    }

    current = current.parent
  }

  return null
}

function findEditableGeometryFromObject(object: Object3D | null): EditableGeometryTarget | null {
  let current: Object3D | null = object
  let geometry: EditableGeometryObject | null = null

  while (current) {
    const candidate = current as EditableGeometryObject & {
      isURDFVisual?: boolean
      isURDFCollider?: boolean
    }

    if (candidate.isURDFVisual || candidate.isURDFCollider) {
      geometry = candidate
    }

    const link = current as URDFLink & { isURDFLink?: boolean }

    if (link.isURDFLink && link.urdfName && geometry) {
      const role: MeshRole = (geometry as URDFCollider & { isURDFCollider?: boolean }).isURDFCollider
        ? 'collision'
        : 'visual'

      return {
        kind: 'mesh',
        object: geometry,
        linkName: link.urdfName,
        role,
        entityId: meshSelectionId(link.urdfName, role),
      }
    }

    current = current.parent
  }

  return null
}

function findDirectGeometry(link: URDFLink | undefined, role: MeshRole): EditableGeometryObject | null {
  if (!link) {
    return null
  }

  return (
    (link.children.find((child) => {
      const candidate = child as EditableGeometryObject & {
        isURDFVisual?: boolean
        isURDFCollider?: boolean
      }

      return role === 'visual' ? candidate.isURDFVisual : candidate.isURDFCollider
    }) as EditableGeometryObject | undefined) ?? null
  )
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

function tupleFromVector(vector: { x: number; y: number; z: number }): [number, number, number] {
  return [vector.x, vector.y, vector.z]
}

function vectorFromTuple(tuple: [number, number, number]) {
  return {
    x: tuple[0],
    y: tuple[1],
    z: tuple[2],
  }
}

function addTuple(
  value: [number, number, number],
  delta: [number, number, number],
): [number, number, number] {
  return [value[0] + delta[0], value[1] + delta[1], value[2] + delta[2]]
}

function subtractTuple(
  value: [number, number, number],
  baseline: [number, number, number],
): [number, number, number] {
  return [value[0] - baseline[0], value[1] - baseline[1], value[2] - baseline[2]]
}

function multiplyTuple(
  value: [number, number, number],
  factor: [number, number, number],
): [number, number, number] {
  return [value[0] * factor[0], value[1] * factor[1], value[2] * factor[2]]
}

function clampScaleTuple(value: [number, number, number]): [number, number, number] {
  return value.map((item) =>
    Number.isFinite(item) ? Math.max(Math.abs(item), MIN_MESH_SCALE) : 1,
  ) as [number, number, number]
}

function divideTuple(
  value: [number, number, number],
  baseline: [number, number, number],
): [number, number, number] {
  return [
    Math.abs(baseline[0]) > MIN_MESH_SCALE ? value[0] / baseline[0] : 1,
    Math.abs(baseline[1]) > MIN_MESH_SCALE ? value[1] / baseline[1] : 1,
    Math.abs(baseline[2]) > MIN_MESH_SCALE ? value[2] / baseline[2] : 1,
  ]
}

function transformDataEqual(left: TransformData, right: TransformData) {
  return (
    left.position.every((value, index) => value === right.position[index]) &&
    left.rotation.every((value, index) => value === right.rotation[index]) &&
    left.scale.every((value, index) => value === right.scale[index])
  )
}

function historyTargetLabel(target: HistoryTransformTarget) {
  if (target.kind === 'robot') {
    return target.robotId || 'robot'
  }

  if (target.kind === 'link-joint') {
    return target.linkName
  }

  return `${target.linkName} ${target.role} mesh`
}

function toolHistoryVerb(tool: TransformTool) {
  if (tool === 'move') {
    return 'Move'
  }

  if (tool === 'rotate') {
    return 'Rotate'
  }

  return 'Scale'
}

function robotEntityId(name: string) {
  return `robot:${name || 'robot'}`
}

function targetOutlineColor(target: EditableTransformTarget) {
  if (target.kind === 'robot') {
    return '#6ed6c5'
  }

  if (target.kind === 'link') {
    return '#f2b84b'
  }

  return target.role === 'collision' ? '#38bdf8' : '#facc15'
}

function SelectionOutline({
  object,
  color,
}: {
  object: Object3D
  color: string
}) {
  const helper = useMemo(() => new BoxHelper(object, color), [color, object])

  useFrame(() => {
    helper.update()
  })

  useEffect(
    () => () => {
      helper.dispose()
    },
    [helper],
  )

  return <primitive object={helper} />
}

function isVisible(
  hierarchy: ReturnType<typeof buildRobotHierarchy>,
  visibility: EntityVisibilityMap,
  entityId: string,
) {
  return isEntityEffectivelyVisible(hierarchy, visibility, entityId)
}

function roleLayerVisible(layers: VisibilityLayerState, role: MeshRole) {
  return role === 'collision' ? layers.collision : layers.visual
}

function transformTargetForEditableTarget(target: EditableTransformTarget): TransformTarget {
  if (target.kind === 'robot') {
    return { type: 'robot', robotId: target.entityId.replace(/^robot:/, '') }
  }

  if (target.kind === 'link') {
    return { type: 'link', linkId: target.linkName }
  }

  return { type: 'mesh', meshId: target.entityId }
}

function selectionTargetFromSelection(
  selection: ReturnType<typeof useProjectStore.getState>['selection'],
  robotName: string,
): SelectionTarget {
  if (selection.kind === 'robot') {
    return { kind: 'robot-root', robotId: selection.id || robotName }
  }

  if (selection.kind === 'link') {
    return { kind: 'link', linkId: selection.id }
  }

  if (selection.kind === 'joint') {
    return { kind: 'joint', jointId: selection.id }
  }

  if (selection.kind === 'sensor') {
    return { kind: 'sensor', sensorId: selection.id }
  }

  return { kind: 'mesh', meshId: selection.id }
}

export function LoadedUrdfRobot({
  onLoadStateChange,
  onTransformDraggingChange,
}: LoadedUrdfRobotProps) {
  const document = useProjectStore((state) => state.document)
  const lastValidXml = useProjectStore((state) => state.buffers.lastValidXml)
  const robotModel = useProjectStore((state) => state.robot)
  const robotName = robotModel.name
  const controllerState = useProjectStore((state) => state.controllerState)
  const projectRoot = useProjectStore((state) => state.projectRoot)
  const selection = useProjectStore((state) => state.selection)
  const select = useProjectStore((state) => state.select)
  const patchJointOriginField = useProjectStore((state) => state.patchJointOriginField)
  const patchLinkGeometryOriginField = useProjectStore((state) => state.patchLinkGeometryOriginField)
  const patchLinkGeometryScale = useProjectStore((state) => state.patchLinkGeometryScale)
  const viewportTool = useWorkspaceStore((state) => state.viewportTool)
  const selectionMode = useWorkspaceStore((state) => state.selectionMode)
  const transformScope = useWorkspaceStore((state) => state.transformScope)
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
  const entityVisibility = useWorkspaceStore((state) => state.entityVisibility)
  const layerVisibility = useWorkspaceStore((state) => state.layerVisibility)
  const hierarchy = useMemo(() => buildRobotHierarchy(robotModel), [robotModel])
  const initialTransformRef = useRef<TransformData | null>(null)
  const initialObjectTransformRef = useRef<TransformData | null>(null)
  const pendingPatchTargetRef = useRef<EditableTransformTarget | null>(null)
  const pendingPatchTransformRef = useRef<TransformData | null>(null)
  const pendingPatchToolRef = useRef<TransformTool | null>(null)
  const pendingSessionTransformRef = useRef<TransformData | null>(null)
  const patchTimerRef = useRef<number | null>(null)
  const sessionFrameRef = useRef<number | null>(null)
  const lastPatchAtRef = useRef(0)
  const robotRef = useRef<URDFRobot | null>(null)
  const controllerStateRef = useRef(controllerState)
  const controllerFaultRef = useRef(false)
  const wheelAnglesRef = useRef<Record<string, number>>({})
  const [robotGroup, setRobotGroup] = useState<Group | null>(null)
  const [robot, setRobot] = useState<URDFRobot | null>(null)
  const wheelGroups = useMemo(() => detectDifferentialWheelGroups(robotModel), [robotModel])
  const wheelJointNames = useMemo(() => getWheelJointNames(robotModel), [robotModel])
  const jointPreviewMap = useMemo(
    () => new Map(robotModel.joints.map((joint) => [joint.name, joint])),
    [robotModel.joints],
  )
  const leftWheelSet = useMemo(() => new Set(wheelGroups.left), [wheelGroups.left])
  const rightWheelSet = useMemo(() => new Set(wheelGroups.right), [wheelGroups.right])

  useEffect(() => {
    robotRef.current = robot
  }, [robot])

  useEffect(() => {
    controllerStateRef.current = controllerState
  }, [controllerState])

  useEffect(() => {
    controllerFaultRef.current = false
  }, [controllerState.activeType, robot, robotName])

  useFrame((_, delta) => {
    try {
      const currentRobot = robotRef.current

      if (!currentRobot) {
        return
      }

      const state = controllerStateRef.current
      const frameDelta = safeControllerDelta(delta)
      const jointValues =
        state.jointValues && typeof state.jointValues === 'object' ? state.jointValues : {}

      Object.entries(jointValues).forEach(([jointName, value]) => {
        const joint = jointPreviewMap.get(jointName)
        const safeValue = joint ? clampJointValue(joint, safeNumber(value)) : safeNumber(value)
        setPreviewJointValue(currentRobot, jointName, safeValue)
      })

      const driveModeActive =
        state.activeType === 'differential-drive' || state.activeType === 'combined'
      const wheelCount = wheelJointNames.length
      const drivePreviewAvailable =
        wheelCount > 0 &&
        wheelCount <= 6 &&
        (wheelCount === 1 || (wheelGroups.left.length > 0 && wheelGroups.right.length > 0))

      if (!driveModeActive || !drivePreviewAvailable) {
        return
      }

      const wheelSpeeds = state.wheelSpeeds ?? { left: 0, right: 0 }
      const speedMultiplier = Math.min(4, Math.max(0.1, safeNumber(state.speedMultiplier, 1)))
      const leftSpeed = clampUnit(wheelSpeeds.left) * speedMultiplier
      const rightSpeed =
        (wheelCount === 1 ? clampUnit(wheelSpeeds.left) : clampUnit(wheelSpeeds.right)) *
        speedMultiplier

      if (Math.abs(leftSpeed) < 0.001 && Math.abs(rightSpeed) < 0.001) {
        return
      }

      const wheelRate = 4

      wheelJointNames.forEach((jointName) => {
        const sideSpeed =
          wheelCount === 1 || wheelGroups.unassigned.includes(jointName)
            ? leftSpeed
            : leftWheelSet.has(jointName)
              ? leftSpeed
              : rightWheelSet.has(jointName)
                ? -rightSpeed
                : 0

        if (Math.abs(sideSpeed) < 0.001) {
          return
        }

        const nextAngle = wrapWheelAngle(
          (wheelAnglesRef.current[jointName] ?? 0) + sideSpeed * wheelRate * frameDelta,
        )
        wheelAnglesRef.current[jointName] = nextAngle
        setPreviewJointValue(currentRobot, jointName, nextAngle)
      })
    } catch (error) {
      if (controllerFaultRef.current) {
        return
      }

      controllerFaultRef.current = true
      console.error('Controller preview failed', error)
      const project = useProjectStore.getState()
      project.setDriveCommand(0, 0)
      project.setControllerValidation({
        canRun: false,
        reason:
          error instanceof Error
            ? `Controller preview stopped: ${error.message}`
            : 'Controller preview stopped due to an invalid preview value.',
        requirements: [],
        detected: [],
      })
    }
  })

  useEffect(() => {
    if (!robot) {
      return
    }

    if (
      controllerState.isRunning ||
      Object.keys(controllerState.jointValues).length ||
      Math.abs(controllerState.wheelSpeeds.left) > 0.001 ||
      Math.abs(controllerState.wheelSpeeds.right) > 0.001
    ) {
      return
    }

    wheelAnglesRef.current = {}

    robotModel.joints.forEach((joint) => {
      setPreviewJointValue(robot, joint.name, 0)
    })
  }, [
    controllerState.isRunning,
    controllerState.jointValues,
    controllerState.wheelSpeeds.left,
    controllerState.wheelSpeeds.right,
    robot,
    robotModel.joints,
  ])

  useEffect(() => {
    let canceled = false
    const api = electronBridge()
    const errors: string[] = []
    const manager = new LoadingManager()
    const loader = new URDFLoader(manager)
    let pendingRobot: URDFRobot | null = null

    loader.workingPath = ''
    loader.packages = (packageName) => `package://${packageName}`
    loader.parseVisual = true
    loader.parseCollision = true
    loader.loadMeshCb = (meshPath, meshManager, done) => {
      if (!api) {
        const message = 'Electron mesh resolver is not available.'
        errors.push(message)
        done(new Object3D(), new Error(message))
        return
      }

      void api
        .resolveMeshUrl({
          filename: meshPath,
          filePath: document.filePath,
          projectDir: document.projectDir,
          workspaceRoot: projectRoot,
        })
        .then((resolved) => {
          if (!resolved.ok || !resolved.url) {
            const message = resolved.error ?? `Unable to resolve mesh: ${meshPath}`
            errors.push(message)
            done(new Object3D(), new Error(message))
            return
          }

          if (/\.stl$/i.test(meshPath)) {
            const stlLoader = new STLLoader(meshManager)
            stlLoader.load(
              resolved.url,
              (geometry) => {
                done(new Mesh(geometry))
              },
              undefined,
              (error) => {
                errors.push(error instanceof Error ? error.message : `Unable to load ${meshPath}`)
                done(new Object3D(), error instanceof Error ? error : new Error(String(error)))
              },
            )
            return
          }

          if (/\.dae$/i.test(meshPath)) {
            const colladaLoader = new ColladaLoader(meshManager)
            colladaLoader.setResourcePath(resolved.directoryUrl ?? '')
            colladaLoader.load(
              resolved.url,
              (collada) => {
                done(collada?.scene ?? new Object3D())
              },
              undefined,
              (error) => {
                errors.push(error instanceof Error ? error.message : `Unable to load ${meshPath}`)
                done(new Object3D(), error instanceof Error ? error : new Error(String(error)))
              },
            )
            return
          }

          const message = `No mesh loader registered for ${meshPath}`
          errors.push(message)
          done(new Object3D(), new Error(message))
        })
        .catch((error) => {
          const message =
            error instanceof Error ? error.message : `Unable to resolve mesh path: ${meshPath}`
          errors.push(message)
          done(new Object3D(), new Error(message))
        })
    }

    manager.onLoad = () => {
      if (canceled) {
        return
      }

      if (pendingRobot) {
        prepareRobotForScene(pendingRobot)
        setRobot(pendingRobot)
        onLoadStateChange({
          ready: true,
          hasRenderableGeometry: hasRenderableGeometry(pendingRobot),
          errors,
        })
      }
    }

    try {
      const nextRobot = loader.parse(lastValidXml)
      prepareRobotForScene(nextRobot)
      const renderableNow = hasRenderableGeometry(nextRobot)

      if (!canceled && renderableNow) {
        queueMicrotask(() => {
          if (canceled) {
            return
          }

          setRobot(nextRobot)
          onLoadStateChange({
            ready: true,
            hasRenderableGeometry: true,
            errors,
          })
        })
      } else if (!canceled) {
        pendingRobot = nextRobot
        const currentRobot = robotRef.current
        onLoadStateChange({
          ready: Boolean(currentRobot),
          hasRenderableGeometry: currentRobot ? hasRenderableGeometry(currentRobot) : false,
          errors,
        })
      }
    } catch (error) {
      if (!canceled) {
        const message = error instanceof Error ? error.message : 'URDFLoader failed to parse robot.'
        queueMicrotask(() => {
          if (canceled) {
            return
          }

          const currentRobot = robotRef.current
          onLoadStateChange({
            ready: Boolean(currentRobot),
            hasRenderableGeometry: currentRobot ? hasRenderableGeometry(currentRobot) : false,
            errors: [message],
          })
        })
      }
    }

    return () => {
      canceled = true
    }
  }, [document.filePath, document.projectDir, document.openedAt, lastValidXml, onLoadStateChange, projectRoot])

  const selectedTarget = useMemo<EditableTransformTarget | null>(() => {
    if (!robot) {
      return null
    }

    const selectionTarget = selectionTargetFromSelection(selection, robotName)

    if (selectionTarget.kind === 'robot-root' && robotGroup) {
      if (transformEditScope !== 'scene-root') {
        return null
      }

      return {
        kind: 'robot',
        object: robotGroup,
        entityId: robotEntityId(selectionTarget.robotId),
      }
    }

    if (selectionTarget.kind === 'link') {
      if (transformEditScope !== 'robot-entity' && transformEditScope !== 'scene-root') {
        return null
      }

      const object = robot.links[selectionTarget.linkId]

      if (!object) {
        return null
      }

      if (viewportTool === 'scale' || (transformScope === 'entity' && selectionMode === 'mesh')) {
        const visualObject = findDirectGeometry(object, 'visual')
        const collisionObject = findDirectGeometry(object, 'collision')
        const meshObject = visualObject ?? collisionObject
        const role: MeshRole = visualObject ? 'visual' : 'collision'

        return meshObject
          ? {
              kind: 'mesh',
              object: meshObject,
              linkName: selectionTarget.linkId,
              role,
              entityId: meshSelectionId(selectionTarget.linkId, role),
            }
          : null
      }

      const incomingJoint = robotModel.joints.find((joint) => joint.child === selectionTarget.linkId)
      const jointObject = incomingJoint ? robot.joints[incomingJoint.name] : undefined

      if (incomingJoint) {
        return jointObject
          ? {
              kind: 'link',
              object: jointObject,
              linkName: selectionTarget.linkId,
              jointName: incomingJoint.name,
              transformOwner: 'incoming-joint',
              entityId: `link:${selectionTarget.linkId}`,
            }
          : null
      }

      if (!robotGroup) {
        return null
      }

      return {
        kind: 'link',
        object: robotGroup,
        linkName: selectionTarget.linkId,
        transformOwner: 'root-scene',
        entityId: `link:${selectionTarget.linkId}`,
      }
    }

    if (selectionTarget.kind === 'mesh') {
      if (transformEditScope !== 'robot-entity') {
        return null
      }

      const meshRef = parseMeshSelectionId(selectionTarget.meshId)

      if (!meshRef) {
        return null
      }

      const object = findDirectGeometry(robot.links[meshRef.linkName], meshRef.role)

      return object
        ? {
            kind: 'mesh',
            object,
            linkName: meshRef.linkName,
            role: meshRef.role,
            entityId: selectionTarget.meshId,
          }
        : null
    }

    return null
  }, [
    robot,
    robotGroup,
    robotModel.joints,
    robotName,
    selection,
    selectionMode,
    transformEditScope,
    transformScope,
    viewportTool,
  ])
  const selectedObject = selectedTarget?.object
  const selectedTargetVisible = selectedTarget
    ? selectedTarget.kind === 'robot'
      ? isVisible(hierarchy, entityVisibility, robotEntityId(robotName))
      : selectedTarget.kind === 'link'
        ? isVisible(hierarchy, entityVisibility, `link:${selectedTarget.linkName}`)
        : isVisible(hierarchy, entityVisibility, selectedTarget.entityId) &&
          roleLayerVisible(layerVisibility, selectedTarget.role)
    : false
  const transformOwnerId = selectedTarget ? `loaded-urdf:${selectedTarget.entityId}` : null
  const selectedTargetCanUseTool =
    Boolean(selectedTarget) &&
    !(
      selectedTarget?.kind === 'link' &&
      selectedTarget.transformOwner === 'incoming-joint' &&
      viewportTool === 'scale'
    ) &&
    ((selectedTarget?.kind === 'link' && selectedTarget.transformOwner === 'root-scene') ||
      (transformEditScope === 'scene-root' &&
      (selectedTarget?.kind === 'robot' ||
        (selectedTarget?.kind === 'link' && selectedTarget.transformOwner === 'root-scene'))) ||
      (transformEditScope === 'robot-entity' &&
        selectedTarget?.kind !== 'robot' &&
        !(selectedTarget?.kind === 'link' && selectedTarget.transformOwner === 'root-scene')))
  const canTransform = Boolean(
    selectedTarget &&
      selectedTargetVisible &&
      transformOwnerId &&
      isTransformTool(viewportTool) &&
      selectedTargetCanUseTool &&
      (!activeTransformOwnerId || activeTransformOwnerId === transformOwnerId),
  )

  function getTargetUrdfTransform(target: EditableTransformTarget): TransformData {
    if (target.kind === 'robot' || (target.kind === 'link' && target.transformOwner === 'root-scene')) {
      return robotSceneTransform
    }

    if (target.kind === 'link') {
      const joint = target.jointName
        ? robotModel.joints.find((item) => item.name === target.jointName)
        : robotModel.joints.find((item) => item.child === target.linkName)

      return {
        position: tupleFromVector(joint?.origin.xyz ?? { x: 0, y: 0, z: 0 }),
        rotation: tupleFromVector(joint?.origin.rpy ?? { x: 0, y: 0, z: 0 }),
        scale: [1, 1, 1],
      }
    }

    const link = robotModel.links.find((item) => item.name === target.linkName)
    const geometry = target.role === 'visual' ? link?.visual : link?.collision

    return {
      position: tupleFromVector(geometry?.origin?.xyz ?? { x: 0, y: 0, z: 0 }),
      rotation: tupleFromVector(geometry?.origin?.rpy ?? { x: 0, y: 0, z: 0 }),
      scale: tupleFromVector(geometry?.geometry?.mesh?.scale ?? { x: 1, y: 1, z: 1 }),
    }
  }

  function historyTargetFromEditableTarget(target: EditableTransformTarget): HistoryTransformTarget | null {
    if (target.kind === 'robot' || (target.kind === 'link' && target.transformOwner === 'root-scene')) {
      return { kind: 'robot', robotId: robotName }
    }

    if (target.kind === 'link') {
      if (!target.jointName) {
        return null
      }

      return {
        kind: 'link-joint',
        linkName: target.linkName,
        jointName: target.jointName,
      }
    }

    return {
      kind: 'mesh',
      linkName: target.linkName,
      role: target.role,
      entityId: target.entityId,
    }
  }

  function applyHistoryTransform(
    target: HistoryTransformTarget,
    tool: TransformTool,
    transform: TransformData,
  ) {
    if (target.kind === 'robot') {
      useWorkspaceStore.getState().setRobotSceneTransform(transform)
      return
    }

    const project = useProjectStore.getState()

    if (target.kind === 'link-joint') {
      if (tool === 'move') {
        project.patchJointOriginField(target.jointName, 'xyz', vectorFromTuple(transform.position), 'viewport-gizmo')
      } else if (tool === 'rotate') {
        project.patchJointOriginField(target.jointName, 'rpy', vectorFromTuple(transform.rotation), 'viewport-gizmo')
      }

      return
    }

    if (tool === 'move') {
      project.patchLinkGeometryOriginField(
        target.linkName,
        target.role,
        'xyz',
        vectorFromTuple(transform.position),
        'viewport-gizmo',
      )
    } else if (tool === 'rotate') {
      project.patchLinkGeometryOriginField(
        target.linkName,
        target.role,
        'rpy',
        vectorFromTuple(transform.rotation),
        'viewport-gizmo',
      )
    } else {
      project.patchLinkGeometryScale(
        target.linkName,
        target.role,
        vectorFromTuple(clampScaleTuple(transform.scale)),
        'viewport-gizmo',
      )
    }
  }

  function pushTransformHistory(
    target: EditableTransformTarget,
    tool: TransformTool,
    before: TransformData,
    after: TransformData,
  ) {
    if (transformDataEqual(before, after) || useHistoryStore.getState().isApplying) {
      return
    }

    const historyTarget = historyTargetFromEditableTarget(target)

    if (!historyTarget) {
      return
    }

    useHistoryStore.getState().push(
      createHistoryEntry({
        label: `${toolHistoryVerb(tool)} ${historyTargetLabel(historyTarget)}`,
        source: 'viewport',
        undo: () => applyHistoryTransform(historyTarget, tool, before),
        redo: () => applyHistoryTransform(historyTarget, tool, after),
      }),
    )
  }

  function nextFieldTransformFromObject(target: EditableTransformTarget): TransformData {
    const initialObjectTransform =
      initialObjectTransformRef.current ?? readSafeObjectTransform(target.object)
    const initialUrdfTransform = initialTransformRef.current ?? getTargetUrdfTransform(target)
    const objectTransform = isolateTransformForTool(
      viewportTool as TransformTool,
      readSafeObjectTransform(target.object, initialObjectTransform),
      initialObjectTransform,
    )
    const positionDelta = subtractTuple(objectTransform.position, initialObjectTransform.position)
    const rotationDelta = subtractTuple(objectTransform.rotation, initialObjectTransform.rotation)
    const scaleFactor = divideTuple(objectTransform.scale, initialObjectTransform.scale)

    applySafeObjectTransform(target.object, objectTransform)

    if (viewportTool === 'move') {
      return {
        position: addTuple(initialUrdfTransform.position, positionDelta),
        rotation: initialUrdfTransform.rotation,
        scale: initialUrdfTransform.scale,
      }
    }

    if (viewportTool === 'rotate') {
      return {
        position: initialUrdfTransform.position,
        rotation: addTuple(initialUrdfTransform.rotation, rotationDelta),
        scale: initialUrdfTransform.scale,
      }
    }

    return {
      position: initialUrdfTransform.position,
      rotation: initialUrdfTransform.rotation,
      scale: clampScaleTuple(multiplyTuple(initialUrdfTransform.scale, scaleFactor)),
    }
  }

  function patchSelectedTargetTransform(
    target: EditableTransformTarget,
    transform: TransformData,
    activeTool: TransformTool,
  ) {
    if (target.kind === 'robot' || (target.kind === 'link' && target.transformOwner === 'root-scene')) {
      setRobotSceneTransform(transform)
      return
    }

    if (target.kind === 'link') {
      if (!target.jointName) {
        return
      }

      if (activeTool === 'move') {
        const nextXYZ = vectorFromTuple(transform.position)
        if (import.meta.env.DEV) {
          console.debug({
            axis: constraintAxis ?? 'free',
            delta: subtractTuple(transform.position, initialTransformRef.current?.position ?? transform.position),
            beforeXYZ: initialTransformRef.current?.position,
            afterXYZ: transform.position,
          })
        }
        patchJointOriginField(target.jointName, 'xyz', nextXYZ, 'viewport-gizmo')
      } else if (activeTool === 'rotate') {
        patchJointOriginField(target.jointName, 'rpy', vectorFromTuple(transform.rotation), 'viewport-gizmo')
      }

      return
    }

    if (activeTool === 'move') {
      const nextXYZ = vectorFromTuple(transform.position)
      if (import.meta.env.DEV) {
        console.debug({
          axis: constraintAxis ?? 'free',
          delta: subtractTuple(transform.position, initialTransformRef.current?.position ?? transform.position),
          beforeXYZ: initialTransformRef.current?.position,
          afterXYZ: transform.position,
        })
      }
      patchLinkGeometryOriginField(target.linkName, target.role, 'xyz', nextXYZ, 'viewport-gizmo')
    } else if (activeTool === 'rotate') {
      patchLinkGeometryOriginField(
        target.linkName,
        target.role,
        'rpy',
        vectorFromTuple(transform.rotation),
        'viewport-gizmo',
      )
    } else {
      patchLinkGeometryScale(
        target.linkName,
        target.role,
        vectorFromTuple(clampScaleTuple(transform.scale)),
        'viewport-gizmo',
      )
    }
  }

  function cancelPendingTransformCache() {
    if (patchTimerRef.current !== null) {
      window.clearTimeout(patchTimerRef.current)
      patchTimerRef.current = null
    }

    if (sessionFrameRef.current !== null) {
      window.cancelAnimationFrame(sessionFrameRef.current)
      sessionFrameRef.current = null
    }

    pendingPatchTargetRef.current = null
    pendingPatchTransformRef.current = null
    pendingPatchToolRef.current = null
    pendingSessionTransformRef.current = null
  }

  function flushPendingTransformPatch() {
    const target = pendingPatchTargetRef.current
    const transform = pendingPatchTransformRef.current
    const tool = pendingPatchToolRef.current

    if (!target || !transform || !tool) {
      return
    }

    if (patchTimerRef.current !== null) {
      window.clearTimeout(patchTimerRef.current)
      patchTimerRef.current = null
    }

    patchSelectedTargetTransform(target, transform, tool)
    lastPatchAtRef.current = performance.now()
    pendingPatchTargetRef.current = null
    pendingPatchTransformRef.current = null
    pendingPatchToolRef.current = null
  }

  function scheduleTransformPatch(
    target: EditableTransformTarget,
    transform: TransformData,
    tool: TransformTool,
  ) {
    pendingPatchTargetRef.current = target
    pendingPatchTransformRef.current = transform
    pendingPatchToolRef.current = tool

    const now = performance.now()
    const elapsed = now - lastPatchAtRef.current

    if (elapsed >= XML_PATCH_THROTTLE_MS) {
      flushPendingTransformPatch()
      return
    }

    if (patchTimerRef.current === null) {
      patchTimerRef.current = window.setTimeout(() => {
        patchTimerRef.current = null
        flushPendingTransformPatch()
      }, Math.max(0, XML_PATCH_THROTTLE_MS - elapsed))
    }
  }

  function scheduleTransformSessionUpdate(transform: TransformData) {
    pendingSessionTransformRef.current = transform

    if (sessionFrameRef.current !== null) {
      return
    }

    sessionFrameRef.current = window.requestAnimationFrame(() => {
      sessionFrameRef.current = null
      const latestTransform = pendingSessionTransformRef.current

      if (latestTransform) {
        updateTransformSession(latestTransform)
      }
    })
  }

  function handleClick(event: ThreeEvent<MouseEvent>) {
    if (viewportTool === 'view') {
      return undefined
    }

    event.stopPropagation()

    if (selectionMode === 'robot') {
      select({ kind: 'robot', id: robotName })
      return
    }

    const editableGeometry = findEditableGeometryFromObject(event.object)

    if (selectionMode === 'mesh' && editableGeometry) {
      if (
        !isVisible(hierarchy, entityVisibility, editableGeometry.entityId) ||
        !roleLayerVisible(layerVisibility, editableGeometry.role)
      ) {
        return
      }

      select({ kind: 'mesh', id: editableGeometry.entityId })
      return
    }

    const link = findLinkFromObject(event.object)

    if (selectionMode === 'link' && link?.urdfName) {
      if (!isVisible(hierarchy, entityVisibility, `link:${link.urdfName}`)) {
        return
      }

      select({ kind: 'link', id: link.urdfName })
      return
    }

    if (editableGeometry) {
      if (
        !isVisible(hierarchy, entityVisibility, editableGeometry.entityId) ||
        !roleLayerVisible(layerVisibility, editableGeometry.role)
      ) {
        return
      }

      select({ kind: 'mesh', id: editableGeometry.entityId })
      return
    }

    if (link?.urdfName) {
      if (!isVisible(hierarchy, entityVisibility, `link:${link.urdfName}`)) {
        return
      }

      select({ kind: 'link', id: link.urdfName })
    }
  }

  function beginTransform() {
    if (!selectedTarget || !isTransformTool(viewportTool)) {
      return
    }

    cancelPendingTransformCache()
    lastPatchAtRef.current = performance.now()

    if (transformSession?.objectId === selectedTarget.entityId && transformSession.mode === viewportTool) {
      initialTransformRef.current = transformSession.initialTransform
      initialObjectTransformRef.current ??= readSafeObjectTransform(selectedTarget.object)
      return
    }

    const transform = getTargetUrdfTransform(selectedTarget)
    initialTransformRef.current = transform
    initialObjectTransformRef.current = readSafeObjectTransform(selectedTarget.object)
    startTransformSession(
      viewportTool,
      selectedTarget.entityId,
      transform,
      transformTargetForEditableTarget(selectedTarget),
      selectedTarget.kind === 'robot' ||
        (selectedTarget.kind === 'link' && selectedTarget.transformOwner === 'root-scene')
        ? 'scene-placement'
        : 'urdf-entity-edit',
      transformOwnerId ?? undefined,
    )
  }

  function handleObjectChange() {
    if (!selectedTarget || !isTransformTool(viewportTool)) {
      return
    }

    const activeTool = viewportTool as TransformTool
    const transform = nextFieldTransformFromObject(selectedTarget)
    scheduleTransformSessionUpdate(transform)
    scheduleTransformPatch(selectedTarget, transform, activeTool)
  }

  function commitSelectedTransform() {
    if (!selectedTarget || !isTransformTool(viewportTool)) {
      return
    }

    const activeTool = viewportTool as TransformTool
    const beforeTransform = initialTransformRef.current ?? getTargetUrdfTransform(selectedTarget)
    const transform = nextFieldTransformFromObject(selectedTarget)
    pendingPatchTargetRef.current = selectedTarget
    pendingPatchTransformRef.current = transform
    pendingPatchToolRef.current = activeTool
    flushPendingTransformPatch()

    if (sessionFrameRef.current !== null) {
      window.cancelAnimationFrame(sessionFrameRef.current)
      sessionFrameRef.current = null
    }

    pendingSessionTransformRef.current = null
    updateTransformSession(transform)
    confirmTransformSession()
    pushTransformHistory(selectedTarget, activeTool, beforeTransform, transform)
    initialTransformRef.current = null
    initialObjectTransformRef.current = null
  }

  useEffect(() => {
    if (!robot) {
      return
    }

    const robotVisible = isVisible(hierarchy, entityVisibility, robotEntityId(robotName))

    Object.values(robot.links).forEach((link) => {
      const linkVisible = robotVisible && isVisible(hierarchy, entityVisibility, `link:${link.urdfName}`)

      link.children.forEach((child) => {
        const candidate = child as EditableGeometryObject & {
          isURDFVisual?: boolean
          isURDFCollider?: boolean
        }

        if (candidate.isURDFVisual) {
          candidate.visible =
            linkVisible &&
            layerVisibility.visual &&
            isVisible(hierarchy, entityVisibility, meshSelectionId(link.urdfName, 'visual'))
        }

        if (candidate.isURDFCollider) {
          candidate.visible =
            linkVisible &&
            roleLayerVisible(layerVisibility, 'collision') &&
            isVisible(hierarchy, entityVisibility, meshSelectionId(link.urdfName, 'collision'))
        }
      })
    })
  }, [entityVisibility, hierarchy, layerVisibility, robot, robotName])

  useEffect(() => {
    if (!robot || transformSession?.active) {
      return
    }

    robotModel.joints.forEach((joint) => {
      const jointObject = robot.joints[joint.name]

      if (!jointObject) {
        return
      }

      applySafeObjectTransform(jointObject, {
        position: tupleFromVector(joint.origin.xyz),
        rotation: tupleFromVector(joint.origin.rpy),
        scale: [1, 1, 1],
      })
    })

    robotModel.links.forEach((link) => {
      const roles: MeshRole[] = ['visual', 'collision']

      roles.forEach((role) => {
        const object = findDirectGeometry(robot.links[link.name], role)
        const geometry = role === 'visual' ? link.visual : link.collision

        if (!object || !geometry) {
          return
        }

        applySafeObjectTransform(object, {
          position: tupleFromVector(geometry.origin?.xyz ?? { x: 0, y: 0, z: 0 }),
          rotation: tupleFromVector(geometry.origin?.rpy ?? { x: 0, y: 0, z: 0 }),
          scale: clampScaleTuple(tupleFromVector(geometry.geometry?.mesh?.scale ?? { x: 1, y: 1, z: 1 })),
        })
      })
    })
  }, [robot, robotModel.joints, robotModel.links, transformSession?.active])

  useEffect(() => {
    if (!selectedObject || !initialObjectTransformRef.current) {
      return
    }

    cancelPendingTransformCache()
    applySafeObjectTransform(selectedObject, initialObjectTransformRef.current)
    initialTransformRef.current = null
    initialObjectTransformRef.current = null
  }, [selectedObject, transformCancelVersion])

  useEffect(
    () => () => {
      if (patchTimerRef.current !== null) {
        window.clearTimeout(patchTimerRef.current)
      }

      if (sessionFrameRef.current !== null) {
        window.cancelAnimationFrame(sessionFrameRef.current)
      }
    },
    [],
  )

  if (!robot) {
    return null
  }

  return (
    <>
      <group
        ref={setRobotGroup}
        name="RobotSceneRoot"
        position={robotSceneTransform.position}
        rotation={robotSceneTransform.rotation}
        scale={robotSceneTransform.scale}
        visible={isVisible(hierarchy, entityVisibility, robotEntityId(robotName))}
        userData={{ sceneObjectKind: 'robot', transformScope: 'scene-root' }}
      >
        <group
          name="RobotModelRoot"
          rotation={[-Math.PI / 2, 0, 0]}
          userData={{ sceneObjectKind: 'robot-model', transformScope: 'robot-entity' }}
        >
          <primitive object={robot} onClick={handleClick} />
        </group>
      </group>
      {selectedObject && selectedTarget && selectedTargetVisible ? (
        <SelectionOutline object={selectedObject} color={targetOutlineColor(selectedTarget)} />
      ) : null}
      {canTransform && selectedObject && selectedTarget && isTransformTool(viewportTool) ? (
        <SingleTransformControls
          object={selectedObject}
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
            commitSelectedTransform()
          }}
          onObjectChange={handleObjectChange}
        />
      ) : null}
    </>
  )
}
