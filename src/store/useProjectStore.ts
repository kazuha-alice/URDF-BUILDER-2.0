import { create } from 'zustand'
import type { ControllerType, ControllerValidationResult } from '../core/controllers/previewController'
import type { ProjectFileEntry, WorkspaceSession } from '../lib/electron'
import {
  defaultUrdf,
  DEFAULT_URDF_FILENAME,
} from '../core/urdf/defaultUrdf'
import { exportRobotModelToUrdf } from '../core/urdf/exporter'
import { parseUrdf } from '../core/urdf/parser'
import { validateRobotModel } from '../core/urdf/validator'
import { identityTransform } from '../core/robot-model/types'
import { analyzeRobotSemantics } from '../core/robot-model/semantics'
import { parseMeshSelectionId, type MeshRole } from '../core/robot-model/selection'
import type { ChangeSource, ScenePatch, UrdfBuffers } from '../core/sync/types'
import { createHistoryEntry, useHistoryStore } from './useHistoryStore'
import type {
  Diagnostic,
  JointType,
  RobotJointModel,
  RobotLinkModel,
  RobotModel,
  SelectionRef,
  SensorType,
  TransformModel,
  Vector3Tuple,
} from '../core/robot-model/types'

export type CameraMode = 'perspective' | 'orthographic'
export type ViewPreset = 'perspective' | 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom'
export type AppView = 'dashboard' | 'workspace'

export interface DocumentState {
  fileName: string
  filePath: string | null
  content: string
  isDirty: boolean
  isUntitled: boolean
  openedAt: number
}

export interface ProjectDocument extends DocumentState {
  projectDir: string | null
  xml: string
  dirty: boolean
  recentFiles: string[]
}

export interface ControllerState {
  activeType: ControllerType
  isRunning: boolean
  jointValues: Record<string, number>
  wheelSpeeds: {
    left: number
    right: number
  }
  speedMultiplier: number
  validation: ControllerValidationResult
  linearVelocity: number
  angularVelocity: number
}

export interface SaveNotice {
  message: string
  fileName: string
  savedAt: number
}

interface LoadDocumentPayload {
  fileName: string
  filePath: string | null
  projectDir: string | null
  xml?: string
  content?: string
  dirty?: boolean
  recentFiles?: string[]
  resourceDiagnostics?: Diagnostic[]
  projectRoot?: string | null
  projectFiles?: ProjectFileEntry[]
}

interface ProjectStore {
  appView: AppView
  pendingWorkspaceSession: WorkspaceSession | null
  document: ProjectDocument
  robot: RobotModel
  diagnostics: Diagnostic[]
  buffers: UrdfBuffers
  lastChangeSource: ChangeSource
  selection: SelectionRef
  initialized: boolean
  sessionReady: boolean
  cameraMode: CameraMode
  viewPreset: ViewPreset
  projectFiles: ProjectFileEntry[]
  projectRoot: string | null
  controllerState: ControllerState
  saveNotice: SaveNotice | null
  markSessionReady: () => void
  setPendingWorkspaceSession: (session: WorkspaceSession | null) => void
  showDashboard: (reason?: string) => void
  enterWorkspace: () => void
  restorePendingWorkspaceSession: () => void
  restoreWorkspaceSession: (session: WorkspaceSession) => void
  newDocument: () => void
  resetWorkspaceForNewDocument: () => void
  openExistingDocument: (payload: LoadDocumentPayload) => void
  loadDocument: (payload: LoadDocumentPayload) => void
  markSaved: (payload: LoadDocumentPayload) => void
  setXml: (xml: string) => void
  setEditorDraftXml: (xml: string, source?: ChangeSource) => void
  parseEditorDraft: () => void
  select: (selection: SelectionRef) => void
  setCameraMode: (mode: CameraMode) => void
  setViewPreset: (preset: ViewPreset) => void
  setProjectFiles: (rootPath: string | null, files: ProjectFileEntry[]) => void
  setRecentFiles: (recentFiles: string[]) => void
  renameRobot: (name: string) => void
  previewRobotTransform: (transform: TransformModel, source?: ChangeSource) => void
  updateRobotTransform: (transform: TransformModel, source?: ChangeSource) => void
  renameLink: (currentName: string, nextName: string) => void
  updateLinkMesh: (linkName: string, role: 'visual' | 'collision', filename: string) => void
  previewLinkGeometryTransform: (
    linkName: string,
    role: MeshRole,
    transform: TransformModel,
    source?: ChangeSource,
  ) => void
  updateLinkGeometryTransform: (
    linkName: string,
    role: MeshRole,
    transform: TransformModel,
    source?: ChangeSource,
  ) => void
  patchLinkGeometryOriginField: (
    linkName: string,
    role: MeshRole,
    field: 'xyz' | 'rpy',
    value: Vector3Tuple,
    source?: ChangeSource,
  ) => void
  patchLinkGeometryScale: (
    linkName: string,
    role: MeshRole,
    scale: Vector3Tuple,
    source?: ChangeSource,
  ) => void
  previewLinkTransform: (linkName: string, transform: TransformModel, source?: ChangeSource) => void
  updateLinkTransform: (linkName: string, transform: TransformModel, source?: ChangeSource) => void
  patchJointOriginField: (
    jointName: string,
    field: 'xyz' | 'rpy',
    value: Vector3Tuple,
    source?: ChangeSource,
  ) => void
  resetLinkTransform: (linkName: string) => void
  previewJoint: (jointName: string, patch: Partial<RobotJointModel>, source?: ChangeSource) => void
  updateJoint: (jointName: string, patch: Partial<RobotJointModel>, source?: ChangeSource) => void
  addLink: () => void
  addChildLink: (parentName: string, type?: JointType) => void
  duplicateLink: (linkName: string) => void
  deleteSelection: () => void
  addJoint: (type?: JointType, parentName?: string, childName?: string) => void
  addSensor: (type?: SensorType) => void
  setJointControllerValue: (jointName: string, value: number) => void
  setControllerType: (controllerType: ControllerType) => void
  setControllerValidation: (validation: ControllerValidationResult) => void
  setControllerRunning: (isRunning: boolean) => void
  setControllerSpeedMultiplier: (speedMultiplier: number) => void
  setDriveCommand: (leftSpeed: number, rightSpeed: number) => void
  resetControllerJoint: (jointName: string) => void
  resetControllerPose: () => void
  clearSaveNotice: () => void
}

