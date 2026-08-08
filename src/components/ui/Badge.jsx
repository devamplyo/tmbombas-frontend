import styles from './Badge.module.css';

/** tone: default | primary | success | warning | danger | muted */
export default function Badge({ tone = 'default', children, className = '' }) {
  return (
    <span className={[styles.badge, styles[tone], className].filter(Boolean).join(' ')}>
      {children}
    </span>
  );
}
