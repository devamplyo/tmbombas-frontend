/**
 * Authentication — JWT via the Java backend.
 *
 * achado (pedido explícito: tirar a credencial do localStorage): a sessão
 * não fica mais guardada aqui — nem token, nem refresh token. O backend
 * agora manda cookies httpOnly (`sid`/`rid`) que JavaScript não consegue
 * ler, e guarda o valor de verdade no Redis, na VPS (ver AuthController /
 * AccessSessionService no backend). O navegador manda esses cookies
 * sozinho em toda chamada same-origin — não precisamos mais montar o
 * header Authorization manualmente em lugar nenhum.
 */

const PERFIL_TO_ROLE = {
  ADM_MASTER: 'admin',
  VENDEDOR_INTERNO: 'vendedor_interno',
  VENDEDOR_EXTERNO: 'vendedor_externo',
  TECNICO_CONDOMINIAL: 'tecnico',
};

function normalizeUser(data) {
  return {
    // achados F13/F16: id vinha como string, enquanto os campos que o
    // sistema compara com ele depois de decodificados (seller_id,
    // created_by_id, assigned_to_id) continuam número — a comparação
    // === nunca batia, e listas "minhas" ficavam sempre vazias.
    id: data.id,
    full_name: data.nome ?? data.full_name,
    matricula: data.matricula,
    role: PERFIL_TO_ROLE[data.perfil] ?? data.role,
    is_active: data.ativo ?? data.is_active ?? true,
  };
}

export async function login(matricula, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'same-origin', // recebe os cookies httpOnly que o login devolve
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ matricula: String(matricula).trim(), senha: String(password) }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const message = err.error || err.erro || err.message || 'Falha no login.';
    throw new Error(message);
  }
  // O corpo da resposta não carrega mais o token — a sessão já foi
  // guardada pelo backend via cookie. Busca o perfil normalmente.
  return me();
}

/**
 * Troca o cookie de sessão por um novo, usando o refresh token (também em
 * cookie httpOnly) — sem precisar logar de novo. Chamado durante uso ativo
 * (ver useSessionTimeout), nunca por um refresh automático de tela, senão
 * a sessão nunca expiraria de verdade por inatividade.
 */
export async function refresh() {
  const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' });
  if (!res.ok) {
    throw new Error('Não foi possível renovar a sessão.');
  }
}

export async function me() {
  // Sem cookie de sessão válido, o backend responde 401 — não tem como
  // saber isso de antemão no front (o cookie é httpOnly, JS não lê).
  const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
  if (!res.ok) {
    return null;
  }
  const data = await res.json();
  return normalizeUser(data);
}

export function logout() {
  // Best-effort: limpa os cookies no servidor (e invalida o refresh token).
  // Não bloqueia o logout local mesmo se a chamada falhar (rede offline,
  // servidor fora do ar etc.) — quem chama já assume que a sessão acabou.
  fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
}

/**
 * Sempre null agora — não existe mais token legível por JavaScript em
 * lugar nenhum. Mantido só porque client.js e NfseSection.jsx ainda
 * importam; os dois já tratam token ausente sem quebrar (a autenticação
 * de verdade acontece pelo cookie httpOnly, enviado sozinho pelo navegador
 * em toda chamada same-origin).
 */
export function getToken() {
  return null;
}
