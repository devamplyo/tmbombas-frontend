import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { db } from '@/api/client';
import useAsyncData from '@/hooks/useAsyncData';
import PageHeader from '@/components/ui/PageHeader';
import Card, { CardHeader, CardBody } from '@/components/ui/Card';
import Table from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import { dateBR, brl } from '@/lib/format';
import { OS_STATUS, CLIENT_TYPE } from '@/lib/status';
import shared from '../shared.module.css';

export default function FCOClientePerfilPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, loading } = useAsyncData(async () => {
    const [clients, orders] = await Promise.all([
      db.Client.filter({ id }),
      db.ServiceOrder.filter({ client_id: id }, '-created_date'),
    ]);
    return { client: clients[0] || null, orders };
  }, [id]);

  if (loading) return <div className={shared.loading}><Spinner /></div>;
  const { client, orders } = data;
  if (!client) return <div><Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Voltar</Button><p>Cliente não encontrado.</p></div>;

  return (
    <div>
      <PageHeader
        title={client.name}
        subtitle={CLIENT_TYPE[client.type] || client.type}
        actions={<Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Voltar</Button>}
      />
      <div className={shared.detailGrid}>
        <Card>
          <CardHeader title="Dados" />
          <CardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.88rem' }}>
              {[['Telefone', client.phone], ['E-mail', client.email], ['Cidade', client.city_name], ['Próxima manutenção', dateBR(client.next_maintenance_date)]].map(([label, value]) => (
                <div key={label}><span style={{ color: 'hsl(var(--muted-foreground))', display: 'block', fontSize: '0.75rem' }}>{label}</span><span>{value || '—'}</span></div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Histórico de serviços" />
          <CardBody style={{ padding: 0 }}>
            <Table
              columns={[
                { key: 'type', header: 'Tipo', render: (r) => r.type === 'os' ? 'OS' : 'Orçamento' },
                { key: 'description', header: 'Descrição', render: (r) => r.description.slice(0, 50) },
                { key: 'service_value', header: 'Valor', align: 'right', render: (r) => brl(r.service_value) },
                { key: 'status', header: 'Status', render: (r) => <Badge tone={OS_STATUS[r.status]?.tone}>{OS_STATUS[r.status]?.label}</Badge> },
                { key: 'scheduled_date', header: 'Data', render: (r) => dateBR(r.scheduled_date) },
              ]}
              rows={orders}
              empty="Nenhum serviço."
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
