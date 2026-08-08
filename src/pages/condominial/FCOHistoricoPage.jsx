import { useState } from 'react';
import { ClipboardList, Clock, PlayCircle, CheckCircle2 } from 'lucide-react';
import { getTechnicianActivities } from '@/api/client';
import useAsyncData from '@/hooks/useAsyncData';
import PageHeader from '@/components/ui/PageHeader';
import Stat from '@/components/ui/Stat';
import Card, { CardBody } from '@/components/ui/Card';
import Table from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import { Input, Select } from '@/components/ui/Field';
import { dateBR } from '@/lib/format';
import { OS_STATUS } from '@/lib/status';
import shared from '../shared.module.css';

const STATUS_OPTIONS = [
  { value: '', label: 'Todos os status' },
  { value: 'aguardando_validacao', label: 'Aguardando validação' },
  { value: 'validada', label: 'Validada' },
  { value: 'em_execucao', label: 'Em execução' },
  { value: 'concluida', label: 'Concluída' },
  { value: 'cancelada', label: 'Cancelada' },
];

export default function FCOHistoricoPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('');

  const { data, loading } = useAsyncData(
    () => getTechnicianActivities({ from: from || undefined, to: to || undefined }),
    [from, to],
  );

  const activities = (data?.activities || []).filter((a) => !status || a.status === status);

  return (
    <div>
      <PageHeader title="Histórico de Atividades" subtitle="Todo o seu histórico, com filtro por período e status" />

      <div className={shared.statsGrid}>
        <Stat icon={ClipboardList} label="Total" value={data?.total ?? '—'} tone="primary" />
        <Stat icon={Clock} label="Agendadas" value={data?.scheduled ?? '—'} tone="warning" />
        <Stat icon={PlayCircle} label="Em andamento" value={data?.inProgress ?? '—'} tone="primary" />
        <Stat icon={CheckCircle2} label="Concluídas" value={data?.completed ?? '—'} tone="success" />
      </div>

      <Card style={{ marginBottom: '1.25rem' }}>
        <CardBody>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
            <Input label="De" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input label="Até" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody style={{ padding: 0 }}>
          {loading ? (
            <div className={shared.loading}><Spinner /></div>
          ) : (
            <Table
              columns={[
                { key: 'scheduledDate', header: 'Data', render: (r) => dateBR(r.scheduledDate) },
                { key: 'clientName', header: 'Cliente', render: (r) => r.clientName || '—' },
                { key: 'title', header: 'Serviço' },
                { key: 'status', header: 'Status', render: (r) => <Badge tone={OS_STATUS[r.status]?.tone}>{OS_STATUS[r.status]?.label || r.status}</Badge> },
                { key: 'completedAt', header: 'Concluído em', render: (r) => r.completedAt ? dateBR(r.completedAt) : '—' },
              ]}
              rows={activities}
              empty="Nenhuma atividade encontrada nesse filtro."
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
