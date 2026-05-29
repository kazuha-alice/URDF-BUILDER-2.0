import { Component, type ErrorInfo, type ReactNode } from 'react'

interface AppErrorBoundaryProps {
  children: ReactNode
}

interface AppErrorBoundaryState {
  error: Error | null
}

const workspaceLayoutKey = 'urdf-builder-workspace-layout'

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    error: null,
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('URDF Builder renderer crashed', error, info.componentStack)
  }

  reload = () => {
    window.location.reload()
  }

  resetLayout = () => {
    window.localStorage.removeItem(workspaceLayoutKey)
    window.location.reload()
  }

  render() {
    if (!this.state.error) {
      return this.props.children
    }

    return (
      <main className="app-error-shell">
        <section className="app-error-card">
          <strong>URDF Builder renderer restarted poorly</strong>
          <p>{this.state.error.message}</p>
          <div>
            <button type="button" onClick={this.reload}>
              Reload
            </button>
            <button type="button" onClick={this.resetLayout}>
              Reset Layout
            </button>
          </div>
        </section>
      </main>
    )
  }
}
