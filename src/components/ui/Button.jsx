import styles from './Button.module.css';

/**
 * Reusable button.
 * variant: primary | secondary | outline | ghost | danger
 * size: sm | md
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  type = 'button',
  className = '',
  children,
  ...props
}) {
  const cls = [styles.btn, styles[variant], styles[size], className]
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type} className={cls} {...props}>
      {children}
    </button>
  );
}
