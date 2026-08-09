import { useNavigate } from 'react-router-dom';
import { Droplet, LogOut, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PROFILES, canAccess, userRoles } from '@/config/profiles';
import styles from './ProfileSelector.module.css';

export default function ProfileSelector() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.head}>
          <div className={styles.logo}>
            <Droplet size={26} />
          </div>
          <div>
            <h1>TM Bombas</h1>
            <p>Selecione seu perfil de acesso</p>
          </div>
        </header>

        <div className={styles.grid}>
          {Object.entries(PROFILES).map(([key, profile]) => {
            const allowed = canAccess(user, profile.basePath);
            const isOwn = userRoles(user).includes(key);
            const Icon = profile.icon;
            return (
              <button
                key={key}
                className={[styles.card, !allowed ? styles.disabled : ''].filter(Boolean).join(' ')}
                onClick={() => allowed && navigate(profile.home)}
                disabled={!allowed}
              >
                {isOwn && <span className={styles.badge}>Seu perfil</span>}
                <div className={styles.cardIcon}>
                  <Icon size={26} />
                </div>
                <h2>{profile.label}</h2>
                <p>{profile.description}</p>
                {allowed && (
                  <span className={styles.enter}>
                    Acessar <ArrowRight size={15} />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <footer className={styles.foot}>
          <div>
            <strong>{user.full_name}</strong>
            <span>{PROFILES[user.role]?.label}</span>
          </div>
          <button className={styles.logout} onClick={handleLogout}>
            <LogOut size={16} /> Sair
          </button>
        </footer>
      </div>
    </div>
  );
}
