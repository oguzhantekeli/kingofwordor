import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) console.error('ErrorBoundary', error, info);
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="app" style={{ justifyContent: 'center', textAlign: 'center', gap: 16 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', color: 'var(--c-gold)' }}>
          ⚔️ The realm has faltered
        </h1>
        <p style={{ color: 'var(--c-ink-dim)' }}>Something broke. Reloading usually helps.</p>
        <button type="button" className="btn btn--primary"
                onClick={() => window.location.reload()}>Reload</button>
      </div>
    );
  }
}
