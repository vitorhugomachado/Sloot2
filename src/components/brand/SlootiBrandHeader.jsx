import SlootiLogo from '../SlootiLogo';
import './slooti-brand-header.css';

/**
 * Barra superior da marca slooti (acima do header do estabelecimento).
 * Usar apenas no fluxo público do cliente — não no painel staff nem admin.
 */
export default function SlootiBrandHeader() {
  return (
    <header className="slooti-brand-header" role="banner" aria-label="Slooti">
      <SlootiLogo size="sm" onDark={false} className="slooti-brand-header__logo" />
      <p className="slooti-brand-header__credit">
        <span className="slooti-brand-header__credit-label">Desenvolvido por</span>
        <SlootiLogo size="sm" onDark={false} className="slooti-brand-header__credit-logo" />
      </p>
    </header>
  );
}
