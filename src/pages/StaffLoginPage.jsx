import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useTenant } from '../context/TenantContext';
import { tenantDashboardPath } from '../constants/tenantRoutes';
import LoginScreenLayout from '../components/auth/LoginScreenLayout';
import StaffLoginFormCard from '../components/auth/StaffLoginFormCard';

/**
 * Tela oficial de login staff (barbeiros) — mobile e web.
 */
export default function StaffLoginPage() {
  const { login, currentUser } = useApp();
  const navigate = useNavigate();
  const { slug } = useTenant();
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (currentUser) {
    return <Navigate to={tenantDashboardPath(slug)} replace />;
  }

  const handleSubmit = async (email, password) => {
    setError('');
    setIsSubmitting(true);
    try {
      const userData = await login(email, password);
      const perms = userData?.permissions;
      const canDashboard = Array.isArray(perms) && perms.includes('dashboard');
      const barberNoDashboard = userData?.role === 'Barbeiro' && !canDashboard;
      if (barberNoDashboard) {
        navigate(tenantDashboardPath(slug, 'scheduler'), {
          replace: true,
          state: { schedulerDayView: true, at: Date.now() },
        });
      } else {
        navigate(tenantDashboardPath(slug), { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Erro ao realizar login.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <LoginScreenLayout variant="staff">
      <StaffLoginFormCard
        onSubmit={handleSubmit}
        error={error}
        isSubmitting={isSubmitting}
      />
    </LoginScreenLayout>
  );
}
