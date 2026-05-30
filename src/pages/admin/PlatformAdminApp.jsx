import React, { useState } from 'react';
import { Outlet, useOutletContext } from 'react-router-dom';
import PlatformLogin from './PlatformLogin';
import { getPlatformToken, setPlatformToken } from './platformAuth';

/** Repassa o contexto do admin para rotas aninhadas (ex. barbearias/:id). */
export function PlatformAdminOutlet() {
  const context = useOutletContext();
  return <Outlet context={context} />;
}

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

  return <Outlet context={{ onLogout: handleLogout }} />;
}
