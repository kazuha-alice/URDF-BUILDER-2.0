import { AlertTriangle, Box, GitBranch, Radio } from 'lucide-react'
import { Field, SelectInput, TextInput } from '../../components/Field'
import { PanelHeader } from '../../components/PanelHeader'
import { parseMeshSelectionId } from '../../core/robot-model/selection'
import type { JointType, PoseModel, RobotJointModel, Vector3Tuple } from '../../core/robot-model/types'
import { identityTransform } from '../../core/robot-model/types'
import { useProjectStore } from '../../store/useProjectStore'

const jointTypes: JointType[] = [
  'fixed',
  'revolute',
  'continuous',
  'prismatic',
  'floating',
  'planar',
]

function numberValue(value: string, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function VectorEditor({
  label,
  value,
  onChange,
}: {
  label: string
  value: Vector3Tuple
  onChange: (value: Vector3Tuple) => void
}) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="vector-row">
        {(['x', 'y', 'z'] as const).map((axis) => (
          <TextInput
            key={axis}
            type="number"
            step="0.01"
            value={value[axis]}
            aria-label={`${label} ${axis}`}
            onChange={(event) =>
              onChange({
                ...value,
                [axis]: numberValue(event.target.value, value[axis]),
              })
            }
          />
        ))}
      </div>
    </div>
  )
}

function updatePoseVector(pose: PoseModel, key: 'xyz' | 'rpy', value: Vector3Tuple): PoseModel {
  return {
    ...pose,
    [key]: value,
  }
}

function LinkInspector({ linkName }: { linkName: string }) {
  const link = useProjectStore((state) => state.robot.links.find((item) => item.name === linkName))
  const renameLink = useProjectStore((state) => state.renameLink)
  const updateLinkMesh = useProjectStore((state) => state.updateLinkMesh)
  const updateLinkTransform = useProjectStore((state) => state.updateLinkTransform)

  if (!link) {
    return <div className="empty-state">Link not found</div>
  }

  const transform = link.transform ?? identityTransform()

  return (
    <div className="inspector-fields">
      <div className="inspector-kind">
        <Box size={15} />
        Link
      </div>
      <Field label="Name">
        <TextInput value={link.name} onChange={(event) => renameLink(link.name, event.target.value)} />
      </Field>
      <Field label="Visual Mesh">
        <TextInput
          placeholder="./meshes/base.stl"
          value={link.visual?.geometry?.mesh?.filename ?? ''}
          onChange={(event) => updateLinkMesh(link.name, 'visual', event.target.value)}
        />
      </Field>
      <Field label="Collision Mesh">
        <TextInput
          placeholder="./meshes/base_collision.stl"
          value={link.collision?.geometry?.mesh?.filename ?? ''}
          onChange={(event) => updateLinkMesh(link.name, 'collision', event.target.value)}
        />
      </Field>
      <Field label="Mass">
        <TextInput type="number" disabled value={link.inertial?.mass ?? ''} placeholder="later" />
      </Field>
      <VectorEditor
        label="Position XYZ"
        value={transform.position}
        onChange={(value) => updateLinkTransform(link.name, { ...transform, position: value })}
      />
      <VectorEditor
        label="Rotation RPY"
        value={transform.rotation}
        onChange={(value) => updateLinkTransform(link.name, { ...transform, rotation: value })}
      />
      <VectorEditor
        label="Scale XYZ"
        value={transform.scale}
        onChange={(value) => updateLinkTransform(link.name, { ...transform, scale: value })}
      />
    </div>
  )
}

function MeshInspector({ meshId }: { meshId: string }) {
  const meshRef = parseMeshSelectionId(meshId)
  const link = useProjectStore((state) =>
    meshRef ? state.robot.links.find((item) => item.name === meshRef.linkName) : undefined,
  )
  const updateLinkGeometryTransform = useProjectStore((state) => state.updateLinkGeometryTransform)

  if (!meshRef || !link) {
    return <div className="empty-state">Mesh not found</div>
  }

  const geometry = meshRef.role === 'visual' ? link.visual : link.collision
  const mesh = geometry?.geometry?.mesh

  if (!mesh) {
    return <div className="empty-state">Mesh not found</div>
  }

  const transform = {
    position: geometry?.origin?.xyz ?? { x: 0, y: 0, z: 0 },
    rotation: geometry?.origin?.rpy ?? { x: 0, y: 0, z: 0 },
    scale: mesh.scale ?? { x: 1, y: 1, z: 1 },
  }

  return (
    <div className="inspector-fields">
      <div className="inspector-kind">
        <Box size={15} />
        {meshRef.role} mesh
      </div>
      <Field label="Parent Link">
        <TextInput value={meshRef.linkName} disabled />
      </Field>
      <Field label="Mesh File">
        <TextInput value={mesh.filename} disabled />
      </Field>
      <VectorEditor
        label="Origin XYZ"
        value={transform.position}
        onChange={(value) =>
          updateLinkGeometryTransform(meshRef.linkName, meshRef.role, {
            ...transform,
            position: value,
          })
        }
      />
      <VectorEditor
        label="Origin RPY"
        value={transform.rotation}
        onChange={(value) =>
          updateLinkGeometryTransform(meshRef.linkName, meshRef.role, {
            ...transform,
            rotation: value,
          })
        }
      />
      <VectorEditor
        label="Scale XYZ"
        value={transform.scale}
        onChange={(value) =>
          updateLinkGeometryTransform(meshRef.linkName, meshRef.role, {
            ...transform,
            scale: value,
          })
        }
      />
    </div>
  )
}

