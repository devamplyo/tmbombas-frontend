import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import styles from './ListRow.module.css';

/**
 * List row (icon + title + subtitle + right-side content + optional chevron).
 * Used on the screens that swapped a table for a list look (client's request).
 * `to`: if given, the whole row is a link. `onClick`: alternative with no navigation (e.g.: open a modal).
 */
export default function ListRow({ icon: Icon, title, subtitle, right, to, onClick, iconTone = 'primary' }) {
  const clickable = to || onClick;
  const content = (
    <>
      {Icon && (
        <div className={[styles.icon, styles[iconTone]].join(' ')}>
          <Icon size={18} />
        </div>
      )}
      <div className={styles.text}>
        <span className={styles.title}>{title}</span>
        {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      </div>
      {right && <div className={styles.right}>{right}</div>}
      {clickable && <ChevronRight size={16} className={styles.chevron} />}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={styles.row}>
        {content}
      </Link>
    );
  }
  if (onClick) {
    // div (not a <button>) because `right` may contain its own buttons —
    // a <button> inside a <button> is invalid HTML.
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick(e)}
        className={[styles.row, styles.asButton].join(' ')}
      >
        {content}
      </div>
    );
  }
  return <div className={styles.row}>{content}</div>;
}
