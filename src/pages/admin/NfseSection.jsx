import { useEffect, useRef, useState } from 'react';
import { FileText, ExternalLink, RefreshCw, AlertTriangle, XCircle } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Field';
import { getToken } from '@/api/auth';

const STATUS = {
  processando: { label: 'Processando…', tone: 'warning' },
  autorizado: { label: 'Autorizada', tone: 'success' },
  cancelado: { label: 'Cancelada', tone: 'muted' },
  erro: { label: 'Erro', tone: 'danger' },
  erro_autorizacao: { label: 'Erro de autorização', tone: 'danger' },
};

const JUSTIFICATIVA_MIN = 15;
const POLL_MS = 2000; // how often a note that is still "processando" is asked about

// These calls don't go through client.js's `req()`, so they attach the session
// token themselves — without it the backend rejects /api/nfse/** with 403.
const authHeaders = (extra = {}) => {
  const token = getToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
};

/**
 * NFS-e issuance section shown in the detail of a completed service order.
 * Only appears once the service order is completed. Issues via /api/nfse and polls until it's out of "processing".
 *
 * The backend derives client/value/description from the service order itself — the front only sends the id.
 * The issue button always stays visible, even without full configuration: the
 * pending issue (missing token, production not confirmed, etc.) shows in the banner
 * and, when trying to issue, the backend responds with 403 and the same message.
 */
