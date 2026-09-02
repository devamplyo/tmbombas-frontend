import { Package, ShoppingCart, FileText, Users, DollarSign, AlertTriangle, Store } from 'lucide-react';
import { Link } from 'react-router-dom';
import { db, getExternalOrders, getReceivables } from '@/api/client';
import useAsyncData from '@/hooks/useAsyncData';
import PageHeader from '@/components/ui/PageHeader';
import Stat from '@/components/ui/Stat';
import Card, { CardHeader, CardBody } from '@/components/ui/Card';
import Table from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import { brl, dateBR } from '@/lib/format';
import { OS_STATUS, SALE_STATUS } from '@/lib/status';
import shared from '../shared.module.css';

export default function AdminDashboard() {
  const { data, loading } = useAsyncData(async () => {
    const [products, sales, serviceOrders, clients, pendingOrders, pendingReceivables] = await Promise.all([
      db.Product.list(),
      db.Sale.list('-created_date', 50),
      db.ServiceOrder.list('-created_date', 50),
      db.Client.list(),
      getExternalOrders('enviado'),
      getReceivables('PENDENTE'),
    ]);
    return { products, sales, serviceOrders, clients, pendingOrders, receivableTotal: pendingReceivables.total };
  }, [], { refreshInterval: 30000 });

  if (loading) {
    return (
      <div className={shared.loading}>
        <Spinner />
      </div>
    );
  }

  const { products, sales, serviceOrders, clients, pendingOrders, receivableTotal } = data;
  // achado F6: aqui contava TODOS os produtos; Estoque (StockPage.jsx) só
  // conta os ativos em "Total de Produtos" — os dois rótulos precisam
  // significar a mesma coisa. "Estoque baixo" continua contando todos, em
  // ambas as telas (StockPage.jsx também não filtra por is_active aqui).
  const lowStock = products.filter((p) => p.stock_quantity <= (p.min_stock || 0));
  const consolidated = sales.filter((s) => s.status === 'consolidada');
  const salesValue = consolidated.reduce((sum, s) => sum + (s.total_amount || 0), 0);
  const pendingOS = serviceOrders.filter((so) => so.status === 'aguardando_validacao');
  const pendingExternal = pendingOrders; // fila real de pedidos aguardando o ADM
  // achado F17: usava so.payment_status (campo morto — client.js sempre
  // manda 'a_receber' fixo) em vez do sistema Receivable real, que o
  // Financeiro já usa. Os dois nunca batiam.
  const receivable = receivableTotal;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Visão geral do negócio" />

      <div className={shared.statsGrid}>
        <Stat icon={Package} label="Produtos em estoque" value={products.filter((p) => p.is_active).length} tone="primary" />
        <Stat
          icon={ShoppingCart}
          label="Vendas consolidadas"
          value={consolidated.length}
          hint={brl(salesValue)}
          tone="success"
        />
        <Stat icon={FileText} label="OS aguardando validação" value={pendingOS.length} tone="warning" />
        <Stat icon={Users} label="Clientes" value={clients.length} tone="primary" />
        <Stat icon={DollarSign} label="A receber" value={brl(receivable)} tone="primary" />
        <Stat icon={AlertTriangle} label="Estoque baixo" value={lowStock.length} tone="danger" />
        <Stat icon={Store} label="Pedidos externos pendentes" value={pendingExternal.length} tone="warning" />
      </div>

      <div className={shared.cardsGrid}>
        <Card>
          <CardHeader title="Últimas ordens de serviço" />
          <CardBody>
            <Table
              columns={[
                { key: 'client_name', header: 'Cliente' },
                {
                  key: 'status',
                  header: 'Status',
                  render: (r) => (
                    <Badge tone={OS_STATUS[r.status]?.tone}>{OS_STATUS[r.status]?.label || r.status}</Badge>
                  ),
                },
                { key: 'service_value', header: 'Valor', align: 'right', render: (r) => brl(r.service_value) },
              ]}
              rows={serviceOrders.slice(0, 5)}
              empty="Nenhuma OS."
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Estoque baixo" subtitle="Produtos abaixo do mínimo" />
          <CardBody>
            <Table
              columns={[
                { key: 'name', header: 'Produto' },
                { key: 'stock_quantity', header: 'Estoque', align: 'center' },
                { key: 'min_stock', header: 'Mínimo', align: 'center' },
              ]}
              rows={lowStock}
              empty="Estoque saudável 👍"
            />
          </CardBody>
        </Card>
      </div>

      {pendingExternal.length > 0 && (
        <Card style={{ marginTop: '1.25rem' }}>
          <CardHeader
            title="Pedidos externos aguardando consolidação"
            subtitle={`${pendingExternal.length} pedido(s) aguardando`}
            action={<Link to="/admin/vendas-externas" style={{ fontSize: '0.82rem', color: 'hsl(var(--primary))' }}>Ver todos →</Link>}
          />
          <CardBody style={{ padding: 0 }}>
            <Table
              columns={[
                { key: 'seller_name', header: 'Vendedor' },
                { key: 'client_name', header: 'Cliente' },
                { key: 'total_amount', header: 'Total', align: 'right', render: (r) => brl(r.total_amount) },
                { key: 'status', header: 'Status', render: (r) => <Badge tone={SALE_STATUS[r.status]?.tone}>{SALE_STATUS[r.status]?.label}</Badge> },
              ]}
              rows={pendingExternal.slice(0, 5)}
              empty=""
            />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
