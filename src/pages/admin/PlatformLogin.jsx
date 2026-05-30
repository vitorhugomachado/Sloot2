import React, { useState } from 'react';
import { platformApiUrl, setPlatformToken } from './platformAuth';
import LoginScreenLayout from '../../components/auth/LoginScreenLayout';
import StaffLoginFormCard from '../../components/auth/StaffLoginFormCard';

export default function PlatformLogin({ onSuccess }) {
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (email, password) => {
    setError('');
    setIsSubmitting(true);
    const normalizedEmail = String(email || '').trim().toLowerCase();
    try {
      const res = await fetch(platformApiUrl('/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Login falhou');
      if (!data.token) throw new Error('Resposta inválida do servidor.');
      localStorage.removeItem('barberpro_token');
      setPlatformToken(data.token);
      onSuccess(data);
    } catch (err) {
      if (err.name === 'TypeError' && /fetch|network/i.test(String(err.message))) {
        setError('Não foi possível contactar o servidor. Confirme que o backend está a correr (porta 3001 em desenvolvimento).');
      } else {
        setError(err.message || 'Erro ao entrar');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <LoginScreenLayout variant="staff" brandTagline="Administração">
      <StaffLoginFormCard
        onSubmit={handleSubmit}
        error={error}
        isSubmitting={isSubmitting}
      />
    </LoginScreenLayout>
  );
}
