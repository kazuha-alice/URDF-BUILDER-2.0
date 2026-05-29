import { useEffect, useRef } from 'react'
import { electronBridge } from '../lib/electron'
import { useWorkspaceStore, type DockPanelId, type PanelState } from '../store/useWorkspaceStore'

function isPanelRegistry(value: unknown): value is Partial<Record<DockPanelId, PanelState>> {
  return Boolean(value && typeof value === 'object')
}

function isDetachedPanelRoute() {
  const hashRoute = window.location.hash.replace(/^#\/?/, '')

  return hashRoute.startsWith('panel/') || new URLSearchParams(window.location.search).has('panel')
}

export function useWorkspaceBroadcast() {
  const applyingRemote = useRef(false)

  useEffect(() => {
    const api = electronBridge()
    const panelWindow = isDetachedPanelRoute()

    if (!api) {
      return undefined
    }

    if (!panelWindow) {
      void api.loadPanelLayout().then((panels) => {
        if (!isPanelRegistry(panels)) {
          return
        }

        applyingRemote.current = true
        useWorkspaceStore.getState().setPanelRegistry(panels)
        queueMicrotask(() => {
          applyingRemote.current = false
        })
      })
    }

    const unsubscribe = useWorkspaceStore.subscribe((state) => {
      if (applyingRemote.current || panelWindow) {
        return
      }

      void api.savePanelLayout(state.panels)
    })

    const removePanelClosedListener = panelWindow ? undefined : api.onPanelWindowClosed((payload) => {
      const panelId = payload.panelId as DockPanelId
      const state = useWorkspaceStore.getState()

      if (!state.panels[panelId]) {
        return
      }

      if (payload.reason === 'docked') {
        state.restorePanel(panelId)
        return
      }

      state.hidePanel(panelId)
    })

    return () => {
      unsubscribe()
      removePanelClosedListener?.()
    }
  }, [])
}
