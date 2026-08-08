import { Link } from 'react-router-dom';
import Button from '@/components/ui/Button';

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', textAlign: 'center', padding: '1rem' }}>
      <div>
        <h1 style={{ fontSize: '3rem', fontWeight: 800 }}>404</h1>
        <p style={{ color: 'hsl(var(--muted-foreground))', marginBottom: '1.25rem' }}>
          Página não encontrada.
        </p>
        <Link to="/">
          <Button>Voltar ao início</Button>
        </Link>
      </div>
    </div>
  );
}
