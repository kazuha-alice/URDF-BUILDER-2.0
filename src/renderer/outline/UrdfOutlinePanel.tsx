import {
  Bot,
  Box,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Cpu,
  GitBranch,
  Package,
  Radio,
  Search,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { PanelHeader } from '../../components/PanelHeader'
import { extractUrdfSymbols, type UrdfSymbol, type UrdfSymbolKind } from '../../core/urdf/symbols'
import { useProjectStore } from '../../store/useProjectStore'

function symbolIcon(kind: UrdfSymbolKind) {
  switch (kind) {
    case 'robot':
      return <Bot size={14} />
    case 'link':
      return <Box size={14} />
    case 'joint':
      return <GitBranch size={14} />
    case 'sensor':
      return <Radio size={14} />
    case 'material':
      return <CircleDot size={14} />
    case 'transmission':
      return <Cpu size={14} />
    case 'plugin':
      return <Package size={14} />
    default:
      return <ChevronRight size={14} />
  }
}

function filterSymbols(symbols: UrdfSymbol[], query: string): UrdfSymbol[] {
  const normalized = query.trim().toLowerCase()

  if (!normalized) {
    return symbols
  }

  return symbols
    .map<UrdfSymbol | null>((symbol) => {
      const children = filterSymbols(symbol.children ?? [], normalized)
      const match =
        symbol.name.toLowerCase().includes(normalized) ||
        symbol.kind.toLowerCase().includes(normalized) ||
        symbol.detail?.toLowerCase().includes(normalized)

      return match || children.length ? { ...symbol, ...(children.length ? { children } : {}) } : null
    })
    .filter((symbol): symbol is UrdfSymbol => Boolean(symbol))
}

function OutlineNode({
  symbol,
  depth,
  collapsed,
  toggle,
  onSelect,
}: {
  symbol: UrdfSymbol
  depth: number
  collapsed: Set<string>
  toggle: (id: string) => void
  onSelect: (symbol: UrdfSymbol) => void
}) {
  const hasChildren = Boolean(symbol.children?.length)
  const expanded = !collapsed.has(symbol.id)

  return (
    <div className="outline-node">
      <button
        type="button"
        className={`tree-row outline-row outline-row-${symbol.kind}`}
        style={{ paddingLeft: `${10 + depth * 14}px` }}
        onClick={() => {
          if (hasChildren) {
            toggle(symbol.id)
          }

          onSelect(symbol)
        }}
      >
        <span className={`hierarchy-chevron ${hasChildren ? '' : 'is-empty'}`}>
          {hasChildren && expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
        <span className="hierarchy-icon">{symbolIcon(symbol.kind)}</span>
        <span className="hierarchy-label">{symbol.name}</span>
        {symbol.detail ? <span className="hierarchy-meta">{symbol.detail}</span> : null}
      </button>
      {hasChildren && expanded ? (
        <div className="outline-children">
          {symbol.children?.map((child) => (
            <OutlineNode
              key={child.id}
              symbol={child}
              depth={depth + 1}
              collapsed={collapsed}
              toggle={toggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function UrdfOutlinePanel() {
  const xml = useProjectStore((state) => state.document.xml)
  const select = useProjectStore((state) => state.select)
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const symbols = useMemo(() => filterSymbols(extractUrdfSymbols(xml), query), [query, xml])

  function toggle(id: string) {
    setCollapsed((current) => {
      const next = new Set(current)

      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }

      return next
    })
  }

  function handleSelect(symbol: UrdfSymbol) {
    if (symbol.selection) {
      select(symbol.selection)
    }

    window.dispatchEvent(
      new CustomEvent('urdf-builder:focus-symbol', {
        detail: { kind: symbol.kind, name: symbol.name },
      }),
    )
  }

  return (
    <aside className="outline-panel">
      <PanelHeader title="Outline" />
      <label className="panel-search">
        <Search size={14} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search symbols..."
        />
      </label>
      <div className="outline-tree">
        {symbols.length ? (
          symbols.map((symbol) => (
            <OutlineNode
              key={symbol.id}
              symbol={symbol}
              depth={0}
              collapsed={collapsed}
              toggle={toggle}
              onSelect={handleSelect}
            />
          ))
        ) : (
          <div className="empty-state">No XML symbols found</div>
        )}
      </div>
    </aside>
  )
}
