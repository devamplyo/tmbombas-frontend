import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Plus, RefreshCw, Copy, Download, AlertTriangle, XCircle } from 'lucide-react';
import {
  db, getInvoiceStatus, listInvoices, listPendingInvoices, getInvoice,
  emitNfe, emitNfseInvoice, consultInvoice, cancelInvoice,
} from '@/api/client';
import useAsyncData from '@/hooks/useAsyncData';
import { useToast } from '@/components/ui/Toast';
import PageHeader from '@/components/ui/PageHeader';
import Card, { CardHeader } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Table from '@/components/ui/Table';
import Spinner from '@/components/ui/Spinner';
import ConfirmSubmit from '@/components/ui/ConfirmSubmit';
import Pagination from '@/components/ui/Pagination';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { brl, dateTimeBR } from '@/lib/format';
import shared from '../shared.module.css';
import styles from './NotasFiscaisPage.module.css';

const JUSTIFICATIVA_MIN = 15;
const POLL_MS = 2000; // how often a note that is still "processando" is asked about
const PENDING_PAGE_SIZE = 8; // "Aguardando nota" cards per page
const INVOICE_PAGE_SIZE = 10; // rows of the notes table per page
const ITEMS_PREVIEW = 3; // item lines shown in a card; the rest opens in a popup
const LIST_ROWS_VISIBLE = 6; // item lines shown at once in the item lists ("Quem recebe" and the items popup); more scrolls

const TYPE_LABEL = { nfe: 'NF-e', nfse: 'NFS-e' };

// The server has five statuses; the screen shows four (both "error" ones are one group).
const STATUS_GROUP = {
  processando: 'processando',
  autorizado: 'autorizado',
  cancelado: 'cancelado',
  erro: 'erro',
  erro_autorizacao: 'erro',
};
const STATUS_VIEW = {
  autorizado: { label: 'Autorizada', tone: 'success' },
  processando: { label: 'Processando…', tone: 'warning' },
  erro: { label: 'Com erro', tone: 'danger' },
  cancelado: { label: 'Cancelada', tone: 'muted' },
};
const TILES = [
  ['autorizado', 'Autorizadas'],
  ['processando', 'Processando'],
  ['erro', 'Com erro'],
  ['cancelado', 'Canceladas'],
];
const groupOf = (status) => STATUS_GROUP[status] ?? status;

const EMPTY_RECIPIENT = {
  name: '', document: '', state_registration: '',
  street: '', number: '', district: '', city: '', state: '', zip_code: '',
};

const onlyDigits = (v) => String(v ?? '').replace(/\D/g, '');

function formatDocument(doc) {
  const d = onlyDigits(doc);
  if (d.length === 11) return `CPF ${d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}`;
  if (d.length === 14) return `CNPJ ${d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')}`;
  return doc || '';
}

function originOf(inv) {
  if (inv.type === 'nfe') return inv.sale_id ? `Venda #${inv.sale_id}` : '—';
  return inv.service_order_id ? `OS #${inv.service_order_id}` : '—';
}

/**
 * Issuing environment. Only PRODUÇÃO gets a banner (real fiscal value, easy to miss); simulated and
 * homologação modes show nothing on the page. `label` is the "Ambiente" line of the confirmation screen.
 */
function envView(status) {
  if (!status || status.simulate) return null;
  if (status.env === 'producao') {
    return {
      key: 'producao', tag: 'PRODUÇÃO', real: true,
      title: 'Atenção: as notas emitidas aqui têm valor fiscal REAL.',
      text: 'Cada emissão gera um documento oficial e o cancelamento tem prazo.',
      label: 'PRODUÇÃO (valor fiscal real)',
    };
  }
  return { key: 'homologacao', real: false, label: 'Homologação (sem valor fiscal)' };
}

/** Address of a registered client, in the same shape as the typed form. */
function clientAddress(c) {
  const a = c?.address || {};
  return {
    street: a.street || '', number: a.number || '', district: a.district || '',
    city: a.city || '', state: a.state || '', zip: a.zip_code || '',
  };
}

function missingAddress(a) {
  const missing = [];
  if (!String(a.street).trim()) missing.push('rua');
  if (!String(a.number).trim()) missing.push('número');
  if (!String(a.district).trim()) missing.push('bairro');
  if (!String(a.city).trim()) missing.push('cidade');
  if (String(a.state).trim().length !== 2) missing.push('UF');
  if (onlyDigits(a.zip).length !== 8) missing.push('CEP (8 números)');
  return missing;
}

function addressLine(a) {
  if (!a.street && !a.city) return '';
  const cep = onlyDigits(a.zip).replace(/^(\d{5})(\d{3})$/, '$1-$2');
  return `${a.street}, ${a.number} — ${a.district}, ${a.city}/${a.state}${cep ? ` — CEP ${cep}` : ''}`;
}

