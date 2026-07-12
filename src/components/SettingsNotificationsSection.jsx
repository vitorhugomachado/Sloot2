import { Bell, BellOff, Smartphone } from 'lucide-react';
import useStaffPushNotifications from '../hooks/useStaffPushNotifications';

export default function SettingsNotificationsSection({ apiFetch, tenantSlug, isStaffSession, variant = 'desktop' }) {
  const {
    supported,
    environmentBlockReason,
    status,
    loading,
    error,
    preferenceEnabled,
    enable,
    disable,
  } = useStaffPushNotifications({ apiFetch, tenantSlug, isStaffSession });

  const isEnabled = status === 'enabled';
  const isDenied = status === 'denied';
  const isUnsupported = status === 'unsupported';

  const handleToggle = async () => {
    if (loading) return;
    if (isEnabled) {
      await disable();
    } else {
      await enable();
    }
  };

  const statusLabel = (() => {
    if (isUnsupported) return 'Não suportado neste navegador';
    if (isDenied) return 'Bloqueado pelo navegador';
    if (isEnabled) return 'Ativado';
    return 'Desativado';
  })();

  const cardClass = variant === 'mobile' ? 'set-mobile-notifications' : 'settings-notifications';

  return (
    <div className={`fade-in ${cardClass}`}>
      <div className={variant === 'mobile' ? 'set-mobile-section-head' : ''} style={variant === 'desktop' ? { marginBottom: '2rem' } : undefined}>
        <div>
          <h2 className={variant === 'mobile' ? 'set-mobile-section-title' : undefined} style={variant === 'desktop' ? { fontSize: '1.4rem', fontWeight: 700, margin: 0 } : undefined}>
            Notificações
          </h2>
          <p
            className={variant === 'mobile' ? 'set-mobile-section-sub set-mobile-section-sub--spaced' : undefined}
            style={variant === 'desktop' ? { fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' } : undefined}
          >
            Receba alertas quando um cliente agendar online — mesmo com o navegador fechado.
          </p>
        </div>
      </div>

      <div className="settings-notifications__card glass-card" style={{ padding: variant === 'mobile' ? '1.25rem' : '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '14px',
              background: isEnabled ? 'rgba(255, 106, 0, 0.12)' : 'var(--panel-bg)',
              display: 'grid',
              placeItems: 'center',
              color: isEnabled ? '#ff6a00' : 'var(--text-secondary)',
              flexShrink: 0,
            }}
          >
            {isEnabled ? <Bell size={22} strokeWidth={2} /> : <BellOff size={22} strokeWidth={2} />}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem' }}>Avisar quando cliente agendar online</p>
                <p style={{ margin: '6px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Status: <strong>{statusLabel}</strong>
                </p>
              </div>

              <button
                type="button"
                className={isEnabled ? 'btn-secondary' : 'btn-primary'}
                onClick={handleToggle}
                disabled={loading || isUnsupported || isDenied}
                style={{ padding: '10px 18px', whiteSpace: 'nowrap' }}
              >
                {loading ? 'Aguarde…' : isEnabled ? 'Desativar' : 'Ativar'}
              </button>
            </div>

            {isUnsupported && environmentBlockReason ? (
              <p style={{ margin: '12px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {environmentBlockReason}
              </p>
            ) : null}

            {error ? (
              <p style={{ margin: '12px 0 0', fontSize: '0.85rem', color: '#ef4444' }}>{error}</p>
            ) : null}

            {isDenied ? (
              <p style={{ margin: '12px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                O navegador bloqueou as notificações. Libere nas configurações do site e tente novamente.
              </p>
            ) : null}

            <div
              style={{
                marginTop: '16px',
                padding: '14px',
                borderRadius: '12px',
                background: 'var(--panel-bg)',
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start',
              }}
            >
              <Smartphone size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{ margin: 0, fontSize: '0.82rem', lineHeight: 1.55, color: 'var(--text-secondary)' }}>
                Funciona no Chrome e Edge no PC e Android. No iPhone (iOS 16.4+), adicione o Slooti à tela inicial
                para receber notificações com o app fechado.
              </p>
            </div>

            {preferenceEnabled && isEnabled ? (
              <p style={{ margin: '12px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Gerentes recebem todos os agendamentos. Barbeiros recebem apenas os da própria agenda.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
