import { useState } from 'react';
import { Plus, User } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { db } from '@/api/client';
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

const EMPTY = { name: '', type: 'pessoa_juridica', document: '', email: '', phone: '', city_name: '', state: '', contact_person: '' };

export default function VEXClientesPage() {
  const { user } = useOutletContext();
  const toast = useToast();
  const { data: clients, loading, reload } = useAsyncData(() => db.Client.list(), []);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const save = async () => {
    if (!form.name.trim()) return toast.error('Informe o nome.');
    try {
      await db.Client.create({ ...form, validation_status: 'aguardando_validacao', registered_by_role: user.role });
      toast.success('Cliente cadastrado. Aguardando aprovação do ADM.');
      setOpen(false); setForm(EMPTY); reload();
    } catch (e) { toast.error(e.message); }
  };

  const filtered = (clients || []).filter((c) => {
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.document || '').toLowerCase().includes(q) || (c.phone || '').includes(q);
  });
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  if (loading) return <div className={shared.loading}><Spinner /></div>;

  return (
    <div>
      <PageHeader title="Clientes" subtitle={`${filtered.length} cliente(s) na base`}
        actions={<Button onClick={() => { setForm(EMPTY); setOpen(true); }}><Plus size={18} /> Novo cliente</Button>} />
      <div className={shared.toolbar}>
        <input className={shared.search} placeholder="Buscar por nome, CNPJ ou telefone..." value={search} onChange={(e) => setSearch(e.target.value)} />
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
                to={`/vendedor-externo/clientes/${r.id}`}
                right={<Badge tone={CLIENT_STATUS[r.validation_status]?.tone}>{CLIENT_STATUS[r.validation_status]?.label}</Badge>}
              />
            ))
          )}
        </CardBody>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Novo cliente"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save}>Enviar para aprovação</Button></>}>
        <div className={shared.formGrid}>
          <div style={{ gridColumn: '1/-1' }}><Input label="Nome*" value={form.name} onChange={f('name')} /></div>
          <Select label="Tipo" value={form.type} onChange={f('type')}>
            {Object.entries(CLIENT_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Input label="Documento" value={form.document} onChange={f('document')} />
          <Input label="E-mail" value={form.email} onChange={f('email')} />
          <Input label="Telefone" value={form.phone} onChange={f('phone')} />
          <Input label="Contato" value={form.contact_person} onChange={f('contact_person')} />
          <Input label="Cidade" value={form.city_name} onChange={f('city_name')} />
          <Input label="UF" value={form.state} onChange={f('state')} />
        </div>
      </Modal>
    </div>
  );
}
