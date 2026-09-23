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
import ConfirmSubmit from '@/components/ui/ConfirmSubmit';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import { Input, Select } from '@/components/ui/Field';
import { CLIENT_STATUS, CLIENT_TYPE } from '@/lib/status';
import shared from '../shared.module.css';

const EMPTY = {
  name: '', type: 'pessoa_juridica', document: '', email: '', phone: '', contact_person: '',
  street: '', number: '', district: '', city_name: '', state: '', zip_code: '',
};

export default function VEXClientesPage() {
  const { user } = useOutletContext();
  const toast = useToast();
  const { data: clients, loading, reload } = useAsyncData(() => db.Client.list(), []);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [confirmando, setConfirmando] = useState(false);
  const [saving, setSaving] = useState(false);

  // the button only checks and opens the "confira antes de enviar" screen — nothing is sent yet
  // endereço incompleto passava aqui e só quebrava depois, na hora de emitir a nota do ADM
  const askConfirm = () => {
    if (!form.name.trim()) return toast.error('Informe o nome.');
    if (!form.street.trim()) return toast.error('Informe a rua.');
    if (!form.number.trim()) return toast.error('Informe o número.');
    if (!form.district.trim()) return toast.error('Informe o bairro.');
    if (!form.city_name.trim()) return toast.error('Informe a cidade.');
    if (form.state.trim().length !== 2) return toast.error('Informe a UF (2 letras).');
    if (form.zip_code.replace(/\D/g, '').length !== 8) return toast.error('Informe o CEP (8 números).');
    setConfirmando(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await db.Client.create({ ...form, validation_status: 'aguardando_validacao', registered_by_role: user.role });
      toast.success('Cliente cadastrado. Aguardando aprovação do ADM.');
      setOpen(false); setForm(EMPTY); reload();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); setConfirmando(false); }
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
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={askConfirm}>Enviar para aprovação</Button></>}>
        <div className={shared.formGrid}>
          <div style={{ gridColumn: '1/-1' }}><Input label="Nome*" value={form.name} onChange={f('name')} /></div>
          <Select label="Tipo" value={form.type} onChange={f('type')}>
            {Object.entries(CLIENT_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Input label="Documento" value={form.document} onChange={f('document')} />
          <Input label="E-mail" value={form.email} onChange={f('email')} />
          <Input label="Telefone" value={form.phone} onChange={f('phone')} />
          <Input label="Contato" value={form.contact_person} onChange={f('contact_person')} />
          <Input label="Rua*" value={form.street} onChange={f('street')} />
          <Input label="Número*" value={form.number} onChange={f('number')} />
          <Input label="Bairro*" value={form.district} onChange={f('district')} />
          <Input label="Cidade*" value={form.city_name} onChange={f('city_name')} />
          <Input label="UF*" maxLength={2} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} />
          <Input label="CEP*" inputMode="numeric" value={form.zip_code} onChange={f('zip_code')} />
        </div>
      </Modal>

      <ConfirmSubmit
        open={confirmando}
        client={form.name}
        rows={[
          { label: 'Tipo', value: CLIENT_TYPE[form.type] || form.type },
          { label: 'Documento', value: form.document },
          { label: 'E-mail', value: form.email },
          { label: 'Telefone', value: form.phone },
          { label: 'Contato', value: form.contact_person },
          { label: 'Endereço', value: `${form.street}, ${form.number} - ${form.district}` },
          { label: 'Cidade', value: `${form.city_name}/${form.state}` },
          { label: 'CEP', value: form.zip_code },
        ]}
        saving={saving}
        onCancel={() => setConfirmando(false)}
        onConfirm={save}
      />
    </div>
  );
}
