import { useState } from 'react';
import { UserCog } from 'lucide-react';
import { db } from '@/api/client';
import useAsyncData from '@/hooks/useAsyncData';
import PageHeader from '@/components/ui/PageHeader';
import Card, { CardBody } from '@/components/ui/Card';
import ListRow from '@/components/ui/ListRow';
import Table from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import { PROFILES } from '@/config/profiles';
import { TASK_STATUS } from '@/lib/status';
import { dateBR } from '@/lib/format';
import shared from '../shared.module.css';

export default function CollaboratorsPage() {
  const { data, loading } = useAsyncData(async () => {
    const [users, tasks] = await Promise.all([db.User.list(), db.ServiceTask.list('-scheduled_date')]);
    const collaborators = users.filter((u) => u.role !== 'admin');
    return { collaborators, tasks };
  }, []);
  const [search, setSearch] = useState('');

  if (loading) return <div className={shared.loading}><Spinner /></div>;
  const { collaborators, tasks } = data;

  const allocatedIds = new Set(
    tasks.filter((t) => t.status === 'em_andamento').map((t) => t.assigned_to_id)
  );

  const filtered = collaborators.filter((c) => {
    const q = search.toLowerCase();
    return c.full_name.toLowerCase().includes(q) || (c.matricula || '').toLowerCase().includes(q);
  });

  return (
    <div>
      <PageHeader title="Gestão de Colaboradores" subtitle="Visualize o perfil e histórico dos funcionários" />

      <div className={shared.toolbar}>
        <input className={shared.search} placeholder="Buscar por nome ou matrícula..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardBody style={{ padding: 0 }}>
          {filtered.length === 0 ? (
            <div className={shared.loading} style={{ padding: '2rem' }}>Nenhum colaborador.</div>
          ) : (
            filtered.map((r) => (
              <ListRow
                key={r.id}
                icon={UserCog}
                title={r.full_name}
                subtitle={`Mat. ${r.matricula} — ${PROFILES[r.role]?.label || r.role}`}
                to={`/admin/colaboradores/${r.id}`}
                right={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {allocatedIds.has(r.id) && <Badge tone="primary">Alocado em Serviço</Badge>}
                    <Badge tone={r.is_active ? 'success' : 'muted'}>{r.is_active ? 'Ativo' : 'Inativo'}</Badge>
                  </div>
                }
              />
            ))
          )}
        </CardBody>
      </Card>

      <div style={{ marginTop: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: 600 }}>Últimas tarefas agendadas</h3>
        <Card>
          <CardBody style={{ padding: 0 }}>
            <Table
              columns={[
                { key: 'assigned_to_name', header: 'Técnico' },
                { key: 'client_name', header: 'Cliente' },
                { key: 'description', header: 'Descrição' },
                { key: 'scheduled_date', header: 'Data', render: (r) => dateBR(r.scheduled_date) },
                { key: 'status', header: 'Status', render: (r) => <Badge tone={TASK_STATUS[r.status]?.tone}>{TASK_STATUS[r.status]?.label}</Badge> },
              ]}
              rows={tasks.slice(0, 10)}
              empty="Nenhuma tarefa."
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
