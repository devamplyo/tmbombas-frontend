import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  format, isSameDay, isSameMonth, isToday, addMonths, subMonths,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { db } from '@/api/client';
import useAsyncData from '@/hooks/useAsyncData';
import PageHeader from '@/components/ui/PageHeader';
import Card, { CardBody } from '@/components/ui/Card';
import ListRow from '@/components/ui/ListRow';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import { TASK_STATUS } from '@/lib/status';
import shared from '../shared.module.css';
import styles from './FCOAgendaPage.module.css';

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export default function FCOAgendaPage() {
  const { user } = useOutletContext();
  const { data: tasks, loading } = useAsyncData(
    () => db.ServiceTask.filter({ assigned_to_id: user.id }, '-scheduled_date'),
    []
  );

  const [month, setMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());

  if (loading) return <div className={shared.loading}><Spinner /></div>;

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month)),
    end: endOfWeek(endOfMonth(month)),
  });

  const tasksOn = (day) => (tasks || []).filter((t) => t.scheduled_date && isSameDay(new Date(`${t.scheduled_date}T00:00:00`), day));
  const dayTasks = tasksOn(selectedDay);

  return (
    <div>
      <PageHeader title="Minha Agenda" />

      <Card style={{ marginBottom: '1.25rem' }}>
        <CardBody>
          <div className={styles.calHeader}>
            <button type="button" onClick={() => setMonth((m) => subMonths(m, 1))} className={styles.navBtn}><ChevronLeft size={18} /></button>
            <strong>{format(month, 'MMMM yyyy', { locale: ptBR })}</strong>
            <button type="button" onClick={() => setMonth((m) => addMonths(m, 1))} className={styles.navBtn}><ChevronRight size={18} /></button>
          </div>

          <div className={styles.weekdays}>
            {WEEKDAYS.map((w, i) => <span key={i}>{w}</span>)}
          </div>

          <div className={styles.grid}>
            {days.map((day) => {
              const hasTasks = tasksOn(day).length > 0;
              return (
                <button
                  type="button"
                  key={day.toISOString()}
                  onClick={() => setSelectedDay(day)}
                  className={[
                    styles.day,
                    !isSameMonth(day, month) && styles.outside,
                    isSameDay(day, selectedDay) && styles.selected,
                    isToday(day) && !isSameDay(day, selectedDay) && styles.today,
                  ].filter(Boolean).join(' ')}
                >
                  {format(day, 'd')}
                  {hasTasks && <span className={styles.dot} />}
                </button>
              );
            })}
          </div>
        </CardBody>
      </Card>

      <p className={shared.muted} style={{ marginBottom: '0.75rem', textTransform: 'uppercase' }}>
        {format(selectedDay, "EEEE, dd 'de' MMMM", { locale: ptBR })}
      </p>

      <Card>
        <CardBody style={{ padding: 0 }}>
          {dayTasks.length === 0 ? (
            <div className={shared.loading} style={{ padding: '2rem' }}>Nenhum serviço para este dia.</div>
          ) : (
            dayTasks.map((r) => (
              <ListRow
                key={r.id}
                title={r.client_name || 'Sem cliente'}
                subtitle={[r.scheduled_time, r.description].filter(Boolean).join(' · ')}
                to={`/condominial/tarefas/${r.id}`}
                right={<Badge tone={TASK_STATUS[r.status]?.tone}>{TASK_STATUS[r.status]?.label}</Badge>}
              />
            ))
          )}
        </CardBody>
      </Card>
    </div>
  );
}
