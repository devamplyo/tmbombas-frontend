/**
 * Data layer — adapter between the frontend's vocabulary (the old mock
 * dialect) and the REAL contract of the normalized Java backend (:8080).
 *
 * Responsibilities:
 *  - Translate field names and enum values in both directions (encode/decode).
 *  - Cover endpoints the backend doesn't have: `filter` and some `get(id)`
 *    are resolved client-side over the listing (`GET /entity`).
 *  - Shield READS: list/filter/get never throw — on error they return
 *    empty and log. So a network/permission failure never crashes the screen.
 *  - WRITES (create/update/remove) propagate the error for the screen to handle (toast).
 *
 * Note: the backend serializes in snake_case, so many fields already match
 * (product_id, scheduled_date, contact_person, ...). We only map the differences.
 */
import { getToken, logout } from './auth.js';

const BASE = '/api';

async function req(method, url, body) {
  // achado (tirar a credencial do localStorage): getToken() é sempre null
  // agora — a sessão vem do cookie httpOnly `sid`, que o navegador manda
  // sozinho (credentials: 'same-origin'). Ver auth.js.
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const start = performance.now();

  const res = await fetch(BASE + url, {
    method,
    credentials: 'same-origin',
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  const duration = Math.round(performance.now() - start);

  if (res.status === 401) {
    console.warn(`[API] <- ${method} ${url} 401 (${duration}ms) - sessão expirada, deslogando`);
    logout();
    window.location.href = '/';
    return;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    // Backend validation errors arrive as { field: message, ... }
    const fieldErrors = Object.entries(err)
      .filter(([k]) => !['message', 'error', 'erro', 'timestamp', 'status', 'path'].includes(k))
      .map(([k, v]) => `${k}: ${v}`)
      .join('; ');
    const message = err.message || err.error || err.erro || fieldErrors || res.statusText;
    console.error(`[API] <- ${method} ${url} ${res.status} (${duration}ms) - ${message}`, err);
    throw new Error(message);
  }

  // DELETE usually returns 204 with no body - res.json() would break parsing it.
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  return data;
}

/* ─────────────────────────  Value maps (enums)  ───────────────────────── */

const ROLE_TO_PERFIL = {
  admin: 'ADM_MASTER',
  vendedor_interno: 'VENDEDOR_INTERNO',
  vendedor_externo: 'VENDEDOR_EXTERNO',
  tecnico: 'TECNICO_CONDOMINIAL',
};
const PERFIL_TO_ROLE = Object.fromEntries(Object.entries(ROLE_TO_PERFIL).map(([k, v]) => [v, k]));

const CLIENT_TYPE_TO_ENUM = {
  pessoa_fisica: 'PESSOA_FISICA',
  pessoa_juridica: 'PESSOA_JURIDICA',
  condominio: 'PESSOA_JURIDICA', // backend has no "condominium" type → maps to PJ (legal entity)
};
const ENUM_TO_CLIENT_TYPE = { PESSOA_FISICA: 'pessoa_fisica', PESSOA_JURIDICA: 'pessoa_juridica' };

// achado (descoberto ao corrigir F14): ClientResponse não expunha `status`
// (só `active`) — PENDENTE e REPROVADO eram os dois active=false,
// indistinguíveis na tela. Ver validation_status no decode do Client abaixo.
const ENUM_TO_CLIENT_STATUS = {
  PENDENTE: 'aguardando_validacao',
  APROVADO: 'ativo',
  REPROVADO: 'rejeitado',
};

// achado F10: backend só tinha um "CARTAO" genérico; a tela sempre ofereceu
// crédito/débito separados. Alinhado dividindo o enum do lado do backend.
const PAYMENT_METHOD_TO_ENUM = {
  dinheiro: 'DINHEIRO',
  pix: 'PIX',
  cartao_credito: 'CARTAO_CREDITO',
  cartao_debito: 'CARTAO_DEBITO',
  boleto: 'BOLETO',
  transferencia: 'TRANSFERENCIA',
};
const ENUM_TO_PAYMENT_METHOD = Object.fromEntries(
  Object.entries(PAYMENT_METHOD_TO_ENUM).map(([k, v]) => [v, k]),
);

// Front's service-order status vocabulary → backend enum (best effort)
const OS_STATUS_TO_ENUM = {
  aguardando_validacao: 'ABERTA',
  validada: 'APROVADA',
  nao_validada: 'CANCELADA',
  em_execucao: 'EM_ANDAMENTO',
  concluida: 'CONCLUIDA',
  cancelada: 'CANCELADA',
};
const ENUM_TO_OS_STATUS = {
  ABERTA: 'aguardando_validacao',
  ORCADA: 'aguardando_validacao',
  APROVADA: 'validada',
  AGENDADA: 'validada',
  EM_ANDAMENTO: 'em_execucao',
  CONCLUIDA: 'concluida',
  CANCELADA: 'cancelada',
  // achado F8: REPROVADA existe no backend (fluxo de aprovação órfão, ver
  // F7) e não tinha mapeamento explícito — mapear por precaução, caso esse
  // fluxo seja religado um dia.
  REPROVADA: 'reprovada',
};

const TASK_STATUS_TO_ENUM = {
  agendado: 'AGENDADO',
  em_andamento: 'EM_ANDAMENTO',
  concluido: 'CONCLUIDO',
  cancelado: 'CANCELADO',
};
const ENUM_TO_TASK_STATUS = Object.fromEntries(
  Object.entries(TASK_STATUS_TO_ENUM).map(([k, v]) => [v, k]),
);

/* ─────────────────────────────  Helpers  ───────────────────────────── */

const numOrNull = (v) => {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};
const intOrNull = (v) => {
  if (v === '' || v == null) return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
};
// 'YYYY-MM-DD' → 'YYYY-MM-DDT00:00:00' (backend's LocalDateTime fields)
const toDateTime = (v) =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00` : v || null;

// Removes undefined keys (keeps null, which the backend treats as absent)
const clean = (obj) => {
  const out = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out;
};

const buildAddress = (d) => {
  const a = d.address || {};
  return clean({
    street: a.street ?? d.street ?? null,
    number: a.number ?? d.number ?? null,
    complement: a.complement ?? d.complement ?? null,
    district: a.district ?? d.district ?? null,
    city: a.city ?? d.city_name ?? d.city ?? null,
    state: a.state ?? d.state ?? null,
    zip_code: a.zip_code ?? d.zip_code ?? null,
  });
};

/* ─────────────────────  Per-entity configuration  ───────────────────── */
/*  decode: backend → front  |  encode: front → backend                    */

const CONFIG = {
  User: {
    route: '/users',
    hasGetById: false,
    hasUpdate: true,
    decode: (r) => {
      const role = PERFIL_TO_ROLE[r.perfil] || r.perfil;
      return {
        id: r.id,
        full_name: r.nome,
        matricula: r.matricula,
        role,
        roles: role ? [role] : [],
        is_active: r.ativo,
      };
    },
    encode: (d) => {
      const role = d.role || (Array.isArray(d.roles) && d.roles[0]);
      return clean({
        nome: d.full_name,
        matricula: d.matricula,
        senha: d.plain_password || d.password || undefined,
        perfil: ROLE_TO_PERFIL[role] || role,
        ativo: d.is_active,
      });
    },
  },

  Client: {
    route: '/clients',
    hasGetById: true,
    hasUpdate: true,
    decode: (r) => ({
      id: r.id,
      name: r.name,
      document: r.document,
      email: r.email,
      phone: r.phone,
      type: ENUM_TO_CLIENT_TYPE[r.type] || r.type,
      address: r.address,
      city_name: r.address?.city,
      state: r.address?.state,
      // achado (descoberto ao corrigir F14): antes só existia `active` no
      // backend, então PENDENTE e REPROVADO (os dois active=false) ficavam
      // indistinguíveis — Rejeitar "funcionava" mas a tela nunca conseguia
      // mostrar. `status` agora vem exposto de verdade (ClientResponse).
      validation_status: ENUM_TO_CLIENT_STATUS[r.status] || (r.active === false ? 'aguardando_validacao' : 'ativo'),
      is_active: r.active,
      created_date: r.created_at,
      created_at: r.created_at,
    }),
    encode: (d) =>
      clean({
        name: d.name,
        document: d.document || '',
        email: d.email || null,
        phone: d.phone || null,
        type: CLIENT_TYPE_TO_ENUM[d.type] || d.type,
        address: buildAddress(d),
      }),
  },

  Product: {
    route: '/products',
    hasGetById: false,
    hasUpdate: true,
    decode: (r) => ({
      ...r,
      sku: r.code,
      sale_price: r.price,
      stock_quantity: r.stock,
      is_active: r.active,
    }),
    encode: (d) =>
      clean({
        name: d.name,
        description: d.description || null,
        code: d.sku ?? d.code,
        manufacturer: d.manufacturer,
        price: numOrNull(d.sale_price ?? d.price),
        stock: intOrNull(d.stock_quantity ?? d.stock),
        category: d.category,
        power_hp: d.power_hp ?? null,
        max_flow_rate: d.max_flow_rate ?? null,
        voltage: intOrNull(d.voltage),
        barcode: d.barcode || null,
        min_stock: intOrNull(d.min_stock) ?? 0,
        unit: d.unit || 'un',
      }),
  },

  Sale: {
    route: '/sales',
    hasGetById: true,
    // cancel = POST /sales/{id}/cancel (achado F1 — ver cancelSale() abaixo), não update genérico
    hasUpdate: false,
    decode: (r) => ({
      id: r.id,
      client_name: r.customer_name,
      seller_id: r.seller_id,
      seller_name: r.seller_name,
      total_amount: r.total,
      total: r.total,
      total_items: (r.items || []).reduce((n, i) => n + (i.quantity || 0), 0),
      // backend only has ATIVA/CANCELADA — an active sale is already a completed sale
      status: r.status === 'CANCELADA' ? 'cancelada' : 'consolidada',
      // achado F3: agora vem gravado de verdade — ver payment_method no encode()
      payment_method: ENUM_TO_PAYMENT_METHOD[r.payment_method] || null,
      sale_date: r.created_at,
      created_date: r.created_at,
      created_at: r.created_at,
      items: (r.items || []).map((it) => ({
        product_id: it.product_id,
        product_name: it.product_name,
        unit_price: it.unit_price,
        quantity: it.quantity,
        total: it.subtotal,
      })),
    }),
    encode: (d) =>
      clean({
        customer_name: d.client_name ?? d.customer_name ?? '',
        payment_method: PAYMENT_METHOD_TO_ENUM[d.payment_method] || undefined,
        items: (d.items || []).map((i) => ({
          product_id: numOrNull(i.product_id),
          quantity: i.quantity,
        })),
      }),
  },

  ServiceOrder: {
    route: '/serviceorders',
    hasGetById: false,
    hasUpdate: true,
    decode: (r) => ({
      id: r.id,
      client_id: r.client_id,
      client_name: r.client_name,
      technician_id: r.technician_id,
      technician_name: r.technician_name,
      assigned_to_id: r.technician_id,
      assigned_to_name: r.technician_name,
      created_by_id: r.created_by_id,
      title: r.title,
      description: r.description,
      status: ENUM_TO_OS_STATUS[r.status] || (r.status ? String(r.status).toLowerCase() : undefined),
      scheduled_date: r.scheduled_date,
      service_value: r.price,
      price: r.price,
      payment_status: 'a_receber', // backend doesn't model service order payment
      type: r.type === 'ORCAMENTO' ? 'orcamento' : 'os',
      items: (r.items || []).map((i) => ({ id: i.id, name: i.name, description: i.description, value: i.value })),
      order_number: r.order_number,
      completion_date: r.completed_at,
      created_date: r.created_at,
      created_at: r.created_at,
    }),
    encode: (d) =>
      clean({
        client_id: numOrNull(d.client_id),
        technician_id: numOrNull(d.assigned_to_id ?? d.technician_id),
        title: d.title || (d.description ? String(d.description).slice(0, 60) : 'Serviço'),
        description: d.description ?? null,
        scheduled_date: d.scheduled_date ? toDateTime(d.scheduled_date) : null,
        price: numOrNull(d.service_value ?? d.price),
        status: d.status ? OS_STATUS_TO_ENUM[d.status] || d.status : undefined,
        type: d.type === 'orcamento' ? 'ORCAMENTO' : d.type === 'os' ? 'OS' : undefined,
        items: d.items
          ? d.items.map((i) => ({ name: i.name, description: i.description || null, value: Number(i.value) || 0 }))
          : undefined,
      }),
  },

  ServiceTask: {
    route: '/servicetasks',
    hasGetById: true,
    hasUpdate: true,
    decode: (r) => ({
      id: r.id,
      service_order_id: r.service_order_id,
      technician_id: r.technician_id,
      assigned_to_id: r.technician_id,
      technician_name: r.technician_name,
      assigned_to_name: r.technician_name,
      client_id: r.client_id,
      client_name: r.client_name,
      description: r.description,
      status: ENUM_TO_TASK_STATUS[r.status] || (r.status ? String(r.status).toLowerCase() : undefined),
      scheduled_date: r.scheduled_date,
      scheduled_time: r.scheduled_time,
      started_at: r.started_at,
      completed_at: r.completed_at,
      created_at: r.created_at,
    }),
    encode: (d) =>
      clean({
        service_order_id: numOrNull(d.service_order_id),
        technician_id: numOrNull(d.assigned_to_id ?? d.technician_id),
        client_id: numOrNull(d.client_id),
        description: d.description ?? null,
        scheduled_date: d.scheduled_date || null,
        scheduled_time: d.scheduled_time || null,
        status: d.status ? TASK_STATUS_TO_ENUM[d.status] || d.status : undefined,
      }),
  },

  Supplier: {
    route: '/suppliers',
    hasGetById: true,
    hasUpdate: true,
    decode: (r) => ({ ...r }),
    encode: (d) =>
      clean({
        name: d.name,
        document: d.document || null,
        email: d.email || null,
        phone: d.phone || null,
        contact_person: d.contact_person || null,
      }),
  },

  StockEntry: {
    route: '/stock-entries',
    hasGetById: true,
    hasUpdate: false,
    // backend groups into "items" (1 entry can have several products); the screen today
    // only enters 1 product at a time, so we flatten the first item for the existing screens.
    decode: (r) => {
      const item = (r.items && r.items[0]) || {};
      return {
        id: r.id,
        supplier_id: r.supplier_id,
        supplier_name: r.supplier_name,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        total_cost: r.total,
        invoice_number: r.document_number,
        entry_date: r.entry_date,
        items: r.items,
      };
    },
    encode: (d) =>
      clean({
        supplier_id: numOrNull(d.supplier_id),
        document_number: d.invoice_number || null,
        entry_date: d.entry_date || null,
        items: [
          clean({
            product_id: numOrNull(d.product_id),
            quantity: intOrNull(d.quantity),
            unit_cost: numOrNull(d.unit_cost),
          }),
        ],
      }),
  },
};

/* ─────────────────────  Client-side filter/sort  ───────────────────── */

function applyQuery(rows, query = {}) {
  const entries = Object.entries(query);
  if (!entries.length) return rows;
  return rows.filter((row) =>
    entries.every(([k, v]) => {
      if (v === undefined || v === null || v === '') return true;
      // field that doesn't exist on the entity (e.g.: a workflow the backend doesn't have)
      // → lenient filter: doesn't exclude the row instead of zeroing out the screen.
      if (row[k] === undefined || row[k] === null) return true;
      return String(row[k]) === String(v);
    }),
  );
}

function applySortLimit(rows, sort, limit) {
  let out = rows;
  if (sort) {
    const desc = sort.startsWith('-');
    const key = desc ? sort.slice(1) : sort;
    out = [...rows].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return desc ? 1 : -1;
      if (av > bv) return desc ? -1 : 1;
      return 0;
    });
  }
  if (limit) out = out.slice(0, limit);
  return out;
}

/* ─────────────────────────  Generic repository  ───────────────────────── */

function makeRepository(entity) {
  const cfg = CONFIG[entity];
  const { route, decode, encode } = cfg;

  // Raw listing, already decoded. Resilient: never throws.
  const listAll = async () => {
    try {
      const rows = await req('GET', route);
      return (rows || []).map(decode);
    } catch (e) {
      console.error(`[API] falha ao listar ${entity}:`, e.message);
      return [];
    }
  };

  return {
    list: async (sort, limit) => applySortLimit(await listAll(), sort, limit),

    filter: async (query = {}, sort, limit) =>
      applySortLimit(applyQuery(await listAll(), query), sort, limit),

    get: async (id) => {
      try {
        if (cfg.hasGetById) {
          const row = await req('GET', `${route}/${id}`);
          return row ? decode(row) : null;
        }
        return (await listAll()).find((r) => String(r.id) === String(id)) || null;
      } catch (e) {
        console.error(`[API] falha ao buscar ${entity} ${id}:`, e.message);
        return null;
      }
    },

    create: async (data) => decode(await req('POST', route, encode(data))),

    update: async (id, data) => {
      if (!cfg.hasUpdate) {
        throw new Error(`Atualização de ${entity} não é suportada por este servidor.`);
      }
      return decode(await req('PUT', `${route}/${id}`, encode(data)));
    },

    remove: (id) => req('DELETE', `${route}/${id}`),
  };
}

export const db = Object.fromEntries(Object.keys(CONFIG).map((entity) => [entity, makeRepository(entity)]));

/* ─────────────────────────  Reports (ADM Master)  ───────────────────────── */

const emptyFlow = { periods: [], totalEntradas: 0, totalSaidas: 0, totalVendas: 0, saldo: 0 };

/**
 * Financial flow by period (inflows x outflows x sales), for the dashboard chart.
 * granularidade: 'DIA' | 'SEMANA' | 'MES'. Without parameters, the backend uses the last 6 months.
 */
export async function getFinancialFlow({ inicio, fim, granularidade } = {}) {
  const params = new URLSearchParams();
  if (inicio) params.set('inicio', inicio);
  if (fim) params.set('fim', fim);
  if (granularidade) params.set('granularidade', granularidade);
  const qs = params.toString();

  try {
    const r = await req('GET', `/admin/reports/flow${qs ? `?${qs}` : ''}`);
    if (!r) return emptyFlow;
    return {
      periods: (r.periodos || []).map((p) => ({
        periodo: p.periodo,
        entradas: Number(p.total_entradas) || 0,
        saidas: Number(p.total_saidas) || 0,
        vendas: Number(p.total_vendas) || 0,
        saldo: Number(p.saldo) || 0,
      })),
      totalEntradas: Number(r.total_entradas) || 0,
      totalSaidas: Number(r.total_saidas) || 0,
      totalVendas: Number(r.total_vendas) || 0,
      saldo: Number(r.saldo) || 0,
    };
  } catch (e) {
    console.error('[API] falha ao buscar fluxo financeiro:', e.message);
    return emptyFlow;
  }
}

const emptySpending = { suppliers: [], totalSpent: 0 };

/** Spending by supplier in the period (default: last 6 months), for the dashboard chart. */
export async function getSupplierSpending({ inicio, fim } = {}) {
  const params = new URLSearchParams();
  if (inicio) params.set('inicio', inicio);
  if (fim) params.set('fim', fim);
  const qs = params.toString();

  try {
    const r = await req('GET', `/suppliers/spending${qs ? `?${qs}` : ''}`);
    if (!r) return emptySpending;
    return {
      suppliers: (r.suppliers || []).map((s) => ({
        id: s.supplier_id,
        name: s.supplier_name,
        totalSpent: Number(s.total_spent) || 0,
        launchCount: Number(s.launch_count) || 0,
      })),
      totalSpent: Number(r.total_spent) || 0,
    };
  } catch (e) {
    console.error('[API] falha ao buscar gastos por fornecedor:', e.message);
    return emptySpending;
  }
}

/* ─────────────────────────  Condominial Technician  ───────────────────────── */

const emptyActivities = { technicianName: '', total: 0, completed: 0, scheduled: 0, inProgress: 0, activities: [] };

/** History of the logged-in technician's activities, with optional period and status filters. */
export async function getTechnicianActivities({ from, to, status } = {}) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (status) params.set('status', status);
  const qs = params.toString();

  try {
    const r = await req('GET', `/technician/activities${qs ? `?${qs}` : ''}`);
    if (!r) return emptyActivities;
    return {
      technicianName: r.technician_name,
      total: r.total || 0,
      completed: r.completed || 0,
      scheduled: r.scheduled || 0,
      inProgress: r.in_progress || 0,
      activities: (r.activities || []).map((a) => ({
        orderId: a.order_id,
        title: a.title,
        clientName: a.client_name,
        status: ENUM_TO_OS_STATUS[a.status] || (a.status ? a.status.toLowerCase() : undefined),
        scheduledDate: a.scheduled_date,
        scheduledEnd: a.scheduled_end,
        completedAt: a.completed_at,
        createdAt: a.created_at,
      })),
    };
  } catch (e) {
    console.error('[API] falha ao buscar histórico de atividades:', e.message);
    return emptyActivities;
  }
}

/** Upcoming maintenances already released by the ADM to the logged-in technician (with a day count). */
export async function getNextMaintenance() {
  try {
    const r = await req('GET', '/technician/next-maintenance');
    return (r || []).map((m) => ({
      planId: m.plan_id,
      clientId: m.client_id,
      clientName: m.client_name,
      description: m.description,
      nextMaintenanceDate: m.next_maintenance_date,
      daysUntilDue: m.days_until_due,
    }));
  } catch (e) {
    console.error('[API] falha ao buscar próximas manutenções:', e.message);
    return [];
  }
}

/** Records a service visit (text and/or up to 6 photos) on an in-progress service order. */
export async function addServiceRecord(orderId, { note, photos } = {}) {
  const token = getToken();
  const formData = new FormData();
  if (note) formData.append('note', note);
  (photos || []).forEach((file) => formData.append('photos', file));

  const res = await fetch(`${BASE}/technician/service-orders/${orderId}/records`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || res.statusText);
  }
  return res.json();
}

/** Starts a validated service order (technician), moving it to "em execução". */
export async function startServiceOrder(orderId) {
  return req('POST', `/technician/service-orders/${orderId}/start`);
}

/** Finishes an in-progress service order (technician), moving it to "concluída". */
export async function finishServiceOrder(orderId) {
  return req('POST', `/technician/service-orders/${orderId}/finish`);
}

/** Lists the records (text/photos) already made on a service order. */
export async function listServiceRecords(orderId) {
  try {
    const r = await req('GET', `/technician/service-orders/${orderId}/records`);
    return (r || []).map((rec) => ({
      id: rec.id,
      note: rec.note,
      createdAt: rec.created_at,
      photos: (rec.photos || []).map((p) => p.url),
    }));
  } catch (e) {
    console.error('[API] falha ao listar registros da OS:', e.message);
    return [];
  }
}

/* ─────────────────────────  Collaborators (ADM Master)  ───────────────────────── */

/** Full history of a collaborator (sales if a salesperson, service orders if a technician). */
export async function getCollaboratorDetail(id) {
  try {
    const r = await req('GET', `/admin/collaborators/${id}`);
    if (!r) return null;
    return {
      id: r.id,
      name: r.nome,
      matricula: r.matricula,
      role: PERFIL_TO_ROLE[r.perfil] || r.perfil,
      isActive: r.ativo,
      createdAt: r.criado_em,
      salesCount: r.sales_count || 0,
      totalRevenue: Number(r.total_revenue) || 0,
      serviceOrderCount: r.service_order_count || 0,
      completedServiceOrders: r.completed_service_orders || 0,
      sales: (r.sales || []).map((s) => ({
        saleId: s.sale_id,
        customerName: s.customer_name,
        total: Number(s.total) || 0,
        date: s.date,
      })),
      serviceOrders: (r.service_orders || []).map((o) => ({
        orderId: o.order_id,
        title: o.title,
        clientName: o.client_name,
        status: ENUM_TO_OS_STATUS[o.status] || (o.status ? o.status.toLowerCase() : undefined),
        createdAt: o.created_at,
        completedAt: o.completed_at,
      })),
    };
  } catch (e) {
    console.error('[API] falha ao buscar histórico do colaborador:', e.message);
    return null;
  }
}

/* ─────────────────────────  Preventive Maintenance (ADM Master)  ───────────────────────── */

const decodeMaintenancePlan = (p) => ({
  id: p.id,
  clientId: p.client_id,
  clientName: p.client_name,
  description: p.description,
  frequencyDays: p.frequency_days,
  lastMaintenanceDate: p.last_maintenance_date,
  nextMaintenanceDate: p.next_maintenance_date,
  active: p.active,
  daysUntilDue: p.days_until_due,
  released: !!p.released,
  technicianId: p.technician_id,
});

/** Lists all registered preventive maintenance plans. */
export async function getMaintenancePlans() {
  try {
    const r = await req('GET', '/admin/maintenance-plans');
    return (r || []).map(decodeMaintenancePlan);
  } catch (e) {
    console.error('[API] falha ao listar planos de manutenção:', e.message);
    return [];
  }
}

/** Creates a new preventive maintenance plan for a client. */
export async function createMaintenancePlan({ clientId, description, technicianId, frequencyDays, lastMaintenanceDate }) {
  const r = await req('POST', '/admin/maintenance-plans', clean({
    client_id: numOrNull(clientId),
    description: description || null,
    technician_id: numOrNull(technicianId),
    frequency_days: intOrNull(frequencyDays),
    last_maintenance_date: lastMaintenanceDate || null,
  }));
  return decodeMaintenancePlan(r);
}

/** Releases the plan so it shows up in the technician's counter. */
export async function releaseMaintenancePlan(id, technicianId) {
  const r = await req('POST', `/admin/maintenance-plans/${id}/release`, { technician_id: numOrNull(technicianId) });
  return decodeMaintenancePlan(r);
}

/* ─────────────────────  External orders (salesperson → ADM)  ─────────────────────
 * Real flow: the external salesperson SENDS the order (without touching stock) and the
 * ADM approves it — only on approval does it become a sale, deduct stock and generate the financials.
 * Don't confuse this with `db.Sale`, which is the already-finalized sale.
 */

const ORDER_STATUS_FROM_ENUM = {
  ENVIADO: 'enviado',
  APROVADO: 'aprovado',
  REJEITADO: 'rejeitado',
};

const decodeExternalOrder = (r) => ({
  id: r.id,
  seller_id: r.seller_id,
  seller_name: r.seller_name,
  client_name: r.customer_name,
  status: ORDER_STATUS_FROM_ENUM[r.status] || (r.status ? String(r.status).toLowerCase() : undefined),
  total_amount: r.total,
  notes: r.notes,
  rejection_reason: r.rejection_reason,
  sale_id: r.sale_id,
  created_date: r.created_at,
  sale_date: r.created_at,
  items: (r.items || []).map((it) => ({
    product_id: it.product_id,
    product_name: it.product_name,
    unit_price: it.unit_price,
    quantity: it.quantity,
    total: it.subtotal,
  })),
});

/** ADM's order queue. `status`: 'enviado' | 'aprovado' | 'rejeitado' (or empty = all). */
export async function getExternalOrders(status) {
  const enumStatus = status ? Object.keys(ORDER_STATUS_FROM_ENUM).find((k) => ORDER_STATUS_FROM_ENUM[k] === status) : null;
  try {
    const r = await req('GET', `/external-orders${enumStatus ? `?status=${enumStatus}` : ''}`);
    return (r || []).map(decodeExternalOrder);
  } catch (e) {
    console.error('[API] falha ao listar pedidos externos:', e.message);
    return [];
  }
}

/** Orders of the logged-in salesperson — the server already filters by owner, there's no way to see others'. */
export async function getMyExternalOrders() {
  try {
    const r = await req('GET', '/external-orders/mine');
    return (r || []).map(decodeExternalOrder);
  } catch (e) {
    console.error('[API] falha ao listar meus pedidos:', e.message);
    return [];
  }
}

/** External salesperson sends the order to the ADM. Doesn't deduct stock. */
export async function createExternalOrder({ clientName, notes, items }) {
  const r = await req('POST', '/external-orders', clean({
    customer_name: clientName || '',
    notes: notes || null,
    items: (items || []).map((i) => ({ product_id: numOrNull(i.product_id), quantity: i.quantity })),
  }));
  return decodeExternalOrder(r);
}

/** ADM approves: it becomes a real sale (validates and deducts stock now). */
export async function approveExternalOrder(id) {
  return decodeExternalOrder(await req('POST', `/external-orders/${id}/approve`));
}

/** ADM rejects it, with a reason. */
export async function rejectExternalOrder(id, reason) {
  return decodeExternalOrder(await req('POST', `/external-orders/${id}/reject`, { reason }));
}

/* ─────────────────────────  Contas a receber  ───────────────────────── */

/**
 * Receivables from the backend (`/admin/receivables`). Sources: sales and
 * completed service orders. The backend already returns the total summed.
 *
 * Financeiro used to filter service orders by a `payment_status` field that only
 * existed on the front — the backend never had it, so confirming never persisted.
 */
export async function getReceivables(status = 'PENDENTE') {
  try {
    const r = await req('GET', `/admin/receivables${status ? `?status=${status}` : ''}`);
    return { receivables: r?.receivables || [], total: Number(r?.total) || 0 };
  } catch (e) {
    console.error('[API] falha ao listar contas a receber:', e.message);
    return { receivables: [], total: 0 };
  }
}

/** Confirms receipt. Both fields are optional — the backend defaults to today. */
export async function confirmReceivable(id, { paymentMethod, receivedDate } = {}) {
  return req('POST', `/admin/receivables/${id}/confirm`, clean({
    payment_method: paymentMethod || undefined,
    received_date: receivedDate || undefined,
  }));
}

/* ─────────────────────────  Ativar/desativar produto  ───────────────────────── */

// achado F5: desativar já existia no backend (DELETE, via db.Product.remove);
// não existia como reverter. Ativar é novo dos dois lados.
export async function activateProduct(id) {
  return req('POST', `/products/${id}/activate`);
}

/* ─────────────────────────  Aprovação de cliente pendente  ───────────────────────── */

/**
 * achado F14: `ClientsPage.jsx` chamava `db.Client.update(id, { validation_status })`,
 * que passa pelo `Client.encode()` genérico — como só esse campo era passado,
 * `name`/`type`/`document` saíam vazios/undefined e o PUT falhava com 400,
 * silenciosamente (sem try/catch). O backend já tinha os endpoints certos,
 * prontos, nunca chamados pelo frontend.
 */
export async function approveClient(id) {
  return req('POST', `/clients/${id}/approve`);
}

export async function rejectClient(id, reason) {
  return req('POST', `/clients/${id}/reject`, { reason });
}

/* ─────────────────────────  Cancelamento de venda  ───────────────────────── */

/**
 * Cancela uma venda consolidada — soft delete (status vira CANCELADA, com
 * trilha de auditoria), estoque devolvido e lançamento financeiro revertido.
 * O backend valida a senha do ADM aqui dentro (achado F1: a tela chamava
 * `/api/auth/verify-admin`, que nunca existiu, seguido de um DELETE que
 * exigia papel ADM_MASTER — mas quem cancela é o Vendedor Interno).
 */
export async function cancelSale(saleId, { adminMatricula, adminPassword, reason }) {
  return req('POST', `/sales/${saleId}/cancel`, {
    admin_matricula: adminMatricula,
    admin_password: adminPassword,
    reason,
  });
}
