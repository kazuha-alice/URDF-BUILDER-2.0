import type { KeyboardEvent, MouseEvent } from 'react'

export function logContextMenuMouseEvent(source: string, event: MouseEvent) {
  console.log('[URDF Builder context menu event]', {
    source,
    clientX: event.clientX,
    clientY: event.clientY,
    pageX: event.pageX,
    pageY: event.pageY,
    screenX: event.screenX,
    screenY: event.screenY,
  })
}

export function pointFromKeyboardEvent(event: KeyboardEvent, offset = 12) {
  const element = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  const rect = element?.getBoundingClientRect()

  if (!rect) {
    return {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    }
  }

  return {
    x: rect.left + Math.min(36, rect.width / 2),
    y: rect.top + rect.height / 2 + offset,
  }
}
