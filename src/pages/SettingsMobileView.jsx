import React from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import PublicCustomerLinkField from '../components/PublicCustomerLinkField';
import { SETTINGS_TABS, ICON_BLACK, ICON_STROKE } from './settingsConstants';

export default function SettingsMobileView({
  activeTab,
  setActiveTab,
  barbers,
  services,
  openBarberModal,
  onDeleteBarber,
  openNewService,
  onEditService,
  onDeleteService,
  formatServicePrice,
  bInfo,
  setBInfo,
  onSaveBusiness,
  saving,
}) {
  return (
    <>
      <header className="set-mobile-header">
        <h1 className="set-mobile-title">Configurações</h1>
        <p className="set-mobile-sub">Equipe, serviços e perfil do negócio</p>
      </header>

      <div className="set-mobile-tabs hide-scrollbar" role="tablist">
        {SETTINGS_TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeTab === t.id}
              className={`set-mobile-tab${activeTab === t.id ? ' set-mobile-tab--active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              <Icon size={16} strokeWidth={ICON_STROKE} />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="set-mobile-panel glass-card">
        {activeTab === 'barbers' && (
          <div className="fade-in">
            <div className="set-mobile-section-head">
              <div>
                <h2 className="set-mobile-section-title">Corpo Técnico</h2>
                <p className="set-mobile-section-sub">Gerencie sua equipe</p>
              </div>
            </div>
            <button type="button" className="btn-primary set-mobile-new-full" onClick={() => openBarberModal()}>
              <Plus size={18} strokeWidth={ICON_STROKE} />
              Novo Barbeiro
            </button>
            <div className="set-mobile-list">
              {barbers.length === 0 ? (
                <p className="set-mobile-empty">Nenhum profissional cadastrado.</p>
              ) : (
                barbers.map((b) => (
                  <article key={b.id} className="set-mobile-card">
                    <div className="set-mobile-card__main">
                      <div className="set-mobile-card__avatar">
                        {b.foto_perfil ? <img src={b.foto_perfil} alt="" /> : <span>{b.name.charAt(0)}</span>}
                      </div>
                      <div className="set-mobile-card__body">
                        <div className="set-mobile-card__title-row">
                          <h3 className="set-mobile-card__name">{b.name}</h3>
                          <span
                            className={`set-mobile-status-pill${
                              b.status === 'Ativo' ? ' set-mobile-status-pill--on' : ''
                            }`}
                          >
                            {b.status}
                          </span>
                        </div>
                        <p className="set-mobile-card__meta">{b.role}</p>
                      </div>
                    </div>
                    <div className="set-mobile-card__actions">
                      <button type="button" className="set-mobile-action-btn" onClick={() => openBarberModal(b)}>
                        <Edit2 size={18} strokeWidth={ICON_STROKE} color={ICON_BLACK} />
                        Editar
                      </button>
                      <button
                        type="button"
                        className="settings-action-icon-btn set-mobile-action-icon--danger"
                        onClick={() => onDeleteBarber(b)}
                        aria-label="Excluir"
                      >
                        <Trash2 size={20} strokeWidth={ICON_STROKE} color="#ef4444" />
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'services' && (
          <div className="fade-in">
            <div className="set-mobile-section-head">
              <div>
                <h2 className="set-mobile-section-title">Catálogo</h2>
                <p className="set-mobile-section-sub">Preços e duração dos serviços</p>
              </div>
            </div>
            <button type="button" className="btn-primary set-mobile-new-full" onClick={openNewService}>
              <Plus size={18} strokeWidth={ICON_STROKE} />
              Novo Serviço
            </button>
            <div className="set-mobile-list">
              {services.length === 0 ? (
                <p className="set-mobile-empty">Nenhum serviço cadastrado. Toque em Novo Serviço.</p>
              ) : (
                services.map((s) => (
                  <article key={s.id} className="set-mobile-card set-mobile-card--service">
                    <div className="set-mobile-card__main set-mobile-card__main--service">
                      <div className="set-mobile-card__body">
                        <h3 className="set-mobile-card__name">{s.name}</h3>
                        <p className="set-mobile-card__meta">{s.duration}</p>
                      </div>
                      <div className="set-mobile-card__price">{formatServicePrice(s.price)}</div>
                    </div>
                    <div className="set-mobile-card__actions">
                      <button type="button" className="set-mobile-action-btn" onClick={() => onEditService(s)}>
                        <Edit2 size={18} strokeWidth={ICON_STROKE} color={ICON_BLACK} />
                        Editar
                      </button>
                      <button
                        type="button"
                        className="settings-action-icon-btn set-mobile-action-icon--danger"
                        onClick={() => onDeleteService(s)}
                        aria-label="Excluir"
                      >
                        <Trash2 size={20} strokeWidth={ICON_STROKE} color="#ef4444" />
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'business' && (
          <div className="fade-in set-mobile-business">
            <h2 className="set-mobile-section-title">Perfil do Negócio</h2>
            <p className="set-mobile-section-sub set-mobile-section-sub--spaced">Dados exibidos na reserva online</p>
            <div className="set-mobile-form-stack">
              <input
                type="text"
                className="set-mobile-form-input"
                value={bInfo.name || ''}
                onChange={(e) => setBInfo({ ...bInfo, name: e.target.value })}
                placeholder="Nome da barbearia"
              />
              <input
                type="text"
                className="set-mobile-form-input"
                value={bInfo.phone || ''}
                onChange={(e) => setBInfo({ ...bInfo, phone: e.target.value })}
                placeholder="Telefone"
              />
            </div>
            <PublicCustomerLinkField className="set-mobile-business-link" compact />
            <h3 className="set-mobile-business__heading">Redes sociais</h3>
            <div className="set-mobile-business-blocks">
              <div className="set-mobile-business-block">
                <label className="set-mobile-business-block__label">Instagram</label>
                <input
                  type="text"
                  className="set-mobile-form-input"
                  value={bInfo.instagram_url || ''}
                  onChange={(e) => setBInfo({ ...bInfo, instagram_url: e.target.value })}
                  placeholder="Link ou @usuario"
                />
                <label className="set-mobile-check">
                  <input
                    type="checkbox"
                    checked={!!bInfo.show_instagram}
                    onChange={(e) => setBInfo({ ...bInfo, show_instagram: e.target.checked })}
                  />
                  Mostrar na página pública
                </label>
              </div>
              <div className="set-mobile-business-block">
                <label className="set-mobile-business-block__label">WhatsApp</label>
                <input
                  type="text"
                  className="set-mobile-form-input"
                  value={bInfo.whatsapp_url || ''}
                  onChange={(e) => setBInfo({ ...bInfo, whatsapp_url: e.target.value })}
                  placeholder="DDD + número ou link wa.me"
                />
                <label className="set-mobile-check">
                  <input
                    type="checkbox"
                    checked={!!bInfo.show_whatsapp}
                    onChange={(e) => setBInfo({ ...bInfo, show_whatsapp: e.target.checked })}
                  />
                  Mostrar na página pública
                </label>
              </div>
              <div className="set-mobile-business-block">
                <label className="set-mobile-business-block__label">Facebook</label>
                <input
                  type="text"
                  className="set-mobile-form-input"
                  value={bInfo.facebook_url || ''}
                  onChange={(e) => setBInfo({ ...bInfo, facebook_url: e.target.value })}
                  placeholder="Link da página"
                />
                <label className="set-mobile-check">
                  <input
                    type="checkbox"
                    checked={!!bInfo.show_facebook}
                    onChange={(e) => setBInfo({ ...bInfo, show_facebook: e.target.checked })}
                  />
                  Mostrar na página pública
                </label>
              </div>
            </div>
            <button
              type="button"
              className="btn-primary set-mobile-new-full set-mobile-save-business"
              onClick={onSaveBusiness}
              disabled={saving}
            >
              {saving ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
