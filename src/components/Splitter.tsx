import { useRef } from 'react'

interface SplitterProps {
  orientation: 'vertical' | 'horizontal'
  value: number
  onResize: (nextValue: number) => void
  reverse?: boolean
}

export function Splitter({ orientation, value, onResize, reverse = false }: SplitterProps) {
  const startPointerRef = useRef(0)
  const startValueRef = useRef(0)

  return (
    <div
      className={`splitter splitter-${orientation}`}
      role="separator"
      aria-orientation={orientation}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        startPointerRef.current = orientation === 'vertical' ? event.clientX : event.clientY
        startValueRef.current = value
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
          return
        }

        const current = orientation === 'vertical' ? event.clientX : event.clientY
        const delta = current - startPointerRef.current
        onResize(startValueRef.current + (reverse ? -delta : delta))
      }}
      onPointerUp={(event) => {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }}
    />
  )
}
