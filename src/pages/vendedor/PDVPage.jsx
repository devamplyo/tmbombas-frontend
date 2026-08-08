import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ShoppingCart, Search, Trash2, Plus, Minus, CheckCircle, FileText } from 'lucide-react';
import { db } from '@/api/client';
import useAsyncData from '@/hooks/useAsyncData';
import { useToast } from '@/components/ui/Toast';
import PageHeader from '@/components/ui/PageHeader';
import Card, { CardHeader, CardBody } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import { Input, Select } from '@/components/ui/Field';
import { brl } from '@/lib/format';
import { generateFakeSaleNfePdf } from '@/lib/fakeNfePdf';
import styles from './PDVPage.module.css';
import shared from '../shared.module.css';

const CART_KEY = 'th_pdv_cart';
const loadCart = () => { try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch { return []; } };
const saveCart = (c) => localStorage.setItem(CART_KEY, JSON.stringify(c));

export default function PDVPage() {
  const { user } = useOutletContext();
  const toast = useToast();
  const { data: products, loading, reload: reloadProducts } = useAsyncData(() => db.Product.filter({ is_active: true }), []);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState(loadCart);
  const [payment, setPayment] = useState('dinheiro');
  const [clientName, setClientName] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const searchRef = useRef();

  useEffect(() => { saveCart(cart); }, [cart]);

  const filtered = (products || []).filter((p) => {
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.barcode || '').includes(q) || (p.sku || '').toLowerCase().includes(q);
  });

  const addToCart = (product) => {
    setCart((c) => {
      const idx = c.findIndex((i) => i.product_id === product.id);
      if (idx !== -1) {
        const updated = [...c];
        if (updated[idx].quantity >= product.stock_quantity) { toast.error('Sem estoque suficiente.'); return c; }
        updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + 1, total: (updated[idx].quantity + 1) * updated[idx].unit_price };
        return updated;
      }
      if (product.stock_quantity < 1) { toast.error('Produto sem estoque.'); return c; }
      return [...c, { product_id: product.id, product_name: product.name, unit_price: product.sale_price, quantity: 1, total: product.sale_price }];
    });
    setSearch('');
    searchRef.current?.focus();
  };

  const changeQty = (pid, delta) => {
    setCart((c) => c.map((i) => {
      if (i.product_id !== pid) return i;
      const qty = i.quantity + delta;
      if (qty <= 0) return null;
      const prod = (products || []).find((p) => p.id === pid);
      if (prod && qty > prod.stock_quantity) { toast.error('Sem estoque suficiente.'); return i; }
      return { ...i, quantity: qty, total: qty * i.unit_price };
    }).filter(Boolean));
  };

  const totalAmount = cart.reduce((s, i) => s + i.total, 0);

  const confirmSale = async () => {
    if (!cart.length) return toast.error('Carrinho vazio.');
    try {
      // Quick local check (the backend revalidates and deducts stock when the sale is created).
      for (const item of cart) {
        const prod = (products || []).find((p) => p.id === item.product_id);
        if (prod && prod.stock_quantity < item.quantity) throw new Error(`Estoque insuficiente: ${item.product_name}`);
      }
      const sale = await db.Sale.create({
        client_name: clientName,
        items: cart,
      });
      setLastSale({ id: sale.id, client_name: clientName, items: cart, total: totalAmount, date: new Date() });
      setCart([]); setClientName(''); setConfirmOpen(false);
      toast.success(`Venda ${String(sale.id).slice(-6).toUpperCase()} concluída!`);
      reloadProducts();
    } catch (e) { toast.error(e.message); }
  };

  if (loading) return <div className={shared.loading}><Spinner /></div>;

  return (
    <div className={styles.layout}>
      {/* Product list */}
      <div className={styles.products}>
        <PageHeader title="PDV" subtitle="Frente de caixa" />
        <div className={shared.toolbar}>
          <input ref={searchRef} className={shared.search} placeholder="Buscar por nome, código de barras ou SKU..."
            value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
        </div>
        <div className={styles.productGrid}>
          {filtered.map((p) => {
            const inCart = cart.find((i) => i.product_id === p.id)?.quantity || 0;
            const available = p.stock_quantity - inCart;
            const low = available <= (p.min_stock || 0);
            return (
              <button key={p.id} className={styles.productCard} onClick={() => addToCart(p)} disabled={available < 1}>
                <span className={styles.productName}>{p.name}</span>
                <span className={styles.productPrice}>{brl(p.sale_price)}</span>
                <span className={styles.productStock} style={{ color: available < 1 ? 'hsl(var(--destructive))' : low ? 'hsl(var(--warning))' : 'hsl(var(--muted-foreground))' }}>
                  {available < 1 ? 'Sem estoque' : `Disponível: ${available} ${p.unit}`}
                </span>
              </button>
            );
          })}
          {!filtered.length && <p className={shared.muted}>Nenhum produto encontrado.</p>}
        </div>
      </div>

      {/* Cart */}
      <div className={styles.cart}>
        <div className={styles.cartHeader}>
          <ShoppingCart size={18} />
          <span>Carrinho ({cart.length})</span>
        </div>

        <div className={styles.cartItems}>
          {!cart.length && <p className={shared.muted} style={{ padding: '1rem' }}>Carrinho vazio</p>}
          {cart.map((item) => (
            <div key={item.product_id} className={styles.cartItem}>
              <div className={styles.cartItemInfo}>
                <span className={styles.cartItemName}>{item.product_name}</span>
                <span className={styles.cartItemPrice}>{brl(item.unit_price)} × {item.quantity}</span>
              </div>
              <div className={styles.cartItemControls}>
                <button onClick={() => changeQty(item.product_id, -1)}><Minus size={14} /></button>
                <span>{item.quantity}</span>
                <button onClick={() => changeQty(item.product_id, 1)}><Plus size={14} /></button>
                <button onClick={() => setCart((c) => c.filter((i) => i.product_id !== item.product_id))}><Trash2 size={14} /></button>
              </div>
              <span className={styles.cartItemTotal}>{brl(item.total)}</span>
            </div>
          ))}
        </div>

        <div className={styles.cartFooter}>
          <div className={styles.cartTotal}>
            <span>Total</span>
            <strong>{brl(totalAmount)}</strong>
          </div>
          <Button className={styles.checkoutBtn} onClick={() => setConfirmOpen(true)} disabled={!cart.length}>
            <CheckCircle size={18} /> Finalizar venda
          </Button>
          {cart.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => { setCart([]); setClientName(''); }}>
              <Trash2 size={14} /> Cancelar venda
            </Button>
          )}
        </div>
      </div>

      {/* Confirm sale modal */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirmar venda"
        footer={<><Button variant="ghost" onClick={() => setConfirmOpen(false)}>Voltar</Button><Button onClick={confirmSale}><CheckCircle size={16} /> Confirmar</Button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Input label="Nome do cliente (opcional)" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Ex: João da Silva" />
          <Select label="Forma de pagamento" value={payment} onChange={(e) => setPayment(e.target.value)}>
            <option value="dinheiro">Dinheiro</option>
            <option value="pix">PIX</option>
            <option value="cartao_credito">Cartão de Crédito</option>
            <option value="cartao_debito">Cartão de Débito</option>
            <option value="boleto">Boleto</option>
          </Select>
          <div style={{ background: 'hsl(var(--secondary))', borderRadius: 'var(--radius)', padding: '0.75rem' }}>
            <p style={{ fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))', marginBottom: '0.5rem' }}>Itens ({cart.length})</p>
            {cart.map((i) => (
              <div key={i.product_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', marginBottom: '0.25rem' }}>
                <span>{i.product_name} × {i.quantity}</span>
                <span>{brl(i.total)}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid hsl(var(--border))', marginTop: '0.5rem', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
              <span>Total</span><span>{brl(totalAmount)}</span>
            </div>
          </div>
        </div>
      </Modal>

      {/* Post-sale receipt */}
      <Modal open={!!lastSale} onClose={() => setLastSale(null)} title="Venda concluída"
        footer={<Button variant="ghost" onClick={() => setLastSale(null)}>Fechar</Button>}>
        {lastSale && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ background: 'hsl(var(--secondary))', borderRadius: 'var(--radius)', padding: '0.75rem' }}>
              <p style={{ fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))', marginBottom: '0.5rem' }}>
                {lastSale.client_name?.trim() || 'Consumidor não identificado'} · Itens ({lastSale.items.length})
              </p>
              {lastSale.items.map((i) => (
                <div key={i.product_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', marginBottom: '0.25rem' }}>
                  <span>{i.product_name} × {i.quantity}</span>
                  <span>{brl(i.total)}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid hsl(var(--border))', marginTop: '0.5rem', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                <span>Total</span><span>{brl(lastSale.total)}</span>
              </div>
            </div>
            <div style={{ background: 'hsl(var(--warning) / 0.15)', border: '1px solid hsl(var(--warning))', borderRadius: 'var(--radius)', padding: '0.6rem 0.75rem', fontSize: '0.78rem' }}>
              <strong>SIMULAÇÃO</strong> — o PDF abaixo é só uma prévia visual da futura Nota Fiscal de
              Venda, sem valor fiscal. Nenhuma nota é emitida de verdade.
            </div>
            <Button variant="outline" onClick={() => generateFakeSaleNfePdf(lastSale)}>
              <FileText size={16} /> Emitir Nota Fiscal de Venda (simulação)
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
