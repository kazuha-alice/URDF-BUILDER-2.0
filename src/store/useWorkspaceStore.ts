import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createHistoryEntry, useHistoryStore } from './useHistoryStore'
import {
  defaultLayerVisibility,
  type EntityVisibilityMap,
  type SelectionMode,
  type TransformScope,
  type VisibilityLayer,
  type VisibilityLayerState,
  type VisibilityState,
} from '../core/robot-model/visibility'

export type DockPanelId =
  | 'viewport'
  | 'editor'
  | 'inspector'
  | 'explorer'
  | 'hierarchy'
  | 'diagnostics'
  | 'outline'
  | 'tfGraph'
  | 'timeline'
  | 'controller'
  | 'console'

export type PanelId = DockPanelId
export type PanelPlacement = 'docked' | 'floating' | 'detached' | 'hidden'
export type DockArea = 'left' | 'right' | 'bottom' | 'center'
export type LeftDockTab = 'explorer' | 'hierarchy'
export type RightDockTab = 'inspector' | 'diagnostics' | 'outline' | 'tfGraph' | 'timeline'
export type BottomDockTab = 'editor' | 'controller' | 'console'
export type TransformMode = 'translate' | 'rotate' | 'scale'
export type TransformSpace = 'world' | 'local'
export type ViewportTool = 'view' | 'select' | 'move' | 'rotate' | 'scale'
export type ConstraintAxis = 'x' | 'y' | 'z' | null
export type TransformContext = 'scene-placement' | 'urdf-entity-edit'
export type TransformEditScope = 'scene-root' | 'robot-entity'

export type TransformTarget =
  | {
      type: 'robot'
      robotId: string
    }
  | {
      type: 'link'
      linkId: string
    }
  | {
      type: 'joint'
      jointId: string
    }
  | {
      type: 'mesh'
      meshId: string
    }
  | {
      type: 'sensor'
      sensorId: string
    }

export interface TransformData {
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
}

export interface TransformSession {
  id: string
  active: boolean
  tool: Extract<ViewportTool, 'move' | 'rotate' | 'scale'>
  mode: Extract<ViewportTool, 'move' | 'rotate' | 'scale'>
  target: TransformTarget
  constraintAxis: ConstraintAxis
  transformContext: TransformContext
  transformEditScope: TransformEditScope
  objectId: string
  initialTransform: TransformData
  currentTransform: TransformData
  ownerId?: string
}

export interface ViewportDebugSettings {
  showJointMarkers: boolean
  showSensorMarkers: boolean
  showBoundingSpheres: boolean
  showDebugHelpers: boolean
  showPlaceholderLinks: boolean
}

export interface PanelState {
  id: PanelId
  title: string
  placement: PanelPlacement
  windowId?: number
  dockArea?: DockArea
  isVisible: boolean
  bounds?: {
    x: number
    y: number
    width: number
    height: number
  }
}