type ProjectHistorySnapshot = {
  document: ProjectDocument
  robot: RobotModel
  diagnostics: Diagnostic[]
  buffers: UrdfBuffers
  selection: SelectionRef
  controllerState: ControllerState
}

const initialParse = parseUrdf(defaultUrdf)
const emptyRobotModel: RobotModel = {
  name: '',
  links: [],
  joints: [],
  controllers: [],
  sensors: [],
  semantics: {
    robotType: 'custom',
    movableJoints: [],
    wheelJoints: [],
    endEffectors: [],
    sensors: [],
  },
  meshWarnings: [],
}

function uniqueName(base: string, existingNames: string[]) {
  const names = new Set(existingNames)

  if (!names.has(base)) {
    return base
  }

  let index = 1
  let candidate = `${base}_${index}`

  while (names.has(candidate)) {
    index += 1
    candidate = `${base}_${index}`
  }

  return candidate
}

function commitModel(model: RobotModel) {
  const semanticAnalysis = analyzeRobotSemantics(model)
  const modelWithSemantics: RobotModel = {
    ...model,
    controllers: semanticAnalysis.controllers,
    semantics: semanticAnalysis.semantics,
  }
  const xml = exportRobotModelToUrdf(modelWithSemantics)
  return {
    robot: modelWithSemantics,
    diagnostics: validateRobotModel(modelWithSemantics),
    documentXml: xml,
  }
}

function createBuffers(
  xml: string,
  robot: RobotModel | null,
  sceneRenderBuffer: ScenePatch | null = robot
    ? { type: 'replace-model', model: robot, reason: 'document-load', source: 'system' }
    : null,
): UrdfBuffers {
  return {
    editorDraftXml: xml,
    lastValidXml: xml,
    robotModelBuffer: robot,
    sceneRenderBuffer,
  }
}

function markDirtyDocument(document: ProjectDocument, xml: string): ProjectDocument {
  return {
    ...document,
    content: xml,
    xml,
    dirty: true,
    isDirty: true,
  }
}

function cloneHistoryData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function projectHistorySnapshot(
  state: Pick<
    ProjectStore,
    'document' | 'robot' | 'diagnostics' | 'buffers' | 'selection' | 'controllerState'
  >,
): ProjectHistorySnapshot {
  return cloneHistoryData({
    document: state.document,
    robot: state.robot,
    diagnostics: state.diagnostics,
    buffers: state.buffers,
    selection: state.selection,
    controllerState: state.controllerState,
  })
}

function restoreProjectHistorySnapshot(snapshot: ProjectHistorySnapshot) {
  useProjectStore.setState({
    document: cloneHistoryData(snapshot.document),
    robot: cloneHistoryData(snapshot.robot),
    diagnostics: cloneHistoryData(snapshot.diagnostics),
    buffers: cloneHistoryData(snapshot.buffers),
    selection: cloneHistoryData(snapshot.selection),
    controllerState: cloneHistoryData(snapshot.controllerState),
    lastChangeSource: 'system',
  })
}

function projectHistoryLabel(
  source: ChangeSource,
  selection?: SelectionRef,
  sceneRenderBuffer?: ScenePatch,
) {
  if (sceneRenderBuffer?.type === 'update-transform') {
    return `Edit ${sceneRenderBuffer.entityId.replace(/:/g, ' ')}`
  }

  if (selection) {
    return `Edit ${selection.kind} ${selection.id}`
  }

  return source === 'viewport' ? 'Edit viewport transform' : 'Edit URDF model'
}

function pushProjectHistory(
  label: string,
  source: ChangeSource,
  before: ProjectHistorySnapshot,
  after: ProjectHistorySnapshot,
) {
  if (
    source === 'system' ||
    source === 'import' ||
    source === 'editor' ||
    source === 'viewport-gizmo' ||
    useHistoryStore.getState().isApplying ||
    JSON.stringify(before) === JSON.stringify(after)
  ) {
    return
  }

  useHistoryStore.getState().push(
    createHistoryEntry({
      label,
      source: source === 'inspector' ? 'inspector' : source === 'viewport' ? 'viewport' : 'hierarchy',
      undo: () => restoreProjectHistorySnapshot(before),
      redo: () => restoreProjectHistorySnapshot(after),
    }),
  )
}

function hasBlockingParseError(diagnostics: Diagnostic[]) {
  return diagnostics.some(
    (diagnostic) =>
      diagnostic.severity === 'error' &&
      (diagnostic.id.includes('parse') ||
        diagnostic.id.includes('parser') ||
        diagnostic.id === 'missing-robot'),
  )
}

function sameVector(left?: Vector3Tuple, right?: Vector3Tuple) {
  return (
    (left?.x ?? 0) === (right?.x ?? 0) &&
    (left?.y ?? 0) === (right?.y ?? 0) &&
    (left?.z ?? 0) === (right?.z ?? 0)
  )
}

function sameTransform(left?: TransformModel, right?: TransformModel) {
  const identity = identityTransform()
  const resolvedLeft = left ?? identity
  const resolvedRight = right ?? identity

  return (
    sameVector(resolvedLeft.position, resolvedRight.position) &&
    sameVector(resolvedLeft.rotation, resolvedRight.rotation) &&
    sameVector(resolvedLeft.scale, resolvedRight.scale)
  )
}

function scenePatchForModelChange(
  previousModel: RobotModel,
  nextModel: RobotModel,
  source: ChangeSource,
): ScenePatch {
  if (previousModel.name !== nextModel.name) {
    return { type: 'replace-model', model: nextModel, reason: 'robot-root-changed', source }
  }

  const previousLinks = new Map(previousModel.links.map((link) => [link.name, link]))
  const nextLinks = new Map(nextModel.links.map((link) => [link.name, link]))
  const patches: ScenePatch[] = []

  previousLinks.forEach((_, linkId) => {
    if (!nextLinks.has(linkId)) {
      patches.push({ type: 'remove-link', linkId, source })
    }
  })

  nextLinks.forEach((link, linkId) => {
    const previousLink = previousLinks.get(linkId)

    if (!previousLink) {
      patches.push({ type: 'add-link', linkId, source })
      return
    }

    if (!sameTransform(previousLink.transform, link.transform) && link.transform) {
      patches.push({
        type: 'update-transform',
        entityId: `link:${linkId}`,
        transform: link.transform,
        source,
      })
    }

    const previousMesh = previousLink.visual?.geometry?.mesh?.filename
    const nextMesh = link.visual?.geometry?.mesh?.filename

    if (previousMesh !== nextMesh && nextMesh) {
      patches.push({
        type: 'update-mesh',
        entityId: `link:${linkId}:visual`,
        meshPath: nextMesh,
        source,
      })
    }
  })

  if (!patches.length) {
    return { type: 'batch', patches: [], source }
  }

  return { type: 'batch', patches, source }
}

