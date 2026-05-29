import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type EditorSplitMode = 'single' | 'right' | 'down'

export interface EditorTab {
  id: string
  filePath: string | null
  fileName: string
  content: string
  language: string
  isDirty: boolean
  isDocumentTab: boolean
  openedAt: number
}

interface EditorStore {
  tabs: EditorTab[]
  activeTabId: string | null
  splitMode: EditorSplitMode
  minimapEnabled: boolean
  openTab: (tab: Omit<EditorTab, 'id' | 'openedAt'> & Partial<Pick<EditorTab, 'id' | 'openedAt'>>) => void
  syncDocumentTab: (tab: EditorTab) => void
  updateTabContent: (tabId: string, content: string, dirty?: boolean) => void
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  setSplitMode: (mode: EditorSplitMode) => void
  toggleMinimap: () => void
  clearTabs: () => void
}

function tabId(filePath: string | null, fileName: string) {
  return filePath || `untitled:${fileName}`
}

export function languageForFile(fileName: string) {
  const extension = fileName.toLowerCase().split('.').pop()

  switch (extension) {
    case 'urdf':
    case 'xacro':
    case 'xml':
    case 'launch':
      return 'xml'
    case 'yaml':
    case 'yml':
      return 'yaml'
    case 'json':
      return 'json'
    case 'py':
      return 'python'
    case 'md':
      return 'markdown'
    case 'toml':
      return 'toml'
    default:
      return 'plaintext'
  }
}

export const useEditorStore = create<EditorStore>()(
  persist(
    (set) => ({
      tabs: [],
      activeTabId: null,
      splitMode: 'single',
      minimapEnabled: true,

      openTab: (tab) =>
        set((state) => {
          const id = tab.id ?? tabId(tab.filePath, tab.fileName)
          const nextTab: EditorTab = {
            ...tab,
            id,
            openedAt: tab.openedAt ?? Date.now(),
          }
          const existingIndex = state.tabs.findIndex((item) => item.id === id)
          const tabs =
            existingIndex >= 0
              ? state.tabs.map((item, index) => (index === existingIndex ? { ...item, ...nextTab } : item))
              : [...state.tabs, nextTab]

          return {
            tabs,
            activeTabId: id,
          }
        }),

      syncDocumentTab: (tab) =>
        set((state) => {
          const existingIndex = state.tabs.findIndex((item) => item.id === tab.id)
          const tabs =
            existingIndex >= 0
              ? state.tabs.map((item, index) =>
                  index === existingIndex ? { ...item, ...tab, openedAt: item.openedAt } : item,
                )
              : [tab, ...state.tabs]

          return {
            tabs,
            activeTabId: state.activeTabId ?? tab.id,
          }
        }),

      updateTabContent: (tabIdValue, content, dirty = true) =>
        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === tabIdValue ? { ...tab, content, isDirty: dirty } : tab,
          ),
        })),

      closeTab: (tabIdValue) =>
        set((state) => {
          const tabs = state.tabs.filter((tab) => tab.id !== tabIdValue)
          const closedActive = state.activeTabId === tabIdValue

          return {
            tabs,
            activeTabId: closedActive ? tabs.at(-1)?.id ?? null : state.activeTabId,
          }
        }),

      setActiveTab: (activeTabId) => set({ activeTabId }),
      setSplitMode: (splitMode) => set({ splitMode }),
      toggleMinimap: () => set((state) => ({ minimapEnabled: !state.minimapEnabled })),
      clearTabs: () => set({ tabs: [], activeTabId: null, splitMode: 'single' }),
    }),
    {
      name: 'urdf-builder-editor-workspace',
      partialize: (state) => ({
        tabs: state.tabs.slice(-12),
        activeTabId: state.activeTabId,
        splitMode: state.splitMode,
        minimapEnabled: state.minimapEnabled,
      }),
      merge: (persisted, current) => {
        const value = persisted as Partial<EditorStore> | undefined
        return {
          ...current,
          tabs: Array.isArray(value?.tabs) ? value.tabs : current.tabs,
          activeTabId: value?.activeTabId ?? current.activeTabId,
          splitMode: value?.splitMode ?? current.splitMode,
          minimapEnabled: value?.minimapEnabled ?? current.minimapEnabled,
        }
      },
    },
  ),
)

export const editorTabId = tabId
