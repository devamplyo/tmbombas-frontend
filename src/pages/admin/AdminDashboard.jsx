import { useState, useEffect } from 'react';
import { Package, ShoppingCart, FileText, Users, DollarSign, AlertTriangle, Store, Camera, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { db, getExternalOrders, getReceivables, listServiceRecords } from '@/api/client';
import useAsyncData from '@/hooks/useAsyncData';
import PageHeader from '@/components/ui/PageHeader';
import Stat from '@/components/ui/Stat';
import Card, { CardHeader, CardBody } from '@/components/ui/Card';
import Table from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import Modal from '@/components/ui/Modal';
import { brl, dateBR, dateTimeBR } from '@/lib/format';
import { OS_STATUS, SALE_STATUS } from '@/lib/status';
import shared from '../shared.module.css';

export default function AdminDashboard() {
  const { data, loading } = useAsyncData(async () => {
    const [products, sales, serviceOrders, clients, pendingOrders, pendingReceivables] = await Promise.all([
      db.Product.list(),
      db.Sale.list('-created_date', 50),
      db.ServiceOrder.list('-created_date', 50),
      db.Client.list(),
      getExternalOrders('enviado'),
      getReceivables('PENDENTE'),
    ]);
    const recent = serviceOrders.slice(0, 5);
    let recordCounts = {};
    if (recent.length) {
      const counts = await Promise.all(recent.map((o) => listServiceRecords(o.id)));
      recordCounts = Object.fromEntries(recent.map((o, i) => [o.id, counts[i].length]));
    }
    return { products, sales, serviceOrders, clients, pendingOrders, receivableTotal: pendingReceivables.total, recordCounts };
  }, [], { refreshInterval: 30000 });

  const [selectedOrder, setSelectedOrder] = useState(null);
  const { data: records, loading: recordsLoading } = useAsyncData(
    () => (selectedOrder ? listServiceRecords(selectedOrder.id) : Promise.resolve([])),
    [selectedOrder?.id],
  );

  const [lightbox, setLightbox] = useState(null); // { photos, index }

  useEffect(() => {
    if (!lightbox) return;
    const total = lightbox.photos.length;
    const onKey = (e) => {
      if (e.key === 'Escape') setLightbox(null);
      else if (e.key === 'ArrowLeft') setLightbox((lb) => ({ ...lb, index: (lb.index - 1 + total) % total }));
      else if (e.key === 'ArrowRight') setLightbox((lb) => ({ ...lb, index: (lb.index + 1) % total }));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  if (loading) {
    return (
      <div className={shared.loading}>
        <Spinner />
      </div>
    );
  }

  const { products, sales, serviceOrders, clients, pendingOrders, receivableTotal, recordCounts } = data;
  // achado F6: aqui contava TODOS os produtos; Estoque (StockPage.jsx) só
  // conta os ativos em "Total de Produtos" — os dois rótulos precisam
  // significar a mesma coisa. "Estoque baixo" continua contando todos, em
  // ambas as telas (StockPage.jsx também não filtra por is_active aqui).
  const lowStock = products.filter((p) => p.stock_quantity <= (p.min_stock || 0));
  const consolidated = sales.filter((s) => s.status === 'consolidada');
  const salesValue = consolidated.reduce((sum, s) => sum + (s.total_amount || 0), 0);
  const pendingOS = serviceOrders.filter((so) => so.status === 'aguardando_validacao');
  const pendingExternal = pendingOrders; // fila real de pedidos aguardando o ADM
  // achado F17: usava so.payment_status (campo morto — client.js sempre
  // manda 'a_receber' fixo) em vez do sistema Receivable real, que o
  // Financeiro já usa. Os dois nunca batiam.
  const receivable = receivableTotal;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Visão geral do negócio" />

      <div className={shared.statsGrid}>
        <Stat icon={Package} label="Produtos em estoque" value={products.filter((p) => p.is_active).length} tone="primary" />
        <Stat
          icon={ShoppingCart}
          label="Vendas consolidadas"
          value={consolidated.length}
          hint={brl(salesValue)}
          tone="success"
        />
        <Stat icon={FileText} label="OS aguardando validação" value={pendingOS.length} tone="warning" />
        <Stat icon={Users} label="Clientes" value={clients.length} tone="primary" />
        <Stat icon={DollarSign} label="A receber" value={brl(receivable)} tone="primary" />
        <Stat icon={AlertTriangle} label="Estoque baixo" value={lowStock.length} tone="danger" />
        <Stat icon={Store} label="Pedidos externos pendentes" value={pendingExternal.length} tone="warning" />
      </div>

      <div className={shared.cardsGrid}>
        <Card>
          <CardHeader title="Últimas ordens de serviço" />
          <CardBody>
            <Table
              columns={[
                { key: 'client_name', header: 'Cliente' },
                {
                  key: 'status',
                  header: 'Status',
                  render: (r) => (
                    <Badge tone={OS_STATUS[r.status]?.tone}>{OS_STATUS[r.status]?.label || r.status}</Badge>
                  ),
                },
                { key: 'service_value', header: 'Valor', align: 'right', render: (r) => brl(r.service_value) },
                {
                  key: 'records',
                  header: 'Registro OS',
                  align: 'center',
                  render: (r) => (recordCounts?.[r.id] > 0 ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setSelectedOrder(r); }}
                      title="Ver registros e fotos"
                      aria-label="Ver registros e fotos"
                      style={{
                        background: 'none', border: 'none', padding: '0.2rem', cursor: 'pointer',
                        color: 'hsl(var(--primary))', display: 'inline-flex',
                      }}
                    >
                      <Camera size={16} />
                    </button>
                  ) : null),
                },
              ]}
              rows={serviceOrders.slice(0, 5)}
              empty="Nenhuma OS."
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Estoque baixo" subtitle="Produtos abaixo do mínimo" />
          <CardBody>
            <Table
              columns={[
                { key: 'name', header: 'Produto' },
                { key: 'stock_quantity', header: 'Estoque', align: 'center' },
                { key: 'min_stock', header: 'Mínimo', align: 'center' },
              ]}
              rows={lowStock}
              empty="Estoque saudável 👍"
            />
          </CardBody>
        </Card>
      </div>

      {pendingExternal.length > 0 && (
        <Card style={{ marginTop: '1.25rem' }}>
          <CardHeader
            title="Pedidos externos aguardando consolidação"
            subtitle={`${pendingExternal.length} pedido(s) aguardando`}
            action={<Link to="/admin/vendas-externas" style={{ fontSize: '0.82rem', color: 'hsl(var(--primary))' }}>Ver todos →</Link>}
          />
          <CardBody style={{ padding: 0 }}>
            <Table
              columns={[
                { key: 'seller_name', header: 'Vendedor' },
                { key: 'client_name', header: 'Cliente' },
                { key: 'total_amount', header: 'Total', align: 'right', render: (r) => brl(r.total_amount) },
                { key: 'status', header: 'Status', render: (r) => <Badge tone={SALE_STATUS[r.status]?.tone}>{SALE_STATUS[r.status]?.label}</Badge> },
              ]}
              rows={pendingExternal.slice(0, 5)}
              empty=""
            />
          </CardBody>
        </Card>
      )}

      <Modal
        open={!!selectedOrder}
        onClose={() => { setSelectedOrder(null); setLightbox(null); }}
        title="Registros do atendimento"
        width={640}
      >
        {recordsLoading ? (
          <div className={shared.loading}><Spinner /></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {(records || []).map((r) => (
              <div key={r.id} style={{ borderBottom: '1px solid hsl(var(--border))', paddingBottom: '0.9rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>{dateTimeBR(r.createdAt)}</span>
                {r.note && <p style={{ marginTop: '0.3rem', fontSize: '0.88rem' }}>{r.note}</p>}
                {r.photos.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                    {r.photos.map((url, i) => (
                      <button
                        key={url}
                        type="button"
                        onClick={() => setLightbox({ photos: r.photos, index: i })}
                        style={{ padding: 0, border: '1px solid hsl(var(--border))', borderRadius: 8, background: 'none', cursor: 'pointer', lineHeight: 0 }}
                      >
                        <img src={url} alt="" style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 7, display: 'block' }} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Fechar"
            style={{
              position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none',
              color: '#fff', cursor: 'pointer', padding: '0.4rem',
            }}
          >
            <X size={28} />
          </button>

          {lightbox.photos.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setLightbox((lb) => ({ ...lb, index: (lb.index - 1 + lb.photos.length) % lb.photos.length })); }}
              aria-label="Foto anterior"
              style={{
                position: 'absolute', left: '1rem', background: 'rgba(255,255,255,0.1)', border: 'none',
                borderRadius: '50%', width: 44, height: 44, color: '#fff', cursor: 'pointer',
                display: 'grid', placeItems: 'center',
              }}
            >
              <ChevronLeft size={24} />
            </button>
          )}

          <img
            src={lightbox.photos[lightbox.index]}
            alt=""
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '85vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: 8 }}
          />

          {lightbox.photos.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setLightbox((lb) => ({ ...lb, index: (lb.index + 1) % lb.photos.length })); }}
              aria-label="Próxima foto"
              style={{
                position: 'absolute', right: '1rem', background: 'rgba(255,255,255,0.1)', border: 'none',
                borderRadius: '50%', width: 44, height: 44, color: '#fff', cursor: 'pointer',
                display: 'grid', placeItems: 'center',
              }}
            >
              <ChevronRight size={24} />
            </button>
          )}

          {lightbox.photos.length > 1 && (
            <span style={{ position: 'absolute', bottom: '1rem', color: '#fff', fontSize: '0.8rem' }}>
              {lightbox.index + 1} / {lightbox.photos.length}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
