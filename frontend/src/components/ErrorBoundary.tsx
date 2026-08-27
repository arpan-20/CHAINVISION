import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] Caught render error:', error, errorInfo)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center px-4 text-center">
          <div className="panel-glass max-w-md rounded-xl p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-critical">Render error</p>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-paper">
              Something went wrong
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-mist">
              The dashboard hit a rendering problem. Refresh the page to reload the current session.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="primary-action mt-5"
            >
              Refresh
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

