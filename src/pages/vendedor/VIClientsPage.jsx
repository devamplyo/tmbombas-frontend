import { useState } from 'react';
import { User } from 'lucide-react';
import { db, getMaintenancePlans } from '@/api/client';
import useAsyncData from '@/hooks/useAsyncData';
import PageHeader from '@/components/ui/PageHeader';
import Card, { CardBody } from '@/components/ui/Card';
import ListRow from '@/components/ui/ListRow';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import { CLIENT_TYPE } from '@/lib/status';
import shared from '../shared.module.css';

export default function VIClientsPage() {
  const { data, loading } = useAsyncData(async () => {
    const [clients, plans] = await Promise.all([
      db.Client.filter({ validation_status: 'ativo' }),
      getMaintenancePlans(),
    ]);
    return { clients, plans };
  }, []);
  const [search, setSearch] = useState('');

  if (loading) return <div className={shared.loading}><Spinner /></div>;

  const clients = data?.clients || [];
  const plans = data?.plans || [];
  const overdueClientIds = new Set(plans.filter((p) => p.daysUntilDue < 0).map((p) => p.clientId));

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.document || '').toLowerCase().includes(q);
  });

  return (
    <div>
      <PageHeader title="Clientes" subtitle="Clientes ativos" />
      <div className={shared.toolbar}>
        <input className={shared.search} placeholder="Buscar por nome ou documento..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <Card>
        <CardBody style={{ padding: 0 }}>
          {filtered.length === 0 ? (
            <div className={shared.loading} style={{ padding: '2rem' }}>Nenhum cliente ativo.</div>
          ) : (
            filtered.map((r) => (
              <ListRow
                key={r.id}
                icon={User}
                title={r.name}
                subtitle={[CLIENT_TYPE[r.type] || r.type, r.city_name].filter(Boolean).join(' · ')}
                right={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {overdueClientIds.has(r.id) && <Badge tone="danger">Manutenção vencida</Badge>}
                    <span>{r.phone || '—'}</span>
                  </div>
                }
              />
            ))
          )}
        </CardBody>
      </Card>
    </div>
  );
}
