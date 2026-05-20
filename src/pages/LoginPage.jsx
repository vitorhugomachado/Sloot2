import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import LoginScreenLayout from '../components/auth/LoginScreenLayout';
import LoginFormCard from '../components/auth/LoginFormCard';

const LoginPage = ({ onLogin }) => {
  const { businessInfo } = useApp();
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (email, password) => {
    setError('');
    setIsSubmitting(true);
    try {
      await onLogin(email, password);
    } catch (err) {
      setError(err.message || 'Erro ao realizar login.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <LoginScreenLayout>
      <LoginFormCard
        title="Bem-vindo"
        subtitle="Acesso para barbeiros e profissionais da barbearia."
        logoUrl={businessInfo?.logo_url || undefined}
        emailInputType="email"
        emailPlaceholder="name@email.com"
        showEmailIcon={false}
        showGoogle={false}
        showRegister={false}
        showForgot={false}
        onSubmit={handleSubmit}
        error={error}
        isSubmitting={isSubmitting}
      />
    </LoginScreenLayout>
  );
};

export default LoginPage;
