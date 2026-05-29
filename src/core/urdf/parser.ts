import { XMLParser, XMLValidator } from 'fast-xml-parser'
import {
  emptyPose,
  identityTransform,
  type Diagnostic,
  type JointType,
  type LinkCollisionModel,
  type LinkVisualModel,
  type MeshWarning,
  type PoseModel,
  type RobotJointModel,
  type RobotLinkModel,
  type RobotModel,
  type RobotSensorModel,
  type SensorType,
  type TransformModel,
  type Vector3Tuple,
} from '../robot-model/types'
import { analyzeRobotSemantics } from '../robot-model/semantics'
import { defaultRobotModel } from './defaultUrdf'
import { describeMeshReference, isSupportedMesh } from './pathResolver'
import { validateRobotModel } from './validator'

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  allowBooleanAttributes: true,
  parseAttributeValue: false,
  trimValues: true,
})

const jointTypes: JointType[] = [
  'fixed',
  'revolute',
  'continuous',
  'prismatic',
  'floating',
  'planar',
]

const sensorTypes: SensorType[] = [
  'camera',
  'lidar',
  'depth_camera',
  'imu',
  'gps',
  'contact',
]

export interface ParseUrdfResult {
  model: RobotModel
  diagnostics: Diagnostic[]
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return []
  }

  return Array.isArray(value) ? value : [value]
}

function parseNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseVector(value: unknown, fallback: Vector3Tuple): Vector3Tuple {
  if (typeof value !== 'string') {
    return fallback
  }

  const parts = value
    .trim()
    .split(/\s+/)
    .map((part) => Number(part))

  return {
    x: Number.isFinite(parts[0]) ? parts[0] : fallback.x,
    y: Number.isFinite(parts[1]) ? parts[1] : fallback.y,
    z: Number.isFinite(parts[2]) ? parts[2] : fallback.z,
  }
}

function parsePose(value: Record<string, unknown> | undefined): PoseModel {
  const pose = emptyPose()

  if (!value) {
    return pose
  }

  return {
    xyz: parseVector(value.xyz, pose.xyz),
    rpy: parseVector(value.rpy, pose.rpy),
  }
}

function parsePoseText(value: unknown): PoseModel | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const parts = value
    .trim()
    .split(/\s+/)
    .map((part) => Number(part))

  if (parts.length < 6 || parts.some((part) => !Number.isFinite(part))) {
    return undefined
  }

  return {
    xyz: { x: parts[0], y: parts[1], z: parts[2] },
    rpy: { x: parts[3], y: parts[4], z: parts[5] },
  }
}

function parseGeometry(value: Record<string, unknown> | undefined) {
  const mesh = value?.mesh as Record<string, unknown> | undefined

  if (!mesh?.filename || typeof mesh.filename !== 'string') {
    return undefined
  }

  return {
    mesh: {
      filename: mesh.filename,
      scale: parseVector(mesh.scale, { x: 1, y: 1, z: 1 }),
    },
  }
}

function parseMass(value: unknown) {
  if (typeof value === 'object' && value) {
    return parseNumber((value as Record<string, unknown>).value)
  }

  return parseNumber(value)
}

function parseVisual(value: Record<string, unknown> | undefined): LinkVisualModel | undefined {
  if (!value) {
    return undefined
  }

  return {
    name: typeof value.name === 'string' ? value.name : undefined,
    origin: parsePose(value.origin as Record<string, unknown> | undefined),
    geometry: parseGeometry(value.geometry as Record<string, unknown> | undefined),
  }
}

function parseCollision(
  value: Record<string, unknown> | undefined,
): LinkCollisionModel | undefined {
  if (!value) {
    return undefined
  }

  return {
    name: typeof value.name === 'string' ? value.name : undefined,
    origin: parsePose(value.origin as Record<string, unknown> | undefined),
    geometry: parseGeometry(value.geometry as Record<string, unknown> | undefined),
  }
}

function parseLinks(robot: Record<string, unknown>): RobotLinkModel[] {
  return toArray(robot.link as Record<string, unknown> | Record<string, unknown>[]).map(
    (link, index) => {
      const visual = toArray(link.visual as Record<string, unknown> | Record<string, unknown>[])[0]
      const collision = toArray(
        link.collision as Record<string, unknown> | Record<string, unknown>[],
      )[0]

      return {
        name: typeof link.name === 'string' ? link.name : `link_${index + 1}`,
        visual: parseVisual(visual),
        collision: parseCollision(collision),
        inertial: link.inertial
          ? {
              mass: parseMass((link.inertial as Record<string, unknown>).mass),
              origin: parsePose((link.inertial as Record<string, unknown>).origin as Record<
                string,
                unknown
              >),
              inertia: (() => {
                const inertia = (link.inertial as Record<string, unknown>).inertia as
                  | Record<string, unknown>
                  | undefined

                return inertia
                  ? {
                      ixx: parseNumber(inertia.ixx),
                      ixy: parseNumber(inertia.ixy),
                      ixz: parseNumber(inertia.ixz),
                      iyy: parseNumber(inertia.iyy),
                      iyz: parseNumber(inertia.iyz),
                      izz: parseNumber(inertia.izz),
                    }
                  : undefined
              })(),
            }
          : undefined,
      }
    },
  )
}