function JointInspector({ jointName }: { jointName: string }) {
  const joint = useProjectStore((state) => state.robot.joints.find((item) => item.name === jointName))
  const links = useProjectStore((state) => state.robot.links)
  const updateJoint = useProjectStore((state) => state.updateJoint)

  if (!joint) {
    return <div className="empty-state">Joint not found</div>
  }

  const patchJoint = (patch: Partial<RobotJointModel>) => updateJoint(joint.name, patch)

  return (
    <div className="inspector-fields">
      <div className="inspector-kind">
        <GitBranch size={15} />
        Joint
      </div>
      <Field label="Name">
        <TextInput value={joint.name} onChange={(event) => patchJoint({ name: event.target.value })} />
      </Field>
      <Field label="Type">
        <SelectInput
          value={joint.type}
          onChange={(event) => patchJoint({ type: event.target.value as JointType })}
        >
          {jointTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </SelectInput>
      </Field>
      <Field label="Parent Link">
        <SelectInput value={joint.parent} onChange={(event) => patchJoint({ parent: event.target.value })}>
          {links.map((link) => (
            <option key={link.name} value={link.name}>
              {link.name}
            </option>
          ))}
        </SelectInput>
      </Field>
      <Field label="Child Link">
        <SelectInput value={joint.child} onChange={(event) => patchJoint({ child: event.target.value })}>
          {links.map((link) => (
            <option key={link.name} value={link.name}>
              {link.name}
            </option>
          ))}
        </SelectInput>
      </Field>
      <VectorEditor
        label="Origin XYZ"
        value={joint.origin.xyz}
        onChange={(value) => patchJoint({ origin: updatePoseVector(joint.origin, 'xyz', value) })}
      />
      <VectorEditor
        label="Origin RPY"
        value={joint.origin.rpy}
        onChange={(value) => patchJoint({ origin: updatePoseVector(joint.origin, 'rpy', value) })}
      />
      <VectorEditor
        label="Axis XYZ"
        value={joint.axis ?? { x: 1, y: 0, z: 0 }}
        onChange={(value) => patchJoint({ axis: value })}
      />
    </div>
  )
}

export function InspectorPanel() {
  const selection = useProjectStore((state) => state.selection)
  const robot = useProjectStore((state) => state.robot)
  const diagnostics = useProjectStore((state) => state.diagnostics)
  const renameRobot = useProjectStore((state) => state.renameRobot)
  const selectedSensor = robot.sensors.find((sensor) => sensor.name === selection.id)

  return (
    <aside className="inspector-panel">
      <PanelHeader title="Inspector" />

      <div className="inspector-body">
        {selection.kind === 'robot' ? (
          <div className="inspector-fields">
            <div className="inspector-kind">
              <Box size={15} />
              Robot
            </div>
            <Field label="Name">
              <TextInput value={robot.name} onChange={(event) => renameRobot(event.target.value)} />
            </Field>
            <Field label="Links">
              <TextInput value={robot.links.length} disabled />
            </Field>
            <Field label="Joints">
              <TextInput value={robot.joints.length} disabled />
            </Field>
          </div>
        ) : null}

        {selection.kind === 'link' ? <LinkInspector linkName={selection.id} /> : null}
        {selection.kind === 'mesh' ? <MeshInspector meshId={selection.id} /> : null}
        {selection.kind === 'joint' ? <JointInspector jointName={selection.id} /> : null}
        {selection.kind === 'sensor' && selectedSensor ? (
          <div className="inspector-fields">
            <div className="inspector-kind">
              <Radio size={15} />
              Sensor
            </div>
            <Field label="Name">
              <TextInput value={selectedSensor.name} disabled />
            </Field>
            <Field label="Type">
              <TextInput value={selectedSensor.type} disabled />
            </Field>
            <Field label="Attached Link">
              <TextInput value={selectedSensor.attachedTo} disabled />
            </Field>
          </div>
        ) : null}

        <div className="diagnostics-block">
          <div className="diagnostics-title">
            <AlertTriangle size={14} />
            Diagnostics
          </div>
          {diagnostics.length ? (
            diagnostics.map((diagnostic) => (
              <div key={diagnostic.id} className={`diagnostic-row ${diagnostic.severity}`}>
                {diagnostic.message}
              </div>
            ))
          ) : (
            <div className="empty-state">No validation issues</div>
          )}
        </div>
      </div>
    </aside>
  )
}
