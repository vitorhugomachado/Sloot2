import React, { Suspense, lazy } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppProvider } from '../../context/AppContext';
import { TenantProvider, useTenant } from '../../context/TenantContext';
import TabLoadingFallback from '../../components/TabLoadingFallback';
import { PREVIEW_DEFAULT_SLUG } from '../../constants/previewTenant';

const PublicBookingPreview = lazy(() => import('./PublicBookingPreview'));

function PreviewInner() {
  const { loading, error } = useTenant();
  if (loading) return <TabLoadingFallback />;
  if (error) {
    return (
      <div className="booking-preview booking-preview--error">
        <h1>Barbearia não encontrada</h1>
        <p>{error}</p>
        <p className="booking-preview__hint">Use ?tenant=slug na URL (ex.: ?tenant=lanotic)</p>
      </div>
    );
  }

  return (
    <Suspense fallback={<TabLoadingFallback />}>
      <PublicBookingPreview showPreviewBanner />
    </Suspense>
  );
}

export default function BookingPreviewShell() {
  const [searchParams] = useSearchParams();
  const slug = (searchParams.get('tenant') || PREVIEW_DEFAULT_SLUG).toLowerCase();

  return (
    <TenantProvider slug={slug}>
      <AppProvider>
        <PreviewInner />
      </AppProvider>
    </TenantProvider>
  );
}
