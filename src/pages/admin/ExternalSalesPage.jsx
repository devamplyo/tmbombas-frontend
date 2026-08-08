import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { db, getExternalOrders, approveExternalOrder, rejectExternalOrder } from '@/api/client';
import useAsyncData from '@/hooks/useAsyncData';
import { useToast } from '@/components/ui/Toast';
import PageHeader from '@/components/ui/PageHeader';
import Card, { CardBody } from '@/components/ui/Card';
import ListRow from '@/components/ui/ListRow';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import { Select, Textarea } from '@/components/ui/Field';
import { brl, dateBR } from '@/lib/format';
import { ORDER_STATUS } from '@/lib/status';
import shared from '../shared.module.css';

const PERIODS = [
  { value: 7, label: '7 dias' },
  { value: 30, label: '30 dias' },
  { value: 90, label: '90 dias' },
  { value: 0, label: 'Tudo' },
];

export default function ExternalSalesPage() {
  const toast = useToast();
  const { data, loading, reload } = useAsyncData(async () => {
    const [pending, sales] = await Promise.all([
      getExternalOrders('enviado'),
      db.Sale.list('-created_date'),
    ]);
    return { pending, sales };
  }, []);
  const [tab, setTab] = useState('reservas');
  const [period, setPeriod] = useState(30);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const approve = async (order) => {
    setBusy(true);
    try {
      await approveExternalOrder(order.id);
      toast.success('Pedido faturado — estoque baixado e conta a receber gerada.');
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmReject = async () => {
    if (!reason.trim()) return toast.error('Informe o motivo da recusa.');
    setBusy(true);
    try {
      await rejectExternalOrder(rejecting.id, reason.trim());
      toast.success('Pedido recusado.');
      setRejecting(null); setReason('');
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className={shared.loading}><Spinner /></div>;
  const { pending, sales } = data;

  const cutoff = period ? Date.now() - period * 24 * 60 * 60 * 1000 : 0;
  const inPeriod = (sales || []).filter(
    (s) => s.status !== 'cancelada' && (!period || new Date(s.created_date || s.sale_date).getTime() >= cutoff)
  );

  const bySeller = {};
  inPeriod.forEach((s) => {
    const key = s.seller_name || 'Sem vendedor';
    if (!bySeller[key]) bySeller[key] = { name: key, total: 0, count: 0 };
    bySeller[key].total += s.total_amount || 0;
    bySeller[key].count += 1;
  });
  const productivity = Object.values(bySeller).sort((a, b) => b.total - a.total);

  return (
    <div>
      <PageHeader
        title="Vendas Externas"
        subtitle="Produtividade, reservas e faturamento"
        actions={
          <Select value={period} onChange={(e) => setPeriod(Number(e.target.value))} style={{ maxWidth: 160 }}>
            {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </Select>
        }
      />

      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.25rem' }}>
        <Button size="sm" variant={tab === 'reservas' ? 'primary' : 'outline'} onClick={() => setTab('reservas')}>
          Reservas ({pending.length})
        </Button>
        <Button size="sm" variant={tab === 'produtividade' ? 'primary' : 'outline'} onClick={() => setTab('produtividade')}>
          Produtividade
        </Button>
      </div>

      {tab === 'reservas' ? (
        pending.length === 0 ? (
          <Card><CardBody><div className={shared.loading}>Nenhum pedido aguardando faturamento.</div></CardBody></Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            {pending.map((r) => (
              <Card key={r.id}>
                <CardBody>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }}>{r.client_name || 'Sem cliente'}</div>
                      <div style={{ fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))', marginBottom: '0.4rem' }}>
                        Vendedor: {r.seller_name || '—'} · {dateBR(r.sale_date)}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))', marginBottom: '0.3rem' }}>
                        {(r.items || []).length} item(ns)
                      </div>
                      {(r.items || []).map((it, i) => (
                        <div key={i} style={{ fontSize: '0.82rem' }}>{it.quantity}× {it.product_name} — {brl(it.total)}</div>
                      ))}
                      <div style={{ fontSize: '0.85rem', marginTop: '0.4rem' }}>Total: <strong>{brl(r.total_amount)}</strong></div>
                      {r.notes && (
                        <div style={{ fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))', marginTop: '0.3rem' }}>{r.notes}</div>
                      )}
                    </div>
                    <Badge tone={ORDER_STATUS[r.status]?.tone}>{ORDER_STATUS[r.status]?.label}</Badge>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.9rem' }}>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => approve(r)}>
                      <Check size={14} /> Faturar Pedido
                    </Button>
                    <Button size="sm" variant="danger" disabled={busy} onClick={() => { setRejecting(r); setReason(''); }}>
                      <X size={14} /> Recusar
                    </Button>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )
      ) : (
        <Card>
          <CardBody style={{ padding: 0 }}>
            {productivity.length === 0 ? (
              <div className={shared.loading} style={{ padding: '2rem' }}>Sem vendas no período.</div>
            ) : (
              productivity.map((p) => (
                <ListRow
                  key={p.name}
                  title={p.name}
                  subtitle={`${p.count} pedido(s)`}
                  right={<strong>{brl(p.total)}</strong>}
                />
              ))
            )}
          </CardBody>
        </Card>
      )}

      <Modal open={!!rejecting} onClose={() => setRejecting(null)} title="Recusar pedido"
        footer={<>
          <Button variant="ghost" onClick={() => setRejecting(null)}>Cancelar</Button>
          <Button variant="danger" disabled={busy} onClick={confirmReject}>Recusar pedido</Button>
        </>}>
        <Textarea label="Motivo da recusa*" rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="Ex: produto sem estoque suficiente" />
      </Modal>
    </div>
  );
}
