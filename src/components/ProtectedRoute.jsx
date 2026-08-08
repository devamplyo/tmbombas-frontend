import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { canAccess, homeFor } from '@/config/profiles';

import Spinner from '@/components/ui/Spinner';

/**
 * Protects authenticated routes.
 * - No session → redirects to /login.
 * - `basePath` given → validates RBAC (each profile only accesses its own module; ADM accesses all).
 */
export default function ProtectedRoute({ basePath }) {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
        <Spinner />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (basePath && !canAccess(user, basePath)) {
    return <Navigate to={homeFor(user)} replace />;
  }

  return <Outlet />;
}
