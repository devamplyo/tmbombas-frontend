import { useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import { db } from '@/api/client';
import useAsyncData from '@/hooks/useAsyncData';
import { useToast } from '@/components/ui/Toast';
import PageHeader from '@/components/ui/PageHeader';
import Card, { CardHeader, CardBody } from '@/components/ui/Card';
import ListRow from '@/components/ui/ListRow';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import { Input, Select } from '@/components/ui/Field';
import { dateBR } from '@/lib/format';
import { TASK_STATUS } from '@/lib/status';
import shared from '../shared.module.css';

const EMPTY = { assigned_to_id: '', client_id: '', description: '', scheduled_date: '', scheduled_time: '', service_order_id: '' };

export default function ServiceDelegation() {
  const toast = useToast();
  const { data, loading, reload } = useAsyncData(async () => {
    const [tasks, technicians, clients, orders] = await Promise.all([
      db.ServiceTask.list('-scheduled_date'),
      db.User.filter({ role: 'tecnico' }),
      db.Client.filter({ validation_status: 'ativo' }),
      db.ServiceOrder.filter({ status: 'validada' }),
    ]);
    return { tasks, technicians, clients, orders };
  }, []);
  const [form, setForm] = useState(EMPTY);

  const save = async () => {
    if (!form.assigned_to_id) return toast.error('Selecione o técnico.');
    if (!form.service_order_id) return toast.error('Selecione a Ordem de Serviço vinculada.');
    if (!form.description.trim()) return toast.error('Informe a descrição.');
    if (!form.scheduled_date) return toast.error('Informe a data.');
    try {
      const tech = data.technicians.find((t) => t.id === form.assigned_to_id);
      const client = data.clients.find((c) => c.id === form.client_id);
      await db.ServiceTask.create({
        ...form,
        assigned_to_name: tech?.full_name || '',
        client_name: client?.name || '',
        status: 'agendado',
      });
      toast.success('Tarefa delegada.');
      setForm(EMPTY);
      reload();
    } catch (e) { toast.error(e.message); }
  };

  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  if (loading) return <div className={shared.loading}><Spinner /></div>;
  const { tasks, technicians, clients, orders } = data;

  return (
    <div>
      <PageHeader title="Delegação de Serviços" subtitle="Agendar e delegar tarefas para técnicos" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', alignItems: 'start' }}>
        <Card>
          <CardHeader title="Nova Tarefa" />
          <CardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <Select label="Colaborador*" value={form.assigned_to_id} onChange={f('assigned_to_id')}>
                <option value="">Selecione...</option>
                {technicians.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </Select>
              <Select label="Cliente" value={form.client_id} onChange={f('client_id')}>
                <option value="">Selecione...</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <Select label="OS vinculada*" value={form.service_order_id} onChange={f('service_order_id')}>
                <option value="">Nenhuma</option>
                {orders.map((o) => <option key={o.id} value={o.id}>{o.client_name} — {(o.description || '').slice(0, 40)}</option>)}
              </Select>
              <Input label="Descrição*" value={form.description} onChange={f('description')} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.9rem' }}>
                <Input label="Data*" type="date" value={form.scheduled_date} onChange={f('scheduled_date')} />
                <Input label="Horário" type="time" value={form.scheduled_time} onChange={f('scheduled_time')} />
              </div>
              <Button onClick={save}><CalendarPlus size={16} /> Agendar Tarefa</Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Tarefas Recentes" />
          <CardBody style={{ padding: 0 }}>
            {tasks.length === 0 ? (
              <div className={shared.loading} style={{ padding: '2rem' }}>Nenhuma tarefa agendada.</div>
            ) : (
              tasks.map((r) => (
                <ListRow
                  key={r.id}
                  title={r.assigned_to_name}
                  subtitle={[r.client_name, r.description].filter(Boolean).join(' · ')}
                  right={
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem' }}>
                      <Badge tone={TASK_STATUS[r.status]?.tone}>{TASK_STATUS[r.status]?.label}</Badge>
                      <span style={{ fontSize: '0.72rem', color: 'hsl(var(--muted-foreground))' }}>{dateBR(r.scheduled_date)}</span>
                    </div>
                  }
                />
              ))
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
