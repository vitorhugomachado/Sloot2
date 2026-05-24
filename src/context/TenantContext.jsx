import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { API_URL } from '../config/apiUrl';

const TenantContext = createContext(null);

const DEFAULT_SLUG = import.meta.env.VITE_DEFAULT_TENANT_SLUG || 'two-brothers';

export function TenantProvider({ children, slug: slugProp }) {
  const { tenantSlug: routeSlug } = useParams();
  const slug = (slugProp || routeSlug || DEFAULT_SLUG).toLowerCase();
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`${API_URL}/tenant/resolve/${encodeURIComponent(slug)}`, {
      headers: { 'X-Tenant-Slug': slug },
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || 'Barbearia não encontrada');
        }
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setTenant(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setTenant(null);
          setError(err.message || 'Erro ao carregar barbearia');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const tenantHeaders = useMemo(
    () => ({ 'X-Tenant-Slug': slug }),
    [slug],
  );

  const value = useMemo(
    () => ({
      slug,
      tenant,
      loading,
      error,
      tenantHeaders,
    }),
    [slug, tenant, loading, error, tenantHeaders],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    throw new Error('useTenant must be used within TenantProvider');
  }
  return ctx;
}

export { DEFAULT_SLUG };
