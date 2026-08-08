import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, ClipboardList, CheckCircle2, DollarSign } from 'lucide-react';
import { getCollaboratorDetail } from '@/api/client';
import useAsyncData from '@/hooks/useAsyncData';
import PageHeader from '@/components/ui/PageHeader';
import Stat from '@/components/ui/Stat';
import Card, { CardHeader, CardBody } from '@/components/ui/Card';
import Table from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import { Input, Select } from '@/components/ui/Field';
import { PROFILES } from '@/config/profiles';
import { OS_STATUS } from '@/lib/status';
import { brl, dateBR } from '@/lib/format';
import shared from '../shared.module.css';

const STATUS_OPTIONS = [
  { value: '', label: 'Todos os status' },
  { value: 'aguardando_validacao', label: 'Aguardando validação' },
  { value: 'validada', label: 'Validada' },
  { value: 'em_execucao', label: 'Em execução' },
  { value: 'concluida', label: 'Concluída' },
  { value: 'cancelada', label: 'Cancelada' },
];

/** Is the date (ISO string) within [from, to]? Empty bounds don't restrict. */
function inRange(iso, from, to) {
  if (!iso) return false;
  const d = iso.slice(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

export default function CollaboratorDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('');
  const { data: collaborator, loading } = useAsyncData(() => getCollaboratorDetail(id), [id]);

  if (loading) return <div className={shared.loading}><Spinner /></div>;
  if (!collaborator) {
    return (
      <div>
        <Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Voltar</Button>
        <p>Colaborador não encontrado.</p>
      </div>
    );
  }

  const isSeller = collaborator.salesCount > 0 || collaborator.role === 'vendedor_interno' || collaborator.role === 'vendedor_externo';
  const isTechnician = collaborator.serviceOrderCount > 0 || collaborator.role === 'tecnico';

  const hasDateFilter = from || to;
  const sales = hasDateFilter ? collaborator.sales.filter((s) => inRange(s.date, from, to)) : collaborator.sales;
  const serviceOrders = collaborator.serviceOrders
    .filter((o) => !hasDateFilter || inRange(o.createdAt, from, to))
    .filter((o) => !status || o.status === status);

  return (
    <div>
      <PageHeader
        title={collaborator.name}
        subtitle={`${PROFILES[collaborator.role]?.label || collaborator.role} — matrícula ${collaborator.matricula}`}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <Badge tone={collaborator.isActive ? 'success' : 'muted'}>{collaborator.isActive ? 'Ativo' : 'Inativo'}</Badge>
            <Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Voltar</Button>
          </div>
        }
      />

      <div className={shared.statsGrid}>
        {isSeller && (
          <>
            <Stat icon={ShoppingCart} label="Vendas" value={collaborator.salesCount} tone="primary" />
            <Stat icon={DollarSign} label="Receita gerada" value={brl(collaborator.totalRevenue)} tone="success" />
          </>
        )}
        {isTechnician && (
          <>
            <Stat icon={ClipboardList} label="Ordens de Serviço" value={collaborator.serviceOrderCount} tone="primary" />
            <Stat icon={CheckCircle2} label="Concluídas" value={collaborator.completedServiceOrders} tone="success" />
          </>
        )}
      </div>

      {(isSeller || isTechnician) && (
        <Card style={{ marginBottom: '1.25rem' }}>
          <CardBody>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', maxWidth: isTechnician ? 620 : 420 }}>
              <Input label="De" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              <Input label="Até" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              {isTechnician && (
                <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                  {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {isSeller && (
        <Card style={{ marginBottom: '1.25rem' }}>
          <CardHeader title="Histórico de vendas" />
          <CardBody style={{ padding: 0 }}>
            <Table
              columns={[
                { key: 'customerName', header: 'Cliente', render: (r) => r.customerName || '—' },
                { key: 'total', header: 'Total', align: 'right', render: (r) => brl(r.total) },
                { key: 'date', header: 'Data', render: (r) => dateBR(r.date) },
              ]}
              rows={sales}
              empty="Nenhuma venda no período selecionado."
            />
          </CardBody>
        </Card>
      )}

      {isTechnician && (
        <Card>
          <CardHeader title="Histórico de Ordens de Serviço" />
          <CardBody style={{ padding: 0 }}>
            <Table
              columns={[
                { key: 'title', header: 'Serviço' },
                { key: 'clientName', header: 'Cliente', render: (r) => r.clientName || '—' },
                { key: 'status', header: 'Status', render: (r) => <Badge tone={OS_STATUS[r.status]?.tone}>{OS_STATUS[r.status]?.label || r.status}</Badge> },
                { key: 'createdAt', header: 'Criada em', render: (r) => dateBR(r.createdAt) },
                { key: 'completedAt', header: 'Concluída em', render: (r) => r.completedAt ? dateBR(r.completedAt) : '—' },
              ]}
              rows={serviceOrders}
              empty="Nenhuma ordem de serviço no período selecionado."
            />
          </CardBody>
        </Card>
      )}

      {!isSeller && !isTechnician && (
        <Card><CardBody><p style={{ color: 'hsl(var(--muted-foreground))' }}>Sem histórico de vendas ou ordens de serviço para este colaborador.</p></CardBody></Card>
      )}
    </div>
  );
}
