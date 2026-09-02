import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOutletContext } from 'react-router-dom';
import { ArrowLeft, Play, CheckCircle, Camera, X } from 'lucide-react';
import { db, addServiceRecord, listServiceRecords } from '@/api/client';
import useAsyncData from '@/hooks/useAsyncData';
import { useToast } from '@/components/ui/Toast';
import PageHeader from '@/components/ui/PageHeader';
import Card, { CardHeader, CardBody } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import { Textarea } from '@/components/ui/Field';
import { dateBR, dateTimeBR } from '@/lib/format';
import { TASK_STATUS, OS_STATUS } from '@/lib/status';
import shared from '../shared.module.css';

const MAX_PHOTOS = 6;

export default function FCOTarefaDetalhePage() {
  const { id } = useParams();
  const { user } = useOutletContext();
  const navigate = useNavigate();
  const toast = useToast();

  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState([]);
  const [saving, setSaving] = useState(false);

  const { data, loading, reload } = useAsyncData(async () => {
    const tasks = await db.ServiceTask.filter({ id });
    const task = tasks[0] || null;
    const order = task?.service_order_id ? await db.ServiceOrder.get(task.service_order_id) : null;
    return { task, order };
  }, [id]);

  const { data: records, loading: recordsLoading, reload: reloadRecords } = useAsyncData(
    () => (data?.order?.id ? listServiceRecords(data.order.id) : Promise.resolve([])),
    [data?.order?.id],
  );

  const startTask = async () => {
    await db.ServiceTask.update(id, { status: 'em_andamento', started_at: new Date().toISOString() });
    if (data.order) await db.ServiceOrder.update(data.order.id, { status: 'em_execucao' });
    toast.success('Serviço iniciado.');
    reload();
  };

  const finishTask = async () => {
    await db.ServiceTask.update(id, { status: 'concluido', completed_at: new Date().toISOString() });
    if (data.order) await db.ServiceOrder.update(data.order.id, { status: 'concluida', completion_date: new Date().toISOString() });
    toast.success('Serviço concluído.');
    reload();
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
      await addServiceRecord(data.order.id, { note: note.trim() || undefined, photos });
      toast.success('Registro salvo.');
      setNote('');
      setPhotos([]);
      reloadRecords();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className={shared.loading}><Spinner /></div>;
  const { task, order } = data;
  if (!task) return <div><Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Voltar</Button><p>Tarefa não encontrada.</p></div>;

  const canRegister = task.status === 'em_andamento' && order;

  return (
    <div>
      <PageHeader
        title={task.description}
        subtitle={task.client_name ? `Cliente: ${task.client_name}` : undefined}
        actions={
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Voltar</Button>
            {task.status === 'agendado' && <Button onClick={startTask}><Play size={16} /> Iniciar</Button>}
            {task.status === 'em_andamento' && <Button variant="outline" onClick={finishTask}><CheckCircle size={16} /> Finalizar</Button>}
          </div>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
        <Card>
          <CardHeader title="Detalhes da tarefa" />
          <CardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.88rem' }}>
              {[
                ['Status', <Badge tone={TASK_STATUS[task.status]?.tone}>{TASK_STATUS[task.status]?.label}</Badge>],
                ['Agendado para', `${dateBR(task.scheduled_date)}${task.scheduled_time ? ` às ${task.scheduled_time}` : ''}`],
                ['Iniciado em', task.started_at ? dateTimeBR(task.started_at) : '—'],
                ['Concluído em', task.completed_at ? dateTimeBR(task.completed_at) : '—'],
              ].map(([label, value]) => (
                <div key={label}>
                  <span style={{ color: 'hsl(var(--muted-foreground))', display: 'block', fontSize: '0.75rem' }}>{label}</span>
                  <span>{value}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {order && (
          <Card>
            <CardHeader title="Ordem de Serviço vinculada" />
            <CardBody>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.88rem' }}>
                {[
                  ['Tipo', order.type === 'os' ? 'Ordem de Serviço' : 'Orçamento'],
                  ['Status', <Badge tone={OS_STATUS[order.status]?.tone}>{OS_STATUS[order.status]?.label}</Badge>],
                  ['Descrição', order.description],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span style={{ color: 'hsl(var(--muted-foreground))', display: 'block', fontSize: '0.75rem' }}>{label}</span>
                    <span>{value}</span>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        )}
      </div>

      {/* achado F9: tarefa sem OS vinculada nunca mostra "Registrar
          atendimento" (canRegister exige `order`). Não é bug — o registro
          é sempre amarrado a uma OS — mas sem essa nota o técnico não
          entendia por que o card sumia. */}
      {task.status === 'em_andamento' && !order && (
        <Card style={{ marginTop: '1.25rem' }}>
          <CardBody>
            <p style={{ fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))' }}>
              Esta tarefa não está vinculada a uma Ordem de Serviço, então não é possível registrar notas ou fotos do atendimento. Use "Finalizar" para concluir.
            </p>
          </CardBody>
        </Card>
      )}

      {canRegister && (
        <Card style={{ marginTop: '1.25rem' }}>
          <CardHeader title="Registrar atendimento" subtitle="Descreva o que foi feito e/ou anexe fotos (até 6)" />
          <CardBody>
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
          </CardBody>
        </Card>
      )}

      {order && (
        <Card style={{ marginTop: '1.25rem' }}>
          <CardHeader title="Registros deste serviço" />
          <CardBody>
            {recordsLoading ? (
              <div className={shared.loading}><Spinner /></div>
            ) : !records?.length ? (
              <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.85rem' }}>Nenhum registro ainda.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {records.map((r) => (
                  <div key={r.id} style={{ borderBottom: '1px solid hsl(var(--border))', paddingBottom: '0.9rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>{dateTimeBR(r.createdAt)}</span>
                    {r.note && <p style={{ marginTop: '0.3rem', fontSize: '0.88rem' }}>{r.note}</p>}
                    {r.photos.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                        {r.photos.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noreferrer">
                            <img src={url} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
