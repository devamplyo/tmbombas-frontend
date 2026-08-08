import { useOutletContext, Link } from 'react-router-dom';
import { ShoppingCart, Users, Clock, DollarSign } from 'lucide-react';
import { db, getMyExternalOrders } from '@/api/client';
import useAsyncData from '@/hooks/useAsyncData';
import PageHeader from '@/components/ui/PageHeader';
import Stat from '@/components/ui/Stat';
import Spinner from '@/components/ui/Spinner';
import { brl, dateBR } from '@/lib/format';
import shared from '../shared.module.css';

export default function VEXDashboard() {
  const { user } = useOutletContext();
  const { data, loading } = useAsyncData(async () => {
    const [orders, clients] = await Promise.all([
      getMyExternalOrders(),
      db.Client.filter({ registered_by_role: 'vendedor_externo' }),
    ]);
    return { orders, clients };
  }, []);

  if (loading) return <div className={shared.loading}><Spinner /></div>;
  const { orders, clients } = data;

  const today = new Date().toISOString().slice(0, 10);
  const monthPrefix = today.slice(0, 7);

  // an order only becomes a sale when the ADM approves it
  const salesToday = orders.filter((o) => o.status === 'aprovado' && (o.sale_date || '').startsWith(today));
  const reservas = orders.filter((o) => o.status === 'enviado');
  const totalMes = orders
    .filter((o) => o.status === 'aprovado' && (o.sale_date || '').startsWith(monthPrefix))
    .reduce((sum, o) => sum + (o.total_amount || 0), 0);

  return (
    <div>
      <PageHeader title={`Olá, ${user?.full_name?.split(' ')[0]}`} subtitle={`Painel do Vendedor Externo · ${dateBR(today)}`} />
      <div className={shared.statsGrid}>
        <Stat icon={ShoppingCart} label="Vendas Hoje" value={salesToday.length} tone="success" />
        <Stat icon={Clock} label="Pedidos Reserva" value={reservas.length} tone="warning" />
        <Stat icon={Users} label="Clientes" value={clients.length} tone="primary" />
        <Stat icon={DollarSign} label="Total no Mês" value={brl(totalMes)} tone="success" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        {[
          { to: '/vendedor-externo/clientes', icon: Users, label: 'Clientes' },
          { to: '/vendedor-externo/meus-pedidos', icon: ShoppingCart, label: 'Meus Pedidos' },
        ].map((s) => (
          <Link key={s.to} to={s.to} className={shared.shortcutCard}>
            <s.icon size={18} />
            <span>{s.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
