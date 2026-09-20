import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './Pagination.module.css';

/** Page numbers to show: the first, the last and the neighbours of the current page, with "…" in the gaps. */
function pageList(page, pages) {
  const shown = [...new Set([1, pages, page - 1, page, page + 1])]
    .filter((n) => n >= 1 && n <= pages)
    .sort((a, b) => a - b);
  const out = [];
  shown.forEach((n, i) => {
    if (i > 0 && n - shown[i - 1] > 1) out.push(`gap-${n}`);
    out.push(n);
  });
  return out;
}

/**
 * Previous / numbered pages / next, with a "Mostrando 1–10 de 42" counter.
 * Renders nothing when everything fits in one page. `page` starts at 1.
 */
export default function Pagination({ page, pageSize, total, onChange, className = '' }) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <nav className={[styles.pager, className].filter(Boolean).join(' ')} aria-label="Paginação">
      <span className={styles.info}>Mostrando {from}–{to} de {total}</span>
      <div className={styles.controls}>
        <button type="button" className={styles.step} disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft size={16} /> Anterior
        </button>
        {pageList(page, pages).map((n) => (typeof n === 'string' ? (
          <span key={n} className={styles.gap}>…</span>
        ) : (
          <button
            key={n}
            type="button"
            className={[styles.num, n === page ? styles.on : ''].filter(Boolean).join(' ')}
            aria-label={`Página ${n}`}
            aria-current={n === page ? 'page' : undefined}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        )))}
        <span className={styles.short}>Página {page} de {pages}</span>
        <button type="button" className={styles.step} disabled={page >= pages} onClick={() => onChange(page + 1)}>
          Próxima <ChevronRight size={16} />
        </button>
      </div>
    </nav>
  );
}
