import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: string | null }> {
  state = { error: null }
  static getDerivedStateFromError(err: Error) {
    return { error: err.message + '\n' + err.stack }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: 32, fontFamily: 'monospace', fontSize: 12,
          background: '#1e1e2e', color: '#ff6b6b', minHeight: '100vh',
          whiteSpace: 'pre-wrap', overflow: 'auto'
        }}>
          <div style={{ color: '#f9e2af', fontSize: 16, marginBottom: 16, fontWeight: 700 }}>
            ⚠ Render Error — check DevTools console for full trace
          </div>
          {this.state.error}
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)
