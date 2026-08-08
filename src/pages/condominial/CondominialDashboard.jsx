import { useOutletContext } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Calendar, ClipboardList, Users, AlertCircle } from 'lucide-react';
import { db, getNextMaintenance } from '@/api/client';
import useAsyncData from '@/hooks/useAsyncData';
import PageHeader from '@/components/ui/PageHeader';
import Stat from '@/components/ui/Stat';
import Card, { CardHeader, CardBody } from '@/components/ui/Card';
import Table from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import { dateBR } from '@/lib/format';
import { TASK_STATUS } from '@/lib/status';
import shared from '../shared.module.css';

/** Tone of the day-count badge: overdue (danger), close (warning), comfortable (primary). */
function dueTone(days) {
  if (days < 0) return 'danger';
  if (days <= 7) return 'warning';
  return 'primary';
}

function dueLabel(days) {
  if (days < 0) return `${Math.abs(days)} dia${Math.abs(days) === 1 ? '' : 's'} atrasada`;
  if (days === 0) return 'Hoje';
  return `Em ${days} dia${days === 1 ? '' : 's'}`;
}

export default function CondominialDashboard() {
  const { user } = useOutletContext();
  const today = new Date().toISOString().slice(0, 10);

  const { data, loading } = useAsyncData(async () => {
    const tasks = await db.ServiceTask.filter({ assigned_to_id: user.id }, '-scheduled_date');
    return { tasks };
  }, []);

  const { data: maintenance, loading: maintenanceLoading } = useAsyncData(() => getNextMaintenance(), []);

  if (loading) return <div className={shared.loading}><Spinner /></div>;
  const { tasks } = data;

  const todayTasks = tasks.filter((t) => t.scheduled_date === today);
  const pending = tasks.filter((t) => t.status === 'agendado');
  const inProgress = tasks.filter((t) => t.status === 'em_andamento');

  return (
    <div>
      <PageHeader title={`Olá, ${user?.full_name?.split(' ')[0]}`} subtitle={`Funcionário Condominial · ${dateBR(today)}`} />

      {inProgress.length > 0 && (
        <Link
          to={`/condominial/tarefas/${inProgress[0].id}`}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none',
            background: 'hsl(var(--warning) / 0.15)', border: '1px solid hsl(var(--warning) / 0.4)',
            borderRadius: 'var(--radius)', padding: '0.75rem 1rem', marginBottom: '1.25rem',
            color: 'hsl(var(--warning))', fontSize: '0.88rem', fontWeight: 500,
          }}
        >
          <AlertCircle size={18} />
          Você tem um serviço em andamento. Toque para continuar.
        </Link>
      )}

      <div className={shared.statsGrid}>
        <Stat icon={Calendar} label="Hoje" value={todayTasks.length} tone="primary" />
        <Stat icon={ClipboardList} label="Agendadas" value={pending.length} tone="warning" />
        <Stat icon={ClipboardList} label="Em andamento" value={inProgress.length} tone="success" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        {[
          { to: '/condominial/agenda', icon: Calendar, label: 'Minha Agenda' },
          { to: '/condominial/clientes', icon: Users, label: 'Clientes' },
        ].map((s) => (
          <Link key={s.to} to={s.to} className={shared.shortcutCard}>
            <s.icon size={18} />
            <span>{s.label}</span>
          </Link>
        ))}
      </div>

      <Card style={{ marginBottom: '1.25rem' }}>
        <CardHeader title="Agenda de hoje" />
        <CardBody style={{ padding: 0 }}>
          <Table
            columns={[
              { key: 'client_name', header: 'Cliente', render: (r) => r.client_name || '—' },
              { key: 'description', header: 'Descrição' },
              { key: 'scheduled_time', header: 'Hora', render: (r) => r.scheduled_time || '—' },
              { key: 'status', header: 'Status', render: (r) => <Badge tone={TASK_STATUS[r.status]?.tone}>{TASK_STATUS[r.status]?.label}</Badge> },
              { key: 'actions', header: '', render: (r) => <Link to={`/condominial/tarefas/${r.id}`}><Badge tone="primary">Ver</Badge></Link> },
            ]}
            rows={todayTasks}
            empty="Nenhuma tarefa para hoje."
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Próximas manutenções" subtitle="Liberadas pelo ADM pra você" />
        <CardBody style={{ padding: 0 }}>
          {maintenanceLoading ? (
            <div className={shared.loading}><Spinner /></div>
          ) : (
            <Table
              columns={[
                { key: 'clientName', header: 'Cliente', render: (r) => r.clientName || '—' },
                { key: 'description', header: 'Descrição', render: (r) => r.description || '—' },
                { key: 'nextMaintenanceDate', header: 'Data prevista', render: (r) => dateBR(r.nextMaintenanceDate) },
                {
                  key: 'daysUntilDue', header: 'Contagem', align: 'right',
                  render: (r) => <Badge tone={dueTone(r.daysUntilDue)}>{dueLabel(r.daysUntilDue)}</Badge>,
                },
                {
                  key: 'actions', header: '', render: (r) => r.clientId
                    ? <Link to={`/condominial/clientes/${r.clientId}`}><Badge tone="primary">Ver cliente</Badge></Link>
                    : null,
                },
              ]}
              rows={maintenance || []}
              empty="Nenhuma manutenção liberada pra você no momento."
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
