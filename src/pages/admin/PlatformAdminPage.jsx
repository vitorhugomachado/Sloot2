import React from 'react';
import { useOutletContext } from 'react-router-dom';

/** Renderiza uma página do admin com `onLogout` vindo do layout pai. */
export default function PlatformAdminPage({ page: Page }) {
  const { onLogout } = useOutletContext();
  return <Page onLogout={onLogout} />;
}
