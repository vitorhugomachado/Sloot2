import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppProvider } from '../../context/AppContext';
import { TenantProvider, useTenant } from '../../context/TenantContext';
import { PREVIEW_DEFAULT_SLUG } from '../../constants/previewTenant';
import TabLoadingFallback from '../../components/TabLoadingFallback';
import StaffLoginPage from '../StaffLoginPage';

function PreviewInner() {
  const { loading, error } = useTenant();
  if (loading) return <TabLoadingFallback />;
  if (error) {
    return (
      <div className="login-preview login-preview--error">
        <h1>Barbearia não encontrada</h1>
        <p>{error}</p>
        <p className="login-preview__hint">Use ?tenant=slug na URL (ex.: ?tenant=lanotic)</p>
      </div>
    );
  }

  return <StaffLoginPage />;
}

export default function LoginPreviewShell() {
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
