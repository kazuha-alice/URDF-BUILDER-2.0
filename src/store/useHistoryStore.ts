import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type HistorySource = 'viewport' | 'inspector' | 'editor' | 'hierarchy' | 'system'
export type TimelineEntryType = 'save' | 'edit' | 'transform' | 'import' | 'rename' | 'delete' | 'history'

export type HistoryEntry = {
  id: string
  label: string
  source: HistorySource
  timestamp: number
  undo: () => void
  redo: () => void
}

export type TimelineEntry = {
  id: string
  type: TimelineEntryType
  title: string
  timestamp: number
  filePath?: string
  entityId?: string
}

interface HistoryState {
  undoStack: HistoryEntry[]
  redoStack: HistoryEntry[]
  timeline: TimelineEntry[]
  isApplying: boolean
  push: (entry: HistoryEntry) => void
  undo: () => void
  redo: () => void
  clearRedo: () => void
  clear: () => void
  addTimelineEntry: (entry: Omit<TimelineEntry, 'id' | 'timestamp'> & Partial<Pick<TimelineEntry, 'id' | 'timestamp'>>) => void
}

const MAX_HISTORY_ENTRIES = 100
const MAX_TIMELINE_ENTRIES = 500

function createHistoryId() {
  return `history-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function timelineTypeForHistory(entry: HistoryEntry): TimelineEntryType {
  if (entry.label.toLowerCase().includes('delete')) {
    return 'delete'
  }

  if (entry.label.toLowerCase().includes('rename')) {
    return 'rename'
  }

  if (entry.source === 'viewport') {
    return 'transform'
  }

  return 'edit'
}

export function createHistoryEntry(
  entry: Omit<HistoryEntry, 'id' | 'timestamp'> & Partial<Pick<HistoryEntry, 'id' | 'timestamp'>>,
): HistoryEntry {
  return {
    id: entry.id ?? createHistoryId(),
    timestamp: entry.timestamp ?? Date.now(),
    label: entry.label,
    source: entry.source,
    undo: entry.undo,
    redo: entry.redo,
  }
}

export const useHistoryStore = create<HistoryState>()(
  persist((set, get) => ({
  undoStack: [],
  redoStack: [],
  timeline: [],
  isApplying: false,

  push: (entry) => {
    if (get().isApplying) {
      return
    }

    set((state) => ({
      undoStack: [...state.undoStack, entry].slice(-MAX_HISTORY_ENTRIES),
      redoStack: [],
      timeline: [
        {
          id: `timeline-${entry.id}`,
          type: timelineTypeForHistory(entry),
          title: entry.label,
          timestamp: entry.timestamp,
        },
        ...state.timeline,
      ].slice(0, MAX_TIMELINE_ENTRIES),
    }))
  },

  undo: () => {
    const entry = get().undoStack.at(-1)

    if (!entry) {
      return
    }

    set({ isApplying: true })

    try {
      entry.undo()
      set((state) => ({
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, entry].slice(-MAX_HISTORY_ENTRIES),
        timeline: [
          {
            id: createHistoryId(),
            type: 'history' as const,
            title: `Undo ${entry.label}`,
            timestamp: Date.now(),
          },
          ...state.timeline,
        ].slice(0, MAX_TIMELINE_ENTRIES),
        isApplying: false,
      }))
    } catch (error) {
      console.error('Undo failed', error)
      set({ isApplying: false })
    }
  },

  redo: () => {
    const entry = get().redoStack.at(-1)

    if (!entry) {
      return
    }

    set({ isApplying: true })

    try {
      entry.redo()
      set((state) => ({
        undoStack: [...state.undoStack, entry].slice(-MAX_HISTORY_ENTRIES),
        redoStack: state.redoStack.slice(0, -1),
        timeline: [
          {
            id: createHistoryId(),
            type: 'history' as const,
            title: `Redo ${entry.label}`,
            timestamp: Date.now(),
          },
          ...state.timeline,
        ].slice(0, MAX_TIMELINE_ENTRIES),
        isApplying: false,
      }))
    } catch (error) {
      console.error('Redo failed', error)
      set({ isApplying: false })
    }
  },

  clearRedo: () => set({ redoStack: [] }),
  clear: () => set({ undoStack: [], redoStack: [], isApplying: false }),
  addTimelineEntry: (entry) =>
    set((state) => ({
      timeline: [
        {
          id: entry.id ?? createHistoryId(),
          type: entry.type,
          title: entry.title,
          timestamp: entry.timestamp ?? Date.now(),
          filePath: entry.filePath,
          entityId: entry.entityId,
        },
        ...state.timeline,
      ].slice(0, MAX_TIMELINE_ENTRIES),
    })),
}), {
    name: 'urdf-builder-timeline',
    partialize: (state) => ({ timeline: state.timeline }),
  }),
)
