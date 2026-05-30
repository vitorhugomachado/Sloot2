import React from 'react';

export default function PlatformStatusBadge({ status }) {
  const active = status === 'active';
  return (
    <span className={`platform-status-badge ${active ? 'platform-status-badge--active' : 'platform-status-badge--suspended'}`}>
      {active ? 'Ativa' : 'Suspensa'}
    </span>
  );
}
