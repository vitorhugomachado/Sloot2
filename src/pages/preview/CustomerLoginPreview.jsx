import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTenant } from '../../context/TenantContext';
import { useCustomerAuth } from '../../hooks/useCustomerAuth';
import { loadGoogleIdentityScript } from '../../utils/loadGoogleIdentity';
import LoginScreenLayout from '../../components/auth/LoginScreenLayout';
import CustomerLoginCard from './CustomerLoginCard';
import './booking-preview.css';

export default function CustomerLoginPreview() {
  const { slug } = useTenant();
  const navigate = useNavigate();
  const officialUrl = `/${slug}/cliente`;
  const portalUrl = `/${slug}/cliente/portal`;

  const auth = useCustomerAuth({
    onSuccess: () => navigate(portalUrl),
  });

  useEffect(() => {
    loadGoogleIdentityScript();
  }, []);

  const banner = (
    <div className="booking-preview__banner login-preview__banner">
      <span className="booking-preview__badge">Versão de teste — login</span>
      <span>Visual novo em avaliação.</span>
      <Link to={officialUrl}>Login oficial</Link>
    </div>
  );

  return (
    <LoginScreenLayout banner={banner}>
      <CustomerLoginCard {...auth} />
    </LoginScreenLayout>
  );
}
