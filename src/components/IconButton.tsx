import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode
  label: string
  active?: boolean
}

export function IconButton({ icon, label, active = false, className = '', ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      className={`icon-button ${active ? 'is-active' : ''} ${className}`}
      title={label}
      aria-label={label}
      aria-pressed={active}
      {...props}
    >
      {icon}
    </button>
  )
}
