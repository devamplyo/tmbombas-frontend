import { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, LogOut, Repeat, Droplet } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PROFILES, hasMultipleProfiles } from '@/config/profiles';
import useSessionTimeout from '@/hooks/useSessionTimeout';
import ErrorBoundary from '@/components/ErrorBoundary';
import styles from './AppShell.module.css';

/**
 * Layout shared by all modules.
 * `profileKey` indicates which menu (from PROFILES) to display.
 */
export default function AppShell({ profileKey }) {
  const profile = PROFILES[profileKey];
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useSessionTimeout();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const nav = (
    <nav className={styles.nav}>
      {profile.menu.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={() => setMobileOpen(false)}
          className={({ isActive }) =>
            [styles.navItem, isActive ? styles.active : ''].filter(Boolean).join(' ')
          }
        >
          <item.icon size={18} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );

  const footer = (
    <div className={styles.userBox}>
      <div className={styles.userInfo}>
        <span className={styles.userName}>{user?.full_name}</span>
        <span className={styles.userRole}>{profile.label}</span>
      </div>
      <div className={styles.userActions}>
        {hasMultipleProfiles(user) && (
          <button className={styles.userBtn} onClick={() => navigate('/')} title="Trocar perfil">
            <Repeat size={16} />
            <span>Trocar</span>
          </button>
        )}
        <button className={styles.userBtn} onClick={handleLogout} title="Sair">
          <LogOut size={16} />
          <span>Sair</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className={styles.shell}>
      {/* Desktop sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.logo}>
            <Droplet size={20} />
          </div>
          <div>
            <strong>TM Bombas</strong>
            <span className={styles.brandSub}>{profile.label}</span>
          </div>
        </div>
        {nav}
        {footer}
      </aside>

      {/* Mobile header */}
      <header className={styles.mobileHeader}>
        <div className={styles.brandMobile}>
          <Droplet size={18} />
          <strong>TM Bombas</strong>
        </div>
        <button className={styles.menuToggle} onClick={() => setMobileOpen(true)} aria-label="Menu">
          <Menu size={22} />
        </button>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className={styles.drawerBackdrop} onClick={() => setMobileOpen(false)}>
          <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <div className={styles.brandMobile}>
                <Droplet size={18} />
                <strong>{profile.label}</strong>
              </div>
              <button className={styles.menuToggle} onClick={() => setMobileOpen(false)} aria-label="Fechar">
                <X size={22} />
              </button>
            </div>
            {nav}
            {footer}
          </div>
        </div>
      )}

      {/* Content */}
      <main className={styles.content}>
        <ErrorBoundary resetKey={location.pathname}>
          <Outlet context={{ user }} />
        </ErrorBoundary>
      </main>
    </div>
  );
}
