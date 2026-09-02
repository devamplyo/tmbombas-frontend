import { useState } from 'react';
import { Plus, AlertTriangle, Package, DollarSign, Ban, CheckCircle2 } from 'lucide-react';
import { db, activateProduct } from '@/api/client';
import useAsyncData from '@/hooks/useAsyncData';
import { useToast } from '@/components/ui/Toast';
import PageHeader from '@/components/ui/PageHeader';
import Stat from '@/components/ui/Stat';
import Card, { CardBody } from '@/components/ui/Card';
import ListRow from '@/components/ui/ListRow';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import { Input, Select } from '@/components/ui/Field';
import { brl, dateBR } from '@/lib/format';
import shared from '../shared.module.css';

const EMPTY_PRODUCT = { name: '', sku: '', barcode: '', category: 'PUMP', manufacturer: '', sale_price: '', stock_quantity: 0, min_stock: 5, unit: 'un', is_active: true };

const CATEGORY_OPTIONS = [
  { value: 'PUMP', label: 'Bomba' },
  { value: 'FILTER', label: 'Filtro' },
  { value: 'MOTOR', label: 'Motor' },
  { value: 'SPARE_PART', label: 'Peça de reposição' },
  { value: 'ACCESSORY', label: 'Acessório' },
  { value: 'CHEMICAL', label: 'Produto químico' },
];
const CATEGORY_LABEL = Object.fromEntries(CATEGORY_OPTIONS.map((c) => [c.value, c.label]));

const TABS = [
  { value: 'todos', label: 'Todos os Produtos' },
  { value: 'baixo', label: 'Estoque Baixo' },
  { value: 'saidas', label: 'Histórico de Saídas' },
];

