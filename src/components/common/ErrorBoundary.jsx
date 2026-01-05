import React, { Component } from 'react';

/**
 * Error Boundary component to catch JavaScript errors anywhere in the child
 * component tree and display a fallback UI instead of crashing the whole app.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render shows the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to console in development
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    this.setState({ errorInfo });

    // In production, you could send this to an error reporting service
    // Example: logErrorToService(error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      return (
        <div className="error-boundary">
          <div className="error-content">
            <h1>⚔️ Oops! Something went wrong</h1>
            <p>The kingdom has encountered an unexpected obstacle.</p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="error-details">
                <summary>Error Details (Development Only)</summary>
                <pre>{this.state.error.toString()}</pre>
                {this.state.errorInfo && (
                  <pre>{this.state.errorInfo.componentStack}</pre>
                )}
              </details>
            )}

            <div className="error-actions">
              <button onClick={this.handleRetry} className="btn-retry">
                Try Again
              </button>
              <button onClick={this.handleReload} className="btn-reload">
                Reload Page
              </button>
            </div>
          </div>

          <style>{`
            .error-boundary {
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
              color: #f5f5f5;
              font-family: 'MedievalSharp', cursive, sans-serif;
              padding: 20px;
            }

            .error-content {
              text-align: center;
              max-width: 500px;
              padding: 40px;
              background: rgba(0, 0, 0, 0.3);
              border-radius: 12px;
              border: 2px solid #c9a66b;
            }

            .error-content h1 {
              font-family: 'Cinzel Decorative', cursive;
              color: #c9a66b;
              margin-bottom: 16px;
              font-size: 1.5rem;
            }

            .error-content p {
              color: rgba(255, 255, 255, 0.8);
              margin-bottom: 24px;
            }

            .error-details {
              text-align: left;
              margin: 20px 0;
              padding: 16px;
              background: rgba(0, 0, 0, 0.4);
              border-radius: 8px;
              font-size: 12px;
              max-height: 200px;
              overflow: auto;
            }

            .error-details summary {
              cursor: pointer;
              color: #c9a66b;
              margin-bottom: 8px;
            }

            .error-details pre {
              white-space: pre-wrap;
              word-break: break-word;
              margin: 8px 0;
              color: #ff6b6b;
            }

            .error-actions {
              display: flex;
              gap: 12px;
              justify-content: center;
            }

            .error-actions button {
              padding: 12px 24px;
              border: none;
              border-radius: 8px;
              cursor: pointer;
              font-family: inherit;
              font-size: 1rem;
              transition: transform 0.2s, box-shadow 0.2s;
            }

            .btn-retry {
              background: #c9a66b;
              color: #1a1a2e;
            }

            .btn-reload {
              background: transparent;
              border: 2px solid #c9a66b !important;
              color: #c9a66b;
            }

            .error-actions button:hover {
              transform: translateY(-2px);
              box-shadow: 0 4px 12px rgba(201, 166, 107, 0.3);
            }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
