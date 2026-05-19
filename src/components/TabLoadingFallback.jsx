/** Fallback leve enquanto um painel lazy carrega. */
export default function TabLoadingFallback() {
  return (
    <div
      className="tab-loading-fallback"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '200px',
        color: 'var(--text-secondary)',
        fontSize: '0.9rem',
        fontWeight: 500,
      }}
      aria-live="polite"
    >
      Carregando…
    </div>
  );
}
