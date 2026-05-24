import React, { useEffect, useRef, useState } from 'react';

import { LogIn, User } from 'lucide-react';

import { useApp } from '../../context/AppContext';

import BusinessSocialLinks from '../BusinessSocialLinks';

import './business-hero-header.css';



export default function BusinessHeroHeader({ onOpenPortal, onRequestLogin }) {

  const { businessInfo, currentCustomer, isCustomerAuthenticated, customerLogout } = useApp();

  const [menuOpen, setMenuOpen] = useState(false);

  const menuRef = useRef(null);



  const name = (businessInfo?.name || '').trim() || 'slooti';

  const tagline = (businessInfo?.tagline || '').trim();

  const slogan = (businessInfo?.slogan || '').trim();

  const initial = name.charAt(0).toUpperCase();



  useEffect(() => {

    if (!menuOpen) return;

    const onDocClick = (e) => {

      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);

    };

    document.addEventListener('mousedown', onDocClick);

    return () => document.removeEventListener('mousedown', onDocClick);

  }, [menuOpen]);



  const hasBanner = Boolean(businessInfo?.banner_url);



  return (

    <header className={`bp-hero-header${hasBanner ? ' bp-hero-header--banner' : ''}`}>

      <div className="bp-hero-header__media" aria-hidden>

        {hasBanner ? (

          <img src={businessInfo.banner_url} alt="" className="bp-hero-header__banner-img" />

        ) : null}

      </div>



      <div className="bp-hero-header__inner">

        <div className="bp-hero-header__top">

          <div className="bp-hero-header__brand">

            <div className="bp-hero-header__logo-ring">

              {businessInfo?.logo_url ? (

                <img src={businessInfo.logo_url} alt="" className="bp-hero-header__logo" />

              ) : (

                <span className="bp-hero-header__logo-fallback">{initial}</span>

              )}

            </div>

            <div className="bp-hero-header__text">

              <h1 className="bp-hero-header__name">{name}</h1>

              {tagline ? <p className="bp-hero-header__tagline">{tagline}</p> : null}

              {tagline && slogan ? <span className="bp-hero-header__divider" aria-hidden /> : null}

              {slogan ? <p className="bp-hero-header__slogan">{slogan}</p> : null}

            </div>

          </div>



          <div className="bp-hero-header__actions">

            <div className="bp-hero-header__account" ref={menuRef}>

              <button

                type="button"

                className="bp-hero-header__avatar-btn"

                onClick={() => setMenuOpen((o) => !o)}

                aria-expanded={menuOpen}

                aria-label="Conta"

              >

                <User size={20} strokeWidth={2} aria-hidden />

              </button>



              {menuOpen && (

                <div className="bp-hero-header__menu" role="menu">

                  {!isCustomerAuthenticated ? (

                    <button

                      type="button"

                      className="bp-hero-header__menu-primary"

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

                      <p className="bp-hero-header__menu-greeting">

                        Olá, {currentCustomer.name?.split(' ')[0] || 'Cliente'}

                      </p>

                      <button

                        type="button"

                        className="bp-hero-header__menu-item"

                        onClick={() => {

                          setMenuOpen(false);

                          onOpenPortal();

                        }}

                      >

                        Minha agenda

                      </button>

                      <button

                        type="button"

                        className="bp-hero-header__menu-item bp-hero-header__menu-item--danger"

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

        </div>



        <div className="bp-hero-header__bottom">

          <div className="bp-hero-header__social">

            <BusinessSocialLinks businessInfo={businessInfo} variant="hero" />

          </div>

        </div>

      </div>

    </header>

  );

}


