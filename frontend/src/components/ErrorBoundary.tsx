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
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] Caught render error:', error, errorInfo)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
          <h2 className="text-lg font-semibold text-slate-800 mb-2">
            Something went wrong
          </h2>
          <p className="text-slate-600 mb-4">
            Please try refreshing the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-md bg-slate-800 text-white px-4 py-2 text-sm hover:bg-slate-700"
          >
            Refresh
          </button>
        </div>
      )
    }

    return this.props.children
  }
}