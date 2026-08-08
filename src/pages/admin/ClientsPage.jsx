import { useState } from 'react';
import { Plus, Check, X, User } from 'lucide-react';
import { db, getMaintenancePlans } from '@/api/client';
import useAsyncData from '@/hooks/useAsyncData';
import { useToast } from '@/components/ui/Toast';
import PageHeader from '@/components/ui/PageHeader';
import Card, { CardBody } from '@/components/ui/Card';
import ListRow from '@/components/ui/ListRow';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import { Input, Select } from '@/components/ui/Field';
import { CLIENT_STATUS, CLIENT_TYPE } from '@/lib/status';
import shared from '../shared.module.css';

const EMPTY = { name: '', type: 'pessoa_fisica', document: '', email: '', phone: '', city_name: '', state: '' };

export default function ClientsPage() {
  const toast = useToast();
  const { data, loading, reload } = useAsyncData(async () => {
    const [clients, plans] = await Promise.all([db.Client.list(), getMaintenancePlans()]);
    return { clients, plans };
  }, []);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);

  const clients = data?.clients || [];
  const plans = data?.plans || [];
  const overdueClientIds = new Set(plans.filter((p) => p.daysUntilDue < 0).map((p) => p.clientId));

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.document || '').toLowerCase().includes(q);
  });

  const openNew = () => {
    setForm(EMPTY);
    setEditingId(null);
    setOpen(true);
  };

  const openEdit = (client) => {
    setForm({ ...EMPTY, ...client });
    setEditingId(client.id);
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error('Informe o nome do cliente.');
    try {
      if (editingId) {
        await db.Client.update(editingId, form);
        toast.success('Cliente atualizado.');
      } else {
        await db.Client.create({ ...form, validation_status: 'ativo', registered_by_role: 'admin' });
        toast.success('Cliente cadastrado.');
      }
      setOpen(false);
      reload();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const setValidation = async (client, status) => {
    await db.Client.update(client.id, { validation_status: status });
    toast.success(status === 'ativo' ? 'Cliente aprovado.' : 'Cliente rejeitado.');
    reload();
  };

  if (loading) return <div className={shared.loading}><Spinner /></div>;

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle="Gestão de clientes e manutenções preventivas"
        actions={<Button onClick={openNew}><Plus size={18} /> Novo cliente</Button>}
      />

      <div className={shared.toolbar}>
        <input
          className={shared.search}
          placeholder="Buscar por nome ou documento..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardBody style={{ padding: 0 }}>
          {filtered.length === 0 ? (
            <div className={shared.loading} style={{ padding: '2rem' }}>Nenhum cliente encontrado.</div>
          ) : (
            filtered.map((r) => (
              <ListRow
                key={r.id}
                icon={User}
                title={r.name}
                subtitle={[CLIENT_TYPE[r.type] || r.type, r.city_name].filter(Boolean).join(' · ')}
                onClick={() => openEdit(r)}
                right={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {r.validation_status === 'aguardando_validacao' && (
                      <>
                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setValidation(r, 'ativo'); }}>
                          <Check size={14} /> Aprovar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setValidation(r, 'rejeitado'); }}>
                          <X size={14} />
                        </Button>
                      </>
                    )}
                    {overdueClientIds.has(r.id) && <Badge tone="danger">Manutenção vencida</Badge>}
                    <Badge tone={CLIENT_STATUS[r.validation_status]?.tone}>
                      {CLIENT_STATUS[r.validation_status]?.label || r.validation_status}
                    </Badge>
                  </div>
                }
              />
            ))
          )}
        </CardBody>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? 'Editar cliente' : 'Novo cliente'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </>
        }
      >
        <div className={shared.formGrid}>
          <div className="full" style={{ gridColumn: '1 / -1' }}>
            <Input label="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <Select label="Tipo" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {Object.entries(CLIENT_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Input label="Documento (CPF/CNPJ)" value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} />
          <Input label="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Telefone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label="Cidade" value={form.city_name} onChange={(e) => setForm({ ...form, city_name: e.target.value })} />
          <Input label="UF" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}
