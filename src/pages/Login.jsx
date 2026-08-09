import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Droplet, LogIn } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/ui/Field';
import Button from '@/components/ui/Button';
import styles from './Login.module.css';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [matricula, setMatricula] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(matricula, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Falha no login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <div className={styles.logo}>
            <Droplet size={28} />
          </div>
          <h1>TM Bombas</h1>
          <p>Sistema de Gestão Integrada</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <Input
            label="Matrícula"
            placeholder="Sua matrícula"
            value={matricula}
            onChange={(e) => setMatricula(e.target.value)}
            autoFocus
            required
          />
          <Input
            label="Senha"
            type="password"
            placeholder="Sua senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && <div className={styles.error}>{error}</div>}

          <Button type="submit" disabled={loading} className={styles.submit}>
            <LogIn size={18} />
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>

        <div className={styles.hint}>
          <span>Acesso de teste:</span>
          <code>vint / 123</code> · <code>vext / 123</code> · <code>tec / 123</code>
          <br />
          <small>Admin: matrícula/senha configuradas em ADMIN_MATRICULA / ADMIN_SENHA no .env do backend.</small>
        </div>
      </div>
    </div>
  );
}
