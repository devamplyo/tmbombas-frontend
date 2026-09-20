import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Send, Pencil } from 'lucide-react';
import Button from './Button';
import { brl } from '@/lib/format';
import styles from './ConfirmSubmit.module.css';

const EMPTY = '—';

/**
 * "Confira antes de enviar" screen, shown between the form and the real submit.
 * Everything is optional except open/onCancel/onConfirm — each screen passes only what it has:
 *   client  — highlighted at the top (sending to the wrong client is the easiest mistake)
 *   rows    — [{ label, value }] short fields; an empty value shows "—"
 *   items   — [{ title, subtitle?, amount? }] order/budget lines
 *   total   — number, shown in bold below the items
 *   note    — { label, text } long free text
 *   photos  — File[] shown as thumbnails
 *
 * Rendered in a portal above everything else, because most forms live inside a Modal.
 * ESC is caught in the capture phase so it closes only this screen, not the form behind it.
 */
export default function ConfirmSubmit({
  open,
  title = 'Confira antes de enviar',
  hint = 'Se algo estiver errado, volte e corrija.',
  client,
  rows = [],
  items = [],
  total,
  note,
  photos = [],
  saving = false,
  confirmLabel = 'Confirmar e enviar',
  cancelLabel = 'Voltar e corrigir',
  onCancel,
  onConfirm,
}) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (!saving) onCancel?.();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, saving, onCancel]);

  // focus the dialog (not a button), so a stray Enter can't confirm by accident
  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open]);

  // object URLs are made in an effect and revoked on cleanup, so they don't pile up in the phone's memory
  const [thumbs, setThumbs] = useState([]);
  useEffect(() => {
    if (!open || photos.length === 0) {
      setThumbs([]);
      return undefined;
    }
    const list = photos.map((f) => ({ name: f.name, url: URL.createObjectURL(f) }));
    setThumbs(list);
    return () => list.forEach((t) => URL.revokeObjectURL(t.url));
  }, [open, photos]);

  const confirm = () => {
    if (!saving) onConfirm?.();
  };

  if (!open) return null;

  return createPortal(
    <div className={styles.backdrop} onMouseDown={() => !saving && onCancel?.()}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
          {hint && <p className={styles.hint}>{hint}</p>}
        </div>

        <div className={styles.body}>
          {client !== undefined && (
            <div className={styles.client}>
              <span className={styles.label}>Cliente</span>
              <strong>{client || EMPTY}</strong>
            </div>
          )}

          {rows.map((r) => (
            <div key={r.label} className={styles.row}>
              <span className={styles.label}>{r.label}</span>
              <span className={styles.value}>{r.value || EMPTY}</span>
            </div>
          ))}

          {items.length > 0 && (
            <div className={styles.items}>
              {items.map((it, i) => (
                <div key={i} className={styles.item}>
                  <div className={styles.itemText}>
                    <span className={styles.itemTitle}>{it.title || EMPTY}</span>
                    {it.subtitle && <span className={styles.itemSub}>{it.subtitle}</span>}
                  </div>
                  {it.amount !== undefined && <span className={styles.amount}>{brl(it.amount)}</span>}
                </div>
              ))}
            </div>
          )}

          {total !== undefined && (
            <div className={styles.total}>
              <span>Total</span>
              <strong>{brl(total)}</strong>
            </div>
          )}

          {note && (
            <div className={styles.note}>
              <span className={styles.label}>{note.label}</span>
              <p>{note.text || EMPTY}</p>
            </div>
          )}

          {photos.length > 0 && (
            <div className={styles.photos}>
              <span className={styles.label}>Fotos ({photos.length})</span>
              <div className={styles.thumbs}>
                {thumbs.map((t, i) => <img key={i} src={t.url} alt={t.name} className={styles.thumb} />)}
              </div>
            </div>
          )}
        </div>

        <div className={styles.actions}>
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            <Pencil size={16} /> {cancelLabel}
          </Button>
          <Button onClick={confirm} disabled={saving}>
            <Send size={16} /> {saving ? 'Enviando...' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
