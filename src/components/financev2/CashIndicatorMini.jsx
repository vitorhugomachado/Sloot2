import React, { useState } from 'react';
import { Wallet } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { tenantDashboardPath, tenantSlugFromPathname } from '../../constants/tenantRoutes';
import { useCashStatus } from '../../hooks/useCashStatus';
import OpenCashModal from './OpenCashModal';

/**
 * Indicador compacto de caixa aberto/fechado para Dashboard e Agenda.
 */
export default function CashIndicatorMini({ financeV2, isGerente = false, className = '' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const tenantSlug = tenantSlugFromPathname(location.pathname);
  const [openCashModal, setOpenCashModal] = useState(false);
  const { session, isOpen, loading } = useCashStatus(financeV2);

  if (loading) return null;

  const label = isOpen
    ? `Caixa aberto${session?.openedByName ? ` · ${session.openedByName}` : ''}`
    : 'Caixa fechado';

  const goFinance = () => {
    if (!tenantSlug) return;
    navigate(tenantDashboardPath(tenantSlug, 'financeiro'));
  };

  const handleOpenAction = () => {
    if (isGerente) {
      setOpenCashModal(true);
      return;
    }
    goFinance();
  };

  return (
    <>
      <div className={`finv2-cash-indicator-mini ${isOpen ? 'is-open' : 'is-closed'} ${className}`.trim()}>
        <span className="finv2-cash-indicator-mini__icon" aria-hidden>
          <Wallet size={15} strokeWidth={2} />
        </span>
        <span className="finv2-cash-indicator-mini__text">{label}</span>
        {!isOpen ? (
          <button type="button" className="finv2-cash-indicator-mini__link" onClick={handleOpenAction}>
            {isGerente ? 'Abrir caixa' : 'Ir ao Financeiro'}
          </button>
        ) : null}
      </div>
      <OpenCashModal open={openCashModal} onClose={() => setOpenCashModal(false)} />
    </>
  );
}
