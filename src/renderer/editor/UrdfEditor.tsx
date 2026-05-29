import Editor, { type BeforeMount, type OnMount } from '@monaco-editor/react'
import type * as Monaco from 'monaco-editor'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PanelHeader } from '../../components/PanelHeader'
import { IconButton } from '../../components/IconButton'
import {
  Code2,
  ExternalLink,
  GitCompareArrows,
  ListTree,
  Map,
  Redo2,
  Undo2,
  X,
} from 'lucide-react'
import { useTheme } from '../../theme/theme'
import {
  editorTabId,
  languageForFile,
  useEditorStore,
  type EditorTab,
} from '../../store/useEditorStore'
import { useProjectStore } from '../../store/useProjectStore'
import type { useFileCommands } from '../../hooks/useFileCommands'

type FileCommands = ReturnType<typeof useFileCommands>

interface UrdfEditorProps {
  commands: FileCommands
}

let xmlLanguageRegistered = false

function registerUrdfLanguage(monaco: typeof Monaco) {
  if (xmlLanguageRegistered) {
    return
  }

  xmlLanguageRegistered = true
  monaco.languages.registerCompletionItemProvider('xml', {
    triggerCharacters: ['<', ' ', '"'],
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position)
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      }

      return {
        suggestions: [
          'robot',
          'link',
          'joint',
          'visual',
          'collision',
          'origin',
          'geometry',
          'mesh',
          'inertial',
          'axis',
          'limit',
          'dynamics',
          'mimic',
          'material',
          'gazebo',
          'sensor',
          'plugin',
          'transmission',
        ].map((label) => ({
          label,
          kind: monaco.languages.CompletionItemKind.Property,
          insertText: label,
          range,
        })).concat(
          ['fixed', 'revolute', 'continuous', 'prismatic', 'floating', 'planar'].map((label) => ({
            label,
            kind: monaco.languages.CompletionItemKind.EnumMember,
            insertText: label,
            detail: 'URDF joint type',
            range,
          })),
        ),
      }
    },
  })

  monaco.languages.registerHoverProvider('xml', {
    provideHover: (_model, position) => {
      const word = _model.getWordAtPosition(position)?.word

      if (!word) {
        return null
      }

      const docs: Record<string, string> = {
        robot: 'URDF root element. Contains links, joints, materials, and extensions.',
        link: 'Rigid body frame in the robot model.',
        joint: 'Relationship between parent and child links.',
        origin: 'Pose field using xyz and rpy attributes.',
        mesh: 'External visual or collision geometry file reference.',
        axis: 'Joint motion axis in the joint frame.',
      }

      return docs[word]
        ? {
            contents: [{ value: `**${word}**` }, { value: docs[word] }],
          }
        : null
    },
  })
}

function tabForDocument(fileName: string, filePath: string | null, xml: string): EditorTab {
  return {
    id: editorTabId(filePath, fileName),
    filePath,
    fileName,
    content: xml,
    language: languageForFile(fileName),
    isDirty: false,
    isDocumentTab: true,
    openedAt: Date.now(),
  }
}

function symbolSearchText(kind: string, name: string) {
  if (kind === 'link') {
    return `<link name="${name}"`
  }

  if (kind === 'joint') {
    return `<joint name="${name}"`
  }

  if (kind === 'sensor') {
    return `<sensor name="${name}"`
  }

  if (kind === 'robot') {
    return '<robot'
  }

  return name
}

