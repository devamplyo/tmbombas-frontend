import { useState } from 'react';
import { Plus, Trash2, FileDown } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import jsPDF from 'jspdf';
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
import { ensureSpace } from '@/lib/pdf';
import { OS_STATUS } from '@/lib/status';
import shared from '../shared.module.css';

const EMPTY_ITEM = { name: '', description: '', value: '' };
const EMPTY_ORCAMENTO = { type: 'orcamento', client_id: '', scheduled_date: '', items: [{ ...EMPTY_ITEM }] };
const EMPTY_OS = { type: 'os', client_id: '', description: '', service_value: '', scheduled_date: '' };

const TABS = [
  { value: 'orcamento', label: 'Orçamento' },
  { value: 'os', label: 'Ordens de Serviço' },
];

function generateOrcamentoPdf(order) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text('Orçamento de Serviço', 14, 18);
  doc.setFontSize(10);
  doc.text(`Nº ${order.order_number || order.id}`, 14, 26);
  doc.text(`Cliente: ${order.client_name || '-'}`, 14, 33);
  doc.text(`Data: ${dateBR(order.created_date)}`, 14, 39);
  if (order.scheduled_date) doc.text(`Previsão: ${dateBR(order.scheduled_date)}`, 14, 45);

  let y = 56;
  doc.setFontSize(11);
  doc.text('Itens', 14, y);
  y += 7;
  doc.setFontSize(9);
  (order.items || []).forEach((it) => {
    y = ensureSpace(doc, y);
    doc.text(it.name || '-', 14, y);
    doc.text(brl(it.value), 196, y, { align: 'right' });
    y += 5;
    if (it.description) {
      const lines = doc.splitTextToSize(it.description, 160);
      y = ensureSpace(doc, y, lines.length * 4);
      doc.setFontSize(8);
      doc.text(lines, 18, y);
      y += lines.length * 4;
      doc.setFontSize(9);
    }
    y += 2;
  });

  y = ensureSpace(doc, y, 12) + 6;
  doc.setFontSize(12);
  doc.text(`Total: ${brl(order.service_value)}`, 14, y);

  doc.save(`orcamento-${order.order_number || order.id}.pdf`);
}

