import { useState } from 'react';
import { Building2 } from 'lucide-react';
import { db } from '@/api/client';
import useAsyncData from '@/hooks/useAsyncData';
import PageHeader from '@/components/ui/PageHeader';
import Card, { CardBody } from '@/components/ui/Card';
import ListRow from '@/components/ui/ListRow';
import Spinner from '@/components/ui/Spinner';
import shared from '../shared.module.css';

function addressLine(client) {
  const a = client.address || {};
  const parts = [a.street, client.city_name, client.state].filter(Boolean);
  return parts.length ? parts.join(', ') : '—';
}

export default function FCOClientesPage() {
  const { data: clients, loading } = useAsyncData(() => db.Client.filter({ validation_status: 'ativo' }), []);
  const [search, setSearch] = useState('');
  const filtered = (clients || []).filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) || addressLine(c).toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className={shared.loading}><Spinner /></div>;

  return (
    <div>
      <PageHeader title="Clientes / Condomínios" subtitle={`${filtered.length} cliente(s) ativo(s)`} />
      <div className={shared.toolbar}>
        <input className={shared.search} placeholder="Buscar por nome ou endereço..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <Card>
        <CardBody style={{ padding: 0 }}>
          {filtered.length === 0 ? (
            <div className={shared.loading} style={{ padding: '2rem' }}>Nenhum cliente.</div>
          ) : (
            filtered.map((r) => (
              <ListRow
                key={r.id}
                icon={Building2}
                title={r.name}
                subtitle={addressLine(r)}
                to={`/condominial/clientes/${r.id}`}
              />
            ))
          )}
        </CardBody>
      </Card>
    </div>
  );
}