export function UrdfEditor({ commands }: UrdfEditorProps) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof Monaco | null>(null)
  const suppressChangeRef = useRef(false)
  const xml = useProjectStore((state) => state.document.xml)
  const fileName = useProjectStore((state) => state.document.fileName)
  const filePath = useProjectStore((state) => state.document.filePath)
  const selection = useProjectStore((state) => state.selection)
  const diagnostics = useProjectStore((state) => state.diagnostics)
  const lastChangeSource = useProjectStore((state) => state.lastChangeSource)
  const setEditorDraftXml = useProjectStore((state) => state.setEditorDraftXml)
  const tabs = useEditorStore((state) => state.tabs)
  const activeTabId = useEditorStore((state) => state.activeTabId)
  const minimapEnabled = useEditorStore((state) => state.minimapEnabled)
  const splitMode = useEditorStore((state) => state.splitMode)
  const syncDocumentTab = useEditorStore((state) => state.syncDocumentTab)
  const closeTab = useEditorStore((state) => state.closeTab)
  const setActiveTab = useEditorStore((state) => state.setActiveTab)
  const updateTabContent = useEditorStore((state) => state.updateTabContent)
  const toggleMinimap = useEditorStore((state) => state.toggleMinimap)
  const setSplitMode = useEditorStore((state) => state.setSplitMode)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const { mode } = useTheme()
  const documentTab = useMemo(() => tabForDocument(fileName, filePath, xml), [fileName, filePath, xml])
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0] ?? documentTab
  const secondaryTab = tabs.find((tab) => tab.id !== activeTab.id) ?? null
  const editorContent = activeTab.isDocumentTab ? xml : activeTab.content
  const secondaryContent = secondaryTab?.isDocumentTab ? xml : secondaryTab?.content
  const breadcrumbs = useMemo(() => {
    const pathParts = (activeTab.filePath ?? activeTab.fileName).split(/[\\/]/).filter(Boolean)
    const entity = selection.id ? [selection.id] : []

    return [...pathParts.slice(-4), ...entity]
  }, [activeTab.fileName, activeTab.filePath, selection.id])

  const refreshUndoRedoState = useCallback(() => {
    const editor = editorRef.current
    const model = editor?.getModel() as (Monaco.editor.ITextModel & {
      canUndo?: () => boolean
      canRedo?: () => boolean
    }) | null

    setCanUndo(Boolean(model?.canUndo?.()))
    setCanRedo(Boolean(model?.canRedo?.()))
  }, [])

  const setMarkers = useCallback(() => {
    const editor = editorRef.current
    const monaco = monacoRef.current
    const model = editor?.getModel()

    if (!monaco || !model) {
      return
    }

    monaco.editor.setModelMarkers(
      model,
      'urdf-builder',
      diagnostics.map((diagnostic) => ({
        message: diagnostic.message,
        severity:
          diagnostic.severity === 'error'
            ? monaco.MarkerSeverity.Error
            : diagnostic.severity === 'warning'
              ? monaco.MarkerSeverity.Warning
              : monaco.MarkerSeverity.Info,
        startLineNumber: diagnostic.line ?? 1,
        startColumn: diagnostic.column ?? 1,
        endLineNumber: diagnostic.line ?? 1,
        endColumn: (diagnostic.column ?? 1) + 1,
      })),
    )
  }, [diagnostics])

  const handleBeforeMount: BeforeMount = (monaco) => {
    registerUrdfLanguage(monaco)
  }

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco
    setMarkers()
    refreshUndoRedoState()
    editor.onDidChangeModelContent(refreshUndoRedoState)
  }

  function runEditorAction(actionId: 'undo' | 'redo' | 'editor.action.formatDocument') {
    const editor = editorRef.current

    editor?.focus()
    void editor?.getAction(actionId)?.run()
    window.setTimeout(refreshUndoRedoState, 0)
  }

  useEffect(setMarkers, [setMarkers])

  useEffect(() => {
    syncDocumentTab(documentTab)
  }, [documentTab, syncDocumentTab])

  useEffect(() => {
    const editor = editorRef.current
    const model = editor?.getModel()

    if (!editor || !model || model.getValue() === editorContent || lastChangeSource === 'editor') {
      return
    }

    const viewState = editor.saveViewState()

    suppressChangeRef.current = true
    model.setValue(editorContent)
    if (viewState) {
      editor.restoreViewState(viewState)
    }
    suppressChangeRef.current = false
    refreshUndoRedoState()
  }, [editorContent, lastChangeSource, refreshUndoRedoState])

  useEffect(() => {
    function handleFocusSymbol(event: Event) {
      const detail = (event as CustomEvent<{ kind: string; name: string }>).detail
      const editor = editorRef.current
      const model = editor?.getModel()

      if (!editor || !model || !detail) {
        return
      }

      const text = symbolSearchText(detail.kind, detail.name)
      const match = model.findMatches(text, false, false, false, null, true)[0]

      if (!match) {
        return
      }

      editor.setSelection(match.range)
      editor.revealRangeInCenter(match.range)
      editor.focus()
    }

    window.addEventListener('urdf-builder:focus-symbol', handleFocusSymbol)
    return () => window.removeEventListener('urdf-builder:focus-symbol', handleFocusSymbol)
  }, [])

  return (
    <section className="editor-panel">
      <PanelHeader
        title={fileName}
        actions={
          <>
            <IconButton
              icon={<Undo2 size={14} />}
              label="Undo (Ctrl+Z)"
              disabled={!canUndo}
              onClick={() => runEditorAction('undo')}
            />
            <IconButton
              icon={<Redo2 size={14} />}
              label="Redo (Ctrl+Y)"
              disabled={!canRedo}
              onClick={() => runEditorAction('redo')}
            />
            <IconButton
              icon={<Code2 size={14} />}
              label="Format XML"
              onClick={() => runEditorAction('editor.action.formatDocument')}
            />
            <IconButton
              icon={<Map size={14} />}
              label={minimapEnabled ? 'Hide Minimap' : 'Show Minimap'}
              active={minimapEnabled}
              onClick={toggleMinimap}
            />
            <IconButton
              icon={<GitCompareArrows size={14} />}
              label={splitMode === 'single' ? 'Split Right' : 'Single Editor'}
              active={splitMode !== 'single'}
              onClick={() => setSplitMode(splitMode === 'single' ? 'right' : 'single')}
            />
            <IconButton
              icon={<ExternalLink size={14} />}
              label="Open Editor Window"
              onClick={commands.detachEditor}
            />
          </>
        }
      />
      <div className="editor-tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`editor-tab ${tab.id === activeTab.id ? 'is-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <ListTree size={13} />
            <span>{tab.fileName}</span>
            {tab.isDirty || (tab.isDocumentTab && useProjectStore.getState().document.isDirty) ? <i /> : null}
            {tabs.length > 1 ? (
              <span
                className="editor-tab-close"
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation()
                  closeTab(tab.id)
                }}
              >
                <X size={12} />
              </span>
            ) : null}
          </button>
        ))}
      </div>
      <nav className="editor-breadcrumbs" aria-label="Editor breadcrumbs">
        {breadcrumbs.map((crumb, index) => (
          <span key={`${crumb}-${index}`}>{crumb}</span>
        ))}
      </nav>
      <div className={`editor-split editor-split-${splitMode}`}>
        <Editor
          height="100%"
          language={activeTab.language}
          path={activeTab.filePath ?? activeTab.fileName}
          defaultValue={editorContent}
          theme={mode === 'dark' ? 'vs-dark' : 'light'}
          beforeMount={handleBeforeMount}
          onMount={handleMount}
          onChange={(value) => {
            if (suppressChangeRef.current) {
              return
            }

            const content = value ?? ''

            if (activeTab.isDocumentTab) {
              setEditorDraftXml(content, 'editor')
            } else {
              updateTabContent(activeTab.id, content)
            }
          }}
          options={{
            automaticLayout: true,
            fontFamily: 'Cascadia Code, Consolas, ui-monospace, monospace',
            fontSize: 13,
            minimap: { enabled: minimapEnabled },
            scrollBeyondLastLine: false,
            tabSize: 2,
            wordWrap: 'on',
            folding: true,
            hover: {
              above: false,
              delay: 450,
              sticky: false,
            },
            lineNumbersMinChars: 3,
            padding: { top: 12, bottom: 12 },
          }}
        />
        {splitMode !== 'single' ? (
          secondaryTab ? (
            <Editor
              height="100%"
              language={secondaryTab.language}
              path={secondaryTab.filePath ?? secondaryTab.fileName}
              defaultValue={secondaryContent}
              theme={mode === 'dark' ? 'vs-dark' : 'light'}
              beforeMount={handleBeforeMount}
              options={{
                automaticLayout: true,
                fontFamily: 'Cascadia Code, Consolas, ui-monospace, monospace',
                fontSize: 13,
                minimap: { enabled: minimapEnabled },
                scrollBeyondLastLine: false,
                tabSize: 2,
                wordWrap: 'on',
                readOnly: false,
                lineNumbersMinChars: 3,
                padding: { top: 12, bottom: 12 },
              }}
            />
          ) : (
            <div className="editor-split-empty">Open another file to use split editor.</div>
          )
        ) : null}
      </div>
    </section>
  )
}
