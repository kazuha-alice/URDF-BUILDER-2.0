import type { MeshGeometryModel } from '../robot-model/types'

export const supportedMeshExtensions = ['.stl', '.dae', '.obj', '.glb', '.gltf']

export function getPathBasename(value: string): string {
  return value.split(/[\\/]/).filter(Boolean).at(-1) ?? value
}

export function getFileStem(value: string): string {
  const basename = getPathBasename(value)
  const dotIndex = basename.lastIndexOf('.')
  return dotIndex > 0 ? basename.slice(0, dotIndex) : basename
}

export function isWindowsAbsolutePath(value: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(value) || value.startsWith('\\\\')
}

export function isSupportedMesh(filename: string): boolean {
  const lowerName = filename.toLowerCase()
  return supportedMeshExtensions.some((extension) => lowerName.endsWith(extension))
}

export function normalizeMeshExportReference(filename: string): string {
  return `./meshes/${getPathBasename(filename)}`
}

export function describeMeshReference(filename: string): string {
  if (filename.startsWith('package://')) {
    return 'ROS package mesh path will be resolved during package export.'
  }

  if (filename.startsWith('file://')) {
    return 'File URL mesh path will be resolved against the local workspace.'
  }

  if (isWindowsAbsolutePath(filename)) {
    return 'Absolute mesh path will be copied and rewritten during package export.'
  }

  if (!isSupportedMesh(filename)) {
    return 'Mesh type is not in the supported import list yet.'
  }

  return 'Mesh path is relative to the URDF file.'
}

export function collectMeshReferences(meshes: Array<MeshGeometryModel | undefined>) {
  return meshes
    .filter((mesh): mesh is MeshGeometryModel => Boolean(mesh?.filename))
    .map((mesh) => mesh.filename)
}
