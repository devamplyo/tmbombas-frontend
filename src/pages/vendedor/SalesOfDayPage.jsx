import { useState } from 'react';
import { Ban } from 'lucide-react';
import { db } from '@/api/client';
import { getToken } from '@/api/auth';
import useAsyncData from '@/hooks/useAsyncData';
import { useToast } from '@/components/ui/Toast';
import PageHeader from '@/components/ui/PageHeader';
import Card, { CardBody } from '@/components/ui/Card';
import Table from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import { Input } from '@/components/ui/Field';
import { brl } from '@/lib/format';
import { SALE_STATUS, PAYMENT_METHOD } from '@/lib/status';
import shared from '../shared.module.css';

const today = () => new Date().toISOString().slice(0, 10);
const hora = (iso) => { try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); } catch { return '—'; } };

export default function SalesOfDayPage() {
  const toast = useToast();
  const { data: sales, loading, reload } = useAsyncData(async () => {
    const all = await db.Sale.filter({ type: 'interna' }, '-created_date');
    return all.filter((s) => (s.sale_date || s.created_date || '').startsWith(today()));
  }, []);

  const [cancelSale, setCancelSale] = useState(null); // sale selected for cancellation
  const [adminPass, setAdminPass] = useState('');
  const [working, setWorking] = useState(false);

  const openCancel = (sale) => { setCancelSale(sale); setAdminPass(''); };
  const closeCancel = () => { setCancelSale(null); setAdminPass(''); };

  const confirmCancel = async () => {
    if (!cancelSale) return;
    setWorking(true);
    try {
      const res = await fetch('/api/auth/verify-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ password: adminPass }),
      });
      if (!res.ok) throw new Error('Não foi possível validar a senha. Reinicie o servidor (backend) e tente novamente.');
      const { valid } = await res.json();
      if (!valid) { toast.error('Senha do ADM incorreta.'); return; }

      // The backend restores stock and reverses the financial entry when the sale is deleted.
      await db.Sale.remove(cancelSale.id);
      toast.success('Venda cancelada e estoque restaurado.');
      closeCancel();
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <div className={shared.loading}><Spinner /></div>;

  const consolidadas = (sales || []).filter((s) => s.status === 'consolidada');
  const totalDia = consolidadas.reduce((sum, s) => sum + (s.total_amount || 0), 0);

  return (
    <div>
      <PageHeader title="Vendas do dia" subtitle={`${consolidadas.length} venda(s) · ${brl(totalDia)}`} />
      <Card>
        <CardBody style={{ padding: 0 }}>
          <Table
            columns={[
              { key: 'sale_date', header: 'Hora', render: (s) => hora(s.sale_date || s.created_date) },
              { key: 'client_name', header: 'Cliente', render: (s) => s.client_name || 'Sem cliente' },
              { key: 'total_items', header: 'Itens', align: 'right', render: (s) => s.total_items ?? (s.items || []).reduce((n, i) => n + i.quantity, 0) },
              { key: 'payment_method', header: 'Pagamento', render: (s) => PAYMENT_METHOD[s.payment_method] || '—' },
              { key: 'total_amount', header: 'Total', align: 'right', render: (s) => brl(s.total_amount) },
              { key: 'status', header: 'Status', render: (s) => { const st = SALE_STATUS[s.status] || { label: s.status, tone: 'default' }; return <Badge tone={st.tone}>{st.label}</Badge>; } },
              {
                key: 'actions', header: '', align: 'right',
                render: (s) => s.status === 'consolidada'
                  ? <Button size="sm" variant="danger" onClick={() => openCancel(s)}><Ban size={14} /> Cancelar</Button>
                  : null,
              },
            ]}
            rows={sales || []}
            empty="Nenhuma venda registrada hoje."
          />
        </CardBody>
      </Card>

      <Modal
        open={!!cancelSale}
        onClose={closeCancel}
        title="Cancelar venda finalizada"
        footer={
          <>
            <Button variant="ghost" onClick={closeCancel} disabled={working}>Fechar</Button>
            <Button variant="danger" onClick={confirmCancel} disabled={!adminPass || working}>
              {working ? 'Cancelando...' : 'Confirmar cancelamento'}
            </Button>
          </>
        }>
        {cancelSale && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ background: 'hsl(var(--secondary))', borderRadius: 'var(--radius)', padding: '0.75rem', fontSize: '0.88rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span style={{ color: 'hsl(var(--muted-foreground))' }}>Cliente</span>
                <span>{cancelSale.client_name || 'Sem cliente'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'hsl(var(--muted-foreground))' }}>Total</span>
                <strong>{brl(cancelSale.total_amount)}</strong>
              </div>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'hsl(220 18% 78%)', margin: 0 }}>
              O estoque dos itens será restaurado. Informe a senha do ADM para confirmar.
            </p>
            <Input label="Senha do ADM*" type="password" value={adminPass}
              onChange={(e) => setAdminPass(e.target.value)} placeholder="Senha do ADM Master" autoFocus />
          </div>
        )}
      </Modal>
    </div>
  );
}
