import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ShoppingCart } from 'lucide-react';
import { db } from '@/api/client';
import useAsyncData from '@/hooks/useAsyncData';
import PageHeader from '@/components/ui/PageHeader';
import Card, { CardHeader, CardBody } from '@/components/ui/Card';
import Table from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import { brl, dateBR } from '@/lib/format';
import { CLIENT_STATUS, CLIENT_TYPE, SALE_STATUS } from '@/lib/status';
import shared from '../shared.module.css';

export default function VEXClientePerfilPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, loading } = useAsyncData(async () => {
    const [clients, allSales] = await Promise.all([
      db.Client.filter({ id }),
      db.Sale.list('-created_date'),
    ]);
    const client = clients[0] || null;
    // The server doesn't link a sale to a client by id, it only stores the typed name —
    // that's why the matching here is by name (no accent/case, trimmed edges).
    const norm = (s) => (s || '').trim().toLowerCase();
    const sales = client ? allSales.filter((s) => norm(s.client_name) === norm(client.name)) : [];
    return { client, sales };
  }, [id]);

  if (loading) return <div className={shared.loading}><Spinner /></div>;
  const { client, sales } = data;
  if (!client) return <div><Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Voltar</Button><p>Cliente não encontrado.</p></div>;

  return (
    <div>
      <PageHeader
        title={client.name}
        subtitle={`${CLIENT_TYPE[client.type] || client.type} · ${client.city_name || ''}${client.state ? `, ${client.state}` : ''}`}
        actions={
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Voltar</Button>
            <Link to={`/vendedor-externo/novo-pedido/${id}`}><Button><ShoppingCart size={16} /> Novo pedido</Button></Link>
          </div>
        }
      />

      <div className={shared.detailGrid}>
        <Card>
          <CardHeader title="Dados do cliente" />
          <CardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.88rem' }}>
              {[
                ['Status', <Badge tone={CLIENT_STATUS[client.validation_status]?.tone}>{CLIENT_STATUS[client.validation_status]?.label}</Badge>],
                ['Documento', client.document || '—'],
                ['E-mail', client.email || '—'],
                ['Telefone', client.phone || '—'],
                ['Contato', client.contact_person || '—'],
              ].map(([label, value]) => (
                <div key={label}><span style={{ color: 'hsl(var(--muted-foreground))', display: 'block', fontSize: '0.75rem' }}>{label}</span><span>{value}</span></div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Histórico de pedidos" />
          <CardBody style={{ padding: 0 }}>
            <Table
              columns={[
                { key: 'total_amount', header: 'Total', align: 'right', render: (r) => brl(r.total_amount) },
                { key: 'status', header: 'Status', render: (r) => <Badge tone={SALE_STATUS[r.status]?.tone}>{SALE_STATUS[r.status]?.label}</Badge> },
                { key: 'sale_date', header: 'Data', render: (r) => dateBR(r.sale_date) },
              ]}
              rows={sales}
              empty="Nenhum pedido."
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
