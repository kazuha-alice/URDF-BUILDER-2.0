import {
  Gamepad2,
  Gauge,
  Home,
  Info,
  RotateCcw,
  SlidersHorizontal,
  Square,
  Waypoints,
} from 'lucide-react'
import { useEffect, useMemo } from 'react'
import {
  type ControllerType,
  clampJointValue,
  detectDifferentialWheelGroups,
  driveModeLabel,
  getControllableJoints,
  getJointControlRange,
  getWheelJointNames,
  validateBasicJointController,
  validateController,
  validateDifferentialController,
} from '../../core/controllers/previewController'
import type { RobotJointModel } from '../../core/robot-model/types'
import { useProjectStore } from '../../store/useProjectStore'

const controllerLabels: Record<ControllerType, string> = {
  'basic-joint': 'Basic Joint Controller',
  'differential-drive': 'Differential Drive',
  combined: 'Combined Controller',
}

function formatNumber(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : '0.00'
}

function formatJointValue(joint: RobotJointModel, value: number) {
  if (joint.type === 'prismatic') {
    return `${formatNumber(value)} m`
  }

  return `${formatNumber((value * 180) / Math.PI)} deg`
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  )
}

export function ControllerPanel() {
  const robot = useProjectStore((state) => state.robot)
  const controllerState = useProjectStore((state) => state.controllerState)
  const setJointControllerValue = useProjectStore((state) => state.setJointControllerValue)
  const setControllerType = useProjectStore((state) => state.setControllerType)
  const setControllerValidation = useProjectStore((state) => state.setControllerValidation)
  const setControllerSpeedMultiplier = useProjectStore(
    (state) => state.setControllerSpeedMultiplier,
  )
  const setDriveCommand = useProjectStore((state) => state.setDriveCommand)
  const resetControllerJoint = useProjectStore((state) => state.resetControllerJoint)
  const resetControllerPose = useProjectStore((state) => state.resetControllerPose)

  const movableJoints = useMemo(() => getControllableJoints(robot), [robot])
  const wheelGroups = useMemo(() => detectDifferentialWheelGroups(robot), [robot])
  const wheelJointNames = useMemo(() => getWheelJointNames(robot), [robot])
  const wheelJointSet = useMemo(() => new Set(wheelJointNames), [wheelJointNames])
  const jointRows = useMemo(
    () =>
      controllerState.activeType === 'combined'
        ? movableJoints.filter((joint) => !wheelJointSet.has(joint.name))
        : movableJoints,
    [controllerState.activeType, movableJoints, wheelJointSet],
  )
  const activeValidation = useMemo(
    () => validateController(robot, controllerState.activeType),
    [controllerState.activeType, robot],
  )
  const basicValidation = useMemo(() => validateBasicJointController(robot), [robot])
  const driveValidation = useMemo(() => validateDifferentialController(robot), [robot])
  const showJointController =
    controllerState.activeType === 'basic-joint' || controllerState.activeType === 'combined'
  const showDriveController =
    controllerState.activeType === 'differential-drive' || controllerState.activeType === 'combined'
  const oneWheelPreview = wheelJointNames.length === 1
  const leftSpeed = controllerState.wheelSpeeds.left
  const rightSpeed = oneWheelPreview
    ? controllerState.wheelSpeeds.left
    : controllerState.wheelSpeeds.right

  useEffect(() => {
    setControllerValidation(activeValidation)
  }, [activeValidation, setControllerValidation])

  useEffect(() => {
    if (!showDriveController || !driveValidation.canRun) {
      return undefined
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey) {
        return
      }

      if (isEditableTarget(event.target)) {
        return
      }

      const key = event.key.toLowerCase()

      if (key === 'w' || event.key === 'ArrowUp') {
        event.preventDefault()
        setDriveCommand(1, 1)
      } else if (key === 's' || event.key === 'ArrowDown') {
        event.preventDefault()
        setDriveCommand(-1, -1)
      } else if (!oneWheelPreview && (key === 'a' || event.key === 'ArrowLeft')) {
        event.preventDefault()
        setDriveCommand(-0.65, 0.65)
      } else if (!oneWheelPreview && (key === 'd' || event.key === 'ArrowRight')) {
        event.preventDefault()
        setDriveCommand(0.65, -0.65)
      } else if (event.code === 'Space') {
        event.preventDefault()
        setDriveCommand(0, 0)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [driveValidation.canRun, oneWheelPreview, setDriveCommand, showDriveController])

  function setForwardCommand(value: number) {
    setDriveCommand(value, value)
  }

  function setTurnCommand(direction: 'left' | 'right') {
    if (oneWheelPreview) {
      return
    }

    setDriveCommand(direction === 'left' ? -0.65 : 0.65, direction === 'left' ? 0.65 : -0.65)
  }

  return (
    <div className="controller-panel">
      <div className="controller-mode-row">
        <label className="controller-mode">
          <span>Controller Mode</span>
          <select
            value={controllerState.activeType}
            onChange={(event) => setControllerType(event.target.value as ControllerType)}
          >
            {Object.entries(controllerLabels).map(([type, label]) => (
              <option key={type} value={type}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="controller-actions">
        <button type="button" onClick={resetControllerPose}>
          <RotateCcw size={15} />
          Reset Pose
        </button>
        <button type="button" onClick={resetControllerPose}>
          <Home size={15} />
          Home
        </button>
        <button type="button" onClick={() => setDriveCommand(0, 0)}>
          <Square size={14} />
          Stop
        </button>
      </div>

      <div className="controller-summary">
        <span>
          <Waypoints size={13} />
          {robot.semantics.robotType.replaceAll('_', ' ')}
        </span>
        <span>
          <SlidersHorizontal size={13} />
          {movableJoints.length} movable
        </span>
        <span>
          <Gauge size={13} />
          {wheelJointNames.length} wheel joints
        </span>
      </div>

      {activeValidation.reason ? (
        <div
          className={`controller-validation ${
            activeValidation.canRun ? 'is-info' : 'is-warning'
          }`}
        >
          <Info size={15} />
          <span>{activeValidation.reason}</span>
        </div>
      ) : null}

      {showDriveController ? (
        <section className={`controller-card ${driveValidation.canRun ? '' : 'is-disabled'}`}>
          <div className="controller-card-title">
            <Gamepad2 size={15} />
            <strong>Differential / Tank Drive Preview</strong>
          </div>

          {driveValidation.canRun ? (
            <>
              <div className="drive-pad">
                <button type="button" onClick={() => setForwardCommand(1)}>
                  Forward
                </button>
                <div>
                  <button
                    type="button"
                    disabled={oneWheelPreview}
                    onClick={() => setTurnCommand('left')}
                  >
                    Left
                  </button>
                  <button type="button" onClick={() => setDriveCommand(0, 0)}>
                    Stop
                  </button>
                  <button
                    type="button"
                    disabled={oneWheelPreview}
                    onClick={() => setTurnCommand('right')}
                  >
                    Right
                  </button>
                </div>
                <button type="button" onClick={() => setForwardCommand(-1)}>
                  Backward
                </button>
              </div>

              <div className="drive-sliders">
                <label className="drive-slider">
                  <span>
                    Left Speed
                    <code>{formatNumber(leftSpeed * controllerState.speedMultiplier)}</code>
                  </span>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.01"
                    value={leftSpeed}
                    onChange={(event) => setDriveCommand(Number(event.target.value), rightSpeed)}
                  />
                </label>
                <label className="drive-slider">
                  <span>
                    Right Speed
                    <code>{formatNumber(rightSpeed * controllerState.speedMultiplier)}</code>
                  </span>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.01"
                    value={rightSpeed}
                    disabled={oneWheelPreview}
                    onChange={(event) => setDriveCommand(leftSpeed, Number(event.target.value))}
                  />
                </label>
                <label className="drive-slider">
                  <span>
                    Speed Multiplier
                    <code>{formatNumber(controllerState.speedMultiplier)}x</code>
                  </span>
                  <input
                    type="range"
                    min="0.1"
                    max="4"
                    step="0.1"
                    value={controllerState.speedMultiplier}
                    onChange={(event) =>
                      setControllerSpeedMultiplier(Number(event.target.value))
                    }
                  />
                </label>
              </div>

              <div className="drive-readout">
                <span>Mode: {driveModeLabel(leftSpeed, rightSpeed)}</span>
                <span>Left: {wheelGroups.left.join(', ') || wheelJointNames[0] || 'none'}</span>
                <span>Right: {oneWheelPreview ? 'disabled' : wheelGroups.right.join(', ') || 'none'}</span>
              </div>
            </>
          ) : (
            <div className="controller-validation is-warning">
              <Info size={15} />
              <span>{driveValidation.reason ?? 'Differential drive preview is unavailable.'}</span>
            </div>
          )}
        </section>
      ) : null}

      {showJointController ? (
        <section className={`controller-card ${basicValidation.canRun ? '' : 'is-disabled'}`}>
          <div className="controller-card-title">
            <SlidersHorizontal size={15} />
            <strong>Basic Joint Controller</strong>
          </div>

          {jointRows.length ? (
            jointRows.map((joint) => {
              const range = getJointControlRange(joint)
              const value = clampJointValue(joint, controllerState.jointValues[joint.name] ?? 0)
              const percent =
                ((value - range.min) / Math.max(range.max - range.min, Number.EPSILON)) * 100

              return (
                <label key={joint.name} className="joint-slider">
                  <span className="joint-slider-header">
                    <span>
                      <SlidersHorizontal size={14} />
                      {joint.name}
                    </span>
                    <code>{formatJointValue(joint, value)}</code>
                    <button type="button" onClick={() => resetControllerJoint(joint.name)}>
                      Reset
                    </button>
                  </span>
                  <input
                    type="range"
                    min={range.min}
                    max={range.max}
                    step={range.step}
                    value={value}
                    style={{
                      background: `linear-gradient(90deg, var(--accent) 0 ${percent}%, var(--input-bg) ${percent}% 100%)`,
                    }}
                    onChange={(event) =>
                      setJointControllerValue(
                        joint.name,
                        clampJointValue(joint, Number(event.target.value)),
                      )
                    }
                  />
                  <small>
                    {joint.type} / {formatJointValue(joint, range.min)} to{' '}
                    {formatJointValue(joint, range.max)}
                  </small>
                </label>
              )
            })
          ) : (
            <div className="controller-validation is-warning">
              <Info size={15} />
              <span>
                {controllerState.activeType === 'combined'
                  ? 'No non-wheel movable joints found for the arm/lift section.'
                  : basicValidation.reason ?? 'No movable joints found.'}
              </span>
            </div>
          )}
        </section>
      ) : null}

      <div className="controller-note">
        <Info size={14} />
        Preview only: controllers update temporary joint poses and wheel rotation in the viewport.
        They never rewrite URDF origins, mesh paths, or scale.
      </div>
    </div>
  )
}