export default function NfseSection({ os }) {
  const toast = useToast();
  const [nfseStatus, setNfseStatus] = useState(null); // configuration status (not the invoice's)
  const [invoice, setInvoice] = useState(null);
  const [emitting, setEmitting] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [justificativa, setJustificativa] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const pollRef = useRef(null);
  const consultingRef = useRef(false); // a round is still waiting for the server: don't start another

  // Loads config + this service order's existing invoice
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/nfse/status', { headers: authHeaders() });
        const s = await res.json();
        if (active) setNfseStatus(s);
      } catch { if (active) setNfseStatus({ configured: false }); }
      try {
        const r = await fetch('/api/nfse?service_order_id=' + encodeURIComponent(os.id),
          { headers: authHeaders() });
        if (r.ok) {
          const list = await r.json();
          if (active && list.length) setInvoice(list[0]);
        }
      } catch { /* no invoice yet */ }
    })();
    return () => { active = false; clearInterval(pollRef.current); };
  }, [os.id]);

  // Polling while it's processing
  useEffect(() => {
    clearInterval(pollRef.current);
    if (invoice?.status === 'processando') {
      pollRef.current = setInterval(consult, POLL_MS);
    }
    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice?.status, invoice?.id]);

  const emit = async () => {
    setEmitting(true);
    try {
      const res = await fetch('/api/nfse/emit', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ service_order_id: os.id }),
      });
      const body = await res.json();
      if (!res.ok) {
        // Validation errors arrive as { field: message } — join the messages together.
        const validationMsg = body && typeof body === 'object'
          ? Object.values(body).filter((v) => typeof v === 'string').join('; ')
          : '';
        toast.error(body.error || body.detail || body.message || validationMsg || 'Falha ao emitir NFS-e.');
        if (body.invoice) setInvoice(body.invoice);
        return;
      }
      setInvoice(body);
      toast.success('NFS-e enviada para emissão.');
    } catch (e) {
      toast.error('Erro de conexão ao emitir NFS-e.');
    } finally {
      setEmitting(false);
    }
  };

  const consult = async () => {
    if (!invoice || consultingRef.current) return;
    consultingRef.current = true;
    try {
      const res = await fetch(`/api/nfse/${invoice.id}/consult`, { headers: authHeaders() });
      const body = await res.json();
      if (res.ok) setInvoice(body);
    } catch { /* tries again on the next cycle */ } finally {
      consultingRef.current = false;
    }
  };

  const confirmCancel = async () => {
    if (!invoice || justificativa.trim().length < JUSTIFICATIVA_MIN) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/nfse/${invoice.id}/cancel`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ justificativa: justificativa.trim() }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error || 'Falha ao cancelar NFS-e.');
        return;
      }
      setInvoice(body);
      setCancelOpen(false);
      setJustificativa('');
      toast.success('NFS-e cancelada.');
    } catch {
      toast.error('Erro de conexão ao cancelar NFS-e.');
    } finally {
      setCancelling(false);
    }
  };

  // Only makes sense to issue an NFS-e for a completed service order
  if (os.status !== 'concluida') return null;

  const st = invoice ? (STATUS[invoice.status] || { label: invoice.status, tone: 'default' }) : null;
  const pendencia = nfseStatus?.pendencia;

  return (
    <div style={{ borderTop: '1px solid hsl(var(--border))', paddingTop: '1rem' }}>
      <p style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <FileText size={15} /> Nota Fiscal de Serviço (NFS-e)
      </p>

      {pendencia && !invoice && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.83rem', color: 'hsl(var(--warning))', background: 'hsl(var(--warning) / 0.1)', padding: '0.6rem 0.75rem', borderRadius: 'var(--radius)', marginBottom: '0.6rem' }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{pendencia}</span>
        </div>
      )}

      {nfseStatus?.simulate && !invoice && (
        <p style={{ fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))', marginBottom: '0.6rem' }}>
          Modo simulação — a nota emitida não terá valor fiscal.
        </p>
      )}

      {!invoice && (
        <Button onClick={emit} disabled={emitting}>
          <FileText size={16} /> {emitting ? 'Emitindo…' : 'Emitir NFS-e'}
        </Button>
      )}

      {invoice && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <Badge tone={st.tone}>{st.label}</Badge>
            {invoice.numero_nfse && <span style={{ fontSize: '0.85rem' }}>Nº {invoice.numero_nfse}</span>}
            {invoice.status === 'processando' && (
              <Button size="sm" variant="ghost" onClick={consult}><RefreshCw size={14} /> Atualizar</Button>
            )}
          </div>

          {invoice.status === 'autorizado' && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {invoice.url_pdf && <Button size="sm" variant="outline" onClick={() => window.open(invoice.url_pdf, '_blank')}><ExternalLink size={14} /> PDF</Button>}
              {invoice.url_xml && <Button size="sm" variant="outline" onClick={() => window.open(invoice.url_xml, '_blank')}><ExternalLink size={14} /> XML</Button>}
              <Button size="sm" variant="danger" onClick={() => setCancelOpen(true)}><XCircle size={14} /> Cancelar nota</Button>
            </div>
          )}

          {(invoice.status === 'erro' || invoice.status === 'erro_autorizacao') && (
            <>
              <p style={{ fontSize: '0.82rem', color: 'hsl(var(--destructive))', wordBreak: 'break-word' }}>
                {invoice.error_message || 'A prefeitura recusou a nota. Verifique os dados fiscais.'}
              </p>
              <Button size="sm" variant="outline" onClick={() => setInvoice(null)}>Tentar novamente</Button>
            </>
          )}
        </div>
      )}

      <Modal
        open={cancelOpen}
        onClose={() => { if (!cancelling) { setCancelOpen(false); setJustificativa(''); } }}
        title="Cancelar NFS-e"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <Button variant="outline" onClick={() => { setCancelOpen(false); setJustificativa(''); }} disabled={cancelling}>
              Voltar
            </Button>
            <Button
              variant="danger"
              onClick={confirmCancel}
              disabled={cancelling || justificativa.trim().length < JUSTIFICATIVA_MIN}
            >
              {cancelling ? 'Cancelando…' : 'Confirmar cancelamento'}
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.82rem', color: 'hsl(var(--warning))', background: 'hsl(var(--warning) / 0.1)', padding: '0.6rem 0.75rem', borderRadius: 'var(--radius)', marginBottom: '0.75rem' }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>O cancelamento tem prazo limitado (varia por município) e é irreversível. Passado o prazo, a prefeitura recusa e o imposto continua devido.</span>
        </div>
        <Textarea
          label="Justificativa"
          placeholder="Explique o motivo do cancelamento…"
          value={justificativa}
          onChange={(e) => setJustificativa(e.target.value)}
          rows={4}
        />
        <p style={{ fontSize: '0.75rem', color: justificativa.trim().length < JUSTIFICATIVA_MIN ? 'hsl(var(--destructive))' : 'hsl(var(--muted-foreground))', marginTop: '0.3rem' }}>
          {justificativa.trim().length}/{JUSTIFICATIVA_MIN} caracteres mínimos
        </p>
      </Modal>
    </div>
  );
}
