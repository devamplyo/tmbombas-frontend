import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/** Formats a number as BRL currency. */
export function brl(value) {
  return (Number(value) || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/** Formats a value as compact BRL currency (e.g.: R$ 1,2 mil / R$ 3,4 mi). */
export function brlCompact(value) {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `R$ ${(n / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1_000) return `R$ ${(n / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return brl(n);
}

/** Short label for a period (bucket start date) according to the granularity. */
export function periodLabel(iso, granularidade = 'MES') {
  if (!iso) return '—';
  try {
    const date = typeof iso === 'string' ? parseISO(iso) : iso;
    if (granularidade === 'DIA') return format(date, 'dd/MM', { locale: ptBR });
    if (granularidade === 'SEMANA') return format(date, "dd/MM", { locale: ptBR });
    return format(date, 'MMM/yy', { locale: ptBR });
  } catch {
    return '—';
  }
}

/** Formats an ISO date as dd/MM/yyyy (empty if invalid). */
export function dateBR(iso) {
  if (!iso) return '—';
  try {
    return format(typeof iso === 'string' ? parseISO(iso) : iso, 'dd/MM/yyyy');
  } catch {
    return '—';
  }
}

/** Formats an ISO date as dd/MM/yyyy HH:mm. */
export function dateTimeBR(iso) {
  if (!iso) return '—';
  try {
    return format(typeof iso === 'string' ? parseISO(iso) : iso, "dd/MM/yyyy HH:mm");
  } catch {
    return '—';
  }
}
