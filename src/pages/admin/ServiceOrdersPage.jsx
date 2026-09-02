import { useState } from 'react';
import { Check, X, Eye } from 'lucide-react';
import { db, getReceivables, confirmReceivable } from '@/api/client';
import useAsyncData from '@/hooks/useAsyncData';
import { useToast } from '@/components/ui/Toast';
import PageHeader from '@/components/ui/PageHeader';
import Card, { CardBody } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import { brl, dateBR } from '@/lib/format';
import { OS_STATUS, PAYMENT_STATUS } from '@/lib/status';
import NfseSection from './NfseSection';
import shared from '../shared.module.css';

const TABS = [
  { value: 'aguardando', label: 'Aguardando', match: (s) => s === 'aguardando_validacao' },
  { value: 'validadas', label: 'Validadas', match: (s) => s === 'validada' || s === 'em_execucao' },
  { value: 'recusadas', label: 'Recusadas', match: (s) => s === 'nao_validada' || s === 'cancelada' },
  { value: 'concluidas', label: 'Concluídas', match: (s) => s === 'concluida' },
];

export default function ServiceOrdersPage() {
  const toast = useToast();
  const { data, loading, reload } = useAsyncData(async () => {
    const [orders, clients, pending] = await Promise.all([
      db.ServiceOrder.list('-created_date'),
      db.Client.list(),
      getReceivables('PENDENTE'),
    ]);
    return { orders, clients, receivables: pending.receivables };
  }, []);
  const [detail, setDetail] = useState(null);
  const [tab, setTab] = useState('aguardando');

  const setStatus = async (id, status) => {
    await db.ServiceOrder.update(id, { status });
    toast.success('Status atualizado.');
    reload();
    setDetail(null);
  };

  // achado F22: "payment_status" de ServiceOrder é um campo morto (o backend
  // não modela pagamento nessa entidade) — a fonte de verdade é o mesmo
  // sistema Receivable que o Financeiro usa. Acha a conta a receber pendente
  // vinculada a esta OS (se existir) em vez de gravar num campo que não persiste.
  const receivableFor = (orderId) =>
    data.receivables.find((rv) => rv.source_type === 'ORDEM_SERVICO' && rv.source_id === orderId);

  const confirmPayment = async (receivableId) => {
    try {
      await confirmReceivable(receivableId);
      toast.success('Recebimento confirmado.');
      reload();
      setDetail(null);
    } catch (e) {
      toast.error(e.message || 'Não foi possível confirmar o recebimento.');
    }
  };

  if (loading) return <div className={shared.loading}><Spinner /></div>;
  const { orders } = data;

  const transitions = {
    aguardando_validacao: ['validada', 'nao_validada'],
    validada: ['em_execucao'],
    em_execucao: ['concluida', 'cancelada'],
  };

  const tabbed = orders.filter((o) => TABS.find((t) => t.value === tab).match(o.status));

  return (
    <div>
      <PageHeader title="Ordens de Serviço" subtitle="Validação e acompanhamento de OS e orçamentos" />

      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <Button key={t.value} size="sm" variant={tab === t.value ? 'primary' : 'outline'} onClick={() => setTab(t.value)}>
            {t.label} ({orders.filter((o) => t.match(o.status)).length})
          </Button>
        ))}
      </div>

      {tabbed.length === 0 ? (
        <Card><CardBody><div className={shared.loading}>Nenhuma ordem de serviço nesse status.</div></CardBody></Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          {tabbed.map((r) => (
            <Card key={r.id}>
              <CardBody>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{r.client_name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))', marginBottom: '0.4rem' }}>
                      {r.assigned_to_name ? `Técnico ${r.assigned_to_name} · ` : ''}{r.type === 'os' ? 'Ordem de Serviço' : 'Orçamento'}
                    </div>
                    <div style={{ fontSize: '0.85rem' }}>{r.description}</div>
                    <div style={{ fontSize: '0.85rem', marginTop: '0.4rem' }}>Valor: <strong>{brl(r.service_value)}</strong></div>
                  </div>
                  <Badge tone={OS_STATUS[r.status]?.tone}>{OS_STATUS[r.status]?.label}</Badge>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.9rem' }}>
                  {r.status === 'aguardando_validacao' && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setStatus(r.id, 'validada')}><Check size={14} /> Validar</Button>
                      <Button size="sm" variant="danger" onClick={() => setStatus(r.id, 'nao_validada')}><X size={14} /> Recusar</Button>
                    </>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setDetail(r)}><Eye size={14} /> Detalhes</Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {detail && (
        <Modal open title={`OS — ${detail.client_name}`} onClose={() => setDetail(null)} width={600}
          footer={<Button variant="ghost" onClick={() => setDetail(null)}>Fechar</Button>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', fontSize: '0.88rem' }}>
              <div><span style={{ color: 'hsl(var(--muted-foreground))' }}>Tipo</span><br /><strong>{detail.type === 'os' ? 'Ordem de Serviço' : 'Orçamento'}</strong></div>
              <div><span style={{ color: 'hsl(var(--muted-foreground))' }}>Status</span><br /><Badge tone={OS_STATUS[detail.status]?.tone}>{OS_STATUS[detail.status]?.label}</Badge></div>
              <div><span style={{ color: 'hsl(var(--muted-foreground))' }}>Valor</span><br /><strong>{brl(detail.service_value)}</strong></div>
              {detail.status === 'concluida' && (
                <div><span style={{ color: 'hsl(var(--muted-foreground))' }}>Pagamento</span><br />
                  <Badge tone={PAYMENT_STATUS[receivableFor(detail.id) ? 'a_receber' : 'recebido'].tone}>
                    {PAYMENT_STATUS[receivableFor(detail.id) ? 'a_receber' : 'recebido'].label}
                  </Badge>
                </div>
              )}
              <div style={{ gridColumn: '1/-1' }}><span style={{ color: 'hsl(var(--muted-foreground))' }}>Descrição</span><br />{detail.description}</div>
              {detail.assigned_to_name && <div><span style={{ color: 'hsl(var(--muted-foreground))' }}>Técnico</span><br />{detail.assigned_to_name}</div>}
              <div><span style={{ color: 'hsl(var(--muted-foreground))' }}>Agendado</span><br />{dateBR(detail.scheduled_date)} {detail.scheduled_time || ''}</div>
            </div>

            {transitions[detail.status]?.length > 0 && (
              <div>
                <p style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))', marginBottom: '0.5rem' }}>Alterar status:</p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {transitions[detail.status].map((s) => (
                    <Button key={s} size="sm" variant={s === 'cancelada' || s === 'nao_validada' ? 'danger' : 'outline'} onClick={() => setStatus(detail.id, s)}>
                      {OS_STATUS[s]?.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {detail.status === 'concluida' && receivableFor(detail.id) && (
              <Button variant="outline" onClick={() => confirmPayment(receivableFor(detail.id).id)}>Confirmar recebimento</Button>
            )}

            <NfseSection os={detail} />
          </div>
        </Modal>
      )}
    </div>
  );
}
