import { XMLBuilder } from 'fast-xml-parser'
import type {
  JointDynamicsModel,
  JointLimitModel,
  JointMimicModel,
  LinkCollisionModel,
  LinkVisualModel,
  PoseModel,
  RobotModel,
  TransformModel,
  Vector3Tuple,
} from '../robot-model/types'

type XmlNode = Record<string, unknown>

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  format: true,
  suppressEmptyNode: true,
})

function vectorToString(vector: Vector3Tuple): string {
  return `${vector.x} ${vector.y} ${vector.z}`
}

function poseToString(origin: PoseModel): string {
  return `${vectorToString(origin.xyz)} ${vectorToString(origin.rpy)}`
}

function transformIsIdentity(transform?: TransformModel) {
  if (!transform) {
    return true
  }

  return (
    transform.position.x === 0 &&
    transform.position.y === 0 &&
    transform.position.z === 0 &&
    transform.rotation.x === 0 &&
    transform.rotation.y === 0 &&
    transform.rotation.z === 0 &&
    transform.scale.x === 1 &&
    transform.scale.y === 1 &&
    transform.scale.z === 1
  )
}

function originNode(origin?: PoseModel): XmlNode | undefined {
  if (!origin) {
    return undefined
  }

  return {
    xyz: vectorToString(origin.xyz),
    rpy: vectorToString(origin.rpy),
  }
}

function meshGeometryNode(filename?: string, scale?: Vector3Tuple): XmlNode | undefined {
  if (!filename) {
    return undefined
  }

  return {
    mesh: {
      filename,
      ...(scale ? { scale: vectorToString(scale) } : {}),
    },
  }
}

function visualNode(visual?: LinkVisualModel): XmlNode | undefined {
  const mesh = visual?.geometry?.mesh

  if (!visual && !mesh) {
    return undefined
  }

  return {
    ...(visual?.name ? { name: visual.name } : {}),
    ...(visual?.origin ? { origin: originNode(visual.origin) } : {}),
    ...(mesh ? { geometry: meshGeometryNode(mesh.filename, mesh.scale) } : {}),
  }
}

function collisionNode(collision?: LinkCollisionModel): XmlNode | undefined {
  const mesh = collision?.geometry?.mesh

  if (!collision && !mesh) {
    return undefined
  }

  return {
    ...(collision?.name ? { name: collision.name } : {}),
    ...(collision?.origin ? { origin: originNode(collision.origin) } : {}),
    ...(mesh ? { geometry: meshGeometryNode(mesh.filename, mesh.scale) } : {}),
  }
}

function limitNode(limit?: JointLimitModel): XmlNode | undefined {
  if (!limit) {
    return undefined
  }

  return {
    ...(limit.lower !== undefined ? { lower: String(limit.lower) } : {}),
    ...(limit.upper !== undefined ? { upper: String(limit.upper) } : {}),
    ...(limit.effort !== undefined ? { effort: String(limit.effort) } : {}),
    ...(limit.velocity !== undefined ? { velocity: String(limit.velocity) } : {}),
  }
}

function dynamicsNode(dynamics?: JointDynamicsModel): XmlNode | undefined {
  if (!dynamics) {
    return undefined
  }

  return {
    ...(dynamics.damping !== undefined ? { damping: String(dynamics.damping) } : {}),
    ...(dynamics.friction !== undefined ? { friction: String(dynamics.friction) } : {}),
  }
}

function mimicNode(mimic?: JointMimicModel): XmlNode | undefined {
  if (!mimic) {
    return undefined
  }

  return {
    joint: mimic.joint,
    ...(mimic.multiplier !== undefined ? { multiplier: String(mimic.multiplier) } : {}),
    ...(mimic.offset !== undefined ? { offset: String(mimic.offset) } : {}),
  }
}

export function exportRobotModelToUrdf(model: RobotModel): string {
  const childLinks = new Set(model.joints.map((joint) => joint.child))
  const rootTransform = !transformIsIdentity(model.rootTransform) ? model.rootTransform : undefined
  const rootLinkPoseGazeboEntries = model.links
    .filter((link) => !childLinks.has(link.name) && (!transformIsIdentity(link.transform) || rootTransform))
    .map((link) => ({
      reference: link.name,
      pose: poseToString({
        xyz: rootTransform?.position ?? link.transform?.position ?? { x: 0, y: 0, z: 0 },
        rpy: rootTransform?.rotation ?? link.transform?.rotation ?? { x: 0, y: 0, z: 0 },
      }),
    }))

  const sensorGazeboEntries = model.sensors.map((sensor) => ({
    reference: sensor.attachedTo,
    sensor: {
      name: sensor.name,
      type: sensor.type === 'lidar' ? 'ray' : sensor.type,
      ...(sensor.origin ? { origin: originNode(sensor.origin) } : {}),
    },
  }))

  const robotNode: XmlNode = {
    name: model.name || 'untitled_robot',
    link: model.links.map((link) => ({
      name: link.name,
      ...(visualNode(link.visual) ? { visual: visualNode(link.visual) } : {}),
      ...(collisionNode(link.collision) ? { collision: collisionNode(link.collision) } : {}),
      ...(link.inertial
        ? {
            inertial: {
              ...(link.inertial.origin ? { origin: originNode(link.inertial.origin) } : {}),
              ...(link.inertial.mass !== undefined
                ? { mass: { value: String(link.inertial.mass) } }
                : {}),
              ...(link.inertial.inertia
                ? {
                    inertia: {
                      ...(link.inertial.inertia.ixx !== undefined
                        ? { ixx: String(link.inertial.inertia.ixx) }
                        : {}),
                      ...(link.inertial.inertia.ixy !== undefined
                        ? { ixy: String(link.inertial.inertia.ixy) }
                        : {}),
                      ...(link.inertial.inertia.ixz !== undefined
                        ? { ixz: String(link.inertial.inertia.ixz) }
                        : {}),
                      ...(link.inertial.inertia.iyy !== undefined
                        ? { iyy: String(link.inertial.inertia.iyy) }
                        : {}),
                      ...(link.inertial.inertia.iyz !== undefined
                        ? { iyz: String(link.inertial.inertia.iyz) }
                        : {}),
                      ...(link.inertial.inertia.izz !== undefined
                        ? { izz: String(link.inertial.inertia.izz) }
                        : {}),
                    },
                  }
                : {}),
            },
          }
        : {}),
    })),
    joint: model.joints.map((joint) => ({
      name: joint.name,
      type: joint.type,
      parent: { link: joint.parent },
      child: { link: joint.child },
      origin: originNode(joint.origin),
      ...(joint.axis ? { axis: { xyz: vectorToString(joint.axis) } } : {}),
      ...(limitNode(joint.limit) ? { limit: limitNode(joint.limit) } : {}),
      ...(dynamicsNode(joint.dynamics) ? { dynamics: dynamicsNode(joint.dynamics) } : {}),
      ...(mimicNode(joint.mimic) ? { mimic: mimicNode(joint.mimic) } : {}),
    })),
    ...(rootLinkPoseGazeboEntries.length || sensorGazeboEntries.length
      ? {
          gazebo: [...rootLinkPoseGazeboEntries, ...sensorGazeboEntries],
        }
      : {}),
  }

  return `${builder.build({ robot: robotNode })}\n`
}
