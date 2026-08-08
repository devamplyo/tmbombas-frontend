import styles from './Field.module.css';

/** Field wrapper with an optional label and error message. */
function Wrapper({ label, error, children }) {
  return (
    <label className={styles.field}>
      {label && <span className={styles.label}>{label}</span>}
      {children}
      {error && <span className={styles.error}>{error}</span>}
    </label>
  );
}

export function Input({ label, error, className = '', ...props }) {
  return (
    <Wrapper label={label} error={error}>
      <input className={[styles.input, className].filter(Boolean).join(' ')} {...props} />
    </Wrapper>
  );
}

export function Textarea({ label, error, className = '', ...props }) {
  return (
    <Wrapper label={label} error={error}>
      <textarea
        className={[styles.input, styles.textarea, className].filter(Boolean).join(' ')}
        {...props}
      />
    </Wrapper>
  );
}

export function Select({ label, error, children, className = '', ...props }) {
  return (
    <Wrapper label={label} error={error}>
      <select className={[styles.input, className].filter(Boolean).join(' ')} {...props}>
        {children}
      </select>
    </Wrapper>
  );
}