export default function FCOOrcamentosPage() {
  const { user } = useOutletContext();
  const toast = useToast();
  const { data, loading, reload } = useAsyncData(async () => {
    const [orders, clients] = await Promise.all([
      db.ServiceOrder.list('-created_date'),
      db.Client.filter({ validation_status: 'ativo' }),
    ]);
    return { orders, clients };
  }, []);
  const [tab, setTab] = useState('orcamento');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_ORCAMENTO);

  const blankFor = (type) =>
    type === 'orcamento' ? { ...EMPTY_ORCAMENTO, items: [{ ...EMPTY_ITEM }] } : { ...EMPTY_OS };

  const openNew = (type) => {
    setForm(blankFor(type));
    setOpen(true);
  };

  // switches the type while keeping what's already filled in common (client, date)
  const changeType = (type) =>
    setForm((f) => ({ ...blankFor(type), client_id: f.client_id, scheduled_date: f.scheduled_date }));

  const itemTotal = (items) => items.reduce((sum, it) => sum + (Number(it.value) || 0), 0);

  const updateItem = (idx, key, value) => {
    const items = form.items.map((it, i) => (i === idx ? { ...it, [key]: value } : it));
    setForm({ ...form, items });
  };
  const addItem = () => setForm({ ...form, items: [...form.items, { ...EMPTY_ITEM }] });
  const removeItem = (idx) => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });

  const save = async () => {
    if (!form.client_id) return toast.error('Selecione o cliente.');
    const client = data.clients.find((c) => c.id === form.client_id);

    if (form.type === 'orcamento') {
      const items = form.items.filter((it) => it.name.trim());
      if (items.length === 0) return toast.error('Adicione pelo menos um item com nome.');
      try {
        await db.ServiceOrder.create({
          type: 'orcamento',
          client_id: form.client_id,
          client_name: client?.name || '',
          title: `Orçamento — ${client?.name || ''}`,
          scheduled_date: form.scheduled_date || null,
          items,
          assigned_to_id: user.id,
          assigned_to_name: user.full_name,
          status: 'aguardando_validacao',
          payment_status: 'a_receber',
        });
        toast.success('Orçamento criado e enviado para validação.');
        setOpen(false); reload();
      } catch (e) { toast.error(e.message); }
      return;
    }

    if (!form.description.trim()) return toast.error('Informe a descrição.');
    try {
      await db.ServiceOrder.create({
        type: 'os',
        client_id: form.client_id,
        client_name: client?.name || '',
        description: form.description,
        scheduled_date: form.scheduled_date || null,
        service_value: Number(form.service_value) || 0,
        assigned_to_id: user.id,
        assigned_to_name: user.full_name,
        status: 'aguardando_validacao',
        payment_status: 'a_receber',
      });
      toast.success('Criado e enviado para validação.');
      setOpen(false); reload();
    } catch (e) { toast.error(e.message); }
  };

  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  if (loading) return <div className={shared.loading}><Spinner /></div>;
  const { clients } = data;
  const orders = data.orders;
  // what they created or what was assigned to them — never another profile's
  const myOrders = orders.filter((o) => o.created_by_id === user.id || o.assigned_to_id === user.id);
  const tabbed = myOrders.filter((o) => o.type === tab);

  return (
    <div>
      <PageHeader title="Orçamentos e Ordens de Serviço" subtitle="Criar e acompanhar orçamentos e OS"
        actions={<Button onClick={() => openNew(tab)}><Plus size={18} /> Novo</Button>} />

      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.25rem' }}>
        {TABS.map((t) => (
          <Button key={t.value} size="sm" variant={tab === t.value ? 'primary' : 'outline'} onClick={() => setTab(t.value)}>
            {t.label} ({myOrders.filter((o) => o.type === t.value).length})
          </Button>
        ))}
      </div>

      <Card>
        <CardBody style={{ padding: 0 }}>
          <Table
            columns={[
              { key: 'client_name', header: 'Cliente' },
              tab === 'orcamento'
                ? { key: 'items', header: 'Itens', render: (r) => `${(r.items || []).length} item(ns)` }
                : { key: 'description', header: 'Descrição', render: (r) => (r.description || '').slice(0, 50) },
              { key: 'service_value', header: 'Valor', align: 'right', render: (r) => brl(r.service_value) },
              { key: 'status', header: 'Status', render: (r) => <Badge tone={OS_STATUS[r.status]?.tone}>{OS_STATUS[r.status]?.label}</Badge> },
              { key: 'scheduled_date', header: 'Data', render: (r) => dateBR(r.scheduled_date) },
              ...(tab === 'orcamento' ? [{
                key: 'pdf', header: '', render: (r) => (
                  <Button size="sm" variant="ghost" onClick={() => generateOrcamentoPdf(r)}><FileDown size={14} /> Gerar PDF</Button>
                ),
              }] : []),
            ]}
            rows={tabbed}
            empty={tab === 'orcamento' ? 'Nenhum orçamento.' : 'Nenhuma ordem de serviço.'}
          />
        </CardBody>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={form.type === 'orcamento' ? 'Novo Orçamento' : 'Nova Ordem de Serviço'} width={620}
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save}>Enviar para validação</Button></>}>
        <div className={shared.formGrid}>
          <Select label="Tipo" value={form.type} onChange={(e) => changeType(e.target.value)}>
            <option value="orcamento">Orçamento</option>
            <option value="os">Ordem de Serviço</option>
          </Select>
          <Select label="Cliente*" value={form.client_id} onChange={f('client_id')}>
            <option value="">Selecione...</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Input label="Data prevista" type="date" value={form.scheduled_date} onChange={f('scheduled_date')} />

          {form.type === 'os' && (
            <>
              <Input label="Valor estimado (R$)" type="number" step="0.01" value={form.service_value} onChange={f('service_value')} />
              <div style={{ gridColumn: '1/-1' }}>
                <Textarea label="Descrição*" value={form.description} onChange={f('description')} rows={4} />
              </div>
            </>
          )}
        </div>

        {form.type === 'orcamento' && (
          <div style={{ marginTop: '1rem' }}>
            <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Itens do orçamento</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {form.items.map((it, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px auto', gap: '0.5rem', alignItems: 'start' }}>
                  <Input placeholder="Nome do item*" value={it.name} onChange={(e) => updateItem(idx, 'name', e.target.value)} />
                  <Input placeholder="Descrição/justificativa" value={it.description} onChange={(e) => updateItem(idx, 'description', e.target.value)} />
                  <Input placeholder="Valor (R$)" type="number" step="0.01" value={it.value} onChange={(e) => updateItem(idx, 'value', e.target.value)} />
                  <Button variant="ghost" size="sm" onClick={() => removeItem(idx)} disabled={form.items.length === 1}><Trash2 size={14} /></Button>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" style={{ marginTop: '0.6rem' }} onClick={addItem}><Plus size={14} /> Adicionar item</Button>
            <div style={{ marginTop: '0.9rem', fontSize: '0.95rem', textAlign: 'right' }}>
              Total: <strong>{brl(itemTotal(form.items))}</strong>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
