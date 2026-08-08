import { ShoppingCart, Package, AlertTriangle, TrendingUp } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { db } from '@/api/client';
import useAsyncData from '@/hooks/useAsyncData';
import PageHeader from '@/components/ui/PageHeader';
import Stat from '@/components/ui/Stat';
import Spinner from '@/components/ui/Spinner';
import { brl } from '@/lib/format';
import shared from '../shared.module.css';

export default function VIDashboard() {
  const { user } = useOutletContext();
  const { data, loading } = useAsyncData(async () => {
    const [products, sales] = await Promise.all([
      db.Product.filter({ is_active: true }),
      db.Sale.filter({ type: 'interna', status: 'consolidada' }),
    ]);
    return { products, sales };
  }, []);

  if (loading) return <div className={shared.loading}><Spinner /></div>;
  const { products, sales } = data;

  const lowStock = products.filter((p) => p.stock_quantity <= (p.min_stock || 0));
  const myToday = sales.filter((s) => s.seller_id === user?.id && s.sale_date?.startsWith(new Date().toISOString().slice(0, 10)));
  const todayRevenue = myToday.reduce((sum, s) => sum + (s.total_amount || 0), 0);

  return (
    <div>
      <PageHeader title={`Olá, ${user?.full_name?.split(' ')[0] || 'Vendedor'}`} subtitle="Resumo do seu dia" />
      <div className={shared.statsGrid}>
        <Stat icon={ShoppingCart} label="Vendas hoje" value={myToday.length} hint={brl(todayRevenue)} tone="success" />
        <Stat icon={Package} label="Produtos ativos" value={products.length} tone="primary" />
        <Stat icon={AlertTriangle} label="Estoque baixo" value={lowStock.length} tone="danger" />
        <Stat icon={TrendingUp} label="Receita hoje" value={brl(todayRevenue)} tone="primary" />
      </div>
    </div>
  );
}