function commitModelToState(
  state: ProjectStore,
  model: RobotModel,
  source: ChangeSource,
  selection?: SelectionRef,
  sceneRenderBuffer?: ScenePatch,
) {
  const before = projectHistorySnapshot(state)
  const committed = commitModel(model)
  const patch =
    sceneRenderBuffer ?? scenePatchForModelChange(state.robot, committed.robot, source)
  const nextState = {
    robot: committed.robot,
    diagnostics: committed.diagnostics,
    document: markDirtyDocument(state.document, committed.documentXml),
    buffers: {
      editorDraftXml: committed.documentXml,
      lastValidXml: committed.documentXml,
      robotModelBuffer: committed.robot,
      sceneRenderBuffer: patch,
    },
    lastChangeSource: source,
    ...(selection ? { selection } : {}),
  }
  const after = projectHistorySnapshot({ ...state, ...nextState })

  pushProjectHistory(projectHistoryLabel(source, selection, patch), source, before, after)

  return nextState
}

function previewModelToState(
  state: ProjectStore,
  model: RobotModel,
  source: ChangeSource,
  sceneRenderBuffer?: ScenePatch,
) {
  const committed = commitModel(model)

  return {
    robot: committed.robot,
    diagnostics: committed.diagnostics,
    document: markDirtyDocument(state.document, committed.documentXml),
    buffers: {
      ...state.buffers,
      editorDraftXml: committed.documentXml,
      robotModelBuffer: committed.robot,
      sceneRenderBuffer:
        sceneRenderBuffer ?? scenePatchForModelChange(state.robot, committed.robot, source),
    },
    lastChangeSource: source,
  }
}

function patchModelDraftToState(
  state: ProjectStore,
  model: RobotModel,
  source: ChangeSource,
  selection?: SelectionRef,
  sceneRenderBuffer?: ScenePatch,
) {
  const committed = commitModel(model)

  return {
    robot: committed.robot,
    diagnostics: committed.diagnostics,
    document: markDirtyDocument(state.document, committed.documentXml),
    buffers: {
      ...state.buffers,
      editorDraftXml: committed.documentXml,
      robotModelBuffer: committed.robot,
      sceneRenderBuffer:
        sceneRenderBuffer ?? scenePatchForModelChange(state.robot, committed.robot, source),
    },
    lastChangeSource: source,
    ...(selection ? { selection } : {}),
  }
}

function getPayloadXml(payload: LoadDocumentPayload) {
  return payload.xml ?? payload.content ?? ''
}

function createDocumentFromPayload(
  payload: LoadDocumentPayload,
  recentFiles: string[],
): ProjectDocument {
  const xml = getPayloadXml(payload)
  const dirty = payload.dirty ?? false

  return {
    fileName: payload.fileName,
    filePath: payload.filePath,
    projectDir: payload.projectDir,
    content: xml,
    xml,
    dirty,
    isDirty: dirty,
    isUntitled: !payload.filePath,
    openedAt: Date.now(),
    recentFiles,
  }
}

function defaultVector(): Vector3Tuple {
  return { x: 0, y: 0, z: 0 }
}

function transformToPose(transform: TransformModel) {
  return {
    xyz: transform.position,
    rpy: transform.rotation,
  }
}

function applyRobotTransform(model: RobotModel, transform: TransformModel): RobotModel {
  return {
    ...model,
    rootTransform: transform,
  }
}

function geometryEntityId(linkName: string, role: MeshRole) {
  return `mesh:${linkName}:${role}`
}

function applyLinkTransform(model: RobotModel, linkName: string, transform: TransformModel): RobotModel {
  const incomingJoint = model.joints.find((joint) => joint.child === linkName)

  return {
    ...model,
    links: model.links.map((link) => {
      if (link.name !== linkName) {
        return link
      }

      return {
        ...link,
        transform,
        visual: link.visual?.geometry?.mesh
          ? {
              ...link.visual,
              geometry: {
                ...link.visual.geometry,
                mesh: {
                  ...link.visual.geometry.mesh,
                  scale: transform.scale,
                },
              },
            }
          : link.visual,
        collision: link.collision?.geometry?.mesh
          ? {
              ...link.collision,
              geometry: {
                ...link.collision.geometry,
                mesh: {
                  ...link.collision.geometry.mesh,
                  scale: transform.scale,
                },
              },
            }
          : link.collision,
      }
    }),
    joints: model.joints.map((joint) =>
      incomingJoint && joint.name === incomingJoint.name
        ? {
            ...joint,
            origin: transformToPose(transform),
          }
        : joint,
    ),
  }
}

function applyLinkGeometryTransform(
  model: RobotModel,
  linkName: string,
  role: MeshRole,
  transform: TransformModel,
): RobotModel {
  return {
    ...model,
    links: model.links.map((link) => {
      if (link.name !== linkName) {
        return link
      }

      if (role === 'visual') {
        const mesh = link.visual?.geometry?.mesh

        return {
          ...link,
          visual: {
            ...link.visual,
            origin: transformToPose(transform),
            geometry: mesh
              ? {
                  ...link.visual?.geometry,
                  mesh: {
                    ...mesh,
                    scale: transform.scale,
                  },
                }
              : link.visual?.geometry,
          },
        }
      }

      const mesh = link.collision?.geometry?.mesh

      return {
        ...link,
        collision: {
          ...link.collision,
          origin: transformToPose(transform),
          geometry: mesh
            ? {
                ...link.collision?.geometry,
                mesh: {
                  ...mesh,
                  scale: transform.scale,
                },
              }
            : link.collision?.geometry,
        },
      }
    }),
  }
}

