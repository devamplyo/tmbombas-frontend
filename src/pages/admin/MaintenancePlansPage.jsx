import { useState } from 'react';
import { Plus, Unlock } from 'lucide-react';
import { db, getMaintenancePlans, createMaintenancePlan, releaseMaintenancePlan } from '@/api/client';
import useAsyncData from '@/hooks/useAsyncData';
import { useToast } from '@/components/ui/Toast';
import PageHeader from '@/components/ui/PageHeader';
import Card, { CardBody } from '@/components/ui/Card';
import Table from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import { Input, Select } from '@/components/ui/Field';
import { dateBR } from '@/lib/format';
import shared from '../shared.module.css';

const EMPTY_PLAN = { client_id: '', description: '', technician_id: '', frequency_days: 90, last_maintenance_date: '' };

function dueTone(days) {
  if (days < 0) return 'danger';
  if (days <= 7) return 'warning';
  return 'primary';
}
function dueLabel(days) {
  if (days < 0) return `${Math.abs(days)} dia${Math.abs(days) === 1 ? '' : 's'} atrasada`;
  if (days === 0) return 'Hoje';
  return `Em ${days} dia${days === 1 ? '' : 's'}`;
}

export default function MaintenancePlansPage() {
  const toast = useToast();
  const { data, loading, reload } = useAsyncData(async () => {
    const [plans, clients, users] = await Promise.all([
      getMaintenancePlans(),
      db.Client.list(),
      db.User.list(),
    ]);
    return { plans, clients, technicians: users.filter((u) => u.role === 'tecnico') };
  }, []);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_PLAN);
  const [releaseFor, setReleaseFor] = useState(null); // plano sendo liberado
  const [releaseTech, setReleaseTech] = useState('');

  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async () => {
    if (!form.client_id) return toast.error('Selecione o cliente.');
    if (!form.technician_id) return toast.error('Selecione o técnico responsável.');
    if (!form.frequency_days || Number(form.frequency_days) <= 0) return toast.error('Informe a frequência em dias.');
    try {
      await createMaintenancePlan({
        clientId: form.client_id,
        description: form.description,
        technicianId: form.technician_id,
        frequencyDays: form.frequency_days,
        lastMaintenanceDate: form.last_maintenance_date || undefined,
      });
      toast.success('Plano de manutenção criado.');
      setOpen(false); setForm(EMPTY_PLAN); reload();
    } catch (e) { toast.error(e.message); }
  };

  const openRelease = (plan) => { setReleaseFor(plan); setReleaseTech(''); };

  const doRelease = async () => {
    if (!releaseTech) return toast.error('Selecione o técnico.');
    try {
      await releaseMaintenancePlan(releaseFor.id, releaseTech);
      toast.success('Manutenção liberada pro técnico.');
      setReleaseFor(null); reload();
    } catch (e) { toast.error(e.message); }
  };

  if (loading) return <div className={shared.loading}><Spinner /></div>;
  const { plans, clients, technicians } = data;

  return (
    <div>
      <PageHeader
        title="Manutenção Preventiva"
        subtitle="Planos de manutenção por cliente"
        actions={<Button onClick={() => setOpen(true)}><Plus size={18} /> Novo plano</Button>}
      />

      <Card>
        <CardBody style={{ padding: 0 }}>
          <Table
            columns={[
              { key: 'clientName', header: 'Cliente' },
              { key: 'description', header: 'Descrição', render: (r) => r.description || '—' },
              { key: 'frequencyDays', header: 'Frequência', align: 'center', render: (r) => `${r.frequencyDays} dias` },
              { key: 'nextMaintenanceDate', header: 'Próxima data', render: (r) => dateBR(r.nextMaintenanceDate) },
              {
                key: 'daysUntilDue', header: 'Contagem', align: 'right',
                render: (r) => <Badge tone={dueTone(r.daysUntilDue)}>{dueLabel(r.daysUntilDue)}</Badge>,
              },
              {
                key: 'released', header: 'Liberação',
                render: (r) => r.released
                  ? <Badge tone="success">Liberado — {technicians.find((t) => t.id === r.technicianId)?.full_name || 'técnico #' + r.technicianId}</Badge>
                  : <Badge tone="muted">Não liberado</Badge>,
              },
              {
                key: 'actions', header: '', align: 'right',
                render: (r) => (
                  <Button size="sm" variant="outline" onClick={() => openRelease(r)}>
                    <Unlock size={14} /> {r.released ? 'Trocar técnico' : 'Liberar'}
                  </Button>
                ),
              },
            ]}
            rows={plans}
            empty="Nenhum plano de manutenção cadastrado."
          />
        </CardBody>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Novo plano de manutenção"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save}>Salvar</Button></>}>
        <div className={shared.formGrid}>
          <Select label="Cliente*" value={form.client_id} onChange={f('client_id')}>
            <option value="">Selecione...</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select label="Técnico responsável*" value={form.technician_id} onChange={f('technician_id')}>
            <option value="">Selecione...</option>
            {technicians.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
          </Select>
          <div style={{ gridColumn: '1/-1' }}>
            <Input label="Descrição" value={form.description} onChange={f('description')} />
          </div>
          <Input label="Frequência (dias)*" type="number" min="1" value={form.frequency_days} onChange={f('frequency_days')} />
          <Input label="Última manutenção (opcional)" type="date" value={form.last_maintenance_date} onChange={f('last_maintenance_date')} />
        </div>
      </Modal>

      <Modal
        open={!!releaseFor}
        onClose={() => setReleaseFor(null)}
        title={`Liberar manutenção — ${releaseFor?.clientName || ''}`}
        footer={<><Button variant="ghost" onClick={() => setReleaseFor(null)}>Cancelar</Button><Button onClick={doRelease}>Liberar</Button></>}
      >
        <p style={{ fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))', marginBottom: '0.9rem' }}>
          O técnico escolhido passa a ver essa manutenção no contador dele.
        </p>
        <Select label="Técnico*" value={releaseTech} onChange={(e) => setReleaseTech(e.target.value)}>
          <option value="">Selecione...</option>
          {technicians.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
        </Select>
      </Modal>
    </div>
  );
}
