import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { db } from '@/api/client';
import useAsyncData from '@/hooks/useAsyncData';
import { useToast } from '@/components/ui/Toast';
import PageHeader from '@/components/ui/PageHeader';
import Card, { CardBody } from '@/components/ui/Card';
import Table from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { brl, dateBR } from '@/lib/format';
import { OS_STATUS } from '@/lib/status';
import shared from '../shared.module.css';

const EMPTY = { client_id: '', description: '', service_value: '' };

export default function VEXOrcamentosPage() {
  const { user } = useOutletContext();
  const toast = useToast();
  const { data, loading, reload } = useAsyncData(async () => {
    const [all, clients] = await Promise.all([
      db.ServiceOrder.list('-created_date'),
      db.Client.filter({ validation_status: 'ativo' }),
    ]);
    // Explicit filter: client.js's `filter` is lenient (missing field = passes through),
    // so old budgets without a creator would leak to every salesperson.
    const orders = all.filter((o) => o.type === 'orcamento' && o.created_by_id === user.id);
    return { orders, clients };
  }, []);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const save = async () => {
    if (!form.client_id) return toast.error('Selecione o cliente.');
    if (!form.description.trim()) return toast.error('Informe a descrição.');
    try {
      const client = data.clients.find((c) => c.id === form.client_id);
      await db.ServiceOrder.create({
        type: 'orcamento',
        client_id: form.client_id,
        client_name: client?.name || '',
        description: form.description,
        service_value: Number(form.service_value) || 0,
        created_by_id: user.id,
        created_by_name: user.full_name,
        status: 'aguardando_validacao',
        payment_status: 'a_receber',
      });
      toast.success('Orçamento enviado para validação.');
      setOpen(false);
      setForm(EMPTY);
      reload();
    } catch (e) { toast.error(e.message); }
  };

  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  if (loading) return <div className={shared.loading}><Spinner /></div>;
  const { orders, clients } = data;

  return (
    <div>
      <PageHeader title="Orçamentos" subtitle="Orçamentos criados em campo — enviados ao ADM para validação"
        actions={<Button onClick={() => { setForm(EMPTY); setOpen(true); }}><Plus size={18} /> Novo orçamento</Button>} />
      <Card>
        <CardBody style={{ padding: 0 }}>
          <Table
            columns={[
              { key: 'client_name', header: 'Cliente' },
              { key: 'description', header: 'Descrição', render: (r) => (r.description || '').slice(0, 60) },
              { key: 'service_value', header: 'Valor', align: 'right', render: (r) => brl(r.service_value) },
              { key: 'status', header: 'Status', render: (r) => <Badge tone={OS_STATUS[r.status]?.tone}>{OS_STATUS[r.status]?.label || r.status}</Badge> },
              { key: 'created_date', header: 'Criado em', render: (r) => dateBR(r.created_date) },
            ]}
            rows={orders}
            empty="Nenhum orçamento criado."
          />
        </CardBody>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Novo orçamento"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save}>Enviar para validação</Button></>}>
        <div className={shared.formGrid}>
          <Select label="Cliente*" value={form.client_id} onChange={f('client_id')}>
            <option value="">Selecione...</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Input label="Valor estimado (R$)" type="number" step="0.01" value={form.service_value} onChange={f('service_value')} />
          <div style={{ gridColumn: '1/-1' }}>
            <Textarea label="Descrição do serviço*" value={form.description} onChange={f('description')} rows={4} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