function isRobotModelSnapshot(value: unknown): value is RobotModel {
  return Boolean(
    value &&
      typeof value === 'object' &&
      Array.isArray((value as RobotModel).links) &&
      Array.isArray((value as RobotModel).joints) &&
      Array.isArray((value as RobotModel).controllers) &&
      Array.isArray((value as RobotModel).sensors),
  )
}

function restoreSelection(
  robot: RobotModel,
  kind?: string | null,
  id?: string | null,
): SelectionRef {
  if (kind === 'robot') {
    return { kind: 'robot', id: robot.name }
  }

  if (kind === 'link' && id && robot.links.some((link) => link.name === id)) {
    return { kind: 'link', id }
  }

  if (kind === 'joint' && id && robot.joints.some((joint) => joint.name === id)) {
    return { kind: 'joint', id }
  }

  if (kind === 'mesh' && id) {
    const meshRef = parseMeshSelectionId(id)
    const link = meshRef ? robot.links.find((item) => item.name === meshRef.linkName) : undefined
    const mesh =
      meshRef?.role === 'visual'
        ? link?.visual?.geometry?.mesh
        : link?.collision?.geometry?.mesh

    if (mesh) {
      return { kind: 'mesh', id }
    }
  }

  if (kind === 'sensor' && id && robot.sensors.some((sensor) => sensor.name === id)) {
    return { kind: 'sensor', id }
  }

  return robot.links[0]
    ? { kind: 'link', id: robot.links[0].name }
    : { kind: 'robot', id: robot.name }
}

function defaultControllerState(): ControllerState {
  return {
    activeType: 'basic-joint',
    isRunning: false,
    jointValues: {},
    wheelSpeeds: {
      left: 0,
      right: 0,
    },
    speedMultiplier: 1,
    validation: {
      canRun: false,
      reason: 'Controller has not been validated yet.',
      requirements: [],
      detected: [],
    },
    linearVelocity: 0,
    angularVelocity: 0,
  }
}

function isControllerState(value: unknown): value is ControllerState {
  return Boolean(value && typeof value === 'object' && typeof (value as ControllerState).jointValues === 'object')
}

function normalizeControllerState(value: unknown): ControllerState {
  if (!isControllerState(value)) {
    return defaultControllerState()
  }

  const fallback = defaultControllerState()
  const state = value as Partial<ControllerState>
  const activeType =
    state.activeType === 'basic-joint' ||
    state.activeType === 'differential-drive' ||
    state.activeType === 'combined'
      ? state.activeType
      : fallback.activeType
  const wheelSpeeds =
    state.wheelSpeeds &&
    typeof state.wheelSpeeds.left === 'number' &&
    typeof state.wheelSpeeds.right === 'number'
      ? state.wheelSpeeds
      : {
          left: typeof state.linearVelocity === 'number' ? state.linearVelocity : 0,
          right: typeof state.angularVelocity === 'number' ? state.angularVelocity : 0,
        }

  return {
    activeType,
    isRunning: Boolean(state.isRunning),
    jointValues: state.jointValues ?? {},
    wheelSpeeds,
    speedMultiplier:
      typeof state.speedMultiplier === 'number' && Number.isFinite(state.speedMultiplier)
        ? state.speedMultiplier
        : fallback.speedMultiplier,
    validation: state.validation ?? fallback.validation,
    linearVelocity: typeof state.linearVelocity === 'number' ? state.linearVelocity : (wheelSpeeds.left + wheelSpeeds.right) / 2,
    angularVelocity: typeof state.angularVelocity === 'number' ? state.angularVelocity : (wheelSpeeds.right - wheelSpeeds.left) / 2,
  }
}

function isDefaultUntitledDocument(document: ProjectDocument) {
  return (
    document.isUntitled &&
    !document.filePath &&
    !document.dirty &&
    !document.isDirty &&
    document.xml === defaultUrdf
  )
}

function shouldBlockUnsafeSessionRestore(state: ProjectStore) {
  return state.initialized && state.appView !== 'dashboard' && !isDefaultUntitledDocument(state.document)
}