const formAddress = (f) => ({
  street: f.street, number: f.number, district: f.district, city: f.city, state: f.state, zip: f.zip_code,
});

/** What is wrong with the typed recipient (empty string = fine). */
function recipientProblem(f) {
  const doc = onlyDigits(f.document);
  if (doc.length !== 11 && doc.length !== 14) return 'Informe o CPF (11 números) ou o CNPJ (14 números).';
  if (!f.name.trim()) return 'Informe o nome do cliente.';
  const missing = missingAddress(formAddress(f));
  return missing.length ? `Falta o endereço: ${missing.join(', ')}.` : '';
}

function StatusBadge({ status }) {
  const v = STATUS_VIEW[groupOf(status)] || { label: status, tone: 'default' };
  return <Badge tone={v.tone}>{v.label}</Badge>;
}

/** One line per item: quantity, name (with the unit price when more than one) and subtotal. */
function ItemRows({ items }) {
  return items.map((it, i) => (
    <div key={i} className={styles.pendItem}>
      <span className={styles.pendQty}>{it.quantity}×</span>
      <div className={styles.pendItemText}>
        <span>{it.name}</span>
        {it.quantity > 1 && <small>{brl(it.unit_price)} cada</small>}
      </div>
      <span className={styles.val}>{brl(it.subtotal)}</span>
    </div>
  ));
}

/**
 * A box that scrolls only when it has more than `visible` rows: it is exactly as tall as its first `visible`
 * rows (plus the header, if any), whatever their heights (a row with a "cada" line or a wrapped name is taller).
 * `rowSelector` / `headSelector` say what the rows and the header are inside the box.
 */
function ScrollBox({ count, visible, className, rowSelector = ':scope > *', headSelector, children }) {
  const ref = useRef(null);
  const [maxHeight, setMaxHeight] = useState(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      if (count <= visible) {
        setMaxHeight(null);
        return;
      }
      const head = headSelector ? el.querySelector(headSelector) : null;
      const rows = Array.from(el.querySelectorAll(rowSelector)).slice(0, visible);
      const total = (head ? head.getBoundingClientRect().height : 0)
        + rows.reduce((h, row) => h + row.getBoundingClientRect().height, 0);
      setMaxHeight(Math.ceil(total));
    };
    measure();
    const observer = new ResizeObserver(measure); // the rows re-wrap when the window is resized
    observer.observe(el);
    return () => observer.disconnect();
  }, [count, visible, rowSelector, headSelector]);

  return (
    <div ref={ref} className={className} style={maxHeight ? { maxHeight } : undefined}>
      {children}
    </div>
  );
}

const TYPE_TABS = [['todas', 'Todas'], ['nfe', 'Vendas · NF-e'], ['nfse', 'Serviços · NFS-e']];

