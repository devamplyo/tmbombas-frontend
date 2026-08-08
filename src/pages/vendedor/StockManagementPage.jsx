import { useState } from 'react';
import { Package, AlertTriangle } from 'lucide-react';
import { db } from '@/api/client';
import useAsyncData from '@/hooks/useAsyncData';
import { useToast } from '@/components/ui/Toast';
import PageHeader from '@/components/ui/PageHeader';
import Card, { CardHeader, CardBody } from '@/components/ui/Card';
import ListRow from '@/components/ui/ListRow';
import Table from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import { Input, Select } from '@/components/ui/Field';
import { brl, dateBR } from '@/lib/format';
import shared from '../shared.module.css';

const EMPTY_ENTRY = { product_id: '', supplier_id: '', quantity: 1, unit_cost: '', invoice_number: '' };
const EMPTY_SUPPLIER = { name: '', document: '', email: '', phone: '', contact_person: '' };
const EMPTY_PRODUCT = { name: '', sku: '', barcode: '', category: 'PUMP', manufacturer: '', sale_price: '', stock_quantity: 0, min_stock: 5, unit: 'un' };

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
  { value: 'produtos', label: 'Produtos' },
  { value: 'novo-produto', label: 'Novo Produto' },
  { value: 'entrada-lote', label: 'Entrada de Lote' },
  { value: 'fornecedores', label: 'Fornecedores' },
];

