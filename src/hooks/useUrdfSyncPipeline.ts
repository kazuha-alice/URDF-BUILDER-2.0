import { useEffect, useRef } from 'react'
import { EDITOR_PARSE_DEBOUNCE_MS } from '../core/sync/types'
import { useProjectStore } from '../store/useProjectStore'

export function useUrdfSyncPipeline() {
  const editorDraftXml = useProjectStore((state) => state.buffers.editorDraftXml)
  const lastChangeSource = useProjectStore((state) => state.lastChangeSource)
  const parseEditorDraft = useProjectStore((state) => state.parseEditorDraft)
  const lastScheduledXmlRef = useRef(editorDraftXml)

  useEffect(() => {
    if (lastChangeSource !== 'editor') {
      return undefined
    }

    lastScheduledXmlRef.current = editorDraftXml

    const timeoutId = window.setTimeout(() => {
      const state = useProjectStore.getState()

      if (
        state.lastChangeSource !== 'editor' ||
        state.buffers.editorDraftXml !== lastScheduledXmlRef.current ||
        state.buffers.editorDraftXml === state.buffers.lastValidXml
      ) {
        return
      }

      parseEditorDraft()
    }, EDITOR_PARSE_DEBOUNCE_MS)

    return () => window.clearTimeout(timeoutId)
  }, [editorDraftXml, lastChangeSource, parseEditorDraft])
}