function shouldBlockDashboardRedirect(state: ProjectStore, reason?: string) {
  if (reason === 'user') {
    return false
  }

  if (state.appView === 'dashboard') {
    return false
  }

  return Boolean(state.document.filePath || state.document.xml.trim() || state.document.content.trim())
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  appView: 'dashboard',
  pendingWorkspaceSession: null,
  document: {
    fileName: DEFAULT_URDF_FILENAME,
    filePath: null,
    projectDir: null,
    content: defaultUrdf,
    xml: defaultUrdf,
    dirty: false,
    isDirty: false,
    isUntitled: true,
    openedAt: Date.now(),
    recentFiles: [],
  },
  robot: initialParse.model,
  diagnostics: initialParse.diagnostics,
  buffers: createBuffers(defaultUrdf, initialParse.model, {
    type: 'replace-model',
    model: initialParse.model,
    reason: 'cold-start-default',
    source: 'system',
  }),
  lastChangeSource: 'system',
  selection: { kind: 'link', id: 'base_link' },
  initialized: false,
  sessionReady: false,
  cameraMode: 'perspective',
  viewPreset: 'perspective',
  projectFiles: [],
  projectRoot: null,
  controllerState: defaultControllerState(),
  saveNotice: null,

  markSessionReady: () => set({ initialized: true, sessionReady: true }),
  setPendingWorkspaceSession: (pendingWorkspaceSession) => set({ pendingWorkspaceSession }),
  showDashboard: (reason = 'system') =>
    set((state) => {
      if (shouldBlockDashboardRedirect(state, reason)) {
        console.warn('Blocked dashboard redirect while a document is active:', reason)
        return {
          initialized: true,
          sessionReady: true,
        }
      }

      return { appView: 'dashboard', initialized: true, sessionReady: true }
    }),
  enterWorkspace: () => set({ appView: 'workspace', initialized: true, sessionReady: true }),
  restorePendingWorkspaceSession: () => {
    const session = get().pendingWorkspaceSession

    if (session) {
      get().restoreWorkspaceSession(session)
    }
  },

  restoreWorkspaceSession: (session) => {
    if (shouldBlockUnsafeSessionRestore(get())) {
      console.warn('Blocked unsafe workspace session restore because an active document is already loaded.')
      set({ initialized: true, sessionReady: true })
      return
    }

    const xml = session.documentContent || defaultUrdf
    const parsed = parseUrdf(xml)
    const hasParseError = parsed.diagnostics.some(
      (diagnostic) => diagnostic.severity === 'error' && diagnostic.id.includes('parse'),
    )
    const robot = hasParseError && isRobotModelSnapshot(session.robotModelSnapshot)
      ? session.robotModelSnapshot
      : parsed.model
    const dirty = Boolean(session.isDirty)
    const filePath = session.activeFilePath ?? null
    const fileName = session.activeFileName || DEFAULT_URDF_FILENAME

    set({
      document: {
        fileName,
        filePath,
        projectDir: session.projectDir ?? null,
        content: xml,
        xml,
        dirty,
        isDirty: dirty,
        isUntitled: session.isUntitled || !filePath,
        openedAt: Date.now(),
        recentFiles: get().document.recentFiles,
      },
      robot,
      diagnostics: parsed.diagnostics,
      buffers: createBuffers(xml, robot, {
        type: 'replace-model',
        model: robot,
        reason: 'session-restore',
        source: 'system',
      }),
      lastChangeSource: 'system',
      selection: restoreSelection(robot, session.selectedObjectKind, session.selectedObjectId),
      cameraMode: session.cameraMode === 'orthographic' ? 'orthographic' : 'perspective',
      viewPreset:
        session.viewPreset === 'front' ||
        session.viewPreset === 'back' ||
        session.viewPreset === 'left' ||
        session.viewPreset === 'right' ||
        session.viewPreset === 'top' ||
        session.viewPreset === 'bottom' ||
        session.viewPreset === 'perspective'
          ? session.viewPreset
          : 'perspective',
      projectRoot: session.projectRoot ?? null,
      projectFiles: Array.isArray(session.projectFiles) ? session.projectFiles : [],
      controllerState: normalizeControllerState(session.controllerState),
      initialized: true,
      sessionReady: true,
      appView: 'workspace',
      pendingWorkspaceSession: null,
    })
  },

  newDocument: () => {
    const parsed = parseUrdf(defaultUrdf)
    set({
      document: {
        ...get().document,
        fileName: DEFAULT_URDF_FILENAME,
        filePath: null,
        projectDir: null,
        content: defaultUrdf,
        xml: defaultUrdf,
        dirty: false,
        isDirty: false,
        isUntitled: true,
        openedAt: Date.now(),
      },
      robot: parsed.model,
      diagnostics: parsed.diagnostics,
      buffers: createBuffers(defaultUrdf, parsed.model, {
        type: 'replace-model',
        model: parsed.model,
        reason: 'new-document',
        source: 'system',
      }),
      lastChangeSource: 'system',
      selection: { kind: 'link', id: 'base_link' },
      projectFiles: [],
      projectRoot: null,
      controllerState: defaultControllerState(),
      saveNotice: null,
      initialized: true,
      sessionReady: true,
      appView: 'workspace',
      pendingWorkspaceSession: null,
    })
  },

  resetWorkspaceForNewDocument: () =>
    set((state) => ({
      document: {
        ...state.document,
        fileName: '',
        filePath: null,
        projectDir: null,
        content: '',
        xml: '',
        dirty: false,
        isDirty: false,
        isUntitled: false,
        openedAt: Date.now(),
      },
      robot: emptyRobotModel,
      diagnostics: [],
      buffers: createBuffers('', emptyRobotModel, {
        type: 'replace-model',
        model: emptyRobotModel,
        reason: 'workspace-reset-for-open',
        source: 'system',
      }),
      lastChangeSource: 'system',
      selection: { kind: 'robot', id: '' },
      projectFiles: [],
      projectRoot: null,
      controllerState: defaultControllerState(),
      saveNotice: null,
      initialized: true,
      sessionReady: true,
      appView: 'workspace',
    })),

  openExistingDocument: (payload) => {
    const xml = getPayloadXml(payload)
    const parsed = parseUrdf(xml)
    set((state) => ({
      document: createDocumentFromPayload(payload, payload.recentFiles ?? state.document.recentFiles),
      robot: parsed.model,
      diagnostics: [...parsed.diagnostics, ...(payload.resourceDiagnostics ?? [])],
      buffers: createBuffers(xml, parsed.model, {
        type: 'replace-model',
        model: parsed.model,
        reason: 'open-existing-document',
        source: 'import',
      }),
      lastChangeSource: 'import',
      selection: parsed.model.links[0]
        ? { kind: 'link', id: parsed.model.links[0].name }
        : { kind: 'robot', id: parsed.model.name },
      projectFiles: payload.projectFiles ?? [],
      projectRoot: payload.projectRoot ?? null,
      controllerState: defaultControllerState(),
      saveNotice: null,
      initialized: true,
      sessionReady: true,
      appView: 'workspace',
      pendingWorkspaceSession: null,
    }))
  },

  loadDocument: (payload) => {
    get().resetWorkspaceForNewDocument()
    get().openExistingDocument(payload)
  },

  markSaved: (payload) => {
    const xml = getPayloadXml(payload)
    const parsed = parseUrdf(xml)
    set((state) => ({
      document: {
        fileName: payload.fileName,
        filePath: payload.filePath,
        projectDir: payload.projectDir,
        content: xml,
        xml,
        dirty: false,
        isDirty: false,
        isUntitled: false,
        openedAt: state.document.openedAt,
        recentFiles: payload.recentFiles ?? state.document.recentFiles,
      },
      robot: hasBlockingParseError(parsed.diagnostics) ? state.robot : parsed.model,
      diagnostics: parsed.diagnostics,
      buffers: hasBlockingParseError(parsed.diagnostics)
        ? {
            ...state.buffers,
            editorDraftXml: xml,
          }
        : createBuffers(xml, parsed.model, {
            type: 'replace-model',
            model: parsed.model,
            reason: 'mark-saved',
            source: 'system',
          }),
      lastChangeSource: 'system',
      saveNotice: {
        message: `Saved ${payload.fileName}`,
        fileName: payload.fileName,
        savedAt: Date.now(),
      },
      initialized: true,
      sessionReady: true,
      appView: 'workspace',
    }))
  },

  setXml: (xml) => get().setEditorDraftXml(xml, 'editor'),

  setEditorDraftXml: (xml, source = 'editor') =>
    set((state) => ({
      document: markDirtyDocument(state.document, xml),
      buffers: {
        ...state.buffers,
        editorDraftXml: xml,
      },
      lastChangeSource: source,
      saveNotice: null,
      initialized: true,
      sessionReady: true,
    })),

  parseEditorDraft: () => {
    const state = get()
    const xml = state.buffers.editorDraftXml

    if (xml === state.buffers.lastValidXml) {
      return
    }

    const parsed = parseUrdf(xml)
    const shouldKeepRobot = hasBlockingParseError(parsed.diagnostics)

    if (shouldKeepRobot) {
      set({
        diagnostics: parsed.diagnostics,
        buffers: {
          ...state.buffers,
          editorDraftXml: xml,
        },
        lastChangeSource: 'editor',
        initialized: true,
        sessionReady: true,
      })
      return
    }

    const selection = restoreSelection(parsed.model, state.selection.kind, state.selection.id)
    const sceneRenderBuffer = scenePatchForModelChange(state.robot, parsed.model, 'editor')

    set({
      robot: parsed.model,
      diagnostics: parsed.diagnostics,
      buffers: {
        editorDraftXml: xml,
        lastValidXml: xml,
        robotModelBuffer: parsed.model,
        sceneRenderBuffer,
      },
      lastChangeSource: 'editor',
      selection,
      initialized: true,
      sessionReady: true,
    })
  },

  select: (selection) => set({ selection }),
  setCameraMode: (cameraMode) => set({ cameraMode }),
  setViewPreset: (viewPreset) =>
    set({
      viewPreset,
      cameraMode: viewPreset === 'perspective' ? 'perspective' : 'orthographic',
    }),
  setProjectFiles: (projectRoot, projectFiles) => set({ projectRoot, projectFiles }),
  setRecentFiles: (recentFiles) =>
    set((state) => ({
      document: { ...state.document, recentFiles },
    })),

  renameRobot: (name) =>
    set((state) => {
      const model = { ...state.robot, name: name.trim() || state.robot.name }
      return commitModelToState(state, model, 'inspector', { kind: 'robot', id: model.name })
    }),

  previewRobotTransform: (transform, source = 'viewport') =>
    set((state) => {
      const model = applyRobotTransform(state.robot, transform)

      return previewModelToState(state, model, source, {
        type: 'update-transform',
        entityId: `robot:${state.robot.name}`,
        transform,
        source,
      })
    }),

  updateRobotTransform: (transform, source = 'inspector') =>
    set((state) => {
      const model = applyRobotTransform(state.robot, transform)

      return commitModelToState(
        state,
        model,
        source,
        { kind: 'robot', id: model.name },
        {
          type: 'update-transform',
          entityId: `robot:${model.name}`,
          transform,
          source,
        },
      )
    }),

  renameLink: (currentName, nextName) =>
    set((state) => {
      const cleanName = nextName.trim()

      if (!cleanName || cleanName === currentName) {
        return state
      }

      const model: RobotModel = {
        ...state.robot,
        links: state.robot.links.map((link) =>
          link.name === currentName ? { ...link, name: cleanName } : link,
        ),
        joints: state.robot.joints.map((joint) => ({
          ...joint,
          parent: joint.parent === currentName ? cleanName : joint.parent,
          child: joint.child === currentName ? cleanName : joint.child,
        })),
        sensors: state.robot.sensors.map((sensor) => ({
          ...sensor,
          attachedTo: sensor.attachedTo === currentName ? cleanName : sensor.attachedTo,
        })),
      }
      return commitModelToState(state, model, 'inspector', { kind: 'link', id: cleanName })
    }),

  updateLinkMesh: (linkName, role, filename) =>
    set((state) => {
      const model: RobotModel = {
        ...state.robot,
        links: state.robot.links.map((link): RobotLinkModel => {
          if (link.name !== linkName) {
            return link
          }

          const geometry = filename
            ? { geometry: { mesh: { filename, scale: { x: 1, y: 1, z: 1 } } } }
            : { geometry: undefined }

          if (role === 'visual') {
            return { ...link, visual: { ...link.visual, ...geometry } }
          }

          return { ...link, collision: { ...link.collision, ...geometry } }
        }),
      }
      return commitModelToState(state, model, 'inspector')
    }),

  previewLinkGeometryTransform: (linkName, role, transform, source = 'viewport') =>
    set((state) => {
      const model = applyLinkGeometryTransform(state.robot, linkName, role, transform)

      return previewModelToState(state, model, source, {
        type: 'update-transform',
        entityId: geometryEntityId(linkName, role),
        transform,
        source,
      })
    }),

  updateLinkGeometryTransform: (linkName, role, transform, source = 'inspector') =>
    set((state) => {
      const model = applyLinkGeometryTransform(state.robot, linkName, role, transform)

      return commitModelToState(
        state,
        model,
        source,
        { kind: 'mesh', id: geometryEntityId(linkName, role) },
        {
          type: 'update-transform',
          entityId: geometryEntityId(linkName, role),
          transform,
          source,
        },
      )
    }),

  patchLinkGeometryOriginField: (linkName, role, field, value, source = 'viewport-gizmo') =>
    set((state) => {
      const model: RobotModel = {
        ...state.robot,
        links: state.robot.links.map((link) => {
          if (link.name !== linkName) {
            return link
          }

          const current = role === 'visual' ? link.visual : link.collision
          const origin = current?.origin ?? { xyz: defaultVector(), rpy: defaultVector() }
          const nextOrigin = {
            xyz: field === 'xyz' ? value : origin.xyz,
            rpy: field === 'rpy' ? value : origin.rpy,
          }

          if (role === 'visual') {
            return {
              ...link,
              visual: {
                ...link.visual,
                origin: nextOrigin,
              },
            }
          }

          return {
            ...link,
            collision: {
              ...link.collision,
              origin: nextOrigin,
            },
          }
        }),
      }
      const transform = {
        position: field === 'xyz' ? value : defaultVector(),
        rotation: field === 'rpy' ? value : defaultVector(),
        scale: { x: 1, y: 1, z: 1 },
      }

      return patchModelDraftToState(
        state,
        model,
        source,
        source === 'viewport-gizmo' ? undefined : { kind: 'mesh', id: geometryEntityId(linkName, role) },
        {
          type: 'update-transform',
          entityId: geometryEntityId(linkName, role),
          transform,
          source,
        },
      )
    }),

  patchLinkGeometryScale: (linkName, role, scale, source = 'viewport-gizmo') =>
    set((state) => {
      const model: RobotModel = {
        ...state.robot,
        links: state.robot.links.map((link) => {
          if (link.name !== linkName) {
            return link
          }

          if (role === 'visual') {
            const mesh = link.visual?.geometry?.mesh

            return {
              ...link,
              visual: {
                ...link.visual,
                geometry: mesh
                  ? {
                      ...link.visual?.geometry,
                      mesh: {
                        ...mesh,
                        scale,
                      },
                    }
                  : link.visual?.geometry,
              },
            }
          }

          const mesh = link.collision?.geometry?.mesh

          return {
            ...link,
            collision: {
              ...link.collision,
              geometry: mesh
                ? {
                    ...link.collision?.geometry,
                    mesh: {
                      ...mesh,
                      scale,
                    },
                  }
                : link.collision?.geometry,
            },
          }
        }),
      }

      return patchModelDraftToState(
        state,
        model,
        source,
        source === 'viewport-gizmo' ? undefined : { kind: 'mesh', id: geometryEntityId(linkName, role) },
      )
    }),

  previewLinkTransform: (linkName, transform, source = 'viewport') =>
    set((state) => {
      const model = applyLinkTransform(state.robot, linkName, transform)

      return previewModelToState(state, model, source, {
        type: 'update-transform',
        entityId: `link:${linkName}`,
        transform,
        source,
      })
    }),

  updateLinkTransform: (linkName, transform, source = 'inspector') =>
    set((state) => {
      const model = applyLinkTransform(state.robot, linkName, transform)

      return commitModelToState(state, model, source, undefined, {
        type: 'update-transform',
        entityId: `link:${linkName}`,
        transform,
        source,
      })
    }),

  patchJointOriginField: (jointName, field, value, source = 'viewport-gizmo') =>
    set((state) => {
      const model: RobotModel = {
        ...state.robot,
        joints: state.robot.joints.map((joint) =>
          joint.name === jointName
            ? {
                ...joint,
                origin: {
                  xyz: field === 'xyz' ? value : joint.origin.xyz,
                  rpy: field === 'rpy' ? value : joint.origin.rpy,
                },
              }
            : joint,
        ),
        links: state.robot.links.map((link) => {
          const incomingJoint = state.robot.joints.find(
            (joint) => joint.name === jointName && joint.child === link.name,
          )

          if (!incomingJoint) {
            return link
          }

          return {
            ...link,
            transform: {
              ...(link.transform ?? identityTransform()),
              position: field === 'xyz' ? value : (link.transform?.position ?? incomingJoint.origin.xyz),
              rotation: field === 'rpy' ? value : (link.transform?.rotation ?? incomingJoint.origin.rpy),
            },
          }
        }),
      }
      const nextJoint = model.joints.find((joint) => joint.name === jointName)
      const transform = {
        position: nextJoint?.origin.xyz ?? defaultVector(),
        rotation: nextJoint?.origin.rpy ?? defaultVector(),
        scale: { x: 1, y: 1, z: 1 },
      }

      return patchModelDraftToState(
        state,
        model,
        source,
        source === 'viewport-gizmo' ? undefined : { kind: 'joint', id: jointName },
        {
          type: 'update-transform',
          entityId: `joint:${jointName}`,
          transform,
          source,
        },
      )
    }),

  resetLinkTransform: (linkName) =>
    set((state) => {
      const model = applyLinkTransform(state.robot, linkName, identityTransform())
      return commitModelToState(state, model, 'inspector')
    }),

  previewJoint: (jointName, patch, source = 'viewport') =>
    set((state) => {
      const model: RobotModel = {
        ...state.robot,
        joints: state.robot.joints.map((joint) =>
          joint.name === jointName ? { ...joint, ...patch } : joint,
        ),
      }
      const nextJoint = model.joints.find((joint) => joint.name === (patch.name ?? jointName))
      const sceneRenderBuffer = nextJoint?.origin
        ? {
            type: 'update-transform' as const,
            entityId: `joint:${nextJoint.name}`,
            transform: {
              position: nextJoint.origin.xyz,
              rotation: nextJoint.origin.rpy,
              scale: { x: 1, y: 1, z: 1 },
            },
            source,
          }
        : undefined

      return previewModelToState(state, model, source, sceneRenderBuffer)
    }),

  updateJoint: (jointName, patch, source = 'inspector') =>
    set((state) => {
      const model: RobotModel = {
        ...state.robot,
        joints: state.robot.joints.map((joint) =>
          joint.name === jointName ? { ...joint, ...patch } : joint,
        ),
      }
      const nextName = patch.name ?? jointName

      return commitModelToState(state, model, source, { kind: 'joint', id: nextName })
    }),

  addLink: () =>
    set((state) => {
      const name = uniqueName(
        `link_${state.robot.links.length + 1}`,
        state.robot.links.map((link) => link.name),
      )
      const model = {
        ...state.robot,
        links: [...state.robot.links, { name, transform: identityTransform() }],
      }
      return commitModelToState(state, model, 'inspector', { kind: 'link', id: name })
    }),

  addChildLink: (parentName, type = 'fixed') =>
    set((state) => {
      const childName = uniqueName(
        `${parentName}_child`,
        state.robot.links.map((link) => link.name),
      )
      const jointName = uniqueName(
        `${type}_${parentName}_${childName}`,
        state.robot.joints.map((joint) => joint.name),
      )
      const childTransform: TransformModel = {
        position: { x: 0, y: 0, z: 0.25 },
        rotation: defaultVector(),
        scale: { x: 1, y: 1, z: 1 },
      }
      const model: RobotModel = {
        ...state.robot,
        links: [...state.robot.links, { name: childName, transform: childTransform }],
        joints: [
          ...state.robot.joints,
          {
            name: jointName,
            type,
            parent: parentName,
            child: childName,
            origin: transformToPose(childTransform),
            axis: { x: 1, y: 0, z: 0 },
          },
        ],
      }
      return commitModelToState(state, model, 'inspector', { kind: 'link', id: childName })
    }),

  duplicateLink: (linkName) =>
    set((state) => {
      const link = state.robot.links.find((item) => item.name === linkName)

      if (!link) {
        return state
      }

      const name = uniqueName(
        `${link.name}_copy`,
        state.robot.links.map((item) => item.name),
      )
      const baseTransform = link.transform ?? identityTransform()
      const transform: TransformModel = {
        position: {
          ...baseTransform.position,
          x: baseTransform.position.x + 0.2,
        },
        rotation: baseTransform.rotation,
        scale: baseTransform.scale,
      }
      const model: RobotModel = {
        ...state.robot,
        links: [...state.robot.links, { ...link, name, transform }],
      }
      return commitModelToState(state, model, 'inspector', { kind: 'link', id: name })
    }),

  deleteSelection: () =>
    set((state) => {
      if (state.selection.kind === 'link') {
        const linkName = state.selection.id
        const model: RobotModel = {
          ...state.robot,
          links: state.robot.links.filter((link) => link.name !== linkName),
          joints: state.robot.joints.filter(
            (joint) => joint.parent !== linkName && joint.child !== linkName,
          ),
          sensors: state.robot.sensors.filter((sensor) => sensor.attachedTo !== linkName),
        }
        return commitModelToState(
          state,
          model,
          'inspector',
          model.links[0]
            ? { kind: 'link', id: model.links[0].name }
            : { kind: 'robot', id: model.name },
        )
      }

      if (state.selection.kind === 'joint') {
        const model: RobotModel = {
          ...state.robot,
          joints: state.robot.joints.filter((joint) => joint.name !== state.selection.id),
        }
        return commitModelToState(state, model, 'inspector', { kind: 'robot', id: model.name })
      }

      if (state.selection.kind === 'sensor') {
        const model: RobotModel = {
          ...state.robot,
          sensors: state.robot.sensors.filter((sensor) => sensor.name !== state.selection.id),
        }
        return commitModelToState(state, model, 'inspector', { kind: 'robot', id: model.name })
      }

      return state
    }),

  addJoint: (type = 'fixed', parentName, childName) =>
    set((state) => {
      const parent = parentName ?? state.robot.links[0]?.name ?? 'base_link'
      const child = childName ?? state.robot.links.at(-1)?.name ?? parent
      const name = uniqueName(
        `${type}_joint_${state.robot.joints.length + 1}`,
        state.robot.joints.map((joint) => joint.name),
      )
      const model: RobotModel = {
        ...state.robot,
        joints: [
          ...state.robot.joints,
          {
            name,
            type,
            parent,
            child,
            origin: {
              xyz: { x: 0, y: 0, z: 0.1 },
              rpy: defaultVector(),
            },
            axis: { x: 1, y: 0, z: 0 },
          },
        ],
      }
      return commitModelToState(state, model, 'inspector', { kind: 'joint', id: name })
    }),

  addSensor: (type = 'camera') =>
    set((state) => {
      const selectedLink =
        state.selection.kind === 'link' &&
        state.robot.links.some((link) => link.name === state.selection.id)
          ? state.selection.id
          : undefined
      const attachedTo = selectedLink ?? state.robot.links[0]?.name ?? 'base_link'
      const name = uniqueName(
        `${type}_sensor_${state.robot.sensors.length + 1}`,
        state.robot.sensors.map((sensor) => sensor.name),
      )
      const model: RobotModel = {
        ...state.robot,
        sensors: [
          ...state.robot.sensors,
          {
            name,
            type,
            attachedTo,
            origin: {
              xyz: defaultVector(),
              rpy: defaultVector(),
            },
          },
        ],
      }
      return commitModelToState(state, model, 'inspector', { kind: 'sensor', id: name })
    }),

  setJointControllerValue: (jointName, value) =>
    set((state) => {
      if (!jointName) {
        return {}
      }

      return {
        controllerState: {
          ...state.controllerState,
          jointValues: {
            ...state.controllerState.jointValues,
            [jointName]: Number.isFinite(value) ? value : 0,
          },
        },
      }
    }),

  setControllerType: (activeType) =>
    set((state) => {
      const nextType =
        activeType === 'basic-joint' ||
        activeType === 'differential-drive' ||
        activeType === 'combined'
          ? activeType
          : 'basic-joint'

      return {
        controllerState: {
          ...state.controllerState,
          activeType: nextType,
          isRunning: false,
          wheelSpeeds: {
            left: 0,
            right: 0,
          },
          linearVelocity: 0,
          angularVelocity: 0,
        },
      }
    }),

  setControllerValidation: (validation) =>
    set((state) => ({
      controllerState: {
        ...state.controllerState,
        validation,
      },
    })),

  setControllerRunning: (isRunning) =>
    set((state) => ({
      controllerState: {
        ...state.controllerState,
        isRunning,
      },
    })),

  setControllerSpeedMultiplier: (speedMultiplier) =>
    set((state) => ({
      controllerState: {
        ...state.controllerState,
        speedMultiplier: Math.min(4, Math.max(0.1, Number.isFinite(speedMultiplier) ? speedMultiplier : 1)),
      },
    })),

  setDriveCommand: (leftSpeed, rightSpeed) =>
    set((state) => {
      const left = Math.min(1, Math.max(-1, Number.isFinite(leftSpeed) ? leftSpeed : 0))
      const right = Math.min(1, Math.max(-1, Number.isFinite(rightSpeed) ? rightSpeed : 0))

      return {
        controllerState: {
          ...state.controllerState,
          isRunning: Math.abs(left) > 0.001 || Math.abs(right) > 0.001,
          wheelSpeeds: {
            left,
            right,
          },
          linearVelocity: (left + right) / 2,
          angularVelocity: (right - left) / 2,
        },
      }
    }),

  resetControllerJoint: (jointName) =>
    set((state) => {
      const jointValues = { ...state.controllerState.jointValues }

      delete jointValues[jointName]

      return {
        controllerState: {
          ...state.controllerState,
          jointValues,
        },
      }
    }),

  resetControllerPose: () =>
    set((state) => ({
      controllerState: {
        ...state.controllerState,
        isRunning: false,
        jointValues: {},
        wheelSpeeds: {
          left: 0,
          right: 0,
        },
        linearVelocity: 0,
        angularVelocity: 0,
      },
    })),

  clearSaveNotice: () => set({ saveNotice: null }),
}))
