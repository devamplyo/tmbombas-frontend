/**
 * Authentication — JWT via the Java backend (:8080).
 * Session stored in localStorage: { token, refresh }.
 */

const SESSION_KEY = 'th_session';

const PERFIL_TO_ROLE = {
  ADM_MASTER: 'admin',
  VENDEDOR_INTERNO: 'vendedor_interno',
  VENDEDOR_EXTERNO: 'vendedor_externo',
  TECNICO_CONDOMINIAL: 'tecnico',
};

function normalizeUser(data) {
  return {
    id: String(data.id),
    full_name: data.nome ?? data.full_name,
    matricula: data.matricula,
    role: PERFIL_TO_ROLE[data.perfil] ?? data.role,
    is_active: data.ativo ?? data.is_active ?? true,
  };
}

function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(token, refreshToken) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ token, refresh: refreshToken }));
}

export function getToken() {
  return readSession()?.token ?? null;
}

function getRefreshToken() {
  return readSession()?.refresh ?? null;
}

export async function login(matricula, password) {
  console.log(`[AUTH] Tentativa de login - matricula=${matricula}`);
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ matricula: String(matricula).trim(), senha: String(password) }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const message = err.error || err.erro || err.message || 'Falha no login.';
    console.warn(`[AUTH] Login falhou - matricula=${matricula} status=${res.status} motivo=${message}`);
    throw new Error(message);
  }
  const data = await res.json();
  console.log(`[AUTH] Login bem-sucedido - matricula=${data.matricula} perfil=${data.perfil}`);
  saveSession(data.token, data.refresh);
  return me();
}

/**
 * Exchanges the token for a new one using the refresh token, without needing to log in again.
 * Called during active use (see useSessionTimeout) — never by an automatic
 * screen refresh, otherwise the session would never really expire from inactivity.
 */
export async function refresh() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error('Sem sessão para renovar.');

  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) {
    console.warn(`[AUTH] refresh() falhou - status=${res.status}`);
    throw new Error('Não foi possível renovar a sessão.');
  }
  const data = await res.json();
  saveSession(data.token, data.refresh);
  console.log('[AUTH] Sessão renovada silenciosamente');
  return data.token;
}

export async function me() {
  const token = getToken();
  if (!token) {
    console.log('[AUTH] me() sem token salvo - usuário não autenticado');
    return null;
  }

  const res = await fetch('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.warn(`[AUTH] me() falhou - status=${res.status}, deslogando`);
    logout();
    return null;
  }
  const data = await res.json();
  const user = normalizeUser(data);
  console.log(`[AUTH] Sessão válida - matricula=${user.matricula} role=${user.role}`);
  return user;
}

export function logout() {
  console.log('[AUTH] Logout');
  const token = getToken();
  const refreshToken = getRefreshToken();
  localStorage.removeItem(SESSION_KEY);

  // Best-effort: invalidates the refresh token on the server. Doesn't block the
  // local logout even if the call fails (offline network, server down, etc.).
  if (token) {
    fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ refresh_token: refreshToken || undefined }),
    }).catch(() => {});
  }
}
