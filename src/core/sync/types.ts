import type { RobotModel, TransformModel } from '../robot-model/types'

export const EDITOR_PARSE_DEBOUNCE_MS = 250
export const XML_PATCH_THROTTLE_MS = 50

export type ChangeSource =
  | 'editor'
  | 'viewport'
  | 'viewport-gizmo'
  | 'inspector'
  | 'import'
  | 'system'

export type ScenePatch =
  | { type: 'replace-model'; model: RobotModel; reason: string; source: ChangeSource }
  | { type: 'add-link'; linkId: string; source: ChangeSource }
  | { type: 'remove-link'; linkId: string; source: ChangeSource }
  | {
      type: 'update-transform'
      entityId: string
      transform: TransformModel
      source: ChangeSource
    }
  | { type: 'update-mesh'; entityId: string; meshPath: string; source: ChangeSource }
  | { type: 'batch'; patches: ScenePatch[]; source: ChangeSource }

export interface UrdfBuffers {
  editorDraftXml: string
  lastValidXml: string
  robotModelBuffer: RobotModel | null
  sceneRenderBuffer: ScenePatch | null
}
