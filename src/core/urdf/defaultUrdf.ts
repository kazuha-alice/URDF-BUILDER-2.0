import type { RobotModel } from '../robot-model/types'

export const DEFAULT_URDF_FILENAME = 'untitled.urdf'

export const defaultUrdf = `<robot name="untitled_robot">
  <link name="base_link"/>
  <link name="link_1"/>
  <joint name="fixed_joint_1" type="fixed">
    <parent link="base_link"/>
    <child link="link_1"/>
    <origin xyz="0 0 0.1" rpy="0 0 0"/>
  </joint>
</robot>
`

export const defaultRobotModel: RobotModel = {
  name: 'untitled_robot',
  links: [
    {
      name: 'base_link',
      transform: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
    },
    {
      name: 'link_1',
      transform: {
        position: { x: 0, y: 0, z: 0.1 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
    },
  ],
  joints: [
    {
      name: 'fixed_joint_1',
      type: 'fixed',
      parent: 'base_link',
      child: 'link_1',
      origin: {
        xyz: { x: 0, y: 0, z: 0.1 },
        rpy: { x: 0, y: 0, z: 0 },
      },
    },
  ],
  controllers: [],
  sensors: [],
  semantics: {
    robotType: 'custom',
    movableJoints: [],
    wheelJoints: [],
    endEffectors: ['link_1'],
    sensors: [],
  },
  meshWarnings: [],
}
