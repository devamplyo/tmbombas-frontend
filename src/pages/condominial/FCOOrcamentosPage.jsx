import { useState } from 'react';
import { Plus, Trash2, FileDown } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { db } from '@/api/client';
import useAsyncData from '@/hooks/useAsyncData';
import { useToast } from '@/components/ui/Toast';
import PageHeader from '@/components/ui/PageHeader';
import Card, { CardBody } from '@/components/ui/Card';
import Table from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import ConfirmSubmit from '@/components/ui/ConfirmSubmit';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { brl, dateBR } from '@/lib/format';
import { generateServiceOrderPdf } from '@/lib/orderPdf';
import { OS_STATUS } from '@/lib/status';
import shared from '../shared.module.css';

const EMPTY_ITEM = { name: '', description: '', value: '', product_id: '', quantity: 1 };
const EMPTY_ORCAMENTO = { type: 'orcamento', client_id: '', scheduled_date: '', items: [{ ...EMPTY_ITEM }] };
const EMPTY_MATERIAL = { product_id: '', quantity: 1 };
const EMPTY_OS = { type: 'os', client_id: '', description: '', service_value: '', scheduled_date: '', materials: [] };

const TABS = [
  { value: 'orcamento', label: 'Orçamento' },
  { value: 'os', label: 'Ordens de Serviço' },
];

