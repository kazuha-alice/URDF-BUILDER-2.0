export type JointType =
  | 'fixed'
  | 'revolute'
  | 'continuous'
  | 'prismatic'
  | 'floating'
  | 'planar'

export type SensorType =
  | 'camera'
  | 'lidar'
  | 'depth_camera'
  | 'imu'
  | 'gps'
  | 'contact'
  | 'unknown'

export type SelectionKind = 'robot' | 'link' | 'joint' | 'mesh' | 'sensor'

export interface Vector3Tuple {
  x: number
  y: number
  z: number
}

export interface InertialModel {
  mass?: number
  origin?: PoseModel
  inertia?: {
    ixx?: number
    ixy?: number
    ixz?: number
    iyy?: number
    iyz?: number
    izz?: number
  }
}

export interface PoseModel {
  xyz: Vector3Tuple
  rpy: Vector3Tuple
}

export interface TransformModel {
  position: Vector3Tuple
  rotation: Vector3Tuple
  scale: Vector3Tuple
}

export interface MeshGeometryModel {
  filename: string
  resolvedPath?: string
  missing?: boolean
  scale?: Vector3Tuple
}

export interface LinkGeometryModel {
  mesh?: MeshGeometryModel
}

export interface LinkVisualModel {
  name?: string
  origin?: PoseModel
  geometry?: LinkGeometryModel
}

export interface LinkCollisionModel {
  name?: string
  origin?: PoseModel
  geometry?: LinkGeometryModel
}

export interface RobotLinkModel {
  name: string
  transform?: TransformModel
  visual?: LinkVisualModel
  collision?: LinkCollisionModel
  inertial?: InertialModel
}

export interface JointLimitModel {
  lower?: number
  upper?: number
  effort?: number
  velocity?: number
}

export interface JointDynamicsModel {
  damping?: number
  friction?: number
}

export interface JointMimicModel {
  joint: string
  multiplier?: number
  offset?: number
}

export interface RobotJointModel {
  name: string
  type: JointType
  parent: string
  child: string
  origin: PoseModel
  axis?: Vector3Tuple
  limit?: JointLimitModel
  dynamics?: JointDynamicsModel
  mimic?: JointMimicModel
}

export interface RobotSensorModel {
  name: string
  type: SensorType
  attachedTo: string
  origin?: PoseModel
}

export interface MeshWarning {
  linkName: string
  role: 'visual' | 'collision'
  filename: string
  message: string
}

export type RobotType =
  | 'robot_arm'
  | 'differential_drive'
  | 'humanoid'
  | 'quadruped'
  | 'custom'

export interface RobotSemanticAnalysis {
  robotType: RobotType
  movableJoints: string[]
  wheelJoints: string[]
  endEffectors: string[]
  sensors: string[]
}

export interface JointControllerModel {
  type: 'joint_group'
  id: string
  name: string
  jointNames: string[]
  homePose: Record<string, number>
  generated: boolean
}

export interface DifferentialDriveControllerModel {
  type: 'differential_drive'
  id: string
  name: string
  leftWheelJoints: string[]
  rightWheelJoints: string[]
  linearVelocity: number
  angularVelocity: number
  generated: boolean
}

export type RobotControllerModel = JointControllerModel | DifferentialDriveControllerModel

export interface RobotModel {
  name: string
  rootTransform?: TransformModel
  links: RobotLinkModel[]
  joints: RobotJointModel[]
  controllers: RobotControllerModel[]
  sensors: RobotSensorModel[]
  semantics: RobotSemanticAnalysis
  meshWarnings: MeshWarning[]
}

export interface Diagnostic {
  id: string
  severity: 'error' | 'warning' | 'info'
  message: string
  line?: number
  column?: number
}

export interface SelectionRef {
  kind: SelectionKind
  id: string
}

export const emptyPose = (): PoseModel => ({
  xyz: { x: 0, y: 0, z: 0 },
  rpy: { x: 0, y: 0, z: 0 },
})

export const identityTransform = (): TransformModel => ({
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
})
