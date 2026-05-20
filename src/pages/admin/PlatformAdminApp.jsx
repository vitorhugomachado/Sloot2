import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import PlatformLogin from './PlatformLogin';
import PlatformTenantsPage from './PlatformTenantsPage';
import { getPlatformToken, setPlatformToken } from './platformAuth';

export default function PlatformAdminApp() {
  const [authed, setAuthed] = useState(() => !!getPlatformToken());

  const handleLogout = () => {
    setPlatformToken('');
    localStorage.removeItem('barberpro_token');
    setAuthed(false);
  };

  if (!authed) {
    return <PlatformLogin onSuccess={() => setAuthed(true)} />;
  }

  return (
    <Routes>
      <Route path="/" element={<PlatformTenantsPage onLogout={handleLogout} />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}
