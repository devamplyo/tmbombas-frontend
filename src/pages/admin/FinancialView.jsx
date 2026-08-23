import { useState, useMemo } from 'react';
import { startOfWeek, startOfMonth, format } from 'date-fns';
import {
  db, getFinancialFlow, getSupplierSpending,
  getReceivables, confirmReceivable as confirmReceivableApi,
} from '@/api/client';
import useAsyncData from '@/hooks/useAsyncData';
import PageHeader from '@/components/ui/PageHeader';
import Stat from '@/components/ui/Stat';
import Card, { CardHeader, CardBody } from '@/components/ui/Card';
import Table from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import FlowBarChart from '@/components/charts/FlowBarChart';
import SupplierSpendingChart from '@/components/charts/SupplierSpendingChart';
import { brl, dateBR } from '@/lib/format';
import { PAYMENT_STATUS } from '@/lib/status';
import { DollarSign, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import shared from '../shared.module.css';

const GRANULARIDADES = [
  { value: 'DIA', label: 'Dia' },
  { value: 'SEMANA', label: 'Semana' },
  { value: 'MES', label: 'Mês' },
];

const fmt = (d) => format(d, 'yyyy-MM-dd');

/** ReceivableStatus (backend) → key of PAYMENT_STATUS, which drives the badge. */
const STATUS_BADGE = { PENDENTE: 'a_receber', RECEBIDO: 'recebido' };

/** Start of the period (today/week/month) through today, to filter the spending-by-supplier chart. */
function rangeFor(period) {
  const today = new Date();
  const fim = fmt(today);
  if (period === 'DIA') return { inicio: fim, fim };
  if (period === 'SEMANA') return { inicio: fmt(startOfWeek(today, { weekStartsOn: 1 })), fim };
  return { inicio: fmt(startOfMonth(today)), fim };
}

export default function FinancialView() {
  const toast = useToast();
  const [granularidade, setGranularidade] = useState('MES');

  const { data, loading, reload } = useAsyncData(async () => {
    const [sales, stockEntries, pending] = await Promise.all([
      db.Sale.filter({ status: 'consolidada' }),
      db.StockEntry.list('-entry_date'),
      getReceivables('PENDENTE'),
    ]);
    return { sales, stockEntries, pending };
  }, []);

  const { data: flow, loading: flowLoading } = useAsyncData(
    () => getFinancialFlow({ granularidade }),
    [granularidade],
  );

  const [spendPeriod, setSpendPeriod] = useState('MES');
  const spendRange = useMemo(() => rangeFor(spendPeriod), [spendPeriod]);
  const { data: spending, loading: spendingLoading } = useAsyncData(
    () => getSupplierSpending(spendRange),
    [spendPeriod],
  );

  const confirmReceivable = async (r) => {
    try {
      await confirmReceivableApi(r.id);
      toast.success('Recebimento confirmado.');
      reload();
    } catch (e) {
      toast.error(e.message || 'Não foi possível confirmar o recebimento.');
    }
  };

  if (loading) return <div className={shared.loading}><Spinner /></div>;
  const { sales, stockEntries, pending } = data;

  const totalRevenue = sales.reduce((s, x) => s + (x.total_amount || 0), 0);
  const totalExpenses = stockEntries.reduce((s, x) => s + (x.total_cost || 0), 0);
  // Comes from the backend (/admin/receivables): sales on credit and completed
  // service orders. The total is summed server-side.
  const receivable = pending.receivables;
  const receivableTotal = pending.total;

  return (
    <div>
      <PageHeader title="Visão Financeira" subtitle="Entradas, saídas e recebíveis" />

      <div className={shared.statsGrid}>
        <Stat icon={TrendingUp} label="Receita (vendas)" value={brl(totalRevenue)} tone="success" />
        <Stat icon={TrendingDown} label="Gastos (entradas estoque)" value={brl(totalExpenses)} tone="danger" />
        <Stat icon={DollarSign} label="Saldo" value={brl(totalRevenue - totalExpenses)} tone="primary" />
        <Stat icon={Clock} label="A receber" value={brl(receivableTotal)} tone="warning" />
      </div>

      <Card style={{ marginBottom: '1.25rem' }}>
        <CardHeader
          title="Entradas x Saídas por período"
          subtitle={flow ? `Vendas no período: ${brl(flow.totalVendas)}` : undefined}
          action={
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {GRANULARIDADES.map((g) => (
                <Button
                  key={g.value}
                  size="sm"
                  variant={granularidade === g.value ? 'primary' : 'outline'}
                  onClick={() => setGranularidade(g.value)}
                >
                  {g.label}
                </Button>
              ))}
            </div>
          }
        />
        <CardBody>
          {flow ? (
            <div style={{ opacity: flowLoading ? 0.45 : 1, transition: 'opacity 0.15s ease' }}>
              <FlowBarChart periods={flow.periods} granularidade={granularidade} />
            </div>
          ) : (
            <div className={shared.loading}><Spinner /></div>
          )}
        </CardBody>
      </Card>

      <Card style={{ marginBottom: '1.25rem' }}>
        <CardHeader
          title="Gastos por fornecedor"
          subtitle={spending ? `Total: ${brl(spending.totalSpent)}` : undefined}
          action={
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {GRANULARIDADES.map((g) => (
                <Button
                  key={g.value}
                  size="sm"
                  variant={spendPeriod === g.value ? 'primary' : 'outline'}
                  onClick={() => setSpendPeriod(g.value)}
                >
                  {g.label}
                </Button>
              ))}
            </div>
          }
        />
        <CardBody>
          {spending ? (
            <div style={{ opacity: spendingLoading ? 0.45 : 1, transition: 'opacity 0.15s ease' }}>
              <SupplierSpendingChart suppliers={spending.suppliers} />
            </div>
          ) : (
            <div className={shared.loading}><Spinner /></div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="A receber — Ordens de Serviço concluídas" />
        <CardBody style={{ padding: 0 }}>
          <Table
            columns={[
              { key: 'client_name', header: 'Cliente', render: (r) => r.client_name || '—' },
              { key: 'description', header: 'Descrição', render: (r) => (r.description || '').slice(0, 60) },
              { key: 'amount', header: 'Valor', align: 'right', render: (r) => brl(r.amount) },
              {
                key: 'status', header: 'Status',
                render: (r) => {
                  const s = STATUS_BADGE[r.status] || 'a_receber';
                  return <Badge tone={PAYMENT_STATUS[s]?.tone}>{PAYMENT_STATUS[s]?.label}</Badge>;
                },
              },
              {
                key: 'actions', header: '', align: 'right',
                render: (r) => r.status === 'PENDENTE'
                  ? <Button size="sm" variant="outline" onClick={() => confirmReceivable(r)}>Confirmar</Button>
                  : null,
              },
            ]}
            rows={receivable}
            empty="Nenhum valor a receber."
          />
        </CardBody>
      </Card>

      <div style={{ marginTop: '1.25rem' }}>
        <Card>
          <CardHeader title="Últimas entradas de estoque" />
          <CardBody style={{ padding: 0 }}>
            <Table
              columns={[
                { key: 'product_name', header: 'Produto' },
                { key: 'supplier_name', header: 'Fornecedor' },
                { key: 'quantity', header: 'Qtd.', align: 'center' },
                { key: 'unit_cost', header: 'Custo unit.', align: 'right', render: (r) => brl(r.unit_cost) },
                { key: 'total_cost', header: 'Total', align: 'right', render: (r) => brl(r.total_cost) },
                { key: 'entry_date', header: 'Data', render: (r) => dateBR(r.entry_date) },
              ]}
              rows={stockEntries.slice(0, 10)}
              empty="Nenhuma entrada."
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
