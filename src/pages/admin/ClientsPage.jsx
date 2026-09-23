import { useState } from 'react';
import { Plus, Check, X, User } from 'lucide-react';
import { db, getMaintenancePlans, approveClient, rejectClient } from '@/api/client';
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

const EMPTY = {
  name: '', type: 'pessoa_fisica', document: '', email: '', phone: '',
  street: '', number: '', complement: '', district: '', city_name: '', state: '', zip_code: '',
  state_registration: '',
};

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
    // the address comes as an object; the form edits it field by field
    const a = client.address || {};
    setForm({
      ...EMPTY, ...client,
      street: a.street || '', number: a.number || '', complement: a.complement || '',
      district: a.district || '', city_name: a.city || '', state: a.state || '', zip_code: a.zip_code || '',
      state_registration: client.state_registration || '',
    });
    setEditingId(client.id);
    setOpen(true);
  };

  // achado F11: o backend exige documento (@NotBlank, único), mas o
  // formulário não avisava — o erro só chegava cru depois do 400 do servidor.
  // endereço incompleto tem o mesmo problema: o cadastro deixava salvar sem
  // rua/bairro/CEP, e o erro só aparecia depois, no meio da emissão da NF-e.
  const save = async () => {
    if (!form.name.trim()) return toast.error('Informe o nome do cliente.');
    if (!form.document.trim()) return toast.error('Informe o documento (CPF/CNPJ).');
    if (!form.street.trim()) return toast.error('Informe a rua.');
    if (!form.number.trim()) return toast.error('Informe o número.');
    if (!form.district.trim()) return toast.error('Informe o bairro.');
    if (!form.city_name.trim()) return toast.error('Informe a cidade.');
    if (form.state.trim().length !== 2) return toast.error('Informe a UF (2 letras).');
    if (form.zip_code.replace(/\D/g, '').length !== 8) return toast.error('Informe o CEP (8 números).');
    try {
      // `address: undefined` so the flat fields of the form (not the old address object) are what gets saved
      const payload = { ...form, address: undefined };
      if (editingId) {
        await db.Client.update(editingId, payload);
        toast.success('Cliente atualizado.');
      } else {
        await db.Client.create({ ...payload, validation_status: 'ativo', registered_by_role: 'admin' });
        toast.success('Cliente cadastrado.');
      }
      setOpen(false);
      reload();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const [rejecting, setRejecting] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const approve = async (client) => {
    try {
      await approveClient(client.id);
      toast.success('Cliente aprovado.');
      reload();
    } catch (e) {
      toast.error(e.message || 'Não foi possível aprovar o cliente.');
    }
  };

  const openReject = (client) => { setRejecting(client); setRejectReason(''); };
  const closeReject = () => { setRejecting(null); setRejectReason(''); };

  const confirmReject = async () => {
    if (!rejecting || !rejectReason.trim()) return;
    try {
      await rejectClient(rejecting.id, rejectReason.trim());
      toast.success('Cliente rejeitado.');
      closeReject();
      reload();
    } catch (e) {
      toast.error(e.message || 'Não foi possível rejeitar o cliente.');
    }
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
                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); approve(r); }}>
                          <Check size={14} /> Aprovar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openReject(r); }}>
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
          <Input label="Documento (CPF/CNPJ)*" value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} />
          <Input label="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Telefone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label="Rua*" value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} />
          <Input label="Número*" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
          <Input label="Complemento" value={form.complement} onChange={(e) => setForm({ ...form, complement: e.target.value })} />
          <Input label="Bairro*" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} />
          <Input label="Cidade*" value={form.city_name} onChange={(e) => setForm({ ...form, city_name: e.target.value })} />
          <Input label="UF*" maxLength={2} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} />
          <Input label="CEP*" inputMode="numeric" value={form.zip_code} onChange={(e) => setForm({ ...form, zip_code: e.target.value })} />
          <div style={{ gridColumn: '1 / -1' }}>
            <Input label="Inscrição estadual (só empresa contribuinte de ICMS)" value={form.state_registration}
              onChange={(e) => setForm({ ...form, state_registration: e.target.value })} placeholder="Deixe em branco se não tiver" />
          </div>
        </div>
      </Modal>

      <Modal
        open={!!rejecting}
        onClose={closeReject}
        title="Rejeitar cliente"
        footer={
          <>
            <Button variant="ghost" onClick={closeReject}>Fechar</Button>
            <Button variant="danger" onClick={confirmReject} disabled={!rejectReason.trim()}>Confirmar rejeição</Button>
          </>
        }
      >
        {rejecting && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ fontSize: '0.88rem', margin: 0 }}>
              Rejeitar o cadastro de <strong>{rejecting.name}</strong>. Informe o motivo.
            </p>
            <Input label="Motivo da rejeição*" value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)} placeholder="Ex: documento inválido" autoFocus />
          </div>
        )}
      </Modal>
    </div>
  );
}
