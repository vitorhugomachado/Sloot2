/**
 * Wordmark slooti — Manrope ExtraLight, "i" com pingo laranja #FF8533.
 */
export default function SlootiLogo({
  size = 'md',
  variant = 'full',
  className = '',
  onDark = true,
}) {
  const sizeClass = `slooti-logo--${size}`;

  if (variant === 'mark') {
    return (
      <span
        className={`slooti-logo slooti-logo--mark ${sizeClass} ${onDark ? 'slooti-logo--on-dark' : 'slooti-logo--on-light'} ${className}`.trim()}
        aria-label="slooti"
      >
        <span className="slooti-logo__mark-char">s</span>
        <span className="slooti-logo__mark-dot" aria-hidden />
      </span>
    );
  }

  return (
    <span
      className={`slooti-logo ${sizeClass} ${onDark ? 'slooti-logo--on-dark' : 'slooti-logo--on-light'} ${className}`.trim()}
      aria-label="slooti"
    >
      sloot
      <span className="slooti-logo__i" aria-hidden>
        <span className="slooti-logo__i-stem">ı</span>
        <span className="slooti-logo__i-dot" />
      </span>
    </span>
  );
}
