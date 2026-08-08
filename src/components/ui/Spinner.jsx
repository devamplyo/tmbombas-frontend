import styles from './Spinner.module.css';

export default function Spinner({ size = 32 }) {
  return (
    <span
      className={styles.spinner}
      style={{ width: size, height: size, borderWidth: Math.max(2, size / 8) }}
      role="status"
      aria-label="Carregando"
    />
  );
}
