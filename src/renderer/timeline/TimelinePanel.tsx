import {
  Clock3,
  FileCheck2,
  GitCommitHorizontal,
  History,
  Import,
  Pencil,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { PanelHeader } from '../../components/PanelHeader'
import { useHistoryStore, type TimelineEntry, type TimelineEntryType } from '../../store/useHistoryStore'

function timelineIcon(type: TimelineEntryType) {
  switch (type) {
    case 'save':
      return <FileCheck2 size={14} />
    case 'transform':
      return <GitCommitHorizontal size={14} />
    case 'import':
      return <Import size={14} />
    case 'delete':
      return <Trash2 size={14} />
    case 'history':
      return <RotateCcw size={14} />
    default:
      return <Pencil size={14} />
  }
}

function timeLabel(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)
}

function dayLabel(timestamp: number) {
  const date = new Date(timestamp)
  const today = new Date()

  if (date.toDateString() === today.toDateString()) {
    return 'Today'
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  }).format(date)
}

function groupEntries(entries: TimelineEntry[]) {
  return entries.reduce<Record<string, TimelineEntry[]>>((groups, entry) => {
    const key = dayLabel(entry.timestamp)
    groups[key] ??= []
    groups[key].push(entry)
    return groups
  }, {})
}

export function TimelinePanel() {
  const timeline = useHistoryStore((state) => state.timeline)
  const undoCount = useHistoryStore((state) => state.undoStack.length)
  const redoCount = useHistoryStore((state) => state.redoStack.length)
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()

    if (!normalized) {
      return timeline
    }

    return timeline.filter(
      (entry) =>
        entry.title.toLowerCase().includes(normalized) ||
        entry.type.toLowerCase().includes(normalized) ||
        entry.filePath?.toLowerCase().includes(normalized) ||
        entry.entityId?.toLowerCase().includes(normalized),
    )
  }, [query, timeline])
  const groups = useMemo(() => groupEntries(filtered), [filtered])

  return (
    <aside className="timeline-panel">
      <PanelHeader title="Timeline" />
      <div className="timeline-summary">
        <span>
          <History size={13} /> {undoCount} undo
        </span>
        <span>{redoCount} redo</span>
      </div>
      <label className="panel-search">
        <Search size={14} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter timeline..."
        />
      </label>
      <div className="timeline-list">
        {Object.entries(groups).length ? (
          Object.entries(groups).map(([day, entries]) => (
            <section key={day} className="timeline-day">
              <h3>{day}</h3>
              {entries.map((entry) => (
                <button key={entry.id} type="button" className={`timeline-entry timeline-entry-${entry.type}`}>
                  <span className="timeline-entry-icon">{timelineIcon(entry.type)}</span>
                  <span className="timeline-entry-copy">
                    <strong>{entry.title}</strong>
                    <small>
                      <Clock3 size={12} />
                      {timeLabel(entry.timestamp)}
                      {entry.filePath ? ` · ${entry.filePath}` : ''}
                    </small>
                  </span>
                </button>
              ))}
            </section>
          ))
        ) : (
          <div className="empty-state">No timeline events yet</div>
        )}
      </div>
    </aside>
  )
}
