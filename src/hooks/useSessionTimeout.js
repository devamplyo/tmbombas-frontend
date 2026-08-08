import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { refresh } from '@/api/auth';

const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes (RN-AUT-06)
const REFRESH_INTERVAL_MS = 20 * 60 * 1000; // renews the token well before it expires

/**
 * Logs the user out after 30 min of inactivity.
 * Resets the countdown on any interaction (mouse, keyboard, touch, scroll) —
 * and uses that same real interaction to silently renew the token, so
 * someone who's active isn't kicked out just because the token expired.
 * Automatic screen refresh (polling) intentionally doesn't count as activity here.
 */
export default function useSessionTimeout() {
  const { isAuthenticated, logout } = useAuth();
  const timerRef = useRef(null);
  const lastRefreshRef = useRef(0);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => logout(), TIMEOUT_MS);

    const now = Date.now();
    if (now - lastRefreshRef.current > REFRESH_INTERVAL_MS) {
      lastRefreshRef.current = now;
      refresh().catch(() => {
        // If the renewal fails (e.g.: the refresh token also expired), the next
        // real API call will get a 401 and end the session normally.
      });
    }
  }, [logout]);

  useEffect(() => {
    if (!isAuthenticated) return;

    lastRefreshRef.current = Date.now(); // token was just issued at login

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((e) => window.addEventListener(e, resetTimer));
    resetTimer();

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isAuthenticated, resetTimer]);
}
