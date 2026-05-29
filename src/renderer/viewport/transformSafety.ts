import type { Object3D } from 'three'
import type { TransformData, ViewportTool } from '../../store/useWorkspaceStore'

type TransformTool = Extract<ViewportTool, 'move' | 'rotate' | 'scale'>

function finiteNumber(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback
}

function finiteTuple(
  value: [number, number, number],
  fallback: [number, number, number],
): [number, number, number] {
  return [
    finiteNumber(value[0], fallback[0]),
    finiteNumber(value[1], fallback[1]),
    finiteNumber(value[2], fallback[2]),
  ]
}

export function readSafeObjectTransform(
  object: Object3D,
  fallback?: TransformData,
): TransformData {
  object.quaternion.normalize()

  const safeFallback: TransformData = fallback ?? {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  }

  return {
    position: finiteTuple(
      [object.position.x, object.position.y, object.position.z],
      safeFallback.position,
    ),
    rotation: finiteTuple(
      [object.rotation.x, object.rotation.y, object.rotation.z],
      safeFallback.rotation,
    ),
    scale: finiteTuple([object.scale.x, object.scale.y, object.scale.z], safeFallback.scale),
  }
}

export function isolateTransformForTool(
  tool: TransformTool,
  current: TransformData,
  initial: TransformData,
): TransformData {
  if (tool === 'move') {
    return {
      position: current.position,
      rotation: initial.rotation,
      scale: initial.scale,
    }
  }

  if (tool === 'rotate') {
    return {
      position: initial.position,
      rotation: current.rotation,
      scale: initial.scale,
    }
  }

  return {
    position: initial.position,
    rotation: initial.rotation,
    scale: current.scale,
  }
}

export function applySafeObjectTransform(object: Object3D, transform: TransformData) {
  object.position.set(transform.position[0], transform.position[1], transform.position[2])
  object.rotation.set(transform.rotation[0], transform.rotation[1], transform.rotation[2])
  object.scale.set(transform.scale[0], transform.scale[1], transform.scale[2])
  object.quaternion.normalize()
}
