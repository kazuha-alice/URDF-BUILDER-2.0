import { TransformControls, type TransformControlsProps } from '@react-three/drei'
import { useEffect } from 'react'

let activeTransformControlsCount = 0

export function SingleTransformControls(props: TransformControlsProps) {
  useEffect(() => {
    activeTransformControlsCount += 1

    if (activeTransformControlsCount > 1) {
      const message = 'Multiple TransformControls detected'

      if (import.meta.env.DEV) {
        throw new Error(message)
      }

      console.error(message)
    }

    return () => {
      activeTransformControlsCount = Math.max(0, activeTransformControlsCount - 1)
    }
  }, [])

  return <TransformControls {...props} />
}