function parseJointType(value: unknown): JointType {
  if (typeof value === 'string' && jointTypes.includes(value as JointType)) {
    return value as JointType
  }

  return 'fixed'
}

function parseJoints(robot: Record<string, unknown>): RobotJointModel[] {
  return toArray(robot.joint as Record<string, unknown> | Record<string, unknown>[]).map(
    (joint, index) => {
      const parent = joint.parent as Record<string, unknown> | undefined
      const child = joint.child as Record<string, unknown> | undefined
      const limit = joint.limit as Record<string, unknown> | undefined
      const dynamics = joint.dynamics as Record<string, unknown> | undefined
      const mimic = joint.mimic as Record<string, unknown> | undefined

      return {
        name: typeof joint.name === 'string' ? joint.name : `joint_${index + 1}`,
        type: parseJointType(joint.type),
        parent: typeof parent?.link === 'string' ? parent.link : '',
        child: typeof child?.link === 'string' ? child.link : '',
        origin: parsePose(joint.origin as Record<string, unknown> | undefined),
        axis: parseVector((joint.axis as Record<string, unknown> | undefined)?.xyz, {
          x: 1,
          y: 0,
          z: 0,
        }),
        limit: limit
          ? {
              lower: parseNumber(limit.lower),
              upper: parseNumber(limit.upper),
              effort: parseNumber(limit.effort),
              velocity: parseNumber(limit.velocity),
            }
          : undefined,
        dynamics: dynamics
          ? {
              damping: parseNumber(dynamics.damping),
              friction: parseNumber(dynamics.friction),
            }
          : undefined,
        mimic:
          mimic && typeof mimic.joint === 'string'
            ? {
                joint: mimic.joint,
                multiplier: parseNumber(mimic.multiplier),
                offset: parseNumber(mimic.offset),
              }
            : undefined,
      }
    },
  )
}

function parseSensorType(value: unknown): SensorType {
  if (typeof value === 'string' && sensorTypes.includes(value as SensorType)) {
    return value as SensorType
  }

  if (value === 'ray') {
    return 'lidar'
  }

  return 'unknown'
}

function parseSensors(robot: Record<string, unknown>): RobotSensorModel[] {
  return toArray(robot.gazebo as Record<string, unknown> | Record<string, unknown>[]).flatMap(
    (gazebo, gazeboIndex) => {
      const attachedTo = typeof gazebo.reference === 'string' ? gazebo.reference : 'base_link'

      return toArray(gazebo.sensor as Record<string, unknown> | Record<string, unknown>[]).map(
        (sensor, sensorIndex) => ({
          name:
            typeof sensor.name === 'string'
              ? sensor.name
              : `sensor_${gazeboIndex + 1}_${sensorIndex + 1}`,
          type: parseSensorType(sensor.type),
          attachedTo,
          origin: parsePose(sensor.origin as Record<string, unknown> | undefined),
        }),
      )
    },
  )
}

function inferSensorTypeFromLinkName(linkName: string): SensorType | null {
  const normalized = linkName.toLowerCase()

  if (normalized.includes('realsense') || normalized.includes('depth')) {
    return 'depth_camera'
  }

  if (normalized.includes('camera') || normalized.includes('cam')) {
    return 'camera'
  }

  if (normalized.includes('lidar') || normalized.includes('laser') || normalized.includes('scan')) {
    return 'lidar'
  }

  if (normalized.includes('imu')) {
    return 'imu'
  }

  if (normalized.includes('gps') || normalized.includes('gnss')) {
    return 'gps'
  }

  if (normalized.includes('contact') || normalized.includes('bumper')) {
    return 'contact'
  }

  return null
}

function inferSensorsFromLinks(
  links: RobotLinkModel[],
  existingSensors: RobotSensorModel[],
): RobotSensorModel[] {
  const existingAttachments = new Set(existingSensors.map((sensor) => `${sensor.type}:${sensor.attachedTo}`))

  return links.flatMap((link) => {
    const sensorType = inferSensorTypeFromLinkName(link.name)

    if (!sensorType || existingAttachments.has(`${sensorType}:${link.name}`)) {
      return []
    }

    return [
      {
        name: `${link.name}_${sensorType}`,
        type: sensorType,
        attachedTo: link.name,
        origin: emptyPose(),
      },
    ]
  })
}

