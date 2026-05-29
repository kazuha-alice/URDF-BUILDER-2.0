import type {
  DifferentialDriveControllerModel,
  JointControllerModel,
  RobotControllerModel,
  RobotJointModel,
  RobotLinkModel,
  RobotModel,
  RobotSemanticAnalysis,
} from './types'

function includesAny(value: string, terms: string[]) {
  const normalized = value.toLowerCase()

  return terms.some((term) => normalized.includes(term))
}

function isMovableJoint(joint: RobotJointModel) {
  return joint.type === 'revolute' || joint.type === 'continuous' || joint.type === 'prismatic'
}

function jointSearchText(joint: RobotJointModel) {
  return `${joint.name} ${joint.parent} ${joint.child}`.toLowerCase()
}

function isWheelJoint(joint: RobotJointModel) {
  return isMovableJoint(joint) && includesAny(jointSearchText(joint), ['wheel', 'caster', 'tire'])
}

function isLeftJoint(joint: RobotJointModel) {
  const text = jointSearchText(joint)

  return /\bleft\b|\bl[_-]|[_-]left|left[_-]/.test(text)
}

function isRightJoint(joint: RobotJointModel) {
  const text = jointSearchText(joint)

  return /\bright\b|\br[_-]|[_-]right|right[_-]/.test(text)
}

function detectEndEffectors(links: RobotLinkModel[], joints: RobotJointModel[]) {
  const parentLinks = new Set(joints.map((joint) => joint.parent))

  return links
    .filter((link) => !parentLinks.has(link.name))
    .filter((link) => !includesAny(link.name, ['wheel', 'caster', 'camera', 'lidar', 'laser', 'imu']))
    .map((link) => link.name)
}

function detectRobotType(
  movableJoints: RobotJointModel[],
  wheelJoints: RobotJointModel[],
  leftWheelJoints: RobotJointModel[],
  rightWheelJoints: RobotJointModel[],
  links: RobotLinkModel[],
) {
  const linkText = links.map((link) => link.name).join(' ').toLowerCase()

  if (leftWheelJoints.length && rightWheelJoints.length) {
    return 'differential_drive' as const
  }

  if (includesAny(linkText, ['hip', 'knee', 'ankle']) && includesAny(linkText, ['left', 'right'])) {
    return 'humanoid' as const
  }

  if (includesAny(linkText, ['leg']) && movableJoints.length >= 8) {
    return 'quadruped' as const
  }

  if (movableJoints.length >= 2 && wheelJoints.length < movableJoints.length) {
    return 'robot_arm' as const
  }

  return 'custom' as const
}

function createJointController(movableJoints: RobotJointModel[]): JointControllerModel | null {
  if (!movableJoints.length) {
    return null
  }

  return {
    type: 'joint_group',
    id: 'joint-controller',
    name: 'Joint Controller',
    jointNames: movableJoints.map((joint) => joint.name),
    homePose: Object.fromEntries(movableJoints.map((joint) => [joint.name, 0])),
    generated: true,
  }
}

function createDifferentialController(
  leftWheelJoints: RobotJointModel[],
  rightWheelJoints: RobotJointModel[],
): DifferentialDriveControllerModel | null {
  if (!leftWheelJoints.length || !rightWheelJoints.length) {
    return null
  }

  return {
    type: 'differential_drive',
    id: 'differential-drive',
    name: 'RC Controller',
    leftWheelJoints: leftWheelJoints.map((joint) => joint.name),
    rightWheelJoints: rightWheelJoints.map((joint) => joint.name),
    linearVelocity: 0,
    angularVelocity: 0,
    generated: true,
  }
}

export function analyzeRobotSemantics(
  robot: Pick<RobotModel, 'links' | 'joints' | 'sensors'>,
): {
  semantics: RobotSemanticAnalysis
  controllers: RobotControllerModel[]
} {
  const movableJoints = robot.joints.filter(isMovableJoint)
  const wheelJoints = robot.joints.filter(isWheelJoint)
  const leftWheelJoints = wheelJoints.filter(isLeftJoint)
  const rightWheelJoints = wheelJoints.filter(isRightJoint)
  const controllers = [
    createJointController(movableJoints),
    createDifferentialController(leftWheelJoints, rightWheelJoints),
  ].filter((controller): controller is RobotControllerModel => Boolean(controller))
  const robotType = detectRobotType(
    movableJoints,
    wheelJoints,
    leftWheelJoints,
    rightWheelJoints,
    robot.links,
  )

  return {
    semantics: {
      robotType,
      movableJoints: movableJoints.map((joint) => joint.name),
      wheelJoints: wheelJoints.map((joint) => joint.name),
      endEffectors: detectEndEffectors(robot.links, robot.joints),
      sensors: robot.sensors.map((sensor) => sensor.name),
    },
    controllers,
  }
}
