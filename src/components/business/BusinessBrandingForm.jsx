import React from 'react';
import BusinessImageUploadField from './BusinessImageUploadField';
import './business-hero-header.css';

export default function BusinessBrandingForm({ bInfo, setBInfo, compact = false }) {
  const initial = (bInfo.name || 'S').trim().charAt(0).toUpperCase() || 'S';

  return (
    <div className={`biz-branding${compact ? ' biz-branding--compact' : ''}`}>
      <p className="biz-branding__intro">
        Estas imagens e textos aparecem no topo da página de agendamento dos seus clientes.
      </p>

      <div className="biz-branding__images">
        <BusinessImageUploadField
          label="Foto de perfil do negócio"
          hint="Recomendado: quadrado, mín. 200×200 px. Aparece no círculo do header."
          value={bInfo.logo_url || null}
          onChange={(url) => setBInfo({ ...bInfo, logo_url: url })}
          variant="square"
          maxEdge={512}
          placeholderInitial={initial}
        />
        <BusinessImageUploadField
          label="Foto de banner"
          hint="Recomendado: horizontal (ex. 1200×400 px). Fundo à direita do header."
          value={bInfo.banner_url || null}
          onChange={(url) => setBInfo({ ...bInfo, banner_url: url })}
          variant="banner"
          maxEdge={1600}
        />
      </div>

      <div className="biz-branding__fields">
        <label className="biz-branding__field">
          <span className="biz-branding__field-label">Nome do negócio</span>
          <input
            type="text"
            className="biz-branding__input"
            value={bInfo.name || ''}
            onChange={(e) => setBInfo({ ...bInfo, name: e.target.value })}
            placeholder="Ex.: Two Brothers"
          />
        </label>
        <label className="biz-branding__field">
          <span className="biz-branding__field-label">Subtítulo (opcional)</span>
          <input
            type="text"
            className="biz-branding__input"
            value={bInfo.tagline || ''}
            onChange={(e) => setBInfo({ ...bInfo, tagline: e.target.value })}
            placeholder="Ex.: Barbearia Premium"
          />
        </label>
        <label className="biz-branding__field">
          <span className="biz-branding__field-label">Slogan (opcional)</span>
          <input
            type="text"
            className="biz-branding__input"
            value={bInfo.slogan || ''}
            onChange={(e) => setBInfo({ ...bInfo, slogan: e.target.value })}
            placeholder="Ex.: Mais que um corte, uma experiência."
          />
        </label>
        <label className="biz-branding__field">
          <span className="biz-branding__field-label">Telefone</span>
          <input
            type="text"
            className="biz-branding__input"
            value={bInfo.phone || ''}
            onChange={(e) => setBInfo({ ...bInfo, phone: e.target.value })}
            placeholder="Telefone"
          />
        </label>
      </div>
    </div>
  );
}
