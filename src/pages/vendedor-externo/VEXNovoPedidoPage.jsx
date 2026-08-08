import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Minus, Trash2, Send } from 'lucide-react';
import { db, createExternalOrder } from '@/api/client';
import useAsyncData from '@/hooks/useAsyncData';
import { useToast } from '@/components/ui/Toast';
import PageHeader from '@/components/ui/PageHeader';
import Card, { CardBody } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import { Select } from '@/components/ui/Field';
import { brl } from '@/lib/format';
import { PAYMENT_METHOD } from '@/lib/status';
import shared from '../shared.module.css';
import styles from './VEXNovoPedidoPage.module.css';

export default function VEXNovoPedidoPage() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const { data, loading } = useAsyncData(async () => {
    const [clients, products] = await Promise.all([
      db.Client.filter({ id: clientId }),
      db.Product.filter({ is_active: true }),
    ]);
    return { client: clients[0] || null, products };
  }, [clientId]);

  const [cart, setCart] = useState([]);
  const [payment, setPayment] = useState('pix');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

  const categories = [...new Set((data?.products || []).map((p) => p.category).filter(Boolean))].sort();

  const filtered = (data?.products || []).filter((p) => {
    const matchText = p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = !category || p.category === category;
    return matchText && matchCat && p.stock_quantity > 0;
  });

  const addItem = (product) => {
    setCart((c) => {
      const idx = c.findIndex((i) => i.product_id === product.id);
      if (idx !== -1) {
        const u = [...c];
        u[idx] = { ...u[idx], quantity: u[idx].quantity + 1, total: (u[idx].quantity + 1) * u[idx].unit_price };
        return u;
      }
      return [...c, { product_id: product.id, product_name: product.name, unit_price: product.sale_price, quantity: 1, total: product.sale_price }];
    });
  };

  const changeQty = (pid, delta) => {
    setCart((c) => c.map((i) => {
      if (i.product_id !== pid) return i;
      const qty = i.quantity + delta;
      if (qty <= 0) return null;
      return { ...i, quantity: qty, total: qty * i.unit_price };
    }).filter(Boolean));
  };

  const totalAmount = cart.reduce((s, i) => s + i.total, 0);

  const submit = async () => {
    if (!cart.length) return toast.error('Adicione itens ao pedido.');
    try {
      // Sends it for the ADM to approve — stock is only deducted once they approve it.
      await createExternalOrder({
        clientName: data.client?.name || '',
        notes: `Pagamento: ${PAYMENT_METHOD[payment] || payment}`,
        items: cart,
      });
      toast.success('Pedido enviado para o ADM aprovar.');
      navigate(`/vendedor-externo/clientes/${clientId}`);
    } catch (e) { toast.error(e.message); }
  };

  if (loading) return <div className={shared.loading}><Spinner /></div>;
  const { client, products } = data;

  return (
    <div>
      <PageHeader
        title={`Novo pedido — ${client?.name || '...'}`}
        actions={<Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Voltar</Button>}
      />
      <div className={styles.layout}>
        <div>
          <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.75rem' }}>
            <input className={shared.search} placeholder="Buscar por nome..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1 }} />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--input))', borderRadius: 'var(--radius)', color: 'hsl(var(--foreground))', padding: '0.55rem 0.75rem', fontSize: '0.9rem', minWidth: 160 }}
            >
              <option value="">Todas categorias</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className={styles.productGrid}>
            {filtered.map((p) => (
              <button key={p.id} className={styles.productCard} onClick={() => addItem(p)}>
                <span>{p.name}</span>
                <span style={{ color: 'hsl(var(--primary))', fontWeight: 700 }}>{brl(p.sale_price)}</span>
                <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>Estoque: {p.stock_quantity}</span>
              </button>
            ))}
          </div>
        </div>

        <Card>
          <div style={{ padding: '0.9rem 1rem', fontWeight: 600, borderBottom: '1px solid hsl(var(--border))' }}>Pedido</div>
          <CardBody>
            {!cart.length && <p className={shared.muted}>Nenhum item.</p>}
            {cart.map((item) => (
              <div key={item.product_id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem', fontSize: '0.85rem' }}>
                <span style={{ flex: 1 }}>{item.product_name}</span>
                <button onClick={() => changeQty(item.product_id, -1)} style={{ border: 'none', background: 'hsl(var(--secondary))', borderRadius: 4, padding: '0.2rem 0.35rem', cursor: 'pointer' }}><Minus size={12} /></button>
                <span style={{ minWidth: 20, textAlign: 'center' }}>{item.quantity}</span>
                <button onClick={() => changeQty(item.product_id, 1)} style={{ border: 'none', background: 'hsl(var(--secondary))', borderRadius: 4, padding: '0.2rem 0.35rem', cursor: 'pointer' }}><Plus size={12} /></button>
                <span style={{ minWidth: 60, textAlign: 'right' }}>{brl(item.total)}</span>
                <button onClick={() => setCart((c) => c.filter((i) => i.product_id !== item.product_id))} style={{ border: 'none', background: 'none', color: 'hsl(var(--destructive))', cursor: 'pointer', lineHeight: 0 }}><Trash2 size={14} /></button>
              </div>
            ))}
            {cart.length > 0 && (
              <div style={{ borderTop: '1px solid hsl(var(--border))', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginBottom: '1rem' }}>
                  <span>Total</span><span>{brl(totalAmount)}</span>
                </div>
                <Select label="Pagamento" value={payment} onChange={(e) => setPayment(e.target.value)}>
                  <option value="pix">PIX</option>
                  <option value="boleto">Boleto</option>
                  <option value="cartao_credito">Cartão de Crédito</option>
                  <option value="cartao_debito">Cartão de Débito</option>
                  <option value="dinheiro">Dinheiro</option>
                </Select>
                <Button style={{ width: '100%', marginTop: '0.75rem' }} onClick={submit}>
                  <Send size={16} /> Enviar pedido
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
