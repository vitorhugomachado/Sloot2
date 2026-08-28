import React, { Suspense, lazy, useState } from 'react';
import { ExternalLink, Smartphone } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { AppProvider } from '../../context/AppContext';
import { TenantProvider, useTenant } from '../../context/TenantContext';
import TabLoadingFallback from '../../components/TabLoadingFallback';
import { PREVIEW_DEFAULT_SLUG } from '../../constants/previewTenant';
import MobileBookingHub from './MobileBookingHub';
import './mobile-booking-test.css';

const PublicBookingPreview = lazy(() => import('./PublicBookingPreview'));

function MobileBookingTestContent({ publicMode = false }) {
  const { slug, loading, error } = useTenant();
  const [bookingOpen, setBookingOpen] = useState(false);

  if (loading) return <TabLoadingFallback />;
  if (error) {
    return (
      <div className="mobile-booking-test__error">
        <strong>Barbearia não encontrada</strong>
        <span>{error}</span>
        <span>Experimente adicionar ?tenant=slug à URL.</span>
      </div>
    );
  }

  return (
    <main className={`mobile-booking-test${publicMode ? ' mobile-booking-test--public' : ''}`}>
      {!publicMode ? (
        <header className="mobile-booking-test__toolbar">
          <div className="mobile-booking-test__toolbar-copy">
            <span className="mobile-booking-test__eyebrow">
              <Smartphone size={14} aria-hidden />
              Protótipo mobile
            </span>
            <h1>Agendamento em tela pequena</h1>
            <p>Fluxo real da barbearia <strong>{slug}</strong>, isolado para avaliação.</p>
          </div>
          <Link to={`/${slug}`} className="mobile-booking-test__official-link">
            Ver versão atual
            <ExternalLink size={15} aria-hidden />
          </Link>
        </header>
      ) : null}

      <section className="mobile-booking-test__stage" aria-label="Prévia mobile do agendamento">
        <div className={`mobile-booking-test__device${publicMode ? ' mobile-booking-test__device--public' : ''}`}>
          {!publicMode ? (
            <div className="mobile-booking-test__device-bar" aria-hidden>
              <span>9:41</span>
              <span className="mobile-booking-test__island" />
              <span>●●●</span>
            </div>
          ) : null}
          <div className="mobile-booking-test__viewport">
            {bookingOpen ? (
              <>
                <button type="button" className="mobile-booking-test__hub-back" onClick={() => setBookingOpen(false)}>
                  Voltar ao hub
                </button>
                <Suspense fallback={<TabLoadingFallback />}>
                  <PublicBookingPreview
                    forceMobile
                    mobileHubStyle
                    showPreviewBanner={false}
                    portalUrl={`/${slug}/portal`}
                    onExit={() => setBookingOpen(false)}
                  />
                </Suspense>
              </>
            ) : <MobileBookingHub onStartBooking={() => setBookingOpen(true)} />}
          </div>
          {!publicMode ? <div className="mobile-booking-test__home-indicator" aria-hidden /> : null}
        </div>
      </section>
    </main>
  );
}

export default function MobileBookingTestPage({ tenantSlug: tenantSlugProp = '', publicMode: publicModeProp = false }) {
  const [searchParams] = useSearchParams();
  const slug = (tenantSlugProp || searchParams.get('tenant') || PREVIEW_DEFAULT_SLUG).trim().toLowerCase();
  const publicMode = publicModeProp
    || (typeof window !== 'undefined' && window.location.hostname === 'sloot2-staging.up.railway.app');

  return (
    <TenantProvider slug={slug}>
      <AppProvider>
        <MobileBookingTestContent publicMode={publicMode} />
      </AppProvider>
    </TenantProvider>
  );
}