/** Type filter (all / NF-e / NFS-e). The page has two of them, one per list, so each has its own label. */
function TypeTabs({ label, value, onChange }) {
  return (
    <div className={styles.seg} role="tablist" aria-label={label}>
      {TYPE_TABS.map(([key, text]) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={value === key}
          className={value === key ? styles.on : ''}
          onClick={() => onChange(key)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

export default function NotasFiscaisPage() {
  const toast = useToast();
  const { data, loading, error, reload } = useAsyncData(async () => {
    const [status, pending, invoices] = await Promise.all([
      getInvoiceStatus(), listPendingInvoices(), listInvoices(),
    ]);
    return { status, pending, invoices };
  }, []);

  const status = data?.status;
  const pending = data?.pending || [];
  const invoices = data?.invoices || [];
  const env = envView(status);

  // two independent filters: the table of issued notes (below) and the "Aguardando nota" cards (above)
  const [tab, setTab] = useState('todas');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [pendTab, setPendTab] = useState('todas');
  const [pendSearch, setPendSearch] = useState('');
  const [pendingPage, setPendingPage] = useState(1);
  const [invoicePage, setInvoicePage] = useState(1);
  const [itemsFor, setItemsFor] = useState(null); // pending sale / OS whose full item list is open in a popup
  const pendingRef = useRef(null);

  // detail / cancel
  const [detail, setDetail] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // emission: `emit` is the pending item being issued; NF-e asks for the recipient first
  const [emit, setEmit] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [mode, setMode] = useState('cliente'); // cliente | digitar
  const [clientId, setClientId] = useState('');
  const [form, setForm] = useState(EMPTY_RECIPIENT);
  const [clients, setClients] = useState(null);
  const [saving, setSaving] = useState(false);

  // Notes still "processando" are asked about every POLL_MS until the SEFAZ / prefeitura answers.
  const processingIds = invoices.filter((i) => i.status === 'processando').map((i) => i.id).join(',');
  useEffect(() => {
    if (!processingIds) return undefined;
    let busy = false; // a round is still waiting for the server: don't start another
    const timer = setInterval(async () => {
      if (busy) return;
      busy = true;
      try {
        await Promise.all(processingIds.split(',').map((id) => consultInvoice(Number(id))
          .then((u) => u && setDetail((d) => (d && d.id === u.id ? u : d)))
          .catch(() => { /* tries again on the next cycle */ })));
        reload();
      } finally {
        busy = false;
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [processingIds, reload]);

  const counts = useMemo(() => {
    const c = { autorizado: 0, processando: 0, erro: 0, cancelado: 0 };
    invoices.forEach((i) => { const g = groupOf(i.status); if (g in c) c[g] += 1; });
    return c;
  }, [invoices]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qDigits = onlyDigits(search);
    return invoices.filter((i) => {
      if (tab !== 'todas' && i.type !== tab) return false;
      if (statusFilter && groupOf(i.status) !== statusFilter) return false;
      if (!q) return true;
      return (i.client_name || '').toLowerCase().includes(q)
        || String(i.number || '').toLowerCase() === q
        || (qDigits && onlyDigits(i.client_document).includes(qDigits));
    });
  }, [invoices, tab, statusFilter, search]);

  // "Aguardando nota" has its own type tab and search; they never touch the table of issued notes
  const pendingFiltered = useMemo(() => {
    const q = pendSearch.trim().toLowerCase();
    return pending.filter((p) => {
      if (pendTab !== 'todas' && p.type !== pendTab) return false;
      if (!q) return true;
      return (p.client_name || '').toLowerCase().includes(q) || (p.origin_label || '').toLowerCase().includes(q);
    });
  }, [pending, pendTab, pendSearch]);

  // a new filter starts over from the first page
  useEffect(() => { setPendingPage(1); }, [pendTab, pendSearch]);
  useEffect(() => { setInvoicePage(1); }, [tab, search, statusFilter]);

  const columns = [
    { key: 'type', header: 'Tipo', render: (r) => <Badge tone="primary">{TYPE_LABEL[r.type] || r.type}</Badge> },
    { key: 'number', header: 'Nº', render: (r) => r.number || '—' },
    { key: 'origin', header: 'Origem', render: originOf },
    {
      key: 'client_name', header: 'Cliente',
      render: (r) => (
        <div>
          {r.client_name || '—'}
          <div className={shared.muted}>{formatDocument(r.client_document)}</div>
        </div>
      ),
    },
    { key: 'value', header: 'Valor', align: 'right', render: (r) => brl(r.value) },
    { key: 'created_at', header: 'Data', render: (r) => dateTimeBR(r.created_at) },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ];

  /* ─────────────  detail  ───────────── */

  const openDetail = async (row) => {
    setDetail(row);
    try {
      const full = await getInvoice(row.id); // the list has no items; the detail does
      setDetail((d) => (d && d.id === full.id ? full : d));
    } catch (e) {
      toast.error(e.message || 'Não foi possível abrir a nota.');
    }
  };

  const closeDetail = () => { if (!cancelOpen) setDetail(null); };

  const refreshOne = async () => {
    setRefreshing(true);
    try {
      setDetail(await consultInvoice(detail.id));
      reload();
    } catch (e) {
      toast.error(e.message || 'Não foi possível atualizar o status.');
    } finally {
      setRefreshing(false);
    }
  };

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(detail.chave_acesso);
      toast.success('Chave copiada.');
    } catch {
      toast.error('Não foi possível copiar. Selecione a chave e copie.');
    }
  };

  const openFile = (url) => window.open(url, '_blank', 'noopener');

  const confirmCancel = async () => {
    if (reason.trim().length < JUSTIFICATIVA_MIN) return;
    setCancelling(true);
    try {
      setDetail(await cancelInvoice(detail.id, reason.trim()));
      setCancelOpen(false);
      setReason('');
      toast.success('Nota cancelada.');
      reload();
    } catch (e) {
      toast.error(e.message || 'Não foi possível cancelar a nota.');
    } finally {
      setCancelling(false);
    }
  };

  /* ─────────────  emission  ───────────── */

  const startEmit = (item) => {
    setForm({
      ...EMPTY_RECIPIENT,
      name: item.client_name && item.client_name !== 'Consumidor (balcão)' ? item.client_name : '',
    });
    setClientId('');
    setMode('cliente');
    setEmit(item);
    if (item.type === 'nfe') {
      setConfirmOpen(false);
      if (!clients) db.Client.list().then(setClients).catch(() => setClients([]));
    } else {
      setConfirmOpen(true); // NFS-e: the client comes from the service order, nothing to ask
    }
  };

  const closeEmit = () => { if (!saving) { setEmit(null); setConfirmOpen(false); } };

  const retryFromDetail = () => {
    const originId = detail.type === 'nfe' ? detail.sale_id : detail.service_order_id;
    const item = pending.find((p) => p.type === detail.type && String(p.origin_id) === String(originId));
    if (!item) {
      toast.error('Esta venda ou OS não está mais aguardando nota.');
      return;
    }
    setDetail(null);
    startEmit(item);
  };

  const goToPending = () => {
    if (!pending.length) {
      toast.error('Não há vendas nem OS aguardando nota.');
      return;
    }
    pendingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const selectedClient = (clients || []).find((c) => String(c.id) === String(clientId));
  const selectedClientMissing = selectedClient ? missingAddress(clientAddress(selectedClient)) : [];

  const goConfirm = () => {
    if (mode === 'cliente') {
      if (!selectedClient) return toast.error('Escolha o cliente ou digite os dados.');
      if (selectedClientMissing.length) {
        return toast.error(`Falta no cadastro do cliente: ${selectedClientMissing.join(', ')}.`);
      }
    } else {
      const problem = recipientProblem(form);
      if (problem) return toast.error(problem);
    }
    setConfirmOpen(true);
  };

  // what the confirmation shows and what is sent
  let view = null;
  if (emit) {
    if (emit.type === 'nfse') {
      view = { name: emit.client_name, document: emit.client_document, address: '' };
    } else if (mode === 'cliente') {
      view = {
        name: selectedClient?.name, document: selectedClient?.document,
        address: selectedClient ? addressLine(clientAddress(selectedClient)) : '',
      };
    } else {
      view = { name: form.name.trim(), document: form.document, address: addressLine(formAddress(form)) };
    }
  }

  const submitEmit = async () => {
    setSaving(true);
    try {
      let inv;
      if (emit.type === 'nfse') {
        inv = await emitNfseInvoice(emit.origin_id);
      } else if (mode === 'cliente') {
        inv = await emitNfe(emit.origin_id, { clientId: selectedClient.id });
      } else {
        inv = await emitNfe(emit.origin_id, {
          name: form.name.trim(),
          document: onlyDigits(form.document),
          stateRegistration: onlyDigits(form.state_registration),
          street: form.street.trim(),
          number: form.number.trim(),
          district: form.district.trim(),
          city: form.city.trim(),
          state: form.state.trim().toUpperCase(),
          zipCode: onlyDigits(form.zip_code),
        });
      }
      const label = TYPE_LABEL[emit.type];
      if (inv?.status === 'autorizado') toast.success(`${label} autorizada.`);
      else if (groupOf(inv?.status) === 'erro') toast.error(`A ${label} não foi aceita. Veja o motivo.`);
      else toast.success(`${label} enviada. Aguardando resposta…`);
      setEmit(null);
      setConfirmOpen(false);
      reload();
      if (inv) setDetail(inv);
    } catch (e) {
      toast.error(e.message || 'Não foi possível emitir a nota.');
      // NF-e: back to the form, where the data can be corrected
      if (emit.type === 'nfe') setConfirmOpen(false);
      reload();
    } finally {
      setSaving(false);
    }
  };

  /* ─────────────  render  ───────────── */

  if (loading && !data) return <div className={shared.loading}><Spinner /></div>;

  if (error && !data) {
    return (
      <div>
        <PageHeader title="Notas Fiscais" subtitle="Emita e acompanhe as notas de venda (NF-e) e de serviço (NFS-e)." />
        <div className={styles.warnBox}>
          <AlertTriangle size={16} />
          <span>Não foi possível carregar as notas fiscais: {error.message || 'erro desconhecido'}.</span>
          <Button size="sm" variant="outline" onClick={reload}>Tentar de novo</Button>
        </div>
      </div>
    );
  }

  // the page is clamped: emitting the last card of the last page must not leave an empty page behind
  const pendingPages = Math.max(1, Math.ceil(pendingFiltered.length / PENDING_PAGE_SIZE));
  const pendingPageNow = Math.min(pendingPage, pendingPages);
  const visiblePending = pendingFiltered.slice((pendingPageNow - 1) * PENDING_PAGE_SIZE, pendingPageNow * PENDING_PAGE_SIZE);
  const invoicePages = Math.max(1, Math.ceil(filtered.length / INVOICE_PAGE_SIZE));
  const invoicePageNow = Math.min(invoicePage, invoicePages);
  const visibleInvoices = filtered.slice((invoicePageNow - 1) * INVOICE_PAGE_SIZE, invoicePageNow * INVOICE_PAGE_SIZE);
  const cancelLen = reason.trim().length;
  const popupItems = itemsFor?.items || [];
  const popupUnits = popupItems.reduce((sum, i) => sum + (i.quantity || 0), 0);

  return (
    <div>
      <PageHeader
        title="Notas Fiscais"
        subtitle="Emita e acompanhe as notas de venda (NF-e) e de serviço (NFS-e)."
        actions={<Button onClick={goToPending}><Plus size={18} /> Emitir nota</Button>}
      />

      {env?.real && (
        <div className={[styles.env, styles[env.key]].join(' ')} role="status">
          <span className={styles.envTag}>{env.tag}</span>
          <div className={styles.envText}>
            <b>{env.title}</b>
            <span>{env.text}</span>
          </div>
        </div>
      )}
      {status?.pendencia && (
        <div className={styles.warnBox}>
          <AlertTriangle size={16} />
          <span>{status.pendencia}</span>
        </div>
      )}

      <div className={styles.tiles}>
        {TILES.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={[styles.tile, styles[key], statusFilter === key ? styles.on : ''].filter(Boolean).join(' ')}
            onClick={() => setStatusFilter(statusFilter === key ? '' : key)}
          >
            <small>{label}</small>
            <strong>{counts[key]}</strong>
          </button>
        ))}
      </div>

      <div ref={pendingRef} className={styles.section}>
        <Card>
          <CardHeader
            title={<>Aguardando nota <Badge tone="warning">{pendingFiltered.length}</Badge></>}
            subtitle="Confira os itens de cada venda ou OS e emita a nota"
          />
          {pending.length > 0 && (
            <div className={styles.pendToolbar}>
              <TypeTabs label="Filtrar as notas que faltam emitir" value={pendTab} onChange={setPendTab} />
              <input
                className={shared.search}
                placeholder="Buscar por cliente ou nº da venda/OS..."
                value={pendSearch}
                onChange={(e) => setPendSearch(e.target.value)}
                aria-label="Buscar entre as notas que faltam emitir"
              />
            </div>
          )}
          {pendingFiltered.length === 0 ? (
            <div className={styles.empty}>
              {pending.length === 0 ? 'Nenhuma venda ou OS aguardando nota.' : 'Nenhuma venda ou OS aguardando nota com esse filtro.'}
            </div>
          ) : (
            <div className={styles.pendBody}>
              <div className={styles.pendGrid}>
                {visiblePending.map((p) => {
                  const key = `${p.type}-${p.origin_id}`;
                  const items = p.items || [];
                  const noClient = p.type === 'nfse' && !p.has_client;
                  return (
                    <div key={key} className={styles.pendCard}>
                      <div className={styles.pendHead}>
                        <div className={styles.pendTitle}>
                          <Badge tone="primary">{TYPE_LABEL[p.type]}</Badge>
                          <b>{p.origin_label}</b>
                        </div>
                        <span className={styles.pendDate}>{dateTimeBR(p.created_at)}</span>
                      </div>

                      <div className={styles.pendClient}>
                        <strong>{p.client_name}</strong>
                        {p.client_document && <span>{formatDocument(p.client_document)}</span>}
                      </div>

                      <div className={styles.pendItems}>
                        <div className={styles.pendItemsHead}>
                          <span>{p.type === 'nfse' ? 'Serviço' : `Itens (${items.length})`}</span>
                          <span>Valor</span>
                        </div>
                        <ItemRows items={items.slice(0, ITEMS_PREVIEW)} />
                        {items.length > ITEMS_PREVIEW && (
                          <button type="button" className={styles.linkBtn} onClick={() => setItemsFor(p)}>
                            Ver todos os {items.length} itens
                          </button>
                        )}
                      </div>

                      <div className={styles.pendTotal}>
                        <span>Total</span>
                        <strong>{brl(p.total)}</strong>
                      </div>

                      <Button
                        className={styles.pendBtn}
                        onClick={() => startEmit(p)}
                        disabled={noClient}
                        title={noClient ? 'A OS não tem cliente cadastrado.' : undefined}
                      >
                        Emitir {TYPE_LABEL[p.type]}
                      </Button>
                    </div>
                  );
                })}
              </div>
              <Pagination
                className={styles.pendPager}
                page={pendingPageNow}
                pageSize={PENDING_PAGE_SIZE}
                total={pendingFiltered.length}
                onChange={(n) => {
                  setPendingPage(n);
                  pendingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              />
            </div>
          )}
        </Card>
      </div>

      <h2 className={styles.listTitle}>Notas emitidas</h2>
      <div className={shared.toolbar}>
        <TypeTabs label="Filtrar as notas emitidas" value={tab} onChange={setTab} />
        <div className="grow" style={{ flex: 1, minWidth: 200 }}>
          <input
            className={shared.search}
            placeholder="Buscar por cliente, CPF/CNPJ ou nº da nota..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar entre as notas emitidas"
          />
        </div>
        <select
          className={shared.search}
          style={{ width: 'auto' }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filtrar por status"
        >
          <option value="">Todos os status</option>
          {TILES.map(([key]) => <option key={key} value={key}>{STATUS_VIEW[key].label.replace('…', '')}</option>)}
        </select>
      </div>

      <Card>
        <Table
          columns={columns}
          rows={visibleInvoices}
          empty="Nenhuma nota encontrada com esses filtros."
          onRowClick={openDetail}
        />
        <Pagination
          page={invoicePageNow}
          pageSize={INVOICE_PAGE_SIZE}
          total={filtered.length}
          onChange={setInvoicePage}
        />
      </Card>

      {/* ── every item of a pending sale / OS ── */}
      {itemsFor && (
        <Modal
          open
          onClose={() => setItemsFor(null)}
          width={700}
          title={`${TYPE_LABEL[itemsFor.type]} · ${itemsFor.origin_label}`}
          footer={
            // the total stays in view while a long list scrolls
            <div className={styles.popFooter}>
              <div className={styles.footTotal}>
                <span>Total</span>
                <strong>{brl(itemsFor.total)}</strong>
              </div>
              <div className={styles.footBtns}>
                <Button variant="ghost" onClick={() => setItemsFor(null)}>Fechar</Button>
                <Button
                  onClick={() => { const p = itemsFor; setItemsFor(null); startEmit(p); }}
                  disabled={itemsFor.type === 'nfse' && !itemsFor.has_client}
                >
                  Emitir {TYPE_LABEL[itemsFor.type]}
                </Button>
              </div>
            </div>
          }
        >
          <div className={styles.detail}>
            <div className={styles.whoBox}>
              <strong>{itemsFor.client_name}</strong>
              <span className={shared.muted}>
                {[formatDocument(itemsFor.client_document), dateTimeBR(itemsFor.created_at)].filter(Boolean).join(' · ')}
              </span>
            </div>

            <div>
              <div className={styles.lbl}>
                {itemsFor.type === 'nfse'
                  ? 'Serviço'
                  : `${popupItems.length} ${popupItems.length === 1 ? 'item' : 'itens'} · ${popupUnits} ${popupUnits === 1 ? 'unidade' : 'unidades'}`}
              </div>
              <ScrollBox
                className={styles.itemsScroll}
                count={popupItems.length}
                visible={LIST_ROWS_VISIBLE}
                rowSelector="tbody tr"
                headSelector="thead"
              >
                <table className={styles.itemsTable}>
                  <thead>
                    <tr>
                      <th>Qtd</th>
                      <th>{itemsFor.type === 'nfse' ? 'Descrição' : 'Item'}</th>
                      <th className={styles.num}>Valor unit.</th>
                      <th className={styles.num}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {popupItems.map((it, i) => (
                      <tr key={i}>
                        <td className={styles.pendQty}>{it.quantity}×</td>
                        <td>{it.name}</td>
                        <td className={styles.num}>{brl(it.unit_price)}</td>
                        <td className={styles.num}><b>{brl(it.subtotal)}</b></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollBox>
            </div>
          </div>
        </Modal>
      )}

      {/* ── detail ── */}
      {detail && (
        <Modal
          open
          onClose={closeDetail}
          width={600}
          title={`${TYPE_LABEL[detail.type] || 'Nota'} nº ${detail.number || '—'} · ${brl(detail.value)}`}
          footer={<Button variant="ghost" onClick={closeDetail}>Fechar</Button>}
        >
          <div className={styles.detail}>
            <div className={styles.badges}>
              <Badge tone="primary">{TYPE_LABEL[detail.type] || detail.type}</Badge>
              <StatusBadge status={detail.status} />
              <span className={shared.muted}>{originOf(detail)}</span>
            </div>

            <div>
              <div className={styles.lbl}>Cliente</div>
              <div className={styles.whoBox}>
                <strong>{detail.client_name || '—'}</strong>
                <span className={shared.muted}>{formatDocument(detail.client_document)}</span>
              </div>
            </div>

            <div>
              <div className={styles.lbl}>Itens</div>
              {(detail.items || []).length === 0 ? (
                <div className={shared.muted}>{detail.description || '—'}</div>
              ) : (
                detail.items.map((it, i) => (
                  <div key={i} className={styles.line}>
                    <span>{it.quantity}× {it.name}</span>
                    <span className={styles.val}>{brl(it.subtotal)}</span>
                  </div>
                ))
              )}
              <div className={styles.total}>
                <span>Total</span>
                <strong>{brl(detail.value)}</strong>
              </div>
            </div>

            {groupOf(detail.status) === 'erro' && (
              <div className={styles.errbox}>
                <b>A nota não foi emitida</b>
                <span>{detail.error_message || 'Sem detalhes do motivo.'}</span>
              </div>
            )}

            {detail.chave_acesso && (
              <div>
                <div className={styles.lbl}>Chave de acesso</div>
                <div className={styles.key}>
                  <code>{detail.chave_acesso}</code>
                  <Button size="sm" variant="outline" onClick={copyKey}><Copy size={14} /> Copiar</Button>
                </div>
                {detail.protocolo && <div className={shared.muted} style={{ marginTop: '0.35rem' }}>Protocolo: {detail.protocolo}</div>}
              </div>
            )}

            <div>
              <div className={styles.lbl}>Andamento</div>
              <ul className={styles.steps}>
                <li><div>Nota enviada<small>{dateTimeBR(detail.created_at)}</small></div></li>
                {groupOf(detail.status) === 'processando' && (
                  <li className={styles.pendingStep}>
                    <div>
                      Aguardando resposta da {detail.type === 'nfe' ? 'SEFAZ' : 'prefeitura'}
                      <small>Atualiza sozinha em alguns segundos</small>
                    </div>
                  </li>
                )}
                {groupOf(detail.status) === 'erro' && (
                  <li className={styles.failStep}><div>Recusada<small>Veja o motivo acima</small></div></li>
                )}
                {(groupOf(detail.status) === 'autorizado' || groupOf(detail.status) === 'cancelado') && (
                  <li>
                    <div>
                      Autorizada pela {detail.type === 'nfe' ? 'SEFAZ' : 'prefeitura'}
                      {detail.protocolo && <small>Protocolo {detail.protocolo}</small>}
                    </div>
                  </li>
                )}
                {groupOf(detail.status) === 'cancelado' && (
                  <li className={styles.offStep}><div>Nota cancelada<small>{dateTimeBR(detail.cancelled_at)}</small></div></li>
                )}
              </ul>
            </div>

            <div className={styles.actions}>
              {(groupOf(detail.status) === 'autorizado' || groupOf(detail.status) === 'cancelado') && (
                <>
                  {detail.url_pdf && (
                    <Button size="sm" variant="outline" onClick={() => openFile(detail.url_pdf)}>
                      <Download size={14} /> {detail.type === 'nfe' ? 'Baixar DANFE (PDF)' : 'Baixar DANFSe (PDF)'}
                    </Button>
                  )}
                  {detail.url_xml && (
                    <Button size="sm" variant="outline" onClick={() => openFile(detail.url_xml)}>
                      <Download size={14} /> Baixar XML
                    </Button>
                  )}
                </>
              )}
              {groupOf(detail.status) === 'processando' && (
                <Button size="sm" variant="outline" onClick={refreshOne} disabled={refreshing}>
                  <RefreshCw size={14} /> {refreshing ? 'Atualizando...' : 'Atualizar status'}
                </Button>
              )}
              {groupOf(detail.status) === 'erro' && (
                <Button size="sm" onClick={retryFromDetail}>Corrigir e emitir de novo</Button>
              )}
              {groupOf(detail.status) === 'autorizado' && (
                <>
                  <span className={styles.spacer} />
                  <Button size="sm" variant="danger" onClick={() => { setReason(''); setCancelOpen(true); }}>
                    <XCircle size={14} /> Cancelar nota
                  </Button>
                </>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* ── cancel ── */}
      {detail && cancelOpen && (
        <Modal
          open
          onClose={() => !cancelling && setCancelOpen(false)}
          title="Cancelar nota"
          footer={
            <>
              <Button variant="ghost" onClick={() => setCancelOpen(false)} disabled={cancelling}>Voltar</Button>
              <Button variant="danger" onClick={confirmCancel} disabled={cancelling || cancelLen < JUSTIFICATIVA_MIN}>
                {cancelling ? 'Cancelando...' : 'Cancelar nota'}
              </Button>
            </>
          }
        >
          <div className={styles.detail}>
            <p className={shared.muted}>
              {TYPE_LABEL[detail.type]} nº {detail.number || '—'} · {detail.client_name}
              {detail.type === 'nfe'
                ? ' · o prazo costuma ser de 24 horas após a emissão'
                : ' · o prazo depende do município'}
            </p>
            <Textarea
              label="Motivo do cancelamento"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explique o motivo (mínimo 15 caracteres)"
            />
            <span className={shared.muted}>{cancelLen} / {JUSTIFICATIVA_MIN} caracteres</span>
            <div className={styles.warnBox}>
              <AlertTriangle size={16} />
              <span>O cancelamento só vale dentro do prazo. Depois dele, a nota fica e o imposto é devido.</span>
            </div>
          </div>
        </Modal>
      )}

      {/* ── NF-e: who receives it ── */}
      {emit && emit.type === 'nfe' && (
        <Modal
          open
          onClose={closeEmit}
          width={600}
          title="Quem recebe a NF-e?"
          footer={
            <>
              <Button variant="ghost" onClick={closeEmit}>Cancelar</Button>
              <Button onClick={goConfirm}>Continuar</Button>
            </>
          }
        >
          <div className={styles.detail}>
            <div className={styles.saleBox}>
              <div className={styles.saleHead}>
                <div>
                  <b>{emit.origin_label}</b>
                  <span className={shared.muted}>
                    {' · '}{(emit.items || []).length} {(emit.items || []).length === 1 ? 'item' : 'itens'}
                  </span>
                </div>
                <strong>{brl(emit.total)}</strong>
              </div>
              <ScrollBox className={styles.saleItems} count={(emit.items || []).length} visible={LIST_ROWS_VISIBLE}>
                <ItemRows items={emit.items || []} />
              </ScrollBox>
            </div>

            <div className={styles.seg} role="tablist">
              <button type="button" role="tab" aria-selected={mode === 'cliente'} className={mode === 'cliente' ? styles.on : ''} onClick={() => setMode('cliente')}>
                Cliente cadastrado
              </button>
              <button type="button" role="tab" aria-selected={mode === 'digitar'} className={mode === 'digitar' ? styles.on : ''} onClick={() => setMode('digitar')}>
                Digitar os dados
              </button>
            </div>

            {mode === 'cliente' ? (
              <>
                <Select label="Cliente" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                  <option value="">{clients ? 'Escolha o cliente…' : 'Carregando…'}</option>
                  {(clients || []).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.document ? ` — ${c.document}` : ''}</option>
                  ))}
                </Select>
                {clients && clients.length === 0 && <span className={shared.muted}>Nenhum cliente cadastrado. Use "Digitar os dados".</span>}
                {selectedClient && selectedClientMissing.length > 0 && (
                  <div className={styles.warnBox}>
                    <AlertTriangle size={16} />
                    <span>
                      Este cliente está sem: {selectedClientMissing.join(', ')}. Complete o cadastro em Clientes
                      ou use "Digitar os dados".
                    </span>
                  </div>
                )}
              </>
            ) : (
              <>
                <span className={shared.muted}>Cliente de balcão não está cadastrado, então os dados são pedidos na hora.</span>
                <div className={shared.formGrid}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <Input label="Nome*" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <Input label="CPF ou CNPJ*" inputMode="numeric" placeholder="Somente números" value={form.document}
                    onChange={(e) => setForm({ ...form, document: e.target.value })} />
                  <Input label="Inscrição estadual" inputMode="numeric" placeholder="Só empresa contribuinte de ICMS" value={form.state_registration}
                    onChange={(e) => setForm({ ...form, state_registration: e.target.value })} />
                  <Input label="Rua*" value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} />
                  <Input label="Número*" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
                  <Input label="Bairro*" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} />
                  <Input label="Cidade*" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                  <Input label="UF*" maxLength={2} value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} />
                  <Input label="CEP*" inputMode="numeric" value={form.zip_code}
                    onChange={(e) => setForm({ ...form, zip_code: e.target.value })} />
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* ── "Confira antes de emitir" ── */}
      {emit && view && (
        <ConfirmSubmit
          open={confirmOpen}
          title={`Confira a ${TYPE_LABEL[emit.type]} antes de emitir`}
          client={view.name}
          rows={[
            { label: 'Documento', value: formatDocument(view.document) },
            ...(view.address ? [{ label: 'Endereço', value: view.address }] : []),
            { label: 'Origem', value: emit.origin_label },
            ...(env ? [{ label: 'Ambiente', value: env.label }] : []),
          ]}
          items={(emit.items || []).map((i) => ({
            title: i.name,
            subtitle: `${i.quantity} × ${brl(i.unit_price)}`,
            amount: i.subtotal,
          }))}
          total={emit.total}
          ack={env?.real ? 'Conferi os dados e entendo que esta nota é oficial e tem valor fiscal REAL.' : undefined}
          saving={saving}
          confirmLabel={`Emitir ${TYPE_LABEL[emit.type]}`}
          onCancel={() => (emit.type === 'nfe' ? setConfirmOpen(false) : closeEmit())}
          onConfirm={submitEmit}
        />
      )}
    </div>
  );
}
