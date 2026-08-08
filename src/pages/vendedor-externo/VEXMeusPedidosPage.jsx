import { useState } from 'react';
import { getMyExternalOrders } from '@/api/client';
import useAsyncData from '@/hooks/useAsyncData';
import PageHeader from '@/components/ui/PageHeader';
import Card, { CardBody } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import { Select } from '@/components/ui/Field';
import { brl, dateBR } from '@/lib/format';
import { ORDER_STATUS } from '@/lib/status';
import shared from '../shared.module.css';

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'enviado', label: 'Aguardando ADM' },
  { value: 'aprovado', label: 'Aprovado' },
  { value: 'rejeitado', label: 'Rejeitado' },
];

export default function VEXMeusPedidosPage() {
  // the server only returns this salesperson's own orders — there's no way to see others'
  const { data: orders, loading } = useAsyncData(() => getMyExternalOrders(), []);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  if (loading) return <div className={shared.loading}><Spinner /></div>;

  const filtered = (orders || []).filter((o) => {
    const matchesSearch = !search || (o.client_name || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !status || o.status === status;
    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      <PageHeader title="Meus Pedidos" subtitle="Acompanhe todos os seus pedidos externos" />

      <Card style={{ marginBottom: '1.25rem' }}>
        <CardBody>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <input className={shared.search} style={{ flex: 1, minWidth: 200 }} placeholder="Buscar por cliente..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <Select value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: 200 }}>
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </div>
        </CardBody>
      </Card>

      <p className={shared.muted} style={{ marginBottom: '0.75rem' }}>{filtered.length} pedido(s)</p>

      {filtered.length === 0 ? (
        <Card><CardBody><div className={shared.loading}>Nenhum pedido encontrado.</div></CardBody></Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          {filtered.map((r) => (
            <Card key={r.id}>
              <CardBody>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{r.client_name || 'Sem cliente'}</div>
                    <div style={{ fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))', marginBottom: '0.5rem' }}>
                      {dateBR(r.sale_date)}{r.notes ? ` · ${r.notes}` : ''}
                    </div>
                    {(r.items || []).map((it, i) => (
                      <div key={i} style={{ fontSize: '0.82rem', color: 'hsl(var(--muted-foreground))' }}>
                        {it.quantity}× {it.product_name} — {brl(it.total)}
                      </div>
                    ))}
                    {r.status === 'rejeitado' && r.rejection_reason && (
                      <div style={{ fontSize: '0.8rem', color: 'hsl(var(--destructive))', marginTop: '0.5rem' }}>
                        Motivo: {r.rejection_reason}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <Badge tone={ORDER_STATUS[r.status]?.tone}>{ORDER_STATUS[r.status]?.label}</Badge>
                    <div style={{ fontWeight: 700, marginTop: '0.4rem' }}>{brl(r.total_amount)}</div>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