interface WorkspaceStore {
  panels: Record<DockPanelId, PanelState>
  leftWidth: number
  rightWidth: number
  bottomHeight: number
  leftCollapsed: boolean
  rightCollapsed: boolean
  bottomCollapsed: boolean
  activeLeftTab: LeftDockTab
  activeRightTab: RightDockTab
  activeBottomTab: BottomDockTab
  maximizedPanel: DockPanelId | null
  floatingPanels: DockPanelId[]
  viewportTool: ViewportTool
  transformMode: TransformMode
  selectionMode: SelectionMode
  transformScope: TransformScope
  transformEditScope: TransformEditScope
  transformSpace: TransformSpace
  constraintAxis: ConstraintAxis
  transformSession: TransformSession | null
  activeTransformOwnerId: string | null
  transformCancelVersion: number
  snapEnabled: boolean
  snapStep: number
  robotSceneTransform: TransformData
  entityVisibility: EntityVisibilityMap
  layerVisibility: VisibilityLayerState
  viewportDebug: ViewportDebugSettings
  showHiddenItems: boolean
  frameRequestVersion: number
  setLeftWidth: (width: number) => void
  setRightWidth: (width: number) => void
  setBottomHeight: (height: number) => void
  setActiveLeftTab: (tab: LeftDockTab) => void
  setActiveRightTab: (tab: RightDockTab) => void
  setActiveBottomTab: (tab: BottomDockTab) => void
  setPanelRegistry: (panels: Partial<Record<DockPanelId, PanelState>>) => void
  toggleLeftCollapsed: () => void
  toggleRightCollapsed: () => void
  toggleBottomCollapsed: () => void
  maximizePanel: (panel: DockPanelId) => void
  restorePanel: (panel?: DockPanelId) => void
  toggleFloatingPanel: (panel: DockPanelId) => void
  detachPanel: (panel: DockPanelId, windowId?: number) => void
  dockPanel: (panel: DockPanelId) => void
  hidePanel: (panel: DockPanelId) => void
  setPanelWindowId: (panel: DockPanelId, windowId?: number) => void
  setPanelBounds: (panel: DockPanelId, bounds: PanelState['bounds']) => void
  setViewportTool: (tool: ViewportTool) => void
  setTransformMode: (mode: TransformMode) => void
  setSelectionMode: (mode: SelectionMode) => void
  setTransformScope: (scope: TransformScope) => void
  setTransformEditScope: (scope: TransformEditScope) => void
  setTransformSpace: (space: TransformSpace) => void
  setConstraintAxis: (axis: ConstraintAxis) => void
  startTransformSession: (
    mode: TransformSession['mode'],
    objectId: string,
    initialTransform: TransformData,
    target?: TransformTarget,
    transformContext?: TransformContext,
    ownerId?: string,
  ) => void
  updateTransformSession: (currentTransform: TransformData) => void
  confirmTransformSession: () => void
  cancelTransformSession: () => void
  clearTransformSession: () => void
  setActiveTransformOwner: (ownerId: string | null) => void
  setRobotSceneTransform: (transform: TransformData) => void
  resetRobotSceneTransform: () => void
  toggleSnap: () => void
  setSnapStep: (step: number) => void
  setEntityVisibility: (entityId: string, visible: boolean) => void
  setEntitySubtreeVisibility: (entityIds: string[], visible: boolean) => void
  toggleEntityVisibility: (entityId: string) => void
  hideEntities: (entityIds: string[]) => void
  isolateEntities: (visibleEntityIds: string[], allEntityIds: string[]) => void
  revealAllEntities: () => void
  setLayerVisibility: (layer: VisibilityLayer, visible: boolean) => void
  toggleLayerVisibility: (layer: VisibilityLayer) => void
  setViewportDebugSetting: (setting: keyof ViewportDebugSettings, enabled: boolean) => void
  toggleViewportDebugSetting: (setting: keyof ViewportDebugSettings) => void
  toggleShowHiddenItems: () => void
  requestFrameSelection: () => void
  resetLayout: () => void
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

type WorkspaceHistorySnapshot = {
  entityVisibility: EntityVisibilityMap
  layerVisibility: VisibilityLayerState
}

function cloneVisibilityMap(value: EntityVisibilityMap): EntityVisibilityMap {
  return Object.fromEntries(Object.entries(value).map(([key, state]) => [key, { ...state }]))
}

function cloneLayerVisibility(value: VisibilityLayerState): VisibilityLayerState {
  return { ...value }
}

function workspaceHistorySnapshot(state: Pick<WorkspaceStore, 'entityVisibility' | 'layerVisibility'>) {
  return {
    entityVisibility: cloneVisibilityMap(state.entityVisibility),
    layerVisibility: cloneLayerVisibility(state.layerVisibility),
  }
}

function restoreWorkspaceHistorySnapshot(snapshot: WorkspaceHistorySnapshot) {
  useWorkspaceStore.setState({
    entityVisibility: cloneVisibilityMap(snapshot.entityVisibility),
    layerVisibility: cloneLayerVisibility(snapshot.layerVisibility),
  })
}

function pushWorkspaceHistory(
  label: string,
  before: WorkspaceHistorySnapshot,
  after: WorkspaceHistorySnapshot,
) {
  if (useHistoryStore.getState().isApplying || JSON.stringify(before) === JSON.stringify(after)) {
    return
  }

  useHistoryStore.getState().push(
    createHistoryEntry({
      label,
      source: 'hierarchy',
      undo: () => restoreWorkspaceHistorySnapshot(before),
      redo: () => restoreWorkspaceHistorySnapshot(after),
    }),
  )
}

export const panelTitles: Record<DockPanelId, string> = {
  viewport: 'Viewport',
  editor: 'Editor',
  inspector: 'Inspector',
  explorer: 'Explorer',
  hierarchy: 'Hierarchy',
  diagnostics: 'Diagnostics',
  outline: 'Outline',
  tfGraph: 'TF View',
  timeline: 'Timeline',
  controller: 'Controller',
  console: 'Console',
}

export const defaultPanelDockAreas: Record<DockPanelId, DockArea> = {
  viewport: 'center',
  editor: 'bottom',
  inspector: 'right',
  explorer: 'left',
  hierarchy: 'left',
  diagnostics: 'right',
  outline: 'right',
  tfGraph: 'right',
  timeline: 'right',
  controller: 'bottom',
  console: 'bottom',
}

export const panelIds: DockPanelId[] = [
  'viewport',
  'editor',
  'inspector',
  'explorer',
  'hierarchy',
  'diagnostics',
  'outline',
  'tfGraph',
  'timeline',
  'controller',
  'console',
]

function createDefaultPanels(): Record<DockPanelId, PanelState> {
  return panelIds.reduce(
    (panels, id) => ({
      ...panels,
      [id]: {
        id,
        title: panelTitles[id],
        placement: 'docked' as PanelPlacement,
        dockArea: defaultPanelDockAreas[id],
        isVisible: true,
      },
    }),
    {} as Record<DockPanelId, PanelState>,
  )
}

const defaults = {
  panels: createDefaultPanels(),
  leftWidth: 300,
  rightWidth: 360,
  bottomHeight: 300,
  leftCollapsed: false,
  rightCollapsed: false,
  bottomCollapsed: false,
  activeLeftTab: 'explorer' as LeftDockTab,
  activeRightTab: 'inspector' as RightDockTab,
  activeBottomTab: 'editor' as BottomDockTab,
  maximizedPanel: null,
  floatingPanels: [] as DockPanelId[],
  viewportTool: 'select' as ViewportTool,
  transformMode: 'translate' as TransformMode,
  selectionMode: 'mesh' as SelectionMode,
  transformScope: 'entity' as TransformScope,
  transformEditScope: 'robot-entity' as TransformEditScope,
  transformSpace: 'world' as TransformSpace,
  constraintAxis: null as ConstraintAxis,
  transformSession: null as TransformSession | null,
  activeTransformOwnerId: null as string | null,
  transformCancelVersion: 0,
  snapEnabled: false,
  snapStep: 0.05,
  robotSceneTransform: {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  } as TransformData,
  entityVisibility: {} as EntityVisibilityMap,
  layerVisibility: defaultLayerVisibility,
  viewportDebug: {
    showJointMarkers: false,
    showSensorMarkers: false,
    showBoundingSpheres: false,
    showDebugHelpers: false,
    showPlaceholderLinks: false,
  } as ViewportDebugSettings,
  showHiddenItems: true,
  frameRequestVersion: 0,
}

function normalizeVisibilityState(value: unknown): VisibilityState {
  if (typeof value === 'boolean') {
    return { visible: value, inheritedHidden: false, effectiveVisible: value }
  }

  if (value && typeof value === 'object') {
    const state = value as Partial<VisibilityState>
    return {
      visible: state.visible !== false,
      inheritedHidden: Boolean(state.inheritedHidden),
      effectiveVisible: state.effectiveVisible !== false && state.visible !== false,
    }
  }

  return { visible: true, inheritedHidden: false, effectiveVisible: true }
}

function normalizeVisibilityMap(value: unknown): EntityVisibilityMap {
  if (!value || typeof value !== 'object') {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([entityId, state]) => [
      entityId,
      normalizeVisibilityState(state),
    ]),
  )
}

