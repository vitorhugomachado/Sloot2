import React, { useEffect } from 'react';

export default function PlatformToast({ message, onClear }) {
  useEffect(() => {
    if (!message) return undefined;
    const t = window.setTimeout(() => onClear?.(), 2500);
    return () => window.clearTimeout(t);
  }, [message, onClear]);

  if (!message) return null;

  return (
    <div className="platform-toast" role="status">
      {message}
    </div>
  );
}