export default function StockManagementPage() {
  const toast = useToast();
  const { data, loading, reload } = useAsyncData(async () => {
    const [products, entries, suppliers] = await Promise.all([
      db.Product.filter({ is_active: true }),
      db.StockEntry.list('-entry_date'),
      db.Supplier.list(),
    ]);
    return { products, entries, suppliers };
  }, []);

  const [tab, setTab] = useState('produtos');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('');
  const [form, setForm] = useState(EMPTY_ENTRY);
  const [supplierForm, setSupplierForm] = useState(EMPTY_SUPPLIER);
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT);

  const saveEntry = async () => {
    if (!form.product_id) return toast.error('Selecione o produto.');
    if (!form.quantity || Number(form.quantity) <= 0) return toast.error('Quantidade inválida.');
    try {
      const qty = Number(form.quantity);
      const cost = Number(form.unit_cost) || 0;
      // The backend records the entry AND increments the product's stock atomically.
      // no entry_date: the server uses its own today's date (the same clock
      // the report uses), avoiding a timezone mismatch with the browser.
      await db.StockEntry.create({ ...form, quantity: qty, unit_cost: cost });
      toast.success('Entrada de estoque registrada.');
      setForm(EMPTY_ENTRY); reload();
    } catch (e) { toast.error(e.message); }
  };

  const saveSupplier = async () => {
    if (!supplierForm.name.trim()) return toast.error('Informe o nome do fornecedor.');
    try {
      await db.Supplier.create(supplierForm);
      toast.success('Fornecedor cadastrado.');
      setSupplierForm(EMPTY_SUPPLIER); reload();
    } catch (e) { toast.error(e.message); }
  };

  const saveProduct = async () => {
    if (!productForm.name.trim()) return toast.error('Informe o nome do produto.');
    if (!productForm.manufacturer.trim()) return toast.error('Informe o fabricante.');
    try {
      await db.Product.create({
        ...productForm,
        sale_price: Number(productForm.sale_price),
        stock_quantity: Number(productForm.stock_quantity),
        min_stock: Number(productForm.min_stock),
      });
      toast.success('Produto cadastrado.');
      setProductForm(EMPTY_PRODUCT); reload();
    } catch (e) { toast.error(e.message); }
  };

  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const sf = (k) => (e) => setSupplierForm({ ...supplierForm, [k]: e.target.value });
  const pf = (k) => (e) => setProductForm({ ...productForm, [k]: e.target.value });

  if (loading) return <div className={shared.loading}><Spinner /></div>;
  const { products, entries, suppliers } = data;

  const filteredProducts = products.filter((p) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || p.name.toLowerCase().includes(q) || (p.barcode || '').includes(q);
    const matchesCategory = !categoryFilter || p.category === categoryFilter;
    const low = p.stock_quantity <= (p.min_stock || 0);
    const matchesStock = !stockFilter || (stockFilter === 'baixo' ? low : !low);
    return matchesSearch && matchesCategory && matchesStock;
  });

  return (
    <div>
      <PageHeader title="Controle de Estoque" subtitle="Cadastro de produtos, fornecedores e entrada de lotes" />

      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <Button key={t.value} size="sm" variant={tab === t.value ? 'primary' : 'outline'} onClick={() => setTab(t.value)}>
            {t.label}
          </Button>
        ))}
      </div>

      {tab === 'produtos' && (
        <Card>
          <CardBody>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <input className={shared.search} style={{ flex: 1, minWidth: 200 }} placeholder="Buscar por nome ou código de barras..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ maxWidth: 200 }}>
                <option value="">Todas Categorias</option>
                {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </Select>
              <Select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)} style={{ maxWidth: 200 }}>
                <option value="">Todo Estoque</option>
                <option value="baixo">Estoque baixo</option>
                <option value="normal">Estoque normal</option>
              </Select>
            </div>
          </CardBody>
          <div style={{ borderTop: '1px solid hsl(var(--border))' }}>
            {filteredProducts.length === 0 ? (
              <div className={shared.loading} style={{ padding: '2rem' }}>Nenhum produto encontrado.</div>
            ) : (
              filteredProducts.map((p) => {
                const low = p.stock_quantity <= (p.min_stock || 0);
                return (
                  <ListRow
                    key={p.id}
                    icon={Package}
                    iconTone={low ? 'danger' : 'primary'}
                    title={p.name}
                    subtitle={`${p.sku || p.barcode || '—'} · ${CATEGORY_LABEL[p.category] || p.category} · Mín. ${p.min_stock || 0}`}
                    right={
                      <div style={{ textAlign: 'right' }}>
                        <div>{brl(p.sale_price)}</div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: low ? 'hsl(var(--destructive))' : 'hsl(var(--muted-foreground))' }}>
                          {low && <AlertTriangle size={12} />}{p.stock_quantity} {p.unit}
                        </div>
                      </div>
                    }
                  />
                );
              })
            )}
          </div>
        </Card>
      )}

      {tab === 'novo-produto' && (
        <Card>
          <CardHeader title="Novo Produto" />
          <CardBody>
            <div className={shared.formGrid}>
              <div style={{ gridColumn: '1/-1' }}><Input label="Nome*" value={productForm.name} onChange={pf('name')} /></div>
              <Input label="SKU" value={productForm.sku} onChange={pf('sku')} />
              <Input label="Código de barras" value={productForm.barcode} onChange={pf('barcode')} />
              <Input label="Fabricante*" value={productForm.manufacturer} onChange={pf('manufacturer')} />
              <Select label="Categoria" value={productForm.category} onChange={pf('category')}>
                {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </Select>
              <Input label="Unidade" value={productForm.unit} onChange={pf('unit')} />
              <Input label="Preço de venda (R$)" type="number" step="0.01" value={productForm.sale_price} onChange={pf('sale_price')} />
              <Input label="Qtd. em estoque" type="number" value={productForm.stock_quantity} onChange={pf('stock_quantity')} />
              <Input label="Estoque mínimo" type="number" value={productForm.min_stock} onChange={pf('min_stock')} />
            </div>
            <Button style={{ marginTop: '1rem' }} onClick={saveProduct}>Salvar Produto</Button>
          </CardBody>
        </Card>
      )}

      {tab === 'entrada-lote' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', alignItems: 'start' }}>
          <Card>
            <CardHeader title="Entrada de Lote" />
            <CardBody>
              <div className={shared.formGrid}>
                <Select label="Produto*" value={form.product_id} onChange={f('product_id')}>
                  <option value="">Selecione...</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name} (estoque: {p.stock_quantity})</option>)}
                </Select>
                <Select label="Fornecedor" value={form.supplier_id} onChange={f('supplier_id')}>
                  <option value="">Selecione...</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
                <Input label="Quantidade*" type="number" min="1" value={form.quantity} onChange={f('quantity')} />
                <Input label="Custo unitário (R$)" type="number" step="0.01" value={form.unit_cost} onChange={f('unit_cost')} />
                <Input label="Nº da nota fiscal" value={form.invoice_number} onChange={f('invoice_number')} />
              </div>
              <Button style={{ marginTop: '1rem' }} onClick={saveEntry}>Salvar Entrada</Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Últimas entradas" />
            <CardBody style={{ padding: 0 }}>
              <Table
                columns={[
                  { key: 'product_name', header: 'Produto' },
                  { key: 'quantity', header: 'Qtd.', align: 'center' },
                  { key: 'total_cost', header: 'Total', align: 'right', render: (r) => brl(r.total_cost) },
                  { key: 'entry_date', header: 'Data', render: (r) => dateBR(r.entry_date) },
                ]}
                rows={entries.slice(0, 8)}
                empty="Nenhuma entrada."
              />
            </CardBody>
          </Card>
        </div>
      )}

      {tab === 'fornecedores' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', alignItems: 'start' }}>
          <Card>
            <CardHeader title="Novo Fornecedor" />
            <CardBody>
              <div className={shared.formGrid}>
                <div style={{ gridColumn: '1/-1' }}><Input label="Nome*" value={supplierForm.name} onChange={sf('name')} /></div>
                <Input label="CNPJ" value={supplierForm.document} onChange={sf('document')} />
                <Input label="Telefone" value={supplierForm.phone} onChange={sf('phone')} />
                <Input label="E-mail" value={supplierForm.email} onChange={sf('email')} />
                <Input label="Contato" value={supplierForm.contact_person} onChange={sf('contact_person')} />
              </div>
              <Button style={{ marginTop: '1rem' }} onClick={saveSupplier}>Salvar Fornecedor</Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Fornecedores cadastrados" />
            <CardBody style={{ padding: 0 }}>
              {suppliers.length === 0 ? (
                <div className={shared.loading} style={{ padding: '2rem' }}>Nenhum fornecedor.</div>
              ) : (
                suppliers.map((s) => (
                  <ListRow key={s.id} title={s.name} subtitle={s.contact_person || '—'} right={s.phone || '—'} />
                ))
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
