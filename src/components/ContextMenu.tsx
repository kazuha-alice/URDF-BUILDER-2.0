import { createPortal } from 'react-dom'
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

export interface ContextMenuItem {
  id: string
  label: string
  icon?: ReactNode
  disabled?: boolean
  shortcut?: string
  onSelect: () => void
}

interface ContextMenuProps {
  x: number
  y: number
  debugSource?: string
  title?: string
  items: ContextMenuItem[]
  onClose: () => void
}

const viewportPadding = 8

function clampMenuPosition(x: number, y: number, width: number, height: number) {
  const maxX = Math.max(viewportPadding, window.innerWidth - width - viewportPadding)
  const maxY = Math.max(viewportPadding, window.innerHeight - height - viewportPadding)

  return {
    x: Math.min(Math.max(viewportPadding, x), maxX),
    y: Math.min(Math.max(viewportPadding, y), maxY),
  }
}

export function ContextMenu({ x, y, debugSource = 'context-menu', title, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const origin = useMemo(() => ({ x, y }), [x, y])
  const [position, setPosition] = useState(() => clampMenuPosition(x, y, 260, 320))

  useLayoutEffect(() => {
    function updatePosition() {
      const menu = menuRef.current
      const rect = menu?.getBoundingClientRect()
      const nextPosition = clampMenuPosition(origin.x, origin.y, rect?.width ?? 260, rect?.height ?? 320)

      setPosition(nextPosition)

      console.log('[URDF Builder context menu]', {
        source: debugSource,
        clientX: origin.x,
        clientY: origin.y,
        pageX: origin.x + window.scrollX,
        pageY: origin.y + window.scrollY,
        finalX: nextPosition.x,
        finalY: nextPosition.y,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        menuWidth: rect?.width,
        menuHeight: rect?.height,
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    return () => window.removeEventListener('resize', updatePosition)
  }, [debugSource, origin])

  useEffect(() => {
    menuRef.current?.focus()
  }, [])

  return createPortal(
    <>
      <button type="button" className="context-menu-scrim" aria-label="Close context menu" onClick={onClose} />
      <span
        className="context-menu-origin-marker"
        style={{ left: origin.x, top: origin.y }}
        aria-hidden="true"
      />
      <div
        ref={menuRef}
        className="context-menu"
        style={{ left: position.x, top: position.y }}
        role="menu"
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            onClose()
          }
        }}
      >
        {title ? <div className="context-menu-title">{title}</div> : null}
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="context-menu-item"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              if (!item.disabled) {
                item.onSelect()
                onClose()
              }
            }}
          >
            {item.icon ? <span className="context-menu-icon">{item.icon}</span> : null}
            <span>{item.label}</span>
            {item.shortcut ? <kbd>{item.shortcut}</kbd> : null}
          </button>
        ))}
      </div>
    </>,
    document.body,
  )
}
