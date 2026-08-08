import styles from './Card.module.css';

export default function Card({ className = '', children, ...props }) {
  return (
    <div className={[styles.card, className].filter(Boolean).join(' ')} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }) {
  return (
    <div className={styles.header}>
      <div>
        {title && <h3 className={styles.title}>{title}</h3>}
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className = '', children }) {
  return <div className={[styles.body, className].filter(Boolean).join(' ')}>{children}</div>;
}
