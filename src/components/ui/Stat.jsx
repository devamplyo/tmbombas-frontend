import styles from './Stat.module.css';

/** Indicator card for dashboards. */
export default function Stat({ icon: Icon, label, value, hint, tone = 'primary' }) {
  return (
    <div className={styles.stat}>
      {Icon && (
        <div className={[styles.icon, styles[tone]].join(' ')}>
          <Icon size={22} />
        </div>
      )}
      <div className={styles.info}>
        <span className={styles.label}>{label}</span>
        <span className={styles.value}>{value}</span>
        {hint && <span className={styles.hint}>{hint}</span>}
      </div>
    </div>
  );
}
