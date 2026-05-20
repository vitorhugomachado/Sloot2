import React, { useEffect, useRef, useState } from 'react';
import { Calendar, LogIn, User } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import BusinessSocialLinks from '../../components/BusinessSocialLinks';

export default function PublicBookingCustomerHeader({ onOpenPortal, onRequestLogin }) {
  const { businessInfo, currentCustomer, customerLogout } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const businessTitle = (businessInfo?.name || '').trim() || 'SLOOT';

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);

  const handleAgenda = () => {
    if (currentCustomer) onOpenPortal();
    else onRequestLogin();
  };

  return (
    <header className="bp-customer-header">
      <div className="bp-customer-header__brand">
        {businessInfo?.logo_url ? (
          <img src={businessInfo.logo_url} alt="" className="bp-customer-header__logo" />
        ) : null}
        <div className="bp-customer-header__brand-text">
          <span className="bp-customer-header__name">{businessTitle}</span>
          <div className="bp-customer-header__social">
            <BusinessSocialLinks businessInfo={businessInfo} />
          </div>
        </div>
      </div>

      <div className="bp-customer-header__actions">
        <button type="button" className="bp-customer-header__agenda-btn" onClick={handleAgenda}>
          <Calendar size={16} strokeWidth={2} aria-hidden />
          Minha agenda
        </button>

        <div className="bp-customer-header__account" ref={menuRef}>
          <button
            type="button"
            className="bp-customer-header__avatar-btn"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-label="Conta"
          >
            <User size={20} strokeWidth={2} aria-hidden />
          </button>

          {menuOpen && (
            <div className="bp-customer-header__menu" role="menu">
              {!currentCustomer ? (
                <button
                  type="button"
                  className="bp-customer-header__menu-primary"
                  onClick={() => {
                    setMenuOpen(false);
                    onRequestLogin();
                  }}
                >
                  <LogIn size={18} aria-hidden />
                  Entrar
                </button>
              ) : (
                <>
                  <p className="bp-customer-header__menu-greeting">
                    Olá, {currentCustomer.name?.split(' ')[0] || 'Cliente'}
                  </p>
                  <button
                    type="button"
                    className="bp-customer-header__menu-item"
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenPortal();
                    }}
                  >
                    Minha agenda
                  </button>
                  <button
                    type="button"
                    className="bp-customer-header__menu-item bp-customer-header__menu-item--danger"
                    onClick={() => {
                      customerLogout();
                      setMenuOpen(false);
                    }}
                  >
                    Sair
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