function parseGazeboLinkPoses(robot: Record<string, unknown>) {
  const poses = new Map<string, PoseModel>()

  toArray(robot.gazebo as Record<string, unknown> | Record<string, unknown>[]).forEach((gazebo) => {
    if (typeof gazebo.reference !== 'string') {
      return
    }

    const pose = parsePoseText(gazebo.pose)

    if (pose) {
      poses.set(gazebo.reference, pose)
    }
  })

  return poses
}

function buildLinkTransforms(
  links: RobotLinkModel[],
  joints: RobotJointModel[],
  gazeboPoses: Map<string, PoseModel>,
) {
  const incomingJointByChild = new Map(joints.map((joint) => [joint.child, joint]))

  return links.map((link): RobotLinkModel => {
    const transform = identityTransform()
    const incomingJoint = incomingJointByChild.get(link.name)
    const gazeboPose = gazeboPoses.get(link.name)
    const visualPose = link.visual?.origin
    const scale =
      link.visual?.geometry?.mesh?.scale ?? link.collision?.geometry?.mesh?.scale ?? transform.scale
    const pose = incomingJoint?.origin ?? gazeboPose ?? visualPose

    const nextTransform: TransformModel = {
      position: pose?.xyz ?? transform.position,
      rotation: pose?.rpy ?? transform.rotation,
      scale,
    }

    return {
      ...link,
      transform: nextTransform,
    }
  })
}

function rootTransformFromPose(pose?: PoseModel): TransformModel | undefined {
  if (!pose) {
    return undefined
  }

  return {
    position: pose.xyz,
    rotation: pose.rpy,
    scale: { x: 1, y: 1, z: 1 },
  }
}

function collectMeshWarnings(links: RobotLinkModel[]): MeshWarning[] {
  return links.flatMap((link) => {
    const warnings: MeshWarning[] = []
    const visualMesh = link.visual?.geometry?.mesh
    const collisionMesh = link.collision?.geometry?.mesh

    if (visualMesh && !isSupportedMesh(visualMesh.filename)) {
      warnings.push({
        linkName: link.name,
        role: 'visual',
        filename: visualMesh.filename,
        message: describeMeshReference(visualMesh.filename),
      })
    }

    if (collisionMesh && !isSupportedMesh(collisionMesh.filename)) {
      warnings.push({
        linkName: link.name,
        role: 'collision',
        filename: collisionMesh.filename,
        message: describeMeshReference(collisionMesh.filename),
      })
    }

    return warnings
  })
}

export function parseUrdf(xml: string): ParseUrdfResult {
  const validationResult = XMLValidator.validate(xml, {
    allowBooleanAttributes: true,
  })

  if (validationResult !== true) {
    const error = validationResult.err
    return {
      model: defaultRobotModel,
      diagnostics: [
        {
          id: 'xml-parse-error',
          severity: 'error',
          message: error.msg,
          line: error.line,
          column: error.col,
        },
      ],
    }
  }

  try {
    const parsed = parser.parse(xml) as { robot?: Record<string, unknown> }
    const robot = parsed.robot

    if (!robot) {
      return {
        model: defaultRobotModel,
        diagnostics: [
          {
            id: 'missing-robot',
            severity: 'error',
            message: 'URDF must contain a root <robot> element.',
          },
        ],
      }
    }

    const links = parseLinks(robot)
    const joints = parseJoints(robot)
    const gazeboSensors = parseSensors(robot)
    const sensors = [...gazeboSensors, ...inferSensorsFromLinks(links, gazeboSensors)]
    const gazeboPoses = parseGazeboLinkPoses(robot)
    const childLinks = new Set(joints.map((joint) => joint.child))
    const rootLinkName = links.find((link) => !childLinks.has(link.name))?.name
    const rootTransform = rootTransformFromPose(rootLinkName ? gazeboPoses.get(rootLinkName) : undefined)
    const linkGazeboPoses = new Map(gazeboPoses)

    if (rootLinkName && rootTransform) {
      linkGazeboPoses.delete(rootLinkName)
    }

    const modelBase = {
      name: typeof robot.name === 'string' ? robot.name : 'untitled_robot',
      links: buildLinkTransforms(links, joints, linkGazeboPoses),
      joints,
      sensors,
      meshWarnings: collectMeshWarnings(links),
      ...(rootTransform ? { rootTransform } : {}),
    }
    const semanticAnalysis = analyzeRobotSemantics(modelBase)
    const model: RobotModel = {
      ...modelBase,
      controllers: semanticAnalysis.controllers,
      semantics: semanticAnalysis.semantics,
    }

    return {
      model,
      diagnostics: validateRobotModel(model),
    }
  } catch (error) {
    return {
      model: defaultRobotModel,
      diagnostics: [
        {
          id: 'parser-exception',
          severity: 'error',
          message: error instanceof Error ? error.message : 'Unable to parse URDF.',
        },
      ],
    }
  }
}
