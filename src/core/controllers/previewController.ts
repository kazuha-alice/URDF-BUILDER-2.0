import type { RobotJointModel, RobotModel } from '../robot-model/types'

export type ControllerType = 'basic-joint' | 'differential-drive' | 'combined'

export type DifferentialWheelGroups = {
  left: string[]
  right: string[]
  unassigned: string[]
}

export type ControllerValidationResult = {
  canRun: boolean
  reason?: string
  requirements: string[]
  detected: string[]
}

export type JointControlRange = {
  joint: RobotJointModel
  min: number
  max: number
  step: number
  unit: 'rad' | 'm'
}

export function isControllableJoint(joint: RobotJointModel) {
  return joint.type === 'revolute' || joint.type === 'continuous' || joint.type === 'prismatic'
}

function searchText(joint: RobotJointModel) {
  return `${joint.name} ${joint.parent} ${joint.child}`.toLowerCase()
}

export function isLikelyWheelJoint(joint: RobotJointModel) {
  return (
    isControllableJoint(joint) &&
    /\bwheel\b|wheel[_-]|[_-]wheel|tire|tyre|drive[_-]?joint|caster/.test(searchText(joint))
  )
}

function isLeftWheel(joint: RobotJointModel) {
  const text = searchText(joint)
  return /\bleft\b|left[_-]|[_-]left|\bl[_-]|[_-]l\b|front_left|rear_left/.test(text)
}

function isRightWheel(joint: RobotJointModel) {
  const text = searchText(joint)
  return /\bright\b|right[_-]|[_-]right|\br[_-]|[_-]r\b|front_right|rear_right/.test(text)
}

export function getControllableJoints(robot: RobotModel) {
  return robot.joints.filter(isControllableJoint)
}

export function getJointControlRange(joint: RobotJointModel): JointControlRange {
  if (joint.type === 'continuous') {
    return {
      joint,
      min: -Math.PI * 2,
      max: Math.PI * 2,
      step: 0.01,
      unit: 'rad',
    }
  }

  if (joint.type === 'prismatic') {
    return {
      joint,
      min: joint.limit?.lower ?? -1,
      max: joint.limit?.upper ?? 1,
      step: 0.01,
      unit: 'm',
    }
  }

  return {
    joint,
    min: joint.limit?.lower ?? -Math.PI,
    max: joint.limit?.upper ?? Math.PI,
    step: 0.01,
    unit: 'rad',
  }
}

export function clampJointValue(joint: RobotJointModel, value: number) {
  const range = getJointControlRange(joint)
  const finite = Number.isFinite(value) ? value : 0
  return Math.min(range.max, Math.max(range.min, finite))
}

export function detectDifferentialWheelGroups(robot: RobotModel): DifferentialWheelGroups {
  const wheelJoints = robot.joints.filter(isLikelyWheelJoint)
  const left = wheelJoints.filter(isLeftWheel).map((joint) => joint.name)
  const right = wheelJoints.filter(isRightWheel).map((joint) => joint.name)
  const assigned = new Set([...left, ...right])
  const unassigned = wheelJoints.filter((joint) => !assigned.has(joint.name)).map((joint) => joint.name)

  return {
    left,
    right,
    unassigned,
  }
}

export function getWheelJointNames(robot: RobotModel) {
  const groups = detectDifferentialWheelGroups(robot)
  return [...groups.left, ...groups.right, ...groups.unassigned]
}

export function validateBasicJointController(robot: RobotModel): ControllerValidationResult {
  const movable = getControllableJoints(robot)

  return {
    canRun: movable.length > 0,
    reason: movable.length ? undefined : 'No movable revolute, continuous, or prismatic joints found.',
    requirements: ['At least one revolute, continuous, or prismatic joint.'],
    detected: movable.map((joint) => `${joint.name} (${joint.type})`),
  }
}

export function validateDifferentialController(robot: RobotModel): ControllerValidationResult {
  const groups = detectDifferentialWheelGroups(robot)
  const wheelNames = [...groups.left, ...groups.right, ...groups.unassigned]

  if (!wheelNames.length) {
    return {
      canRun: false,
      reason: 'No valid wheel joints found.',
      requirements: ['At least one rotating joint with wheel-like naming.'],
      detected: [],
    }
  }

  if (wheelNames.length > 6) {
    return {
      canRun: false,
      reason:
        'This robot has more than 6 wheel joints. Basic preview is limited; use ROS, Gazebo, Isaac Sim, or a custom controller for advanced drive testing.',
      requirements: ['1 to 6 wheel joints for built-in preview.'],
      detected: wheelNames,
    }
  }

  if (wheelNames.length === 1) {
    return {
      canRun: true,
      reason: 'One wheel detected. Forward/backward wheel preview is available; turning is disabled.',
      requirements: ['One rotating wheel joint for forward/back preview.'],
      detected: wheelNames,
    }
  }

  if (!groups.left.length || !groups.right.length) {
    return {
      canRun: false,
      reason: 'Wheel joints were found, but left/right groups could not be detected confidently.',
      requirements: ['2 to 6 wheel joints with left/right naming for differential preview.'],
      detected: wheelNames,
    }
  }

  return {
    canRun: true,
    requirements: ['2 to 6 wheel joints grouped as left and right.'],
    detected: [`Left: ${groups.left.join(', ')}`, `Right: ${groups.right.join(', ')}`],
  }
}

export function validateController(robot: RobotModel, type: ControllerType): ControllerValidationResult {
  if (type === 'basic-joint') {
    return validateBasicJointController(robot)
  }

  if (type === 'differential-drive') {
    return validateDifferentialController(robot)
  }

  const basic = validateBasicJointController(robot)
  const drive = validateDifferentialController(robot)

  return {
    canRun: basic.canRun || drive.canRun,
    reason:
      basic.canRun || drive.canRun
        ? undefined
        : 'No movable joints or valid differential-drive wheel joints found.',
    requirements: [...basic.requirements, ...drive.requirements],
    detected: [...basic.detected, ...drive.detected],
  }
}

export function driveModeLabel(leftSpeed: number, rightSpeed: number) {
  if (Math.abs(leftSpeed) < 0.001 && Math.abs(rightSpeed) < 0.001) {
    return 'Stopped'
  }

  if (Math.sign(leftSpeed) !== Math.sign(rightSpeed)) {
    return 'Rotate in place'
  }

  if (Math.abs(leftSpeed - rightSpeed) < 0.001) {
    return leftSpeed > 0 ? 'Straight forward' : 'Straight backward'
  }

  return leftSpeed > rightSpeed ? 'Curve right' : 'Curve left'
}