function normalizeLayerVisibility(value: unknown): VisibilityLayerState {
  if (!value || typeof value !== 'object') {
    return defaultLayerVisibility
  }

  return {
    ...defaultLayerVisibility,
    ...(value as Partial<VisibilityLayerState>),
  }
}

function setVisibleState(
  visibility: EntityVisibilityMap,
  entityId: string,
  visible: boolean,
): EntityVisibilityMap {
  return {
    ...visibility,
    [entityId]: {
      visible,
      inheritedHidden: false,
      effectiveVisible: visible,
    },
  }
}

function normalizeViewportDebug(value: unknown): ViewportDebugSettings {
  if (!value || typeof value !== 'object') {
    return defaults.viewportDebug
  }

  return {
    ...defaults.viewportDebug,
    ...(value as Partial<ViewportDebugSettings>),
  }
}

function normalizeTransformData(value: unknown): TransformData {
  if (!value || typeof value !== 'object') {
    return defaults.robotSceneTransform
  }

  const data = value as Partial<TransformData>
  const position = Array.isArray(data.position) ? data.position : defaults.robotSceneTransform.position
  const rotation = Array.isArray(data.rotation) ? data.rotation : defaults.robotSceneTransform.rotation
  const scale = Array.isArray(data.scale) ? data.scale : defaults.robotSceneTransform.scale

  return {
    position: [
      Number.isFinite(position[0]) ? position[0] : 0,
      Number.isFinite(position[1]) ? position[1] : 0,
      Number.isFinite(position[2]) ? position[2] : 0,
    ],
    rotation: [
      Number.isFinite(rotation[0]) ? rotation[0] : 0,
      Number.isFinite(rotation[1]) ? rotation[1] : 0,
      Number.isFinite(rotation[2]) ? rotation[2] : 0,
    ],
    scale: [
      Number.isFinite(scale[0]) ? scale[0] : 1,
      Number.isFinite(scale[1]) ? scale[1] : 1,
      Number.isFinite(scale[2]) ? scale[2] : 1,
    ],
  }
}

