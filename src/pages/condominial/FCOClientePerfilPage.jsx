import { useState, useEffect } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { ArrowLeft, Camera, ImagePlus, Play, CheckCircle, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { db, listServiceRecords, addServiceRecord, startServiceOrder, finishServiceOrder } from '@/api/client';
import useAsyncData from '@/hooks/useAsyncData';
import { useToast } from '@/components/ui/Toast';
import PageHeader from '@/components/ui/PageHeader';
import Card, { CardHeader, CardBody } from '@/components/ui/Card';
import Table from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import Modal from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Field';
import { dateBR, dateTimeBR, brl } from '@/lib/format';
import { OS_STATUS, CLIENT_TYPE } from '@/lib/status';
import shared from '../shared.module.css';

const MAX_PHOTOS = 6;

export default function FCOClientePerfilPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useOutletContext();
  const toast = useToast();
  const { data, loading, reload } = useAsyncData(async () => {
    const [clients, orders] = await Promise.all([
      db.Client.filter({ id }),
      db.ServiceOrder.filter({ client_id: id }, '-created_date'),
    ]);
    let recordCounts = {};
    // O backend só permite ao técnico ler registros das OSs atribuídas a ele
    // (IDOR guard). Buscar para todas as OSs do cliente dispara 401 nas de
    // outros técnicos, o que derruba a sessão inteira (ver req() em client.js).
    const readableOrders = user?.role === 'tecnico'
      ? orders.filter((o) => o.technician_id === user.id)
      : orders;
    if (readableOrders.length) {
      const counts = await Promise.all(readableOrders.map((o) => listServiceRecords(o.id)));
      recordCounts = Object.fromEntries(readableOrders.map((o, i) => [o.id, counts[i].length]));
    }
    return { client: clients[0] || null, orders, recordCounts };
  }, [id]);

  const [selectedOrder, setSelectedOrder] = useState(null);
  const { data: records, loading: recordsLoading, reload: reloadRecords } = useAsyncData(
    () => (selectedOrder ? listServiceRecords(selectedOrder.id) : Promise.resolve([])),
    [selectedOrder?.id],
  );
  const [lightbox, setLightbox] = useState(null); // { photos, index }

  const [addRecordOrder, setAddRecordOrder] = useState(null);
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState([]);
  const [saving, setSaving] = useState(false);

  const canRegisterPhotos = user?.role === 'tecnico';
  const [startingId, setStartingId] = useState(null);

  const startOrder = async (order) => {
    setStartingId(order.id);
    try {
      await startServiceOrder(order.id);
      toast.success('OS iniciada.');
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setStartingId(null);
    }
  };

  const [finishOrder, setFinishOrder] = useState(null);
  const [finishing, setFinishing] = useState(false);

  const confirmFinish = async () => {
    setFinishing(true);
    try {
      await finishServiceOrder(finishOrder.id);
      toast.success('OS finalizada.');
      setFinishOrder(null);
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setFinishing(false);
    }
  };

  const closeAddRecord = () => {
    setAddRecordOrder(null);
    setNote('');
    setPhotos([]);
  };

  const addPhotos = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    setPhotos((prev) => {
      const next = [...prev, ...files];
      if (next.length > MAX_PHOTOS) {
        toast.error(`Máximo de ${MAX_PHOTOS} fotos por registro.`);
        return next.slice(0, MAX_PHOTOS);
      }
      return next;
    });
  };

  const removePhoto = (idx) => setPhotos((prev) => prev.filter((_, i) => i !== idx));

  const submitRecord = async () => {
    if (!note.trim() && photos.length === 0) {
      toast.error('Escreva um texto ou anexe pelo menos uma foto.');
      return;
    }
    setSaving(true);
    try {
      await addServiceRecord(addRecordOrder.id, { note: note.trim() || undefined, photos });
      toast.success('Registro salvo.');
      closeAddRecord();
      reload();
      if (selectedOrder?.id === addRecordOrder.id) reloadRecords();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

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

  if (loading) return <div className={shared.loading}><Spinner /></div>;
  const { client, orders, recordCounts } = data;
  if (!client) return <div><Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Voltar</Button><p>Cliente não encontrado.</p></div>;

  return (
    <div>
      <PageHeader
        title={client.name}
        subtitle={CLIENT_TYPE[client.type] || client.type}
        actions={<Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Voltar</Button>}
      />
      <div className={shared.detailGrid}>
        <Card>
          <CardHeader title="Dados" />
          <CardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.88rem' }}>
              {[['Telefone', client.phone], ['E-mail', client.email], ['Cidade', client.city_name], ['Próxima manutenção', dateBR(client.next_maintenance_date)]].map(([label, value]) => (
                <div key={label}><span style={{ color: 'hsl(var(--muted-foreground))', display: 'block', fontSize: '0.75rem' }}>{label}</span><span>{value || '—'}</span></div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Histórico de serviços" />
          <CardBody style={{ padding: 0 }}>
            <Table
              columns={[
                { key: 'type', header: 'Tipo', render: (r) => r.type === 'os' ? 'OS' : 'Orçamento' },
                { key: 'description', header: 'Descrição', render: (r) => (r.description ? r.description.slice(0, 50) : '—') },
                { key: 'service_value', header: 'Valor', align: 'right', render: (r) => brl(r.service_value) },
                { key: 'status', header: 'Status', render: (r) => <Badge tone={OS_STATUS[r.status]?.tone}>{OS_STATUS[r.status]?.label}</Badge> },
                { key: 'scheduled_date', header: 'Data', render: (r) => dateBR(r.scheduled_date) },
                {
                  key: 'records',
                  header: 'Registro OS',
                  align: 'center',
                  render: (r) => (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                      {recordCounts?.[r.id] > 0 && (
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
                      )}
                      {canRegisterPhotos && r.status === 'em_execucao' && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setAddRecordOrder(r); }}
                          title="Adicionar fotos ao registro"
                          aria-label="Adicionar fotos ao registro"
                          style={{
                            background: 'none', border: 'none', padding: '0.2rem', cursor: 'pointer',
                            color: 'hsl(var(--muted-foreground))', display: 'inline-flex',
                          }}
                        >
                          <ImagePlus size={16} />
                        </button>
                      )}
                      {canRegisterPhotos && r.status === 'em_execucao' && user?.id === r.technician_id && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setFinishOrder(r); }}
                          title="Finalizar serviço da OS"
                          aria-label="Finalizar serviço da OS"
                          style={{
                            background: 'none', border: 'none', padding: '0.2rem', cursor: 'pointer',
                            color: 'hsl(var(--success))', display: 'inline-flex',
                          }}
                        >
                          <CheckCircle size={16} />
                        </button>
                      )}
                      {canRegisterPhotos && r.status === 'validada' && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); startOrder(r); }}
                          disabled={startingId === r.id}
                          title="Iniciar OS"
                          aria-label="Iniciar OS"
                          style={{
                            background: 'none', border: 'none', padding: '0.2rem',
                            cursor: startingId === r.id ? 'default' : 'pointer',
                            color: 'hsl(var(--success))', display: 'inline-flex', opacity: startingId === r.id ? 0.5 : 1,
                          }}
                        >
                          <Play size={16} />
                        </button>
                      )}
                    </span>
                  ),
                },
              ]}
              rows={orders}
              empty="Nenhum serviço."
            />
          </CardBody>
        </Card>
      </div>

      <Modal
        open={!!finishOrder}
        onClose={() => setFinishOrder(null)}
        title="Finalizar serviço"
        width={420}
        footer={
          <>
            <Button variant="ghost" onClick={() => setFinishOrder(null)} disabled={finishing}>Cancelar</Button>
            <Button onClick={confirmFinish} disabled={finishing}>{finishing ? 'Finalizando...' : 'Finalizar'}</Button>
          </>
        }
      >
        <p style={{ fontSize: '0.9rem' }}>
          Tem certeza que deseja finalizar o serviço desta OS{finishOrder?.description ? `: "${finishOrder.description.slice(0, 60)}"` : ''}?
          Essa ação não poderá ser desfeita.
        </p>
      </Modal>

      <Modal
        open={!!addRecordOrder}
        onClose={closeAddRecord}
        title="Adicionar registro"
        width={520}
      >
        <Textarea
          label="O que foi feito"
          placeholder="Ex.: Troca do selo mecânico, limpeza do filtro..."
          rows={4}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <div style={{ marginTop: '0.9rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', width: 'fit-content' }}>
            <Button variant="outline" size="sm" type="button" onClick={(e) => e.currentTarget.nextSibling.click()}>
              <Camera size={16} /> Adicionar fotos
            </Button>
            <input
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={addPhotos}
              disabled={photos.length >= MAX_PHOTOS}
            />
          </label>

          {photos.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginTop: '0.75rem' }}>
              {photos.map((file, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid hsl(var(--border))' }}
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    style={{
                      position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%',
                      background: 'hsl(var(--destructive))', color: '#fff', border: 'none', cursor: 'pointer',
                      display: 'grid', placeItems: 'center',
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', display: 'block', marginTop: '0.4rem' }}>
            {photos.length}/{MAX_PHOTOS} fotos
          </span>
        </div>

        <Button style={{ marginTop: '1rem' }} onClick={submitRecord} disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar registro'}
        </Button>
      </Modal>

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