export default function FCOOrcamentosPage() {
  const { user } = useOutletContext();
  const toast = useToast();
  const { data, loading, reload } = useAsyncData(async () => {
    const [orders, clients, products] = await Promise.all([
      db.ServiceOrder.list('-created_date'),
      db.Client.filter({ validation_status: 'ativo' }),
      db.Product.filter({ is_active: true }),
    ]);
    return { orders, clients, products };
  }, []);
  const [tab, setTab] = useState('orcamento');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_ORCAMENTO);
  const [confirmando, setConfirmando] = useState(false);
  const [saving, setSaving] = useState(false);

  const blankFor = (type) =>
    type === 'orcamento' ? { ...EMPTY_ORCAMENTO, items: [{ ...EMPTY_ITEM }] } : { ...EMPTY_OS, materials: [] };

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
  // ao escolher um produto do estoque, pré-preenche o nome (se ainda vazio) e
  // recalcula o valor pelo preço do produto — o usuário continua podendo editar depois
  const selectProduct = (idx, productId) => {
    const product = data.products.find((p) => String(p.id) === String(productId));
    const items = form.items.map((it, i) => {
      if (i !== idx) return it;
      const quantity = it.quantity || 1;
      return {
        ...it,
        product_id: productId,
        name: it.name.trim() || product?.name || it.name,
        value: product ? String(product.sale_price * quantity) : it.value,
      };
    });
    setForm({ ...form, items });
  };
  // com peça do estoque selecionada, mudar a quantidade recalcula o valor (preço x quantidade)
  const updateQuantity = (idx, quantity) => {
    const items = form.items.map((it, i) => {
      if (i !== idx) return it;
      const product = data.products.find((p) => String(p.id) === String(it.product_id));
      return {
        ...it,
        quantity,
        value: product ? String(product.sale_price * (Number(quantity) || 0)) : it.value,
      };
    });
    setForm({ ...form, items });
  };
  const addItem = () => setForm({ ...form, items: [...form.items, { ...EMPTY_ITEM }] });
  const removeItem = (idx) => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });

  // material do estoque da OS: o valor sai sempre do preço do produto x quantidade
  const materialLines = (materials) => (materials || [])
    .filter((m) => m.product_id)
    .map((m) => {
      const product = data.products.find((p) => String(p.id) === String(m.product_id));
      const quantity = Number(m.quantity) || 0;
      return { product, quantity, subtotal: product ? product.sale_price * quantity : 0 };
    })
    .filter((l) => l.product);
  const osTotal = (f) => (Number(f.service_value) || 0) + materialLines(f.materials).reduce((sum, l) => sum + l.subtotal, 0);
  const updateMaterial = (idx, key, value) =>
    setForm({ ...form, materials: form.materials.map((m, i) => (i === idx ? { ...m, [key]: value } : m)) });
  const addMaterial = () => setForm({ ...form, materials: [...form.materials, { ...EMPTY_MATERIAL }] });
  const removeMaterial = (idx) => setForm({ ...form, materials: form.materials.filter((_, i) => i !== idx) });

  // the button only checks and opens the "confira antes de enviar" screen — nothing is sent yet
  const askConfirm = () => {
    if (!form.client_id) return toast.error('Selecione o cliente.');
    if (form.type === 'orcamento') {
      if (!form.items.some((it) => it.name.trim())) return toast.error('Adicione pelo menos um item com nome.');
    } else if (!form.description.trim()) {
      return toast.error('Informe a descrição.');
    } else if (materialLines(form.materials).some((l) => l.quantity < 1)) {
      return toast.error('Informe a quantidade do material.');
    }
    setConfirmando(true);
  };

  const save = async () => {
    const client = data.clients.find((c) => c.id === form.client_id);
    setSaving(true);
    try {
      if (form.type === 'orcamento') {
        const items = form.items.filter((it) => it.name.trim());
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
      } else {
        const serviceValue = Number(form.service_value) || 0;
        const materialItems = materialLines(form.materials).map((l) => ({
          name: l.product.name, description: '', value: l.subtotal, product_id: l.product.id, quantity: l.quantity,
        }));
        // com material, o valor da OS é a soma dos itens: o serviço entra como uma linha própria
        const osItems = materialItems.length
          ? [...(serviceValue > 0 ? [{ name: 'Serviço', description: '', value: serviceValue, product_id: '', quantity: 1 }] : []), ...materialItems]
          : undefined;
        await db.ServiceOrder.create({
          type: 'os',
          client_id: form.client_id,
          client_name: client?.name || '',
          description: form.description,
          scheduled_date: form.scheduled_date || null,
          service_value: materialItems.length ? osTotal(form) : serviceValue,
          items: osItems,
          assigned_to_id: user.id,
          assigned_to_name: user.full_name,
          status: 'aguardando_validacao',
          payment_status: 'a_receber',
        });
        toast.success('Criado e enviado para validação.');
      }
      setOpen(false); reload();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); setConfirmando(false); }
  };

  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  if (loading) return <div className={shared.loading}><Spinner /></div>;
  const { clients, products } = data;
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
              {
                key: 'pdf', header: '', render: (r) => (
                  <Button size="sm" variant="ghost" onClick={() => generateServiceOrderPdf(r)}><FileDown size={14} /> Gerar PDF</Button>
                ),
              },
            ]}
            rows={tabbed}
            empty={tab === 'orcamento' ? 'Nenhum orçamento.' : 'Nenhuma ordem de serviço.'}
          />
        </CardBody>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={form.type === 'orcamento' ? 'Novo Orçamento' : 'Nova Ordem de Serviço'} width={620}
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={askConfirm}>Enviar para validação</Button></>}>
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

        {form.type === 'os' && (
          <div style={{ marginTop: '1rem' }}>
            <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Material do estoque (opcional)</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {form.materials.map((m, idx) => {
                const product = products.find((p) => String(p.id) === String(m.product_id));
                return (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 100px auto', gap: '0.5rem', alignItems: 'start' }}>
                    <Select value={m.product_id} onChange={(e) => updateMaterial(idx, 'product_id', e.target.value)}>
                      <option value="">Escolha o material</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name} (estoque: {p.stock_quantity}) — {brl(p.sale_price)}</option>)}
                    </Select>
                    <Input placeholder="Qtd." type="number" min="1" value={m.quantity} onChange={(e) => updateMaterial(idx, 'quantity', e.target.value)} />
                    <span style={{ fontSize: '0.85rem', textAlign: 'right', paddingTop: '0.6rem' }}>
                      {product ? brl(product.sale_price * (Number(m.quantity) || 0)) : '—'}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => removeMaterial(idx)}><Trash2 size={14} /></Button>
                  </div>
                );
              })}
            </div>
            <Button variant="outline" size="sm" style={{ marginTop: '0.6rem' }} onClick={addMaterial}><Plus size={14} /> Adicionar material</Button>
            <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginTop: '0.5rem' }}>
              O valor do material vem do preço do estoque e a baixa acontece ao concluir o serviço.
            </p>
            <div style={{ marginTop: '0.6rem', fontSize: '0.95rem', textAlign: 'right' }}>
              Total (serviço + material): <strong>{brl(osTotal(form))}</strong>
            </div>
          </div>
        )}

        {form.type === 'orcamento' && (
          <div style={{ marginTop: '1rem' }}>
            <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Itens do orçamento</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {form.items.map((it, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '0.5rem', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px auto', gap: '0.5rem', alignItems: 'start' }}>
                    <Input placeholder="Nome do item*" value={it.name} onChange={(e) => updateItem(idx, 'name', e.target.value)} />
                    <Input placeholder="Descrição/justificativa" value={it.description} onChange={(e) => updateItem(idx, 'description', e.target.value)} />
                    <Input placeholder="Valor (R$)" type="number" step="0.01" value={it.value} disabled={!!it.product_id} onChange={(e) => updateItem(idx, 'value', e.target.value)} />
                    <Button variant="ghost" size="sm" onClick={() => removeItem(idx)} disabled={form.items.length === 1}><Trash2 size={14} /></Button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '0.5rem' }}>
                    <Select value={it.product_id} onChange={(e) => selectProduct(idx, e.target.value)}>
                      <option value="">Peça do estoque (opcional)</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name} (estoque: {p.stock_quantity})</option>)}
                    </Select>
                    {it.product_id && (
                      <Input placeholder="Qtd." type="number" min="1" value={it.quantity} onChange={(e) => updateQuantity(idx, e.target.value)} />
                    )}
                  </div>
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

      <ConfirmSubmit
        open={confirmando}
        title={form.type === 'orcamento' ? 'Confira o orçamento antes de enviar' : 'Confira a OS antes de enviar'}
        client={clients.find((c) => String(c.id) === String(form.client_id))?.name}
        rows={[
          { label: 'Tipo', value: form.type === 'orcamento' ? 'Orçamento' : 'Ordem de Serviço' },
          { label: 'Data prevista', value: dateBR(form.scheduled_date) },
          ...(form.type === 'os' ? [{ label: 'Valor estimado', value: form.service_value ? brl(Number(form.service_value)) : '' }] : []),
        ]}
        items={form.type === 'orcamento'
          ? form.items.filter((it) => it.name.trim()).map((it) => ({ title: it.name, subtitle: it.description, amount: Number(it.value) || 0 }))
          : materialLines(form.materials).map((l) => ({ title: l.product.name, subtitle: `${l.quantity} × ${brl(l.product.sale_price)}`, amount: l.subtotal }))}
        total={form.type === 'orcamento'
          ? itemTotal(form.items.filter((it) => it.name.trim()))
          : (materialLines(form.materials).length ? osTotal(form) : undefined)}
        note={form.type === 'os' ? { label: 'Descrição', text: form.description } : undefined}
        saving={saving}
        onCancel={() => setConfirmando(false)}
        onConfirm={save}
      />
    </div>
  );
}
