import { XMLParser } from 'fast-xml-parser'
import type { SelectionRef } from '../robot-model/types'

export type UrdfSymbolKind =
  | 'robot'
  | 'group'
  | 'link'
  | 'joint'
  | 'sensor'
  | 'material'
  | 'transmission'
  | 'plugin'

export interface UrdfSymbol {
  id: string
  kind: UrdfSymbolKind
  name: string
  detail?: string
  selection?: SelectionRef
  children?: UrdfSymbol[]
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  allowBooleanAttributes: true,
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: false,
  isArray: (_tagName, jPath) => {
    const path = String(jPath)
    return (
      ['robot.link', 'robot.joint', 'robot.material', 'robot.transmission', 'robot.gazebo'].includes(path) ||
      path.endsWith('.plugin') ||
      path.endsWith('.sensor')
    )
  },
})

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return []
  }

  return Array.isArray(value) ? value : [value]
}

function named(value: unknown, fallback: string) {
  if (value && typeof value === 'object' && 'name' in value) {
    const candidate = (value as { name?: unknown }).name

    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate
    }
  }

  return fallback
}

export function extractUrdfSymbols(xml: string): UrdfSymbol[] {
  try {
    const parsed = parser.parse(xml) as {
      robot?: {
        name?: string
        link?: Array<{ name?: string }>
        joint?: Array<{ name?: string; type?: string; parent?: { link?: string }; child?: { link?: string } }>
        material?: Array<{ name?: string }>
        transmission?: Array<{ name?: string }>
        gazebo?: Array<{
          reference?: string
          plugin?: Array<{ name?: string; filename?: string }>
          sensor?: Array<{ name?: string; type?: string }>
        }>
      }
    }
    const robot = parsed.robot

    if (!robot) {
      return []
    }

    const robotName = robot.name || 'robot'
    const links = asArray(robot.link).map((link, index): UrdfSymbol => {
      const name = named(link, `link_${index + 1}`)
      return {
        id: `link:${name}`,
        kind: 'link',
        name,
        selection: { kind: 'link', id: name },
      }
    })
    const joints = asArray(robot.joint).map((joint, index): UrdfSymbol => {
      const name = named(joint, `joint_${index + 1}`)
      return {
        id: `joint:${name}`,
        kind: 'joint',
        name,
        detail: joint.type,
        selection: { kind: 'joint', id: name },
      }
    })
    const materials = asArray(robot.material).map((material, index): UrdfSymbol => {
      const name = named(material, `material_${index + 1}`)
      return {
        id: `material:${name}`,
        kind: 'material',
        name,
      }
    })
    const transmissions = asArray(robot.transmission).map((transmission, index): UrdfSymbol => {
      const name = named(transmission, `transmission_${index + 1}`)
      return {
        id: `transmission:${name}`,
        kind: 'transmission',
        name,
      }
    })
    const sensors: UrdfSymbol[] = []
    const plugins: UrdfSymbol[] = []

    asArray(robot.gazebo).forEach((gazebo, gazeboIndex) => {
      const reference = gazebo.reference ? `${gazebo.reference} ` : ''

      asArray(gazebo.sensor).forEach((sensor, index) => {
        const name = named(sensor, `sensor_${gazeboIndex + 1}_${index + 1}`)
        sensors.push({
          id: `sensor:${name}`,
          kind: 'sensor',
          name,
          detail: `${reference}${sensor.type ?? ''}`.trim(),
          selection: { kind: 'sensor', id: name },
        })
      })

      asArray(gazebo.plugin).forEach((plugin, index) => {
        const name = named(plugin, `plugin_${gazeboIndex + 1}_${index + 1}`)
        plugins.push({
          id: `plugin:${name}`,
          kind: 'plugin',
          name,
          detail: plugin.filename,
        })
      })
    })

    return [
      {
        id: `robot:${robotName}`,
        kind: 'robot',
        name: robotName,
        selection: { kind: 'robot', id: robotName },
        children: [
          { id: 'group:links', kind: 'group', name: 'Links', detail: String(links.length), children: links },
          { id: 'group:joints', kind: 'group', name: 'Joints', detail: String(joints.length), children: joints },
          { id: 'group:sensors', kind: 'group', name: 'Sensors', detail: String(sensors.length), children: sensors },
          { id: 'group:materials', kind: 'group', name: 'Materials', detail: String(materials.length), children: materials },
          {
            id: 'group:transmissions',
            kind: 'group',
            name: 'Transmissions',
            detail: String(transmissions.length),
            children: transmissions,
          },
          { id: 'group:plugins', kind: 'group', name: 'Gazebo Plugins', detail: String(plugins.length), children: plugins },
        ],
      },
    ]
  } catch {
    return []
  }
}