function toolToTransformMode(tool: ViewportTool): TransformMode {
  if (tool === 'rotate') {
    return 'rotate'
  }

  if (tool === 'scale') {
    return 'scale'
  }

  return 'translate'
}

function transformModeToTool(transformMode: TransformMode): ViewportTool {
  if (transformMode === 'translate') {
    return 'move'
  }

  return transformMode
}

function targetFromObjectId(objectId: string): TransformTarget {
  if (objectId.startsWith('robot:')) {
    return { type: 'robot', robotId: objectId.slice('robot:'.length) }
  }

  if (objectId.startsWith('joint:')) {
    return { type: 'joint', jointId: objectId.slice('joint:'.length) }
  }

  if (objectId.startsWith('mesh:')) {
    return { type: 'mesh', meshId: objectId }
  }

  if (objectId.startsWith('sensor:')) {
    return { type: 'sensor', sensorId: objectId.slice('sensor:'.length) }
  }

  return { type: 'link', linkId: objectId.startsWith('link:') ? objectId.slice('link:'.length) : objectId }
}

function transformContextFromTarget(target: TransformTarget): TransformContext {
  return target.type === 'robot' ? 'scene-placement' : 'urdf-entity-edit'
}

function transformEditScopeFromContext(context: TransformContext): TransformEditScope {
  return context === 'scene-placement' ? 'scene-root' : 'robot-entity'
}