export default function StockPage() {
  const toast = useToast();
  const { data, loading, reload } = useAsyncData(async () => {
    const [products, sales] = await Promise.all([db.Product.list(), db.Sale.list('-created_date')]);
    return { products, sales };
  }, []);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('todos');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_PRODUCT);
  const [editingId, setEditingId] = useState(null);

  const openNew = () => { setForm(EMPTY_PRODUCT); setEditingId(null); setOpen(true); };
  const openEdit = (p) => { setForm({ ...EMPTY_PRODUCT, ...p }); setEditingId(p.id); setOpen(true); };

  // achado F12: SKU e código de barras pareciam opcionais no formulário
  // (sem asterisco), mas o backend exige os dois — sem essa checagem, o
  // erro só aparecia depois do servidor recusar, cru e em inglês.
  const save = async () => {
    if (!form.name.trim()) return toast.error('Informe o nome do produto.');
    if (!form.sku.trim()) return toast.error('Informe o SKU.');
    if (!form.barcode.trim()) return toast.error('Informe o código de barras.');
    if (!form.manufacturer.trim()) return toast.error('Informe o fabricante.');
    try {
      if (editingId) {
        await db.Product.update(editingId, { ...form, sale_price: Number(form.sale_price), stock_quantity: Number(form.stock_quantity), min_stock: Number(form.min_stock) });
        toast.success('Produto atualizado.');
      } else {
        await db.Product.create({ ...form, sale_price: Number(form.sale_price), stock_quantity: Number(form.stock_quantity), min_stock: Number(form.min_stock) });
        toast.success('Produto cadastrado.');
      }
      setOpen(false); reload();
    } catch (e) { toast.error(e.message); }
  };

  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  // achado F5: o dropdown "Status" do formulário nunca era enviado ao
  // servidor. Desativar/ativar agora é uma ação própria, ligada aos
  // endpoints que já existem no backend (DELETE ativa desativa; o
  // reativar é novo dos dois lados).
  const toggleActive = async (p) => {
    try {
      if (p.is_active) {
        await db.Product.remove(p.id);
        toast.success('Produto desativado.');
      } else {
        await activateProduct(p.id);
        toast.success('Produto ativado.');
      }
      reload();
    } catch (e) {
      toast.error(e.message || 'Não foi possível atualizar o produto.');
    }
  };

  if (loading) return <div className={shared.loading}><Spinner /></div>;
  const { products, sales } = data;

  const totalProdutos = products.filter((p) => p.is_active).length;
  const valorImobilizado = products.reduce((sum, p) => sum + (p.sale_price || 0) * (p.stock_quantity || 0), 0);
  const lowStockProducts = products.filter((p) => p.stock_quantity <= (p.min_stock || 0));

  const bySearch = (list) => list.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku || '').toLowerCase().includes(search.toLowerCase())
  );

  const productList = tab === 'baixo' ? bySearch(lowStockProducts) : bySearch(products);

  // Each item of each consolidated sale is a stock "exit".
  const exits = sales
    .filter((s) => s.status === 'consolidada')
    .flatMap((s) => (s.items || []).map((it) => ({ ...it, sale_date: s.sale_date, client_name: s.client_name })))
    .slice(0, 30);

  return (
    <div>
      <PageHeader title="Estoque" subtitle="Produtos e controle de estoque"
        actions={<Button onClick={openNew}><Plus size={18} /> Novo produto</Button>} />

      <div className={shared.statsGrid}>
        <Stat icon={Package} label="Total de Produtos" value={totalProdutos} tone="primary" />
        <Stat icon={DollarSign} label="Valor Imobilizado" value={brl(valorImobilizado)} tone="success" />
        <Stat icon={AlertTriangle} label="Estoque Baixo" value={lowStockProducts.length} tone="danger" />
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <Button key={t.value} size="sm" variant={tab === t.value ? 'primary' : 'outline'} onClick={() => setTab(t.value)}>
            {t.label}{t.value === 'baixo' ? ` (${lowStockProducts.length})` : ''}
          </Button>
        ))}
      </div>

      {tab !== 'saidas' && (
        <div className={shared.toolbar}>
          <input className={shared.search} placeholder="Buscar produto..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      )}

      {tab !== 'saidas' ? (
        <Card>
          <CardBody style={{ padding: 0 }}>
            {productList.length === 0 ? (
              <div className={shared.loading} style={{ padding: '2rem' }}>Nenhum produto encontrado.</div>
            ) : (
              productList.map((r) => {
                const low = r.stock_quantity <= (r.min_stock || 0);
                return (
                  <ListRow
                    key={r.id}
                    icon={Package}
                    iconTone={low ? 'danger' : 'primary'}
                    title={r.name}
                    subtitle={`${CATEGORY_LABEL[r.category] || r.category || '—'} · ${brl(r.sale_price)}`}
                    onClick={() => openEdit(r)}
                    right={
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        {!r.is_active && <Badge tone="muted">Inativo</Badge>}
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: low ? 'hsl(var(--destructive))' : 'inherit' }}>
                          {low && <AlertTriangle size={14} />}{r.stock_quantity} {r.unit}
                        </span>
                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); toggleActive(r); }}>
                          {r.is_active ? <><Ban size={14} /> Desativar</> : <><CheckCircle2 size={14} /> Ativar</>}
                        </Button>
                      </div>
                    }
                  />
                );
              })
            )}
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody style={{ padding: 0 }}>
            {exits.length === 0 ? (
              <div className={shared.loading} style={{ padding: '2rem' }}>Nenhuma saída registrada.</div>
            ) : (
              exits.map((it, i) => (
                <ListRow
                  key={i}
                  icon={Package}
                  iconTone="danger"
                  title={it.product_name}
                  subtitle={`${it.client_name || 'Venda'} · ${dateBR(it.sale_date)}`}
                  right={`-${it.quantity}`}
                />
              ))
            )}
          </CardBody>
        </Card>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editingId ? 'Editar produto' : 'Novo produto'}
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save}>Salvar</Button></>}>
        <div className={shared.formGrid}>
          <div style={{ gridColumn: '1/-1' }}><Input label="Nome*" value={form.name} onChange={f('name')} /></div>
          <Input label="SKU*" value={form.sku} onChange={f('sku')} />
          <Input label="Código de barras*" value={form.barcode} onChange={f('barcode')} />
          <Input label="Fabricante*" value={form.manufacturer} onChange={f('manufacturer')} />
          <Select label="Categoria" value={form.category} onChange={f('category')}>
            {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
          <Input label="Unidade" value={form.unit} onChange={f('unit')} />
          <Input label="Preço de venda (R$)" type="number" step="0.01" value={form.sale_price} onChange={f('sale_price')} />
          <Input label="Qtd. em estoque" type="number" value={form.stock_quantity} onChange={f('stock_quantity')} />
          <Input label="Estoque mínimo" type="number" value={form.min_stock} onChange={f('min_stock')} />
        </div>
      </Modal>
    </div>
  );
}
