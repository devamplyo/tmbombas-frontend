import { Component } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

/**
 * Catches any rendering error from a screen and shows a friendly warning
 * instead of leaving the page blank (React unmounts the tree on an unhandled
 * error). Automatically resets when the route changes (via `resetKey`).
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[UI] Erro de renderização capturado:', error, info);
  }

  componentDidUpdate(prevProps) {
    // Route change → clears the error so the next screen renders normally.
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.85rem',
            minHeight: '60vh',
            textAlign: 'center',
            padding: '2rem',
          }}
        >
          <AlertTriangle size={40} style={{ color: 'hsl(var(--warning, 38 92% 50%))' }} />
          <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Algo deu errado nesta tela</h2>
          <p style={{ margin: 0, color: 'hsl(var(--muted-foreground))', maxWidth: 460, fontSize: '0.9rem' }}>
            A aplicação evitou uma falha e manteve o menu ativo. Você pode tentar
            recarregar esta tela ou navegar para outra pelo menu lateral.
          </p>
          <p style={{ margin: 0, color: 'hsl(var(--muted-foreground))', fontSize: '0.78rem', fontFamily: 'monospace' }}>
            {String(this.state.error?.message || this.state.error)}
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              border: '1px solid hsl(var(--border))',
              background: 'hsl(var(--card))',
              color: 'hsl(var(--foreground))',
              borderRadius: 'var(--radius, 8px)',
              padding: '0.5rem 0.9rem',
              cursor: 'pointer',
              fontSize: '0.88rem',
            }}
          >
            <RotateCcw size={15} /> Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
