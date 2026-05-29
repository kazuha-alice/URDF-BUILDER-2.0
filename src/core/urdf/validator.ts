import type { Diagnostic, RobotModel } from '../robot-model/types'

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  values.forEach((value) => {
    if (seen.has(value)) {
      duplicates.add(value)
    }

    seen.add(value)
  })

  return [...duplicates]
}

export function validateRobotModel(model: RobotModel): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const linkNames = model.links.map((link) => link.name).filter(Boolean)
  const jointNames = model.joints.map((joint) => joint.name).filter(Boolean)
  const linkNameSet = new Set(linkNames)

  if (!model.name.trim()) {
    diagnostics.push({
      id: 'robot-name-empty',
      severity: 'error',
      message: 'Robot name is required.',
    })
  }

  if (model.links.length === 0) {
    diagnostics.push({
      id: 'robot-links-empty',
      severity: 'error',
      message: 'URDF must contain at least one link.',
    })
  }

  findDuplicates(linkNames).forEach((name) => {
    diagnostics.push({
      id: `duplicate-link-${name}`,
      severity: 'error',
      message: `Duplicate link name: ${name}.`,
    })
  })

  findDuplicates(jointNames).forEach((name) => {
    diagnostics.push({
      id: `duplicate-joint-${name}`,
      severity: 'error',
      message: `Duplicate joint name: ${name}.`,
    })
  })

  model.joints.forEach((joint) => {
    if (!joint.parent || !linkNameSet.has(joint.parent)) {
      diagnostics.push({
        id: `joint-${joint.name}-missing-parent`,
        severity: 'error',
        message: `Joint "${joint.name}" references missing parent link "${joint.parent}".`,
      })
    }

    if (!joint.child || !linkNameSet.has(joint.child)) {
      diagnostics.push({
        id: `joint-${joint.name}-missing-child`,
        severity: 'error',
        message: `Joint "${joint.name}" references missing child link "${joint.child}".`,
      })
    }

    if (joint.parent && joint.parent === joint.child) {
      diagnostics.push({
        id: `joint-${joint.name}-self-reference`,
        severity: 'error',
        message: `Joint "${joint.name}" cannot connect a link to itself.`,
      })
    }
  })

  model.meshWarnings.forEach((warning, index) => {
    diagnostics.push({
      id: `mesh-warning-${index}`,
      severity: 'warning',
      message: `${warning.linkName} ${warning.role} mesh "${warning.filename}": ${warning.message}`,
    })
  })

  return diagnostics
}
