import React, { Suspense, lazy } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppProvider } from '../../context/AppContext';
import { TenantProvider, useTenant } from '../../context/TenantContext';
import TabLoadingFallback from '../../components/TabLoadingFallback';
import { PREVIEW_DEFAULT_SLUG } from '../../constants/previewTenant';

const SchedulerWeekPreview = lazy(() => import('./SchedulerWeekPreview'));

function PreviewInner() {
  const { loading, error } = useTenant();
  if (loading) return <TabLoadingFallback />;
  if (error) {
    return (
      <div className="booking-preview booking-preview--error">
        <h1>Barbearia não encontrada</h1>
        <p>{error}</p>
        <p className="booking-preview__hint">Use ?tenant=slug na URL (ex.: ?tenant=two-brothers)</p>
      </div>
    );
  }

  return (
    <Suspense fallback={<TabLoadingFallback />}>
      <SchedulerWeekPreview />
    </Suspense>
  );
}

export default function SchedulerWeekPreviewShell() {
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
