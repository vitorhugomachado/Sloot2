import React, { useEffect, useState } from 'react';
import { STAFF_TOAST_EVENT } from '../utils/staffToast';

export default function StaffToast() {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let timer;
    const handler = (event) => {
      const { message, variant = 'info', duration = 3500 } = event.detail || {};
      if (!message) return;
      setToast({ message, variant });
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => setToast(null), duration);
    };

    window.addEventListener(STAFF_TOAST_EVENT, handler);
    return () => {
      window.removeEventListener(STAFF_TOAST_EVENT, handler);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  if (!toast?.message) return null;

  return (
    <div
      className={`staff-toast staff-toast--${toast.variant}`}
      role="status"
      aria-live="polite"
    >
      {toast.message}
    </div>
  );
}
