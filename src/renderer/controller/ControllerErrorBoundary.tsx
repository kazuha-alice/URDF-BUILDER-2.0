import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Info, RotateCcw } from 'lucide-react'
import { useProjectStore } from '../../store/useProjectStore'

interface ControllerErrorBoundaryProps {
  children: ReactNode
}

interface ControllerErrorBoundaryState {
  error: Error | null
}

export class ControllerErrorBoundary extends Component<
  ControllerErrorBoundaryProps,
  ControllerErrorBoundaryState
> {
  state: ControllerErrorBoundaryState = {
    error: null,
  }

  static getDerivedStateFromError(error: Error): ControllerErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Controller crash', error, info.componentStack)
    const controller = useProjectStore.getState()
    controller.resetControllerPose()
    controller.setControllerValidation({
      canRun: false,
      reason: error.message || 'Controller failed to start.',
      requirements: [],
      detected: [],
    })
  }

  resetController = () => {
    const controller = useProjectStore.getState()
    controller.resetControllerPose()
    controller.setControllerValidation({
      canRun: false,
      reason: 'Controller reset. Select a controller mode to validate again.',
      requirements: [],
      detected: [],
    })
    this.setState({ error: null })
  }

  render() {
    if (!this.state.error) {
      return this.props.children
    }

    return (
      <div className="controller-panel">
        <section className="controller-card">
          <div className="controller-card-title">
            <Info size={15} />
            <strong>Controller failed safely</strong>
          </div>
          <div className="controller-validation is-warning">
            <Info size={15} />
            <span>
              {this.state.error.message || 'Controller preview failed. The workspace is still loaded.'}
            </span>
          </div>
          <div className="controller-actions">
            <button type="button" onClick={this.resetController}>
              <RotateCcw size={15} />
              Reset Controller
            </button>
          </div>
        </section>
      </div>
    )
  }
}
