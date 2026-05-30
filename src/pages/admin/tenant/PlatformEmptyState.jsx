import React from 'react';

export default function PlatformEmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="platform-empty-state">
      {Icon ? <Icon size={32} className="platform-empty-state__icon" aria-hidden /> : null}
      <p className="platform-empty-state__title">{title}</p>
      {description ? <p className="platform-empty-state__desc">{description}</p> : null}
      {action || null}
    </div>
  );
}
