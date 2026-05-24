import React, { useState } from 'react';
import { API_URL } from '../../config/apiUrl';
import { setPlatformToken } from './platformAuth';
import LoginScreenLayout from '../../components/auth/LoginScreenLayout';
import LoginFormCard from '../../components/auth/LoginFormCard';

export default function PlatformLogin({ onSuccess }) {
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (email, password) => {
    setError('');
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/platform/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Login falhou');
      localStorage.removeItem('barberpro_token');
      setPlatformToken(data.token);
      onSuccess(data);
    } catch (err) {
      setError(err.message || 'Erro ao entrar');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <LoginScreenLayout>
      <LoginFormCard
        title="Administração"
        subtitle="Acesso exclusivo para gestão da plataforma slooti."
        emailInputType="email"
        emailPlaceholder="seu@email.com"
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
}
