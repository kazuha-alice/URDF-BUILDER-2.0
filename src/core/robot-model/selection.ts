export type MeshRole = 'visual' | 'collision'

const meshSelectionPattern = /^mesh:(.*):(visual|collision)$/

export function meshSelectionId(linkName: string, role: MeshRole) {
  return `mesh:${linkName}:${role}`
}

export function parseMeshSelectionId(id: string): { linkName: string; role: MeshRole } | null {
  const match = meshSelectionPattern.exec(id)

  if (!match) {
    return null
  }

  return {
    linkName: match[1],
    role: match[2] as MeshRole,
  }
}
