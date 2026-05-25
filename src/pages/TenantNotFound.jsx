import React from 'react';
import { Link } from 'react-router-dom';
import SlootiLogo from '../components/SlootiLogo';

export default function TenantNotFound({ slug }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        flexDirection: 'column',
        gap: '16px',
        padding: '24px',
        textAlign: 'center',
      }}
    >
      <SlootiLogo size="lg" />
      <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Barbearia não encontrada</h1>
      <p style={{ margin: 0, color: 'var(--text-secondary)', maxWidth: '420px' }}>
        {slug
          ? `Não existe nenhuma barbearia com o endereço "${slug}". Verifica o link ou contacta quem te enviou o URL.`
          : 'Endereço inválido.'}
      </p>
      <Link to="/" className="btn-primary" style={{ textDecoration: 'none', marginTop: '8px' }}>
        Ir para o início
      </Link>
    </div>
  );
}
