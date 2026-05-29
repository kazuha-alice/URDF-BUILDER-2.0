import { useEffect, useRef } from 'react'
import { electronBridge, type AppStateUpdatePayload } from '../lib/electron'
import { defaultUrdf, DEFAULT_URDF_FILENAME } from '../core/urdf/defaultUrdf'
import { useProjectStore } from '../store/useProjectStore'

const channelName = 'urdf-builder-project-state'

type BroadcastPayload = Pick<
  ReturnType<typeof useProjectStore.getState>,
  | 'document'
  | 'robot'
  | 'diagnostics'
  | 'buffers'
  | 'lastChangeSource'
  | 'selection'
  | 'initialized'
  | 'sessionReady'
  | 'cameraMode'
  | 'viewPreset'
  | 'projectFiles'
  | 'projectRoot'
>

function getPayload(): BroadcastPayload {
  const state = useProjectStore.getState()

  return {
    document: state.document,
    robot: state.robot,
    diagnostics: state.diagnostics,
    buffers: state.buffers,
    lastChangeSource: state.lastChangeSource,
    selection: state.selection,
    initialized: state.initialized,
    sessionReady: state.sessionReady,
    cameraMode: state.cameraMode,
    viewPreset: state.viewPreset,
    projectFiles: state.projectFiles,
    projectRoot: state.projectRoot,
  }
}

function isDetachedPanelRoute() {
  const hashRoute = window.location.hash.replace(/^#\/?/, '')

  return hashRoute.startsWith('panel/') || new URLSearchParams(window.location.search).has('panel')
}

function isDefaultUntitledPayload(payload: BroadcastPayload) {
  return (
    payload.document.isUntitled &&
    !payload.document.filePath &&
    payload.document.fileName === DEFAULT_URDF_FILENAME &&
    payload.document.xml === defaultUrdf
  )
}

function hasActiveNonDefaultDocument() {
  const document = useProjectStore.getState().document

  return Boolean(
    document.filePath ||
      (!document.isUntitled && document.xml.trim()) ||
      (document.isUntitled && document.xml.trim() && document.xml !== defaultUrdf),
  )
}

export function useProjectBroadcast() {
  const applyingRemote = useRef(false)
  const hasRemoteProjectState = useRef(false)

  useEffect(() => {
    const api = electronBridge()
    const panelWindow = isDetachedPanelRoute()

    if (!('BroadcastChannel' in window) && !api?.onAppStateUpdate) {
      return undefined
    }

    const channel = 'BroadcastChannel' in window ? new BroadcastChannel(channelName) : null
    const applyProjectState = (payload?: BroadcastPayload) => {
      if (!payload) {
        return
      }

      if (isDefaultUntitledPayload(payload) && hasActiveNonDefaultDocument()) {
        console.warn('Blocked stale untitled project-state broadcast while a real document is active.')
        return
      }

      applyingRemote.current = true
      hasRemoteProjectState.current = true
      useProjectStore.setState(payload)
      queueMicrotask(() => {
        applyingRemote.current = false
      })
    }
    const unsubscribe = useProjectStore.subscribe(() => {
      if (applyingRemote.current) {
        return
      }

      if (panelWindow && !hasRemoteProjectState.current) {
        return
      }

      if (!panelWindow && !useProjectStore.getState().sessionReady) {
        return
      }

      const payload = {
        type: 'project-state',
        payload: getPayload(),
      } as AppStateUpdatePayload

      channel?.postMessage(payload)
      api?.broadcastAppState(payload)
    })

    const handleMessage = (data: { type: string; payload?: BroadcastPayload }) => {
      if (data?.type === 'request-project-state') {
        if (panelWindow || !useProjectStore.getState().sessionReady) {
          return
        }

        const payload = {
          type: 'project-state',
          payload: getPayload(),
        } as AppStateUpdatePayload

        channel?.postMessage(payload)
        api?.broadcastAppState(payload)
        return
      }

      if (data?.type !== 'project-state' || !data.payload) {
        return
      }

      applyProjectState(data.payload)
    }

    if (channel) {
      channel.onmessage = (event: MessageEvent<{ type: string; payload?: BroadcastPayload }>) => {
        handleMessage(event.data)
      }
    }

    const removeIpcListener = api?.onAppStateUpdate((payload) => {
      handleMessage(payload as { type: string; payload?: BroadcastPayload })
    })

    if (panelWindow) {
      channel?.postMessage({
        type: 'request-project-state',
      })
      api?.broadcastAppState({
        type: 'request-project-state',
        payload: null,
      } as AppStateUpdatePayload)
    }

    return () => {
      unsubscribe()
      removeIpcListener?.()
      channel?.close()
    }
  }, [])
}
