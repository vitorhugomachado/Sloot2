import React, { useState } from 'react';
import LoginScreenLayout from '../components/auth/LoginScreenLayout';
import LoginFormCard from '../components/auth/LoginFormCard';

const LoginPage = ({ onLogin }) => {
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
    <LoginScreenLayout variant="staff">
      <LoginFormCard
        title="Bem-vindo"
        logoUrl={undefined}
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