function createTransformSessionId() {
  return `transform-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function isPanelInMainLayout(panel?: PanelState) {
  return Boolean(panel?.isVisible && (panel.placement === 'docked' || panel.placement === 'floating'))
}

function firstVisiblePanel(
  panels: Record<DockPanelId, PanelState>,
  dockArea: DockArea,
): DockPanelId | undefined {
  return panelIds.find((id) => panels[id].dockArea === dockArea && isPanelInMainLayout(panels[id]))
}

function withFallbackTabs(
  state: WorkspaceStore,
  panels: Record<DockPanelId, PanelState>,
  dockArea?: DockArea,
) {
  const patch: Partial<WorkspaceStore> = {}

  if (dockArea === 'left' && !isPanelInMainLayout(panels[state.activeLeftTab])) {
    patch.activeLeftTab = (firstVisiblePanel(panels, 'left') ?? state.activeLeftTab) as LeftDockTab
  }

  if (dockArea === 'right' && !isPanelInMainLayout(panels[state.activeRightTab])) {
    patch.activeRightTab = (firstVisiblePanel(panels, 'right') ?? state.activeRightTab) as RightDockTab
  }

  if (dockArea === 'bottom' && !isPanelInMainLayout(panels[state.activeBottomTab])) {
    patch.activeBottomTab = (firstVisiblePanel(panels, 'bottom') ?? state.activeBottomTab) as BottomDockTab
  }

  return patch
}

function visibleFloatingPanels(panels: Record<DockPanelId, PanelState>) {
  return panelIds.filter((id) => panels[id].placement === 'floating' && panels[id].isVisible)
}

function mergePersistedState(persistedState: unknown, currentState: WorkspaceStore): WorkspaceStore {
  if (!persistedState || typeof persistedState !== 'object') {
    return currentState
  }

  const persisted = persistedState as Partial<WorkspaceStore>
  const panels: Record<DockPanelId, PanelState> = {
    ...createDefaultPanels(),
    ...(persisted.panels ?? {}),
  }
  const activeLeftTab =
    persisted.activeLeftTab && panels[persisted.activeLeftTab]?.dockArea === 'left'
      ? persisted.activeLeftTab
      : currentState.activeLeftTab
  const activeRightTab =
    persisted.activeRightTab && panels[persisted.activeRightTab]?.dockArea === 'right'
      ? persisted.activeRightTab
      : currentState.activeRightTab
  const activeBottomTab =
    persisted.activeBottomTab && panels[persisted.activeBottomTab]?.dockArea === 'bottom'
      ? persisted.activeBottomTab
      : currentState.activeBottomTab

  return {
    ...currentState,
    ...persisted,
    panels,
    entityVisibility: normalizeVisibilityMap(persisted.entityVisibility),
    layerVisibility: normalizeLayerVisibility(persisted.layerVisibility),
    viewportDebug: normalizeViewportDebug(persisted.viewportDebug),
    robotSceneTransform: normalizeTransformData(persisted.robotSceneTransform),
    transformEditScope:
      persisted.transformEditScope === 'scene-root' ||
      persisted.transformEditScope === 'robot-entity'
        ? persisted.transformEditScope
        : currentState.transformEditScope,
    selectionMode:
      persisted.selectionMode === 'robot' ||
      persisted.selectionMode === 'link' ||
      persisted.selectionMode === 'joint' ||
      persisted.selectionMode === 'mesh' ||
      persisted.selectionMode === 'sensor'
        ? persisted.selectionMode
        : currentState.selectionMode,
    transformScope:
      persisted.transformScope === 'robot' ||
      persisted.transformScope === 'subtree' ||
      persisted.transformScope === 'entity'
        ? persisted.transformScope
        : currentState.transformScope,
    activeLeftTab,
    activeRightTab,
    activeBottomTab,
    maximizedPanel:
      persisted.maximizedPanel && panels[persisted.maximizedPanel]
        ? persisted.maximizedPanel
        : currentState.maximizedPanel,
    floatingPanels: visibleFloatingPanels(panels),
  }
}

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set) => ({
      ...defaults,
      setLeftWidth: (width) => set({ leftWidth: clamp(width, 220, 520), leftCollapsed: false }),
      setRightWidth: (width) => set({ rightWidth: clamp(width, 260, 560), rightCollapsed: false }),
      setBottomHeight: (height) =>
        set({ bottomHeight: clamp(height, 180, 560), bottomCollapsed: false }),
      setActiveLeftTab: (activeLeftTab) => set({ activeLeftTab, leftCollapsed: false }),
      setActiveRightTab: (activeRightTab) => set({ activeRightTab, rightCollapsed: false }),
      setActiveBottomTab: (activeBottomTab) => set({ activeBottomTab, bottomCollapsed: false }),
      setPanelRegistry: (panels) =>
        set((state) => ({
          panels: {
            ...state.panels,
            ...panels,
          },
        })),
      toggleLeftCollapsed: () => set((state) => ({ leftCollapsed: !state.leftCollapsed })),
      toggleRightCollapsed: () => set((state) => ({ rightCollapsed: !state.rightCollapsed })),
      toggleBottomCollapsed: () => set((state) => ({ bottomCollapsed: !state.bottomCollapsed })),
      maximizePanel: (maximizedPanel) => set({ maximizedPanel }),
      restorePanel: (panel) =>
        set((state) => {
          if (!panel) {
            return { maximizedPanel: null }
          }

          const currentPanel = state.panels[panel]
          const panels = {
            ...state.panels,
            [panel]: {
              ...currentPanel,
              placement: 'docked' as PanelPlacement,
              windowId: undefined,
              dockArea: defaultPanelDockAreas[panel],
              isVisible: true,
            },
          }
          const patch: Partial<WorkspaceStore> = {
            panels,
            floatingPanels: visibleFloatingPanels(panels),
            maximizedPanel: state.maximizedPanel === panel ? null : state.maximizedPanel,
          }

          if (defaultPanelDockAreas[panel] === 'left') {
            patch.activeLeftTab = panel as LeftDockTab
            patch.leftCollapsed = false
          }

          if (defaultPanelDockAreas[panel] === 'right') {
            patch.activeRightTab = panel as RightDockTab
            patch.rightCollapsed = false
          }

          if (defaultPanelDockAreas[panel] === 'bottom') {
            patch.activeBottomTab = panel as BottomDockTab
            patch.bottomCollapsed = false
          }

          return patch
        }),
      toggleFloatingPanel: (panel) =>
        set((state) => ({
          panels: {
            ...state.panels,
            [panel]: {
              ...state.panels[panel],
              placement: state.panels[panel].placement === 'floating' ? 'docked' : 'floating',
              isVisible: true,
              windowId: undefined,
            },
          },
          floatingPanels: visibleFloatingPanels({
            ...state.panels,
            [panel]: {
              ...state.panels[panel],
              placement: state.panels[panel].placement === 'floating' ? 'docked' : 'floating',
              isVisible: true,
              windowId: undefined,
            },
          }),
        })),
      detachPanel: (panel, windowId) =>
        set((state) => {
          const currentPanel = state.panels[panel]
          const panels = {
            ...state.panels,
            [panel]: {
              ...currentPanel,
              placement: 'detached' as PanelPlacement,
              windowId,
              isVisible: false,
            },
          }

          return {
            panels,
            floatingPanels: visibleFloatingPanels(panels),
            maximizedPanel: state.maximizedPanel === panel ? null : state.maximizedPanel,
            ...withFallbackTabs(state, panels, currentPanel.dockArea),
          }
        }),
      dockPanel: (panel) =>
        set((state) => {
          const currentPanel = state.panels[panel]
          const panels = {
            ...state.panels,
            [panel]: {
              ...currentPanel,
              placement: 'docked' as PanelPlacement,
              windowId: undefined,
              dockArea: currentPanel.dockArea ?? defaultPanelDockAreas[panel],
              isVisible: true,
            },
          }
          const patch: Partial<WorkspaceStore> = {
            panels,
            floatingPanels: visibleFloatingPanels(panels),
          }

          if (currentPanel.dockArea === 'left') {
            patch.activeLeftTab = panel as LeftDockTab
            patch.leftCollapsed = false
          }

          if (currentPanel.dockArea === 'right') {
            patch.activeRightTab = panel as RightDockTab
            patch.rightCollapsed = false
          }

          if (currentPanel.dockArea === 'bottom') {
            patch.activeBottomTab = panel as BottomDockTab
            patch.bottomCollapsed = false
          }

          return patch
        }),
      hidePanel: (panel) =>
        set((state) => {
          const currentPanel = state.panels[panel]
          const panels = {
            ...state.panels,
            [panel]: {
              ...currentPanel,
              placement: 'hidden' as PanelPlacement,
              windowId: undefined,
              dockArea: currentPanel.dockArea ?? defaultPanelDockAreas[panel],
              isVisible: false,
            },
          }

          return {
            panels,
            floatingPanels: visibleFloatingPanels(panels),
            maximizedPanel: state.maximizedPanel === panel ? null : state.maximizedPanel,
            ...withFallbackTabs(state, panels, currentPanel.dockArea),
          }
        }),
      setPanelWindowId: (panel, windowId) =>
        set((state) => ({
          panels: {
            ...state.panels,
            [panel]: {
              ...state.panels[panel],
              windowId,
            },
          },
        })),
      setPanelBounds: (panel, bounds) =>
        set((state) => ({
          panels: {
            ...state.panels,
            [panel]: {
              ...state.panels[panel],
              bounds,
            },
          },
        })),
      setViewportTool: (viewportTool) =>
        set({
          viewportTool,
          transformMode: toolToTransformMode(viewportTool),
          constraintAxis: null,
          transformSession: null,
          activeTransformOwnerId: null,
        }),
      setTransformMode: (transformMode) =>
        set({
          transformMode,
          viewportTool: transformModeToTool(transformMode),
          constraintAxis: null,
          transformSession: null,
          activeTransformOwnerId: null,
        }),
      setSelectionMode: (selectionMode) =>
        set({
          selectionMode,
          transformScope:
            selectionMode === 'robot' ? 'robot' : selectionMode === 'link' ? 'subtree' : 'entity',
          transformEditScope: selectionMode === 'robot' ? 'scene-root' : 'robot-entity',
          constraintAxis: null,
          transformSession: null,
          activeTransformOwnerId: null,
        }),
      setTransformScope: (transformScope) =>
        set({
          transformScope,
          constraintAxis: null,
          transformSession: null,
          activeTransformOwnerId: null,
        }),
      setTransformEditScope: (transformEditScope) =>
        set({
          transformEditScope,
          constraintAxis: null,
          transformSession: null,
          activeTransformOwnerId: null,
        }),
      setTransformSpace: (transformSpace) => set({ transformSpace }),
      setConstraintAxis: (constraintAxis) =>
        set((state) => ({
          constraintAxis,
          transformSession: state.transformSession
            ? {
                ...state.transformSession,
                constraintAxis,
              }
            : state.transformSession,
        })),
      startTransformSession: (mode, objectId, initialTransform, target, transformContext, ownerId) =>
        set(() => {
          const resolvedTarget = target ?? targetFromObjectId(objectId)
          const resolvedContext = transformContext ?? transformContextFromTarget(resolvedTarget)

          return {
            viewportTool: mode,
            transformMode: toolToTransformMode(mode),
            constraintAxis: null,
            transformEditScope: transformEditScopeFromContext(resolvedContext),
            activeTransformOwnerId: ownerId ?? null,
            transformSession: {
              id: createTransformSessionId(),
              active: true,
              tool: mode,
              mode,
              target: resolvedTarget,
              constraintAxis: null,
              transformContext: resolvedContext,
              transformEditScope: transformEditScopeFromContext(resolvedContext),
              objectId,
              initialTransform,
              currentTransform: initialTransform,
              ownerId,
            },
          }
        }),
      updateTransformSession: (currentTransform) =>
        set((state) => ({
          transformSession: state.transformSession
            ? (() => {
                if (state.transformSession.tool !== state.viewportTool) {
                  console.warn('Transform session/tool mismatch', {
                    sessionTool: state.transformSession.tool,
                    currentTool: state.viewportTool,
                    target: state.transformSession.target,
                  })
                }

                return {
                  ...state.transformSession,
                  currentTransform,
                }
              })()
            : state.transformSession,
        })),
      confirmTransformSession: () =>
        set({ transformSession: null, constraintAxis: null, activeTransformOwnerId: null }),
      cancelTransformSession: () =>
        set((state) => ({
          transformSession: null,
          constraintAxis: null,
          activeTransformOwnerId: null,
          transformCancelVersion: state.transformCancelVersion + 1,
        })),
      clearTransformSession: () =>
        set({ transformSession: null, constraintAxis: null, activeTransformOwnerId: null }),
      setActiveTransformOwner: (activeTransformOwnerId) => set({ activeTransformOwnerId }),
      setRobotSceneTransform: (robotSceneTransform) => set({ robotSceneTransform }),
      resetRobotSceneTransform: () => set({ robotSceneTransform: defaults.robotSceneTransform }),
      toggleSnap: () => set((state) => ({ snapEnabled: !state.snapEnabled })),
      setSnapStep: (snapStep) => set({ snapStep: clamp(snapStep, 0.001, 1) }),
      setEntityVisibility: (entityId, visible) =>
        set((state) => {
          const before = workspaceHistorySnapshot(state)
          const nextEntityVisibility = setVisibleState(state.entityVisibility, entityId, visible)
          const after = workspaceHistorySnapshot({
            entityVisibility: nextEntityVisibility,
            layerVisibility: state.layerVisibility,
          })

          pushWorkspaceHistory(`${visible ? 'Show' : 'Hide'} ${entityId}`, before, after)

          return {
            entityVisibility: nextEntityVisibility,
          }
        }),
      setEntitySubtreeVisibility: (entityIds, visible) =>
        set((state) => {
          const before = workspaceHistorySnapshot(state)
          const nextEntityVisibility = entityIds.reduce(
            (visibility, entityId) => setVisibleState(visibility, entityId, visible),
            state.entityVisibility,
          )
          const after = workspaceHistorySnapshot({
            entityVisibility: nextEntityVisibility,
            layerVisibility: state.layerVisibility,
          })

          pushWorkspaceHistory(`${visible ? 'Show' : 'Hide'} subtree`, before, after)

          return {
            entityVisibility: nextEntityVisibility,
          }
        }),
      toggleEntityVisibility: (entityId) =>
        set((state) => {
          const before = workspaceHistorySnapshot(state)
          const visible = state.entityVisibility[entityId]?.visible === false
          const nextEntityVisibility = setVisibleState(state.entityVisibility, entityId, visible)
          const after = workspaceHistorySnapshot({
            entityVisibility: nextEntityVisibility,
            layerVisibility: state.layerVisibility,
          })

          pushWorkspaceHistory(`${visible ? 'Show' : 'Hide'} ${entityId}`, before, after)

          return {
            entityVisibility: nextEntityVisibility,
          }
        }),
      hideEntities: (entityIds) =>
        set((state) => {
          const before = workspaceHistorySnapshot(state)
          const nextEntityVisibility = entityIds.reduce(
            (visibility, entityId) => setVisibleState(visibility, entityId, false),
            state.entityVisibility,
          )
          const after = workspaceHistorySnapshot({
            entityVisibility: nextEntityVisibility,
            layerVisibility: state.layerVisibility,
          })

          pushWorkspaceHistory('Hide selected', before, after)

          return {
            entityVisibility: nextEntityVisibility,
          }
        }),
      isolateEntities: (visibleEntityIds, allEntityIds) =>
        set((state) => {
          const before = workspaceHistorySnapshot(state)
          const visibleSet = new Set(visibleEntityIds)
          const nextEntityVisibility = allEntityIds.reduce(
            (visibility, entityId) => setVisibleState(visibility, entityId, visibleSet.has(entityId)),
            state.entityVisibility,
          )
          const after = workspaceHistorySnapshot({
            entityVisibility: nextEntityVisibility,
            layerVisibility: state.layerVisibility,
          })

          pushWorkspaceHistory('Isolate selection', before, after)

          return {
            entityVisibility: nextEntityVisibility,
          }
        }),
      revealAllEntities: () =>
        set((state) => {
          const before = workspaceHistorySnapshot(state)
          const after = workspaceHistorySnapshot({
            entityVisibility: {},
            layerVisibility: state.layerVisibility,
          })

          pushWorkspaceHistory('Reveal all', before, after)

          return { entityVisibility: {} }
        }),
      setLayerVisibility: (layer, visible) =>
        set((state) => {
          const before = workspaceHistorySnapshot(state)
          const nextLayerVisibility = {
            ...state.layerVisibility,
            [layer]: visible,
          }
          const after = workspaceHistorySnapshot({
            entityVisibility: state.entityVisibility,
            layerVisibility: nextLayerVisibility,
          })

          pushWorkspaceHistory(`${visible ? 'Show' : 'Hide'} ${layer} layer`, before, after)

          return {
            layerVisibility: nextLayerVisibility,
          }
        }),
      toggleLayerVisibility: (layer) =>
        set((state) => {
          const before = workspaceHistorySnapshot(state)
          const nextVisible = !state.layerVisibility[layer]
          const nextLayerVisibility = {
            ...state.layerVisibility,
            [layer]: nextVisible,
          }
          const after = workspaceHistorySnapshot({
            entityVisibility: state.entityVisibility,
            layerVisibility: nextLayerVisibility,
          })

          pushWorkspaceHistory(`${nextVisible ? 'Show' : 'Hide'} ${layer} layer`, before, after)

          return {
            layerVisibility: nextLayerVisibility,
          }
        }),
      setViewportDebugSetting: (setting, enabled) =>
        set((state) => ({
          viewportDebug: {
            ...state.viewportDebug,
            [setting]: enabled,
          },
        })),
      toggleViewportDebugSetting: (setting) =>
        set((state) => ({
          viewportDebug: {
            ...state.viewportDebug,
            [setting]: !state.viewportDebug[setting],
          },
        })),
      toggleShowHiddenItems: () => set((state) => ({ showHiddenItems: !state.showHiddenItems })),
      requestFrameSelection: () =>
        set((state) => ({ frameRequestVersion: state.frameRequestVersion + 1 })),
      resetLayout: () => set({ ...defaults, panels: createDefaultPanels() }),
    }),
    {
      name: 'urdf-builder-workspace-layout',
      merge: mergePersistedState,
    },
  ),
)
